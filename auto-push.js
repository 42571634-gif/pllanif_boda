(function () {
  "use strict";

  if (typeof upsert !== "function") return;

  const AUTO_PUSH_COLLECTIONS = new Set(["vendors", "payments"]);
  let pushing = false;
  let pending = false;
  let lastReason = "";

  const originalUpsert = upsert;
  upsert = function autoPushUpsert(collection, item) {
    originalUpsert(collection, item);
    if (AUTO_PUSH_COLLECTIONS.has(collection)) scheduleAutoPush(collection);
  };

  function scheduleAutoPush(collection) {
    lastReason = collection;
    if (pushing) {
      pending = true;
      return;
    }
    window.setTimeout(pushLatest, 250);
  }

  async function pushLatest() {
    const apiUrl = safeApiUrl();
    if (!apiUrl) return;
    pushing = true;
    pending = false;
    try {
      const payload = {
        action: "upload",
        key: state.sync.remoteKey || ACCESS_KEY,
        actor: `auto-${lastReason || "save"}`,
        data: {
          vendors: state.vendors,
          payments: state.payments,
          budgets: state.budgets,
        },
      };
      const response = await fetch(apiUrl, {
        method: "POST",
        headers: { "Content-Type": "text/plain;charset=utf-8" },
        body: JSON.stringify(payload),
      });
      const result = await parseApiResponse(response);
      if (!result.ok) throw new Error(result.error || "No se pudo sincronizar automaticamente.");
      state.sync.lastSyncAt = result.savedAt || new Date().toISOString();
      saveState();
    } catch (error) {
      console.warn("Auto push failed", error);
      state.sync.autoPushError = error.message;
      saveState();
    } finally {
      pushing = false;
      if (pending) pushLatest();
    }
  }

  function safeApiUrl() {
    try {
      return typeof getApiUrl === "function" ? getApiUrl() : "";
    } catch {
      return "";
    }
  }
})();
