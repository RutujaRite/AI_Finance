import { NextRequest, NextResponse } from 'next/server'
import pool from '../../../../lib/db'
import { verifyToken } from '../../../../lib/auth'
import fs from 'fs'
import path from 'path'

const UPLOAD_DIR = path.join(process.cwd(), 'public', 'uploads', 'profile-photos')

export async function POST(req: NextRequest) {
  const token = req.cookies.get('token')?.value
  const payload:any = token ? verifyToken(token as string) : null
  if (!payload) return NextResponse.json({ success: false, error: 'Not authenticated' }, { status: 401 })

  const body = await req.json().catch(() => ({}))
  const { filename, data } = body as any
  if(!filename || !data) return NextResponse.json({ success: false, error: 'Missing file' }, { status: 400 })

  try{
    // data is expected as data URL or base64 string
    let base64 = data
    const match = String(data).match(/^data:(.+);base64,(.+)$/)
    if(match){ base64 = match[2] }

    const buf = Buffer.from(base64, 'base64')
    // ensure upload dir
    fs.mkdirSync(UPLOAD_DIR, { recursive: true })
    const ext = path.extname(filename) || '.jpg'
    const outName = `photo_${Date.now()}${ext}`
    const outPath = path.join(UPLOAD_DIR, outName)
    fs.writeFileSync(outPath, buf)

    const relative = `/uploads/profile-photos/${outName}`

    const client = await pool.connect()
    try{
      await client.query('UPDATE users SET profile_photo_path=$1 WHERE id=$2', [relative, payload.id])
    }finally{ client.release() }

    return NextResponse.json({ success: true, path: relative })
  }catch(err:any){
    console.error('profile photo upload error', err)
    return NextResponse.json({ success: false, error: String(err) }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest) {
  const token = req.cookies.get('token')?.value
  const payload:any = token ? verifyToken(token as string) : null
  if (!payload) return NextResponse.json({ success: false, error: 'Not authenticated' }, { status: 401 })

  const client = await pool.connect()
  try{
    const res = await client.query('SELECT profile_photo_path FROM users WHERE id=$1 LIMIT 1', [payload.id])
    if(res.rowCount===0) return NextResponse.json({ success: false, error: 'User not found' }, { status: 404 })
    const p = res.rows[0].profile_photo_path
    if(p){
      const abs = path.join(process.cwd(), 'public', p)
      try{ fs.unlinkSync(abs) }catch(e){}
    }
    await client.query('UPDATE users SET profile_photo_path = NULL WHERE id=$1', [payload.id])
    return NextResponse.json({ success: true })
  }catch(err:any){
    console.error('profile photo delete error', err)
    return NextResponse.json({ success: false, error: String(err) }, { status: 500 })
  }finally{ client.release() }
}
