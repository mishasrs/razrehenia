# Разрешения

Google Apps Script-проект, привязанный к Google Sheets, который собирает реестр PDF-разрешений из Google Drive, строит рабочую витрину и при необходимости отправляет документы через Telegram.

## Почему bootstrap начинается с Spreadsheet, а не со standalone script

Этот репозиторий рассчитан именно на container-bound Apps Script. Код в `00_MainUi.gs`, `20_View.gs`, `31_Telegram.gs` и `40_ScanJob.gs` опирается на `SpreadsheetApp.getActiveSpreadsheet()`, `SpreadsheetApp.getUi()`, активный лист и sidebar внутри таблицы. Поэтому нормальный bootstrap выглядит так: новый Spreadsheet -> связанный с ним Apps Script container -> локальная `clasp`-привязка. Standalone script не даст тот же контекст меню `Разрешения`, автоматического создания листов и операторского first-run сценария.

## Что нужно до старта

- Google-аккаунт с доступом к папке Drive, где лежат PDF для первого scan.
- Node.js и `npm`.
- `@google/clasp` и локальный логин через `clasp login`.
- Новый пустой Spreadsheet, который станет вашим рабочим контейнером для этого проекта.

## Быстрый happy path: от `git clone` до первого scan

### 1. Склонируйте репозиторий и подготовьте `clasp`

```powershell
git clone <repo-url>
cd Разрешения
npm install -g @google/clasp
clasp login
```

### 2. Создайте новый Spreadsheet и новый Apps Script container

1. Создайте новую Google-таблицу.
2. Откройте в ней `Расширения -> Apps Script`.
3. Сохраните проект. Это создаст новый container-bound script именно для этой таблицы.

Что нужно забрать из интерфейса Google:

- `parentId`: ID таблицы из URL Spreadsheet.
- `scriptId`: ID скрипта из `Project Settings` в редакторе Apps Script.

### 3. Создайте локальную `.clasp`-привязку по шаблону

В репозитории отслеживается только шаблон `./.clasp.example.json`. Рабочий `.clasp.json` должен остаться локальным и не коммитится в Git.

```powershell
Copy-Item .clasp.example.json .clasp.json
```

После копирования замените в локальном `.clasp.json`:

- `YOUR_SCRIPT_ID` -> ваш новый `scriptId`
- `YOUR_SPREADSHEET_ID` -> ID вашего нового Spreadsheet

Остальные поля оставьте как в шаблоне: проект ожидает `rootDir: ""` и загрузку `.gs`/`.html`/`.json` из корня репозитория.

### 4. Отправьте код в новый container и синхронизируйте локальное состояние

```powershell
clasp push -f
clasp pull
```

Что означает этот шаг:

- `clasp push -f` загружает в Apps Script tracked-файлы репозитория, включая `appsscript.json`.
- `clasp pull` после этого служит sanity check: remote уже приведён к состоянию репозитория, и локальная/удалённая surfaces совпадают.

Если на этом шаге не работает `clasp push -f` или завершающий `clasp pull`, не продолжайте first-run: значит, `scriptId`, `parentId` или авторизация заданы неверно.

### 5. Вернитесь в Spreadsheet и обновите страницу

После `clasp push -f` вернитесь в таблицу и обновите вкладку браузера. После перезагрузки должен появиться menu `Разрешения` из `onOpen()` в `00_MainUi.gs`.

### 6. Укажите обязательную базовую настройку: `ROOT_FOLDER_ID`

Обязательная ручная настройка для первого scan только одна:

1. Откройте `Разрешения -> Указать папку с PDF`.
2. Вставьте ID корневой папки Drive, где лежат PDF.
3. Подтвердите сохранение `ROOT_FOLDER_ID`.

Это menu entry point `uiSetRootFolder()` из `00_MainUi.gs`.

ID берётся из URL папки после `/folders/`.

### 7. Запустите первый scan

Предпочтительный путь:

1. Откройте `Разрешения -> Сканировать`.
2. Дождитесь завершения или паузы по времени.

Это menu entry point `scanAndUpdate()` из `40_ScanJob.gs`.

Что делает код в first-run:

- создаёт лист `Разрешения` через `11_SheetsRepo.gs`
- создаёт лист `Logs` через `03_Logging.gs`
- после успешного прохода строит лист `Витрина` через `20_View.gs`
- при длинном проходе может сам поставить installable trigger `continueScan` через `02_RunControl.gs`

Если scan упёрся во временной лимит Apps Script, это нормальный сценарий: код сам ставит продолжение и использует служебный cursor в `SYNC_CURSOR`. Ручных действий для этого не нужно.

### 8. Признаки успешного first-run

После первого рабочего запуска новый maintainer должен увидеть следующее:

- в таблице есть menu `Разрешения`
- сохранён `ROOT_FOLDER_ID`
- созданы листы `Разрешения`, `Logs`, `Витрина`
- в `Logs` появились записи вроде `SCAN start`, `SYNC chunk`, `ADD chunk`, `DONE` или `CONTINUE scheduled`
- в `Витрина` есть ссылка `Открыть папку` на ваш Drive root
- в `Разрешения` появились строки по найденным PDF или как минимум корректные заголовки листа

На этом базовый bootstrap завершён: обязательный scan-path работает без Telegram-настройки.

## Telegram: отдельный условный блок, не часть обязательного bootstrap

Telegram-функции из `31_Telegram.gs` нужны только если вы хотите пользоваться ботом, контактами и рассылкой. Для первого scan они не требуются.

Когда Telegram действительно нужен:

1. Сохраните `TELEGRAM_BOT_TOKEN` через `Разрешения -> Telegram -> Настроить токен бота`.
2. При необходимости задайте `TG_DRIVER_FOLDER_ID`, `TG_EMPLOYEE_FOLDER_ID`, `TG_MANAGER_FOLDER_ID` через `Настроить папки по ролям`.
3. Запустите `Инициализировать меню сотрудников`, чтобы создать лист `Контакты` и подготовить меню бота.
4. Включите `Включить автообработку меню (1 мин)`, если нужен polling trigger `tgProcessEmployeeBotUpdates`.

Если Telegram пока не нужен, этот блок можно полностью пропустить.

## Что читать после happy path

После того как first-run прошёл, откройте `docs/bootstrap-inventory.md`. В нём собран полный inventory обязательных, условных и опциональных зависимостей: `Script Properties`, листы, advanced services, installable triggers и отдельная проверка `ImagesService` для QR pipeline.
