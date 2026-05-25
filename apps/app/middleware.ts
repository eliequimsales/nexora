import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

const PUBLIC_PATHS = ['/', '/login', '/register', '/forgot-password', '/diagnostico', '/google/success'];

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Allow Next.js internals and static files to pass through
  if (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/api') ||
    pathname.includes('.')
  ) {
    return NextResponse.next();
  }

  const hasRefreshToken = request.cookies.has('refresh_token');
  const isPublicPath = PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(p + '/'));

  // Authenticated user trying to access login → redirect to org selection.
  // Exceção: /select-org em si não redireciona (evita loop quando refresh falha).
  const isSelectOrg = pathname === '/select-org';
  if (hasRefreshToken && isPublicPath && !isSelectOrg) {
    return NextResponse.redirect(new URL('/select-org', request.url));
  }

  // Unauthenticated user trying to access protected route → redirect to login
  if (!hasRefreshToken && !isPublicPath) {
    const loginUrl = new URL('/login', request.url);
    loginUrl.searchParams.set('next', pathname);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
