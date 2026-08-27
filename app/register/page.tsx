"use client"
import React, { useState } from 'react'
import { useRouter } from 'next/navigation'

export default function RegisterPage(){
  const [name,setName]=useState('')
  const [email,setEmail]=useState('')
  const [password,setPassword]=useState('')
  const [confirm,setConfirm]=useState('')
  const [error,setError]=useState('')
  const router = useRouter()

  async function submit(e:any){
    e.preventDefault(); setError('')
    if(password!==confirm){ setError('Passwords do not match'); return }
    try{
      const res = await fetch('/api/auth/register', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ name, email, password }) })
      const data = await res.json()
      if(data.success){ router.push('/home') }
      else setError(data.error || 'Registration failed')
    }catch(e){ setError('Network error') }
  }

  return (
    <main style={{padding:24}}>
      <h1>Register</h1>
      <form onSubmit={submit} style={{maxWidth:480}}>
        {error && <div style={{color:'red'}}>{error}</div>}
        <div style={{marginBottom:12}}>
          <label>Name</label>
          <input value={name} onChange={e=>setName(e.target.value)} required />
        </div>
        <div style={{marginBottom:12}}>
          <label>Email</label>
          <input type="email" value={email} onChange={e=>setEmail(e.target.value)} required />
        </div>
        <div style={{marginBottom:12}}>
          <label>Password</label>
          <input type="password" value={password} onChange={e=>setPassword(e.target.value)} required />
        </div>
        <div style={{marginBottom:12}}>
          <label>Confirm</label>
          <input type="password" value={confirm} onChange={e=>setConfirm(e.target.value)} required />
        </div>
        <button type="submit">Create Account</button>
      </form>
    </main>
  )
}
