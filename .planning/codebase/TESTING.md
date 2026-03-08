# Тестирование

## Текущее состояние
- На дату `2026-03-08` в репозитории нет автоматизированного тестового контура.
- В корне отсутствуют `package.json`, `tests/`, `__tests__/`, `*.spec.*`, `*.test.*`, конфигурации Jest/Vitest/Mocha и любые CI workflow-файлы.
- Проект управляется через `.clasp.json` и `.claspignore`, но локальный runner для unit-тестов не настроен.
- `appsscript.json` включает `runtimeVersion: "V8"` и advanced service `Drive v2`, однако тестовая среда отдельно не описана.
- Фактическая стратегия контроля качества сейчас ручная: запуск menu actions в привязанной Google Spreadsheet, просмотр листов `Разрешения`, `Витрина`, `Logs` и выборочная проверка Telegram- и QR-сценариев.

## Что уже проверяется самим кодом
- В кодовой базе есть много defensive-checks, которые частично заменяют тесты: `getRootFolderId_` в `10_DriveRepo.gs` валидирует наличие `ROOT_FOLDER_ID`, `tgSendFromUi` в `31_Telegram.gs` проверяет выбранные файлы и получателей, `parsePermissionFilename_` в `90_Utils.gs` возвращает `null` на невалидный формат.
- QR- и Telegram-интеграции валидируют `HTTP` и полезную нагрузку вручную. Примеры: `quickChartDecode_`, `goQrDecode_`, `tgApplyEmployeeBotCommands_`, `tgSendMessage_`, `tgSendDocument_`.
- Долгий scan workflow защищён от повторного запуска и таймаута через `LockService` и `timeAlmostUp_` в `40_ScanJob.gs` и `02_RunControl.gs`.
- Эти проверки полезны, но они не заменяют регрессионные тесты, потому что большая часть поведения остаётся проверяемой только в runtime Apps Script.

## Реальные ручные smoke-сценарии
- Меню и bootstrap: открыть Spreadsheet и убедиться, что `onOpen` из `00_MainUi.gs` создал меню `Разрешения` и вложенное меню Telegram со всеми действиями.
- Базовая конфигурация: вызвать `uiSetRootFolder` из `00_MainUi.gs`, сохранить тестовый `ROOT_FOLDER_ID`, затем проверить, что `getRootFolderId_` и `refreshView_` используют это значение без дополнительных правок кода.
- Первичный импорт: в тестовой папке Drive подготовить несколько PDF с валидными и невалидными именами, затем выполнить `scanAndUpdate` из `40_ScanJob.gs` и проверить, что `ensureSheet_` из `11_SheetsRepo.gs` создал лист `Разрешения`, а файлы с плохим именем попали в `Logs` как `WARN`.
- Повторная синхронизация: переименовать уже импортированный PDF, переместить его вне дерева папок или отправить в корзину и снова запустить `scanAndUpdate`; ожидаемая точка поведения находится в `syncExistingRowsChunked_` из `11_SheetsRepo.gs`.
- QR-диагностика: использовать `diagnoseOne` из `40_ScanJob.gs` на одном известном `file_id`, прежде чем проверять массовое дозаполнение или полный scan.
- Дозаполнение QR: вручную очистить колонку `QR` на нескольких строках и запустить `fillMissingQr`; проверить, что функция вернула не просто текст `QR`, а `RichTextValue` со ссылкой, как это делает `11_SheetsRepo.gs`.
- Витрина: выполнить `refreshView` и проверить, что `20_View.gs` заново построил лист `Витрина`, сгруппировал записи по `ТС`, скрыл технические колонки `H:I` и сохранил условное форматирование сроков.
- Sidebar Telegram: на листе `Разрешения` и отдельно на листе `Витрина` выделить строки, открыть `tgOpenSendSidebar` и проверить, что `TelegramSend.html` получает данные через `tgGetSidebarData`, а список файлов и контактов совпадает с выделением.
- Telegram menu bot: выполнить `tgInitEmployeeBot`, затем `tgSyncChatIdsFromUpdates`, затем `tgSendEmployeeMenuToActiveContacts`; проверить лист `Контакты`, Telegram-клавиатуру и корректность role-based ссылок, которые формирует `tgFolderIdForRole_`.
- Завершение scan job: после большого прогона проверить, что при таймауте появляются триггеры продолжения через `scheduleContinue_`, а при завершении `refreshView_` вызывается только в финальной ветке `scanAndUpdateCore_`.

## Хрупкие места без автоматизации
- Парсинг имён файлов в `90_Utils.gs` критичен для ingest-пайплайна. Если `parsePermissionFilename_` сломается, `scanAndUpdateCore_` просто пропустит PDF и запишет предупреждение, поэтому потери данных могут выглядеть как "ничего не случилось".
- Синхронизация rich text в `11_SheetsRepo.gs` и `20_View.gs` легко ломается при мелких изменениях, потому что значение ячейки и ссылка живут отдельно. Ошибка может проявиться только визуально в таблице.
- В QR-пайплайне `12_QrService.gs` много fallback-веток и silent catch-блоков. Это снижает шум, но увеличивает риск тихой деградации, особенно при изменениях внешних API `quickchart.io`, `api.qrserver.com` или thumbnail-ответов Drive.
- Telegram-интеграция в `31_Telegram.gs` зависит от реальных сетевых ответов и форматов payload. Без моков нельзя быстро проверить ветки ошибок, `reply_markup` и ограничения caption.
- Логика continue/stop разбита между `01_Config.gs`, `02_RunControl.gs` и `40_ScanJob.gs`. Небольшая правка в курсоре, таймингах или trigger-cleanup может вызвать дубли или пропуски строк без мгновенно заметной ошибки.
- `TelegramSend.html` не имеет автоматических проверок DOM и relies on `google.script.run`; любые регрессии в разметке, флагах `withPdf/withQr` или selection rendering сейчас ловятся только руками.

## Лучшие кандидаты для unit-тестов
- `90_Utils.gs` уже почти готов к table-driven тестам: `parsePermissionFilename_`, `extractRoute_`, `extractUntilFromText_`, `extractNumberWithUnit_`, `parseRuDate_`, `normalizeSpaces_`, `safeToNumber_`.
- В `31_Telegram.gs` хорошо тестируются чистые formatter/helper-функции: `tgNormalizeRole_`, `tgRoleLabel_`, `tgShortFileCode_`, `tgFmtVal_`, `tgHtmlEscape_`, `tgExtractDriveFileId_`, `tgBuildCaptionHtml_`.
- В `12_QrService.gs` уже есть небольшие детерминированные seams: `postFilter_`, `sniffType_`, `bytesToAsciiPrefix_`, частично `maybeDecodeBase64ImageBytes_`.
- В `02_RunControl.gs` чистым кандидатом остаётся `timeAlmostUp_`.
- В `20_View.gs` можно тестировать `groupByKey_` и `startOfDay_` без платформенного окружения.

## Полезные seams для выделения при будущей автоматизации
- В `20_View.gs` стоит отделить преобразование сырых строк таблицы от фактических вызовов `SpreadsheetApp`. Например, логику из `readDataRows_` можно разложить на "fetch ranges" и "map arrays to row DTO".
- В `11_SheetsRepo.gs` полезно вынести чистую функцию согласования строки с текущим файлом: входом могут быть `row`, `fileMeta`, `fileRich`, `qrRich`, выходом `nextRow`, `nextFileRich`, `nextQrRich`, `delete`, `updated`.
- В `40_ScanJob.gs` можно отделить принятие решения `needContinue` от побочных эффектов `scheduleContinue_` и `refreshView_`, чтобы тестировать переходы состояния как pure policy.
- В `31_Telegram.gs` вызовы `UrlFetchApp.fetch` стоит завернуть в небольшой adapter, чтобы отдельно тестировать разбор ответов `setMyCommands`, `getUpdates`, `sendMessage`, `sendDocument`.
- В `12_QrService.gs` подготовку thumbnail, преобразование изображения и разбор ответа QR API лучше считать отдельными слоями. Сейчас они уже частично разделены по функциям, но ещё тесно связаны с Apps Script blobs и `ImagesService`.
- Для `TelegramSend.html` удобный seam появится, если вынести `selectedFiles`, `selectedChatIds` и формирование payload в отдельный модуль или хотя бы в функции, которые принимают данные и DOM-обёртки как параметры.

## Что имеет смысл оставить интеграционным
- Работа с `SpreadsheetApp`, `DriveApp`, `ScriptApp`, `LockService`, `CacheService`, `HtmlService` и `PropertiesService` в этом проекте естественно образует интеграционные границы.
- Полный scan `scanAndUpdateCore_`, реальное чтение thumbnail через Drive, фактическое распознавание QR и отправка в Telegram должны оставаться ручными или staging-интеграционными проверками даже после появления unit-тестов.
- Проверка conditional formatting и layout листа `Витрина` тоже ближе к интеграционному уровню, потому что зависит от поведения Spreadsheet UI, локали и rich text.

## Рекомендуемый минимальный набор автопокрытия
- Набор 1: таблица кейсов для `parsePermissionFilename_` на реальных именах из домена, включая десятичную ширину, латинские `t/m`, двузначный год и некорректные строки без `_`.
- Набор 2: snapshot-подобные тесты для `tgBuildCaptionHtml_`, плюс проверки `tgNormalizeRole_` и `tgExtractDriveFileId_`.
- Набор 3: policy-тесты для `timeAlmostUp_`, `postFilter_`, `sniffType_`.
- Набор 4: минимальные DOM-тесты sidebar-логики `TelegramSend.html`, если проект когда-либо заведёт локальный JS runner.
- Даже после этого ручные smoke-сценарии для Drive/Sheets/Telegram останутся обязательными, потому что основная ценность проекта находится на границе с внешними сервисами.

## Практический чеклист после изменений
- После правок `90_Utils.gs` прогонять минимум один успешный и один неуспешный filename-case вручную через `scanAndUpdate` или изолированно через локальный тестовый harness.
- После правок `11_SheetsRepo.gs` проверять видимый текст `PDF`/`QR`, сохранность rich text ссылок и корректировку `PROP_SYNC_CURSOR`.
- После правок `12_QrService.gs` сначала запускать `diagnoseOne`, потом `fillMissingQr`, и только затем полный `scanAndUpdate`.
- После правок `20_View.gs` или `21_DataFormat.gs` проверять группировку, скрытые колонки `H:I`, условное форматирование и корректность ссылок на файлы/QR.
- После правок `31_Telegram.gs` проверять оба режима отправки: `PDF + QR в caption` и `только QR сообщением`, а также сценарии `роль не назначена` и `контакт неактивен`.
- После правок `00_MainUi.gs` и `40_ScanJob.gs` проверять menu actions, stop/continue и отсутствие дублей time-based triggers.
