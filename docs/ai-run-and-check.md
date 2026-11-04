# AI: запуск и проверка

Инструкция соответствует корню репозитория: `src/` — Frontend, `backend/` —
NestJS API, `ai-service/` — FastAPI-провайдер. `app_ai` — отдельное имя каталога
в legacy-части проекта; переименование не требуется.

## API-контракты

Внутренние AI-маршруты доступны сервису Backend на `http://ai-service:8000`.
Примеры ниже показывают тела запросов; Backend-маршруты закрыты JWT и требуют
`Authorization: Bearer <access-token>`.

| Операция | Backend route | AI route | Тело / результат |
|---|---|---|---|
| Перевод | `POST /messages/translate` | `POST /translate` | JSON `{ "text": "Доброе утро", "source_lang": "ru", "target_lang": "en" }`; Backend возвращает `translatedText`, `sourceLang`, `targetLang`, `status`, `mock`. |
| Улучшение текста | `POST /messages/assist` | `POST /assist` | JSON `{ "text": "Пришлите отчет сегодня", "action": "formal" }`; `action` — `shorten`, `formal` или `friendly`; Backend возвращает `resultText`, `action`, `status`, `mock`. |
| Сводка | `POST /messages/summary` | `POST /summary` | JSON `{ "messages": [{ "sender_id": "alice", "text": "Релиз в пятницу", "timestamp": "10:00" }], "language": "ru" }`; результат: `summary`, `decisions[]`, `participants[]`, `language`, `provider`, `status`. |
| Расшифровка | `POST /messages/transcribe` | `POST /stt` | `multipart/form-data`, поле `file` на Backend / `audio` для прямого AI-запроса, необязательное поле `language`; Backend принимает до 20 MiB, AI service — до значения `MAX_AUDIO_BYTES` (по умолчанию 25 MiB). Результат: `transcript`, `language`, `provider`, `status`. |

Языки: `ru`, `en`, `de`, `fr`, `es`, `zh`, `ar`; для языка источника перевода
также разрешён `auto`. Текст ограничен 5 000 символами, сводка — 1–100
сообщений. При ошибке валидации Backend отвечает HTTP 400, AI service — HTTP
422 с `error.code`, `error.message`, `error.details[]` и `correlation_id`.
Недоступный провайдер преобразуется Backend в HTTP 503; тайм-аут — 504; прочая
ошибка провайдера — 502. Ошибки Backend имеют стандартное NestJS-тело
`{statusCode, message, error}`. AI service также добавляет
`X-Correlation-ID`.

Примеры успешных ответов AI service:

```json
{
  "input_text": "Доброе утро",
  "result": "Good morning",
  "action": "translate",
  "source_lang": "ru",
  "target_lang": "en",
  "correlation_id": "...",
  "mock": false
}
```

```json
{
  "summary": "Релиз запланирован на пятницу",
  "decisions": ["Релиз в пятницу"],
  "participants": ["alice"],
  "language": "ru",
  "provider": "lmstudio"
}
```

```json
{
  "transcript": "Релиз запланирован на пятницу",
  "recognized_text": "Релиз запланирован на пятницу",
  "language": "ru",
  "provider": "openai_compatible"
}
```

## Mock-запуск

Docker Compose по умолчанию использует mock и не скачивает модели:

```powershell
Copy-Item .env.example .env
docker compose up --build postgres redis ai-service
```

Для Frontend и Backend установите зависимости и запустите приложения в
отдельных терминалах:

```powershell
npm.cmd ci
npm.cmd run dev
```

```powershell
Set-Location backend
npm.cmd ci
npm.cmd run start:dev
```

Адреса по умолчанию: Frontend `http://localhost:3000`, Backend
`http://localhost:3001`, AI service `http://localhost:8000`; Swagger AI —
`http://localhost:8000/docs`.

## Реальные локальные модели

Запустите LM Studio Local Server с загруженной chat-моделью и Whisper adapter,
затем задайте в `.env`:

```dotenv
AI_MOCK_MODE=false
AI_PROVIDER=lmstudio
AI_BASE_URL=http://host.docker.internal:1234/v1
AI_MODEL=<точный-id-модели-из-LM-Studio>
AI_API_KEY=lm-studio
AI_TIMEOUT_SECONDS=120
AI_REASONING_EFFORT=none
STT_PROVIDER=openai_compatible
STT_BASE_URL=http://host.docker.internal:9000/v1
STT_MODEL=whisper-1
STT_TIMEOUT_SECONDS=120
```

PowerShell Whisper adapter запускается на хосте:

```powershell
Set-Location ai-service
python -m pip install -r requirements-stt-local.txt
$env:WHISPER_MODEL = 'Systran/faster-whisper-base'
$env:WHISPER_DEVICE = 'cpu'
$env:WHISPER_COMPUTE_TYPE = 'int8'
python tools/local_whisper_server.py
```

Проверьте `/v1/models` в LM Studio и доступность Whisper до запуска Compose.
Для контейнера `host.docker.internal` настроен в Compose. В режиме реальной
модели ответы должны подтверждать провайдера: `mock: false`, `provider: "lmstudio"`
для текстовых операций и `provider: "openai_compatible"` для STT. Ответы mock
провайдера нельзя использовать как подтверждение работы моделей.

## Проверки и CI

Повторить команды из корня:

```powershell
npm.cmd ci
npm.cmd run build
Set-Location backend
npm.cmd ci
npm.cmd run build
$env:NODE_OPTIONS = '--experimental-vm-modules'
npm.cmd test -- --runInBand --coverage
npm.cmd test -- --runInBand postgres.integration.spec.ts
Set-Location ..
python -m pip install -r ai-service/requirements.txt
python -m pytest ai-service/tests -v
docker build -f docker/Dockerfile.ai -t soyuz-ai:local .
```

Workflow `.github/workflows/ci.yml` выполняет установку и production-сборку
Frontend, установку/сборку/тесты Backend, AI pytest, PostgreSQL integration
tests и сборку со smoke-проверкой mock Docker-образа. Ни один из этих CI этапов
не требует LM Studio или скачанных моделей.

Ручной real smoke test находится в
`backend/src/translation/translation.service.live.test.ts` и намеренно не
входит в обычный CI:

```powershell
Set-Location backend
$env:AI_SERVICE_URL = 'http://localhost:8000'
$env:SOYUZ_STT_SAMPLE = 'C:\path\to\sample.wav'
npm.cmd run test:ai-live
```

Он проверяет translate, assist, summary и STT на реальных сервисах. 4 ноября
2026 года прямой real smoke test AI service прошёл на загруженной Qwen 3.5 4B
и локальном faster-whisper-base: `/translate`, `/assist`, `/summary` и `/stt`
вернули HTTP 200; первые три подтвердили `mock: false`/`provider: lmstudio`,
STT — `provider: openai_compatible`. Замеренные времена запросов составили
1.03 с, 0.74 с, 1.42 с и 7.33 с соответственно (Whisper включал первичную
загрузку модели). Это проверяет AI service и реальные провайдеры. Полный запуск
через NestJS HTTP, базу данных и браузер Frontend в этой проверке не выполнен;
Backend production build проверен отдельно. Ранее зафиксированный полный
запуск от 20 октября 2026 года в `docs/ai-fullstack-validation.md` — отдельный
исторический результат, не часть текущего smoke test или CI.

Mock/ошибки покрыты отдельно автоматическими тестами: 62 теста AI service
прошли 4 ноября 2026 года. Они используют заглушки/контролируемые ошибки и не
подменяют собой real smoke test.
