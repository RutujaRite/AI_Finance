/**
 * User Profile & Account Settings
 * CallNow CRM Design System compliant
 */

"use client"
import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import Topbar from "../../components/Topbar"

export default function ProfilePage() {
  const router = useRouter()
  const [profile, setProfile] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [message, setMessage] = useState("")
  const [saving, setSaving] = useState(false)
  const [photoUploading, setPhotoUploading] = useState(false)
  const [selectedModel, setSelectedModel] = useState("liquid/lfm-2.5-embedding-350m:free")

  // Password fields
  const [newPassword, setNewPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [showNewPw, setShowNewPw] = useState(false)
  const [showConfirmPw, setShowConfirmPw] = useState(false)
  const [passMessage, setPassMessage] = useState<{ text: string; type: "success" | "danger" } | null>(null)

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
      setMessage(data.success ? "Profile saved successfully" : "Failed to save profile")
    } catch (e) {
      setMessage("Error saving profile")
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
      alert("Error removing photo")
    }
  }

  async function changePassword(e: React.FormEvent) {
    e.preventDefault()
    if (!newPassword || newPassword.length < 4) {
      setPassMessage({ text: "Password must be at least 4 characters long", type: "danger" })
      return
    }
    if (newPassword !== confirmPassword) {
      setPassMessage({ text: "Passwords do not match", type: "danger" })
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
        setPassMessage({ text: "Password updated successfully", type: "success" })
        setNewPassword("")
        setConfirmPassword("")
        setTimeout(() => setPassMessage(null), 4000)
      } else {
        setPassMessage({ text: data.error || "Update failed", type: "danger" })
      }
    } catch (e) {
      setPassMessage({ text: "Update failed", type: "danger" })
    }
  }

  if (loading) {
    return (
      <main style={{ padding: 48, display: "flex", flexDirection: "column", justifyContent: "center", alignItems: "center", minHeight: "100vh", gap: 12 }}>
        <div className="spinner-border text-primary" style={{ width: 36, height: 36 }} role="status"></div>
        <p style={{ color: "var(--bs-secondary-color)", fontWeight: 500 }}>Loading profile...</p>
      </main>
    )
  }

  if (!profile) {
    return (
      <main style={{ padding: 48, textAlign: "center" }}>
        <h3>Not authenticated</h3>
        <p style={{ color: "var(--bs-secondary-color)" }}>Please sign in to access your profile.</p>
        <a href="/login" className="btn btn-primary" style={{ marginTop: 12 }}>Sign In</a>
      </main>
    )
  }

  const dobVal = profile.dob
    ? new Date(profile.dob).toISOString().slice(0, 10)
    : ""
  const lastLogin = profile.last_login
    ? new Date(profile.last_login).toLocaleString("en-US", { year: "numeric", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })
    : "Never"
  const nameOrEmail = profile.name || profile.email || "U"
  const parts = nameOrEmail.split(/[\s@]/).filter(Boolean).slice(0, 2)
  const initials = parts.map((p: string) => p[0]).join("").toUpperCase()

  return (
    <div className="app-shell" style={{ minHeight: "100vh", background: "var(--bg)", display: "flex", flexDirection: "column" }}>
      <Topbar
        user={profile}
        pathname="/profile"
      />

      <main className="profile-page" style={{ padding: "28px 32px 56px 32px", maxWidth: "1080px", margin: "0 auto", width: "100%", boxSizing: "border-box" }}>
        {/* Page Header */}
        <div className="page-header" style={{ marginBottom: "28px", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "16px" }}>
          <div>
            <h1 className="page-title">My Account & Settings</h1>
            <p className="page-subtitle">Manage personal information, financial parameters, and account security credentials</p>
          </div>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={async () => {
              try {
                await fetch("/api/auth/logout", { method: "POST", credentials: "include" })
              } catch (e) {}
              try {
                localStorage.removeItem("emi_chat_state_v2")
              } catch (e) {}
              router.replace("/login")
            }}
            style={{ display: "inline-flex", alignItems: "center", gap: "0.5rem", color: "var(--danger)" }}
            title="Log out of your account"
          >
            <i className="bi bi-box-arrow-right" /> Logout
          </button>
        </div>

        {/* Profile Overview Hero Banner Card */}
        <div className="card" style={{ marginBottom: "28px", padding: "28px" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "24px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "20px" }}>
              {/* Avatar with upload and remove overlay */}
              <div style={{ position: "relative", width: "88px", height: "88px" }}>
                <div 
                  style={{
                    width: "88px",
                    height: "88px",
                    borderRadius: "50%",
                    background: "linear-gradient(135deg, var(--accent) 0%, #4338ca 100%)",
                    color: "#fff",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: "2rem",
                    fontWeight: 700,
                    overflow: "hidden",
                    border: "3px solid var(--bs-border-color)",
                    boxShadow: "0 4px 12px rgba(0,0,0,0.08)",
                  }}
                >
                  {profile.profile_photo_path ? (
                    <img 
                      src={profile.profile_photo_path} 
                      alt="Profile" 
                      style={{ width: "100%", height: "100%", objectFit: "cover" }} 
                    />
                  ) : (
                    <span>{initials}</span>
                  )}
                </div>

                {/* Upload camera trigger */}
                <label 
                  htmlFor="profilePhotoUploadInput" 
                  title="Upload new avatar"
                  style={{
                    position: "absolute",
                    bottom: 0,
                    right: 0,
                    width: "30px",
                    height: "30px",
                    borderRadius: "50%",
                    background: "var(--accent)",
                    color: "#fff",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    cursor: "pointer",
                    boxShadow: "0 2px 6px rgba(0,0,0,0.2)",
                    fontSize: "0.85rem",
                    border: "2px solid var(--bs-card-bg)",
                  }}
                >
                  <i className="bi bi-camera-fill"></i>
                  <input
                    id="profilePhotoUploadInput"
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    onChange={onFileChange}
                    style={{ display: "none" }}
                  />
                </label>

                {/* Remove photo button */}
                {profile.profile_photo_path && (
                  <button
                    type="button"
                    onClick={deletePhoto}
                    title="Remove avatar"
                    style={{
                      position: "absolute",
                      top: 0,
                      right: 0,
                      width: "24px",
                      height: "24px",
                      borderRadius: "50%",
                      background: "var(--bs-danger)",
                      color: "#fff",
                      border: "2px solid var(--bs-card-bg)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: "0.75rem",
                      cursor: "pointer",
                    }}
                  >
                    <i className="bi bi-x"></i>
                  </button>
                )}
              </div>

              <div>
                <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "4px" }}>
                  <h2 style={{ fontSize: "1.4rem", fontWeight: 700, margin: 0, color: "var(--bs-heading-color)" }}>
                    {profile.name || profile.email}
                  </h2>
                  <span className="badge badge-primary" style={{ textTransform: "capitalize" }}>
                    {profile.role || "User"}
                  </span>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: "14px", color: "var(--bs-secondary-color)", fontSize: "0.875rem" }}>
                  <span><i className="bi bi-shield-check" style={{ color: "var(--bs-success)", marginRight: 4 }}></i> Verified Account</span>
                  <span>•</span>
                  <span><i className="bi bi-calendar-event" style={{ marginRight: 4 }}></i> Member since {profile.created_at ? new Date(profile.created_at).toLocaleDateString("en-US", { month: "short", year: "numeric" }) : "2024"}</span>
                </div>
              </div>
            </div>

            {/* Quick stats badge group */}
            <div style={{ display: "flex", gap: "16px", flexWrap: "wrap" }}>
              <div style={{ padding: "10px 16px", borderRadius: "var(--border-radius-sm)", background: "var(--bs-tertiary-bg)", border: "1px solid var(--bs-border-color)" }}>
                <span style={{ fontSize: "0.75rem", color: "var(--bs-secondary-color)", display: "block" }}>Last Authentication</span>
                <span style={{ fontSize: "0.875rem", fontWeight: 600, color: "var(--bs-heading-color)" }}>{lastLogin}</span>
              </div>
              <div style={{ padding: "10px 16px", borderRadius: "var(--border-radius-sm)", background: "var(--bs-tertiary-bg)", border: "1px solid var(--bs-border-color)" }}>
                <span style={{ fontSize: "0.75rem", color: "var(--bs-secondary-color)", display: "block" }}>Account Status</span>
                <span className="badge badge-success" style={{ marginTop: 2 }}>ACTIVE</span>
              </div>
            </div>
          </div>

          {photoUploading && (
            <div style={{ marginTop: "16px", padding: "8px 12px", background: "rgba(94, 106, 210, 0.1)", color: "var(--accent)", borderRadius: "var(--border-radius-sm)", fontSize: "0.85rem", display: "flex", alignItems: "center", gap: "8px" }}>
              <span className="spinner-border spinner-border-sm" role="status"></span>
              Uploading profile photo...
            </div>
          )}
        </div>

        {/* Section 1: Personal Details */}
        <div className="card" style={{ marginBottom: "28px" }}>
          <div className="card-header">
            <h2 className="card-title">
              <i className="bi bi-person-bounding-box" style={{ color: "var(--accent)" }}></i>
              Personal Information
            </h2>
          </div>
          <div className="card-body">
            <form onSubmit={save}>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: "18px" }}>
                <div>
                  <label className="form-label">Full Legal Name</label>
                  <input
                    type="text"
                    className="form-control"
                    id="name"
                    value={profile.name || ""}
                    onChange={(e) => setProfile({ ...profile, name: e.target.value })}
                    placeholder="e.g. Johnathan Doe"
                  />
                </div>

                <div>
                  <label className="form-label">Email Address (Read-only)</label>
                  <input
                    type="email"
                    className="form-control"
                    id="email"
                    value={profile.email || ""}
                    disabled
                    style={{ opacity: 0.7, cursor: "not-allowed" }}
                  />
                </div>

                <div>
                  <label className="form-label">Mobile Number</label>
                  <input
                    type="text"
                    className="form-control"
                    id="mobile"
                    value={profile.mobile || ""}
                    onChange={(e) => setProfile({ ...profile, mobile: e.target.value })}
                    placeholder="+91 98765 43210"
                  />
                </div>

                <div>
                  <label className="form-label">Date of Birth</label>
                  <input
                    type="date"
                    className="form-control"
                    id="dob"
                    value={dobVal}
                    onChange={(e) => setProfile({ ...profile, dob: e.target.value })}
                  />
                </div>

                <div>
                  <label className="form-label">Gender</label>
                  <select
                    className="form-control"
                    id="gender"
                    value={profile.gender || ""}
                    onChange={(e) => setProfile({ ...profile, gender: e.target.value })}
                  >
                    <option value="">Select Gender</option>
                    <option value="Male">Male</option>
                    <option value="Female">Female</option>
                    <option value="Other">Other</option>
                  </select>
                </div>

                <div>
                  <label className="form-label">Residential Address</label>
                  <input
                    type="text"
                    className="form-control"
                    id="address"
                    value={profile.address || ""}
                    onChange={(e) => setProfile({ ...profile, address: e.target.value })}
                    placeholder="Street, Landmark, Apartment"
                  />
                </div>

                <div>
                  <label className="form-label">City / Region</label>
                  <input
                    type="text"
                    className="form-control"
                    id="city"
                    value={profile.city || ""}
                    onChange={(e) => setProfile({ ...profile, city: e.target.value })}
                    placeholder="e.g. Mumbai, Pune, Delhi"
                  />
                </div>

                <div>
                  <label className="form-label">Postal Pincode</label>
                  <input
                    type="text"
                    className="form-control"
                    id="pincode"
                    value={profile.pincode || ""}
                    onChange={(e) => setProfile({ ...profile, pincode: e.target.value })}
                    placeholder="e.g. 400001"
                  />
                </div>
              </div>

              <div style={{ marginTop: "24px", display: "flex", alignItems: "center", gap: "14px" }}>
                <button type="submit" className="btn btn-primary" disabled={saving}>
                  {saving ? (
                    <>
                      <span className="spinner-border spinner-border-sm" role="status"></span>
                      Saving...
                    </>
                  ) : (
                    <>
                      <i className="bi bi-check2-circle"></i>
                      Save Personal Information
                    </>
                  )}
                </button>
                {message && (
                  <span className={`badge ${message.includes("successfully") ? "badge-success" : "badge-danger"}`} style={{ padding: "8px 12px", fontSize: "0.85rem" }}>
                    {message}
                  </span>
                )}
              </div>
            </form>
          </div>
        </div>

        {/* Section 2: Loan & Financial Parameters */}
        <div className="card" style={{ marginBottom: "28px" }}>
          <div className="card-header">
            <h2 className="card-title">
              <i className="bi bi-briefcase" style={{ color: "var(--bs-success)" }}></i>
              Loan & Employment Information
            </h2>
          </div>
          <div className="card-body">
            <form onSubmit={save}>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: "18px" }}>
                <div>
                  <label className="form-label">Designation / Occupation</label>
                  <input
                    type="text"
                    className="form-control"
                    id="occupation"
                    value={profile.occupation || ""}
                    onChange={(e) => setProfile({ ...profile, occupation: e.target.value })}
                    placeholder="e.g. Software Engineer, Business Owner"
                  />
                </div>

                <div>
                  <label className="form-label">Employment Classification</label>
                  <select
                    className="form-control"
                    id="employment_type"
                    value={profile.employment_type || ""}
                    onChange={(e) => setProfile({ ...profile, employment_type: e.target.value })}
                  >
                    <option value="">Select Employment Type</option>
                    <option value="Salaried">Salaried (Private / Govt)</option>
                    <option value="Self-Employed">Self-Employed Professional / Business</option>
                    <option value="Student">Student / Intern</option>
                    <option value="Other">Other / Retired</option>
                  </select>
                </div>

                <div>
                  <label className="form-label">Monthly Net Income (₹)</label>
                  <input
                    type="number"
                    className="form-control"
                    id="monthly_income"
                    value={profile.monthly_income || ""}
                    onChange={(e) => setProfile({ ...profile, monthly_income: e.target.value })}
                    placeholder="e.g. 75000"
                  />
                </div>

                <div>
                  <label className="form-label">Marital Status</label>
                  <select
                    className="form-control"
                    id="marital_status"
                    value={profile.marital_status || ""}
                    onChange={(e) => setProfile({ ...profile, marital_status: e.target.value })}
                  >
                    <option value="">Select Marital Status</option>
                    <option value="Single">Single</option>
                    <option value="Married">Married</option>
                    <option value="Other">Other</option>
                  </select>
                </div>

                <div>
                  <label className="form-label">Residence Type</label>
                  <select
                    className="form-control"
                    id="residence_type"
                    value={profile.residence_type || ""}
                    onChange={(e) => setProfile({ ...profile, residence_type: e.target.value })}
                  >
                    <option value="">Select Residence Type</option>
                    <option value="Owned">Self-Owned / Family Owned</option>
                    <option value="Rented">Rented Accommodation</option>
                    <option value="Other">Company Provided / Other</option>
                  </select>
                </div>

                <div>
                  <label className="form-label">PAN Number</label>
                  <input
                    type="text"
                    className="form-control"
                    id="pan"
                    value={profile.pan || ""}
                    onChange={(e) => setProfile({ ...profile, pan: e.target.value.toUpperCase() })}
                    placeholder="e.g. ABCDE1234F"
                    maxLength={10}
                  />
                </div>

                <div>
                  <label className="form-label">Aadhar Number (Last 4 digits or ID)</label>
                  <input
                    type="text"
                    className="form-control"
                    id="aadhar"
                    value={profile.aadhar || ""}
                    onChange={(e) => setProfile({ ...profile, aadhar: e.target.value })}
                    placeholder="e.g. 1234 5678 9012"
                    maxLength={14}
                  />
                </div>
              </div>

              <div style={{ marginTop: "24px", display: "flex", alignItems: "center", gap: "14px" }}>
                <button type="submit" className="btn btn-primary" disabled={saving}>
                  {saving ? (
                    <>
                      <span className="spinner-border spinner-border-sm" role="status"></span>
                      Saving...
                    </>
                  ) : (
                    <>
                      <i className="bi bi-shield-check"></i>
                      Save Financial Parameters
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>

        {/* Section 3: Security & Password Update */}
        <div className="card">
          <div className="card-header">
            <h2 className="card-title">
              <i className="bi bi-lock" style={{ color: "var(--bs-warning)" }}></i>
              Security Credentials & Password
            </h2>
          </div>
          <div className="card-body">
            <form onSubmit={changePassword} style={{ maxWidth: "560px" }}>
              <div style={{ marginBottom: "16px" }}>
                <label className="form-label">New Account Password</label>
                <div style={{ position: "relative" }}>
                  <input
                    type={showNewPw ? "text" : "password"}
                    className="form-control"
                    id="newPassword"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="Minimum 4 characters"
                    required
                    style={{ paddingRight: "44px" }}
                  />
                  <button
                    type="button"
                    onClick={() => setShowNewPw(!showNewPw)}
                    style={{
                      position: "absolute",
                      right: "12px",
                      top: "50%",
                      transform: "translateY(-50%)",
                      background: "none",
                      border: "none",
                      color: "var(--bs-secondary-color)",
                      cursor: "pointer",
                      padding: 0,
                    }}
                    aria-label="Toggle password visibility"
                  >
                    <i className={`bi ${showNewPw ? "bi-eye-slash" : "bi-eye"}`}></i>
                  </button>
                </div>
              </div>

              <div style={{ marginBottom: "20px" }}>
                <label className="form-label">Confirm New Password</label>
                <div style={{ position: "relative" }}>
                  <input
                    type={showConfirmPw ? "text" : "password"}
                    className="form-control"
                    id="confirmPassword"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Re-enter new password"
                    required
                    style={{ paddingRight: "44px" }}
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPw(!showConfirmPw)}
                    style={{
                      position: "absolute",
                      right: "12px",
                      top: "50%",
                      transform: "translateY(-50%)",
                      background: "none",
                      border: "none",
                      color: "var(--bs-secondary-color)",
                      cursor: "pointer",
                      padding: 0,
                    }}
                    aria-label="Toggle password visibility"
                  >
                    <i className={`bi ${showConfirmPw ? "bi-eye-slash" : "bi-eye"}`}></i>
                  </button>
                </div>
              </div>

              {passMessage && (
                <div className={`alert ${passMessage.type === "success" ? "alert-success" : "alert-danger"}`} style={{ marginBottom: "16px", padding: "10px 14px", fontSize: "0.85rem" }}>
                  <i className={`bi ${passMessage.type === "success" ? "bi-check-circle" : "bi-exclamation-triangle"}`}></i>
                  <span>{passMessage.text}</span>
                </div>
              )}

              <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                <button type="submit" className="btn btn-secondary">
                  <i className="bi bi-key"></i>
                  Update Password
                </button>
              </div>

              <p style={{ marginTop: "14px", fontSize: "0.8rem", color: "var(--bs-secondary-color)", margin: "14px 0 0 0" }}>
                Keep your credentials protected. We recommend using a strong password with letters, numbers, and symbols.
              </p>
            </form>
          </div>
        </div>
      </main>
    </div>
  )
}
