/**
 * 20_View.gs
 * Витрина: построение красивого листа "Витрина" из данных "Разрешения"
 */

/** ===================== ВИТРИНА ===================== */
function refreshView_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const dataSh = ss.getSheetByName(SHEET_NAME);
  if (!dataSh) throw new Error(`Нет листа данных "${SHEET_NAME}"`);

  const viewSh = ensureViewSheet_(ss);
  const rows = readDataRows_(dataSh);
  buildView_(viewSh, rows);
}

function ensureViewSheet_(ss) {
  let sh = ss.getSheetByName(VIEW_SHEET_NAME);
  if (!sh) sh = ss.insertSheet(VIEW_SHEET_NAME, 0);
  return sh;
}

function readDataRows_(dataSh) {
  const lastRow = dataSh.getLastRow();
  if (lastRow < 2) return [];

  const num = lastRow - 1;

  const values = dataSh.getRange(2, 1, num, 7).getValues();
  const fileIds = dataSh.getRange(2, COL_FILE_ID, num, 1).getValues();
  const fileRT = dataSh.getRange(2, COL_FILE, num, 1).getRichTextValues();
  const qrRT   = dataSh.getRange(2, COL_QR,   num, 1).getRichTextValues();

  const out = [];
  for (let i = 0; i < values.length; i++) {
    const v = values[i];
    const ts = v[0];
    if (!ts) continue;

    const until = v[4] instanceof Date ? v[4] : null;

    const fileUrl = fileRT[i] && fileRT[i][0] ? fileRT[i][0].getLinkUrl() : null;
    const qrUrl   = qrRT[i]   && qrRT[i][0]   ? qrRT[i][0].getLinkUrl()   : null;

    const fileIdRaw = fileIds[i] ? fileIds[i][0] : '';
    const fileId = fileIdRaw ? String(fileIdRaw) : '';

    out.push({
      ts: String(v[0]),
      route: String(v[1] || ''),
      tonnage: v[2],
      width: v[3],
      until: until,
      fileUrl: fileUrl,
      qrUrl: qrUrl,
      fileId: fileId
    });
  }
  return out;
}

function buildView_(sh, rows) {
  sh.clear();
  sh.setHiddenGridlines(true);

  sh.setColumnWidths(1, 1, 70);
  sh.setColumnWidths(2, 1, 380);
  sh.setColumnWidths(3, 1, 80);
  sh.setColumnWidths(4, 1, 80);
  sh.setColumnWidths(5, 1, 105);
  sh.setColumnWidths(6, 1, 60);
  sh.setColumnWidths(7, 1, 60);

  // hidden tech cols H:I for Telegram send reliability
  sh.setColumnWidths(8, 2, 10);
  sh.hideColumns(8, 2);

  const rootId = PropertiesService.getScriptProperties().getProperty('ROOT_FOLDER_ID');
  const now = new Date();

  sh.getRange(1, 1, 1, 7).merge()
    .setValue('Разрешения — витрина')
    .setFontSize(16).setFontWeight('bold')
    .setHorizontalAlignment('center')
    .setBackground('#f3f4f6');

  sh.getRange(2, 1, 1, 4).merge().setValue('Папка PDF:').setFontWeight('bold');
  if (rootId) {
    const url = `https://drive.google.com/drive/folders/${rootId}`;
    sh.getRange(2, 5, 1, 3).merge().setRichTextValue(
      SpreadsheetApp.newRichTextValue().setText('Открыть папку').setLinkUrl(url).build()
    );
  } else {
    sh.getRange(2, 5, 1, 3).merge().setValue('не задана (меню → ROOT_FOLDER_ID)');
  }

  sh.getRange(3, 1, 1, 4).merge().setValue('Обновлено:').setFontWeight('bold');
  sh.getRange(3, 5, 1, 3).merge().setValue(now).setNumberFormat('dd.MM.yyyy HH:mm');

  const today = startOfDay_(now);

  const active = [];
  const expired = [];
  const noqr = [];

  for (const r of rows) {
    if (!r.qrUrl) noqr.push(r);
    if (r.until && r.until < today) expired.push(r);
    else active.push(r);
  }

  const byUntilThenTs = (a, b) => {
    const da = a.until ? a.until.getTime() : 0;
    const db = b.until ? b.until.getTime() : 0;
    if (da !== db) return da - db;
    return String(a.ts).localeCompare(String(b.ts), 'ru');
  };

  active.sort(byUntilThenTs);
  expired.sort(byUntilThenTs);
  noqr.sort(byUntilThenTs);

  sh.getRange(5, 1, 1, 7).setValues([[
    `Всего: ${rows.length}`,
    `Активные: ${active.length}`,
    `Истекшие: ${expired.length}`,
    `Без QR: ${noqr.length}`,
    '', '', ''
  ]]);
  sh.getRange(5, 1, 1, 7).setFontWeight('bold').setBackground('#f9fafb');

  let r0 = 7;
  r0 = writeSectionGroupedByTs_(sh, r0, 'Активные', active);
  r0 = writeSectionGroupedByTs_(sh, r0 + 2, 'Истекшие', expired);
  r0 = writeSectionGroupedByTs_(sh, r0 + 2, 'Без QR (проверь файлы)', noqr);

  applyUntilConditionalFormatting_(sh, EXPIRING_DAYS);
  sh.setFrozenRows(5);
}

function writeSectionGroupedByTs_(sh, startRow, title, rows) {
  let r = startRow;

  sh.getRange(r, 1, 1, 7).merge()
    .setValue(title)
    .setFontWeight('bold')
    .setBackground('#e5e7eb');
  r++;

  if (!rows.length) {
    sh.getRange(r, 1, 1, 7).merge().setValue('— нет —').setFontStyle('italic');
    return r;
  }

  const groups = groupByKey_(rows, x => x.ts);

  for (const [ts, list] of groups) {
    sh.getRange(r, 1, 1, 7).merge()
      .setValue(`ТС: ${ts} — ${list.length} шт.`)
      .setFontWeight('bold')
      .setBackground('#eef2ff');
    r++;

    const headerRow = r;
    sh.getRange(headerRow, 1, 1, 7).setValues([[
      'ТС', 'Маршрут', 'Тоннаж', 'Ширина', 'До', 'Файл', 'QR'
    ]]).setFontWeight('bold').setBackground('#f3f4f6');
    r++;

    const dataRow = r;
    const matrix = list.map(x => ([
      x.ts,
      x.route,
      x.tonnage,
      x.width,
      x.until,
      'Файл',
      x.qrUrl ? 'QR' : '',
      x.fileId || '',
      x.qrUrl || ''
    ]));
    sh.getRange(dataRow, 1, list.length, 9).setValues(matrix);

    sh.getRange(dataRow, 3, list.length, 1).setNumberFormat('0.##');
    sh.getRange(dataRow, 4, list.length, 1).setNumberFormat('0.##');
    sh.getRange(dataRow, 5, list.length, 1).setNumberFormat('dd.MM.yyyy');

    const fileRich = list.map(x => [makeLink_('Файл', x.fileUrl)]);
    const qrRich   = list.map(x => [x.qrUrl ? makeLink_('QR', x.qrUrl) : SpreadsheetApp.newRichTextValue().setText('').build()]);
    sh.getRange(dataRow, 6, list.length, 1).setRichTextValues(fileRich);
    sh.getRange(dataRow, 7, list.length, 1).setRichTextValues(qrRich);

    sh.getRange(headerRow, 1, list.length + 1, 7).setBorder(true, true, true, true, true, true);

    sh.getRange(dataRow, 2, list.length, 1).setWrap(true);
    sh.getRange(dataRow, 3, list.length, 2).setHorizontalAlignment('center');
    sh.getRange(dataRow, 5, list.length, 1).setHorizontalAlignment('center');
    sh.getRange(dataRow, 6, list.length, 2).setHorizontalAlignment('center');

    r += list.length;
    sh.getRange(r, 1, 1, 9).clear({ contentsOnly: true });
    r++;
  }

  return r - 1;
}

function groupByKey_(arr, keyFn) {
  const m = new Map();
  for (const x of arr) {
    const k = String(keyFn(x) ?? '');
    if (!m.has(k)) m.set(k, []);
    m.get(k).push(x);
  }
  return Array.from(m.entries());
}

function makeLink_(text, url) {
  const b = SpreadsheetApp.newRichTextValue().setText(String(text || ''));
  if (url) b.setLinkUrl(String(url));
  return b.build();
}

function startOfDay_(d) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function applyUntilConditionalFormatting_(sh, days) {
  const range = sh.getRange('E:E');
  const rules = [];

  rules.push(
    SpreadsheetApp.newConditionalFormatRule()
      .whenFormulaSatisfied('=AND($E1<>"";$E1<TODAY())')
      .setBackground('#fee2e2')
      .setRanges([range])
      .build()
  );

  rules.push(
    SpreadsheetApp.newConditionalFormatRule()
      .whenFormulaSatisfied(`=AND($E1<>"";$E1>=TODAY();$E1<=TODAY()+${days})`)
      .setBackground('#fca5a5')
      .setRanges([range])
      .build()
  );

  sh.setConditionalFormatRules(rules);
}
