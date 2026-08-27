import { NextRequest, NextResponse } from 'next/server'
import pool from '../../../../lib/db'
import { verifyToken } from '../../../../lib/auth'

export async function GET(req: NextRequest) {
  const token = req.cookies.get('token')?.value
  const payload:any = token ? verifyToken(token as string) : null
  if (!payload) return NextResponse.json({ success: false, error: 'Not authenticated' }, { status: 401 })

  const client = await pool.connect()
  try{
    const res = await client.query('SELECT id, name, email, mobile, city, address, profile_photo_path FROM users WHERE id = $1 LIMIT 1', [payload.id])
    if(res.rowCount===0) return NextResponse.json({ success: false, error: 'User not found' }, { status: 404 })
    return NextResponse.json({ success: true, user: res.rows[0] })
  }catch(err:any){
    console.error('profile me error', err)
    return NextResponse.json({ success: false, error: String(err) }, { status: 500 })
  }finally{ client.release() }
}
