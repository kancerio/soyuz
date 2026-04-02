import LoginForm from '@/components/auth/LoginForm';

export default function LoginPage() {
  return (
    <div className="flex min-h-screen items-center justify-center">
      <div className="w-full max-w-md p-8 border rounded shadow-md">
        <h1 className="text-2xl font-bold mb-6 text-center">Вход в Soyuz</h1>
        <LoginForm />
      </div>
    </div>
  );
}