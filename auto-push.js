(function () {
  "use strict";

  if (typeof upsert !== "function" || typeof softDelete !== "function") return;

  const QUEUE_KEY = `${STORAGE_PREFIX}:pendingSync:v2`;
  const DEFAULT_REMOTE_API_URL = "https://script.google.com/macros/s/AKfycbxTnacdtk_tAOfp4rSVOkDFs-4gYSQunZtI8RHxkwTlQdXUw6s98w-_k0efp4kmTY6rMA/exec";
  const COLLECTIONS = {
    vendors: { upsert: "upsertVendor", delete: "softDeleteVendor", responseKey: "vendor" },
    payments: { upsert: "upsertPayment", delete: "softDeletePayment", responseKey: "payment" },
    budgets: { upsert: "upsertBudget", delete: "upsertBudget", responseKey: "budget" },
  };

  let queue = loadQueue();
  let processing = false;
  let initialPullStarted = false;

  const originalGetApiUrl = getApiUrl;
  getApiUrl = function onlineFirstGetApiUrl() {
    const configured = String(state.sync.apiUrl || "").trim();
    if (LOCAL_API_VALUES.includes(configured.toLowerCase())) return "";
    return originalGetApiUrl() || DEFAULT_REMOTE_API_URL;
  };

  const originalUpsert = upsert;
  upsert = function onlineFirstUpsert(collection, item) {
    originalUpsert(collection, item);
    if (COLLECTIONS[collection]) enqueue(collection, "upsert", cloneItem(item));
  };

  const originalSoftDelete = softDelete;
  softDelete = function onlineFirstSoftDelete(collection, id) {
    originalSoftDelete(collection, id);
    const item = state[collection]?.find((current) => String(current.id) === String(id));
    if (item && COLLECTIONS[collection]?.delete) enqueue(collection, "delete", cloneItem(item));
  };

  const originalSyncStatusText = syncStatusText;
  syncStatusText = function onlineFirstSyncStatusText() {
    const base = originalSyncStatusText();
    const pending = queue.length;
    const status = state.sync.autoSyncStatus || "";
    const suffix = pending ? ` Pendiente de sincronizar: ${pending}.` : status ? ` ${status}` : "";
    return `${base}${suffix}`;
  };

  const originalSimulateGoogleSave = simulateGoogleSave;
  simulateGoogleSave = async function granularManualSave() {
    const apiUrl = getApiUrl();
    if (!apiUrl) {
      await originalSimulateGoogleSave();
      return;
    }
    enqueueAllLocal();
    await processQueue();
    if (!queue.length) showSuccess("Cambios enviados a Drive por registro.");
    else showError("Algunos cambios quedaron pendientes de sincronizar.");
  };

  const originalSimulateGoogleLoad = simulateGoogleLoad;
  simulateGoogleLoad = async function onlineFirstManualLoad() {
    const apiUrl = getApiUrl();
    if (!apiUrl) {
      await originalSimulateGoogleLoad();
      return;
    }
    await downloadLatest({ showToast: true });
    await processQueue();
  };

  window.addEventListener("online", () => processQueue());
  window.setTimeout(() => {
    initialPullStarted = true;
    downloadLatest({ showToast: false }).finally(processQueue);
  }, 350);

  function enqueue(collection, operation, item) {
    if (!item?.id || !COLLECTIONS[collection]) return;
    const action = operation === "delete" ? COLLECTIONS[collection].delete : COLLECTIONS[collection].upsert;
    if (!action) return;
    const key = `${collection}:${operation}:${item.id}`;
    queue = queue.filter((entry) => entry.key !== key);
    queue.push({ key, collection, operation, action, item, queuedAt: new Date().toISOString() });
    saveQueue();
    setAutoStatus("Pendiente de sincronizar");
    processQueue();
  }

  function enqueueAllLocal() {
    ["vendors", "payments", "budgets"].forEach((collection) => {
      (state[collection] || []).forEach((item) => enqueue(collection, item.is_deleted ? "delete" : "upsert", cloneItem(item)));
    });
  }

  async function processQueue() {
    const apiUrl = getApiUrl();
    if (!apiUrl || processing || !queue.length) return;
    processing = true;
    setAutoStatus("Sincronizando...");
    try {
      while (queue.length) {
        const entry = queue[0];
        const result = await postAction(apiUrl, entry);
        applyRemoteResult(entry, result);
        queue.shift();
        saveQueue();
      }
      state.sync.lastSyncAt = new Date().toISOString();
      state.sync.autoSyncStatus = "Guardado en Drive";
      state.sync.autoPushError = "";
      saveState();
      renderApp();
    } catch (error) {
      state.sync.autoSyncStatus = "Pendiente de sincronizar";
      state.sync.autoPushError = error.message;
      saveState();
      renderApp();
    } finally {
      processing = false;
    }
  }

  async function downloadLatest({ showToast }) {
    const apiUrl = getApiUrl();
    if (!apiUrl) return;
    setAutoStatus("Sincronizando...");
    try {
      const url = new URL(apiUrl);
      url.searchParams.set("action", "download");
      url.searchParams.set("key", state.sync.remoteKey || ACCESS_KEY);
      const response = await fetch(url.toString());
      const result = await parseApiResponse(response);
      if (!result.ok) throw new Error(result.error || "No se pudo descargar la data.");
      state = migrateState({
        ...state,
        vendors: mergePending("vendors", result.data.vendors || []),
        payments: mergePending("payments", result.data.payments || []),
        budgets: mergePending("budgets", result.data.budgets || []),
        sync: {
          ...state.sync,
          ...(result.data.sync || {}),
          lastSyncAt: new Date().toISOString(),
          autoSyncStatus: queue.length ? "Pendiente de sincronizar" : "Guardado en Drive",
          autoPushError: "",
        },
      });
      saveState();
      renderApp();
      if (showToast) showSuccess("Data cargada correctamente desde Drive.");
    } catch (error) {
      state.sync.autoSyncStatus = "Trabajando con cache";
      state.sync.autoPushError = error.message;
      saveState();
      renderApp();
      if (showToast || !initialPullStarted) showError(`No se pudo cargar desde Drive: ${error.message}`);
    }
  }

  async function postAction(apiUrl, entry) {
    const body = { action: entry.action, key: state.sync.remoteKey || ACCESS_KEY, actor: "front-online-first" };
    const responseKey = COLLECTIONS[entry.collection].responseKey;
    if (entry.operation === "delete") {
      body.id = entry.item.id;
      body.updated_at = entry.item.updated_at || new Date().toISOString();
    } else {
      body[responseKey] = entry.item;
    }
    const response = await fetch(apiUrl, {
      method: "POST",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify(body),
    });
    const result = await parseApiResponse(response);
    if (!result.ok) throw new Error(result.error || "No se pudo sincronizar automaticamente.");
    return result;
  }

  function applyRemoteResult(entry, result) {
    const responseKey = COLLECTIONS[entry.collection].responseKey;
    const remote = result[responseKey];
    if (!remote?.id) return;
    const index = state[entry.collection].findIndex((item) => String(item.id) === String(remote.id));
    if (index >= 0) state[entry.collection][index] = { ...state[entry.collection][index], ...remote, synced_at: new Date().toISOString() };
    else state[entry.collection].push({ ...remote, synced_at: new Date().toISOString() });
    saveState();
  }

  function mergePending(collection, remoteItems) {
    const pendingIds = new Set(queue.filter((entry) => entry.collection === collection).map((entry) => String(entry.item.id)));
    const map = new Map(remoteItems.map((item) => [String(item.id), item]));
    (state[collection] || []).forEach((local) => {
      if (pendingIds.has(String(local.id))) map.set(String(local.id), local);
    });
    return [...map.values()];
  }

  function setAutoStatus(status) {
    state.sync.autoSyncStatus = status;
    saveState();
    renderApp();
  }

  function loadQueue() {
    try {
      return JSON.parse(localStorage.getItem(QUEUE_KEY) || "[]");
    } catch {
      return [];
    }
  }

  function saveQueue() {
    localStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
  }

  function cloneItem(item) {
    return JSON.parse(JSON.stringify(item));
  }
})();
