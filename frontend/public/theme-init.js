(function () {
  try {
    var key = "echo-theme:v1";
    var stored = window.localStorage.getItem(key);
    var parsed = stored ? JSON.parse(stored) : {};
    var variants = ["echo-calm", "echo-night", "echo-soft", "echo-focus"];
    var modes = ["light", "dark", "system"];
    var motion = parsed.motion === "full" ? "full" : "system";
    var variant = variants.indexOf(parsed.variant) >= 0 ? parsed.variant : "echo-calm";
    var mode = modes.indexOf(parsed.mode) >= 0 ? parsed.mode : "light";
    var systemDark =
      window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches;
    var resolvedMode = mode === "system" ? (systemDark ? "dark" : "light") : mode;
    var root = document.documentElement;
    root.dataset.echoTheme = variant;
    root.dataset.echoMode = mode;
    root.dataset.echoMotion = motion;
    root.classList.toggle("dark", resolvedMode === "dark" || variant === "echo-night");
  } catch (error) {
    document.documentElement.dataset.echoTheme = "echo-calm";
    document.documentElement.dataset.echoMode = "light";
    document.documentElement.dataset.echoMotion = "system";
  }
})();
