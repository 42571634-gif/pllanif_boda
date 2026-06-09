/**
 * Wedding Planner data API for Google Sheets.
 *
 * Deploy as a Web App:
 * - Execute as: Me
 * - Who has access: Anyone with the link
 *
 * Security note:
 * This is a lightweight private-link API. The APP_KEY must match the key used
 * by the front-end URL, e.g. ?key=boda-2026.
 */

const CONFIG = {
  SPREADSHEET_ID: "1Sf-OGOg58ZhxwKKiqiAVPrbrbijpKf7_OsPFOcUwnlU",
  APP_KEY: "boda-2026",
  SHEETS: {
    vendors: "vendors",
    payments: "payments",
    budgets: "budgets",
    vendor_photos: "vendor_photos",
    app_settings: "app_settings",
    sync_log: "sync_log",
  },
  PHOTO_MAX_PER_VENDOR: 10,
  PHOTO_ROOT_FOLDER_NAME: "wedding-planner-vendor-photos",
  PHOTO_HEADERS: [
    "id",
    "vendor_id",
    "file_id",
    "file_name",
    "mime_type",
    "size_bytes",
    "file_url",
    "thumbnail_url",
    "is_cover",
    "is_deleted",
    "created_at",
    "updated_at",
    "deleted_at",
  ],
};

function doGet(e) {
  try {
    assertKey_(e.parameter.key);
    const action = e.parameter.action || "download";

    if (action === "download") {
      return json_({
        ok: true,
        data: {
          vendors: readTable_(CONFIG.SHEETS.vendors),
          payments: readTable_(CONFIG.SHEETS.payments),
          budgets: readTable_(CONFIG.SHEETS.budgets),
          sync: readSettings_(),
        },
      });
    }

    return json_({ ok: false, error: "Unsupported action." }, 400);
  } catch (error) {
    return json_({ ok: false, error: error.message }, 400);
  }
}

function doPost(e) {
  try {
    const body = JSON.parse(e.postData.contents || "{}");
    assertKey_(body.key);

    if (body.action === "upload") {
      const data = body.data || {};
      replaceTable_(CONFIG.SHEETS.vendors, data.vendors || []);
      replaceTable_(CONFIG.SHEETS.payments, data.payments || []);
      replaceTable_(CONFIG.SHEETS.budgets, data.budgets || []);
      upsertSettings_({
        last_sync_at: new Date().toISOString(),
        last_sync_actor: body.actor || "front",
      });
      appendSyncLog_("upload", "ok", data, body.actor || "front");
      return json_({ ok: true, savedAt: new Date().toISOString() });
    }

    if (body.action === "upsertVendor") {
      const result = upsertEntity_(CONFIG.SHEETS.vendors, body.vendor || {}, "upsertVendor", body.actor);
      return json_({ ok: true, vendor: result.row, conflict: result.conflict });
    }

    if (body.action === "upsertPayment") {
      const result = upsertEntity_(CONFIG.SHEETS.payments, body.payment || {}, "upsertPayment", body.actor);
      return json_({ ok: true, payment: result.row, conflict: result.conflict });
    }

    if (body.action === "upsertBudget") {
      const result = upsertEntity_(CONFIG.SHEETS.budgets, body.budget || {}, "upsertBudget", body.actor);
      return json_({ ok: true, budget: result.row, conflict: result.conflict });
    }

    if (body.action === "softDeleteVendor") {
      const result = softDeleteEntity_(CONFIG.SHEETS.vendors, body.id, body.updated_at, "softDeleteVendor", body.actor);
      return json_({ ok: true, vendor: result.row, conflict: result.conflict });
    }

    if (body.action === "softDeletePayment") {
      const result = softDeleteEntity_(CONFIG.SHEETS.payments, body.id, body.updated_at, "softDeletePayment", body.actor);
      return json_({ ok: true, payment: result.row, conflict: result.conflict });
    }

    if (body.action === "listVendorPhotos") {
      return json_({ ok: true, photos: listVendorPhotos_(body.vendor_id) });
    }

    if (body.action === "uploadVendorPhoto") {
      const photo = uploadVendorPhoto_(body);
      return json_({ ok: true, photo: photo });
    }

    if (body.action === "deleteVendorPhoto") {
      const photo = deleteVendorPhoto_(body.photo_id);
      return json_({ ok: true, photo: photo });
    }

    if (body.action === "setVendorCoverPhoto") {
      const photo = setVendorCoverPhoto_(body.vendor_id, body.photo_id);
      return json_({ ok: true, photo: photo });
    }

    return json_({ ok: false, error: "Unsupported action." }, 400);
  } catch (error) {
    appendSyncLog_("error", "failed", { message: error.message });
    return json_({ ok: false, error: error.message }, 400);
  }
}

function assertKey_(key) {
  if (!key || key !== CONFIG.APP_KEY) {
    throw new Error("Invalid app key.");
  }
}

function spreadsheet_() {
  return SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
}

function sheet_(name) {
  const sheet = spreadsheet_().getSheetByName(name);
  if (!sheet) throw new Error("Missing sheet: " + name);
  return sheet;
}

function ensureSheet_(name, headers) {
  const spreadsheet = spreadsheet_();
  let sheet = spreadsheet.getSheetByName(name);
  if (!sheet) sheet = spreadsheet.insertSheet(name);

  const values = sheet.getDataRange().getValues();
  const headerIndex = values.findIndex((row) => row.some((cell) => String(cell).trim() === "id"));
  if (headerIndex < 0) {
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
    return sheet;
  }

  const existingHeaders = values[headerIndex].map((cell) => String(cell).trim());
  const missingHeaders = headers.filter((header) => existingHeaders.indexOf(header) < 0);
  if (missingHeaders.length) {
    sheet.getRange(headerIndex + 1, existingHeaders.length + 1, 1, missingHeaders.length).setValues([missingHeaders]);
  }
  return sheet;
}

function tableMeta_(sheetName, requiredHeaders) {
  const sheet = requiredHeaders ? ensureSheet_(sheetName, requiredHeaders) : sheet_(sheetName);
  const values = sheet.getDataRange().getValues();
  const headerIndex = values.findIndex((row) => row.some((cell) => String(cell).trim() === "id"));
  if (headerIndex < 0) throw new Error("Missing id header in sheet: " + sheetName);
  const headers = values[headerIndex].map((cell) => String(cell).trim()).filter(Boolean);
  return { sheet: sheet, values: values, headerIndex: headerIndex, headers: headers };
}

function readTable_(sheetName) {
  const sheet = sheet_(sheetName);
  const values = sheet.getDataRange().getValues();
  const headerIndex = values.findIndex((row) => row.some((cell) => String(cell).trim() === "id"));
  if (headerIndex < 0) return [];

  const headers = values[headerIndex].map((cell) => String(cell).trim());
  return values
    .slice(headerIndex + 1)
    .filter((row) => row.some((cell) => cell !== "" && cell !== null))
    .map((row) => rowToObject_(headers, row))
    .filter((item) => item.id);
}

function replaceTable_(sheetName, rows) {
  const sheet = sheet_(sheetName);
  const values = sheet.getDataRange().getValues();
  const headerIndex = values.findIndex((row) => row.some((cell) => String(cell).trim() === "id"));
  if (headerIndex < 0) throw new Error("Missing id header in sheet: " + sheetName);

  const headers = values[headerIndex].map((cell) => String(cell).trim()).filter(Boolean);
  const startRow = headerIndex + 2;
  const lastRow = Math.max(sheet.getLastRow(), startRow);
  const clearRows = Math.max(lastRow - startRow + 1, 1);
  sheet.getRange(startRow, 1, clearRows, headers.length).clearContent();

  if (!rows.length) return;

  const matrix = rows.map((row) => headers.map((header) => normalizeValue_(row[header])));
  sheet.getRange(startRow, 1, matrix.length, headers.length).setValues(matrix);
}

function upsertEntity_(sheetName, row, action, actor) {
  if (!row.id) throw new Error("Missing row id.");
  const current = findTableRowById_(sheetName, row.id, Object.keys(row));
  if (isRemoteNewer_(current, row)) {
    appendSyncLog_(action, "conflict_remote_newer", { entity: sheetName, id: row.id }, actor);
    return { row: current, conflict: true };
  }
  const normalized = Object.assign({}, row, { updated_at: row.updated_at || new Date().toISOString() });
  upsertTableRow_(sheetName, normalized, Object.keys(normalized));
  upsertSettings_({
    last_sync_at: new Date().toISOString(),
    last_sync_actor: actor || "front",
  });
  appendSyncLog_(action, "ok", { entity: sheetName, id: normalized.id }, actor);
  return { row: normalized, conflict: false };
}

function softDeleteEntity_(sheetName, id, updatedAt, action, actor) {
  if (!id) throw new Error("Missing row id.");
  const current = findTableRowById_(sheetName, id);
  if (!current) throw new Error("Row not found: " + id);
  const incoming = Object.assign({}, current, {
    id: id,
    is_deleted: true,
    deleted_at: updatedAt || new Date().toISOString(),
    updated_at: updatedAt || new Date().toISOString(),
  });
  if (isRemoteNewer_(current, incoming)) {
    appendSyncLog_(action, "conflict_remote_newer", { entity: sheetName, id: id }, actor);
    return { row: current, conflict: true };
  }
  upsertTableRow_(sheetName, incoming, Object.keys(incoming));
  upsertSettings_({
    last_sync_at: new Date().toISOString(),
    last_sync_actor: actor || "front",
  });
  appendSyncLog_(action, "ok", { entity: sheetName, id: id }, actor);
  return { row: incoming, conflict: false };
}

function isRemoteNewer_(current, incoming) {
  if (!current || !current.updated_at || !incoming.updated_at) return false;
  const currentTime = Date.parse(current.updated_at);
  const incomingTime = Date.parse(incoming.updated_at);
  return Number.isFinite(currentTime) && Number.isFinite(incomingTime) && currentTime > incomingTime;
}

function upsertTableRow_(sheetName, row, extraHeaders) {
  const meta = tableMeta_(sheetName, extraHeaders || Object.keys(row));
  const idColumn = meta.headers.indexOf("id");
  if (idColumn < 0) throw new Error("Missing id header in sheet: " + sheetName);

  const rowValues = meta.headers.map((header) => normalizeValue_(row[header]));
  const foundIndex = meta.values.findIndex((currentRow, index) => {
    return index > meta.headerIndex && String(currentRow[idColumn]) === String(row.id);
  });

  if (foundIndex >= 0) {
    meta.sheet.getRange(foundIndex + 1, 1, 1, meta.headers.length).setValues([rowValues]);
  } else {
    meta.sheet.appendRow(rowValues);
  }
}

function listVendorPhotos_(vendorId) {
  if (!vendorId) throw new Error("Missing vendor id.");
  return readPhotoRows_().filter((photo) => String(photo.vendor_id) === String(vendorId) && !isTruthy_(photo.is_deleted));
}

function uploadVendorPhoto_(body) {
  const vendorId = body.vendor_id;
  if (!vendorId) throw new Error("Missing vendor id.");
  if (!body.base64) throw new Error("Missing photo content.");

  const activePhotos = listVendorPhotos_(vendorId);
  if (activePhotos.length >= CONFIG.PHOTO_MAX_PER_VENDOR) {
    throw new Error("Solo puedes tener " + CONFIG.PHOTO_MAX_PER_VENDOR + " fotos activas por proveedor.");
  }

  const vendor = findTableRowById_(CONFIG.SHEETS.vendors, vendorId);
  if (!vendor) throw new Error("El proveedor no existe en Google Sheets.");

  const folder = ensureVendorPhotoFolder_(vendor);
  const fileName = body.file_name || "foto.jpg";
  const mimeType = body.mime_type || "image/jpeg";
  const bytes = Utilities.base64Decode(body.base64);
  const file = folder.createFile(Utilities.newBlob(bytes, mimeType, fileName));
  file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);

  const now = new Date().toISOString();
  const fileId = file.getId();
  const photo = {
    id: "photo_" + Date.now() + "_" + Math.random().toString(36).slice(2, 7),
    vendor_id: vendorId,
    file_id: fileId,
    file_name: fileName,
    mime_type: mimeType,
    size_bytes: body.size_bytes || bytes.length,
    file_url: "https://drive.google.com/file/d/" + fileId + "/view",
    thumbnail_url: "https://drive.google.com/thumbnail?id=" + fileId + "&sz=w400",
    is_cover: activePhotos.length === 0,
    is_deleted: false,
    created_at: now,
    updated_at: now,
    deleted_at: "",
  };

  upsertTableRow_(CONFIG.SHEETS.vendor_photos, photo, CONFIG.PHOTO_HEADERS);
  appendSyncLog_("uploadVendorPhoto", "ok", { photos: [photo] });
  return photo;
}

function deleteVendorPhoto_(photoId) {
  if (!photoId) throw new Error("Missing photo id.");
  const photo = findTableRowById_(CONFIG.SHEETS.vendor_photos, photoId, CONFIG.PHOTO_HEADERS);
  if (!photo) throw new Error("Foto no encontrada.");

  photo.is_deleted = true;
  photo.is_cover = false;
  photo.deleted_at = new Date().toISOString();
  photo.updated_at = photo.deleted_at;
  upsertTableRow_(CONFIG.SHEETS.vendor_photos, photo, CONFIG.PHOTO_HEADERS);

  try {
    if (photo.file_id) DriveApp.getFileById(photo.file_id).setTrashed(true);
  } catch (error) {
    // Keep the logical delete even if Drive cleanup fails.
  }

  const remaining = listVendorPhotos_(photo.vendor_id);
  if (remaining.length && !remaining.some((item) => isTruthy_(item.is_cover))) {
    setVendorCoverPhoto_(photo.vendor_id, remaining[0].id);
  }

  appendSyncLog_("deleteVendorPhoto", "ok", { photos: [photo] });
  return photo;
}

function setVendorCoverPhoto_(vendorId, photoId) {
  if (!vendorId || !photoId) throw new Error("Missing vendor id or photo id.");
  const photos = readPhotoRows_().filter((photo) => String(photo.vendor_id) === String(vendorId) && !isTruthy_(photo.is_deleted));
  const selected = photos.find((photo) => String(photo.id) === String(photoId));
  if (!selected) throw new Error("Foto no encontrada para este proveedor.");

  const now = new Date().toISOString();
  photos.forEach((photo) => {
    photo.is_cover = String(photo.id) === String(photoId);
    photo.updated_at = now;
    upsertTableRow_(CONFIG.SHEETS.vendor_photos, photo, CONFIG.PHOTO_HEADERS);
  });

  appendSyncLog_("setVendorCoverPhoto", "ok", { photos: [selected] });
  selected.is_cover = true;
  selected.updated_at = now;
  return selected;
}

function readPhotoRows_() {
  ensureSheet_(CONFIG.SHEETS.vendor_photos, CONFIG.PHOTO_HEADERS);
  return readTable_(CONFIG.SHEETS.vendor_photos);
}

function findTableRowById_(sheetName, id, requiredHeaders) {
  const meta = tableMeta_(sheetName, requiredHeaders);
  const idColumn = meta.headers.indexOf("id");
  const row = meta.values.find((currentRow, index) => index > meta.headerIndex && String(currentRow[idColumn]) === String(id));
  return row ? rowToObject_(meta.headers, row) : null;
}

function ensureVendorPhotoFolder_(vendor) {
  const folderUrl = vendor.drive_folder_url || "";
  const existingFolderId = extractDriveId_(folderUrl);
  if (existingFolderId) {
    try {
      return DriveApp.getFolderById(existingFolderId);
    } catch (error) {
      // Fall through and create a new folder.
    }
  }

  const root = ensureRootPhotoFolder_();
  const safeName = String(vendor.name || vendor.id).replace(/[\\/:*?"<>|]/g, "-").slice(0, 80);
  const folder = root.createFolder(safeName + " - " + vendor.id);
  folder.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);

  vendor.drive_folder_url = folder.getUrl();
  vendor.updated_at = new Date().toISOString();
  upsertTableRow_(CONFIG.SHEETS.vendors, vendor, Object.keys(vendor));
  return folder;
}

function ensureRootPhotoFolder_() {
  const folders = DriveApp.getFoldersByName(CONFIG.PHOTO_ROOT_FOLDER_NAME);
  if (folders.hasNext()) return folders.next();
  const folder = DriveApp.createFolder(CONFIG.PHOTO_ROOT_FOLDER_NAME);
  folder.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
  return folder;
}

function extractDriveId_(url) {
  const value = String(url || "");
  const folderMatch = value.match(/\/folders\/([a-zA-Z0-9_-]+)/);
  if (folderMatch) return folderMatch[1];
  const idMatch = value.match(/[?&]id=([a-zA-Z0-9_-]+)/);
  return idMatch ? idMatch[1] : "";
}

function readSettings_() {
  const sheet = sheet_(CONFIG.SHEETS.app_settings);
  const values = sheet.getDataRange().getValues();
  const headerIndex = values.findIndex((row) => String(row[0]).trim() === "key");
  if (headerIndex < 0) return {};

  return values.slice(headerIndex + 1).reduce((settings, row) => {
    if (row[0]) settings[String(row[0])] = row[1];
    return settings;
  }, {});
}

function upsertSettings_(settings) {
  const sheet = sheet_(CONFIG.SHEETS.app_settings);
  const values = sheet.getDataRange().getValues();
  const headerIndex = values.findIndex((row) => String(row[0]).trim() === "key");
  if (headerIndex < 0) throw new Error("Missing app_settings header.");

  Object.keys(settings).forEach((key) => {
    const foundIndex = values.findIndex((row, index) => index > headerIndex && String(row[0]) === key);
    if (foundIndex >= 0) {
      sheet.getRange(foundIndex + 1, 2).setValue(settings[key]);
    } else {
      sheet.appendRow([key, settings[key], "string", "Updated by Apps Script API."]);
    }
  });
}

function appendSyncLog_(direction, status, payload, actor) {
  try {
    const sheet = sheet_(CONFIG.SHEETS.sync_log);
    sheet.appendRow([
      "sync_" + Date.now(),
      new Date().toISOString(),
      new Date().toISOString(),
      actor || "front",
      direction,
      status,
      countRows_(payload),
      countRows_(payload),
      status === "ok" ? "Sync completed." : JSON.stringify(payload).slice(0, 400),
    ]);
  } catch (error) {
    // Avoid failing the main request because logging failed.
  }
}

function rowToObject_(headers, row) {
  return headers.reduce((object, header, index) => {
    if (!header) return object;
    object[header] = normalizeCell_(row[index]);
    return object;
  }, {});
}

function normalizeCell_(value) {
  if (value instanceof Date) return value.toISOString();
  return value;
}

function normalizeValue_(value) {
  if (value === undefined || value === null) return "";
  return value;
}

function isTruthy_(value) {
  return value === true || String(value).toLowerCase() === "true";
}

function countRows_(payload) {
  if (!payload || typeof payload !== "object") return 0;
  if (payload.entity && payload.id) return 1;
  return ["vendors", "payments", "budgets", "photos"].reduce((count, key) => {
    return count + (Array.isArray(payload[key]) ? payload[key].length : 0);
  }, 0);
}

function json_(payload, statusCode) {
  return ContentService.createTextOutput(JSON.stringify(payload))
    .setMimeType(ContentService.MimeType.JSON);
}
