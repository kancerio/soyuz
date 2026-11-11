# Заметки по фронтенду (src/)

Обновлять по мере работы. Дата создания: 2026-11-07.

## Стек

- Next.js 14.2.5 (App Router), React 18, TypeScript, Tailwind CSS 3.4
- socket.io-client 4.8 — realtime-события
- API: `NEXT_PUBLIC_API_URL` (default `http://localhost:3001`)
- Socket: `NEXT_PUBLIC_SOCKET_URL` (default `http://localhost:3000`)

## Структура

```
src/
├── app/                  # маршруты (App Router)
│   ├── page.tsx          # главная (редирект)
│   ├── login/, register/ # авторизация
│   ├── chat/             # список чатов
│   ├── chat/[id]/        # окно чата
│   ├── profile/, settings/
│   ├── providers.tsx     # обёртка контекстов
│   └── layout.tsx
├── components/
│   ├── chat/             # ChatWindow, ChatList, VoiceComposer, AudioPlayer,
│   │                     # TranslationBlock, AIToolsPanel, RewritePanel,
│   │                     # модалки групп (CreateGroupModal, GroupMembersModal) и т.д.
│   ├── auth/             # LoginForm, RegisterForm
│   ├── profile/, settings/
│   ├── layout/MainLayout.tsx
│   └── ui/               # Modal, LoadingState, ErrorState, ThemeToggle
├── context/              # UserContext, SocketContext, ThemeContext, LanguageContext
├── lib/
│   ├── apiClient.ts      # REST + маппинг backend→Message (mapBackendMessage)
│   ├── socket.ts         # initSocket/getSocket/disconnectSocket (singleton)
│   ├── aiClient.ts, voiceUtils.ts
├── types/                # chat.ts (Message, Chat, WS-пейлоады), user.ts (User)
├── locales/              # en.json, ru.json (i18n через LanguageContext)
└── middleware.ts
```

## Ключевые моменты

- **Токены**: хранятся в `sessionStorage` (`accessToken`, `refreshToken`), сеттеры
  `setTokens`/`clearTokens` в `lib/apiClient.ts`. Авто-refresh на 401 в `request()`.
- **Сокет**: синглтон в `lib/socket.ts`, подключается в `SocketContext` после
  авторизации (`auth` с userId), в чате — `join_chat`. События: new message,
  message_translated, message_transcribed, message_voice_summary.
- **Message-тип** (`types/chat.ts`): текст + голосовые (voiceFileId, transcript,
  summary, voiceMetadata, uploadStatus), AI-перевод (translatedText и т.п.),
  статусы доставки/прочтения. `localStatus` — только фронт.
- **Статусы с backend мапятся**: `mapBackendMessage` в apiClient.ts
  (sttStatus: pending→processing, none→skipped; summaryStatus: none→not_needed).
- **mergeMessages** в ChatWindow.tsx: мерж по id, приоритет непустых полей
  incoming, сортировка по timestamp.
- **Язык UI/перевода**: из `user.language` через UserContext, i18n — ru/en.

## Что проверить перед задачами

- `npm run dev` — фронт; бэкенд на :3001, сокет-сервер на :3000 должны быть запущены.
- Нет тестов на фронте — проверка вручную через dev-сервер.

## Выводы сквозной проверки (2026-11-07, e2e 42/42)

- **WS auth**: Gateway в проде требует JWT в событии `auth` (`initSocket` шлёт
  accessToken из sessionStorage). Комнаты чатов подписываются на auth, но для
  чатов, созданных ПОСЛЕ подключения, нужен `join_chat` (ChatWindow это делает).
- **Статусы**: отправитель не получает собственное `new_message` (Gateway
  исключает senderSocket) — подтверждение отправки только ответом REST.
  `message_read` от получателя в открытом чате → отправитель получает
  `message_status_update`.
- **Голосовые**: `POST /messages/chat/:id/voice` → фоном STT+summary →
  `message_transcribed`/`message_voice_summary` в комнату чата; история хранит
  transcript/voiceSummary/voiceFileId; аудио отдаётся только участникам (JWT).
- **Сводка чата**: `GET /messages/chat/:id/summary` — участникам, limit ≤ 50.
- **Локальная БД**: в messages были legacy-колонки `userId`/`chatId` (NOT NULL)
  поверх `user_id`/`chat_id` — дропнуты, мусорные строки удалены. При странных
  500 на отправке — проверять схему.
- **Тулчейн**: typescript закреплён на 5.4.5 — TS 5.9.x ломает типы
  socket.io-client 4.8.3 ('has no exported member io'), next build не проходит.
- **Окружение для проверки**: postgres+redis локально, AI-сервис:
  `ai-service/venv/bin/python -m uvicorn src.main:app --port 8000` (mock-режим,
  `.env` из `.env.example`), бэкенд: `npm run start:prod` в backend/ (nest start
  падает на @types/multer), фронт: `npm run build && npm start`.
