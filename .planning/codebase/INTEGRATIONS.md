# Внешние интеграции

**Дата анализа:** 2026-03-08

## Карта интеграций

- Основной контур интеграций проходит через Google Sheets, Google Drive, Telegram Bot API и два внешних QR-сервиса.
- Все исходящие сетевые вызовы выполняются из Apps Script через `UrlFetchApp.fetch(...)` в `12_QrService.gs` и `31_Telegram.gs`.
- Входящие пользовательские действия приходят либо из меню таблицы `onOpen()` в `00_MainUi.gs`, либо из sidebar `TelegramSend.html` через `google.script.run`, либо из time-based trigger.
- Внешней базы данных, webhook endpoint и стороннего auth-провайдера в репозитории нет.

## Google Sheets как UI и хранилище

- Таблица является главным интерфейсом и главным persistent storage проекта.
- `11_SheetsRepo.gs` создаёт и поддерживает лист `Разрешения` со столбцами `ТС`, `Маршрут`, `Тоннаж`, `Ширина`, `До`, `Файл`, `QR`, `file_id`, `updated_at`.
- `20_View.gs` строит лист `Витрина`, где данные группируются по ТС и дополнительно публикуются скрытые колонки `H:I` для `fileId` и `qrUrl`.
- `03_Logging.gs` использует лист `Logs` как операционный журнал для ошибок и прогресса.
- `31_Telegram.gs` создаёт лист `Контакты` и хранит там `Имя`, `chat_id`, `Активен`, `Роль`.
- Практический пример обмена: `appendRow_()` в `11_SheetsRepo.gs` пишет ссылку на PDF как rich text `PDF`, а `tgReadSelectedFilesFromPermissions_()` в `31_Telegram.gs` потом читает ту же строку и превращает её в payload для отправки.

## Google Drive

- Корневая интеграция с файлами строится вокруг `ROOT_FOLDER_ID`, который вводится через `uiSetRootFolder()` в `00_MainUi.gs` и читается функцией `getRootFolderId_()` в `10_DriveRepo.gs`.
- `10_DriveRepo.gs` обходит дерево папок через `DriveApp.getFolderById(...)`, `folder.getFolders()` и `folder.getFilesByType(MimeType.PDF)`.
- `40_ScanJob.gs` использует `DriveApp.getFolderById(rootId)` как источник новых PDF и `DriveApp.getFileById(fileId)` для повторной проверки существующих строк.
- `31_Telegram.gs` получает blob через `DriveApp.getFileById(...).getBlob()` перед вызовом Telegram `sendDocument`.
- `20_View.gs` и `31_Telegram.gs` формируют Drive URL вида `https://drive.google.com/drive/folders/<id>` для открытия общей папки и папок по ролям.
- Практический пример: `tgFolderIdForRole_()` в `31_Telegram.gs` выбирает `TG_DRIVER_FOLDER_ID` или другой role-specific ключ, а при его отсутствии откатывается к `ROOT_FOLDER_ID`.

## Advanced Drive API и thumbnail pipeline

- В `appsscript.json` включён Advanced Service `Drive` v2; он реально используется в `12_QrService.gs`.
- `fetchDriveThumbnailFromThumbnailLink_()` вызывает `Drive.Files.get(fileId, { fields: "thumbnailLink" })`, а затем достраивает URL thumbnail нужного размера.
- `fetchDriveThumbnailByIdEndpoint_()` использует прямой endpoint `https://drive.google.com/thumbnail?id=<fileId>&sz=w2000` или `...&sz=s2000`.
- `fetchImageUrlAsBlob_()` отправляет HTTP GET с заголовком `Authorization: Bearer ${ScriptApp.getOAuthToken()}`; это важная точка обмена между Apps Script OAuth и Drive HTTP API.
- Если thumbnail не подошёл, `getLargeThumbnail_()` пробует `file.getThumbnail()`; дальше `ImagesService` нормализует изображение для декодирования QR.

## Telegram Bot API

- Telegram-интеграция целиком реализована в `31_Telegram.gs` прямыми HTTP-вызовами к `https://api.telegram.org/bot<TOKEN>/...`.
- Используются методы `setMyCommands`, `getUpdates`, `sendDocument` и `sendMessage`.
- Секрет `TELEGRAM_BOT_TOKEN` хранится в Script Properties под ключом `PROP_TG_TOKEN`; его задаёт `tgSetBotToken()`.
- Бот работает по polling-модели: `tgSyncChatIdsFromUpdates()` читает `getUpdates`, а смещение хранится в `TELEGRAM_UPDATE_OFFSET`.
- `tgEnableEmployeeBotPolling()` создаёт минутный trigger `tgProcessEmployeeBotUpdates`, так что внешний транспорт Telegram опрашивается по расписанию, а не через webhook.
- Практический пример: при `/docs` функция `tgHandleEmployeeMenuMessage_()` вызывает `tgSendDocsFolder_()`, которая отправляет пользователю ссылку на Drive-папку для его роли.
- Второй сценарий Telegram - ручная рассылка выбранных PDF из sidebar: `tgSendFromUi()` проходит по `chatIds` и `files`, отправляет `sendDocument`, а QR добавляет в caption через `tgBuildCaptionHtml_()`.

## Внешние QR-сервисы

- Основной внешний сервис QR-декодирования: `https://quickchart.io/qr-read`, вызывается функцией `quickChartDecode_()` в `12_QrService.gs`.
- Резервный внешний сервис: `https://api.qrserver.com/v1/read-qr-code/`, вызывается `goQrDecode_()` при `ENABLE_GOQR_FALLBACK = true` в `01_Config.gs`.
- Обе интеграции работают без отдельной авторизации; данные передаются как base64 JSON или multipart blob.
- В проекте предусмотрены ретраи: `QC_TRIES` и `GOQR_TRIES` из `01_Config.gs`, плюс `Utilities.sleep(...)` между попытками.
- Практический пример: `decodeFromImage_()` сначала пробует full image через QuickChart, затем crop-кандидаты, и только потом переключается на goQR.

## Хранилища состояния и ключи обмена

- Постоянное конфигурационное хранилище: `PropertiesService.getScriptProperties()`.
- Ключи верхнего уровня: `ROOT_FOLDER_ID`, `STOP_SCAN`, `SYNC_CURSOR`, `TELEGRAM_BOT_TOKEN`, `TELEGRAM_UPDATE_OFFSET`, `TG_DRIVER_FOLDER_ID`, `TG_EMPLOYEE_FOLDER_ID`, `TG_MANAGER_FOLDER_ID`.
- Краткоживущее хранилище UI: `CacheService.getUserCache()` с ключом `TG_LAST_FILES_JSON`.
- Табличное хранилище контактов: лист `Контакты`, которым управляют `tgEnsureContactsSheet_()` и `tgListContacts_()`.
- Предметные данные синхронизации живут на листе `Разрешения`; техническая связка с Drive строится через колонку `file_id`, а связка с QR - через rich text ссылку в колонке `QR`.

## Аутентификация и контроль доступа

- Доступ к Google Sheets, Drive, trigger и cache обеспечивается учётной записью, под которой выполняется Apps Script; отдельного OAuth-клиента в репозитории нет.
- Для HTTP-доступа к thumbnail Drive используется runtime-токен `ScriptApp.getOAuthToken()` в `12_QrService.gs`.
- Для Telegram используется общий bot token, сохранённый в Script Properties; другие секреты в репозитории не обнаружены.
- Ролевая авторизация сотрудников реализована на уровне данных, а не на уровне внешнего IAM: `tgNormalizeRole_()`, `tgIsRoleAllowed_()` и лист `Контакты` определяют, кому можно отправить папку документов.
- Практический пример: если контакт неактивен, `tgSendEmployeeMenu_()` и `tgSendDocsFolder_()` отвечают сообщением о закрытом доступе вместо выдачи ссылки.

## Trigger и источники событий

- `onOpen()` в `00_MainUi.gs` создаёт меню и открывает ручные entrypoint для всех сценариев.
- `scheduleContinue_()` в `02_RunControl.gs` создаёт delayed trigger `continueScan` для продолжения фонового сканирования Drive.
- `tgEnableEmployeeBotPolling()` в `31_Telegram.gs` создаёт recurring trigger `tgProcessEmployeeBotUpdates` с интервалом в одну минуту.
- `TelegramSend.html` инициирует `tgGetSidebarData()` при загрузке и вызывает `tgSendFromUi(...)` при клике на кнопку отправки.
- Входящих webhooks нет: в кодовой базе отсутствуют `doGet()` и `doPost()`, поэтому весь внешний вход Telegram строится только на polling `getUpdates`.

## Точки обмена данными

- `Drive PDF -> parse -> sheet row`:
  - `listPdfFiles_()` в `10_DriveRepo.gs` возвращает новые PDF.
  - `parsePermissionFilename_()` в `90_Utils.gs` извлекает `ts`, `route`, `tonnage`, `width`, `until`.
  - `decodeQrFromPdf_()` в `12_QrService.gs` пытается получить QR-строку.
  - `appendRow_()` в `11_SheetsRepo.gs` пишет запись в лист `Разрешения`.
- `Sheet row -> view row -> sidebar payload`:
  - `refreshView_()` в `20_View.gs` копирует `fileId` и `qrUrl` в скрытые столбцы `H:I`.
  - `tgReadSelectedFilesFromView_()` в `31_Telegram.gs` собирает payload по выделенным строкам.
  - `tgOpenSendSidebar()` кладёт payload в `CacheService`.
- `Sidebar payload -> Telegram network call`:
  - `TelegramSend.html` отправляет `{ files, chatIds, withPdf, withQr }`.
  - `tgSendFromUi()` получает blob из Drive и вызывает `tgSendDocument_()` или `tgSendMessage_()`.
- `Telegram update -> contacts registry`:
  - `tgSyncChatIdsFromUpdates()` читает `getUpdates`.
  - `tgExtractUpdateMessage_()` нормализует входящее событие.
  - `tgAppendContact_()` или обновление строки на листе `Контакты` закрепляют `chat_id`.

## Сетевые зависимости и операционные риски

- Все внешние сети зависят от доступности `UrlFetchApp`; при сбоях код использует `muteHttpExceptions: true` и сам проверяет `resp.getResponseCode()`.
- QR-пайплайн зависит сразу от трёх сетевых звеньев: Drive thumbnail endpoint, QuickChart и goQR.
- Telegram-рассылка зависит от `DriveApp.getFileById()` и размера blob, потому что PDF сначала читается из Drive, а потом отправляется в `sendDocument`.
- Для снижения rate-limit риска в `31_Telegram.gs` используется `TG_THROTTLE_MS = 350` и `Utilities.sleep(TG_THROTTLE_MS)` между сообщениями.
- Для снижения дублирования Telegram polling хранит `TELEGRAM_UPDATE_OFFSET`; без этого ключа `getUpdates` начал бы повторно возвращать уже обработанные события.

## Практические примеры payload и ключей

```json
{
  "scriptProperties": [
    "ROOT_FOLDER_ID",
    "TELEGRAM_BOT_TOKEN",
    "TELEGRAM_UPDATE_OFFSET",
    "TG_DRIVER_FOLDER_ID"
  ]
}
```

```js
// payload, который `TelegramSend.html` отправляет в `tgSendFromUi()` из `31_Telegram.gs`
{
  files: [{ sourceSheet: "Витрина", rowIndex: 12, fileId: "drive-file-id", qrUrl: "https://..." }],
  chatIds: ["123456789"],
  withPdf: true,
  withQr: true
}
```

## Технические выводы для tech-focus

- Ключевая внешняя зависимость проекта - Google Workspace: без контейнерной таблицы, Drive-папки и Script Properties приложение не функционирует.
- Самая чувствительная сеть - связка `Drive thumbnail -> QuickChart/goQR`, потому что она влияет на заполнение QR при синхронизации и дозаполнении.
- Telegram интегрирован в двух режимах: автоматический polling-бот для сотрудников и ручная массовая отправка выделенных файлов из sidebar.
- Архитектурно обмен данными строится вокруг Drive `fileId`, табличных строк и Script Properties; это главные точки, которые нужно учитывать при любом дальнейшем расширении.
