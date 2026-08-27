"use client"
import React, { useEffect, useState } from 'react'

export default function ProfilePage(){
  const [profile,setProfile]=useState<any>(null)
  const [loading,setLoading]=useState(true)
  const [message,setMessage]=useState('')
  const [saving,setSaving]=useState(false)
  const [photoUploading,setPhotoUploading]=useState(false)

  useEffect(()=>{ fetch('/api/profile/me').then(r=>r.json()).then(d=>{ if(d.success) setProfile(d.user); setLoading(false) }).catch(()=>setLoading(false)) },[])

  async function save(e:any){
    e.preventDefault(); setSaving(true); setMessage('')
    try{
      const body = { name: profile.name, mobile: profile.mobile, city: profile.city, address: profile.address }
      const res = await fetch('/api/profile/update', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(body) })
      const data = await res.json()
      if(data.success) setMessage('Updated')
      else setMessage('Update failed')
    }catch(e){ setMessage('Error') }
    finally{ setSaving(false) }
  }

  function onFileChange(e:any){
    const f = e.target.files && e.target.files[0]
    if(!f) return
    const reader = new FileReader()
    reader.onload = async () => {
      const base = reader.result as string
      setPhotoUploading(true)
      try{
        const res = await fetch('/api/profile/photo', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ filename: f.name, data: base }) })
        const data = await res.json()
        if(data.success) setProfile((p:any)=>({...p, profile_photo_path: data.path}))
        else alert('Upload failed: '+(data.error||''))
      }catch(err){ alert('Upload error') }
      finally{ setPhotoUploading(false) }
    }
    reader.readAsDataURL(f)
  }

  async function deletePhoto(){
    if(!confirm('Remove profile photo?')) return
    try{
      const res = await fetch('/api/profile/photo', { method:'DELETE' })
      const data = await res.json()
      if(data.success) setProfile((p:any)=>({...p, profile_photo_path: null}))
      else alert('Delete failed')
    }catch(e){ alert('Error') }
  }

  if(loading) return <main style={{padding:24}}>Loading...</main>
  if(!profile) return <main style={{padding:24}}>Not authenticated. <a href="/login">Sign in</a></main>

  return (
    <main style={{padding:24}}>
      <h1>Profile</h1>
      <div style={{display:'flex',gap:24}}>
        <div style={{width:220}}>
          <div style={{width:200,height:200,border:'1px solid #eee',borderRadius:8,overflow:'hidden',display:'flex',alignItems:'center',justifyContent:'center'}}>
            {profile.profile_photo_path ? <img src={profile.profile_photo_path} alt="photo" style={{width:'100%',height:'100%',objectFit:'cover'}}/> : <div style={{color:'#999'}}>No photo</div>}
          </div>
          <div style={{marginTop:8}}>
            <input type="file" accept="image/*" onChange={onFileChange} />
            {photoUploading && <div>Uploading...</div>}
            {profile.profile_photo_path && <div><button onClick={deletePhoto} style={{marginTop:8}}>Remove</button></div>}
          </div>
        </div>
        <div style={{flex:1}}>
          <form onSubmit={save}>
            <div style={{marginBottom:12}}>
              <label>Name</label>
              <input value={profile.name||''} onChange={e=>setProfile({...profile,name:e.target.value})} />
            </div>
            <div style={{marginBottom:12}}>
              <label>Email</label>
              <input value={profile.email||''} disabled />
            </div>
            <div style={{marginBottom:12}}>
              <label>Mobile</label>
              <input value={profile.mobile||''} onChange={e=>setProfile({...profile,mobile:e.target.value})} />
            </div>
            <div style={{marginBottom:12}}>
              <label>City</label>
              <input value={profile.city||''} onChange={e=>setProfile({...profile,city:e.target.value})} />
            </div>
            <div style={{marginBottom:12}}>
              <label>Address</label>
              <textarea value={profile.address||''} onChange={e=>setProfile({...profile,address:e.target.value})} />
            </div>
            <div>
              <button type="submit" disabled={saving}>{saving?'Saving...':'Save Profile'}</button>
              <span style={{marginLeft:12}}>{message}</span>
            </div>
          </form>
        </div>
      </div>
    </main>
  )
}
