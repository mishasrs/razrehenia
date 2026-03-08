# Технологический стек

**Дата анализа:** 2026-03-08

## Формат проекта

- Репозиторий содержит container-bound проект Google Apps Script без отдельного backend-хоста и без web app entrypoint.
- Корневые исходники лежат плоско в файлах `00_MainUi.gs`, `01_Config.gs`, `02_RunControl.gs`, `03_Logging.gs`, `10_DriveRepo.gs`, `11_SheetsRepo.gs`, `12_QrService.gs`, `20_View.gs`, `21_DataFormat.gs`, `31_Telegram.gs`, `40_ScanJob.gs`, `90_Utils.gs` и `TelegramSend.html`.
- В `.clasp.json` зафиксированы `scriptId`, `parentId`, пустой `rootDir` и стандартные расширения `.gs`, `.html`, `.json`; это признак синхронизации через `clasp`, а не через bundler.
- В репозитории нет `package.json`, `tsconfig.json`, `eslint.config.*`, `prettier.*`, `requirements.txt`, `Dockerfile` или CI-конфигов.

## Языки и типы файлов

- Основной язык: `JavaScript` в синтаксисе Google Apps Script V8, все серверные сценарии находятся в `.gs` файлах.
- Клиентская часть ограничена `TelegramSend.html`: внутри один HTML-шаблон, inline CSS и vanilla JavaScript с вызовами `google.script.run`.
- Конфигурационные файлы: `appsscript.json` для runtime Apps Script и `.clasp.json` для локальной привязки проекта.
- Markdown-карта кодовой базы хранится в `.planning/codebase/*.md`, но исполняемого кода вне Apps Script нет.

## Runtime и среда выполнения

- `appsscript.json` задаёт `runtimeVersion: "V8"`, `timeZone: "Europe/Moscow"` и `exceptionLogging: "STACKDRIVER"`.
- Скрипт исполняется внутри Google Spreadsheet: `onOpen()` в `00_MainUi.gs` строит пользовательское меню, а `SpreadsheetApp.getActiveSpreadsheet()` используется как главный контекст почти во всех модулях.
- Проект не разворачивается как HTTP-сервис: в кодовой базе нет `doGet()` и `doPost()`, значит входные точки ограничены меню таблицы, sidebar и time-based trigger.
- Ограничения Apps Script учтены явно: в `01_Config.gs` заданы `TIME_BUDGET_MS`, `TIME_BUFFER_MS`, `AUTO_CONTINUE` и `CONTINUE_DELAY_MS`, а `02_RunControl.gs` планирует продолжение через `ScriptApp.newTrigger('continueScan')`.
- Практический пример: `scanAndUpdate()` из `40_ScanJob.gs` запускает пакетную синхронизацию, а при нехватке времени `scheduleContinue_()` в `02_RunControl.gs` ставит новый запуск через минуту.

## Платформенные API и "фреймворки"

- Вместо внешнего фреймворка проект опирается на встроенные сервисы Google Apps Script.
- `SpreadsheetApp` используется в `00_MainUi.gs`, `11_SheetsRepo.gs`, `20_View.gs`, `21_DataFormat.gs`, `31_Telegram.gs` и `40_ScanJob.gs` для меню, чтения диапазонов, rich text ссылок и условного форматирования.
- `DriveApp` используется в `10_DriveRepo.gs`, `11_SheetsRepo.gs`, `31_Telegram.gs` и `40_ScanJob.gs` для обхода папок, чтения PDF и получения blob перед отправкой в Telegram.
- `ScriptApp` используется в `02_RunControl.gs`, `12_QrService.gs` и `31_Telegram.gs` для time-based trigger и OAuth-токена `ScriptApp.getOAuthToken()`.
- `PropertiesService` и `CacheService` используются как встроенное key-value хранилище состояния в `00_MainUi.gs`, `02_RunControl.gs`, `11_SheetsRepo.gs` и `31_Telegram.gs`.
- `LockService` в `40_ScanJob.gs` сериализует долгие операции `scanAndUpdateCore_()` и `fillMissingQr()`.
- `HtmlService` подключает sidebar из `TelegramSend.html` через `tgOpenSendSidebar()` в `31_Telegram.gs`.
- `Utilities`, `Session`, `MimeType` и `ImagesService` используются в `12_QrService.gs`, `31_Telegram.gs` и `90_Utils.gs` для дат, blob, base64, изображений и throttling.

## Явные зависимости и сервисы рантайма

- В `appsscript.json` включён Advanced Google Service `Drive` версии `v2` с символом `Drive`; он нужен вызову `Drive.Files.get(...)` в `12_QrService.gs`.
- Для QR-пайплайна `12_QrService.gs` важны не только `UrlFetchApp`, но и `ImagesService.openImage(...)`; это скрытая зависимость на image API платформы.
- Для пользовательского интерфейса нет библиотек вроде React/Vue: `TelegramSend.html` вручную рендерит списки, читает чекбоксы и вызывает `tgGetSidebarData()` и `tgSendFromUi(...)`.
- Для логирования кроме Stackdriver используется табличный журнал: `03_Logging.gs` создаёт лист `Logs` и пишет строки `[Time, Level, Message]`.

## Модульная разметка по ответственности

- `00_MainUi.gs` содержит точки входа пользователя и связывает меню с публичными функциями.
- `10_DriveRepo.gs` и `40_ScanJob.gs` формируют слой обхода Google Drive и пакетной синхронизации.
- `11_SheetsRepo.gs`, `20_View.gs` и `21_DataFormat.gs` отвечают за запись данных, построение витрины и форматирование.
- `12_QrService.gs` реализует отдельный пайплайн преобразования thumbnail в QR-строку.
- `31_Telegram.gs` объединяет Telegram-бота, контакты, sidebar и отправку файлов.
- `90_Utils.gs` содержит изолированный парсер имени PDF, например строка `903(4708)_..._до 28.03.26.pdf` разбирается на `ts`, `route`, `tonnage`, `width` и `until`.

## Конфигурация и переключатели

- Статические константы сосредоточены в `01_Config.gs`: имена листов `SHEET_NAME`, `VIEW_SHEET_NAME`, `LOG_SHEET_NAME`, лимиты `SYNC_CHUNK_ROWS`, `NEW_CHUNK_FILES`, `FILL_MISSING_LIMIT` и флаги `STRICT_SAFE_ROUTE`, `ENABLE_GOQR_FALLBACK`, `DEBUG`.
- Операционные параметры хранятся в Script Properties, а не в коде репозитория: `ROOT_FOLDER_ID`, `STOP_SCAN`, `SYNC_CURSOR`, `TELEGRAM_BOT_TOKEN`, `TELEGRAM_UPDATE_OFFSET`, `TG_DRIVER_FOLDER_ID`, `TG_EMPLOYEE_FOLDER_ID`, `TG_MANAGER_FOLDER_ID`.
- Практический пример: `uiSetRootFolder()` в `00_MainUi.gs` записывает `ROOT_FOLDER_ID`, после чего `getRootFolderId_()` в `10_DriveRepo.gs` начинает сканирование дерева PDF.
- Ещё пример: `tgSetBotToken()` в `31_Telegram.gs` сохраняет `TELEGRAM_BOT_TOKEN`, и тот же ключ затем используется в `tgSendMessage_()` и `tgSendDocument_()`.

## Модель исполнения и данные

- База данных отсутствует; предметные данные живут прямо в Google Sheets на листах `Разрешения`, `Витрина`, `Logs` и `Контакты`.
- Лист `Разрешения` создаётся `ensureSheet_()` в `11_SheetsRepo.gs` и хранит 9 колонок, включая технический `file_id` и `updated_at`.
- Лист `Витрина` собирается `refreshView_()` в `20_View.gs`; там используются скрытые колонки `H:I` для передачи `fileId` и `qrUrl` в Telegram-сценарий.
- Краткоживущее состояние sidebar не пишется в таблицу: `tgOpenSendSidebar()` кладёт выбранные файлы в `CacheService.getUserCache()` на 3600 секунд.

## Локальная разработка и доставка

- Единственный явный инструмент локальной доставки кода в Apps Script - `clasp`, что следует из `.clasp.json`.
- Сборки, transpile-шага и автогенерации кода нет: глобальные функции вызывают друг друга напрямую между файлами.
- Практический пример межфайловой связки: `40_ScanJob.gs` вызывает `listPdfFiles_()` из `10_DriveRepo.gs`, `decodeQrFromPdf_()` из `12_QrService.gs`, `appendRow_()` из `11_SheetsRepo.gs` и `refreshView_()` из `20_View.gs`.
- Автотесты, mock-среда и локальный test harness в репозитории не обнаружены; верификация здесь предполагает ручной запуск в контейнерной таблице.

## Технические выводы для tech-focus

- Стек целиком завязан на Google Apps Script V8 и сервисы Google Workspace; перенос на другой runtime потребует переписывать доступ к Sheets, Drive, trigger и sidebar bridge.
- Самые критичные runtime-зависимости: `SpreadsheetApp`, `DriveApp`, Advanced `Drive.Files`, `UrlFetchApp`, `LockService`, `PropertiesService`, `CacheService`, `HtmlService`, `ImagesService`.
- Главный пользовательский интерфейс - меню Google Sheets из `00_MainUi.gs`; HTML-интерфейс существует только как вспомогательный sidebar в `TelegramSend.html`.
- Проект рассчитан на длительные фоновые операции внутри квот Apps Script, поэтому в стек архитектурно встроены chunking, повторные запуски и хранение курсора в Script Properties.
