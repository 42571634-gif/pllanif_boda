(function () {
  "use strict";

  const ACCESS_KEY = "boda-2026";
  const STORAGE_KEY = "weddingPlanner:accessGranted";
  const KEY_STORAGE = "weddingPlanner:accessKey";
  const url = new URL(window.location.href);
  const key = String(url.searchParams.get("key") || "").trim();
  const saved = localStorage.getItem(STORAGE_KEY) === "true" && localStorage.getItem(KEY_STORAGE) === ACCESS_KEY;

  if (key === ACCESS_KEY) {
    localStorage.setItem(STORAGE_KEY, "true");
    localStorage.setItem(KEY_STORAGE, ACCESS_KEY);
    window.setTimeout(() => {
      const cleanUrl = new URL(window.location.href);
      cleanUrl.searchParams.delete("key");
      window.history.replaceState({}, "", cleanUrl.toString());
    }, 0);
    return;
  }

  if (!key && saved) {
    url.searchParams.set("key", ACCESS_KEY);
    window.history.replaceState({}, "", url.toString());
  }
})();
