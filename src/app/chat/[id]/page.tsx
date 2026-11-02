import MainLayout from '@/components/layout/MainLayout';
import ChatList from '@/components/chat/ChatList';
import ChatWindow from '@/components/chat/ChatWindow';

interface ChatPageProps {
  params: { id: string };
}

export default function ChatWindowPage({ params }: ChatPageProps) {
  const { id } = params;

  return (
    <MainLayout>
      <div className="flex w-full h-full overflow-hidden">
        {/* Список чатов (виден на планшетах и десктопах, скрыт на мобильных) */}
        <div className="hidden md:block w-80 lg:w-96 h-full shrink-0">
          <ChatList />
        </div>

        {/* Окно переписки выбранного чата */}
        <div className="flex-1 h-full min-w-0">
          <ChatWindow chatId={id} />
        </div>
      </div>
    </MainLayout>
  );
}
