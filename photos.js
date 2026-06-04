(function () {
  if (typeof openVendorPhotos === "function") return;

  const PHOTO_MAX_PER_VENDOR = 10;
  const PHOTO_MAX_SIZE_BYTES = 512000;
  const PHOTO_BATCH_SIZE = 3;
  const PHOTO_MIME_TYPES = ["image/jpeg", "image/png", "image/webp"];

  const originalVendorListItem = vendorListItem;
  vendorListItem = function patchedVendorListItem(vendor) {
    const html = originalVendorListItem(vendor);
    if (html.includes('data-action="vendor-photos"')) return html;
    return html.replace(
      `<button class="action-btn danger-text" data-action="delete-vendor"`,
      `<button class="action-btn" data-action="vendor-photos" data-id="${vendor.id}" title="Fotos del proveedor">Fotos</button>
        <button class="action-btn danger-text" data-action="delete-vendor"`,
    );
  };

  const originalHandleAction = handleAction;
  handleAction = function patchedHandleAction(action, id) {
    if (action === "vendor-photos") {
      openPhotosModal(id);
      return;
    }
    originalHandleAction(action, id);
  };

  async function openPhotosModal(vendorId) {
    const vendor = state.vendors.find((item) => item.id === vendorId);
    if (!vendor) return;

    openModal(renderPhotosModal(vendor, [], true), "wide");

    try {
      const photos = await listVendorPhotos(vendorId);
      renderPhotosContent(vendorId, photos);
    } catch (error) {
      renderPhotosContent(vendorId, [], false, error.message);
    }
  }

  function renderPhotosModal(vendor, photos = [], loading = false, error = "") {
    return `
      <div class="modal-head">
        <div>
          <h2>Fotos - ${escapeHtml(vendor.name)}</h2>
          <p class="hint">Hasta ${PHOTO_MAX_PER_VENDOR} fotos, ${formatPhotoBytes(PHOTO_MAX_SIZE_BYTES)} por archivo y ${PHOTO_BATCH_SIZE} por lote.</p>
        </div>
        <button class="icon-btn" type="button" data-close title="Cerrar">x</button>
      </div>
      <div class="modal-body photo-manager" id="photo-manager" data-vendor-id="${vendor.id}">
        ${renderPhotosBody(vendor, photos, loading, error)}
      </div>
    `;
  }

  function renderPhotosBody(vendor, photos = [], loading = false, error = "") {
    const activePhotos = photos.filter((photo) => !photo.is_deleted);
    const remaining = Math.max(0, PHOTO_MAX_PER_VENDOR - activePhotos.length);
    return `
      ${error ? `<div class="inline-error">${escapeHtml(error)}</div>` : ""}
      <form id="photo-upload-form" class="photo-upload">
        <label class="field full">
          <span>Subir fotos</span>
          <input id="vendor-photo-input" type="file" accept="${PHOTO_MIME_TYPES.join(",")}" multiple ${remaining ? "" : "disabled"} />
        </label>
        <div class="photo-upload-actions">
          <button class="btn" type="submit" ${remaining ? "" : "disabled"}>Subir fotos</button>
          ${vendor.drive_folder_url ? `<a class="btn secondary" href="${escapeHtml(vendor.drive_folder_url)}" target="_blank" rel="noreferrer">Abrir carpeta</a>` : ""}
        </div>
        <p class="hint">Disponibles: ${remaining}. Si seleccionas mas de ${PHOTO_BATCH_SIZE}, la app subira automaticamente en lotes.</p>
      </form>
      <div id="photo-status" class="hint">${loading ? "Cargando fotos..." : ""}</div>
      <section class="photo-grid">
        ${
          activePhotos.length
            ? activePhotos.map((photo) => renderPhotoCard(vendor.id, photo)).join("")
            : `<div class="empty">Sin fotos para este proveedor.</div>`
        }
      </section>
    `;
  }

  function renderPhotoCard(vendorId, photo) {
    const imageUrl = photo.thumbnail_url || photo.file_url;
    return `
      <article class="photo-card">
        <a href="${escapeHtml(photo.file_url || imageUrl)}" target="_blank" rel="noreferrer">
          <img src="${escapeHtml(imageUrl)}" alt="${escapeHtml(photo.file_name || "Foto de proveedor")}" loading="lazy" />
        </a>
        <div class="photo-card-body">
          <strong>${escapeHtml(photo.file_name || "Foto")}</strong>
          <span>${formatPhotoBytes(photo.size_bytes || 0)}${photo.is_cover ? " - Portada" : ""}</span>
          <div class="row-actions">
            <button class="action-btn" type="button" data-photo-action="cover" data-vendor-id="${vendorId}" data-photo-id="${photo.id}" ${photo.is_cover ? "disabled" : ""}>Portada</button>
            <button class="action-btn danger-text" type="button" data-photo-action="delete" data-vendor-id="${vendorId}" data-photo-id="${photo.id}">Eliminar</button>
          </div>
        </div>
      </article>
    `;
  }

  function renderPhotosContent(vendorId, photos, loading = false, error = "") {
    const vendor = state.vendors.find((item) => item.id === vendorId);
    const manager = document.getElementById("photo-manager");
    if (!vendor || !manager) return;

    manager.innerHTML = renderPhotosBody(vendor, photos, loading, error);
    bindPhotosModal(vendorId, photos);
  }

  function bindPhotosModal(vendorId, photos) {
    document.getElementById("photo-upload-form")?.addEventListener("submit", async (event) => {
      event.preventDefault();
      const input = document.getElementById("vendor-photo-input");
      await handlePhotoUpload(vendorId, Array.from(input?.files || []), photos);
    });

    document.querySelectorAll("[data-photo-action]").forEach((button) => {
      button.addEventListener("click", async () => {
        const action = button.dataset.photoAction;
        const photoId = button.dataset.photoId;
        try {
          if (action === "cover") await setVendorCoverPhoto(vendorId, photoId);
          if (action === "delete") await deleteVendorPhoto(vendorId, photoId);
        } catch (error) {
          const freshPhotos = await safeListVendorPhotos(vendorId);
          renderPhotosContent(vendorId, freshPhotos, false, error.message);
        }
      });
    });
  }

  async function handlePhotoUpload(vendorId, files, currentPhotos) {
    try {
      const activeCount = currentPhotos.filter((photo) => !photo.is_deleted).length;
      validatePhotoFiles(files, activeCount);
      setPhotoStatus("Preparando fotos...");
      const payloads = await Promise.all(files.map(fileToPhotoPayload));
      const batches = chunkPhotos(payloads, PHOTO_BATCH_SIZE);

      for (let index = 0; index < batches.length; index += 1) {
        setPhotoStatus(`Subiendo lote ${index + 1} de ${batches.length}...`);
        await uploadVendorPhotos(vendorId, batches[index]);
      }

      await refreshVendorPhotos(vendorId, "Fotos subidas correctamente.");
    } catch (error) {
      const photos = await safeListVendorPhotos(vendorId);
      renderPhotosContent(vendorId, photos, false, error.message);
    }
  }

  function validatePhotoFiles(files, activeCount) {
    if (!files.length) throw new Error("Selecciona al menos una foto.");
    if (activeCount + files.length > PHOTO_MAX_PER_VENDOR) {
      throw new Error(`Solo puedes tener ${PHOTO_MAX_PER_VENDOR} fotos activas por proveedor.`);
    }

    files.forEach((file) => {
      if (!PHOTO_MIME_TYPES.includes(file.type)) throw new Error(`${file.name} no es JPG, PNG o WEBP.`);
      if (file.size > PHOTO_MAX_SIZE_BYTES) throw new Error(`${file.name} supera ${formatPhotoBytes(PHOTO_MAX_SIZE_BYTES)}.`);
    });
  }

  function fileToPhotoPayload(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const dataUrl = String(reader.result || "");
        resolve({
          file_name: file.name,
          mime_type: file.type,
          size_bytes: file.size,
          base64: dataUrl.includes(",") ? dataUrl.split(",")[1] : dataUrl,
        });
      };
      reader.onerror = () => reject(new Error(`No se pudo leer ${file.name}.`));
      reader.readAsDataURL(file);
    });
  }

  async function listVendorPhotos(vendorId) {
    const apiUrl = getApiUrl();
    if (!apiUrl) return [];
    const result = await postToGooglePhotos(apiUrl, { action: "listVendorPhotos", vendor_id: vendorId });
    return result.photos || [];
  }

  async function safeListVendorPhotos(vendorId) {
    try {
      return await listVendorPhotos(vendorId);
    } catch {
      return [];
    }
  }

  async function uploadVendorPhotos(vendorId, photos) {
    const apiUrl = getApiUrl();
    if (!apiUrl) throw new Error("Configura la URL Apps Script antes de subir fotos.");

    try {
      return await postToGooglePhotos(apiUrl, { action: "uploadVendorPhotos", vendor_id: vendorId, photos });
    } catch (error) {
      if (!/Unsupported action/i.test(error.message)) throw error;
      const uploaded = [];
      for (const photo of photos) {
        uploaded.push(await postToGooglePhotos(apiUrl, { action: "uploadVendorPhoto", vendor_id: vendorId, ...photo }));
      }
      return { ok: true, photos: uploaded.map((item) => item.photo).filter(Boolean) };
    }
  }

  async function deleteVendorPhoto(vendorId, photoId) {
    const apiUrl = getApiUrl();
    if (!apiUrl) throw new Error("Configura la URL Apps Script antes de eliminar fotos.");
    await postToGooglePhotos(apiUrl, { action: "deleteVendorPhoto", photo_id: photoId });
    await refreshVendorPhotos(vendorId, "Foto eliminada correctamente.");
  }

  async function setVendorCoverPhoto(vendorId, photoId) {
    const apiUrl = getApiUrl();
    if (!apiUrl) throw new Error("Configura la URL Apps Script antes de cambiar portada.");
    await postToGooglePhotos(apiUrl, { action: "setVendorCoverPhoto", vendor_id: vendorId, photo_id: photoId });
    await refreshVendorPhotos(vendorId, "Portada actualizada correctamente.");
  }

  async function refreshVendorPhotos(vendorId, message = "") {
    const photos = await listVendorPhotos(vendorId);
    const vendor = state.vendors.find((item) => item.id === vendorId);
    if (vendor) {
      const activePhotos = photos.filter((photo) => !photo.is_deleted);
      const cover = activePhotos.find((photo) => photo.is_cover) || activePhotos[0];
      vendor.photo_count = activePhotos.length;
      vendor.cover_photo_url = cover ? cover.thumbnail_url || cover.file_url : "";
      saveState();
    }
    renderPhotosContent(vendorId, photos);
    if (message) setPhotoStatus(message);
  }

  async function postToGooglePhotos(apiUrl, payload) {
    const response = await fetch(apiUrl, {
      method: "POST",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify({
        key: state.sync.remoteKey || ACCESS_KEY,
        actor: "front",
        ...payload,
      }),
    });
    const result = await parseApiResponse(response);
    if (!result.ok) throw new Error(result.error || "Operacion remota fallida.");
    return result;
  }

  function setPhotoStatus(message) {
    const status = document.getElementById("photo-status");
    if (status) status.textContent = message;
  }

  function formatPhotoBytes(value) {
    const bytes = Number(value || 0);
    if (bytes < 1024) return `${bytes} B`;
    return `${Math.round(bytes / 1024)} KB`;
  }

  function chunkPhotos(items, size) {
    const groups = [];
    for (let index = 0; index < items.length; index += size) {
      groups.push(items.slice(index, index + size));
    }
    return groups;
  }
})();
