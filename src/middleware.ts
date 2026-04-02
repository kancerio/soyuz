import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  // В middleware доступны только cookies, не localStorage
  const token = request.cookies.get('token')?.value;
  
  // Если нужна защита, можно редиректить на логин при отсутствии токена
  // Пока просто пропускаем все запросы
  return NextResponse.next();
}

export const config = {
  matcher: ['/chat/:path*', '/profile/:path*', '/settings/:path*'],
};