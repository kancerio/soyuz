# Контракты AI-сервиса

Базовый URL локального запуска: `http://localhost:8000`. Swagger доступен по
`/docs`. В режиме по умолчанию `AI_PROVIDER=mock` сервис не вызывает внешние
модели. Для LM Studio см. [локальный запуск](lm-studio-local.md).

## Общий ответ `/translate` и `/assist`

Оба текстовых endpoint возвращают одну схему:

```json
{
  "result": "готовый результат",
  "original_text": "исходный текст",
  "translated_text": null,
  "source_lang": null,
  "target_lang": null,
  "action": "friendly"
}
```

Поля, которые не относятся к операции, имеют значение `null`. Для обратной
совместимости перевод дублируется в `result` и `translated_text`.

Ограничения для обоих endpoint:

- текст не может быть пустым или состоять только из пробелов;
- максимальная длина `text`, `prompt` и `context` — 5000 символов;
- поддерживаются коды языков `ru`, `en`, `de`, `fr`, `es`, `zh`, `ar`.

Ошибки входных данных возвращают HTTP 422:

```json
{
  "detail": [{"field": "body.text", "message": "text must not be empty"}],
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Проверьте входные данные"
  }
}
```

## Перевод — `POST /translate`

`Content-Type: application/json`

```json
{
  "text": "Hello, how are you?",
  "source_lang": "en",
  "target_lang": "ru"
}
```

Пример 200:

```json
{
  "result": "Привет, как дела?",
  "original_text": "Hello, how are you?",
  "translated_text": "Привет, как дела?",
  "source_lang": "en",
  "target_lang": "ru",
  "action": null
}
```

```bash
curl -X POST http://localhost:8000/translate \
  -H "Content-Type: application/json" \
  -d '{"text":"Hello","source_lang":"en","target_lang":"ru"}'
```

## Помощник — `POST /assist`

`Content-Type: application/json`. Допустимые действия: `shorten`, `formal`,
`friendly`.

```json
{
  "prompt": "Отправьте отчёт до 18:00.",
  "context": "сообщение в командном чате",
  "action": "friendly"
}
```

Пример 200:

```json
{
  "result": "Коллеги, пожалуйста, отправьте отчёт до 18:00. Спасибо!",
  "original_text": "Отправьте отчёт до 18:00.",
  "translated_text": null,
  "source_lang": null,
  "target_lang": null,
  "action": "friendly"
}
```

```bash
curl -X POST http://localhost:8000/assist \
  -H "Content-Type: application/json" \
  -d '{"prompt":"Отправьте отчёт до 18:00.","action":"friendly"}'
```

## Ошибки провайдера

Если выбран `AI_PROVIDER=lmstudio`, но локальный сервер недоступен или вернул
некорректный ответ, endpoint возвращает HTTP 502 и не раскрывает ключи:

```json
{"detail": "LM Studio request failed: ..."}
```

События запросов, ошибок провайдера и валидации пишутся через стандартный
Python logger. Текст сообщений и API-ключи в лог не попадают.

## Остальные endpoint

- `POST /stt` принимает `multipart/form-data` с файлом `audio` и полем
  `language` (по умолчанию `ru`). Сейчас это mock-контур; для рабочего STT
  нужна отдельная Whisper-модель/сервис и лицензированные аудиоданные.
- `POST /document-analysis` принимает `multipart/form-data` с `file` и
  возвращает демонстрационный анализ.
- `POST /secretary` принимает JSON с `action` и `details` и пока работает в
  mock-режиме.

Подробности о подготовке данных, происхождении примеров и ограничениях
качества находятся в [ai-training-dataset.md](ai-training-dataset.md).
