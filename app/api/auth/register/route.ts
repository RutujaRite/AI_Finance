/**
 * Registration API route.
 * Creates a new user in PostgreSQL. Does NOT log the user in automatically.
 * Uses: lib/db, bcryptjs
 */

import { NextRequest, NextResponse } from 'next/server'
import pool from "@/lib/db"
import bcrypt from 'bcryptjs'

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}))
  const { name, email, password } = body
  if (!email || !password) return NextResponse.json({ success: false, error: 'Missing fields' }, { status: 400 })

  const client = await pool.connect()
  try{
    const existing = await client.query('SELECT id FROM users WHERE email=$1 LIMIT 1', [email])
    if((existing.rowCount ?? 0) > 0) return NextResponse.json({ success: false, error: 'Email already registered' }, { status: 400 })

    const hash = await bcrypt.hash(password, 10)
    const res = await client.query('INSERT INTO users (name, email, password) VALUES ($1,$2,$3) RETURNING id, name, email', [name||null, email, hash])
    const user = res.rows[0]

    return NextResponse.json({ success: true, user: { id: user.id, name: user.name, email: user.email } })
  }catch(err:any){
    console.error('register error', err)
    return NextResponse.json({ success: false, error: String(err) }, { status: 500 })
  }finally{ client.release() }
}
