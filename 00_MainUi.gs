/**
 * 00_MainUi.gs
 * Меню + UI действия (ROOT_FOLDER, STOP, очистка логов)
 */

/** ===================== MENU ===================== */
function onOpen() {
  try {
    const ui = SpreadsheetApp.getUi();

    const tgMenu = ui.createMenu('Telegram')
      .addItem('Настроить токен бота', 'tgSetBotToken')
      .addItem('Инициализировать меню сотрудников', 'tgInitEmployeeBot')
      .addItem('Обновить команды меню бота', 'tgSetupEmployeeBotMenu')
      .addItem('Настроить папки по ролям', 'tgSetRoleFolders')
      .addItem('Добавить контакт вручную', 'tgAddEmployeeContactManually')
      .addItem('Разослать меню активным контактам', 'tgSendEmployeeMenuToActiveContacts')
      .addItem('Синхронизировать chat_id из /start (getUpdates)', 'tgSyncChatIdsFromUpdates')
      .addItem('Обработать меню сотрудников (getUpdates)', 'tgProcessEmployeeBotUpdates')
      .addItem('Включить автообработку меню (1 мин)', 'tgEnableEmployeeBotPolling')
      .addItem('Выключить автообработку меню', 'tgDisableEmployeeBotPolling')
      .addSeparator()
      .addItem('Отправить в Telegram (по выделению)', 'tgOpenSendSidebar');

    ui.createMenu('Разрешения')
      .addItem('Указать папку с PDF', 'uiSetRootFolder')
      .addSeparator()
      .addItem('Сканировать', 'scanAndUpdate')
      .addItem('Стоп', 'stopScan')
      .addSeparator()
      .addItem('Дозаполнить пустые QR', 'fillMissingQr')
      .addItem('Обновить витрину', 'refreshView')
      .addSeparator()
      .addItem('Очистить логи', 'clearLogs')
      .addSeparator()
      .addItem('Тест: 1 файл', 'diagnoseOne')
      .addSeparator()
      .addSubMenu(tgMenu)
      .addToUi();
  } catch (e) {}
}

/** ===================== UI ===================== */
function uiSetRootFolder() {
  const ui = SpreadsheetApp.getUi();
  const res = ui.prompt(
    'ROOT_FOLDER_ID',
    'Вставьте ID папки Drive (после /folders/):',
    ui.ButtonSet.OK_CANCEL
  );
  if (res.getSelectedButton() !== ui.Button.OK) return;

  const id = (res.getResponseText() || '').trim();
  if (!id) {
    ui.alert('ID пустой.');
    return;
  }

  PropertiesService.getScriptProperties().setProperty('ROOT_FOLDER_ID', id);
  ui.alert('ROOT_FOLDER_ID сохранён.');
}

function clearLogs() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sh = ensureLogSheet_(ss);
  const lastRow = sh.getLastRow();
  if (lastRow >= 2) sh.getRange(2, 1, lastRow - 1, 3).clearContent();
  log_(ss, 'Logs очищены пользователем', 'INFO');
  toastSafe_(ss, 'Logs очищены');
}

function stopScan() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  PropertiesService.getScriptProperties().setProperty(PROP_STOP_SCAN, '1');
  clearContinueTriggers_();
  log_(ss, 'STOP установлен пользователем. Автопродолжение отключено.', 'WARN');
  toastSafe_(ss, 'Остановлено (STOP). Автопродолжение отключено.');
}

/** Кнопка меню (публичная), вызывает build витрины */
function refreshView() {
  refreshView_();
}

