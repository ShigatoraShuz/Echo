(() => {
  const SESSION_KEY = "echo.app-intro.seen";

  try {
    const seen = window.sessionStorage.getItem(SESSION_KEY) === "1";

    document.documentElement.dataset.echoIntro = seen ? "seen" : "fresh";
  } catch {
    document.documentElement.dataset.echoIntro = "fresh";
  }
})();
