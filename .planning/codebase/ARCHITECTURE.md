# Архитектура

## Общая модель
- Репозиторий реализует один Google Apps Script-проект, который разворачивается из корня через `clasp`; это видно по `appsscript.json`, `.clasp.json` и `.claspignore`.
- Архитектурный стиль здесь ближе к модульному монолиту: весь runtime-код живёт в общем глобальном namespace Apps Script, а разделение на подсистемы задаётся файлами `00_MainUi.gs`, `10_DriveRepo.gs`, `31_Telegram.gs`, `40_ScanJob.gs` и другими.
- Явных import/export-границ нет, поэтому границы модулей поддерживаются соглашением по именам файлов, номерным префиксам и суффиксу `_` у внутренних helper-функций.
- Основной system of record для разрешений находится в листе с именем из `SHEET_NAME` в `01_Config.gs`; производные представления и интеграции читают именно его или данные, собранные из него.
- Производная витрина строится в листе с именем из `VIEW_SHEET_NAME` в `20_View.gs`; это проекция для оператора, а не отдельное хранилище доменных данных.
- Дополнительное доменное состояние хранится в листе `Контакты`, который создаётся и поддерживается кодом из `31_Telegram.gs`.

## Точки входа
- `onOpen()` в `00_MainUi.gs` создаёт верхнеуровневое меню таблицы и публикует операторские сценарии.
- Ручные действия из меню запускают публичные функции `uiSetRootFolder()`, `scanAndUpdate()`, `stopScan()`, `fillMissingQr()`, `refreshView()`, `diagnoseOne()` и Telegram-команды из `31_Telegram.gs`.
- Time-driven продолжение длинного сканирования строится вокруг `continueScan()` в `40_ScanJob.gs`; trigger создаётся функцией `scheduleContinue_()` из `02_RunControl.gs`.
- Автообработка Telegram-бота использует `tgProcessEmployeeBotUpdates()` в `31_Telegram.gs`; периодический trigger регистрирует `tgEnableEmployeeBotPolling()`.
- HTML-сайдбар `TelegramSend.html` работает как тонкий клиент и вызывает серверные функции `tgGetSidebarData()` и `tgSendFromUi(payload)` через `google.script.run`.

## Крупные модули и их ответственность
- `00_MainUi.gs` отвечает только за wiring пользовательского меню и простые UI-действия уровня таблицы, не включая бизнес-логику сканирования.
- `01_Config.gs` централизует имена листов, индексы колонок, лимиты batch-обработки, ключи `PropertiesService` и флаги QR-пайплайна.
- `02_RunControl.gs` изолирует кросс-сценарное управление выполнением: stop-флаг, time budget, удаление старых triggers и планирование продолжения.
- `03_Logging.gs` держит операционное логирование в лист `Logs` и обёртку над `ss.toast(...)`.
- `10_DriveRepo.gs` инкапсулирует поиск корневой папки, обход дерева папок и выборку новых PDF, не смешивая это с разбором имени файла или записью в Sheets.
- `11_SheetsRepo.gs` управляет каноническим листом разрешений: создаёт схему, строит map `file_id -> row`, синхронизирует существующие строки и добавляет новые.
- `12_QrService.gs` является отдельным сервисным слоем для извлечения QR из PDF: получение thumbnail, нормализация изображения, crop-кандидаты и вызовы внешних decoder API.
- `20_View.gs` и `21_DataFormat.gs` образуют слой представления: читают канонические строки, группируют их, строят витрину и применяют форматирование.
- `31_Telegram.gs` реализует самостоятельную интеграционную подсистему: контакты, роли, polling `getUpdates`, отправку документов, sidebar backend и self-service меню сотрудника.
- `40_ScanJob.gs` выступает orchestration-слоем доменного процесса: координирует scan/sync/add/fill/refresh, но не хранит собственную модель данных.
- `90_Utils.gs` содержит чистые функции разбора имени PDF и примитивы работы с датами/числами; это самый близкий к "pure utilities" слой в проекте.

## Основной поток данных
- Ручной запуск идёт по цепочке `00_MainUi.gs` -> `scanAndUpdate()` -> `scanAndUpdateCore_('manual')` в `40_ScanJob.gs`.
- `scanAndUpdateCore_()` берёт `ROOT_FOLDER_ID` через `getRootFolderId_()` из `10_DriveRepo.gs`, получает дерево папок через `collectFolderTreeIds_()` и открывает лист разрешений через `ensureSheet_()` из `11_SheetsRepo.gs`.
- Первая фаза пайплайна вызывает `syncExistingRowsChunked_()` в `11_SheetsRepo.gs`: код перепроверяет `file_id`, удаляет строки для пропавших/вынесенных файлов, чинит rich text ссылки `"PDF"` и `"QR"` и перепарсивает имя файла при переименовании.
- Вторая фаза вызывает `listPdfFiles_()` из `10_DriveRepo.gs`, пропускает уже известные `file_id`, затем для каждого нового PDF запускает `parsePermissionFilename_()` из `90_Utils.gs` и `decodeQrFromPdf_()` из `12_QrService.gs`.
- Запись новой доменной строки идёт только через `appendRow_()` в `11_SheetsRepo.gs`, после чего `40_ScanJob.gs` вызывает `applyDataSheetFormatting_()` из `21_DataFormat.gs`.
- Финал полного прохода обновляет операторскую витрину вызовом `refreshView_()` из `20_View.gs`.

## Поток QR-обработки
- `decodeQrFromPdf_()` в `12_QrService.gs` сначала пытается получить thumbnail из Drive, а не скачивать и рендерить PDF локально.
- `getLargeThumbnail_()` комбинирует несколько стратегий: `https://drive.google.com/thumbnail`, `Drive.Files.get(..., { fields: "thumbnailLink" })` и `file.getThumbnail()`.
- После получения изображения `decodeFromImage_()` сначала пробует `quickChartDecode_()`, затем серию crop-кандидатов из `buildQrCropCandidates_()`, а затем fallback `goQrDecode_()`.
- Постобработка `postFilter_()` отделяет успешное распознавание от шума и может дополнительно фильтровать ссылки по `STRICT_SAFE_ROUTE`.
- Практический пример границы: `40_ScanJob.gs` знает, когда нужен QR, но не знает, как извлекать thumbnail или как устроен fallback между QuickChart и goQR.

## Поток витрины и UI-представления
- `refreshView_()` в `20_View.gs` читает канонические строки через `readDataRows_()`, извлекая не только значения ячеек, но и rich text ссылки из колонок `"Файл"` и `"QR"`.
- `buildView_()` делит строки на группы `active`, `expired` и `noqr`, сортирует их и записывает в новый лист с секциями по ТС.
- Витрина специально пишет скрытые технические колонки `H:I` с `fileId` и `qrUrl`; это контракт между `20_View.gs` и `31_Telegram.gs`.
- Практический пример: `tgReadSelectedFilesFromView_()` в `31_Telegram.gs` полагается на скрытые поля `H:I`, чтобы корректно отправлять документы из сгруппированного листа, где пользователь видит уже не исходную таблицу.

## Telegram-потоки
- Подсистема Telegram имеет два разных сценария: массовая отправка выделенных разрешений через sidebar и self-service бот для сотрудников.
- Массовая отправка идёт по цепочке `tgOpenSendSidebar()` -> `tgReadSelectedFilesFromPermissions_()` или `tgReadSelectedFilesFromView_()` -> `CacheService.getUserCache().put(...)` -> `TelegramSend.html` -> `tgGetSidebarData()` -> `tgSendFromUi(payload)`.
- В `tgSendFromUi(payload)` происходит материализация `DriveApp.getFileById(...)`, сбор caption через `tgBuildCaptionHtml_()` и сетевой вызов `tgSendDocument_()` или `tgSendMessage_()`.
- Self-service сценарий стартует из `tgSyncChatIdsFromUpdates()`: код читает `getUpdates`, обновляет лист `Контакты`, определяет роль и отвечает через `tgHandleEmployeeMenuMessage_()`.
- Привязка роли к документам изолирована в `tgFolderIdForRole_()`; оттуда возвращается role-specific folder или fallback на `ROOT_FOLDER_ID`.

## Хранилища и состояние
- Google Drive является источником входящих PDF и частично источником метаданных файла; эту границу обслуживают `10_DriveRepo.gs`, `12_QrService.gs` и части `31_Telegram.gs`.
- Google Sheets используется одновременно как пользовательский интерфейс, каноническое хранилище и журнал операций.
- Лист из `SHEET_NAME` хранит девять доменных колонок, включая `file_id` и `updated_at`; схема создаётся в `ensureSheet_()` в `11_SheetsRepo.gs`.
- Лист `Logs` обслуживается только `03_Logging.gs`.
- Лист `Контакты` обслуживается `tgEnsureContactsSheet_()` и `tgListContacts_()` из `31_Telegram.gs`.
- `PropertiesService` хранит долгоживущее состояние: `ROOT_FOLDER_ID`, `PROP_STOP_SCAN`, `PROP_SYNC_CURSOR`, `TELEGRAM_BOT_TOKEN` и role-specific folder properties.
- `CacheService` используется точечно в `31_Telegram.gs` для передачи выделения из серверного кода в `TelegramSend.html`; это временный transport, а не долговременное хранилище.

## Границы и зависимости
- Граница между orchestration и persistence проходит между `40_ScanJob.gs` и `11_SheetsRepo.gs`: orchestrator решает порядок шагов, но не пишет ячейки вручную.
- Граница между parsing и scanning проходит между `40_ScanJob.gs` и `90_Utils.gs`: правила разбора имени PDF не размазаны по job-циклу.
- Граница между представлением и данными проходит между `20_View.gs` и `11_SheetsRepo.gs`: витрина пересобирается из каноники и не должна редактироваться как источник истины.
- Наиболее размытая граница у `31_Telegram.gs`: файл объединяет UI backend, чтение Sheets, чтение Drive, работу с кэшем, trigger wiring и прямые HTTP-вызовы к Telegram.
- Внешние сетевые границы сосредоточены в `12_QrService.gs` и `31_Telegram.gs`, где используется `UrlFetchApp`.

## Контроль длинных операций и конкурентного доступа
- `scanAndUpdateCore_()` и `fillMissingQr()` в `40_ScanJob.gs` используют `LockService.getScriptLock()`, чтобы не запускать конкурентную запись в те же листы.
- Ограничение времени инкапсулировано в `timeAlmostUp_()` из `02_RunControl.gs` и опирается на `TIME_BUDGET_MS` и `TIME_BUFFER_MS` из `01_Config.gs`.
- Частичная обработка существующих строк отслеживается через `PROP_SYNC_CURSOR`; это позволяет сканеру продолжать с места остановки, а не начинать заново.
- Кооперативная остановка реализована через `PROP_STOP_SCAN`, который выставляет `stopScan()` из `00_MainUi.gs`, а проверяют горячие циклы в `40_ScanJob.gs` и `02_RunControl.gs`.

## Практические архитектурные выводы
- Если нужно менять логику появления или удаления строк в реестре, смотреть нужно в `40_ScanJob.gs` и `11_SheetsRepo.gs`, а не в `20_View.gs`.
- Если документ есть в Drive, но QR не появляется, цепочка для проверки проходит через `12_QrService.gs` и `fillMissingQr()` в `40_ScanJob.gs`.
- Если отправка из витрины в Telegram теряет связь с исходным PDF, сначала проверяется контракт скрытых колонок `H:I` в `20_View.gs` и чтение их в `tgReadSelectedFilesFromView_()` из `31_Telegram.gs`.
- Если сотрудник видит меню бота, но не получает ссылку на папку, проблема почти наверняка лежит в `tgFolderIdForRole_()` и свойствах `PROP_TG_*_FOLDER_ID` из `31_Telegram.gs`.
