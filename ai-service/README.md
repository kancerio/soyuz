```markdown
# AI Service for Messenger

Сервис предоставляет AI-функции: перевод, распознавание речи, ИИ-помощник, анализ документов и секретарь.

## Запуск через Docker Compose (рекомендуется)

1. Скопируйте `.env.example` в `.env` и при необходимости заполните:
   ```bash
   cp .env.example .env
   ```
2. Из корня проекта выполните:
   ```bash
   docker compose up --build ai-service
   ```
3. Сервис будет доступен на `http://localhost:8000`
4. Документация API (Swagger): `http://localhost:8000/docs`

## Локальный запуск (без Docker)

1. Перейдите в папку `ai-service`:
   ```bash
   cd ai-service
   ```
2. Создайте виртуальное окружение:
   ```bash
   python -m venv venv
   source venv/bin/activate  # или venv\Scripts\activate на Windows
   ```
3. Установите зависимости:
   ```bash
   pip install -r requirements.txt
   ```
4. Скопируйте `.env.example` в `.env` и настройте.
5. Запустите сервер:
   ```bash
   uvicorn src.main:app --reload --port 8000
   ```

## Тестирование

```bash
cd ai-service
pytest tests -v
```

## Рабочий AI-контур

По умолчанию `AI_PROVIDER=mock` и `STT_PROVIDER=mock`, поэтому локальный
запуск не требует внешних сервисов. Для стенда задайте `AI_PROVIDER=lmstudio`
и укажите `AI_BASE_URL`/`AI_MODEL` из OpenAI-совместимого сервера LM Studio.
Перевод, `/assist` и `/summary` используют один текстовый провайдер.

LM Studio не принимает аудио. Для `/stt` нужен отдельный Whisper-сервис с
совместимым endpoint `/v1/audio/transcriptions`:

```env
STT_PROVIDER=openai_compatible
STT_BASE_URL=http://whisper:9000/v1
STT_MODEL=whisper-1
STT_API_KEY=
```

`/stt` проверяет формат и размер файла, а `/summary` проверяет список сообщений.
Ошибки валидации возвращаются с HTTP 422, слишком большой файл — с 413,
неподдерживаемый тип — с 415, недоступный или некорректный провайдер — с 502.
Тесты провайдеров используют транспорт без сети; реальный стенд нужно проверить
smoke-запросами после запуска LM Studio и Whisper.

## Структура проекта

- `src/main.py` – основной файл приложения FastAPI
- `src/config.py` – загрузка переменных окружения
- `tests/` – модульные тесты
- `requirements.txt` – зависимости
```

