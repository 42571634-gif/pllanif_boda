(function () {
  if (typeof openVendorPhotos === "function") return;

  const PHOTO_MAX_PER_VENDOR = 10;
  const PHOTO_MAX_ORIGINAL_SIZE_BYTES = 1887437;
  const PHOTO_MAX_UPLOAD_SIZE_BYTES = 512000;
  const PHOTO_MAX_DIMENSION = 1600;
  const PHOTO_JPEG_QUALITY = 0.78;
  const PHOTO_MIME_TYPES = ["image/jpeg", "image/png", "image/webp"];
  const PHOTO_ACCEPT_TYPES = [...PHOTO_MIME_TYPES, "image/*"];

  let selectedPhotoFiles = [];
  let selectedPhotoVendorId = "";

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

    selectedPhotoFiles = [];
    selectedPhotoVendorId = vendorId;
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
          <p class="hint">Hasta ${PHOTO_MAX_PER_VENDOR} fotos. Original maximo ${formatPhotoBytes(PHOTO_MAX_ORIGINAL_SIZE_BYTES)}; la app comprime antes de subir.</p>
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
          <input id="vendor-photo-input" type="file" accept="${PHOTO_ACCEPT_TYPES.join(",")}" multiple ${remaining ? "" : "disabled"} />
        </label>
        <div id="photo-selected-files" class="photo-selected-files" aria-live="polite">${renderSelectedPhotoFiles()}</div>
        <div class="photo-upload-actions">
          <button class="btn" type="submit" ${remaining ? "" : "disabled"}>Subir fotos</button>
          ${vendor.drive_folder_url ? `<a class="btn secondary" href="${escapeHtml(vendor.drive_folder_url)}" target="_blank" rel="noreferrer">Abrir carpeta</a>` : ""}
        </div>
        <p class="hint">Disponibles: ${remaining}. Puedes seleccionar varias fotos; se comprimen y suben una por una.</p>
      </form>
      <div id="photo-status" class="hint">${loading ? "Cargando fotos..." : ""}</div>
      <div id="photo-upload-progress" class="photo-upload-progress" aria-live="polite"></div>
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
    const input = document.getElementById("vendor-photo-input");
    input?.addEventListener("change", () => {
      selectedPhotoVendorId = vendorId;
      selectedPhotoFiles = Array.from(input.files || []);
      renderSelectedPhotoFilesIntoDom();
    });

    document.getElementById("photo-upload-form")?.addEventListener("submit", async (event) => {
      event.preventDefault();
      const fallbackFiles = Array.from(input?.files || []);
      const files = selectedPhotoVendorId === vendorId && selectedPhotoFiles.length ? selectedPhotoFiles : fallbackFiles;
      await handlePhotoUpload(vendorId, files, photos);
    });

    modalRoot.querySelectorAll("[data-close]").forEach((button) => {
      button.addEventListener("click", clearSelectedPhotoFiles);
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
      renderPhotoProgress(files.map((file) => ({ name: file.name, status: "waiting", detail: formatPhotoBytes(file.size) })));
      updatePhotoProgress(0, "working", "Sincronizando proveedor...");
      await ensureRemoteVendor(vendorId);

      for (let index = 0; index < files.length; index += 1) {
        const file = files[index];
        const label = `${index + 1} de ${files.length}`;
        updatePhotoProgress(index, "working", `Comprimiendo ${label}...`);
        const payload = await fileToCompressedPhotoPayload(file);
        updatePhotoProgress(index, "working", `Subiendo ${label}: ${formatPhotoBytes(payload.size_bytes)}...`);
        await uploadVendorPhoto(vendorId, payload);
        updatePhotoProgress(index, "done", `Subida como ${formatPhotoBytes(payload.size_bytes)}.`);
      }

      clearSelectedPhotoFiles();
      await refreshVendorPhotos(vendorId, "Fotos subidas correctamente.");
    } catch (error) {
      markActivePhotoProgressError(error.message);
      setPhotoStatus(error.message);
    }
  }

  function validatePhotoFiles(files, activeCount) {
    if (!files.length) throw new Error("Selecciona al menos una foto.");
    if (activeCount + files.length > PHOTO_MAX_PER_VENDOR) {
      throw new Error(`Solo puedes tener ${PHOTO_MAX_PER_VENDOR} fotos activas por proveedor.`);
    }

    files.forEach((file) => {
      if (!isAllowedPhotoFile(file)) throw new Error(`${file.name} no es JPG, PNG o WEBP.`);
      if (file.size > PHOTO_MAX_ORIGINAL_SIZE_BYTES) throw new Error(`${file.name} supera ${formatPhotoBytes(PHOTO_MAX_ORIGINAL_SIZE_BYTES)}.`);
    });
  }

  function isAllowedPhotoFile(file) {
    if (PHOTO_MIME_TYPES.includes(file.type)) return true;
    if (file.type && file.type.startsWith("image/")) {
      return /\.(jpe?g|png|webp)$/i.test(file.name || "");
    }
    return /\.(jpe?g|png|webp)$/i.test(file.name || "");
  }

  async function fileToCompressedPhotoPayload(file) {
    const image = await loadPhotoImage(file);
    const dimensions = fitPhotoDimensions(image.width, image.height);
    const canvas = document.createElement("canvas");
    canvas.width = dimensions.width;
    canvas.height = dimensions.height;

    const context = canvas.getContext("2d");
    context.drawImage(image, 0, 0, dimensions.width, dimensions.height);
    URL.revokeObjectURL(image.src);

    let blob = await canvasToBlob(canvas, "image/jpeg", PHOTO_JPEG_QUALITY);
    if (blob.size > PHOTO_MAX_UPLOAD_SIZE_BYTES) {
      blob = await canvasToBlob(canvas, "image/jpeg", 0.68);
    }
    if (blob.size > PHOTO_MAX_UPLOAD_SIZE_BYTES) {
      throw new Error(`${file.name} no pudo comprimirse por debajo de ${formatPhotoBytes(PHOTO_MAX_UPLOAD_SIZE_BYTES)}.`);
    }

    return blobToPhotoPayload(blob, renamePhotoAsJpeg(file.name));
  }

  function loadPhotoImage(file) {
    return new Promise((resolve, reject) => {
      const image = new Image();
      const url = URL.createObjectURL(file);
      image.onload = () => resolve(image);
      image.onerror = () => {
        URL.revokeObjectURL(url);
        reject(new Error(`No se pudo preparar ${file.name}.`));
      };
      image.src = url;
    });
  }

  function fitPhotoDimensions(width, height) {
    const maxSide = Math.max(width, height);
    if (maxSide <= PHOTO_MAX_DIMENSION) return { width, height };
    const scale = PHOTO_MAX_DIMENSION / maxSide;
    return {
      width: Math.max(1, Math.round(width * scale)),
      height: Math.max(1, Math.round(height * scale)),
    };
  }

  function canvasToBlob(canvas, type, quality) {
    return new Promise((resolve, reject) => {
      canvas.toBlob((blob) => {
        if (blob) resolve(blob);
        else reject(new Error("No se pudo comprimir la foto."));
      }, type, quality);
    });
  }

  function blobToPhotoPayload(blob, fileName) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const dataUrl = String(reader.result || "");
        resolve({
          file_name: fileName,
          mime_type: blob.type || "image/jpeg",
          size_bytes: blob.size,
          base64: dataUrl.includes(",") ? dataUrl.split(",")[1] : dataUrl,
        });
      };
      reader.onerror = () => reject(new Error(`No se pudo leer ${fileName}.`));
      reader.readAsDataURL(blob);
    });
  }

  function renamePhotoAsJpeg(fileName) {
    const cleanName = String(fileName || "foto").replace(/\.[^.]+$/, "");
    return `${cleanName || "foto"}.jpg`;
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

  async function uploadVendorPhoto(vendorId, photo) {
    const apiUrl = getApiUrl();
    if (!apiUrl) throw new Error("Configura la URL Apps Script antes de subir fotos.");
    return postToGooglePhotos(apiUrl, { action: "uploadVendorPhoto", vendor_id: vendorId, ...photo });
  }

  async function ensureRemoteVendor(vendorId) {
    const apiUrl = getApiUrl();
    if (!apiUrl) throw new Error("Configura la URL Apps Script antes de subir fotos.");
    const vendor = state.vendors.find((item) => item.id === vendorId);
    if (!vendor) throw new Error("No se encontro el proveedor local para sincronizar.");

    try {
      const result = await postToGooglePhotos(apiUrl, { action: "upsertVendor", vendor });
      if (result.vendor) {
        const current = state.vendors.find((item) => item.id === vendorId);
        if (current) {
          Object.assign(current, result.vendor);
          saveState();
        }
      }
      return result;
    } catch (error) {
      throw new Error(`No se pudo sincronizar el proveedor antes de subir fotos: ${error.message}`);
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

  function renderPhotoProgress(items) {
    const progress = document.getElementById("photo-upload-progress");
    if (!progress) return;
    progress.innerHTML = items
      .map(
        (item, index) => `
          <div class="photo-progress-row" data-progress-index="${index}" data-status="${item.status}">
            <span>${escapeHtml(item.name)}</span>
            <strong>${escapeHtml(item.detail)}</strong>
          </div>
        `,
      )
      .join("");
    setPhotoStatus("Preparando fotos...");
  }

  function renderSelectedPhotoFiles() {
    if (!selectedPhotoFiles.length) return `<span class="hint">Ningun archivo seleccionado.</span>`;
    return `
      <strong>${selectedPhotoFiles.length} archivo${selectedPhotoFiles.length === 1 ? "" : "s"} seleccionado${selectedPhotoFiles.length === 1 ? "" : "s"}</strong>
      <ul>
        ${selectedPhotoFiles.map((file) => `<li>${escapeHtml(file.name)} <span>${formatPhotoBytes(file.size)}</span></li>`).join("")}
      </ul>
    `;
  }

  function renderSelectedPhotoFilesIntoDom() {
    const target = document.getElementById("photo-selected-files");
    if (target) target.innerHTML = renderSelectedPhotoFiles();
  }

  function clearSelectedPhotoFiles() {
    selectedPhotoFiles = [];
    selectedPhotoVendorId = "";
    const input = document.getElementById("vendor-photo-input");
    if (input) input.value = "";
    renderSelectedPhotoFilesIntoDom();
  }

  function updatePhotoProgress(index, status, detail) {
    const row = document.querySelector(`[data-progress-index="${index}"]`);
    if (!row) return;
    row.dataset.status = status;
    const detailNode = row.querySelector("strong");
    if (detailNode) detailNode.textContent = detail;
    setPhotoStatus(detail);
  }

  function markActivePhotoProgressError(message) {
    const active = document.querySelector('.photo-progress-row[data-status="working"]');
    if (!active) return;
    active.dataset.status = "error";
    const detailNode = active.querySelector("strong");
    if (detailNode) detailNode.textContent = message;
  }

  function formatPhotoBytes(value) {
    const bytes = Number(value || 0);
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
    return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  }
})();
