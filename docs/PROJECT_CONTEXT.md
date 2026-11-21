# Контекст проекта «Союз» — для работы в новых чатах

Этот файл — точка входа для ИИ-ассистента или разработчика, который впервые
открывает репозиторий. Прочитай его целиком перед работой.

## Что это за проект

«Союз» — мессенджер с ИИ-функциями для строительной тематики:

- персональный перевод сообщений на язык настроек каждого получателя;
- поиск строительных терминов в сообщениях с карточками-объяснениями
  и ссылками на Wikipedia;
- голосовые сообщения с распознаванием речи (STT) и кратким резюме;
- ИИ-рерайт текста (shorten/formal/friendly) и сводка переписки.

## Архитектура

Три сервиса + инфраструктура:

| Компонент | Стек | Порт | Каталог |
| --- | --- | --- | --- |
| Frontend | Next.js 14 (App Router), React 18, Tailwind, socket.io-client | 3000 | `src/` |
| Backend | NestJS 11, TypeORM, Socket.IO, JWT, Redis-кэш | 3001 | `backend/` |
| AI-сервис | FastAPI, uvicorn, OpenAI-совместимый клиент (LM Studio) | 8000 | `ai-service/` |
| Postgres 15 | БД сообщений/пользователей/чатов | 5432 | docker compose |
| Redis 7 | кэш переводов и терминов | 6379 | docker compose |

`app_ai/` — более ранняя/альтернативная реализация AI на FastAPI;
**активный AI-сервис — `ai-service/`** (именно его контракт описан в
`docs/api-contracts.md` и его собирает docker-compose).

Запуск всего стека: `docs/run-local.md` (Linux и Windows/PowerShell).
Локальная модель: `docs/lm-studio-local.md`.

## Ключевые документы (docs/)

- `api-contracts.md` — контракты AI-эндпоинтов `/translate`, `/assist`,
  `/stt`, `/summary`, `/construction-terms` (версия 0.3.0).
- `construction-terms-integration.md` — JSON-контракт терминов и задачи
  Backend/Frontend по интеграции.
- `language_codes.md` — 27 поддерживаемых кодов ISO 639-1.
- `run-local.md` — пошаговый запуск на Linux и Windows.
- `ai-api.yaml` — OpenAPI-схема AI-сервиса.
- `message_fields_reserved.md`, `realtime_scaling_recommendations.md`,
  `translation_test_cases.md` — проектные заметки.

## Потоки данных

### Аутентификация

- `POST /auth/register`, `POST /auth/login` → `{accessToken (15 мин), refreshToken (7 дн), user}`.
- `POST /auth/refresh` — ротация refresh-токена.
- Фронт хранит токены в `sessionStorage` (`src/lib/apiClient.ts`), при 401 —
  автоматический refresh (общий `refreshPromise`), при неудаче — редирект на
  `/login`. WS переподписывается свежим токеном (`reauthSocket`).
- User: `id, email, username, password, refreshToken, preferred_language`
  (27 кодов, default `en`), `country_code` (ISO 3166-1 alpha-2, default `RU`).
- `PATCH /users/language`, `PATCH /users/country`, `GET /users/me`.

### Сообщения и персональный перевод

- REST `POST /messages/chat/:chatId` или WS `send_message` → единый путь
  `MessagesService.sendMessageWithTranslation()`.
- Язык сообщения = явный `sourceLang` либо `preferred_language` отправителя
  (НЕ `auto` — иначе недетерминированно, кому перевод не нужен).
- Фоновая задача переводит текст на **каждый уникальный язык участников чата**
  (`Message.translations: { [lang]: { text, status } }`, jsonb). Участники с
  языком сообщения перевод не получают; если таких все — `translateStatus =
  'skipped'`.
- События: `message.created` → WS `new_message`; `message.translated` → WS
  `message_translated` с `{messageId, chatId, sourceLang, translations,
  translateStatus}`. Отправка сообщения не ждёт AI.
- Фронт: `MessageText.tsx` — получатель видит **сразу перевод** на язык своих
  настроек, оригинал — по кнопке «Показать оригинал»; при совпадении языков
  перевод не используется. Кэш переводов в Redis (1 ч).

### Строительные термины

- Backend `POST /messages/:messageId/construction-terms` (JWT): проверка
  членства в чате; текст из сохранённого сообщения, `source_language` —
  из сообщения/профиля отправителя, `country_code` — из профиля отправителя,
  `response_language` — из настроек запрашивающего. Клиентским данным не
  доверяем. Кэш Redis по `messageId + язык + страна + хэш текста`.
- AI `POST /construction-terms`: LLM извлекает точные подстроки → поиск
  статьи через Wikimedia REST API на языке сообщения → краткое объяснение
  на языке интерфейса. `start`/`end` — **UTF-16 смещения JS-строки**.
  Mock-режим возвращает `terms: []` (контракт проверяется, реального
  поиска нет).
- Фронт: кнопка «Термины» на сообщении → подсветка по диапазонам
  (проверка границ, повторный поиск при расхождении, пересечения,
  суррогатные пары) → карточка (термин, объяснение, страна, «Wikipedia»,
  «Подробнее» → `source_url` с `target=_blank rel=noopener noreferrer`),
  `dir="auto"` для RTL, закрытие по Esc/клику вне.

### Голосовые сообщения

- `POST /messages/chat/:chatId/voice` (multipart, ≤20 МБ, проверка magic
  bytes) → файл в `backend/uploads/voice/` → фон: STT (`/stt`) → summary
  (если транскрипт ≥ 50 символов). События `message_transcribed`,
  `message_voice_summary`. Аудио отдаёт `GET /messages/voice/:fileId`
  с проверкой участия.

### WebSocket (Socket.IO, тот же порт 3001)

- `auth` (JWT, без него — `auth_error`; insecure-фолбэк только при
  `WS_ALLOW_INSECURE_AUTH=true`), `join_chat`/`leave_chat` (проверка
  участия), `send_message`, `edit_message`, `delete_message`,
  `message_delivered`, `message_read`, `typing`, `get_online_users`.
- Gateway проксирует доменные события EventEmitter2 в комнаты `chat_<id>`.

## Состояние репозитория (последние коммиты)

1. `c3b51d4` — строительные термины (backend-маршрут + фронт-подсветка) и
   персональный перевод; `users.country_code`; 27 языков в DTO; миграция
   `1713400000000-AddUserCountryAndMessageTranslations`.
2. `650f76b` — починен `nest build` (была не установлена dev-зависимость
   `@types/multer`).
3. `86c710e` — CORS: добавлен `bypass-tunnel-reminder` в `allowedHeaders`
   (фронт шлёт его в каждом запросе; без него браузер блокировал запросы).

## Важные нюансы (частые грабли)

- **404 `Cannot GET /` на :3001 — норма**, корневого маршрута нет. Проверка
  жизни: `GET /users` → 401.
- **Миграции**: `synchronize: false`. После обновления кода —
  `npm run migration:run --prefix backend`, иначе TypeORM упадёт на запросах
  с новыми колонками.
- **CORS**: `allowedHeaders` в `backend/src/main.ts` обязан включать
  `bypass-tunnel-reminder`. Origin-ы: localhost:3000 + `FRONTEND_URL` из env.
- **AI mock-режим** (`AI_MOCK_MODE=true` по умолчанию): переводы вида
  `[mock en->ru] ...`, термины — пустой массив. Реальный режим:
  `AI_PROVIDER=lmstudio`, `AI_BASE_URL`, `AI_MODEL` = точный id модели из
  `GET /v1/models` LM Studio; расхождение id или незагруженная модель →
  503. Эмбеддинг-модели (nomic-embed и т.п.) для chat/completions не подходят.
- **Windows**: `curl` в PowerShell — алиас `Invoke-WebRequest` (другой
  синтаксис, предупреждение о парсинге). Для API-запросов —
  `Invoke-RestMethod -Method Post -ContentType "application/json"`.
- Jest-тесты backend создают/удаляют временные файлы в
  `backend/uploads/voice/` — артефакты после прогона можно удалять.
- Каталог `.next/` отслеживается в git (так исторически сложилось) — сборки
  меняют его файлы; в feature-коммиты не включать.

## Тесты и проверки

- Backend: `npm test --prefix backend` (jest; 15 suites, ~82 теста;
  1 suite skipped — live-тесты AI: `npm run test:ai-live`).
- Сборка backend: `npm run build --prefix backend` (nest build).
- Frontend: `npm run build` (next build) или `npx tsc --noEmit`.
- AI-сервис: `pytest` в `ai-service/`.

## Стиль и соглашения

- Комментарии и сообщения коммитов — на русском.
- Backend: NestJS + class-validator DTO; ошибки AI пробрасываются как
  502/503/504 через `throwAiFailure`, сообщение при этом не ломается.
- Фоновые AI-задачи не блокируют сохранение/отправку сообщения.
- Frontend: клиентские компоненты `'use client'`, состояние через
  контексты (`UserContext`, `LanguageContext`, `SocketContext`), стили —
  Tailwind, тёмная тема через `dark:`.
- Не добавлять новых зависимостей без необходимости; сначала проверить
  импорты/package.json.

---

## Системный промт для новых чатов

Скопируй текст ниже в начало нового чата (приложи или укажи путь к этому
файлу — `docs/PROJECT_CONTEXT.md`):

```text
Ты — разработчик проекта «Союз»: мессенджер с ИИ (Next.js + NestJS + FastAPI,
Postgres, Redis). Сначала прочитай docs/PROJECT_CONTEXT.md — там архитектура,
потоки данных, нюансы и текущее состояние репозитория. Ключевые правила:

1. Перед изменениями читай существующий код и следуй его стилю; комментарии
   и коммиты — на русском.
2. Не доверяй клиенту: язык/страна/права проверяются на backend из БД
   и членства в чате.
3. AI-вызовы — только фоном или по запросу, никогда не блокируют отправку
   сообщения; ошибки AI → статус failed, сообщение остаётся доступным.
4. После изменения сущностей — миграция (synchronize выключен) и прогон
   jest (backend) и next build (frontend).
5. Диапазоны терминов start/end — UTF-16 индексы JS-строки; на фронте —
   защита границ и суррогатных пар.
6. Поддерживаемые языки — ровно 27 кодов из docs/language_codes.md
   (общий список backend/src/common/languages.ts).
7. По завершении — локальный коммит на русском с описанием что и зачем.
```
