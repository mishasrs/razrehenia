/**
 * 90_Utils.gs
 * Утилиты и парсинг имени файла разрешения.
 *
 * Поддерживаемые имена (пример):
 * 903(4708)_устьлуга-липецк-хилок,44т,3м_до 28.03.26.pdf
 * -> ts: 903(4708)
 * -> route: устьлуга-липецк-хилок
 * -> tonnage: 44
 * -> width: 3
 * -> until: 28.03.2026
 */

/** ===================== PARSE FILENAME ===================== */
function parsePermissionFilename_(fileName) {
  const original = String(fileName || '').trim();
  if (!original) return null;

  const base = original.replace(/\.pdf$/i, '').trim();
  if (!base) return null;

  // TS = всё до первого "_"
  const firstUnderscore = base.indexOf('_');
  if (firstUnderscore <= 0) return null;

  const ts = base.slice(0, firstUnderscore).trim();
  const rest = base.slice(firstUnderscore + 1).trim();
  if (!ts || !rest) return null;

  // Дата "до dd.mm.yy(yy)"
  const until = extractUntilFromText_(rest);

  // Тоннаж/ширина — ищем числа перед "т" и "м"
  const tonnage = extractNumberWithUnit_(rest, 'т');
  const width = extractNumberWithUnit_(rest, 'м');

  // Маршрут — берём часть после TS и до первой запятой или до "_до"
  const route = extractRoute_(rest);

  return {
    ts,
    route: route || '',
    tonnage: tonnage !== null ? tonnage : '',
    width: width !== null ? width : '',
    until: until instanceof Date ? until : null,
  };
}

function extractRoute_(rest) {
  let s = String(rest || '').trim();
  if (!s) return '';

  // отрезаем всё, что после "_до ..."
  s = s.replace(/[_\s]*до\s*\d{1,2}\.\d{1,2}\.\d{2,4}.*/i, '').trim();

  // если есть запятая — маршрут до первой запятой
  const comma = s.indexOf(',');
  if (comma > 0) s = s.slice(0, comma).trim();

  // иногда могут быть доп. хвосты через "_" — берём до первого "_"
  const us = s.indexOf('_');
  if (us > 0) s = s.slice(0, us).trim();

  return normalizeSpaces_(s);
}

function extractUntilFromText_(text) {
  const s = String(text || '');
  const m = s.match(/до\s*(\d{1,2}\.\d{1,2}\.\d{2,4})/i);
  if (!m) return null;
  return parseRuDate_(m[1]);
}

function extractNumberWithUnit_(text, unitChar) {
  const s = String(text || '');

  // Поддержка кириллица/латиница: т/t и м/m
  let unitPattern = unitChar;
  if (unitChar === 'т') unitPattern = '[тt]';
  if (unitChar === 'м') unitPattern = '[мm]';

  // Примеры: "44т", "44 т", "44т,", "44т_", "3.49м", "3,49м"
  const re = new RegExp('(\\d+(?:[\\.,]\\d+)?)\\s*' + unitPattern + '(?=\\s|,|_|$)', 'i');
  const m = s.match(re);
  if (!m) return null;

  const n = safeToNumber_(m[1]);
  return (n === null) ? null : n;
}

/** ===================== DATE / STRING UTILS ===================== */
function parseRuDate_(dmy) {
  const s = String(dmy || '').trim();
  const m = s.match(/^(\d{1,2})\.(\d{1,2})\.(\d{2,4})$/);
  if (!m) return null;

  const dd = Number(m[1]);
  const mm = Number(m[2]);
  let yy = Number(m[3]);

  if (!isFinite(dd) || !isFinite(mm) || !isFinite(yy)) return null;
  if (yy < 100) yy = 2000 + yy;

  const dt = new Date(yy, mm - 1, dd);
  if (dt.getFullYear() !== yy || dt.getMonth() !== (mm - 1) || dt.getDate() !== dd) return null;

  dt.setHours(0, 0, 0, 0);
  return dt;
}

function formatRuDate_(d, pattern) {
  try {
    if (d instanceof Date) {
      return Utilities.formatDate(d, Session.getScriptTimeZone(), pattern || 'dd.MM.yyyy');
    }
  } catch (e) {}
  return String(d || '');
}

function normalizeSpaces_(s) {
  return String(s || '').replace(/\s+/g, ' ').trim();
}

function safeToNumber_(v) {
  if (v === null || v === undefined) return null;
  const s = String(v).trim().replace(',', '.');
  if (!s) return null;
  const n = Number(s);
  return isFinite(n) ? n : null;
}
