---
phase: 01-github-bootstrap
plan: 03
subsystem: infra
tags: [public-ready, sanitization, documentation, powershell]
requires:
  - 01-01 sanitization surface for redacted config and public audit baseline
  - 01-02 README quickstart and bootstrap inventory for maintainer bootstrap path
provides:
  - public-ready checklist for tracked code, config templates, docs, and QR runtime proof
  - linked proof flow from README to sanitization policy, checklist, and audit command
  - PowerShell audit validation for required public proof artifacts
affects: [bootstrap-docs, public-ready-proof, phase-01]
tech-stack:
  added: []
  patterns: [checklist-plus-audit-proof, proof-flow-navigation]
key-files:
  created:
    - docs/public-ready-checklist.md
  modified:
    - README.md
    - docs/repository-sanitization.md
    - scripts/check-public-surface.ps1
key-decisions:
  - "Public-ready proof оформлен как короткая цепочка `README.md` -> `docs/repository-sanitization.md` -> `docs/public-ready-checklist.md` -> `scripts/check-public-surface.ps1`."
  - "Audit script проверяет не только regex-утечки, но и наличие ключевых tracked proof-артефактов."
patterns-established:
  - "Checklist-first public proof: maintainer сначала проходит короткий checklist, потом запускает deterministic audit."
  - "Tracked-surface contract: README, policy, checklist, inventory и audit script считаются обязательной частью public-ready surface."
requirements-completed: [BOOT-03]
duration: 20 min
completed: 2026-03-09
---

# Фаза 01 План 03: Public-ready proof flow

**Public-ready checklist для tracked surface, связанный с quickstart, sanitization policy и повторяемым PowerShell audit**

## Performance

- **Duration:** 20 min
- **Started:** 2026-03-09T14:57:39+03:00
- **Completed:** 2026-03-09T15:18:05+03:00
- **Tasks:** 2
- **Files modified:** 4

## Accomplishments

- Добавлен `docs/public-ready-checklist.md` как короткий proof flow по tracked code, config templates, docs и спорной проверке `ImagesService`.
- `README.md` и `docs/repository-sanitization.md` теперь ведут maintainer по одной цепочке public-ready proof без скрытых переходов.
- `scripts/check-public-surface.ps1` теперь проверяет обязательные proof-артефакты и явно сообщает объём audited tracked text surface.

## Task Commits

Each task was committed atomically:

1. **Task 1: Создать public-ready checklist для tracked surface** - `708a306` (feat)
2. **Task 2: Связать checklist, quickstart и automated audit в единый proof flow** - `7dd1631` (feat)

**Plan metadata:** будет зафиксирован отдельным commit после обновления `.planning/`-метаданных.

## Files Created/Modified

- `docs/public-ready-checklist.md` - короткий checklist по tracked surface, placeholders, inventory drift и явной QR-проверке `ImagesService`.
- `README.md` - top-level маршрут `quickstart -> policy -> checklist -> audit command`.
- `docs/repository-sanitization.md` - policy и порядок прохождения public-ready proof.
- `scripts/check-public-surface.ps1` - deterministic audit с проверкой обязательных proof-артефактов и отчётом по audited tracked text files.

## Decisions Made

- Public-ready proof оставлен в публичных repo-файлах, а не в `.planning/`, чтобы BOOT-03 проверялся тем же surface, который увидит новый maintainer.
- Automated audit стал проверять не только потенциальные live bindings, но и наличие обязательных proof-артефактов, чтобы checklist и script не расходились.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Фаза 1 теперь закрывает BOOT-03 не только policy-документом, но и повторяемым proof workflow по tracked surface.
- Следующая фаза может опираться на уже оформленный публичный bootstrap-path и audit перед любыми изменениями в репозитории.

## Self-Check: PASSED

- FOUND: `.planning/phases/01-github-bootstrap/01-03-SUMMARY.md`
- FOUND: `708a306`
- FOUND: `7dd1631`

---
*Phase: 01-github-bootstrap*
*Completed: 2026-03-09*
