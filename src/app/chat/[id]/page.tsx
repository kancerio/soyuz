import MainLayout from '@/components/layout/MainLayout';
import ChatWindow from '@/components/chat/ChatWindow';

interface ChatPageProps {
  params: { id: string };
}

export default function ChatWindowPage({ params }: ChatPageProps) {
  const { id } = params;
  return (
    <MainLayout>
      <ChatWindow chatId={id} />
    </MainLayout>
  );
}