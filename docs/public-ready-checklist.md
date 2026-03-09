# Public-ready checklist

Используйте этот checklist перед публикацией репозитория и после любых правок в bootstrap/config/docs surface: `README.md`, `.clasp.example.json`, `.claspignore`, `appsscript.json`, `docs/*`, `scripts/check-public-surface.ps1` и tracked runtime-файлах.

Опорные документы:

- `README.md`
- `docs/repository-sanitization.md`
- `docs/bootstrap-inventory.md`
- `scripts/check-public-surface.ps1`

## 1. Подтвердить tracked surface

- [ ] Рабочая привязка `.clasp.json` не отслеживается: `git ls-files --error-unmatch .clasp.json` должен завершиться ошибкой.
- [ ] В tracked surface есть только шаблон `.clasp.example.json`, правила `.claspignore` и manifest `appsscript.json`.
- [ ] Для спорных мест проверка идёт по выводу `git ls-files`, а не только по upload-surface `clasp push`.

## 2. Проверить placeholders и config templates

- [ ] В `.clasp.example.json` остались `YOUR_SCRIPT_ID` и `YOUR_SPREADSHEET_ID`.
- [ ] `.claspignore` по-прежнему ограничивает push surface runtime-файлами и не маскирует утечки в markdown/config.
- [ ] `appsscript.json` отражает реальный tracked manifest: как минимум `Drive` advanced service `v2` и `V8` runtime.

## 3. Проверить tracked code, docs и другие артефакты

- [ ] В `.gs`, `.html`, `.json`, `.md`, `.ps1`, `.yaml`, `.yml`, `.txt` из `git ls-files` нет live `scriptId`, `parentId`, Drive folder IDs, Spreadsheet IDs, Telegram token, chat IDs и production-ссылок.
- [ ] `README.md` ведёт по текущему bootstrap-path и не подсказывает reuse чужого production-container.
- [ ] Документы в `docs/` описывают тот же public surface, что и код: `.clasp.example.json`, `.claspignore`, `appsscript.json`, `ROOT_FOLDER_ID`, `TELEGRAM_BOT_TOKEN`, `TG_*_FOLDER_ID`, `continueScan`, `tgProcessEmployeeBotUpdates`.
- [ ] Если правки затронули другие tracked docs или скрипты, они тоже просмотрены как часть public surface, а не исключены из proof по привычке.

## 4. Сверить inventory с реальным кодом

- [ ] `docs/bootstrap-inventory.md` всё ещё соответствует коду в `00_MainUi.gs`, `11_SheetsRepo.gs`, `12_QrService.gs`, `20_View.gs`, `31_Telegram.gs`, `40_ScanJob.gs`.
- [ ] В inventory не перепутаны maintainer-set и runtime-owned keys: `ROOT_FOLDER_ID` остаётся ручным шагом, а `STOP_SCAN`, `SYNC_CURSOR`, `TELEGRAM_UPDATE_OFFSET` не превращены в manual setup.
- [ ] Telegram остаётся условным блоком после первого scan, а не обязательной частью happy path.

## 5. Отдельно проверить QR и `ImagesService`

- [ ] Если менялись QR flow, bootstrap или inventory, выполнена явная проверка из `docs/bootstrap-inventory.md` на реальном PDF с QR.
- [ ] В runtime нет ошибок вида `ImagesService is not defined` или падений на `ImagesService.openImage(...)`.
- [ ] Если этот пункт не проверен, bootstrap нельзя считать полностью подтверждённым только по `appsscript.json` и `Drive.Files.get(...)`.

## 6. Запустить automated proof

- [ ] Выполнена команда `powershell -ExecutionPolicy Bypass -File scripts/check-public-surface.ps1`.
- [ ] Скрипт завершился сообщением `Public surface audit passed.` без замечаний по tracked docs/config/code.
- [ ] Если audit нашёл live binding или docs drift, публикация блокируется до исправления tracked surface.
