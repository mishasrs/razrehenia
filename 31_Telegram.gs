/**
 * 31_Telegram.gs
 * Telegram: sidebar + отправка PDF/QR + контакты
 */

/** ===================== TELEGRAM ===================== */
const TG_CONTACTS_SHEET = 'Контакты';
const PROP_TG_TOKEN = 'TELEGRAM_BOT_TOKEN';
const PROP_TG_UPD_OFFSET = 'TELEGRAM_UPDATE_OFFSET';
const TG_THROTTLE_MS = 350;

// Sidebar data cache
const TG_CACHE_FILES_KEY = 'TG_LAST_FILES_JSON';

// Employee bot roles
const TG_ROLE_DRIVER = 'водитель';
const TG_ROLE_EMPLOYEE = 'сотрудник';
const TG_ROLE_MANAGER = 'руководитель';
const TG_DEFAULT_ROLE = '';

// Contacts sheet headers
const TG_CONTACTS_HEADERS = ['Имя', 'chat_id', 'Активен', 'Роль'];

// Optional role-specific folder properties (fallback to ROOT_FOLDER_ID)
const PROP_TG_DRIVER_FOLDER_ID = 'TG_DRIVER_FOLDER_ID';
const PROP_TG_EMPLOYEE_FOLDER_ID = 'TG_EMPLOYEE_FOLDER_ID';
const PROP_TG_MANAGER_FOLDER_ID = 'TG_MANAGER_FOLDER_ID';

// Bot menu buttons
const TG_BTN_DOCS = 'Документы';
const TG_BTN_ROLE = 'Моя роль';
const TG_BTN_MENU = 'Меню';

const TG_EMPLOYEE_COMMANDS = [
  { command: 'menu', description: 'Открыть меню' },
  { command: 'docs', description: 'Папка документов' },
  { command: 'role', description: 'Показать роль' }
];

function tgSetBotToken() {
  const ui = SpreadsheetApp.getUi();
  const res = ui.prompt('TELEGRAM_BOT_TOKEN', 'Вставьте токен бота (от @BotFather):', ui.ButtonSet.OK_CANCEL);
  if (res.getSelectedButton() !== ui.Button.OK) return;

  const token = (res.getResponseText() || '').trim();
  if (!token) {
    ui.alert('Токен пустой.');
    return;
  }
  PropertiesService.getScriptProperties().setProperty(PROP_TG_TOKEN, token);
  try {
    tgApplyEmployeeBotCommands_(token);
    ui.alert('Токен сохранён. Команды меню в Telegram обновлены.');
  } catch (e) {
    ui.alert(`Токен сохранён, но команды меню не обновлены: ${e && e.message ? e.message : e}`);
  }
}

function tgSetRoleFolders() {
  const ui = SpreadsheetApp.getUi();
  const props = PropertiesService.getScriptProperties();

  const roles = [
    { label: TG_ROLE_DRIVER, prop: PROP_TG_DRIVER_FOLDER_ID },
    { label: TG_ROLE_EMPLOYEE, prop: PROP_TG_EMPLOYEE_FOLDER_ID },
    { label: TG_ROLE_MANAGER, prop: PROP_TG_MANAGER_FOLDER_ID }
  ];

  for (const item of roles) {
    const cur = (props.getProperty(item.prop) || '').trim();
    const prompt = ui.prompt(
      `Папка для роли "${item.label}"`,
      `Введите ID папки Drive (после /folders/).\nТекущее значение: ${cur || 'не задано'}\nОставьте пустым, чтобы использовать ROOT_FOLDER_ID.`,
      ui.ButtonSet.OK_CANCEL
    );
    if (prompt.getSelectedButton() !== ui.Button.OK) return;

    const value = (prompt.getResponseText() || '').trim();
    if (value) props.setProperty(item.prop, value);
    else props.deleteProperty(item.prop);
  }

  ui.alert('Папки ролей сохранены.');
}

function tgSetupEmployeeBotMenu() {
  const token = PropertiesService.getScriptProperties().getProperty(PROP_TG_TOKEN);
  if (!token) throw new Error('Не задан TELEGRAM_BOT_TOKEN.');

  tgApplyEmployeeBotCommands_(token);
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  toastSafe_(ss, 'Команды меню Telegram обновлены.');
}

function tgInitEmployeeBot() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const token = PropertiesService.getScriptProperties().getProperty(PROP_TG_TOKEN);
  if (!token) throw new Error('Не задан TELEGRAM_BOT_TOKEN.');

  tgEnsureContactsSheet_(ss);
  tgApplyEmployeeBotCommands_(token);
  const sync = tgSyncChatIdsFromUpdates();
  const contactsCount = tgListContacts_(ss).length;

  if (!contactsCount) {
    toastSafe_(ss, 'Лист "Контакты" создан, но контактов нет. Пусть сотрудник напишет боту /start или добавьте контакт вручную.');
  } else {
    toastSafe_(ss, `Инициализация завершена. Контактов: ${contactsCount}, добавлено: ${sync.added || 0}.`);
  }

  return {
    contacts: contactsCount,
    added: sync && sync.added ? sync.added : 0,
    handled: sync && sync.handled ? sync.handled : 0,
    errors: sync && sync.errors ? sync.errors : 0
  };
}

function tgAddEmployeeContactManually() {
  const ui = SpreadsheetApp.getUi();
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sh = tgEnsureContactsSheet_(ss);

  const chatPrompt = ui.prompt(
    'Добавить контакт',
    'Введите chat_id сотрудника (из Telegram):',
    ui.ButtonSet.OK_CANCEL
  );
  if (chatPrompt.getSelectedButton() !== ui.Button.OK) return;
  const chatId = String(chatPrompt.getResponseText() || '').trim();
  if (!chatId) throw new Error('Пустой chat_id.');

  const namePrompt = ui.prompt(
    'Добавить контакт',
    'Введите имя (можно оставить пустым):',
    ui.ButtonSet.OK_CANCEL
  );
  if (namePrompt.getSelectedButton() !== ui.Button.OK) return;
  const inputName = String(namePrompt.getResponseText() || '').trim();

  const rolePrompt = ui.prompt(
    'Добавить контакт',
    'Введите роль: водитель / сотрудник / руководитель',
    ui.ButtonSet.OK_CANCEL
  );
  if (rolePrompt.getSelectedButton() !== ui.Button.OK) return;
  const role = tgNormalizeRole_(rolePrompt.getResponseText());
  if (!role) throw new Error('Роль не распознана. Допустимо: водитель, сотрудник, руководитель.');

  const contacts = tgListContacts_(ss);
  const existing = contacts.find(c => String(c.chatId) === chatId);

  if (existing && existing.rowIndex) {
    const finalName = inputName || existing.name || 'Сотрудник';
    sh.getRange(existing.rowIndex, 1, 1, TG_CONTACTS_HEADERS.length)
      .setValues([[finalName, chatId, true, role]]);
    toastSafe_(ss, `Контакт обновлён: ${finalName} (${chatId}), роль ${role}.`);
    return { mode: 'update', chatId, role };
  }

  const finalName = inputName || 'Сотрудник';
  sh.appendRow([finalName, chatId, true, role]);
  toastSafe_(ss, `Контакт добавлен: ${finalName} (${chatId}), роль ${role}.`);
  return { mode: 'insert', chatId, role };
}

function tgSendEmployeeMenuToActiveContacts() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const token = PropertiesService.getScriptProperties().getProperty(PROP_TG_TOKEN);
  if (!token) throw new Error('Не задан TELEGRAM_BOT_TOKEN.');

  const contacts = tgListContacts_(ss);
  let sent = 0;
  let errors = 0;

  for (const contact of contacts) {
    if (!contact || !contact.active || !contact.chatId) continue;
    try {
      tgSendEmployeeMenu_(token, contact.chatId, contact);
      sent++;
      Utilities.sleep(TG_THROTTLE_MS);
    } catch (e) {
      errors++;
      log_(ss, `TG MENU PUSH ERROR chat_id=${contact.chatId}: ${e && e.stack ? e.stack : e}`, 'ERROR');
    }
  }

  toastSafe_(ss, `Меню отправлено: ${sent}, ошибок: ${errors}`);
  return { sent, errors };
}

function tgOpenSendSidebar() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const token = PropertiesService.getScriptProperties().getProperty(PROP_TG_TOKEN);
  if (!token) {
    SpreadsheetApp.getUi().alert('Не задан TELEGRAM_BOT_TOKEN.\nОткройте: Разрешения → Telegram → Настроить токен бота');
    return;
  }

  const sh = ss.getActiveSheet();
  const sheetName = sh.getName();

  let files = [];
  try {
    if (sheetName === VIEW_SHEET_NAME) {
      files = tgReadSelectedFilesFromView_(ss, sh);
    } else if (sheetName === SHEET_NAME) {
      files = tgReadSelectedFilesFromPermissions_(ss, sh);
    } else {
      SpreadsheetApp.getUi().alert(`Откройте лист "${VIEW_SHEET_NAME}" или "${SHEET_NAME}" и выделите нужные строки/ячейки.`);
      return;
    }
  } catch (e) {
    SpreadsheetApp.getUi().alert(`Ошибка чтения выделения: ${e && e.message ? e.message : e}`);
    return;
  }

  if (!files.length) {
    SpreadsheetApp.getUi().alert('Ничего не выбрано.\nВыделите строки с разрешениями (не заголовки) и повторите.');
    return;
  }

  // cache selected files for HTML (avoid template JSON issues)
  CacheService.getUserCache().put(TG_CACHE_FILES_KEY, JSON.stringify(files), 3600);

  SpreadsheetApp.getUi().showSidebar(
    HtmlService.createHtmlOutputFromFile('TelegramSend')
      .setTitle('Отправка в Telegram')
  );
}

// Called from TelegramSend.html on boot
function tgGetSidebarData() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const filesJson = CacheService.getUserCache().get(TG_CACHE_FILES_KEY);
  const files = filesJson ? JSON.parse(filesJson) : [];
  const contacts = tgListContacts_(ss);
  return { files, contacts };
}

/** ---- Selection read: "Разрешения" ---- */
function tgReadSelectedFilesFromPermissions_(ss, sh) {
  const rows = tgGetSelectedRowNumbers_(sh).filter(r => r >= 2);
  if (!rows.length) return [];

  const minR = rows[0];
  const maxR = rows[rows.length - 1];
  const num = maxR - minR + 1;

  const values = sh.getRange(minR, 1, num, COL_UPDATED).getValues();
  const rtQr = sh.getRange(minR, COL_QR, num, 1).getRichTextValues();

  const selected = new Set(rows);

  const out = [];
  for (let i = 0; i < num; i++) {
    const rowIndex = minR + i;
    if (!selected.has(rowIndex)) continue;

    const row = values[i];
    const ts = row[COL_TS - 1];
    const route = row[COL_ROUTE - 1];
    const until = row[COL_UNTIL - 1];
    const fileId = row[COL_FILE_ID - 1];

    if (!fileId) continue;

    let fileName = '';
    let fileUrl = '';
    try {
      const f = DriveApp.getFileById(String(fileId));
      fileName = f.getName();
      fileUrl = f.getUrl();
    } catch (e) {
      fileName = '(файл недоступен)';
    }

    let qrUrl = '';
    try {
      const rt = rtQr[i][0];
      qrUrl = rt ? (rt.getLinkUrl() || '') : '';
    } catch (e) {}

    out.push({
      sourceSheet: SHEET_NAME,
      rowIndex,
      fileId: String(fileId),
      fileName,
      fileUrl,
      ts: ts || '',
      route: route || '',
      until: until ? tgFormatDate_(until) : '',
      qrUrl: qrUrl || '',
      tonnage: row[COL_TONNAGE - 1] || '',
      width: row[COL_WIDTH - 1] || '',
      shortCode: tgShortFileCode_(fileName)
    });
  }
  return out;
}

/** ---- Selection read: "Витрина" ---- */
function tgReadSelectedFilesFromView_(ss, sh) {
  const rows = tgGetSelectedRowNumbers_(sh).filter(r => r >= 6);
  if (!rows.length) return [];

  const minR = rows[0];
  const maxR = rows[rows.length - 1];
  const num = maxR - minR + 1;

  const values = sh.getRange(minR, 1, num, 9).getValues(); // A:I
  const fileRT = sh.getRange(minR, 6, num, 1).getRichTextValues(); // F
  const qrRT   = sh.getRange(minR, 7, num, 1).getRichTextValues(); // G

  const selected = new Set(rows);

  const out = [];
  for (let i = 0; i < num; i++) {
    const rowIndex = minR + i;
    if (!selected.has(rowIndex)) continue;

    const v = values[i];

    const ts = v[0];
    const route = v[1];
    const tonnage = v[2];
    const width = v[3];
    const until = v[4];

    let fileId = v[7] ? String(v[7]).trim() : '';
    let qrUrl  = v[8] ? String(v[8]).trim() : '';

    let fileUrlFromCell = '';
    try {
      const rt = fileRT[i][0];
      fileUrlFromCell = rt ? (rt.getLinkUrl() || '') : '';
    } catch (e) {}

    if (!fileId && fileUrlFromCell) fileId = tgExtractDriveFileId_(fileUrlFromCell);

    if (!qrUrl) {
      try {
        const rtq = qrRT[i][0];
        qrUrl = rtq ? (rtq.getLinkUrl() || '') : '';
      } catch (e) {}
    }

    if (!fileId && !fileUrlFromCell) continue;

    let fileName = '';
    let fileUrl = fileUrlFromCell || '';
    if (fileId) {
      try {
        const f = DriveApp.getFileById(String(fileId));
        fileName = f.getName();
        if (!fileUrl) fileUrl = f.getUrl();
      } catch (e) {
        fileName = '(файл недоступен)';
      }
    } else {
      fileName = '(файл по ссылке)';
    }

    out.push({
      sourceSheet: VIEW_SHEET_NAME,
      rowIndex,
      fileId: fileId || '',
      fileName,
      fileUrl: fileUrl || '',
      ts: ts || '',
      route: route || '',
      until: until ? tgFormatDate_(until) : '',
      qrUrl: qrUrl || '',
      tonnage: tonnage || '',
      width: width || '',
      shortCode: tgShortFileCode_(fileName)
    });
  }

  return out;
}

function tgGetSelectedRowNumbers_(sh) {
  const arl = sh.getActiveRangeList();
  const ranges = arl ? arl.getRanges() : [sh.getActiveRange()];
  if (!ranges || !ranges.length) return [];

  const rowSet = new Set();
  for (const r of ranges) {
    const r0 = r.getRow();
    const nr = r.getNumRows();
    for (let i = 0; i < nr; i++) rowSet.add(r0 + i);
  }
  return [...rowSet].sort((a, b) => a - b);
}

/** ---- Contacts ---- */
function tgEnsureContactsSheet_(ss) {
  let sh = ss.getSheetByName(TG_CONTACTS_SHEET);
  if (!sh) sh = ss.insertSheet(TG_CONTACTS_SHEET);

  if (sh.getLastRow() < 1) {
    sh.getRange(1, 1, 1, TG_CONTACTS_HEADERS.length).setValues([TG_CONTACTS_HEADERS]);
  }

  const width = Math.max(sh.getLastColumn(), TG_CONTACTS_HEADERS.length);
  const header = sh.getRange(1, 1, 1, width).getValues()[0];
  const merged = header.slice(0, TG_CONTACTS_HEADERS.length);
  let changed = false;

  for (let i = 0; i < TG_CONTACTS_HEADERS.length; i++) {
    if (String(merged[i] || '').trim() !== TG_CONTACTS_HEADERS[i]) {
      merged[i] = TG_CONTACTS_HEADERS[i];
      changed = true;
    }
  }

  if (changed) sh.getRange(1, 1, 1, TG_CONTACTS_HEADERS.length).setValues([merged]);
  sh.setFrozenRows(1);
  return sh;
}

function tgListContacts_(ss) {
  const sh = tgEnsureContactsSheet_(ss);
  const lastRow = sh.getLastRow();
  if (lastRow < 2) return [];

  const vals = sh.getRange(2, 1, lastRow - 1, TG_CONTACTS_HEADERS.length).getValues();
  const out = [];
  for (let i = 0; i < vals.length; i++) {
    const row = vals[i];
    const name = (row[0] || '').toString().trim();
    const chatId = (row[1] || '').toString().trim();
    const activeRaw = row[2];
    const role = tgNormalizeRole_(row[3]) || '';

    const active = (activeRaw === true) ||
      (String(activeRaw).toLowerCase() === 'да') ||
      (String(activeRaw).toLowerCase() === 'true') ||
      (String(activeRaw).trim() === '1');

    if (!name && !chatId) continue;

    out.push({
      rowIndex: i + 2,
      name,
      chatId,
      active,
      role
    });
  }
  return out;
}

function tgNormalizeRole_(value) {
  const v = String(value || '').trim().toLowerCase();
  if (!v) return '';

  if (
    v === TG_ROLE_DRIVER ||
    v === 'driver' ||
    v === 'drv' ||
    v.indexOf('водит') === 0
  ) return TG_ROLE_DRIVER;

  if (
    v === TG_ROLE_EMPLOYEE ||
    v === 'employee' ||
    v === 'staff' ||
    v.indexOf('сотруд') === 0
  ) return TG_ROLE_EMPLOYEE;

  if (
    v === TG_ROLE_MANAGER ||
    v === 'manager' ||
    v === 'head' ||
    v === 'boss' ||
    v === 'admin' ||
    v.indexOf('руковод') === 0 ||
    v.indexOf('менедж') === 0
  ) return TG_ROLE_MANAGER;

  return '';
}

function tgRoleLabel_(role) {
  if (role === TG_ROLE_DRIVER) return TG_ROLE_DRIVER;
  if (role === TG_ROLE_EMPLOYEE) return TG_ROLE_EMPLOYEE;
  if (role === TG_ROLE_MANAGER) return TG_ROLE_MANAGER;
  return 'не назначена';
}

function tgIsRoleAllowed_(role) {
  return role === TG_ROLE_DRIVER || role === TG_ROLE_EMPLOYEE || role === TG_ROLE_MANAGER;
}

function tgBuildContactsMap_(contacts) {
  const map = new Map();
  for (const c of contacts || []) {
    if (!c || !c.chatId) continue;
    map.set(String(c.chatId), c);
  }
  return map;
}

function tgAppendContact_(sh, name, chatId, role) {
  const normalizedRole = tgNormalizeRole_(role) || TG_DEFAULT_ROLE;
  sh.appendRow([name, chatId, true, normalizedRole]);
  return {
    name,
    chatId: String(chatId),
    active: true,
    role: normalizedRole
  };
}

function tgExtractUpdateMessage_(update) {
  const msg = update ? (update.message || update.edited_message || null) : null;
  if (!msg) return null;

  const chat = msg.chat || null;
  if (!chat) return null;

  const chatId = String(chat.id || '').trim();
  if (!chatId) return null;

  return {
    chatId,
    chat,
    from: msg.from || null,
    text: String(msg.text || '').trim()
  };
}

function tgApplyEmployeeBotCommands_(token) {
  const url = `https://api.telegram.org/bot${token}/setMyCommands`;
  const payload = {
    commands: JSON.stringify(TG_EMPLOYEE_COMMANDS),
    language_code: 'ru'
  };

  const resp = UrlFetchApp.fetch(url, {
    method: 'post',
    payload,
    muteHttpExceptions: true
  });

  const code = resp.getResponseCode();
  if (code !== 200) throw new Error(`setMyCommands HTTP ${code}: ${resp.getContentText()}`);
  const json = JSON.parse(resp.getContentText() || '{}');
  if (!json.ok) throw new Error(`setMyCommands not ok: ${resp.getContentText()}`);
}

/** ---- getUpdates sync ---- */
function tgSyncChatIdsFromUpdates() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const token = PropertiesService.getScriptProperties().getProperty(PROP_TG_TOKEN);
  if (!token) throw new Error('Не задан TELEGRAM_BOT_TOKEN.');
  try {
    tgApplyEmployeeBotCommands_(token);
  } catch (e) {
    log_(ss, `TG WARN setMyCommands: ${e && e.message ? e.message : e}`, 'WARN');
  }

  const props = PropertiesService.getScriptProperties();
  const offset = props.getProperty(PROP_TG_UPD_OFFSET);

  const url = `https://api.telegram.org/bot${token}/getUpdates` + (offset ? `?offset=${encodeURIComponent(offset)}` : '');
  const resp = UrlFetchApp.fetch(url, { method: 'get', muteHttpExceptions: true });
  const code = resp.getResponseCode();
  if (code !== 200) throw new Error(`getUpdates HTTP ${code}: ${resp.getContentText()}`);

  const json = JSON.parse(resp.getContentText() || '{}');
  if (!json.ok) throw new Error(`getUpdates not ok: ${resp.getContentText()}`);

  const updates = json.result || [];
  if (!updates.length) {
    toastSafe_(ss, 'Нет новых сообщений.');
    return { added: 0, handled: 0, errors: 0 };
  }

  const sh = tgEnsureContactsSheet_(ss);
  const contactsMap = tgBuildContactsMap_(tgListContacts_(ss));

  let added = 0;
  let handled = 0;
  let errors = 0;
  let maxUpdateId = 0;

  for (const u of updates) {
    const updId = u.update_id || 0;
    if (updId > maxUpdateId) maxUpdateId = updId;

    try {
      const event = tgExtractUpdateMessage_(u);
      if (!event) continue;

      let contact = contactsMap.get(event.chatId);
      if (!contact) {
        const name = tgPickName_(event.from, event.chat);
        contact = tgAppendContact_(sh, name, event.chatId, TG_DEFAULT_ROLE);
        contactsMap.set(event.chatId, contact);
        added++;
      }

      if (tgHandleEmployeeMenuMessage_(token, event, contact)) handled++;
    } catch (e) {
      errors++;
      log_(ss, `TG BOT ERROR: ${e && e.stack ? e.stack : e}`, 'ERROR');
    }
  }

  props.setProperty(PROP_TG_UPD_OFFSET, String(maxUpdateId + 1));
  toastSafe_(ss, `TG: добавлено ${added}, обработано ${handled}, ошибок ${errors}`);
  return { added, handled, errors };
}

function tgProcessEmployeeBotUpdates() {
  return tgSyncChatIdsFromUpdates();
}

function tgEnableEmployeeBotPolling() {
  const token = PropertiesService.getScriptProperties().getProperty(PROP_TG_TOKEN);
  if (!token) throw new Error('Не задан TELEGRAM_BOT_TOKEN.');

  tgApplyEmployeeBotCommands_(token);
  tgClearEmployeeBotTriggers_();
  ScriptApp.newTrigger('tgProcessEmployeeBotUpdates')
    .timeBased()
    .everyMinutes(1)
    .create();

  const ss = SpreadsheetApp.getActiveSpreadsheet();
  toastSafe_(ss, 'TG меню: автообработка включена (каждую минуту).');
}

function tgDisableEmployeeBotPolling() {
  tgClearEmployeeBotTriggers_();
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  toastSafe_(ss, 'TG меню: автообработка отключена.');
}

function tgClearEmployeeBotTriggers_() {
  const triggers = ScriptApp.getProjectTriggers();
  for (const t of triggers) {
    if (t.getHandlerFunction() === 'tgProcessEmployeeBotUpdates') {
      ScriptApp.deleteTrigger(t);
    }
  }
}

function tgHandleEmployeeMenuMessage_(token, event, contact) {
  const text = String((event && event.text) || '').trim();
  if (!text) return false;

  const low = text.toLowerCase();
  const firstToken = low.split(/\s+/)[0];

  if (
    firstToken === '/start' ||
    firstToken.indexOf('/start@') === 0 ||
    firstToken === '/menu' ||
    firstToken.indexOf('/menu@') === 0 ||
    low === TG_BTN_MENU.toLowerCase()
  ) {
    tgSendEmployeeMenu_(token, event.chatId, contact);
    return true;
  }

  if (
    firstToken === '/docs' ||
    firstToken.indexOf('/docs@') === 0 ||
    low === TG_BTN_DOCS.toLowerCase()
  ) {
    tgSendDocsFolder_(token, event.chatId, contact);
    return true;
  }

  if (
    firstToken === '/role' ||
    firstToken.indexOf('/role@') === 0 ||
    low === TG_BTN_ROLE.toLowerCase()
  ) {
    tgSendRoleInfo_(token, event.chatId, contact);
    return true;
  }

  return false;
}

function tgSendEmployeeMenu_(token, chatId, contact) {
  if (!contact || !contact.active) {
    tgSendMessage_(token, chatId, 'Доступ отключен. Обратитесь к руководителю.', {
      reply_markup: tgBuildMenuKeyboard_(null)
    });
    return;
  }

  if (!tgIsRoleAllowed_(contact.role)) {
    tgSendMessage_(token, chatId, 'Роль не назначена. Обратитесь к руководителю. Нажмите "Моя роль" для проверки.', {
      reply_markup: tgBuildMenuKeyboard_(contact.role)
    });
    return;
  }

  const text = `Роль: ${tgRoleLabel_(contact.role)}\nВыберите действие:`;
  tgSendMessage_(token, chatId, text, { reply_markup: tgBuildMenuKeyboard_(contact.role) });
}

function tgSendRoleInfo_(token, chatId, contact) {
  if (!contact) {
    tgSendMessage_(token, chatId, 'Контакт не найден в базе.');
    return;
  }

  const active = contact.active ? 'да' : 'нет';
  const text = `Ваша роль: ${tgRoleLabel_(contact.role)}\nАктивен: ${active}`;
  tgSendMessage_(token, chatId, text, { reply_markup: tgBuildMenuKeyboard_(contact.role) });
}

function tgSendDocsFolder_(token, chatId, contact) {
  if (!contact || !contact.active) {
    tgSendMessage_(token, chatId, 'Доступ к документам закрыт. Обратитесь к руководителю.');
    return;
  }

  if (!tgIsRoleAllowed_(contact.role)) {
    tgSendMessage_(token, chatId, 'Роль не назначена. Обратитесь к руководителю.');
    return;
  }

  const folderId = tgFolderIdForRole_(contact.role);
  if (!folderId) {
    tgSendMessage_(token, chatId, 'Папка документов не настроена. Укажите ROOT_FOLDER_ID.');
    return;
  }

  const folderUrl = `https://drive.google.com/drive/folders/${folderId}`;
  const text = `Документы для роли "${tgRoleLabel_(contact.role)}":\n${folderUrl}`;
  tgSendMessage_(token, chatId, text, {
    reply_markup: tgBuildMenuKeyboard_(contact.role),
    disable_web_page_preview: false
  });
}

function tgBuildMenuKeyboard_(role) {
  return {
    keyboard: [[TG_BTN_DOCS], [TG_BTN_ROLE], [TG_BTN_MENU]],
    resize_keyboard: true,
    one_time_keyboard: false
  };
}

function tgFolderIdForRole_(role) {
  const props = PropertiesService.getScriptProperties();
  const normalized = tgNormalizeRole_(role);

  let roleFolder = '';
  if (normalized === TG_ROLE_DRIVER) roleFolder = props.getProperty(PROP_TG_DRIVER_FOLDER_ID) || '';
  else if (normalized === TG_ROLE_EMPLOYEE) roleFolder = props.getProperty(PROP_TG_EMPLOYEE_FOLDER_ID) || '';
  else if (normalized === TG_ROLE_MANAGER) roleFolder = props.getProperty(PROP_TG_MANAGER_FOLDER_ID) || '';

  const rootFolder = props.getProperty('ROOT_FOLDER_ID') || '';
  return String(roleFolder || rootFolder || '').trim();
}
/** ---- Send ---- */
function tgSendFromUi(payload) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const token = PropertiesService.getScriptProperties().getProperty(PROP_TG_TOKEN);
  if (!token) throw new Error('Не задан TELEGRAM_BOT_TOKEN.');

  const chatIds = (payload && payload.chatIds) ? payload.chatIds : [];
  const files = (payload && payload.files) ? payload.files : [];
  const withPdf = !!(payload && payload.withPdf);
  const withQr = !!(payload && payload.withQr);

  if (!chatIds.length) throw new Error('Не выбраны получатели.');
  if (!files.length) throw new Error('Не выбраны файлы.');
  if (!withPdf && !withQr) throw new Error('Нечего отправлять: включите PDF или QR.');

  let sentDocs = 0, sentMsgs = 0, errors = 0;
  const errList = [];

  for (const chatId of chatIds) {
    for (const f of files) {
      try {
        // 1) Если отправляем PDF — отправляем ОДИН документ
        // и, если включён QR, добавляем QR в caption (без отдельного сообщения)
        if (withPdf) {
          if (!f.fileId) throw new Error(`Нет fileId для "${f.fileName || ''}" (строка ${f.rowIndex}, лист ${f.sourceSheet})`);

          const file = DriveApp.getFileById(String(f.fileId));
          const code = (f.shortCode || tgShortFileCode_(file.getName()) || 'document').trim();

          const blob = file.getBlob();
          blob.setName(code + '.pdf'); // <-- 903(4708).pdf

          const caption = tgBuildCaptionHtml_(f, withQr); // <-- QR внутрь caption
          tgSendDocument_(token, chatId, blob, caption);

          sentDocs++;
          Utilities.sleep(TG_THROTTLE_MS);

        // 2) Если PDF выключен, но QR включен — отправляем ТОЛЬКО текст с QR
        } else if (withQr) {
          const text = f.qrUrl ? `QR: ${f.qrUrl}` : 'QR: (нет)';
          tgSendMessage_(token, chatId, text);

          sentMsgs++;
          Utilities.sleep(TG_THROTTLE_MS);
        }
      } catch (e) {
        errors++;
        const msg = String(e && e.message ? e.message : e);
        errList.push(msg);
        log_(ss, `TG ERROR chat_id=${chatId}: ${e && e.stack ? e.stack : e}`, 'ERROR');
      }
    }
  }

  return { sentDocs, sentMsgs, errors, sampleErrors: errList.slice(0, 10) };
}

/** ---- Telegram low-level ---- */
function tgSendDocument_(token, chatId, blob, captionHtml) {
  const url = `https://api.telegram.org/bot${token}/sendDocument`;
  const payload = {
    chat_id: chatId,
    document: blob,
    caption: captionHtml,
    parse_mode: 'HTML'
  };

  const resp = UrlFetchApp.fetch(url, {
    method: 'post',
    payload: payload,
    muteHttpExceptions: true
  });

  const code = resp.getResponseCode();
  if (code !== 200) throw new Error(`sendDocument HTTP ${code}: ${resp.getContentText()}`);

  const json = JSON.parse(resp.getContentText() || '{}');
  if (!json.ok) throw new Error(`sendDocument not ok: ${resp.getContentText()}`);
}

function tgSendMessage_(token, chatId, text, options) {
  const url = `https://api.telegram.org/bot${token}/sendMessage`;
  const disablePreview = (options && typeof options.disable_web_page_preview === 'boolean')
    ? options.disable_web_page_preview
    : true;

  const payload = {
    chat_id: chatId,
    text: String(text || ''),
    disable_web_page_preview: disablePreview
  };

  if (options && options.reply_markup) {
    payload.reply_markup = JSON.stringify(options.reply_markup);
  }
  if (options && options.parse_mode) {
    payload.parse_mode = String(options.parse_mode);
  }

  const resp = UrlFetchApp.fetch(url, {
    method: 'post',
    payload: payload,
    muteHttpExceptions: true
  });

  const code = resp.getResponseCode();
  if (code !== 200) throw new Error(`sendMessage HTTP ${code}: ${resp.getContentText()}`);

  const json = JSON.parse(resp.getContentText() || '{}');
  if (!json.ok) throw new Error(`sendMessage not ok: ${resp.getContentText()}`);
}

/** ---- Caption format (as requested) ---- */
function tgBuildCaptionHtml_(f, includeQr) {
  const safe = (s) => tgHtmlEscape_(String(s || ''));

  const route = (f.route || '').toString().trim();
  const until = (f.until || '').toString().trim();

  const ton = tgFmtVal_(f.tonnage);
  const wid = tgFmtVal_(f.width);

  const tonOut = ton ? (/[тt]$/i.test(ton) ? ton : ton + 'т') : '';
  const widOut = wid ? (/[мm]$/i.test(wid) ? wid : wid + 'м') : '';

  const lines = [];
  lines.push(`Маршрут: <b>${safe(route)}</b>`);
  lines.push(`До: <b>${safe(until)}</b>`);
  lines.push(`Тоннаж: ${safe(tonOut)}`);
  lines.push(`Ширина: ${safe(widOut)}`);

  // QR добавляем ОДНОЙ строкой в конце (без ссылки на PDF)
  if (includeQr) {
    lines.push(`QR: ${safe(f.qrUrl || '(нет)')}`);
  }

  return lines.join('\n').slice(0, 1000);
}

/** ---- Helpers for file name format 903(4708) ---- */
function tgShortFileCode_(fileName) {
  const n = String(fileName || '').trim();
  if (!n) return '';
  const base = n.replace(/\.pdf$/i, '');
  const idx = base.indexOf('_');
  return (idx > 0 ? base.slice(0, idx) : base).trim();
}

function tgFmtVal_(v) {
  if (v === null || v === undefined) return '';
  if (v instanceof Date) return tgFormatDate_(v);
  const s = String(v).trim();
  return s;
}

function tgHtmlEscape_(s) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function tgPickName_(from, chat) {
  const parts = [];
  if (from) {
    if (from.first_name) parts.push(from.first_name);
    if (from.last_name) parts.push(from.last_name);
    if (!parts.length && from.username) parts.push('@' + from.username);
  }
  if (!parts.length && chat && chat.title) parts.push(chat.title);
  return parts.length ? parts.join(' ') : 'Новый контакт';
}

function tgFormatDate_(d) {
  try {
    if (Object.prototype.toString.call(d) === '[object Date]') {
      return Utilities.formatDate(d, Session.getScriptTimeZone(), 'dd.MM.yyyy');
    }
  } catch (e) {}
  return String(d);
}

function tgExtractDriveFileId_(url) {
  const s = String(url || '');
  let m = s.match(/\/d\/([a-zA-Z0-9_-]{10,})/);
  if (m) return m[1];
  m = s.match(/[?&]id=([a-zA-Z0-9_-]{10,})/);
  if (m) return m[1];
  return '';
}

