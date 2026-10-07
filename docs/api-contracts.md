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
{
  "detail": "LM Studio request failed: ...",
  "error": {"code": "AI_PROVIDER_ERROR", "message": "AI provider failed"}
}
```

События запросов, ошибок провайдера и валидации пишутся через стандартный
Python logger. Текст сообщений и API-ключи в лог не попадают.

## Распознавание речи — `POST /stt`

`Content-Type: multipart/form-data`. Обязательное поле `audio` принимает WAV,
MP3, WebM, OGG или M4A; поле `language` необязательное и по умолчанию равно
`ru`. Максимальный размер файла задаётся `MAX_AUDIO_BYTES` и по умолчанию
составляет 25 MiB.

В режиме `STT_PROVIDER=mock` сервис возвращает детерминированный пример. Для
рабочего контура используется любой OpenAI-совместимый Whisper endpoint:

```env
STT_PROVIDER=openai_compatible
STT_BASE_URL=http://whisper:9000/v1
STT_MODEL=whisper-1
STT_API_KEY=
STT_TIMEOUT_SECONDS=120
```

Пример успешного ответа:

```json
{
  "transcript": "Распознанный текст",
  "recognized_text": "Распознанный текст",
  "summary": null,
  "language": "ru",
  "provider": "openai_compatible"
}
```

Поле `recognized_text` оставлено для совместимости со старым клиентом. Краткое
содержание строится отдельным endpoint `/summary`, а не внутри STT.

## Суммаризация — `POST /summary` (алиас `POST /summarize`)

`Content-Type: application/json`. Передаётся от 1 до 100 сообщений; текст каждого
сообщения ограничен 5000 символами.

```json
{
  "language": "ru",
  "messages": [
    {"sender_id": "u1", "text": "Перенесём релиз на четверг?", "timestamp": "2026-10-07T10:00:00Z"},
    {"sender_id": "u2", "text": "Согласен, я проверю миграцию.", "timestamp": "2026-10-07T10:01:00Z"}
  ]
}
```

Пример ответа:

```json
{
  "summary": "Релиз перенесён на четверг.",
  "decisions": ["релиз в четверг"],
  "participants": ["u1", "u2"],
  "language": "ru",
  "provider": "lmstudio"
}
```

В `AI_PROVIDER=lmstudio` суммаризация использует тот же OpenAI-совместимый
`/v1/chat/completions`, что и перевод с помощником. В mock-режиме внешний вызов
не выполняется.

Ошибки STT и summary:

- `422` — пустой запрос, неизвестный язык или пустой список сообщений;
- `413` — аудиофайл больше `MAX_AUDIO_BYTES`;
- `415` — неподдерживаемый формат аудио;
- `502` — провайдер недоступен, превысил таймаут или вернул неверный ответ.

`POST /document-analysis` принимает `multipart/form-data` с `file` и пока
возвращает демонстрационный анализ. `POST /secretary` принимает JSON с `action`
и `details` и пока работает в mock-режиме.

Подробности о подготовке данных, происхождении примеров и ограничениях
качества находятся в [ai-training-dataset.md](ai-training-dataset.md).
