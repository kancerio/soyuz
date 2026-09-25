# Тест-кейсы `/translate` и `/assist`

Предусловие: AI-сервис запущен с `AI_MOCK_MODE=true`. Для полного Compose
используется `http://localhost:8001`, для `docker-compose.ai-only.yml` —
`http://localhost:8000`.

| ID | Проверка | Ожидаемый результат |
| --- | --- | --- |
| TC1 | `/translate`: `en` → `ru` | HTTP 200, `action=translate`, `mock=true` |
| TC2 | `/translate` без `source_lang` | HTTP 200, `source_lang=auto` |
| TC3 | `/translate` с пустым `text` | HTTP 422, `validation_error`, поле `text` |
| TC4 | `/translate` с текстом длиннее 5000 символов | HTTP 422, поле `text` |
| TC5 | `/translate` с неизвестным `target_lang` | HTTP 422, поле `target_lang` |
| TC6 | `/assist` с `shorten`, `formal`, `friendly` | HTTP 200 для каждого действия |
| TC7 | `/assist` с пустым или слишком длинным `text` | HTTP 422, поле `text` |
| TC8 | `/assist` с неизвестным действием | HTTP 422, поле `action` |
| TC9 | Любой endpoint с `X-Correlation-ID` | Значение повторяется в JSON и заголовке ответа |
| TC10 | `AI_MOCK_MODE=false` без провайдера | HTTP 503, `ai_provider_unavailable` |

Автоматические тесты находятся в `ai-service/tests/test_translate.py` и
`ai-service/tests/test_assist.py`. Ручной HTTP-smoke запускается после старта
сервиса:

```powershell
$env:AI_BASE_URL = "http://localhost:8001"
python test_translation_api.py
```
