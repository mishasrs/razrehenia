/**
 * 03_Logging.gs
 * Логи + toast (вынесено из Code.gs)
 */

/** ===================== LOGS / TOAST ===================== */
function ensureLogSheet_(ss) {
  let sh = ss.getSheetByName(LOG_SHEET_NAME);
  if (!sh) sh = ss.insertSheet(LOG_SHEET_NAME);
  if (sh.getLastRow() < 1) {
    sh.getRange(1, 1, 1, 3).setValues([['Time', 'Level', 'Message']]);
    sh.setFrozenRows(1);
  }
  return sh;
}

function log_(ss, message, level = 'INFO') {
  try {
    const sh = ensureLogSheet_(ss);
    sh.appendRow([new Date(), level, String(message)]);
  } catch (e) {}
}

function toastSafe_(ss, msg) {
  try { ss.toast(String(msg)); } catch (e) {}
}
