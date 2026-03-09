# Roadmap: Разрешения

## Overview

Текущий roadmap не про переписывание платформы, а про доведение существующего Apps Script-контура до состояния, в котором публичный GitHub-репозиторий, рабочий scan/sync-поток, QR-обогащение и Telegram-отправка становятся воспроизводимыми, безопасными и понятными для сопровождения. Порядок фаз отражает реальную зависимость работ: сначала public-repo hygiene и bootstrap, затем fail-closed доступ, потом надёжность фоновых сценариев, после этого оптимизация по квотам и только затем staging/smoke/release hygiene.

## Phases

**Phase Numbering:**
- Integer phases (1, 2, 3): planned milestone work
- Decimal phases (2.1, 2.2): urgent insertions if they become necessary

- [x] **Phase 1: Публичный GitHub и bootstrap** - Санитизировать репозиторий и сделать восстановление окружения воспроизводимым
- [ ] **Phase 2: Fail-closed интеграции и доступ** - Перевести конфигурацию, маршрутизацию и QR-policy в безопасный режим отказа
- [ ] **Phase 3: Надёжность scan/sync и фоновых задач** - Убрать silent failure и закрепить корректный run-state/cursor/offset
- [ ] **Phase 4: Производительность и квоты** - Снизить лишние чтения Drive/Sheets и стоимость массовых операций
- [ ] **Phase 5: Staging, smoke tests и release hygiene** - Дать проекту воспроизводимую проверку и безопасный путь изменений

## Phase Details

### Phase 1: Публичный GitHub и bootstrap
**Goal:** Репозиторий безопасен для публичного хранения, а другой maintainer может поднять рабочее окружение по документированному bootstrap-пути
**Depends on:** Nothing (first phase)
**Requirements:** [BOOT-01, BOOT-02, BOOT-03]
**Success Criteria** (what must be TRUE):
  1. Разработчик может склонировать репозиторий и настроить локальную `clasp`-связку по обезличенному примеру без live ids в Git
  2. Русская документация описывает обязательные `Script Properties`, листы, advanced services и installable triggers
  3. В tracked files нет live secrets, live operational ids и production-specific config bindings
**Plans**: 3 plans

Plans:
- [x] 01-01-PLAN.md — закрепить sanitization репозитория, redacted config surface и automated audit public-ready surface
- [x] 01-02-PLAN.md — собрать русский quickstart и bootstrap inventory для Spreadsheet/App Script/Properties/Triggers
- [x] 01-03-PLAN.md — оформить public-ready checklist и связать его с automated proof отсутствия утечек

### Phase 2: Fail-closed интеграции и доступ
**Goal:** Ошибки конфигурации и маршрутизации интеграций приводят к безопасному отказу с понятной диагностикой, а не к скрытому расширению доступа
**Depends on:** Phase 1
**Requirements:** [SAFE-01, SAFE-02, SAFE-03]
**Success Criteria** (what must be TRUE):
  1. Перед критичными сценариями scan/send система явно сообщает о недостающих папках, свойствах, листах или Telegram-настройках
  2. Отсутствие folder mapping или прав для роли не приводит к fallback на общий маршрут отправки
  3. QR provider policy, fallback и внешний egress формализованы и понятны maintainer без чтения всей кодовой базы
**Plans**: 3 plans

Plans:
- [ ] 02-01: Ввести preflight-проверки обязательной конфигурации и зависимостей
- [ ] 02-02: Перевести role routing и Telegram permissions в fail-closed режим
- [ ] 02-03: Зафиксировать QR policy, fallback и границы data egress

### Phase 3: Надёжность scan/sync и фоновых задач
**Goal:** Scan, sync и polling-потоки работают идемпотентно, не теряют строки и оставляют понятное диагностируемое состояние
**Depends on:** Phase 2
**Requirements:** [DATA-01, DATA-02, DATA-03, DATA-04]
**Success Criteria** (what must be TRUE):
  1. После stop/timeout sync продолжает работу с корректного курсора и не пропускает необработанные записи
  2. Временные ошибки Drive не приводят к молчаливому удалению строк реестра
  3. Telegram polling не дублирует и не пропускает updates при параллельных запусках
  4. Maintainer видит текущее состояние фонового сценария и причину остановки по логам/статусу
**Plans**: 4 plans

Plans:
- [ ] 03-01: Закрепить корректный cursor и поведение chunked sync
- [ ] 03-02: Развести transient Drive errors и реальные удаления/исключения
- [ ] 03-03: Сериализовать polling и offset lifecycle в Telegram
- [ ] 03-04: Оформить run-state и диагностику start/pause/resume/fail/completion

### Phase 4: Производительность и квоты
**Goal:** Основные Apps Script-потоки делают меньше лишней работы и устойчивее укладываются в лимиты времени и сервисных квот
**Depends on:** Phase 3
**Requirements:** [PERF-01, PERF-02, PERF-03]
**Success Criteria** (what must be TRUE):
  1. Массовая Telegram-отправка не перечитывает один и тот же PDF для каждого получателя
  2. QR backfill не переписывает весь лист ради точечного обновления нескольких колонок
  3. Scan/sync/view сценарии сокращают лишние row-by-row и full-sheet операции, заметно уменьшая quota-cost
**Plans**: 3 plans

Plans:
- [ ] 04-01: Убрать повторные blob/range чтения в Telegram и QR flows
- [ ] 04-02: Сократить полные переписи листов и лишние range updates
- [ ] 04-03: Закрепить quota-safe паттерны для scan/sync/view сценариев

### Phase 5: Staging, smoke tests и release hygiene
**Goal:** Проект можно безопасно проверять и сопровождать без зависимости от production-секретов и «знания в голове автора»
**Depends on:** Phase 4
**Requirements:** [OPS-01, OPS-02, OPS-03]
**Success Criteria** (what must be TRUE):
  1. Maintainer может выполнить локальную синтаксическую и минимальную smoke-проверку без production secrets
  2. Изменения можно прогнать в отдельном staging-контуре Apps Script / Drive / Telegram до production
  3. Публичная документация содержит понятный manual regression checklist для основных сценариев проекта
**Plans**: 3 plans

Plans:
- [ ] 05-01: Собрать минимальный local verification path и redacted fixtures
- [ ] 05-02: Описать и подготовить staging-контур для проверки изменений
- [ ] 05-03: Оформить regression checklist и release hygiene для публичного репозитория

## Progress

**Execution Order:**
Phases execute in numeric order: 1 -> 2 -> 3 -> 4 -> 5

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Публичный GitHub и bootstrap | 3/3 | Complete | 2026-03-09 |
| 2. Fail-closed интеграции и доступ | 0/3 | Not started | - |
| 3. Надёжность scan/sync и фоновых задач | 0/4 | Not started | - |
| 4. Производительность и квоты | 0/3 | Not started | - |
| 5. Staging, smoke tests и release hygiene | 0/3 | Not started | - |
