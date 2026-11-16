(function () {
  "use strict";
  // Preserve links shared before the welcome page became the site's entry point.
  var instructionSections = ["systems", "access", "prep", "fields", "steps", "edit", "rules", "step1", "step2", "step3", "step4", "step5", "step6"];
  if (instructionSections.indexOf(window.location.hash.slice(1)) !== -1) {
    window.location.replace(new URL("instructions.html" + window.location.hash, window.location.href).href);
    return;
  }
  var canvas = document.getElementById("profile-wave");
  if (canvas && typeof window.initWave === "function") {
    window.initWave(canvas);
  }
}());
