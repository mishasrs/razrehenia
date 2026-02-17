/**
 * 01_Config.gs
 * Общие настройки проекта (вынесено из Code.gs)
 */

/** ===================== CONFIG ===================== */
const SHEET_NAME = 'Разрешения';
const LOG_SHEET_NAME = 'Logs';

const VIEW_SHEET_NAME = 'Витрина';
const EXPIRING_DAYS = 14;

const COL_TS       = 1;
const COL_ROUTE    = 2;
const COL_TONNAGE  = 3;
const COL_WIDTH    = 4;
const COL_UNTIL    = 5;
const COL_FILE     = 6;
const COL_QR       = 7;
const COL_FILE_ID  = 8;
const COL_UPDATED  = 9;

const SCAN_SUBFOLDERS = true;
const FILL_MISSING_LIMIT = 25;

const STRICT_SAFE_ROUTE = false;
const ENABLE_GOQR_FALLBACK = true;

const DEBUG = false;

// QR APIs
const QUICKCHART_MAX_BYTES = 900000;
const GOQR_MAX_BYTES = 950000;
const QC_TRIES = 3;
const GOQR_TRIES = 2;

// --- Anti-timeout ---
const TIME_BUDGET_MS = 330000;       // ~5.5 минут
const TIME_BUFFER_MS = 15000;        // запас 15 сек
const AUTO_CONTINUE = true;
const CONTINUE_DELAY_MS = 60 * 1000;

const SYNC_CHUNK_ROWS = 180;         // синхронизируем строк за запуск
const NEW_CHUNK_FILES = 80;          // добавляем новых PDF за запуск

// --- STOP & PROGRESS ---
const PROP_STOP_SCAN = 'STOP_SCAN';
const PROP_SYNC_CURSOR = 'SYNC_CURSOR';
