# Phase 1: Публичный GitHub и bootstrap - Research

**Researched:** 2026-03-09
**Domain:** Публичный Google Apps Script-репозиторий, container-bound bootstrap и sanitization policy
**Confidence:** MEDIUM

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

#### Sanitization репозитория
- В Git остаются только обезличенные шаблоны конфигурации; рабочий `.clasp.json` считается сугубо локальным файлом и не должен отслеживаться.
- Live `scriptId`, `parentId`, Drive folder ids и любые другие production-привязки считаются operational-данными и должны вычищаться из tracked файлов так же, как секреты.
- Публичные примеры значений должны использовать явные плейсхолдеры вроде `YOUR_SCRIPT_ID` и `YOUR_SPREADSHEET_ID`, а не реальные или реалистично-похожие live значения.
- Политика sanitization фиксируется как постоянное правило репозитория, а не как разовая подготовка к первой публикации.

#### Bootstrap-путь нового maintainer
- Нормальный bootstrap-сценарий начинается с нового Spreadsheet и связанного Apps Script-контейнера maintainer, а не с reuse существующего production-контейнера.
- Bootstrap строится как смешанный путь: maintainer вручную создаёт свой контейнер, настраивает `clasp`-привязку и базовые свойства, а дальше идёт по документированным menu/first-run действиям текущего скрипта.
- Основной bootstrap-документ должен быть линейным quickstart со стабильным happy path от `git clone` до первого рабочего запуска.
- Bootstrap считается завершённым, когда maintainer может открыть меню, указать `ROOT_FOLDER_ID`, запустить первый scan и увидеть корректное поднятие обязательных листов и логов.

#### Операционный манифест bootstrap
- В bootstrap-документации обязательные сущности группируются по типам: `Script Properties`, листы, advanced services и installable triggers.
- Для каждого пункта явно показывается статус `обязательно`, `условно` или `опционально`; phase 1 не должна прятать различие между базовым scan-path и Telegram-зависимыми частями.
- Installable triggers документируются отдельной таблицей с именем функции, моментом создания и назначением.
- Листы и platform-зависимости вроде advanced `Drive` service фиксируются в компактном inventory-блоке: что существует, кто это создаёт и на каком шаге это проверяется.

#### Proof публичной готовности
- Главный proof для BOOT-03 — короткий checklist в самом репозитории плюс явный audit-проход maintainer перед публикацией или обновлением публичной версии.
- Proof должен жить в публичной документации репозитория, а не только в голове maintainer или во внешнем release-процессе.
- Проверка охватывает tracked код, шаблоны конфигурации и bootstrap/docs, а не только `.clasp*` или только runtime-файлы.
- Порог готовности жёсткий: в tracked файлах и docs не должно оставаться live ids, secrets и production-связок; bootstrap должен опираться только на обезличенные шаблоны и описанный путь настройки.

### Claude's Discretion
- Конкретное разбиение phase-1 документации по файлам, если оно сохраняет линейный quickstart и отдельный inventory/checklist.
- Формулировки checklist и названия разделов, если они не размывают жёсткое правило `no live bindings in Git`.
- Точный порядок второстепенных setup-шагов после базовой `clasp`-привязки, если он всё ещё ведёт к первому рабочему scan.

### Deferred Ideas (OUT OF SCOPE)

Нет — обсуждение осталось в пределах фазы 1.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| BOOT-01 | Разработчик может привязать локальную копию репозитория к своему Apps Script/Spreadsheet через обезличенный пример конфигурации без публикации live `scriptId` и `parentId` в Git | Канонический bootstrap должен использовать `clasp` для создания локального binding, а `.clasp.example.json` оставить tracked-шаблоном и схемой ожидаемых полей. |
| BOOT-02 | Maintainer может по русской инструкции восстановить обязательные `Script Properties`, нужные листы, advanced services и installable triggers без скрытых ручных шагов | Нужен отдельный inventory по четырём типам сущностей с явным статусом `обязательно` / `условно` / `опционально`, ownership и шагом проверки. |
| BOOT-03 | Публичный репозиторий хранит только обезличенные конфигурационные примеры и не содержит отслеживаемых live secrets, operational ids или привязок к production-окружению | Нужны постоянная sanitization policy, tracked-surface audit через `git grep`/`git ls-files` и публичный checklist в самом репозитории. |
</phase_requirements>

## Summary

Эту фазу нужно планировать как фазу публичного контракта репозитория, а не как rewrite runtime. Кодовая база уже содержит почти все bootstrap-опоры: `.clasp.example.json`, `.claspignore`, `appsscript.json`, menu entry points в `00_MainUi.gs`, автосоздание листов в `11_SheetsRepo.gs`, `03_Logging.gs`, `20_View.gs`, `31_Telegram.gs` и lifecycle installable triggers в `02_RunControl.gs` и `31_Telegram.gs`. Значит основная работа planner не в изобретении нового bootstrap-механизма, а в закреплении безопасного пути, описывающего то, что уже является source of truth в репозитории.

Ключевая инженерная граница здесь двойная. Первая поверхность риска: публичный Git, где нельзя хранить live `scriptId`, `parentId`, folder IDs, bot token и другие operational bindings. Вторая поверхность риска: bootstrap drift, когда новый maintainer не знает, какие свойства, листы, manifest-зависимости и triggers нужны для первого рабочего запуска. Из этого следует, что phase 1 должна выпустить не один markdown-файл, а целый минимальный public doc-set: входной `README.md`, линейный `docs/BOOTSTRAP.md`, отдельный `docs/BOOTSTRAP_INVENTORY.md` и `docs/PUBLIC_READY.md` с audit-checklist.

Отдельно важно не перепутать две разные политики. `.claspignore` ограничивает то, что уходит в Apps Script при `clasp push`; это полезно, но не решает BOOT-03. Public-ready состояние надо проверять по tracked-файлам Git, а не по upload-surface `clasp`. Именно поэтому phase 1 должна закрепить deterministic audit поверх `git ls-files` и `git grep`, а не пытаться решить задачу только через `clasp` или только через ручной просмотр нескольких конфигов.

**Primary recommendation:** планируй phase 1 как выпуск четырёх публичных артефактов и одного постоянного правила репозитория: `README.md`, `docs/BOOTSTRAP.md`, `docs/BOOTSTRAP_INVENTORY.md`, `docs/PUBLIC_READY.md` плюс жёсткая policy `no live bindings in Git`.

## Standard Stack

### Core

| Library / Service | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Google Apps Script runtime | `V8` | Основной runtime проекта | Уже зафиксирован в `appsscript.json` и соответствует текущему `.gs`-коду. |
| Container-bound Spreadsheet project | platform | Каноническая форма окружения | Проект массово использует `SpreadsheetApp.getActiveSpreadsheet()`, `getUi()` и `HtmlService` sidebar. |
| `@google/clasp` | not pinned in repo | Локальная привязка и синхронизация кода | Это официальный CLI для локальной разработки Apps Script; именно он создаёт/держит локальный `.clasp.json`. |
| `appsscript.json` | tracked manifest | Source of truth для runtime, timezone и advanced services | Уже присутствует в репозитории и должен оставаться частью bootstrap-контракта. |

### Supporting

| Tool / Capability | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `.clasp.example.json` | tracked template | Безопасный пример структуры локальной привязки | Всегда как reference/template; никогда как live binding в Git. |
| `.claspignore` | tracked rules | Ограничение upload-surface для `clasp push` | Всегда; особенно если в репозитории появятся новые вспомогательные файлы. |
| Script Properties | platform | Хранение runtime-конфигурации и секретов вне Git | Всегда для `ROOT_FOLDER_ID`, Telegram token и служебных курсоров. |
| Advanced `Drive` service | `v2` | Доступ к `Drive.Files.get(...thumbnailLink...)` в QR flow | Документировать как tracked dependency текущего проекта. |
| Installable triggers | platform | Продолжение scan и Telegram polling | Документировать только там, где сценарий реально фоновой и не сработает без trigger ownership. |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `clasp`-based local binding | Ручное копирование файлов в Apps Script editor | Работает, но делает bootstrap скрытым, неаудируемым и плохо воспроизводимым. |
| Separate inventory file | Один большой README | Быстрее написать, но mandatory/conditional сущности тонут в prose и ухудшают BOOT-02. |
| Script Properties for runtime state | Tracked JSON/markdown с живыми значениями | Ускоряет one-off setup, но прямо нарушает BOOT-03. |

**Installation:**
```bash
npm install -g @google/clasp
clasp login
git clone <repo-url>
cd Разрешения
```

## Architecture Patterns

### Recommended Project Structure

```text
README.md                    # публичный вход и краткий bootstrap route
docs/
├── BOOTSTRAP.md             # линейный happy path от clone до первого scan
├── BOOTSTRAP_INVENTORY.md   # свойства, листы, advanced services, triggers
└── PUBLIC_READY.md          # sanitization policy + audit checklist
.clasp.example.json          # tracked redacted binding template
.claspignore                 # upload allowlist for clasp push
appsscript.json              # tracked manifest source of truth
```

### Pattern 1: README Routes, BOOTSTRAP Executes
**What:** `README.md` должен быть кратким публичным entrypoint и ссылаться на полный quickstart, а не содержать все эксплуатационные детали внутри себя.

**When to use:** всегда для публичного GitHub-репозитория без существующего `README.md`.

**Why:** сейчас в репозитории нет публичной точки входа. Planner должен добавить её, иначе bootstrap-материалы останутся discoverable только через `.planning/` или знание структуры проекта.

### Pattern 2: `clasp` Creates the Local Binding, Template Explains It
**What:** happy path должен создавать локальный `.clasp.json` через `clasp`, а `.clasp.example.json` использовать как tracked schema/reference и fallback-пример.

**When to use:** всегда для BOOT-01.

**How to implement in docs:** quickstart ведёт по пути `новый Spreadsheet -> clasp create-script --parentId -> clasp push -> открыть таблицу -> first-run menu actions`.

**Repo anchors:** `.clasp.example.json`, `.gitignore`, `.claspignore`, `appsscript.json`.

### Pattern 3: Base Scan First, Telegram Later
**What:** linear quickstart должен доводить maintainer до первого scan без обязательной настройки Telegram.

**When to use:** всегда для первой половины `docs/BOOTSTRAP.md`.

**Why:** обязательный bootstrap-path закрывает `ROOT_FOLDER_ID`, `scanAndUpdate()` и появление обязательных листов. Telegram-зависимые части должны идти отдельным условным разделом после первого успешного scan.

**Repo anchors:** `00_MainUi.gs`, `40_ScanJob.gs`, `03_Logging.gs`, `20_View.gs`, `31_Telegram.gs`.

### Pattern 4: Inventory by Ownership and Lifecycle
**What:** inventory должен показывать не только список сущностей, но и кто их создаёт, кто их задаёт и на каком шаге они проверяются.

**When to use:** всегда для BOOT-02.

**Why:** иначе maintainer не отличит manual input (`ROOT_FOLDER_ID`) от runtime-owned state (`SYNC_CURSOR`, `STOP_SCAN`, `TELEGRAM_UPDATE_OFFSET`).

### Pattern 5: Two Surfaces, Two Checks
**What:** docs должны явно разделять Git-audit и `clasp push`-surface.

**When to use:** всегда для BOOT-03.

**Why:** `.claspignore` защищает upload в Apps Script, но не говорит ничего о том, что лежит в tracked markdown, `.planning/*` или других Git-артефактах. Public-ready proof обязан проверять именно tracked files.

### Bootstrap Inventory

#### Script Properties: Maintainer Sets

| Key | Status | Who sets | Where used | Verification step |
|-----|--------|----------|------------|-------------------|
| `ROOT_FOLDER_ID` | обязательно | maintainer через меню `uiSetRootFolder()` | `00_MainUi.gs`, `10_DriveRepo.gs`, `20_View.gs`, `31_Telegram.gs` | После первого scan открывается папка в витрине и сканер перестаёт ругаться на отсутствие root folder. |
| `TELEGRAM_BOT_TOKEN` | условно | maintainer через `tgSetBotToken()` | `31_Telegram.gs` | `tgInitEmployeeBot()`/`tgSetupEmployeeBotMenu()` выполняются без ошибки про отсутствующий токен. |
| `TG_DRIVER_FOLDER_ID` | условно | maintainer через `tgSetRoleFolders()` | `31_Telegram.gs` | Для роли строится корректная папка документов. |
| `TG_EMPLOYEE_FOLDER_ID` | условно | maintainer через `tgSetRoleFolders()` | `31_Telegram.gs` | То же. |
| `TG_MANAGER_FOLDER_ID` | условно | maintainer через `tgSetRoleFolders()` | `31_Telegram.gs` | То же. |

#### Script Properties: Runtime-Owned

| Key | Status | Who writes it | Why it exists | Documentation rule |
|-----|--------|---------------|---------------|--------------------|
| `STOP_SCAN` | опционально / runtime | код (`stopScan()`, `clearStopFlag_()`) | Кооперативная остановка scan | Не включать в список manual setup. |
| `SYNC_CURSOR` | опционально / runtime | код (`syncExistingRowsChunked_()`) | Cursor chunked sync | Не включать в список manual setup. |
| `TELEGRAM_UPDATE_OFFSET` | опционально / runtime | код (`tgSyncChatIdsFromUpdates()`) | Offset polling | Не включать в список manual setup. |

#### Sheets

| Sheet | Status | Who creates it | Why it exists | Verification step |
|-------|--------|----------------|---------------|-------------------|
| `Разрешения` | обязательно | `11_SheetsRepo.gs` -> `ensureSheet_()` | Канонический реестр | Появляется после первого scan. |
| `Logs` | обязательно | `03_Logging.gs` -> `ensureLogSheet_()` | Операционный журнал | Появляется при первом логировании `scanAndUpdate()`. |
| `Витрина` | обязательно | `20_View.gs` -> `ensureViewSheet_()` | Операторский слой и proof успешного rebuild | Появляется после завершения scan или явного `refreshView()`. |
| `Контакты` | условно | `31_Telegram.gs` -> `tgEnsureContactsSheet_()` | Telegram contacts/roles | Появляется только после Telegram init. |

#### Advanced Services and Platform Dependencies

| Dependency | Status | Source of truth | Why it matters | Verification step |
|------------|--------|-----------------|----------------|-------------------|
| Container-bound Spreadsheet | обязательно | bootstrap quickstart | Нужен для `getActiveSpreadsheet()`, меню и sidebar | После `clasp push` и перезагрузки таблицы появляется меню `Разрешения`. |
| `Drive` advanced service (`v2`) | обязательно для current tracked setup | `appsscript.json` | Используется `Drive.Files.get(...)` в `12_QrService.gs` | Manifest после `clasp push` совпадает с tracked `appsscript.json`. |
| `UrlFetchApp` | условно | runtime platform | Нужен для QR providers и Telegram API | Telegram/QR flows не падают на первом сетевом вызове. |
| `HtmlService` + `CacheService` | условно | runtime platform | Нужны только для sidebar Telegram send UI | Sidebar открывается и получает данные через `tgGetSidebarData()`. |

#### Installable Triggers

| Trigger function | Status | How created | Purpose | Verification step |
|------------------|--------|-------------|---------|-------------------|
| `continueScan` | условно | автоматически `scheduleContinue_()` | Автопродолжение длинного scan | Появляется только если scan упирается во time budget. |
| `tgProcessEmployeeBotUpdates` | условно | вручную через `tgEnableEmployeeBotPolling()` | Minutely Telegram polling | После включения polling в проекте есть один time-based trigger с этим handler. |

### Pattern 6: Public-Ready Audit Must Be Deterministic
**What:** `docs/PUBLIC_READY.md` должен содержать не только human checklist, но и минимальный набор команд, который можно повторить перед публикацией.

**When to use:** перед любой публикацией, после правок docs/config templates и при подготовке следующего maintainer.

**Example audit commands:**
```bash
git status --short
git ls-files --error-unmatch .clasp.json
git grep -nE 'scriptId|parentId|ROOT_FOLDER_ID|TELEGRAM_BOT_TOKEN|TELEGRAM_UPDATE_OFFSET|TG_(DRIVER|EMPLOYEE|MANAGER)_FOLDER_ID'
git grep -nE 'https://drive.google.com/drive/folders/[A-Za-z0-9_-]{20,}|[0-9]{8,10}:[A-Za-z0-9_-]{20,}'
```

**Interpretation rule:** найденные места допустимы только там, где используются placeholder values, имена ключей или описательная документация. Любое live value блокирует public-ready состояние.

### Anti-Patterns to Avoid
- **Считать `.claspignore` заменой public audit:** это только upload policy для `clasp push`.
- **Смешивать base scan-path и Telegram bootstrap в один обязательный сценарий:** это ломает требование про явные `обязательно` / `условно`.
- **Документировать runtime-owned properties как ручные шаги:** это создаёт ложный обязательный setup.
- **Держать proof в `.planning/` только для автора:** BOOT-03 требует публичный артефакт в самом репозитории.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Local Apps Script binding | Самодельный конфиг-формат или ручной copy/paste code deployment | `clasp` + локальный `.clasp.json` + tracked `.clasp.example.json` | Это официальный и воспроизводимый surface для binding. |
| Bootstrap runtime wizard | Новый setup-скрипт поверх существующих menu actions | Уже существующие `uiSetRootFolder()`, `scanAndUpdate()`, `tg*` entry points | В фазе 1 важна прозрачность и documentation-first, а не новый слой магии. |
| Ad-hoc inventory in prose | Список требований без ownership/status tables | Отдельный inventory markdown | Табличный inventory напрямую закрывает BOOT-02 и снижает скрытые шаги. |
| External release memory | Процесс «автор просто проверяет глазами» | `docs/PUBLIC_READY.md` + deterministic commands | BOOT-03 требует воспроизводимый proof внутри репозитория. |

**Key insight:** phase 1 не должна строить новый runtime. Она должна сделать существующий runtime обозримым, безопасным и повторяемым.

## Common Pitfalls

### Pitfall 1: Publishing the Binding Instead of the Template
**What goes wrong:** в Git попадает рабочий `.clasp.json` с live `scriptId` и `parentId`.

**Why it happens:** binding воспринимается как harmless local config, а не как operational surface.

**How to avoid:** quickstart создаёт `.clasp.json` локально через `clasp`; public docs ссылаются только на `.clasp.example.json`.

**Warning signs:** `git ls-files --error-unmatch .clasp.json` неожиданно начинает возвращать файл.

### Pitfall 2: Treating All Properties as Manual Bootstrap Inputs
**What goes wrong:** maintainer пытается руками создавать `SYNC_CURSOR`, `STOP_SCAN` или `TELEGRAM_UPDATE_OFFSET`.

**Why it happens:** inventory не разделяет user-provided и runtime-owned свойства.

**How to avoid:** в `BOOTSTRAP_INVENTORY.md` сделать отдельные таблицы для maintainer-set и runtime-owned properties.

**Warning signs:** в quickstart больше одного обязательного свойства для первого scan-path.

### Pitfall 3: Trigger Ownership Drift
**What goes wrong:** новый maintainer видит код trigger-а, но реальные installable triggers принадлежат другому аккаунту или вообще не созданы.

**Why it happens:** installable triggers в Apps Script выполняются от имени создателя, а ownership не фиксируется в docs.

**How to avoid:** отдельная trigger-table плюс явный шаг проверки trigger list после enable polling/after long scan.

**Warning signs:** polling не работает, хотя handler-функция есть в коде и `clasp push` прошёл.

### Pitfall 4: Auditing Only Config Files
**What goes wrong:** live IDs или секреты остаются в `README.md`, `docs/*`, `.planning/*` или примерах команд.

**Why it happens:** audit ограничивается `.clasp.example.json` и `appsscript.json`.

**How to avoid:** все проверки строить на `git ls-files`/`git grep`, а не на ручном просмотре пары файлов.

**Warning signs:** public-ready checklist не упоминает tracked docs и markdown вообще.

### Pitfall 5: Making Telegram Part of the Mandatory Happy Path
**What goes wrong:** maintainer не может закончить bootstrap без bot token и role folders, хотя цель первого прохода была просто поднять scan.

**Why it happens:** docs не отделяют base functionality от optional integration setup.

**How to avoid:** quickstart заканчивать на первом scan и автосоздании базовых листов; Telegram выносить в отдельный conditional section.

**Warning signs:** `TELEGRAM_BOT_TOKEN` появляется в разделе prerequisites перед `ROOT_FOLDER_ID`.

## Code Examples

Verified patterns from official sources and current repo:

### Local Binding via `clasp`
```bash
# Source: https://github.com/google/clasp
npm install -g @google/clasp
clasp login
clasp create-script --title "Разрешения" --parentId "<SPREADSHEET_ID>"
clasp push
```

### Manifest Dependency Contract
```json
// Source: https://developers.google.com/apps-script/manifest
{
  "timeZone": "Europe/Moscow",
  "dependencies": {
    "enabledAdvancedServices": [
      {
        "userSymbol": "Drive",
        "serviceId": "drive",
        "version": "v2"
      }
    ]
  },
  "exceptionLogging": "STACKDRIVER",
  "runtimeVersion": "V8"
}
```

### Script Properties as Runtime Config
```javascript
// Source: https://developers.google.com/apps-script/guides/properties
const props = PropertiesService.getScriptProperties();
props.setProperty('ROOT_FOLDER_ID', value);
```

### Installable Trigger Creation
```javascript
// Source: https://developers.google.com/apps-script/guides/triggers/installable
ScriptApp.newTrigger('tgProcessEmployeeBotUpdates')
  .timeBased()
  .everyMinutes(1)
  .create();
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Public repo without clear entrypoint | Public repo with explicit `README.md` + bootstrap docs | Recommended for phase 1 | Снижает входной порог для нового maintainer. |
| Live `.clasp.json` as handoff artifact | Tracked template + local-only binding | Already partly implemented via `.clasp.example.json` and `.gitignore` | Прямо поддерживает BOOT-01 и BOOT-03. |
| Hidden runtime prerequisites in code | Inventory with ownership/status/verifications | Recommended for phase 1 | Прямо поддерживает BOOT-02. |
| Manual publication memory | Deterministic tracked audit checklist | Recommended for phase 1 | Делает public-ready proof повторяемым. |

**Deprecated / outdated:**
- Коммитить рабочий `.clasp.json` или любые live folder IDs.
- Использовать полуреальные примеры вместо `YOUR_*` placeholders.
- Считать `.claspignore` достаточным доказательством public-ready состояния.

## Open Questions

1. **Нужно ли planner считать `docs/BOOTSTRAP_INVENTORY.md` и `docs/PUBLIC_READY.md` отдельными файлами или объединить их?**
   - What we know: нужен один линейный quickstart и отдельный inventory/checklist surface.
   - What's unclear: лучше ли для этого codebase два отдельных файла или один combined operational appendix.
   - Recommendation: не объединять quickstart с audit; inventory и checklist можно объединить только если не теряется сканируемость.

2. **Нужно ли в phase 1 документировать fallback-поведение Telegram role folders к `ROOT_FOLDER_ID` как допустимое?**
   - What we know: текущее поведение кода делает такой fallback.
   - What's unclear: считать ли это поддерживаемой bootstrap-моделью или только текущим техническим долгом.
   - Recommendation: в phase 1 описывать это как текущее поведение, но явно пометить как risk/temporary behavior, не как desirable pattern.

3. **Нужно ли включать Telegram bootstrap в happy path проверки phase 1?**
   - What we know: контекст требует явно различать base scan-path и Telegram-зависимые части.
   - What's unclear: достаточно ли для phase gate только first scan или нужен ещё optional rehearsal Telegram setup.
   - Recommendation: phase gate строить вокруг first scan; Telegram verification оставить как conditional acceptance block внутри тех же docs.

## Sources

### Primary (HIGH confidence)
- Repository inspection: `.clasp.example.json`, `.claspignore`, `appsscript.json`, `00_MainUi.gs`, `01_Config.gs`, `02_RunControl.gs`, `03_Logging.gs`, `11_SheetsRepo.gs`, `20_View.gs`, `31_Telegram.gs`, `40_ScanJob.gs`, `12_QrService.gs`
- Google Apps Script Properties guide: https://developers.google.com/apps-script/guides/properties
- Google Apps Script installable triggers guide: https://developers.google.com/apps-script/guides/triggers/installable
- Google Apps Script advanced services guide: https://developers.google.com/apps-script/guides/services/advanced
- Google Apps Script manifest docs: https://developers.google.com/apps-script/manifest
- Google Apps Script Script service reference: https://developers.google.com/apps-script/reference/script
- Official `google/clasp` README: https://github.com/google/clasp
- Context7 `/websites/developers_google_apps-script`: properties, manifest dependencies, installable triggers

### Secondary (MEDIUM confidence)
- `.planning/codebase/STACK.md` - existing runtime and delivery constraints
- `.planning/codebase/ARCHITECTURE.md` - module boundaries and bootstrap anchors
- `.planning/codebase/CONCERNS.md` - operational risks the public docs must neutralize

### Tertiary (LOW confidence)
- None

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - подтверждается tracked manifest, repo structure и official Apps Script / clasp docs
- Architecture: MEDIUM - рекомендации по doc-set и phase split являются prescriptive inference из repo и user constraints
- Pitfalls: HIGH - подтверждаются прямым чтением кода и official docs about properties/triggers

**Research date:** 2026-03-09
**Valid until:** 2026-04-08
