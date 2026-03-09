# Bootstrap Inventory

Этот файл дополняет `README.md`. Сначала пройдите линейный happy path из `README.md`, потом используйте этот inventory как проверочный список по реальным зависимостям кода.

## Легенда статусов

| Статус | Значение |
| --- | --- |
| `обязательно` | Без этого не проходит базовый bootstrap и первый scan |
| `условно` | Нужно только для длинных прогонов, QR или Telegram-сценариев |
| `опционально` | Служебная сущность появляется не всегда и не должна настраиваться вручную |

## 1. `Script Properties`

### 1.1 Maintainer-set properties

| Key | Статус | Кто задаёт | Кто использует | Как проверить наличие |
| --- | --- | --- | --- | --- |
| `ROOT_FOLDER_ID` | `обязательно` | maintainer через `uiSetRootFolder()` в `00_MainUi.gs` | `10_DriveRepo.gs`, `20_View.gs`, `31_Telegram.gs` | После сохранения работает `Разрешения -> Сканировать`, а в листе `Витрина` появляется ссылка `Открыть папку` |
| `TELEGRAM_BOT_TOKEN` | `условно` | maintainer через `tgSetBotToken()` в `31_Telegram.gs` | `31_Telegram.gs` для `setMyCommands`, `getUpdates`, `sendMessage`, `sendDocument` | `tgInitEmployeeBot()` и `tgSetupEmployeeBotMenu()` выполняются без ошибки `Не задан TELEGRAM_BOT_TOKEN.` |
| `TG_DRIVER_FOLDER_ID` | `условно` | maintainer через `tgSetRoleFolders()` в `31_Telegram.gs` | `tgFolderIdForRole_()` в `31_Telegram.gs` | Для роли `водитель` бот отдаёт ссылку на отдельную папку, а не только fallback на `ROOT_FOLDER_ID` |
| `TG_EMPLOYEE_FOLDER_ID` | `условно` | maintainer через `tgSetRoleFolders()` в `31_Telegram.gs` | `tgFolderIdForRole_()` в `31_Telegram.gs` | Для роли `сотрудник` бот отдаёт корректную папку документов |
| `TG_MANAGER_FOLDER_ID` | `условно` | maintainer через `tgSetRoleFolders()` в `31_Telegram.gs` | `tgFolderIdForRole_()` в `31_Telegram.gs` | Для роли `руководитель` бот отдаёт корректную папку документов |

### 1.2 Runtime-owned properties

Эти ключи пишет сам код. Их не нужно создавать вручную при bootstrap.

| Key | Статус | Кто создаёт/очищает | Кто использует | Как проверить наличие |
| --- | --- | --- | --- | --- |
| `STOP_SCAN` | `опционально` | `stopScan()` в `00_MainUi.gs`, `clearStopFlag_()` в `02_RunControl.gs` | `shouldStop_()` и `scanAndUpdateCore_()` | После `Разрешения -> Стоп` scan прекращается, в `Logs` есть запись про `STOP`, а при новом `scanAndUpdate()` флаг очищается автоматически |
| `SYNC_CURSOR` | `условно` | `syncExistingRowsChunked_()` в `11_SheetsRepo.gs` | `scanAndUpdateCore_()` через chunked sync | На длинном scan в `Logs` видны `SYNC chunk` и `CONTINUE scheduled`; вручную этот key не заполняется |
| `TELEGRAM_UPDATE_OFFSET` | `условно` | `tgSyncChatIdsFromUpdates()` в `31_Telegram.gs` | тот же polling/getUpdates flow в `31_Telegram.gs` | После первого `tgSyncChatIdsFromUpdates()` или `tgProcessEmployeeBotUpdates()` бот перестаёт повторно обрабатывать старые updates |

## 2. Листы Spreadsheet

| Лист | Статус | Кто создаёт | Кто использует | Как maintainer проверяет |
| --- | --- | --- | --- | --- |
| `Разрешения` | `обязательно` | `ensureSheet_()` в `11_SheetsRepo.gs` | `40_ScanJob.gs`, `20_View.gs`, `31_Telegram.gs` | После первого scan существует лист с колонками `ТС`, `Маршрут`, `Тоннаж`, `Ширина`, `До`, `Файл`, `QR`, `file_id`, `updated_at` |
| `Logs` | `обязательно` | `ensureLogSheet_()` в `03_Logging.gs` | `log_()` из scan, QR и Telegram потоков | После first-run существует лист с заголовками `Time`, `Level`, `Message` и записями `SCAN start`, `SYNC chunk`, `ADD chunk`, `DONE` |
| `Витрина` | `обязательно` | `ensureViewSheet_()` в `20_View.gs` | операторский просмотр и Telegram sidebar selection | После завершённого scan существует лист `Витрина` со ссылкой `Открыть папку` и сводкой по активным/истекшим/без QR |
| `Контакты` | `условно` | `tgEnsureContactsSheet_()` в `31_Telegram.gs` | employee-bot роли, polling и рассылка | После `tgInitEmployeeBot()` или ручного добавления контакта появляется лист `Контакты` с колонками `Имя`, `chat_id`, `Активен`, `Роль` |

## 3. Advanced services и platform dependencies

| Зависимость | Статус | Source of truth | Где используется | Как проверить |
| --- | --- | --- | --- | --- |
| Container-bound Spreadsheet | `обязательно` | сам bootstrap-path из `README.md` | `00_MainUi.gs`, `20_View.gs`, `31_Telegram.gs`, `40_ScanJob.gs` | После `clasp push -f` и обновления таблицы появляется menu `Разрешения`; standalone script здесь не считается валидным bootstrap |
| Advanced `Drive` service `v2` | `обязательно` | `appsscript.json` | `Drive.Files.get(...thumbnailLink...)` в `12_QrService.gs` | В `appsscript.json` есть `enabledAdvancedServices` для `Drive`, а QR flow не падает на обращении к `Drive.Files.get` |
| `UrlFetchApp` | `условно` | встроенный Apps Script runtime | `12_QrService.gs` для QuickChart/goQR и `31_Telegram.gs` для Bot API | При первом авторизованном запуске QR или Telegram flow не падает на сетевом вызове |
| `HtmlService` + `CacheService` | `условно` | встроенный Apps Script runtime | sidebar `tgOpenSendSidebar()` и `tgGetSidebarData()` в `31_Telegram.gs` | `Разрешения -> Telegram -> Отправить в Telegram (по выделению)` открывает sidebar без ошибок |
| `ImagesService` | `условно`, но требует явной проверки | в tracked manifest не зафиксирован | `buildQrCropCandidates_()`, `cropRel_()`, `normalizeImage_()` в `12_QrService.gs` | После bootstrap выполните отдельную QR-проверку из чеклиста ниже; отсутствие ошибок в manifest само по себе недостаточно |

### Почему `ImagesService` вынесен отдельным пунктом

QR pipeline в `12_QrService.gs` использует `ImagesService.openImage(...)` для crop/resize, но происхождение этой зависимости не видно в `appsscript.json`. Поэтому bootstrap нельзя считать полностью проверенным только по manifest и `clasp push`: нужен явный runtime-check на реальном PDF.

## 4. Installable triggers

Installable triggers принадлежат аккаунту, который их создал. Новый maintainer должен пересоздавать их под своим аккаунтом, а не полагаться на старого владельца проекта.

| Trigger function | Статус | Кто создаёт | Когда появляется | Как проверить |
| --- | --- | --- | --- | --- |
| `continueScan` | `условно` | `scheduleContinue_()` в `02_RunControl.gs` | автоматически, если `scanAndUpdate()` упирается во временной лимит | В Apps Script `Triggers` виден time-based trigger на `continueScan`, а в `Logs` есть `CONTINUE scheduled (...)` |
| `tgProcessEmployeeBotUpdates` | `условно` | `tgEnableEmployeeBotPolling()` в `31_Telegram.gs` | только если нужен polling employee-бота | В Apps Script `Triggers` есть минутный trigger на `tgProcessEmployeeBotUpdates`; после `tgDisableEmployeeBotPolling()` он исчезает |

## 5. Что именно проверять после bootstrap

### Базовый scan-path

1. `README.md` пройден до шага с `uiSetRootFolder()` и `scanAndUpdate()`.
2. В Spreadsheet существуют `Разрешения`, `Logs`, `Витрина`.
3. В `Logs` есть записи хотя бы про старт scan и один завершённый или продолженный chunk.
4. В `Витрина` отображается ссылка на ваш Drive root, а не сообщение `не задана (меню -> ROOT_FOLDER_ID)`.

### Длинный scan-path

1. Если scan не уложился в лимит Apps Script, в `Logs` появилась запись `CONTINUE scheduled`.
2. В списке installable triggers под вашим аккаунтом появился `continueScan`.
3. `SYNC_CURSOR` воспринимается как служебный runtime key; вручную его не задавайте и не очищайте без необходимости.

### Telegram-only path

1. После `tgSetBotToken()` нет ошибки про пустой `TELEGRAM_BOT_TOKEN`.
2. После `tgInitEmployeeBot()` создан лист `Контакты`.
3. После `tgEnableEmployeeBotPolling()` появился trigger `tgProcessEmployeeBotUpdates`.
4. Если роль папки не задана, текущее поведение кода делает fallback на `ROOT_FOLDER_ID`; учитывайте это как текущее поведение, а не как обязательный bootstrap-шаг.

### Явная проверка QR и `ImagesService`

1. Возьмите один реальный PDF, где QR точно есть.
2. Запустите `Разрешения -> Тест: 1 файл` или `diagnoseOne()` из `40_ScanJob.gs`.
3. Ожидаемый результат: QR распознан, либо как минимум в `Logs` нет ошибок вида `ImagesService is not defined` / проблем на `ImagesService.openImage(...)`.
4. Если QR flow ломается на `ImagesService`, считайте bootstrap неполным, даже если `appsscript.json` и `Drive` advanced service выглядят корректно.

## 6. Что не нужно делать вручную

- Не создавайте вручную `STOP_SCAN`, `SYNC_CURSOR` и `TELEGRAM_UPDATE_OFFSET`.
- Не делайте Telegram обязательным шагом до первого scan.
- Не стартуйте проект как standalone script: для этого репозитория нормальный режим только container-bound Spreadsheet.
- Не считайте `appsscript.json` исчерпывающим inventory всех runtime-зависимостей: QR flow требует отдельной проверки `ImagesService`.
