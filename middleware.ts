import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { jwtVerify } from 'jose'

const JWT_SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET || 'your-secret-key-change-in-production'
)

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  if (
    pathname.startsWith('/_next') ||
    pathname === '/favicon.ico' ||
    pathname.startsWith('/api/auth') ||
    pathname.startsWith('/api/chat') ||
    pathname === '/login' ||
    pathname === '/register'
  ) {
    return NextResponse.next()
  }

  const token = request.cookies.get('token')?.value
  if (!token) {
    return redirectToLogin(request)
  }

  try {
    await jwtVerify(token, JWT_SECRET)
    return NextResponse.next()
  } catch {
    try {
      await jwtVerify(token, new TextEncoder().encode('your-secret-key-change-in-production'))
      return NextResponse.next()
    } catch {
      return redirectToLogin(request)
    }
  }
}

function redirectToLogin(request: NextRequest) {
  // CRITICAL: API requests must NEVER be redirected to an HTML page.
  // Redirecting an API route to /login causes fetch().json() in browser to parse HTML,
  // throwing "JSON.parse: unexpected character at line 1 column 1 of the JSON data".
  if (request.nextUrl.pathname.startsWith('/api/')) {
    return NextResponse.json(
      { success: false, error: 'Unauthorized', message: 'Authentication required' },
      { status: 401 }
    )
  }

  const loginUrl = new URL('/login', request.url)
  if (!request.nextUrl.pathname.startsWith('/login')) {
    loginUrl.searchParams.set('from', request.nextUrl.pathname)
  }
  return NextResponse.redirect(loginUrl)
}

export const config = {
  matcher: '/((?!_next/static|_next/image|favicon.ico|api/auth).*)',
}
