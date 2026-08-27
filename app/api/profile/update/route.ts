import { NextRequest, NextResponse } from 'next/server'
import pool from '../../../../lib/db'
import { verifyToken } from '../../../../lib/auth'

export async function POST(req: NextRequest) {
  const token = req.cookies.get('token')?.value
  const payload:any = token ? verifyToken(token as string) : null
  if (!payload) return NextResponse.json({ success: false, error: 'Not authenticated' }, { status: 401 })

  const body = await req.json().catch(() => ({}))
  const { name, mobile, city, address } = body

  const client = await pool.connect()
  try{
    await client.query('UPDATE users SET name=$1, mobile=$2, city=$3, address=$4 WHERE id=$5', [name||null, mobile||null, city||null, address||null, payload.id])
    return NextResponse.json({ success: true })
  }catch(err:any){
    console.error('profile update error', err)
    return NextResponse.json({ success: false, error: String(err) }, { status: 500 })
  }finally{ client.release() }
}
