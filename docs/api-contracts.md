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

Остальные тестовые endpoint (`/stt`, `/secretary`, `/document-analysis`) пока
сохраняют прежние контракты. Актуальная машиночитаемая схема находится в
`docs/ai-api.yaml` и генерируется из FastAPI.
