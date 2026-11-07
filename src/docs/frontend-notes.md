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
