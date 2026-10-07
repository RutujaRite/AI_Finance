import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { jwtVerify } from 'jose'

const JWT_SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET || 'your-secret-key-change-in-production'
)
const FALLBACK_SECRET = new TextEncoder().encode('your-secret-key-change-in-production')

const ADMIN_PAGE_PREFIXES = [
  '/admin',
  '/policies',
  '/bank-managers',
  '/policy-management',
  '/bank-management',
  '/company-management',
  '/user-management',
]

const ADMIN_API_PREFIXES = [
  '/api/admin',
  '/api/bank/files',
  '/api/bank-managers/files',
  '/api/policies',
]

function isUserAdmin(payload: any): boolean {
  if (!payload) return false
  const role = String(payload.role || '').trim().toLowerCase()
  if (role === 'admin') return true
  if (payload.is_admin === true) return true
  const email = String(payload.email || '').trim().toLowerCase()
  if (email === 'admin@gmail.com' || email === 'akshadasagar31@gmail.com') return true
  return false
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  // 1. Allow static assets and public auth endpoints
  if (
    pathname.startsWith('/_next') ||
    pathname === '/favicon.ico' ||
    pathname === '/login' ||
    pathname === '/register' ||
    pathname === '/logout' ||
    pathname === '/api/auth/login' ||
    pathname === '/api/auth/register' ||
    pathname === '/api/auth/logout'
  ) {
    return NextResponse.next()
  }

  // 2. Check token existence
  const token = request.cookies.get('token')?.value
  if (!token) {
    return redirectToLogin(request)
  }

  // 3. Verify JWT token and extract payload
  let payload: any = null
  try {
    const verified = await jwtVerify(token, JWT_SECRET)
    payload = verified.payload
  } catch {
    try {
      const verified = await jwtVerify(token, FALLBACK_SECRET)
      payload = verified.payload
    } catch {
      return redirectToLogin(request)
    }
  }

  // 4. Role-Based Access Control (RBAC) Enforcement
  const isAdmin = isUserAdmin(payload)

  const isRestrictedPage = ADMIN_PAGE_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(prefix + '/')
  )

  const isRestrictedApi =
    ADMIN_API_PREFIXES.some(
      (prefix) => pathname === prefix || pathname.startsWith(prefix + '/')
    ) ||
    (pathname === '/api/bank-managers' && request.method === 'POST')

  if (!isAdmin && (isRestrictedPage || isRestrictedApi)) {
    if (pathname.startsWith('/api/')) {
      return NextResponse.json(
        {
          success: false,
          error: 'Forbidden',
          message: 'Admin privileges required to access this resource',
        },
        { status: 403 }
      )
    }
    return forbiddenPageResponse()
  }

  return NextResponse.next()
}

function redirectToLogin(request: NextRequest) {
  // CRITICAL: API requests must NEVER be redirected to an HTML page.
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

function forbiddenPageResponse() {
  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>403 Forbidden — CreditWise</title>
  <style>
    * { box-sizing: border-box; }
    body {
      margin: 0;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      background: #0b1120;
      color: #f8fafc;
      display: flex;
      align-items: center;
      justify-content: center;
      min-height: 100vh;
      padding: 20px;
    }
    .card {
      background: #1e293b;
      border: 1px solid #334155;
      border-radius: 12px;
      padding: 36px 32px;
      max-width: 480px;
      width: 100%;
      text-align: center;
      box-shadow: 0 10px 25px -5px rgba(0,0,0,0.5);
    }
    .badge {
      display: inline-block;
      background: rgba(239, 68, 68, 0.15);
      color: #ef4444;
      font-weight: 700;
      font-size: 13px;
      letter-spacing: 0.5px;
      padding: 6px 14px;
      border-radius: 9999px;
      margin-bottom: 16px;
      border: 1px solid rgba(239, 68, 68, 0.3);
    }
    h1 {
      margin: 0 0 12px 0;
      font-size: 24px;
      color: #ffffff;
      font-weight: 600;
    }
    p {
      margin: 0 0 24px 0;
      color: #94a3b8;
      font-size: 15px;
      line-height: 1.5;
    }
    .btn {
      display: inline-block;
      background: #2563eb;
      color: #ffffff;
      text-decoration: none;
      padding: 10px 22px;
      border-radius: 8px;
      font-weight: 500;
      font-size: 14px;
      transition: background 0.15s ease;
    }
    .btn:hover {
      background: #1d4ed8;
    }
  </style>
</head>
<body>
  <div class="card">
    <div class="badge">403 FORBIDDEN</div>
    <h1>Access Restricted</h1>
    <p>You do not have administrative permissions to access this page. This module is restricted to administrators.</p>
    <a href="/home?section=assistant" class="btn">Return to AI Assistant</a>
  </div>
</body>
</html>`

  return new NextResponse(html, {
    status: 403,
    headers: {
      'content-type': 'text/html; charset=utf-8',
    },
  })
}

export const config = {
  matcher: '/((?!_next/static|_next/image|favicon.ico).*)',
}

