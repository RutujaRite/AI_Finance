/**
 * Profile update API route.
 * Updates user profile fields in PostgreSQL.
 * Uses: lib/db, lib/auth (verifyToken)
 */

import { NextRequest, NextResponse } from 'next/server'
import pool from '../../../../lib/db'
import { verifyToken } from '../../../../lib/auth'

export async function POST(req: NextRequest) {
  const token = req.cookies.get('token')?.value
  const payload:any = token ? verifyToken(token as string) : null
  if (!payload) return NextResponse.json({ success: false, error: 'Not authenticated' }, { status: 401 })

  const body = await req.json().catch(() => ({}))
  const { name, email, mobile, dob, gender, address, city, pincode, occupation, employment_type, monthly_income, marital_status, residence_type, pan, aadhar } = body

  const client = await pool.connect()
  try{
    await client.query(`UPDATE users SET name=$1, email=$2, mobile=$3, dob=$4, gender=$5, address=$6, city=$7, pincode=$8, occupation=$9, employment_type=$10, monthly_income=$11, marital_status=$12, residence_type=$13, pan=$14, aadhar=$15 WHERE id=$16`, [name||null, email||null, mobile||null, dob||null, gender||null, address||null, city||null, pincode||null, occupation||null, employment_type||null, monthly_income||null, marital_status||null, residence_type||null, pan||null, aadhar||null, payload.id])
    return NextResponse.json({ success: true })
  }catch(err:any){
    console.error('profile update error', err)
    return NextResponse.json({ success: false, error: String(err) }, { status: 500 })
  }finally{ client.release() }
}
