/**
 * 40_ScanJob.gs
 * Основной job: сканирование Drive -> обновление "Разрешения" + обновление "Витрина"
 * + дозаполнение QR + тест 1 файла.
 */

/** ===================== MAIN SCAN ===================== */
function scanAndUpdate() {
  clearStopFlag_();
  scanAndUpdateCore_('manual');
}

function continueScan() {
  if (shouldStop_()) return;
  scanAndUpdateCore_('auto');
}

function scanAndUpdateCore_(origin) {
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(25000)) return;

  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const startMs = Date.now();

  try {
    if (shouldStop_()) {
      clearContinueTriggers_();
      log_(ss, `STOP: запуск отменён (origin=${origin})`, 'WARN');
      toastSafe_(ss, 'STOP: сканирование остановлено');
      return;
    }

    clearContinueTriggers_();
    toastSafe_(ss, 'Сканирование...');
    log_(ss, `SCAN start (origin=${origin})`, 'INFO');

    const rootId = getRootFolderId_();
    const rootFolder = DriveApp.getFolderById(rootId);

    const dataSh = ensureSheet_(ss);
    const folderIdSet = collectFolderTreeIds_(rootFolder);

    // 1) синхронизация существующих строк (удаление отсутствующих/переименованных)
    const sync = syncExistingRowsChunked_(ss, dataSh, folderIdSet, startMs);
    log_(ss, `SYNC chunk: checked=${sync.checked}, updated=${sync.updated}, deleted=${sync.deleted}, done=${sync.done}`, 'INFO');

    if (shouldStop_()) {
      clearContinueTriggers_();
      applyDataSheetFormatting_(dataSh);
      log_(ss, 'STOP: остановлено во время синхронизации', 'WARN');
      toastSafe_(ss, 'STOP: остановлено');
      return;
    }

    if (timeAlmostUp_(startMs)) {
      applyDataSheetFormatting_(dataSh);
      scheduleContinue_(ss, 'pause_after_sync');
      toastSafe_(ss, `Пауза по времени. Синхронизация: ${sync.done ? 'готово' : 'продолжаю...'}`);
      return;
    }

    // 2) добавление новых PDF
    const idToRow = getFileIdToRowMap_(dataSh);
    const files = listPdfFiles_(rootFolder, NEW_CHUNK_FILES, idToRow);

    let added = 0;
    for (const file of files) {
      if (shouldStop_()) break;
      if (timeAlmostUp_(startMs)) break;

      // если файл в корзине — пропускаем
      try { if (file.isTrashed && file.isTrashed()) continue; } catch (e) {}

      const info = parsePermissionFilename_(file.getName());
      if (!info) {
        log_(ss, `Пропуск (имя не по шаблону): ${file.getName()}`, 'WARN');
        continue;
      }

      const qrUrl = decodeQrFromPdf_(ss, file);
      appendRow_(dataSh, file, info, qrUrl);
      added++;
    }

    applyDataSheetFormatting_(dataSh);
    log_(ss, `ADD chunk: found=${files.length}, added=${added}`, 'INFO');

    if (shouldStop_()) {
      clearContinueTriggers_();
      log_(ss, `STOP: остановлено после добавления. added=${added}`, 'WARN');
      toastSafe_(ss, `STOP: остановлено. Добавлено: ${added}`);
      return;
    }

    // 3) решаем, нужно ли продолжение
    const stoppedEarly = added < files.length;
    const mayHaveMoreNew = files.length === NEW_CHUNK_FILES;
    const needContinue = !sync.done || stoppedEarly || mayHaveMoreNew;

    if (needContinue) {
      scheduleContinue_(ss, 'need_continue');
      toastSafe_(ss, `Часть готова. Добавлено ${added}. Продолжаю...`);
      return;
    }

    // 4) финал
    refreshView_();
    log_(ss, `DONE: added=${added}; deleted=${sync.deleted}; updated=${sync.updated}`, 'INFO');
    toastSafe_(ss, `Готово. Добавлено: ${added}; удалено: ${sync.deleted}; обновлено: ${sync.updated}`);
  } catch (err) {
    log_(ss, `ОШИБКА scanAndUpdate: ${err && err.stack ? err.stack : err}`, 'ERROR');
    toastSafe_(ss, 'Ошибка. Смотрите Logs.');
    throw err;
  } finally {
    lock.releaseLock();
  }
}

/** ===================== FILL MISSING QR ===================== */
function fillMissingQr() {
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(25000)) return;

  const ss = SpreadsheetApp.getActiveSpreadsheet();
  toastSafe_(ss, 'Дозаполнение QR...');

  try {
    if (shouldStop_()) {
      log_(ss, 'STOP: fillMissingQr отменён', 'WARN');
      toastSafe_(ss, 'STOP: операция отменена');
      return;
    }

    const sh = ss.getSheetByName(SHEET_NAME);
    if (!sh) throw new Error(`Нет листа "${SHEET_NAME}"`);

    const lastRow = sh.getLastRow();
    if (lastRow < 2) {
      toastSafe_(ss, 'Нет данных');
      return;
    }

    const num = lastRow - 1;
    const fileIds = sh.getRange(2, COL_FILE_ID, num, 1).getValues();
    const qrVals = sh.getRange(2, COL_QR, num, 1).getValues();
    const qrRT   = sh.getRange(2, COL_QR, num, 1).getRichTextValues();
    const updatedVals = sh.getRange(2, COL_UPDATED, num, 1).getValues();

    let processed = 0;
    let filled = 0;

    for (let i = 0; i < num && processed < FILL_MISSING_LIMIT; i++) {
      if (shouldStop_()) break;

      const rowIndex = i + 2;
      const fileId = (fileIds[i][0] || '').toString().trim();
      if (!fileId) continue;

      const qrVal = (qrVals[i][0] || '').toString().trim();
      const qrLink = qrRT[i][0] ? (qrRT[i][0].getLinkUrl() || '') : '';
      if (qrVal || qrLink) continue; // уже есть

      processed++;

      let file;
      try {
        file = DriveApp.getFileById(fileId);
      } catch (e) {
        continue;
      }

      try { if (file.isTrashed && file.isTrashed()) continue; } catch (e) {}

      const qrUrl = decodeQrFromPdf_(ss, file);
      if (!qrUrl) continue;

      // ставим значение + ссылку
      qrVals[i][0] = 'QR';
      updatedVals[i][0] = new Date();
      qrRT[i][0] = SpreadsheetApp.newRichTextValue().setText('QR').setLinkUrl(qrUrl).build();
      filled++;
    }

    // пишем обратно только изменяемые колонки
    sh.getRange(2, COL_QR, num, 1).setValues(qrVals);
    sh.getRange(2, COL_QR, num, 1).setRichTextValues(qrRT);
    sh.getRange(2, COL_UPDATED, num, 1).setValues(updatedVals);

    applyDataSheetFormatting_(sh);
    refreshView_();

    log_(ss, `fillMissingQr: processed=${processed}, filled=${filled}`, 'INFO');
    toastSafe_(ss, `Готово. Проверено: ${processed}, заполнено: ${filled}`);
  } finally {
    lock.releaseLock();
  }
}

/** ===================== DIAGNOSE ONE ===================== */
function diagnoseOne() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const ui = SpreadsheetApp.getUi();

  let fileId = '';

  // Попробуем взять file_id из активной строки "Разрешения"
  try {
    const sh = ss.getActiveSheet();
    if (sh && sh.getName() === SHEET_NAME) {
      const r = sh.getActiveRange().getRow();
      if (r >= 2) {
        fileId = String(sh.getRange(r, COL_FILE_ID).getValue() || '').trim();
      }
    }
  } catch (e) {}

  if (!fileId) {
    const res = ui.prompt('Тест QR', 'Вставьте file_id PDF (Drive):', ui.ButtonSet.OK_CANCEL);
    if (res.getSelectedButton() !== ui.Button.OK) return;
    fileId = (res.getResponseText() || '').trim();
  }

  if (!fileId) {
    ui.alert('file_id пустой.');
    return;
  }

  let file;
  try {
    file = DriveApp.getFileById(fileId);
  } catch (e) {
    ui.alert('Не удалось открыть файл по file_id.');
    return;
  }

  const qr = decodeQrFromPdf_(ss, file);
  if (qr) {
    log_(ss, `diagnoseOne: OK ${file.getName()} -> ${qr}`, 'INFO');
    ui.alert(`QR распознан:\n${qr}`);
  } else {
    log_(ss, `diagnoseOne: FAIL ${file.getName()}`, 'WARN');
    ui.alert('QR не распознан (смотрите Logs).');
  }
}
