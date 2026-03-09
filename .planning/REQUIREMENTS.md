# Requirements: Разрешения

**Defined:** 2026-03-08
**Core Value:** Оператор получает актуальный и надёжный реестр разрешений из Drive без ручной пересборки данных и без потери рабочих сценариев отправки

## v1 Requirements

### Публичный репозиторий и bootstrap

- [x] **BOOT-01**: Разработчик может привязать локальную копию репозитория к своему Apps Script/Spreadsheet через обезличенный пример конфигурации без публикации live `scriptId` и `parentId` в Git
- [x] **BOOT-02**: Maintainer может по русской инструкции восстановить обязательные `Script Properties`, нужные листы, advanced services и installable triggers без скрытых ручных шагов
- [x] **BOOT-03**: Публичный репозиторий хранит только обезличенные конфигурационные примеры и не содержит отслеживаемых live secrets, operational ids или привязок к production-окружению

### Безопасные интеграции

- [ ] **SAFE-01**: Оператор получает явную preflight-ошибку, если перед scan/send отсутствуют обязательные папки, листы, свойства или Telegram-настройки
- [ ] **SAFE-02**: Система отправляет документы в Telegram только по явно настроенному маршруту роли; отсутствие папки или разрешения для роли завершает сценарий безопасным отказом
- [ ] **SAFE-03**: Maintainer может понять и настроить QR provider policy, fallback и внешний data egress по документации и конфигурации, не читая весь код построчно

### Надёжность данных и фоновых сценариев

- [ ] **DATA-01**: Chunked sync продолжает работу с корректного курсора после stop/timeout и не пропускает необработанные строки
- [ ] **DATA-02**: Синхронизация различает временные ошибки доступа к Drive и реальные удаления, поэтому строки реестра не исчезают молча из-за transient failures
- [ ] **DATA-03**: Telegram polling обрабатывает обновления ровно один раз даже при пересечении ручного запуска и trigger-выполнения
- [ ] **DATA-04**: Оператор или maintainer может увидеть понятное состояние фонового сценария (`started`, `paused`, `rescheduled`, `completed`, `failed`) и причину остановки

### Производительность и квоты

- [ ] **PERF-01**: Массовая Telegram-отправка повторно использует уже загруженные PDF в пределах одного execution, а не читает каждый файл заново для каждого получателя
- [ ] **PERF-02**: QR backfill обновляет только изменившиеся QR/`updated_at` диапазоны, а не переписывает весь реестр целиком
- [ ] **PERF-03**: Ключевые scan/sync/view потоки избегают лишних построчных и полнолистовых операций, которые без необходимости расходуют Apps Script quotas

### Проверка и эксплуатация

- [ ] **OPS-01**: Maintainer может выполнить локальную синтаксическую и минимальную smoke-проверку проекта без production-секретов
- [ ] **OPS-02**: Команда может проверить изменения в отдельном staging-контуре Apps Script / Drive / Telegram до применения их в рабочей среде
- [ ] **OPS-03**: Публичная документация содержит минимальный regression checklist для scan, QR, view, sidebar и Telegram flows

## v2 Requirements

### Эксплуатационное усиление

- **OPS-04**: Maintainer может подключить проект к standard Google Cloud project и использовать Cloud Logging как основной инженерный журнал
- **OPS-05**: Команда видит отдельную dashboard/сводку по последним scan, QR и Telegram ошибкам без ручного чтения листа `Logs`

### Дальнейшие улучшения потока данных

- **DATA-05**: Система помещает проблемные PDF в отдельный quarantine/inbox с причиной и действиями `retry` / `ignore` / `mark fixed`
- **PERF-04**: Drive inventory использует инкрементальный индекс или fingerprint-подход вместо полного обхода дерева на каждом прогоне
- **TG-01**: Оператор может увидеть dry-run preview Telegram-рассылки до фактической отправки

## Out of Scope

| Feature | Reason |
|---------|--------|
| Полная миграция с Google Apps Script на другой runtime | Не соответствует цели текущего stabilisation milestone и резко увеличивает стоимость изменений |
| Крупный rewrite пользовательского интерфейса | Сейчас приоритет на надёжность существующих операторских сценариев, а не на новый UI-контур |
| Новые каналы доставки помимо Telegram | Не решает текущие риски scan/sync/QR/send и расширяет поверхность отказов |
| OCR/ML-извлечение данных из PDF | Сильно увеличивает сложность и внешние зависимости до стабилизации базового потока |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| BOOT-01 | Phase 1 | Complete |
| BOOT-02 | Phase 1 | Complete |
| BOOT-03 | Phase 1 | Complete |
| SAFE-01 | Phase 2 | Pending |
| SAFE-02 | Phase 2 | Pending |
| SAFE-03 | Phase 2 | Pending |
| DATA-01 | Phase 3 | Pending |
| DATA-02 | Phase 3 | Pending |
| DATA-03 | Phase 3 | Pending |
| DATA-04 | Phase 3 | Pending |
| PERF-01 | Phase 4 | Pending |
| PERF-02 | Phase 4 | Pending |
| PERF-03 | Phase 4 | Pending |
| OPS-01 | Phase 5 | Pending |
| OPS-02 | Phase 5 | Pending |
| OPS-03 | Phase 5 | Pending |

**Coverage:**
- v1 requirements: 16 total
- Mapped to phases: 16
- Unmapped: 0

---
*Requirements defined: 2026-03-08*
*Last updated: 2026-03-08 after initial definition*
