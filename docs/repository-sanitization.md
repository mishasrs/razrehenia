# Sanitization policy репозитория

Правило репозитория: `no live bindings in Git`.

Этот проект хранит в Git только публичные шаблоны и код, которые можно безопасно клонировать новому maintainer. Любая рабочая привязка к конкретному Spreadsheet, Apps Script-контейнеру, Drive-папке или Telegram-боту считается operational data и остаётся вне tracked surface.

## Что можно хранить в Git

- `.clasp.example.json` как обезличенный шаблон локальной привязки c `YOUR_SCRIPT_ID` и `YOUR_SPREADSHEET_ID`.
- `.claspignore` как правило push-surface для `clasp`, чтобы в контейнер уходили только `.gs`, `.html` и `appsscript.json`.
- `appsscript.json` как tracked manifest с runtime-настройками и зависимостями платформы.
- Документацию и будущий `README.md`, если в них используются только placeholders, имена ключей и команды без live значений.

## Что не должно попадать в tracked surface

- Локальный `.clasp.json` с рабочими `scriptId`, `parentId` и другой binding-конфигурацией.
- Реальные Drive folder IDs, Spreadsheet IDs, Apps Script IDs, Telegram bot token, chat IDs и другие production-привязки.
- Примеры из docs и команд, которые содержат не placeholder, а реальное operational значение.

## Как работать с шаблонами

- Создавайте локальный `.clasp.json` из `.clasp.example.json`, подставляя свои значения только в рабочей копии.
- Не заменяйте `YOUR_SCRIPT_ID` и `YOUR_SPREADSHEET_ID` в tracked `.clasp.example.json`.
- Если будущий `README.md` или другие docs показывают конфигурацию, они должны ссылаться на `.clasp.example.json` и использовать только placeholders.

## Проверка перед публикацией

Запускайте из корня репозитория:

```powershell
powershell -ExecutionPolicy Bypass -File scripts/check-public-surface.ps1
```

Скрипт проверяет tracked файлы, placeholder-модель в `.clasp.example.json` и ищет очевидные утечки operational ids в docs и конфигурации.
