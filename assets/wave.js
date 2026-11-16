(function () {
"use strict";
/**
 * A quiet, three-dimensional point surface for the Digital Profile welcome.
 * The canvas needs an explicit CSS width and height. Its background stays clear.
 *
 * const wave = initWave(document.querySelector('[data-wave]'));
 * wave.destroy(); // Remove all observers, listeners and animation frames.
 */
const instances = new WeakMap();

function initWave(canvas) {
  if (!canvas || typeof canvas.getContext !== 'function') {
    throw new TypeError('initWave expects a canvas element.');
  }

  instances.get(canvas)?.destroy();
  const context = canvas.getContext('2d', { alpha: true });
  if (!context) return { destroy() {}, pause() {}, resume() {} };

  const document = canvas.ownerDocument;
  const window = document.defaultView;
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const previousPointerEvents = canvas.style.pointerEvents;
  canvas.style.pointerEvents = 'none';

  const TAU = Math.PI * 2;
  const bucketCount = 18;
  const buckets = Array.from({ length: bucketCount }, () => []);
  const colors = buckets.map((_, i) => `rgba(143,132,223,${(i + 1) / bucketCount * 0.72})`);
  let points = [];
  let width = 0;
  let height = 0;
  let pixelRatio = 1;
  let frame = 0;
  let previousTime = 0;
  let elapsed = 4.4;
  let paused = false;
  let destroyed = false;

  const clamp = (value, min = 0, max = 1) => Math.min(max, Math.max(min, value));
  const smoothstep = (low, high, value) => {
    const amount = clamp((value - low) / (high - low));
    return amount * amount * (3 - 2 * amount);
  };

  function createGrid() {
    const columns = width < 600 ? 78 : 118;
    const rows = width < 600 ? 42 : 60;
    points = [];
    for (let row = 0; row < rows; row += 1) {
      const v = row / (rows - 1) * 2 - 1;
      for (let column = 0; column < columns; column += 1) {
        const u = column / (columns - 1) * 2 - 1;
        // Preserve the regular lattice; fade its edges instead of cropping it.
        const edge = smoothstep(0, 0.25, 1 - Math.abs(u))
          * smoothstep(0, 0.34, 1 - Math.abs(v));
        points.push({ u, v, edge });
      }
    }
  }

  function paint() {
    if (destroyed || !width || !height) return;
    context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
    context.clearRect(0, 0, width, height);
    buckets.forEach(bucket => { bucket.length = 0; });

    const phase = elapsed * 0.31;
    const compact = width < 600;
    const centerX = width * (compact ? 0.79 : 0.77);
    const centerY = height * (compact ? 0.38 : 0.47);
    const horizontalScale = width * (compact ? 0.69 : 0.52);
    const verticalScale = Math.min(height * 0.55, width * 0.36);

    for (const point of points) {
      const { u, v, edge } = point;
      // Two long travelling ripples form a single continuous piece of fabric.
      const crest = Math.sin(u * 2.8 - v * 1.05 - phase);
      const fold = Math.cos(v * 2.6 + u * 1.4 + phase * 0.64);
      const z = crest * 0.30 + fold * 0.12;
      const perspective = 1 / (1 + v * 0.19 - z * 0.23);
      const projectedX = u * 0.95 + v * 0.20 + z * 0.12;
      const projectedY = v * 0.57 + z * 0.91 - u * 0.14;
      const x = centerX + projectedX * horizontalScale * perspective;
      const y = centerY + projectedY * verticalScale * perspective;

      // A broad transparent margin keeps the title and controls undisturbed.
      const leftFade = smoothstep(compact ? 0.03 : 0.25, compact ? 0.49 : 0.61, x / width);
      const canvasEdge = smoothstep(-0.06, 0.11, y / height)
        * (1 - smoothstep(0.90, 1.13, y / height));
      const depth = clamp((1 - v) * 0.30 + 0.25 + z * 0.37);
      const opacity = edge * leftFade * canvasEdge * (0.30 + depth * 0.69);
      if (opacity < 0.025 || x < -4 || x > width + 4 || y < -4 || y > height + 4) continue;

      const bucketIndex = Math.min(bucketCount - 1, Math.floor(opacity * bucketCount));
      const radius = (compact ? 0.63 : 0.72) + depth * 0.53;
      buckets[bucketIndex].push(x, y, radius);
    }

    // Batch circles with the same opacity: at most 18 fills per frame.
    for (let index = 0; index < bucketCount; index += 1) {
      const bucket = buckets[index];
      if (!bucket.length) continue;
      context.beginPath();
      context.fillStyle = colors[index];
      for (let offset = 0; offset < bucket.length; offset += 3) {
        const x = bucket[offset];
        const y = bucket[offset + 1];
        const radius = bucket[offset + 2];
        context.moveTo(x + radius, y);
        context.arc(x, y, radius, 0, TAU);
      }
      context.fill();
    }
  }

  function canAnimate() {
    return !destroyed && !paused && !document.hidden && !reducedMotion.matches && width > 0 && height > 0;
  }

  function animate(time) {
    frame = 0;
    if (!canAnimate()) return;
    if (previousTime) elapsed += Math.min((time - previousTime) / 1000, 0.05);
    previousTime = time;
    paint();
    frame = window.requestAnimationFrame(animate);
  }

  function stop() {
    if (frame) window.cancelAnimationFrame(frame);
    frame = 0;
    previousTime = 0;
  }

  function sync() {
    stop();
    if (!document.hidden) paint();
    if (canAnimate()) frame = window.requestAnimationFrame(animate);
  }

  function resize() {
    if (destroyed) return;
    const rect = canvas.getBoundingClientRect();
    const nextWidth = Math.max(0, rect.width);
    const nextHeight = Math.max(0, rect.height);
    const nextPixelRatio = Math.min(window.devicePixelRatio || 1, 1.6);
    if (nextWidth === width && nextHeight === height && nextPixelRatio === pixelRatio) return;
    width = nextWidth;
    height = nextHeight;
    pixelRatio = nextPixelRatio;
    canvas.width = Math.max(1, Math.round(width * pixelRatio));
    canvas.height = Math.max(1, Math.round(height * pixelRatio));
    createGrid();
    sync();
  }

  const observer = typeof window.ResizeObserver === 'function'
    ? new window.ResizeObserver(resize)
    : null;
  observer?.observe(canvas);
  window.addEventListener('resize', resize, { passive: true });
  document.addEventListener('visibilitychange', sync);
  if (reducedMotion.addEventListener) reducedMotion.addEventListener('change', sync);
  else reducedMotion.addListener(sync);

  const controller = {
    pause() { paused = true; stop(); },
    resume() { paused = false; sync(); },
    destroy() {
      if (destroyed) return;
      destroyed = true;
      stop();
      observer?.disconnect();
      window.removeEventListener('resize', resize);
      document.removeEventListener('visibilitychange', sync);
      if (reducedMotion.removeEventListener) reducedMotion.removeEventListener('change', sync);
      else reducedMotion.removeListener(sync);
      canvas.style.pointerEvents = previousPointerEvents;
      points.length = 0;
      buckets.forEach(bucket => { bucket.length = 0; });
      instances.delete(canvas);
    },
  };

  instances.set(canvas, controller);
  resize();
  return controller;
}

window.initWave = initWave;
}());
