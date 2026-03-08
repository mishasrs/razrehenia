/**
 * 11_SheetsRepo.gs
 * Sheets: создание листа, map fileId->row, синхронизация и appendRow
 */

function ensureSheet_(ss) {
  let sh = ss.getSheetByName(SHEET_NAME);
  if (!sh) sh = ss.insertSheet(SHEET_NAME);

  // Заголовки
  if (sh.getLastRow() < 1) {
    sh.getRange(1, 1, 1, 9).setValues([[
      'ТС', 'Маршрут', 'Тоннаж', 'Ширина', 'До', 'Файл', 'QR', 'file_id', 'updated_at'
    ]]);
    sh.setFrozenRows(1);
  }

  return sh;
}

function getFileIdToRowMap_(sh) {
  const map = new Map();
  const lastRow = sh.getLastRow();
  if (lastRow < 2) return map;

  const ids = sh.getRange(2, COL_FILE_ID, lastRow - 1, 1).getValues();
  for (let i = 0; i < ids.length; i++) {
    const id = (ids[i][0] || '').toString().trim();
    if (id) map.set(id, i + 2);
  }
  return map;
}

/**
 * Синхронизация существующих строк пачкой:
 * - удаляет строки, если файла нет / файл в корзине / файл не в дереве папок
 * - если имя файла изменилось, перепарсит и обновит поля
 * - поддерживает QR как RichText ссылку с текстом "QR" (не затирает ссылку)
 *
 * Возвращает: {checked, updated, deleted, done}
 */
function syncExistingRowsChunked_(ss, sh, folderIdSet, startMs) {
  const lastRow = sh.getLastRow();
  if (lastRow < 2) {
    PropertiesService.getScriptProperties().deleteProperty(PROP_SYNC_CURSOR);
    return { checked: 0, updated: 0, deleted: 0, done: true };
  }

  const props = PropertiesService.getScriptProperties();
  let cursor = Number(props.getProperty(PROP_SYNC_CURSOR) || '2');
  if (!cursor || cursor < 2) cursor = 2;

  if (cursor > lastRow) {
    props.deleteProperty(PROP_SYNC_CURSOR);
    return { checked: 0, updated: 0, deleted: 0, done: true };
  }

  const endRow = Math.min(lastRow, cursor + SYNC_CHUNK_ROWS - 1);
  const num = endRow - cursor + 1;

  const values = sh.getRange(cursor, 1, num, COL_UPDATED).getValues();
  const fileRT = sh.getRange(cursor, COL_FILE, num, 1).getRichTextValues();
  const qrRT   = sh.getRange(cursor, COL_QR,   num, 1).getRichTextValues();

  const toDelete = [];
  let checked = 0;
  let updated = 0;
  let processedRows = 0;

  for (let i = 0; i < num; i++) {
    if (shouldStop_()) break;
    if (timeAlmostUp_(startMs)) break;
    processedRows = i + 1;

    const rowIndex = cursor + i;
    const row = values[i];

    const fileId = (row[COL_FILE_ID - 1] || '').toString().trim();
    if (!fileId) continue;

    checked++;

    let file;
    try {
      file = DriveApp.getFileById(fileId);
    } catch (e) {
      // файла реально нет (или нет доступа) — убираем строку
      toDelete.push(rowIndex);
      continue;
    }

    // если файл в корзине — считаем удалённым
    try {
      if (file.isTrashed && file.isTrashed()) {
        toDelete.push(rowIndex);
        continue;
      }
    } catch (e) {}

    // если файл выпал из дерева папок — удаляем строку
    if (!isFileInFolderTree_(file, folderIdSet)) {
      toDelete.push(rowIndex);
      continue;
    }

    const name = file.getName();
    const url  = file.getUrl();

    let rowChanged = false;

    /** -------- Файл (колонка F): RichText "PDF" -> url -------- */
    const curFileRt = fileRT[i][0];
    const curFileLink = curFileRt ? (curFileRt.getLinkUrl() || '') : '';
    const curFileText = curFileRt ? (curFileRt.getText() || '') : '';

    if (curFileLink !== url || curFileText !== 'PDF' || String(row[COL_FILE - 1] || '') !== 'PDF') {
      fileRT[i][0] = SpreadsheetApp.newRichTextValue().setText('PDF').setLinkUrl(url).build();
      row[COL_FILE - 1] = 'PDF';
      rowChanged = true;
    }

    /** -------- QR (колонка G): RichText "QR" -> qrUrl --------
     * ВАЖНО: ссылка хранится в RichText, а значение ячейки должно быть "QR".
     * Если раньше в значении был URL — конвертируем в ссылку и ставим "QR".
     */
    const curQrRt = qrRT[i][0];
    const qrLink = curQrRt ? (curQrRt.getLinkUrl() || '') : '';
    const qrText = curQrRt ? (curQrRt.getText() || '') : '';
    const qrVal  = (row[COL_QR - 1] || '').toString().trim();
    const looksUrl = /^https?:\/\//i.test(qrVal);

    if (qrLink) {
      // ссылка уже есть — просто приводим текст/значение к "QR" (если надо), НЕ меняя ссылку
      if (qrText !== 'QR') {
        qrRT[i][0] = SpreadsheetApp.newRichTextValue().setText('QR').setLinkUrl(qrLink).build();
        rowChanged = true;
      }
      if (qrVal !== 'QR') {
        row[COL_QR - 1] = 'QR';
        rowChanged = true;
      }
    } else if (looksUrl) {
      // URL был записан в значение — конвертируем в RichText ссылку
      qrRT[i][0] = SpreadsheetApp.newRichTextValue().setText('QR').setLinkUrl(qrVal).build();
      row[COL_QR - 1] = 'QR';
      rowChanged = true;
    } else {
      // нет ссылки и нет URL — не трогаем
      // (QR может быть пустым и будет заполняться fillMissingQr)
    }

    /** -------- Если имя изменилось — перепарсим поля -------- */
    const info = safeParseInfoFromFilename_(name);
    if (info) {
      const newRoute = String(info.route || '');
      const newTon   = info.tonnage ?? info.ton ?? '';
      const newWid   = info.width ?? info.w ?? '';
      const newUntil = extractUntilDate_(info);

      if (String(row[COL_ROUTE - 1] || '') !== newRoute) {
        row[COL_ROUTE - 1] = newRoute;
        rowChanged = true;
      }
      if (String(row[COL_TONNAGE - 1] || '') !== String(newTon || '')) {
        row[COL_TONNAGE - 1] = newTon;
        rowChanged = true;
      }
      if (String(row[COL_WIDTH - 1] || '') !== String(newWid || '')) {
        row[COL_WIDTH - 1] = newWid;
        rowChanged = true;
      }
      if (newUntil instanceof Date) {
        const curUntil = row[COL_UNTIL - 1];
        const curTime = (curUntil instanceof Date) ? curUntil.getTime() : null;
        if (curTime !== newUntil.getTime()) {
          row[COL_UNTIL - 1] = newUntil;
          rowChanged = true;
        }
      }
    }

    if (rowChanged) {
      row[COL_UPDATED - 1] = new Date();
      updated++;
    }
  }

  // Пишем обратно только реально обработанный префикс пачки.
  if (processedRows > 0) {
    sh.getRange(cursor, 1, processedRows, COL_UPDATED).setValues(values.slice(0, processedRows));
    sh.getRange(cursor, COL_FILE, processedRows, 1).setRichTextValues(fileRT.slice(0, processedRows));
    sh.getRange(cursor, COL_QR, processedRows, 1).setRichTextValues(qrRT.slice(0, processedRows));
  }

  // Удаления — снизу вверх
  let deleted = 0;
  if (toDelete.length) {
    toDelete.sort((a, b) => b - a);
    for (const r of toDelete) {
      if (r >= 2 && r <= sh.getLastRow()) {
        sh.deleteRow(r);
        deleted++;
      }
    }
  }

  // КЛЮЧЕВО: корректируем курсор только на реально обработанную часть пачки,
  // чтобы не пропускать строки при stop/timeAlmostUp внутри цикла.
  const newLast = sh.getLastRow();
  let nextCursor = cursor + processedRows - deleted;
  if (nextCursor < 2) nextCursor = 2;

  let done = false;
  if (nextCursor > newLast) {
    props.deleteProperty(PROP_SYNC_CURSOR);
    done = true;
  } else {
    props.setProperty(PROP_SYNC_CURSOR, String(nextCursor));
  }

  return { checked, updated, deleted, done };
}

function appendRow_(sh, file, info, qrUrl) {
  const url = file.getUrl();
  const fileId = file.getId();

  const route = String(info.route || '');
  const ton = info.tonnage ?? info.ton ?? '';
  const wid = info.width ?? info.w ?? '';
  const until = extractUntilDate_(info);

  const fileRich = SpreadsheetApp.newRichTextValue().setText('PDF').setLinkUrl(url).build();
  const qrRich = qrUrl
    ? SpreadsheetApp.newRichTextValue().setText('QR').setLinkUrl(qrUrl).build()
    : SpreadsheetApp.newRichTextValue().setText('').build();

  const row = [
    String(info.ts || info.vehicle || info.car || ''), // ТС
    route,
    ton,
    wid,
    (until instanceof Date ? until : ''),
    'PDF',
    (qrUrl ? 'QR' : ''),
    fileId,
    new Date()
  ];

  const rowIndex = sh.getLastRow() + 1;
  sh.getRange(rowIndex, 1, 1, 9).setValues([row]);
  sh.getRange(rowIndex, COL_FILE).setRichTextValue(fileRich);
  sh.getRange(rowIndex, COL_QR).setRichTextValue(qrRich);
}

/** ---- small helpers (internal) ---- */
function safeParseInfoFromFilename_(name) {
  try {
    if (typeof parsePermissionFilename_ !== 'function') return null;
    return parsePermissionFilename_(name);
  } catch (e) {
    return null;
  }
}

function extractUntilDate_(info) {
  if (!info) return null;
  const d =
    info.until ??
    info.untilDate ??
    info.to ??
    info.dateTo ??
    info.expire ??
    null;
  return (d instanceof Date) ? d : null;
}
