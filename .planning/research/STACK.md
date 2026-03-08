# Исследование: рекомендуемый стек и runtime для проекта в 2026

**Дата:** 2026-03-08

## Вопрос

Какой стек и какие runtime-решения стоит считать рекомендуемыми для дальнейшего сопровождения и эволюции этого brownfield-проекта на Google Apps Script, который:

- читает PDF из Google Drive;
- синхронизирует канонический реестр в Google Sheets;
- извлекает QR;
- строит операторскую витрину;
- отправляет документы через Telegram.

## Короткий вывод

Для текущего milestone правильный выбор в 2026 году: **сохранить production runtime на Google Apps Script V8** и **не выносить основной процесс из связки Sheets + Drive + installable triggers + HtmlService + Telegram Bot API**.

Целевой поддерживаемый стек для этого репозитория:

- **runtime:** Google Apps Script V8 в container-bound проекте;
- **основные сервисы:** `SpreadsheetApp`, `DriveApp`, `ScriptApp`, `PropertiesService`, `CacheService`, `LockService`, `HtmlService`;
- **длинные операции:** chunked execution + installable time-driven triggers + курсор в `Script Properties`;
- **внешние интеграции:** `UrlFetchApp` к Telegram Bot API и QR decode provider'ам;
- **локальная разработка:** `clasp` как мост между репозиторием и Apps Script;
- **операционная база:** стандартный Google Cloud project + Cloud Logging;
- **локальные quality tools:** допустимы как вспомогательный слой, но не как новый runtime.

Это лучше всего совпадает с тем, как уже устроен код в `appsscript.json`, `40_ScanJob.gs`, `12_QrService.gs`, `31_Telegram.gs`, `20_View.gs` и `TelegramSend.html`.

## Что стоит оставить как есть

### 1. Google Apps Script V8 как основной runtime

Оставить `runtimeVersion: "V8"` в `appsscript.json` и не планировать миграцию основной логики на Cloud Run, Functions или отдельный Node.js backend в рамках текущего milestone.

Почему это правильно для этого репозитория:

- `00_MainUi.gs` опирается на `onOpen()` и `SpreadsheetApp.getUi()`;
- почти все потоки используют `SpreadsheetApp.getActiveSpreadsheet()`;
- `40_ScanJob.gs` и `02_RunControl.gs` уже встроили модель продолжения через triggers;
- `31_Telegram.gs` использует `HtmlService` и табличный UI, а не HTTP entrypoint;
- `11_SheetsRepo.gs` и `20_View.gs` делают Sheets одновременно system of record и операторской поверхностью.

Вывод: перенос runtime сейчас дал бы много стоимости миграции и мало пользы для задач надёжности.

**Уверенность:** высокая.

### 2. Container-bound модель

Для этого проекта разумно **оставить container-bound привязку к таблице**, а не переводить систему в standalone-скрипт или отдельное веб-приложение.

Причина в коде:

- меню и operator flow завязаны на активную таблицу в `00_MainUi.gs`;
- листы `Разрешения`, `Витрина`, `Logs`, `Контакты` являются частью продукта, а не просто storage;
- `TelegramSend.html` работает как вспомогательный sidebar внутри таблицы, а не как внешний UI.

Это соответствует характеру bound scripts: они получают специальные методы относительно контейнера и естественно живут рядом с документом.

**Уверенность:** высокая.

### 3. Chunked jobs + triggers + lock

Текущее решение в `40_ScanJob.gs`, `02_RunControl.gs` и `01_Config.gs` нужно сохранять как основную execution model:

- `TIME_BUDGET_MS` и `TIME_BUFFER_MS`;
- `AUTO_CONTINUE` и `CONTINUE_DELAY_MS`;
- `ScriptApp.newTrigger('continueScan')`;
- `LockService.getScriptLock()`;
- курсор `PROP_SYNC_CURSOR`;
- stop-флаг `PROP_STOP_SCAN`.

Это прямо соответствует Apps Script best practices: длинные операции должны дробиться, а конкурентный доступ должен быть сериализован.

**Уверенность:** высокая.

### 4. Script Properties для секрета и операционного состояния

Текущее направление с `PropertiesService` правильное и его надо удержать:

- `ROOT_FOLDER_ID`;
- `TELEGRAM_BOT_TOKEN`;
- `TELEGRAM_UPDATE_OFFSET`;
- role-specific folder ids;
- служебные флаги вроде `STOP_SCAN` и `SYNC_CURSOR`.

Для публичного GitHub-репозитория это особенно важно: секреты и runtime-specific ids не должны переезжать в код.

**Уверенность:** высокая.

### 5. Тонкий HtmlService sidebar

Подход `TelegramSend.html` + `google.script.run` для небольшого UI здесь уместен и должен остаться.

Почему:

- UI маленький и одноцелевой;
- он только читает подготовленные данные и запускает отправку;
- тяжёлой интерактивности, которая оправдывала бы отдельный frontend stack, в проекте нет.

Важно именно сохранить модель "тонкий клиент, толстая серверная логика", которая уже реализована между `TelegramSend.html` и `31_Telegram.gs`.

**Уверенность:** высокая.

## Что стоит подтянуть в текущем milestone

### 1. Перейти на standard Google Cloud project как на обязательную операционную базу

Для сопровождения и публичной готовности проекта лучше считать **standard Cloud project** целевым, даже если код остаётся Apps Script-bound.

Почему это важно именно здесь:

- в `appsscript.json` уже включён `exceptionLogging: "STACKDRIVER"`;
- в `12_QrService.gs` и `31_Telegram.gs` есть внешние HTTP-запросы;
- публичный репозиторий требует более прозрачного управления API, IAM и логами;
- default project хуже подходит для зрелой поддержки и публикационно-готовых сценариев.

Практический вывод: Apps Script остаётся runtime, но облачная операционная опора должна быть стандартной и управляемой командой.

**Уверенность:** высокая.

### 2. Считать Cloud Logging основным журналом, а лист `Logs` оставить операторским

Сейчас есть два слоя наблюдаемости:

- платформенный: `exceptionLogging: "STACKDRIVER"` в `appsscript.json`;
- прикладной: лист `Logs` через `03_Logging.gs`.

Рекомендация:

- **оставить** лист `Logs` для оператора и быстрых ручных проверок;
- **усилить** Cloud Logging как основной источник для диагностики ошибок интеграций, trigger-сбоев и сетевых проблем.

Это снижает риск того, что проблемы в Telegram/QR-потоках останутся только в таблице и потеряются при массовой эксплуатации.

**Уверенность:** высокая.

### 3. Зафиксировать manifest hygiene: scopes и внешний egress

`appsscript.json` сейчас минимален и не фиксирует явно:

- `oauthScopes`;
- `urlFetchWhitelist`.

Для внутреннего bound-script это может работать и без явного описания, но для "public GitHub readiness" лучше считать целевым состояние, где видно:

- какие разрешения реально нужны проекту;
- к каким доменам разрешён внешний `UrlFetchApp`.

Для этого репозитория это особенно относится к вызовам из `12_QrService.gs` и `31_Telegram.gs`.

Примечание: это не срочная блокирующая мера для текущей работы, но правильная tightening-мера перед любой более формальной поставкой или внешней публикацией.

**Уверенность:** средняя.

### 4. Ослабить зависимость QR-пайплайна от конкретных публичных decoder API

Сейчас `12_QrService.gs` жёстко зашивает:

- `https://quickchart.io/qr-read`;
- `https://api.qrserver.com/v1/read-qr-code/`.

Для 2026 это слабое место по надёжности: это не сервисы Google Workspace и не часть гарантированной платформы Apps Script.

Что стоит сделать концептуально:

- оставить внешний decode вне основного runtime;
- считать QR provider слой заменяемым;
- документировать provider order, retry policy и типы отказов;
- собирать отдельную диагностику по доле успешного decode.

Что важно: **не переносить QR-обработку целиком в новый backend сейчас**. Достаточно сначала сделать слой более управляемым и наблюдаемым.

**Уверенность:** высокая.

### 5. Trigger ownership надо сделать командным, а не персональным

В проекте есть installable triggers как минимум для:

- `continueScan()` в `40_ScanJob.gs`;
- `tgProcessEmployeeBotUpdates()` в `31_Telegram.gs`.

Installable triggers в Apps Script исполняются от имени создателя. Поэтому в brownfield-проекте с несколькими сопровождающими надо считать best practice не просто "триггер включён", а "триггер принадлежит устойчивому владельцу".

Практический вывод для этого репозитория:

- контейнерная таблица и связанный Apps Script должны быть под командным владением;
- доступ редакторов нужно расширять осознанно, потому что container-bound проект делит доступ с контейнером;
- не стоит оставлять критичные polling/scan triggers завязанными на личный аккаунт одного человека.

**Уверенность:** высокая.

### 6. Подтянуть режим совместной разработки вокруг `.clasp.json`

Сейчас `.clasp.json` содержит живые `scriptId` и `parentId`. Это не секрет, но это operational binding к реальным прод-артефактам.

Для публичного GitHub-репозитория правильнее считать целевым такой режим:

- `clasp` остаётся основным dev bridge;
- production ids не считаются переносимыми между окружениями;
- локальная привязка к конкретному spreadsheet/script документируется как bootstrap-шаг, а не как "универсальная настройка для всех".

Это tightening-мера на стыке надёжности и public readiness, не смена runtime.

**Уверенность:** высокая.

### 7. Кандидат на обновление: Advanced Drive service v3 вместо v2

В `appsscript.json` включён `Drive` как advanced service версии `v2`, а в `12_QrService.gs` используется `Drive.Files.get(fileId, { fields: "thumbnailLink" })`.

На 2026 это выглядит как место для аккуратной проверки на обновление:

- официальная документация Apps Script по manifest и Drive advanced service уже ориентируется на более современный `v3`;
- при этом текущий код использует очень узкий участок API, что делает миграцию потенциально локальной.

Рекомендация:

- не ломать работающий код вслепую;
- сначала изолировать вызов Drive metadata в одном helper;
- затем сделать узкий regression pass вокруг `thumbnailLink` и смежной логики.

Это не must-have для этого milestone, но разумная техническая подтяжка.

**Уверенность:** средняя.

## Что не стоит вводить сейчас

### 1. Не вводить новый production runtime поверх Apps Script

Не стоит сейчас вводить Cloud Run / Functions / отдельный Node.js backend только ради "современности".

Почему:

- ценность проекта сосредоточена в bound UI и таблице;
- основная логика уже завязана на GAS-сервисы;
- миграция расколет единый операторский контур на несколько поверхностей;
- это не решает автоматически проблемы качества данных, логирования и стабильности QR provider'ов.

**Уверенность:** высокая.

### 2. Не переводить Telegram-бота на webhook в рамках этого milestone

Текущий бот в `31_Telegram.gs` использует `getUpdates` и time-driven polling раз в минуту. Для внутреннего low-volume сценария это разумно.

Почему не стоит тащить webhook сейчас:

- Telegram Bot API не позволяет одновременно использовать `getUpdates` и webhook;
- текущий репозиторий не имеет `doPost()` и не живёт как web app;
- появится новый deployment surface, новая авторизация и новый слой эксплуатации;
- это не основной bottleneck текущего проекта.

Это вывод из сочетания официальной модели Telegram и текущей архитектуры `31_Telegram.gs`, а не универсальный запрет на webhook вообще.

**Уверенность:** высокая.

### 3. Не вводить Apps Script libraries для внутренних модулей

Официальные best practices прямо предупреждают, что библиотеки увеличивают время старта, особенно в UI-heavy сценариях.

Для этого репозитория это плохой tradeoff:

- sidebar в `TelegramSend.html` и так зависит от `google.script.run`;
- разбиение уже сделано по локальным файлам `00_*.gs`, `10_*.gs`, `31_*.gs`, `40_*.gs`;
- вынос внутренних кусков в Apps Script libraries ухудшит latency, но не даст заметного выигрыша.

**Уверенность:** высокая.

### 4. Не вводить тяжёлый frontend stack в HtmlService

Не стоит добавлять React/Vue/Vite/webpack-пайплайн только ради `TelegramSend.html`.

Причины:

- текущий sidebar мал и понятен;
- его жизненный цикл короткий;
- сложность доставки и отладки вырастет сильнее, чем ценность.

Если UI будет расширяться, лучше сначала просто структурировать HTML/CSS/JS внутри HtmlService, а не менять стек фронтенда.

**Уверенность:** высокая.

### 5. Не вводить database layer поверх Sheets на этом этапе

Сейчас `Разрешения` уже являются system of record, а `Витрина` - производным представлением. Добавление Firestore/SQL здесь создаст второй источник истины и усложнит сопровождение.

Пока приоритеты — надёжность, оптимизация и public GitHub readiness — отдельная БД не выглядит оправданной.

**Уверенность:** высокая.

### 6. Не делать service account обязательным по умолчанию

В 2026 у Apps Script уже есть официальный сценарий с service accounts, и он полезен в некоторых shared-project случаях. Но для этого репозитория делать его обязательной частью стека сейчас преждевременно.

Почему:

- проект user-facing и bound к таблице;
- основная работа запускается из UI и installable triggers;
- service account добавит IAM, secret lifecycle и дополнительную эксплуатационную сложность.

Когда вернуться к вопросу:

- если реально начнут ломаться обращения через `ScriptApp.getOAuthToken()` в совместном проекте;
- если потребуется междоменный доступ, не завязанный на конкретного пользователя;
- если проект вырастет в отдельный backend surface.

**Уверенность:** средняя.

### 7. Не строить планы вокруг Node/browser-специфичных runtime-возможностей

Apps Script V8 в 2026 всё ещё не равен Node.js или обычному браузеру:

- нет ES modules через `import`/`export`;
- нет `fetch` и других стандартных Web API в привычном виде;
- нельзя проектировать runtime так, будто это npm-приложение.

Следствие для сопровождения:

- локальные инструменты на Node допустимы;
- production-код должен оставаться GAS-совместимым;
- если когда-нибудь появится TypeScript или bundling, он должен компилироваться в плоский output для `.gs`, а не менять production runtime-модель.

**Уверенность:** высокая.

## Рекомендуемый целевой стек сопровождения

Ниже самый прагматичный целевой вариант для этого репозитория на ближайшие итерации:

| Слой | Рекомендуемый выбор | Почему |
|---|---|---|
| Production runtime | Google Apps Script V8 | Уже совпадает с архитектурой и UI проекта |
| Контейнер | Spreadsheet-bound script | Меню, активная таблица и витрина являются частью продукта |
| Data plane | Google Drive + Google Sheets | Уже реализованы как source + system of record |
| Long-running jobs | Installable time triggers + `LockService` + `Script Properties` cursor | Уже встроено и соответствует ограничениям GAS |
| Internal UI | Menu + HtmlService sidebar | Достаточно для текущего operator flow |
| Telegram transport | `UrlFetchApp` + Bot API через `getUpdates` polling | Подходит для low-volume внутреннего бота |
| QR extraction | Drive thumbnail + внешний decoder provider layer | Не тащить тяжёлый image stack внутрь GAS |
| Secrets/config | `PropertiesService` | Совместимо с публичным GitHub-репозиторием |
| Observability | Cloud Logging + лист `Logs` | Разделение на platform logs и operator logs |
| Local dev | `clasp` + лёгкий Node LTS toolchain | Нужен как tooling, но не как runtime |
| Ownership | Team-owned container + standard Cloud project | Убирает персональную хрупкость вокруг triggers и API |

## Итог по репозиторию

Лучший путь для этого проекта в 2026: **не менять главный runtime**, а довести до зрелого состояния уже существующий контур в `appsscript.json`, `40_ScanJob.gs`, `12_QrService.gs`, `31_Telegram.gs`, `20_View.gs` и `TelegramSend.html`.

То есть:

- **оставить:** GAS V8, container-bound execution, Sheets-first UX, chunked jobs, Script Properties, HtmlService sidebar, `clasp`;
- **подтянуть:** standard Cloud project, Cloud Logging, trigger ownership, manifest hygiene, управляемость QR provider'ов, аккуратную ревизию Drive advanced service;
- **не вводить сейчас:** новый backend runtime, webhook-схему, Apps Script libraries, тяжёлый frontend stack, отдельную БД и обязательный service account.

## Источники

- Google Apps Script Best Practices: https://developers.google.com/apps-script/guides/support/best-practices
- Google Apps Script V8 runtime: https://developers.google.com/apps-script/guides/v8-runtime
- Google Apps Script installable triggers: https://developers.google.com/apps-script/guides/triggers/installable
- Google Apps Script bound scripts: https://developers.google.com/apps-script/guides/bound
- Google Apps Script manifest reference: https://developers.google.com/apps-script/manifest
- Google Apps Script standard Google Cloud projects: https://developers.google.com/apps-script/guides/cloud-platform-projects
- Google Apps Script logging: https://developers.google.com/apps-script/guides/logging
- Google Apps Script service accounts: https://developers.google.com/apps-script/guides/service-accounts
- Google Apps Script + Shared Drives collaboration: https://developers.google.com/apps-script/guides/support/collaborating
- Google Drive advanced service: https://developers.google.com/apps-script/advanced/drive
- Telegram Bot API: https://core.telegram.org/bots/api
