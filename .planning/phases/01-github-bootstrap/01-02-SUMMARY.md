---
phase: 01-github-bootstrap
plan: 02
subsystem: infra
tags: [bootstrap, clasp, google-apps-script, documentation]
requires:
  - 01-01 sanitization surface for redacted local binding and public audit
provides:
  - русский quickstart от clone до первого scan
  - inventory bootstrap-зависимостей по properties, sheets, services и triggers
  - явный QR checklist для проверки ImagesService после bootstrap
affects: [bootstrap-docs, onboarding, phase-01]
tech-stack:
  added: []
  patterns: [readme-first-bootstrap, inventory-by-ownership, optional-telegram-separation]
key-files:
  created:
    - README.md
    - docs/bootstrap-inventory.md
  modified: []
key-decisions:
  - "Главный bootstrap-артефакт живёт в `README.md`, чтобы новый maintainer входил в проект через один линейный quickstart."
  - "Telegram setup вынесен в условный блок после первого scan, чтобы базовый bootstrap не зависел от bot token и role folders."
  - "Inventory явно разделяет maintainer-set и runtime-owned `Script Properties`, чтобы служебные cursor/stop/update keys не выглядели как ручной setup."
patterns-established:
  - "README-first bootstrap: путь от `git clone` до `scanAndUpdate()` описан в одном публичном документе."
  - "Operational inventory: зависимости документируются по status/owner/verification вместо скрытых предположений."
requirements-completed: [BOOT-01, BOOT-02]
duration: 10 min
completed: 2026-03-09
---

# Фаза 01 План 02: Bootstrap quickstart и inventory

**Русский container-bound quickstart для Spreadsheet/App Script и отдельный inventory обязательных bootstrap-зависимостей с QR checklist**

## Performance

- **Duration:** 10 min
- **Started:** 2026-03-09T10:51:22Z
- **Completed:** 2026-03-09T11:01:21Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments

- Добавлен `README.md` как единый публичный вход в bootstrap с линейным happy path от `git clone` до первого `scanAndUpdate()`.
- Вынесен `docs/bootstrap-inventory.md` с таблицами по `Script Properties`, листам, advanced services и installable triggers.
- Зафиксирована явная проверка QR flow и `ImagesService`, чтобы maintainer не считал один только manifest достаточным proof bootstrap-готовности.

## Task Commits

Each task was committed atomically:

1. **Task 1: Собрать главный русский quickstart от clone до первого scan** - `cd77c9f` (feat)
2. **Task 2: Вынести bootstrap inventory по properties, sheets, services и triggers** - `878fa99` (feat)

**Plan metadata:** будет зафиксирован отдельным commit после обновления `.planning/`-метаданных.

## Files Created/Modified

- `README.md` - линейный bootstrap-документ для container-bound Spreadsheet/App Script пути.
- `docs/bootstrap-inventory.md` - inventory по зависимостям bootstrap с ownership, статусами и шагами проверки.

## Decisions Made

- `README.md` выбран главным quickstart-артефактом вместо дополнительного nested bootstrap-файла, чтобы публичный вход был один.
- Telegram setup сознательно вынесен в условный блок после первого scan, а не включён в обязательный path.
- Runtime-owned keys (`STOP_SCAN`, `SYNC_CURSOR`, `TELEGRAM_UPDATE_OFFSET`) документируются отдельно от ручных свойств, чтобы исключить ложные manual steps.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

- Черновой порядок `clasp`-шагов был скорректирован в `README.md` на `clasp push -f` -> `clasp pull`, чтобы новый maintainer не тянул пустой container поверх локальной копии репозитория.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Phase 1 теперь имеет публичный quickstart и отдельный inventory bootstrap-зависимостей.
- Следующий план `01-03` может опираться на `README.md` и `docs/bootstrap-inventory.md` как на уже нормализованные bootstrap-артефакты для public-ready checklist.

## Self-Check: PASSED

- FOUND: `.planning/phases/01-github-bootstrap/01-02-SUMMARY.md`
- FOUND: `cd77c9f`
- FOUND: `878fa99`

---
*Phase: 01-github-bootstrap*
*Completed: 2026-03-09*
