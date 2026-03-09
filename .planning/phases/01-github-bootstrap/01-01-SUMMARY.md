---
phase: 01-github-bootstrap
plan: 01
subsystem: infra
tags: [clasp, appsscript, sanitization, powershell]
requires: []
provides:
  - tracked/untracked split для локального clasp binding
  - русская policy по sanitization публичного репозитория
  - PowerShell audit public-ready surface по tracked файлам
affects: [bootstrap-docs, public-ready-proof, phase-01]
tech-stack:
  added: [powershell]
  patterns: [local-binding-only, tracked-surface-audit]
key-files:
  created:
    - docs/repository-sanitization.md
    - scripts/check-public-surface.ps1
  modified:
    - .gitignore
    - .claspignore
key-decisions:
  - "Рабочий `.clasp.json` остаётся только локальным operational binding, а tracked surface опирается на `.clasp.example.json`."
  - "Proof public-ready состояния строится по `git ls-files` и проверке tracked текстовых файлов, а не по одному только `clasp push` surface."
patterns-established:
  - "Template-only binding: в Git остаются только placeholders вроде `YOUR_SCRIPT_ID` и `YOUR_SPREADSHEET_ID`."
  - "Deterministic audit: проверка публичной поверхности запускается одной PowerShell-командой из корня репозитория."
requirements-completed: [BOOT-01, BOOT-03]
duration: 4 min
completed: 2026-03-09
---

# Фаза 01 План 01: Sanitization публичной поверхности

**Обезличенный clasp template, явная sanitization policy и детерминированный PowerShell audit для public-ready tracked surface**

## Performance

- **Duration:** 4 min
- **Started:** 2026-03-09T13:21:59+03:00
- **Completed:** 2026-03-09T13:25:59+03:00
- **Tasks:** 3
- **Files modified:** 4

## Accomplishments

- Зафиксирован явный tracked/untracked split для локального `clasp` binding через `.gitignore` и `.claspignore`.
- Добавлена краткая русская policy в `docs/repository-sanitization.md` с привязкой к `.clasp.example.json`, `.claspignore` и `appsscript.json`.
- Добавлен `scripts/check-public-surface.ps1`, который проверяет tracked set, placeholder-модель и типовые утечки operational ids.

## Task Commits

Each task was committed atomically:

1. **Task 1: Нормализовать tracked config surface для публичного репозитория** - `441a1f0` (chore)
2. **Task 2: Зафиксировать постоянную sanitization policy рядом с кодом** - `88ddbb6` (chore)
3. **Task 3: Добавить automated audit public surface** - `59ffa3b` (feat)

**Plan metadata:** будет зафиксирован отдельным commit после обновления `.planning/`-метаданных.

## Files Created/Modified

- `.gitignore` - делает локальный `.clasp.json` явной untracked operational-конфигурацией.
- `.claspignore` - документирует, что в Apps Script push surface попадают только runtime-файлы и manifest.
- `docs/repository-sanitization.md` - задаёт постоянную policy `no live bindings in Git` для этого репозитория.
- `scripts/check-public-surface.ps1` - проверяет tracked template и ищет типовые live-binding утечки по tracked текстовым файлам.

## Decisions Made

- Рабочая binding-конфигурация не документируется как tracked артефакт: для Git остаётся только `.clasp.example.json` с placeholders.
- Audit public-ready состояния проверяет именно tracked Git surface через `git ls-files`, чтобы не путать public proof с upload-правилами `clasp`.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

- В этой среде `gsd-tools.cjs` находится под `C:\Users\Mikhail\.codex\get-shit-done\bin`, а не под `~/.claude`; выполнение было продолжено через локальный `.codex` path без изменения плана.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Безопасная tracked surface для public Git закреплена и проверяется автоматизированно.
- Следующий план `01-02` может опираться на `.clasp.example.json`, `appsscript.json` и `docs/repository-sanitization.md` как на уже нормализованные опорные артефакты.

## Self-Check: PASSED

- FOUND: `.planning/phases/01-github-bootstrap/01-01-SUMMARY.md`
- FOUND: `441a1f0`
- FOUND: `88ddbb6`
- FOUND: `59ffa3b`

---
*Phase: 01-github-bootstrap*
*Completed: 2026-03-09*
