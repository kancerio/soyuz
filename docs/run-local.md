# Локальный запуск проекта «Союз»

Гайды по запуску всего стека: фронтенд (Next.js, :3000), backend (NestJS, :3001),
AI-сервис (FastAPI, :8000), Postgres (:5432), Redis (:6379).

## Linux

**Требования:** Node.js 20+, npm, Docker + docker compose plugin.

```bash
cd ~/soyuz

# 1. Инфраструктура: Postgres, Redis, AI-сервис (mock-режим)
docker compose up -d postgres redis ai-service

# 2. Конфиги (один раз)
cp backend/.env.example backend/.env      # при необходимости поменять DB_PASSWORD и JWT_SECRET
cp .env.example .env                      # AI_MOCK_MODE=true уже стоит
# frontend: .env.local уже есть в репозитории (NEXT_PUBLIC_API_URL=http://localhost:3001)

# 3. Зависимости (один раз)
npm install --prefix backend
npm install                 # фронтенд

# 4. Миграции БД (обязательно после обновления — добавляют country_code и translations)
npm run migration:run --prefix backend

# 5. Запуск — в трёх терминалах:
npm run start:dev --prefix backend   # backend → http://localhost:3001
npm run dev                          # frontend → http://localhost:3000
# AI уже в докере на :8000, Swagger: http://localhost:8000/docs
```

**Проверка:**

```bash
curl http://localhost:3001/users                 # 401 — жив (401 без токена — норма)
curl http://localhost:8000/docs                  # Swagger AI-сервиса
xdg-open http://localhost:3000                   # фронтенд
```

Реальный AI вместо mock: запустите LM Studio, выставите в `.env`
`AI_MOCK_MODE=false`, `AI_PROVIDER=lmstudio` и пересоздайте контейнер:
`docker compose up -d --force-recreate ai-service`. Подробности —
в [`lm-studio-local.md`](lm-studio-local.md).

## Windows (PowerShell)

**Требования:** Node.js 20+, Docker Desktop (запущен).

Вариант А — одной командой (скрипт уже есть в проекте):

```powershell
cd ~\soyuz
powershell -ExecutionPolicy Bypass -File scripts\start-local.ps1
```

Скрипт сам поднимает postgres/redis/ai-service в Docker, ждёт порты, создаёт
`backend\.env` из примера, собирает backend и открывает backend и frontend
в отдельных окнах.

Вариант Б — вручную:

```powershell
cd ~\soyuz

# 1. Инфраструктура
docker compose up -d postgres redis ai-service

# 2. Конфиги (один раз)
Copy-Item backend\.env.example backend\.env
Copy-Item .env.example .env

# 3. Зависимости (один раз)
npm install --prefix backend
npm install

# 4. Миграции БД
npm run migration:run --prefix backend

# 5. Запуск — два окна PowerShell:
npm run start:dev --prefix backend   # backend → http://localhost:3001
npm run dev                          # frontend → http://localhost:3000
```

**Проверка:**

```powershell
curl http://localhost:3001/users     # 401 — жив (401 без токена — норма)
start http://localhost:3000          # открыть фронтенд
start http://localhost:8000/docs     # Swagger AI-сервиса
```

## Замечания (обе ОС)

- 404 `Cannot GET /` на `http://localhost:3001/` — **нормально**, корневого
  маршрута нет; проверяйте `/users` (должен дать 401).
- Если `migration:run` падает с connection refused — Postgres ещё не поднялся,
  подождите 10–15 секунд после `docker compose up` и повторите.
- Порты 3000, 3001, 8000, 5432, 6379 должны быть свободны.
- В mock-режиме AI переводы возвращаются как `[mock ...]`, а поиск
  строительных терминов — пустым списком: контракт проверяется, но реального
  обнаружения терминов нет. Для real-режима нужен LM Studio
  (см. [`lm-studio-local.md`](lm-studio-local.md)).
