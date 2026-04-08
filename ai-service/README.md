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
   docker-compose up --build
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

## Структура проекта

- `src/main.py` – основной файл приложения FastAPI
- `src/config.py` – загрузка переменных окружения
- `tests/` – модульные тесты
- `requirements.txt` – зависимости
```

