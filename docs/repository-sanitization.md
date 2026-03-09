# Sanitization policy репозитория

Правило репозитория: `no live bindings in Git`.

Этот проект хранит в Git только публичные шаблоны и код, которые можно безопасно клонировать новому maintainer. Любая рабочая привязка к конкретному Spreadsheet, Apps Script-контейнеру, Drive-папке или Telegram-боту считается operational data и остаётся вне tracked surface.

## Proof flow

Проверка public-ready состояния идёт по одной и той же цепочке:

1. `README.md` подтверждает актуальный quickstart и базовый bootstrap-path.
2. Этот документ фиксирует policy `no live bindings in Git`.
3. `docs/public-ready-checklist.md` даёт короткий checklist по tracked code/config/docs и спорным runtime-зависимостям вроде `ImagesService`.
4. `scripts/check-public-surface.ps1` даёт повторяемый automated proof по tracked text surface.

## Что можно хранить в Git

- `.clasp.example.json` как обезличенный шаблон локальной привязки c `YOUR_SCRIPT_ID` и `YOUR_SPREADSHEET_ID`.
- `.claspignore` как правило push-surface для `clasp`, чтобы в контейнер уходили только `.gs`, `.html` и `appsscript.json`.
- `appsscript.json` как tracked manifest с runtime-настройками и зависимостями платформы.
- Документацию и `README.md`, если в них используются только placeholders, имена ключей и команды без live значений.

## Что не должно попадать в tracked surface

- Локальный `.clasp.json` с рабочими `scriptId`, `parentId` и другой binding-конфигурацией.
- Реальные Drive folder IDs, Spreadsheet IDs, Apps Script IDs, Telegram bot token, chat IDs и другие production-привязки.
- Примеры из docs и команд, которые содержат не placeholder, а реальное operational значение.

## Как работать с шаблонами

- Создавайте локальный `.clasp.json` из `.clasp.example.json`, подставляя свои значения только в рабочей копии.
- Не заменяйте `YOUR_SCRIPT_ID` и `YOUR_SPREADSHEET_ID` в tracked `.clasp.example.json`.
- Если будущий `README.md` или другие docs показывают конфигурацию, они должны ссылаться на `.clasp.example.json` и использовать только placeholders.

## Проверка перед публикацией

Сначала пройдите `docs/public-ready-checklist.md`, затем запустите из корня репозитория:

```powershell
powershell -ExecutionPolicy Bypass -File scripts/check-public-surface.ps1
```

Скрипт проверяет tracked files из `git ls-files`, placeholder-модель в `.clasp.example.json`, обязательные proof-артефакты (`README.md`, `docs/public-ready-checklist.md`, `docs/repository-sanitization.md`, `.claspignore`, `appsscript.json`) и ищет очевидные утечки operational ids в code/docs/config.
