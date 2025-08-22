import { NextRequest, NextResponse } from 'next/server';
import { validateApiKey, createUnauthorizedResponse } from '@/lib/auth';

export function middleware(request: NextRequest) {
  // Only protect API routes, but exclude documentation routes
  if (request.nextUrl.pathname.startsWith('/api/')) {
    // Allow public access to documentation routes
    if (request.nextUrl.pathname.startsWith('/api/docs')) {
      return NextResponse.next();
    }
    
    if (!validateApiKey(request)) {
      return createUnauthorizedResponse();
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    '/api/:path*',
  ],
};
