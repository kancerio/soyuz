import MainLayout from '@/components/layout/MainLayout';
import ChatList from '@/components/chat/ChatList';

export default function ChatListPage() {
  return (
    <MainLayout>
      <div className="p-4">
        <h1 className="text-xl font-bold mb-4">Чаты</h1>
        <ChatList />
      </div>
    </MainLayout>
  );
}