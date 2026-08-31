"use client"
import { useEffect, useState, useRef } from "react"
import { useRouter } from "next/navigation"

export default function ProfilePage() {
  const router = useRouter()
  const [profile, setProfile] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [message, setMessage] = useState("")
  const [saving, setSaving] = useState(false)
  const [photoUploading, setPhotoUploading] = useState(false)

  useEffect(() => {
    fetch("/api/auth/verify", { credentials: "include" })
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((d) => {
        if (!d.success) throw new Error("Not authenticated")
        return fetch("/api/profile/me", { credentials: "include" })
      })
      .then((r) => r.json())
      .then((d) => {
        if (d.success) setProfile(d.user)
      })
      .catch(() => router.replace("/login"))
      .finally(() => setLoading(false))
  }, [router])

  async function save(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setMessage("")
    try {
      const body = {
        name: profile.name,
        email: profile.email,
        mobile: profile.mobile,
        dob: profile.dob,
        gender: profile.gender,
        address: profile.address,
        city: profile.city,
        pincode: profile.pincode,
        occupation: profile.occupation,
        employment_type: profile.employment_type,
        monthly_income: profile.monthly_income,
        marital_status: profile.marital_status,
        residence_type: profile.residence_type,
        pan: profile.pan,
        aadhar: profile.aadhar,
      }
      const res = await fetch("/api/profile/update", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
        credentials: "include",
      })
      const data = await res.json()
      setMessage(data.success ? "Saved successfully" : "Save failed")
    } catch (e) {
      setMessage("Save failed")
    } finally {
      setSaving(false)
    }
  }

  function onFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0]
    if (!f) return
    const reader = new FileReader()
    reader.onload = async () => {
      const base = reader.result as string
      setPhotoUploading(true)
      try {
        const res = await fetch("/api/profile/photo", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ filename: f.name, data: base }),
          credentials: "include",
        })
        const data = await res.json()
        if (data.success) {
          setProfile((p: any) => ({ ...p, profile_photo_path: data.path }))
        } else {
          alert("Upload failed: " + (data.error || ""))
        }
      } catch (err) {
        alert("Upload error")
      } finally {
        setPhotoUploading(false)
      }
    }
    reader.readAsDataURL(f)
  }

  async function deletePhoto() {
    if (!confirm("Remove profile photo?")) return
    try {
      const res = await fetch("/api/profile/photo", { method: "DELETE", credentials: "include" })
      const data = await res.json()
      if (data.success) setProfile((p: any) => ({ ...p, profile_photo_path: null }))
      else alert("Delete failed")
    } catch (e) {
      alert("Error")
    }
  }

  async function changePassword(e: React.FormEvent) {
    e.preventDefault()
    const form = e.target as HTMLFormElement
    const newPassword = (form.elements.namedItem("newPassword") as HTMLInputElement).value
    const confirm = (form.elements.namedItem("confirmPassword") as HTMLInputElement).value
    if (!newPassword || newPassword.length < 4) {
      showPassMsg("Password too short", "error")
      return
    }
    if (newPassword !== confirm) {
      showPassMsg("Passwords do not match", "error")
      return
    }
    try {
      const res = await fetch("/api/profile/change-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ newPassword }),
        credentials: "include",
      })
      const data = await res.json()
      if (data.success) {
        showPassMsg("Password updated", "success")
        form.reset()
      } else {
        showPassMsg(data.error || "Update failed", "error")
      }
    } catch (e) {
      showPassMsg("Update failed", "error")
    }
  }

  function showPassMsg(text: string, type: "success" | "error") {
    const el = document.getElementById("passMsg")
    if (el) {
      el.textContent = text
      el.className = "profile-msg " + type
      el.style.display = "inline-flex"
      setTimeout(() => {
        el.style.display = "none"
      }, 3000)
    }
  }

  useEffect(() => {
    function addPasswordToggle(inputId: string) {
      const inp = document.getElementById(inputId)
      if (!inp) return
      const wrapper = document.createElement("div")
      wrapper.className = "pw-wrapper"
      wrapper.style.position = "relative"
      wrapper.style.display = "inline-block"
      wrapper.style.width = "100%"
      const originalParent = inp.parentElement
      if (originalParent) {
        originalParent.replaceChild(wrapper, inp)
        wrapper.appendChild(inp)
        inp.style.paddingRight = "48px"
        const btn = document.createElement("button")
        btn.type = "button"
        btn.className = "toggle-btn"
        btn.setAttribute("aria-label", "Toggle password visibility")
        const eyeSvg = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/></svg>`
        const eyeOffSvg = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M17.94 17.94A10.97 10.97 0 0 1 12 19c-6 0-10-7-10-7 .9-1.55 2.22-3.33 3.8-4.8"/><path d="M1 1l22 22"/></svg>`
        btn.innerHTML = eyeSvg
        btn.addEventListener("click", () => {
          if (inp.type === "password") {
            inp.type = "text"
            btn.innerHTML = eyeOffSvg
          } else {
            inp.type = "password"
            btn.innerHTML = eyeSvg
          }
        })
        wrapper.appendChild(btn)
      }
    }

    addPasswordToggle("newPassword")
    addPasswordToggle("confirmPassword")
  }, [])

  if (loading) return <main style={{ padding: 24 }}>Loading...</main>
  if (!profile) return <main style={{ padding: 24 }}>Not authenticated. <a href="/login">Sign in</a></main>

  const dobVal = profile.dob
    ? new Date(profile.dob).toISOString().slice(0, 10)
    : ""
  const lastLogin = profile.last_login
    ? new Date(profile.last_login).toLocaleString()
    : "Never"
  const nameOrEmail = profile.name || profile.email || "U"
  const parts = nameOrEmail.split(/[\s@]/).filter(Boolean).slice(0, 2)
  const initials = parts.map((p: string) => p[0]).join("").toUpperCase()

  return (
    <main className="home-body">
      <header className="topbar app-topbar">
        <a className="brand" href="/home">
          <span className="brand-mark">◆</span>
          <span className="brand-text">AI ASSISTANT</span>
        </a>
        <nav className="nav-menu" aria-label="Main navigation">
          <a href="/home" className="nav-item">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>
            Home
          </a>
          <a href="/emi" className="nav-item">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="16" height="16" x="4" y="4" rx="2"/><path d="M12 12h.01"/></svg>
            EMI Calculator
          </a>
          <a href="/admin" className="nav-item">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/></svg>
            Admin
          </a>
          <div className="nav-item profile-menu active">
            <span className="profile-menu-label">♙ My Account</span>
            <span className="caret">▾</span>
            <div className="profile-dropdown">
              <a href="/profile">Profile</a>
              <a href="/logout">Logout</a>
            </div>
          </div>
        </nav>
      </header>

      <main className="profile-page">
        <div className="profile-container">
          <div className="profile-header">
            <h1>My Account</h1>
            <p>Manage your profile information and account settings.</p>
          </div>

          <section className="profile-header-card">
            <div className="avatar-section">
              <div className="avatar-circle" id="profileAvatar">
                {profile.profile_photo_path ? (
                  <img className="profile-photo" src={profile.profile_photo_path} alt="Profile photo" />
                ) : (
                  <span className="avatar-initials">{initials}</span>
                )}
                {profile.profile_photo_path && (
                  <button
                    type="button"
                    className="avatar-remove"
                    id="removeProfilePhotoBtn"
                    aria-label="Remove profile photo"
                    title="Remove profile photo"
                    onClick={deletePhoto}
                  >
                    ×
                  </button>
                )}
                <label className="avatar-camera" htmlFor="profilePhotoInput" title="Change profile photo">
                  <input
                    id="profilePhotoInput"
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    onChange={onFileChange}
                  />
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0-2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                </label>
              </div>
              <div className="name-block">
                <div className="name">{profile.name || profile.email}</div>
                <span className="role-bubble">{profile.role || "User"}</span>
                <div className="status">Active Account</div>
              </div>
            </div>
            <div className="info-blocks">
              <div className="info-item">
                <span className="info-icon email-icon">✉</span>
                <span className="label">Email</span>
                <span className="value">{profile.email || "-"}</span>
              </div>
              <div className="info-item">
                <span className="info-icon phone-icon">⌕</span>
                <span className="label">Mobile</span>
                <span className="value">{profile.mobile || "-"}</span>
              </div>
              <div className="info-item">
                <span className="info-icon role-icon">♧</span>
                <span className="label">Role</span>
                <span className="value">{profile.role || "User"}</span>
              </div>
              <div className="info-item">
                <span className="info-icon login-icon">□</span>
                <span className="label">Last Login</span>
                <span className="value">{lastLogin}</span>
              </div>
            </div>
          </section>

          <div className="profile-card">
            <div className="profile-card-title">
              <span className="section-icon">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
              </span>
              Personal Information
            </div>

            <form onSubmit={save}>
              <div className="profile-grid">
                <div className="profile-field">
                  <label>Full Name</label>
                  <input
                    type="text"
                    id="name"
                    value={profile.name || ""}
                    onChange={(e) => setProfile({ ...profile, name: e.target.value })}
                  />
                </div>
                <div className="profile-field">
                  <label>Email</label>
                  <input type="email" id="email" value={profile.email || ""} disabled />
                </div>
                <div className="profile-field">
                  <label>Mobile Number</label>
                  <input
                    type="text"
                    id="mobile"
                    value={profile.mobile || ""}
                    onChange={(e) => setProfile({ ...profile, mobile: e.target.value })}
                  />
                </div>
                <div className="profile-field">
                  <label>Date of Birth</label>
                  <input
                    type="date"
                    id="dob"
                    value={dobVal}
                    onChange={(e) => setProfile({ ...profile, dob: e.target.value })}
                  />
                </div>
                <div className="profile-field">
                  <label>Gender</label>
                  <select
                    id="gender"
                    value={profile.gender || ""}
                    onChange={(e) => setProfile({ ...profile, gender: e.target.value })}
                  >
                    <option value="">Select</option>
                    <option value="Male">Male</option>
                    <option value="Female">Female</option>
                    <option value="Other">Other</option>
                  </select>
                </div>
                <div className="profile-field">
                  <label>Address</label>
                  <input
                    type="text"
                    id="address"
                    value={profile.address || ""}
                    onChange={(e) => setProfile({ ...profile, address: e.target.value })}
                  />
                </div>
                <div className="profile-field">
                  <label>City</label>
                  <input
                    type="text"
                    id="city"
                    value={profile.city || ""}
                    onChange={(e) => setProfile({ ...profile, city: e.target.value })}
                  />
                </div>
                <div className="profile-field">
                  <label>Pincode</label>
                  <input
                    type="text"
                    id="pincode"
                    value={profile.pincode || ""}
                    onChange={(e) => setProfile({ ...profile, pincode: e.target.value })}
                  />
                </div>
              </div>
              <div className="profile-actions">
                <button type="submit" className="btn btn-primary" disabled={saving}>
                  {saving ? "Saving..." : "Save Changes"}
                </button>
                <span id="profileMsg" className={`profile-msg ${message.includes("success") ? "success" : "error"}`} style={{ marginLeft: 12, display: message ? "inline-flex" : "none" }}>{message}</span>
              </div>
            </form>
          </div>

          <div className="profile-card">
            <div className="profile-card-title">
              <span className="section-icon">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/></svg>
              </span>
              Loan / Employment Information
            </div>

            <form onSubmit={save}>
              <div className="profile-grid">
                <div className="profile-field">
                  <label>Occupation</label>
                  <input
                    type="text"
                    id="occupation"
                    value={profile.occupation || ""}
                    onChange={(e) => setProfile({ ...profile, occupation: e.target.value })}
                  />
                </div>
                <div className="profile-field">
                  <label>Employment Type</label>
                  <select
                    id="employment_type"
                    value={profile.employment_type || ""}
                    onChange={(e) => setProfile({ ...profile, employment_type: e.target.value })}
                  >
                    <option value="">Select</option>
                    <option value="Salaried">Salaried</option>
                    <option value="Self-Employed">Self-Employed</option>
                    <option value="Student">Student</option>
                    <option value="Other">Other</option>
                  </select>
                </div>
                <div className="profile-field">
                  <label>Monthly Income (₹)</label>
                  <input
                    type="number"
                    id="monthly_income"
                    value={profile.monthly_income || ""}
                    onChange={(e) => setProfile({ ...profile, monthly_income: e.target.value })}
                  />
                </div>
                <div className="profile-field">
                  <label>Marital Status</label>
                  <select
                    id="marital_status"
                    value={profile.marital_status || ""}
                    onChange={(e) => setProfile({ ...profile, marital_status: e.target.value })}
                  >
                    <option value="">Select</option>
                    <option value="Single">Single</option>
                    <option value="Married">Married</option>
                    <option value="Other">Other</option>
                  </select>
                </div>
                <div className="profile-field">
                  <label>Residence Type</label>
                  <select
                    id="residence_type"
                    value={profile.residence_type || ""}
                    onChange={(e) => setProfile({ ...profile, residence_type: e.target.value })}
                  >
                    <option value="">Select</option>
                    <option value="Owned">Owned</option>
                    <option value="Rented">Rented</option>
                    <option value="Other">Other</option>
                  </select>
                </div>
                <div className="profile-field">
                  <label>PAN Number</label>
                  <input
                    type="text"
                    id="pan"
                    value={profile.pan || ""}
                    onChange={(e) => setProfile({ ...profile, pan: e.target.value })}
                  />
                </div>
                <div className="profile-field">
                  <label>Aadhar Number</label>
                  <input
                    type="text"
                    id="aadhar"
                    value={profile.aadhar || ""}
                    onChange={(e) => setProfile({ ...profile, aadhar: e.target.value })}
                  />
                </div>
              </div>
              <div className="profile-actions">
                <button type="submit" className="btn btn-primary" disabled={saving}>
                  {saving ? "Saving..." : "Save Changes"}
                </button>
                <span id="profileMsg" className={`profile-msg ${message.includes("success") ? "success" : "error"}`} style={{ marginLeft: 12, display: message ? "inline-flex" : "none" }}>{message}</span>
              </div>
            </form>
          </div>

          <div className="profile-card">
            <div className="profile-card-title">
              <span className="section-icon">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="18" height="11" x="3" y="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
              </span>
              Security / Change Password
            </div>

            <form onSubmit={changePassword}>
              <div className="profile-grid">
                <div className="profile-field">
                  <label>New Password</label>
                  <input type="password" id="newPassword" placeholder="Enter new password" minLength={4} required />
                </div>
                <div className="profile-field">
                  <label>Confirm Password</label>
                  <input type="password" id="confirmPassword" placeholder="Confirm new password" minLength={4} required />
                </div>
              </div>
              <div className="profile-actions">
                <button type="submit" className="btn btn-primary">Update Password</button>
                <span id="passMsg" className="profile-msg" style={{ marginLeft: 12, display: "none" }}></span>
              </div>
              <div className="profile-hint">Keep your information up to date for a better loan experience.</div>
            </form>
          </div>
        </div>
      </main>
    </main>
  )
}
