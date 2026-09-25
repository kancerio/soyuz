# Интеграция текстового AI-сервиса

Актуальные endpoint:

- `POST /translate`
- `POST /assist`

Оба возвращают `TextOperationResponse`:

```json
{
  "input_text": "Hello",
  "result": "[mock en->ru] Hello",
  "action": "translate",
  "source_lang": "en",
  "target_lang": "ru",
  "correlation_id": "message-42",
  "mock": true
}
```

Пример перевода:

```http
POST /translate
Content-Type: application/json
X-Correlation-ID: message-42

{"text":"Hello","source_lang":"en","target_lang":"ru"}
```

Пример помощника:

```http
POST /assist
Content-Type: application/json

{"text":"Send the report","action":"friendly"}
```

Backend должен считать результат успешным только при HTTP 200 и использовать
поле `result`. При `mock=true` результат нельзя сохранять как реальный перевод
или учитывать в метриках качества. Для HTTP 422 следует показать ошибку поля из
`error.details`; HTTP 503 означает, что mock выключен, а AI-провайдер не
настроен.

Подробный контракт находится в `api-contracts.md`, языки — в
`language_codes.md`, OpenAPI — в `ai-api.yaml`.
