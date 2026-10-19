# Контракты текстовых AI endpoint

Документ фиксирует контракт версии `0.2.0` для `POST /translate` и
`POST /assist`. Оба endpoint принимают JSON и возвращают одну модель
`TextOperationResponse`.

## Общий успешный ответ

```json
{
  "input_text": "Hello",
  "result": "[mock en->ru] Hello",
  "action": "translate",
  "source_lang": "en",
  "target_lang": "ru",
  "correlation_id": "request-123",
  "mock": true
}
```

Поля `source_lang` и `target_lang` равны `null` для `/assist`. Поле `action`
принимает `translate`, `shorten`, `formal` или `friendly`. Клиент может передать
`X-Correlation-ID`; допустимы 1–128 латинских букв, цифр и символов `._:-`.
Если заголовок отсутствует или некорректен, сервис создаёт UUID. Идентификатор
возвращается в JSON и заголовке `X-Correlation-ID`.

## POST /translate

Запрос:

```json
{
  "text": "Hello",
  "source_lang": "en",
  "target_lang": "ru"
}
```

- `text` — обязательная непустая строка, максимум 5000 символов после удаления
  пробелов по краям.
- `source_lang` — необязательный код языка; значение по умолчанию `auto`.
- `target_lang` — обязательный поддерживаемый код языка. Значение `auto` здесь
  запрещено.

Mock-режим возвращает строку вида `[mock en->ru] Hello`. Он проверяет контракт,
но не выполняет настоящий перевод и не определяет язык при `source_lang=auto`.

## POST /assist

Запрос:

```json
{
  "text": "Send the report before Friday",
  "action": "formal",
  "context": "Business chat"
}
```

- `text` — обязательная непустая строка, максимум 5000 символов.
- `action` — одно из значений `shorten`, `formal`, `friendly`.
- `context` — необязательная строка длиной до 10000 символов.
- Старое поле `prompt` временно принимается как алиас `text`. Новым клиентам
  следует отправлять `text`.

Поведение mock:

- `shorten` оставляет строки до 160 символов без изменений, более длинные
  обрезает до 160 символов с `...`;
- `formal` добавляет маркер `[formal]`;
- `friendly` добавляет маркер `[friendly]`.

## Ошибки

Некорректные поля возвращают HTTP 422:

```json
{
  "error": {
    "code": "validation_error",
    "message": "Request validation failed",
    "details": [
      {
        "field": "text",
        "message": "Text must not be empty"
      }
    ]
  },
  "correlation_id": "8bb2c97d-539a-4264-989d-ed2435bc40e1"
}
```

Когда `AI_MOCK_MODE=false`, а реальный AI-провайдер не подключён, сервис
возвращает HTTP 503 с кодом `ai_provider_unavailable`. Внутренние ошибки
сервера возвращают HTTP 500. Исходный текст и результат в логи не записываются;
логи содержат только `correlation_id`, действие, языки, длины и длительность.

## Локальный запуск

Mock-режим включён по умолчанию и явно задан в Compose:

```bash
docker compose -f docker-compose.ai-only.yml up --build
```

Сервис доступен на `http://localhost:8000`, Swagger — на
`http://localhost:8000/docs`.

## Ограничения качества

- Mock-ответы детерминированы и предназначены только для разработки интеграции.
- Mock не переводит текст, не определяет язык и не меняет стиль семантически.
- `context` проходит валидацию, но mock-обработчик его не использует.
- Сервис не гарантирует сохранение смысла, фактов, терминологии или тона до
  подключения и отдельной оценки реальной модели.
- Флаг `mock` обязателен в успешном ответе, поэтому клиент может исключить
  mock-результат из пользовательского интерфейса и метрик качества.

## Реальный локальный провайдер

Для LM Studio задайте `AI_MOCK_MODE=false`, `AI_PROVIDER=lmstudio`,
`AI_BASE_URL=http://127.0.0.1:1234/v1` и `AI_MODEL` из
`GET /v1/models`. `AI_API_KEY=lm-studio` используется как совместимый
заголовок, а не как внешний секрет. Перевод, помощник и суммаризация используют
один OpenAI-совместимый `/v1/chat/completions`. Ошибка провайдера возвращает
HTTP 502; отсутствие настроенного провайдера при отключённом mock — HTTP 503.

## STT и суммаризация

`POST /stt` принимает multipart-поле `audio` (WAV, MP3, WebM, OGG или
M4A) и необязательный `language`. По умолчанию размер ограничен 25 MiB.
Для рабочего режима используется OpenAI-совместимый Whisper:

```env
STT_PROVIDER=openai_compatible
STT_BASE_URL=http://whisper:9000/v1
STT_MODEL=whisper-1
STT_API_KEY=
```

`POST /summary` (алиас `/summarize`) принимает от 1 до 100 сообщений
`{sender_id, text, timestamp}` и возвращает `summary`, `decisions`,
`participants`, `language` и `provider`. Mock и локальная модель
возвращают детерминированный результат только для проверки интеграции.

`POST /document-analysis` пока сохраняет демонстрационный ответ. Полная
машиночитаемая схема находится в `docs/ai-api.yaml` и генерируется из
FastAPI.
