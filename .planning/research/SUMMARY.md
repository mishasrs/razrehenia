# Сводка исследования проекта

**Project:** Разрешения
**Domain:** Brownfield Google Apps Script-система для реестра разрешений, QR-обогащения и Telegram-отправки
**Researched:** 2026-03-08
**Confidence:** HIGH

## Executive Summary

Исследование подтвердило, что для текущего этапа проект не нужно переносить с Google Apps Script на другой runtime. Правильный путь для `Разрешения` в 2026 году - сохранить связку `Spreadsheet-bound Apps Script + Google Sheets + Google Drive + HtmlService + Telegram Bot API`, но сделать ее более строгой по конфигурации, наблюдаемости и отказоустойчивости.

Главный риск не в самой платформе, а в скрытых operational assumptions: live-идентификаторы в репозитории, fail-open fallback в интеграциях, смешение временных ошибок Drive с реальными удалениями, неявные контракты между `View` и Telegram, а также отсутствие воспроизводимого bootstrap и smoke-проверок для публичного GitHub-репозитория.

Практический вывод для roadmap: сначала закрыть public-repo hygiene и bootstrap, затем перевести конфигурацию и интеграции в fail-closed режим, после этого стабилизировать scan/sync/polling потоки, и только потом углубляться в оптимизацию и staging/release hygiene.

## Key Findings

### Recommended Stack

Для этого milestone исследование рекомендует оставить production runtime на Google Apps Script V8 и не вводить новый backend-слой поверх существующей модели. Текущий продукт уже глубоко завязан на Spreadsheet UI, installable triggers, `PropertiesService`, `HtmlService` и Apps Script quota model; миграция платформы сейчас даст больше риска, чем пользы.

**Core technologies:**
- Google Apps Script V8: основной runtime и orchestration-слой - уже совпадает с текущей архитектурой и сценариями оператора
- Google Sheets + Spreadsheet-bound script: system of record и пользовательская поверхность - естественный контейнер для меню, витрины и операторского workflow
- Google Drive + UrlFetchApp: источник PDF и интеграционный слой для QR/Telegram - нужен, но должен быть жёстче ограничен и лучше документирован
- LockService + Script Properties + installable triggers: правильная модель для chunked jobs и продолжения выполнения - критична для квот и идемпотентности
- `clasp`: мост между локальным Git-репозиторием и Apps Script - нужен как tooling, но без публикации live `.clasp.json`

### Expected Features

Исследование по возможностям показало, что для текущего цикла table stakes не новые пользовательские функции, а предсказуемое поведение существующих сценариев: безопасный bootstrap, fail-closed доступ, корректная синхронизация, устойчивый Telegram-polling и воспроизводимая проверка.

**Must have (table stakes):**
- Безопасный публичный bootstrap - чтобы новый maintainer мог поднять проект без live ids и скрытых ручных шагов
- Fail-closed конфигурация интеграций - чтобы ошибка настройки не расширяла доступ и не создавала скрытый data egress
- Надёжный scan/sync/polling - чтобы строки не терялись и обновления Telegram не дублировались и не пропускались
- Минимальный verification kit - чтобы публичный репозиторий можно было проверить без production-секретов

**Should have (competitive):**
- Более явная диагностика run-state и причин остановки
- Снижение quota-cost на Sheets/Drive/Telegram потоках
- Формализованный контракт витрины и серверной отправки

**Defer (v2+):**
- Инкрементальный индекс Drive вместо полного обхода дерева
- Quarantine/inbox для ручной обработки проблемных PDF
- Dry-run preview и более развитая операторская аналитика

### Architecture Approach

Рекомендуемая целевая форма - modular monolith внутри Apps Script: тонкий UI и entry points, отдельный orchestration-слой для scan/continue/send сценариев, изолированные adapters для Drive/Sheets/Telegram/QR, и чётко оформленные контракты для проекции `Витрина`. Главная архитектурная задача не "переписать", а убрать размытые границы и неявные зависимости внутри уже существующего контура.

**Major components:**
1. UI / Entry Points - меню, prompts, sidebar и публичные Apps Script-функции
2. Orchestration Flows - scan/sync, continue, QR backfill, Telegram use cases и жизненный цикл фона
3. Repositories / Adapters - Drive, Sheets, Telegram HTTP, QR providers, Properties, Cache
4. View Projection - построение `Витрина` как производной проекции от канонического реестра
5. Observability / Bootstrap - конфигурация, логирование, trigger ownership, staging и smoke-проверки

### Critical Pitfalls

1. **Публичный репозиторий открывают вместе с operational ids** - нужно хранить в Git только обезличенные шаблоны, а live ids/tokens держать в `Script Properties`
2. **Fail-open конфигурация ролей и QR fallback** - отсутствие отдельной папки роли или permissive QR policy не должны приводить к расширению доступа или скрытому egress
3. **Временные ошибки Drive принимают за удаление файла** - синхронизация должна различать transient failure и реальное удаление, иначе теряются строки
4. **Polling и chunked jobs не идемпотентны** - lock contention, offset/cursor и run-state должны быть явными и сериализованными
5. **Оптимизацию делают до фикса контрактов** - сначала нужно стабилизировать поведение scan/sync/view/send, и только потом агрессивно уменьшать quota-cost

## Implications for Roadmap

Based on research, suggested phase structure:

### Phase 1: Публичный GitHub и bootstrap
**Rationale:** публичность репозитория уже включена, значит сначала нужно убрать live-привязки и описать безопасную установку
**Delivers:** sanitized config examples, русский bootstrap-путь, понятные требования к `clasp`, `Script Properties`, листам и триггерам
**Addresses:** table stakes по public-repo hygiene и воспроизводимому запуску
**Avoids:** утечки operational ids и зависимость от локального знания автора

### Phase 2: Fail-closed интеграции и доступ
**Rationale:** после bootstrap нужно перевести конфигурацию и маршрутизацию в безопасный режим, иначе любой баг остаётся опасным
**Delivers:** preflight-проверки, fail-closed role routing, явная QR policy и границы data egress
**Uses:** `PropertiesService`, `DriveApp`, `UrlFetchApp`, Apps Script manifest/config contracts
**Implements:** слой безопасной конфигурации и интеграционного доступа

### Phase 3: Надёжность scan/sync и фоновых сценариев
**Rationale:** только после фикса доступа есть смысл стабилизировать данные и background flows
**Delivers:** корректный cursor/offset, явный run-state, разделение transient errors и real deletions, устойчивый Telegram polling
**Uses:** `LockService`, installable triggers, chunked execution, structured logging
**Implements:** orchestration и data reliability contracts

### Phase 4: Производительность и квоты
**Rationale:** оптимизация должна строиться на уже стабилизированном поведении, иначе она лишь ускорит ошибки
**Delivers:** сокращение лишних чтений Drive/Sheets, локальное кэширование blob внутри execution, уменьшение полных переписей листов
**Uses:** batch-запись в Sheets, in-memory caching, точечные range updates
**Implements:** quota-safe execution patterns

### Phase 5: Staging, smoke tests и release hygiene
**Rationale:** после hardening и performance нужна воспроизводимая проверка, иначе публичный репозиторий останется "работает только у автора"
**Delivers:** staging-контур, минимальный smoke checklist, базовый локальный verification path без production-секретов
**Uses:** redacted fixtures, локальная синтаксическая проверка, ручные сценарии Apps Script
**Implements:** эксплуатационный слой и readiness для дальнейших фаз

### Phase Ordering Rationale

- Порядок следует главному риску: сначала безопасность и воспроизводимость, потом корректность данных, потом производительность
- Фазы повторяют реальные архитектурные зависимости: bootstrap -> config/access -> orchestration/data -> performance -> verification
- Такой порядок минимизирует риск закрепить в оптимизациях или staging-процессе неверные доменные контракты

### Research Flags

Phases likely needing deeper research during planning:
- **Phase 2:** нужно отдельно проверить manifest hygiene, минимальные scopes и безопасную политику внешнего egress
- **Phase 5:** нужно аккуратно спланировать staging Apps Script / Drive / Telegram контур без пересечения с production

Phases with standard patterns (skip research-phase):
- **Phase 1:** public repo hygiene и sanitization - стандартная, хорошо понятная работа
- **Phase 3:** lock/cursor/idempotency для Apps Script flows - типовой паттерн для quota-bound automation
- **Phase 4:** локальные performance fixes по Sheets/Drive/Telegram - понятная оптимизационная работа по уже найденным hotspot

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | Рекомендации опираются на официальный Apps Script runtime/model и хорошо совпадают с кодовой базой |
| Features | HIGH | Table stakes выведены из реальных сценариев проекта, а не из абстрактного greenfield-продукта |
| Architecture | HIGH | Целевая форма напрямую следует из текущего разделения по файлам и ограничений Apps Script |
| Pitfalls | HIGH | Риски подтверждаются исследованием, картой кодовой базы и уже найденными дефектами в текущем коде |

**Overall confidence:** HIGH

### Gaps to Address

- Cloud Logging и standard Google Cloud project: включить в фазовое планирование как отдельную эксплуатационную проверку
- Quarantine-модель для проблемных PDF: определить при планировании, нужен ли отдельный лист/статус уже в этом milestone
- Полная серверная валидация Telegram payload: уточнить объём refactor внутри `31_Telegram.gs` на этапе phase planning

## Sources

### Primary (HIGH confidence)
- Google Apps Script Best Practices - runtime, quotas, batching, performance
- Google Apps Script V8 Runtime - platform constraints and supported execution model
- Google Apps Script Installable Triggers - trigger lifecycle and ownership model
- Google Apps Script LockService / Properties Service / Logging - concurrency, state and observability primitives
- Google Apps Script Bound Scripts / Cloud Project docs - deployment surface and bootstrap constraints
- Telegram Bot API - polling model, update offsets, sendDocument/sendMessage contracts

### Secondary (MEDIUM confidence)
- `.planning/research/STACK.md` - целевой стек и эксплуатационные рекомендации для текущего milestone
- `.planning/research/FEATURES.md` - table stakes, differentiators и anti-features для stabilisation milestone
- `.planning/research/ARCHITECTURE.md` - целевые границы модулей и порядок безопасного refactor
- `.planning/research/PITFALLS.md` - типовые failure modes при переходе к публичному GitHub-репозиторию

---
*Research completed: 2026-03-08*
*Ready for roadmap: yes*
