/**
 * Login API route.
 * Validates email/password against PostgreSQL users table and returns JWT cookie.
 * Uses: lib/db, lib/auth (signToken), bcryptjs
 */

import { NextRequest, NextResponse } from 'next/server'
import pool from '@/lib/db'
import bcrypt from 'bcryptjs'
import { signToken } from '@/lib/auth'

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}))
  const { email, password } = body
  if (!email || !password) {
    return NextResponse.json({ success: false, error: 'Missing email or password' }, { status: 400 })
  }

  const client = await pool.connect()
  try {
    const res = await client.query(
      'SELECT id, email, password, name, role FROM users WHERE email = $1 LIMIT 1',
      [email]
    )
    if (res.rowCount === 0) {
      return NextResponse.json({ success: false, error: 'Invalid email or password' }, { status: 401 })
    }

    const user = res.rows[0]
    const valid = await bcrypt.compare(password, user.password)
    if (!valid) {
      return NextResponse.json({ success: false, error: 'Invalid email or password' }, { status: 401 })
    }

    const token = signToken({
      id: user.id,
      email: user.email,
      name: user.name || '',
      role: user.role || 'user',
    })

    const response = NextResponse.json({
      success: true,
      user: { id: user.id, email: user.email, name: user.name },
    })
    response.cookies.set('token', token, {
      httpOnly: true,
      path: '/',
      maxAge: 60 * 60 * 24,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
    })
    return response
  } catch (err: any) {
    console.error('login error', err)
    return NextResponse.json({ success: false, error: String(err) }, { status: 500 })
  } finally {
    client.release()
  }
}
