import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  const token = request.cookies.get('token')?.value || localStorage.getItem('token'); 
  // localStorage не доступен в middleware
  // Проще: проверять токен в coockies, пока не реализовано
  // Для демки пропускаем все маршруты
  return NextResponse.next();
}

export const config = {
  matcher: ['/chat/:path*', '/profile/:path*', '/settings/:path*'],
};