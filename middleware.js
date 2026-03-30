import { NextResponse } from 'next/server';
import { jwtVerify } from 'jose';

export async function middleware(request) {
  const token = request.cookies.get('token')?.value;
  const { pathname } = request.nextUrl;

  // Public paths
  if (pathname === '/' || pathname === '/api?action=login' || pathname === '/api?action=register') {
    return NextResponse.next();
  }

  // Protected paths
  if (pathname.startsWith('/chat')) {
    if (!token) {
      return NextResponse.redirect(new URL('/', request.url));
    }
    
    try {
      const secret = new TextEncoder().encode(process.env.JWT_SECRET);
      await jwtVerify(token, secret);
      return NextResponse.next();
    } catch (error) {
      return NextResponse.redirect(new URL('/', request.url));
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/chat/:path*', '/api/:path*'],
};