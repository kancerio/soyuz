# AI Service for Messenger

Сервис предоставляет AI-функции: перевод, распознавание речи, ИИ-помощник, анализ документов и секретарь.

## Запуск через Docker Compose (рекомендуется)

1. Из корня проекта выполните:
   ```bash
   docker compose -f docker-compose.ai-only.yml up --build
   ```
2. Сервис будет доступен на `http://localhost:8000`.
3. Документация API (Swagger): `http://localhost:8000/docs`.

Compose включает `AI_MOCK_MODE=true`. Mock не требует моделей и внешних API.

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
4. Включите mock-режим и запустите сервер в PowerShell:
   ```powershell
   $env:AI_MOCK_MODE = "true"
   uvicorn src.main:app --reload --port 8000
   ```

## Тестирование

```bash
cd ai-service
pytest tests -v
```

## Структура проекта

- `src/main.py` – основной файл приложения FastAPI
- `tests/` – модульные тесты
- `requirements.txt` – зависимости

Контракты `/translate` и `/assist`, ошибки и ограничения качества описаны в
`../docs/api-contracts.md`. Поддерживаемые языки перечислены в
`../docs/language_codes.md`.

