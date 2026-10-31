# Локальная модель через LM Studio

Ветка `feature/lm-studio-local-model` подключает LM Studio к `ai-service` через
OpenAI-совместимый endpoint. Режим `mock` остаётся значением по умолчанию.

## Запуск LM Studio

1. Скачайте и загрузите GGUF-модель в LM Studio.
2. Вкладка **Developer** → **Start Server**.
3. Проверьте список моделей:

   ```powershell
   irm http://127.0.0.1:1234/v1/models
   ```

4. Скопируйте значение `id` из ответа в `AI_MODEL`.

LM Studio не обучает GGUF-модель. Оно запускает локальный inference-сервер.
Дообучение выполняется отдельно на исходном checkpoint в Transformers-формате
через PEFT/QLoRA, после чего результат можно конвертировать в GGUF и загрузить
обратно в LM Studio.

Готовый Colab-сценарий находится в
[`notebooks/deepseek_qlora_training.ipynb`](../notebooks/deepseek_qlora_training.ipynb).
Перед запуском подготовьте SFT-файл из проверенных JSONL-строк:

```powershell
python ai-service/tools/prepare_sft_dataset.py `
  ai-service/dataset/seed.jsonl `
  $env:TEMP\soyuz_seed_sft.jsonl
```

Ноутбук по умолчанию использует исходный checkpoint
`deepseek-ai/DeepSeek-R1-Distill-Qwen-1.5B`; для 7B нужна более производительная
GPU-среда. Он сохраняет LoRA-адаптер, а не готовый GGUF.

## Запуск AI-сервиса с локальным провайдером

В `ai-service/.env` задайте. Важно отключить mock, иначе Compose оставит
детерминированный ответ и до LM Studio запрос не дойдёт:

```env
AI_MOCK_MODE=false
AI_PROVIDER=lmstudio
AI_BASE_URL=http://127.0.0.1:1234/v1
AI_MODEL=<id из /v1/models>
AI_API_KEY=lm-studio
AI_TIMEOUT_SECONDS=120
AI_REASONING_EFFORT=none
AI_MAX_TOKENS=512
```

Для Qwen3.5 оставьте `AI_REASONING_EFFORT=none`: иначе модель может потратить
лимит генерации на скрытое рассуждение и не вернуть текст в поле `content`.
Для модели, которая поддерживает обычный режим без этого параметра, переменную
можно очистить.

Запускайте FastAPI с этим файлом окружения:

```powershell
uvicorn src.main:app --reload --port 8000 --env-file .env
```

При `AI_PROVIDER=mock` внешних вызовов нет. Перевод, `/assist` и `/summary`
используют один OpenAI-совместимый текстовый endpoint. При ошибке локального
провайдера endpoint возвращает HTTP 502 с понятным описанием причины.

LM Studio предназначен для текстовой модели и не выполняет распознавание аудио.
Для рабочего `/stt` задайте отдельный OpenAI-совместимый Whisper-сервис:

```env
STT_PROVIDER=openai_compatible
STT_BASE_URL=http://whisper:9000/v1
STT_MODEL=whisper-1
STT_API_KEY=
STT_TIMEOUT_SECONDS=120
```

Для локального запуска без облака можно использовать адаптер из репозитория.
Он использует кэшируемую модель `Systran/faster-whisper-base` и предоставляет
тот же endpoint:

```powershell
cd ai-service
python -m pip install -r requirements-stt-local.txt
$env:WHISPER_MODEL = "Systran/faster-whisper-base"
$env:WHISPER_DEVICE = "cpu"
$env:WHISPER_COMPUTE_TYPE = "int8"
python tools/local_whisper_server.py
```

Для контейнера `ai-service` оставьте `STT_BASE_URL=http://host.docker.internal:9000/v1`;
для запуска FastAPI непосредственно на хосте используйте
`http://127.0.0.1:9000/v1`.

## Запуск полного локального контура

1. Запустите сервер в LM Studio и загрузите `qwen3.5-4b` с контекстом 4096.
2. Скопируйте корневой `.env.example` в `.env`; задайте `AI_MOCK_MODE=false`,
   `AI_PROVIDER=lmstudio`, `AI_MODEL=qwen3.5-4b`,
   `STT_PROVIDER=openai_compatible`. Для Compose оставьте URL моделей на
   `host.docker.internal`.
3. В отдельном терминале из `ai-service` запустите локальный Whisper. Для
   Compose укажите `WHISPER_HOST=0.0.0.0`; без контейнеров можно оставить
   `127.0.0.1` и адрес `STT_BASE_URL=http://127.0.0.1:9000/v1`.
4. Поднимите хранилища и AI-сервис: `docker compose up -d postgres redis ai-service`.
5. Создайте `backend/.env` из `backend/.env.example`; для compose-базы задайте
   `DB_HOST=localhost`, `DB_USERNAME=messenger`, `DB_PASSWORD` равный корневому
   `DB_PASSWORD`, `DB_DATABASE=messenger_db`, `REDIS_HOST=localhost`,
   `AI_SERVICE_URL=http://127.0.0.1:8000`.
6. Запустите backend из `backend` командой `npm install` и `npm run start:dev`,
   затем frontend из корня командой `npm install` и `npm run dev`.

Чтобы вернуться к безопасному локальному запуску без загруженных моделей,
установите `AI_MOCK_MODE=true`, `AI_PROVIDER=mock` и `STT_PROVIDER=mock`.

В локальном режиме `STT_PROVIDER=mock` сохраняет запуск без скачивания Whisper.
Файл аудио ограничен 25 MiB по умолчанию; допустимы WAV, MP3, WebM, OGG и M4A.
Пустой файл или неверный формат дают 422/415, недоступный Whisper — 502,
превышение inference deadline самого Whisper — 504. В backend по умолчанию
настроено 120 секунд на запрос к AI; отдельно можно задать
`AI_REQUEST_TIMEOUT_MS` и `AI_STT_TIMEOUT_MS` (миллисекунды). Локальный Whisper
читает `WHISPER_INFERENCE_TIMEOUT_SECONDS` (секунды, по умолчанию 120).

## Голосовая сводка и сквозная проверка

Backend отправляет как сводки чатов, так и текст голосовой расшифровки на
`POST /summary` с контрактом:

```json
{
  "messages": [{"sender_id": "voice", "text": "Текст расшифровки"}],
  "language": "ru"
}
```

Ответ содержит `summary`, `decisions`, `participants`, `language`, `provider`.
`/secretary` оставлен для совместимости, но не используется для сводок. AI
операции синхронные; интерфейс голосового сообщения сначала получает transcript,
потом краткую сводку. Ошибки STT и summary отражаются раздельными статусами.

Для отдельной живой проверки выполните запросы из
[`ai-fullstack-validation.md`](ai-fullstack-validation.md). Mock-профиль
работает без моделей; для реальных ответов нужны загруженная модель и запущенный
LM Studio server, а для расшифровки — отдельный local Whisper adapter. Реальный
результат нельзя подтвердить одними unit-тестами.

## Ограничения текущего этапа

- GGUF, скачанный для LM Studio, предназначен для запуска и генерации данных,
  а не для прямого обучения.
- Для качественного дообучения нужны проверенные примеры в SFT-формате; текущий
  seed из 15 строк используется только как стартовая проверка конвейера.
- На 15 строках обучение будет демонстрационным и приведёт к переобучению. Перед
  рабочим запуском соберите и вручную проверьте хотя бы несколько сотен примеров,
  разделив их на `train`, `validation` и `test`.
- STT требует отдельной Whisper-модели или сервиса, потому что текстовая LLM не
  принимает аудио как вход. В репозитории есть локальный faster-whisper-адаптер;
  его CPU-режим экономит VRAM, но работает медленнее GPU.
