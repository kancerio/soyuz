export const API_CONFIG = {
  base: process.env.NEXT_PUBLIC_API_URL || '/api',
  paths: {
    list: '/chat/list',
    messages: '/chat/:id/messages',
    send: '/chat/:id/message',
  },
  // Используем моки, если переменная не установлена в 'false'
  useMocks: process.env.NEXT_PUBLIC_USE_MOCKS !== 'false',
};

export default API_CONFIG;