import MainLayout from '@/components/layout/MainLayout';

interface ChatPageProps {
  params: { id: string };
}

export default function ChatWindowPage({ params }: ChatPageProps) {
  const { id } = params;
  return (
    <MainLayout>
      <div className="p-4">
        <h1 className="text-xl font-bold">Чат {id}</h1>
        <p>Окно переписки с сообщениями</p>
      </div>
    </MainLayout>
  );
}