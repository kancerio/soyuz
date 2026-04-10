import API_CONFIG from './apiConfig';
import { mockChats, mockMessages } from './mockData'; // Импортируем моки

// Интерфейс для сообщения
interface Message {
  chatId: string;
  text: string;
  senderId: string;
  timestamp: Date | string;
}

// Функция для получения данных.
const fetchData = async (endpoint: string): Promise<any[]> => {
  // Пока используем моки, возвращаем данные из mockData.ts
  if (API_CONFIG.useMocks) {
    await new Promise(resolve => setTimeout(resolve, 100)); // Имитация задержки

    // Логика возврата данных в зависимости от endpoint
    if (endpoint === '/chat/list') {
      return mockChats; // Вернуть список чатов
    }

    // Если endpoint содержит /messages/, возвращаем моковые сообщения для конкретного чата
    // Парсим chatId из endpoint (упрощенно: ищем ID в URL)
    const chatId = endpoint.split('/').find(segment => /^\d+$/.test(segment));

    if (chatId && mockMessages[chatId]) {

    // Исправление: mockMessages теперь объект типа Record<string, Message[]>
    // Мы просто возвращаем массив для этого chatId
    
      return mockMessages[chatId];
    }
    return []; // Если чата нет в моках, возвращаем пустой массив
  }

  //  Когда будет готов реальный бэк:
  // const response = await fetch(`${API_CONFIG.base}${endpoint}`);
  // if (!response.ok) throw new Error('Network response was not ok');
  // return response.json();
  
  // Для теста без бэкенда вернем пустой массив или заглушку
  return [];
};

export const apiClient = {
  // Получить список чатов
  getChats: async () => {
    const data = await fetchData('/chat/list');
    return data;
  },

  // Получить сообщения чата
  getMessages: async (chatId: string) => {
    const data = await fetchData(`/chat/${chatId}/messages`);
    return data || []; // Всегда возвращаем массив, даже если пустой
  },

  // Отправить сообщение
  sendMessage: async (chatId: string, text: string) => {
    // Имитация отправки
    if (API_CONFIG.useMocks) {
      await new Promise(resolve => setTimeout(resolve, 500));
      
      // Возвращаем структуру нового сообщения
      return { 
        id: Date.now().toString(), 
        text, 
        senderId: 'me', 
        timestamp: new Date() 
      };
    }
    
    // Когда будет готов реальный бэк:
    // const response = await fetch(`${API_CONFIG.base}/chat/${chatId}/message`, {
    //   method: 'POST',
    //   headers: { 'Content-Type': 'application/json' },
    //   body: JSON.stringify({ text }),
    // });
    // return response.json();
    
    return {};
  },
};

export default apiClient;