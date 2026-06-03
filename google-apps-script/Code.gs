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
  SPREADSHEET_ID: "PASTE_YOUR_SPREADSHEET_ID_HERE",
  APP_KEY: "boda-2026",
  SHEETS: {
    vendors: "vendors",
    payments: "payments",
    budgets: "budgets",
    app_settings: "app_settings",
    sync_log: "sync_log",
  },
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
      appendSyncLog_("upload", "ok", data);
      return json_({ ok: true, savedAt: new Date().toISOString() });
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

function appendSyncLog_(direction, status, payload) {
  try {
    const sheet = sheet_(CONFIG.SHEETS.sync_log);
    sheet.appendRow([
      "sync_" + Date.now(),
      new Date().toISOString(),
      new Date().toISOString(),
      "front",
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

function countRows_(payload) {
  if (!payload || typeof payload !== "object") return 0;
  return ["vendors", "payments", "budgets"].reduce((count, key) => {
    return count + (Array.isArray(payload[key]) ? payload[key].length : 0);
  }, 0);
}

function json_(payload, statusCode) {
  return ContentService.createTextOutput(JSON.stringify(payload))
    .setMimeType(ContentService.MimeType.JSON);
}
