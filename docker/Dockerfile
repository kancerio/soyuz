FROM python:3.10-slim

WORKDIR /app

RUN apt-get update && apt-get install -y ffmpeg && rm -rf /var/lib/apt/lists/*

COPY docker/requirements.txt /app/requirements.txt
RUN pip install --no-cache-dir -r requirements.txt

# Копируем всю папку app_ai из проекта в /app/app_ai внутри контейнера
COPY ./app_ai /app
COPY .env /app/.env

# Указываем путь к модулю main
CMD ["uvicorn", "app_ai.main:app", "--host", "0.0.0.0", "--port", "8000", "--reload"]