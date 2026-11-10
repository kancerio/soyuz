# Как запустить тесты PostgreSQL

Эти интеграционные тесты подключаются к настоящей PostgreSQL и проверяют запись/чтение пользователей и сообщений, уникальность email и username, обязательное поле email и обновление сообщения.

## Запуск в Windows PowerShell

Нужны Node.js/npm и Docker Desktop. Откройте PowerShell в папке проекта и выполните:

```powershell
docker run --name soyuz-postgres-test -e POSTGRES_USER=messenger -e POSTGRES_PASSWORD=secretpassword -e POSTGRES_DB=soyuz_test -p 5433:5432 -d postgres:15-alpine
```

Перейдите в backend, установите зависимости и включите интеграционный режим:

```powershell
cd backend
npm.cmd ci
$env:DB_INTEGRATION_TESTS = 'true'
$env:DB_HOST = '127.0.0.1'
$env:DB_PORT = '5433'
$env:DB_USERNAME = 'messenger'
$env:DB_PASSWORD = 'secretpassword'
$env:DB_DATABASE = 'soyuz_test'
npm.cmd test -- --runInBand postgres.integration.spec.ts
```

Успешный результат выглядит примерно так:

```text
Test Suites: 1 passed, 1 total
Tests:       4 passed, 4 total
```

В Jest также должны быть отмечены зелёным четыре проверки. При ошибке подключения проверьте, что контейнер запущен командой `docker ps` и порт 5433 свободен.

## Важно

Тест пересоздаёт схему выбранной базы (`dropSchema: true`). Защита в тесте допускает подключение только к базе, имя которой заканчивается на `_test`. Используйте только отдельную тестовую базу, например `soyuz_test`, никогда не указывайте рабочую `messenger_db`.

После тестов контейнер можно остановить и удалить:

```powershell
docker rm -f soyuz-postgres-test
```

CI запускает эту же команду Jest на временном сервисе PostgreSQL 15.
