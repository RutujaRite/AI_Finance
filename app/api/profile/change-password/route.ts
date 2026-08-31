/**
 * Change password API route.
 * Updates the authenticated user's password in PostgreSQL.
 * Uses: lib/db, lib/auth (verifyToken), bcryptjs
 */

import { NextRequest, NextResponse } from 'next/server'
import pool from '../../../../lib/db'
import { verifyToken } from '../../../../lib/auth'
import bcrypt from 'bcryptjs'

export async function POST(req: NextRequest) {
  const token = req.cookies.get('token')?.value
  const payload:any = token ? verifyToken(token as string) : null
  if (!payload) return NextResponse.json({ success: false, error: 'Not authenticated' }, { status: 401 })

  const body = await req.json().catch(() => ({}))
  const { newPassword } = body

  if (!newPassword || newPassword.length < 4) {
    return NextResponse.json({ success: false, error: 'Invalid password' })
  }

  const client = await pool.connect()
  try{
    const hashed_password = await bcrypt.hash(newPassword, 10)
    await client.query('UPDATE users SET password = $1 WHERE id = $2', [hashed_password, payload.id])
    return NextResponse.json({ success: true })
  }catch(err:any){
    console.error('Change password error', err)
    return NextResponse.json({ success: false, error: 'Change failed' })
  }finally{ client.release() }
}
