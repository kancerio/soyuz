import Link from 'next/link';

export default function HomePage() {
  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold">Soyuz Messenger</h1>
      <Link href="/login" className="text-blue-500 underline">Войти</Link>
    </div>
  );
}