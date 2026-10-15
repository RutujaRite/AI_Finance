/**
 * User Profile & Account Settings
 * Modern CreditWise FinTech Design System compliant
 */

"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Topbar from "../../components/Topbar";
import {
  User,
  Mail,
  Phone,
  Calendar,
  MapPin,
  Briefcase,
  ShieldCheck,
  Lock,
  Key,
  Camera,
  Trash2,
  LogOut,
  CheckCircle2,
  AlertCircle,
  Eye,
  EyeOff,
  Sparkles,
  CreditCard,
  Building,
} from "lucide-react";

export default function ProfilePage() {
  const router = useRouter();
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);
  const [photoUploading, setPhotoUploading] = useState(false);

  // Password fields
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showNewPw, setShowNewPw] = useState(false);
  const [showConfirmPw, setShowConfirmPw] = useState(false);
  const [passMessage, setPassMessage] = useState<{ text: string; type: "success" | "danger" } | null>(null);

  useEffect(() => {
    fetch("/api/auth/verify", { credentials: "include" })
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((d) => {
        if (!d.success) throw new Error("Not authenticated");
        return fetch("/api/profile/me", { credentials: "include" });
      })
      .then((r) => r.json())
      .then((d) => {
        if (d.success) setProfile(d.user);
      })
      .catch(() => router.replace("/?auth=login"))
      .finally(() => setLoading(false));
  }, [router]);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setMessage("");
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
      };
      const res = await fetch("/api/profile/update", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
        credentials: "include",
      });
      const data = await res.json();
      setMessage(data.success ? "Profile saved successfully" : "Failed to save profile");
    } catch (e) {
      setMessage("Error saving profile");
    } finally {
      setSaving(false);
    }
  }

  function onFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    const reader = new FileReader();
    reader.onload = async () => {
      const base = reader.result as string;
      setPhotoUploading(true);
      try {
        const res = await fetch("/api/profile/photo", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ filename: f.name, data: base }),
          credentials: "include",
        });
        const data = await res.json();
        if (data.success) {
          setProfile((p: any) => ({ ...p, profile_photo_path: data.path }));
        } else {
          alert("Upload failed: " + (data.error || ""));
        }
      } catch (err) {
        alert("Upload error");
      } finally {
        setPhotoUploading(false);
      }
    };
    reader.readAsDataURL(f);
  }

  async function deletePhoto() {
    if (!confirm("Remove profile photo?")) return;
    try {
      const res = await fetch("/api/profile/photo", { method: "DELETE", credentials: "include" });
      const data = await res.json();
      if (data.success) setProfile((p: any) => ({ ...p, profile_photo_path: null }));
      else alert("Delete failed");
    } catch (e) {
      alert("Error removing photo");
    }
  }

  async function changePassword(e: React.FormEvent) {
    e.preventDefault();
    if (!newPassword || newPassword.length < 4) {
      setPassMessage({ text: "Password must be at least 4 characters long", type: "danger" });
      return;
    }
    if (newPassword !== confirmPassword) {
      setPassMessage({ text: "Passwords do not match", type: "danger" });
      return;
    }
    try {
      const res = await fetch("/api/profile/change-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ newPassword }),
        credentials: "include",
      });
      const data = await res.json();
      if (data.success) {
        setPassMessage({ text: "Password updated successfully", type: "success" });
        setNewPassword("");
        setConfirmPassword("");
        setTimeout(() => setPassMessage(null), 4000);
      } else {
        setPassMessage({ text: data.error || "Update failed", type: "danger" });
      }
    } catch (e) {
      setPassMessage({ text: "Update failed", type: "danger" });
    }
  }

  if (loading) {
    return (
      <main className="flex flex-col items-center justify-center min-h-screen gap-3 bg-slate-50">
        <div className="w-9 h-9 border-3 border-blue-600 border-t-transparent rounded-full animate-spin" />
        <p className="text-slate-500 font-medium text-sm">Loading your profile...</p>
      </main>
    );
  }

  if (!profile) {
    return (
      <main className="p-12 text-center max-w-md mx-auto">
        <h3 className="text-lg font-bold text-slate-900">Not authenticated</h3>
        <p className="text-slate-500 text-sm mt-1">Please sign in to access your profile settings.</p>
        <button
          onClick={() => router.push("/?auth=login")}
          className="cw-btn-primary text-xs py-2 px-4 mt-4 inline-flex items-center"
        >
          Sign In
        </button>
      </main>
    );
  }

  const dobVal = profile.dob
    ? new Date(profile.dob).toISOString().slice(0, 10)
    : "";
  const lastLogin = profile.last_login
    ? new Date(profile.last_login).toLocaleString("en-US", { year: "numeric", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })
    : "Never";
  const nameOrEmail = profile.name || profile.email || "U";
  const parts = nameOrEmail.split(/[\s@]/).filter(Boolean).slice(0, 2);
  const initials = parts.map((p: string) => p[0]).join("").toUpperCase();

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans">
      <Topbar user={profile} pathname="/profile" />

      <main className="flex-1 max-w-[1080px] w-full mx-auto px-6 sm:px-8 py-8 space-y-6">
        {/* Page Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight">
              My Account & Settings
            </h1>
            <p className="text-sm text-slate-500 mt-1">
              Manage personal identity, financial parameters, and account security credentials.
            </p>
          </div>
          <button
            type="button"
            onClick={async () => {
              try {
                await fetch("/api/auth/logout", { method: "POST", credentials: "include" });
              } catch (e) {}
              try {
                localStorage.removeItem("emi_chat_state_v2");
                localStorage.removeItem("finai_user");
                sessionStorage.clear();
              } catch (e) {}
              router.push("/?logout=true");
            }}
            className="cw-btn-danger text-xs py-2 px-3 inline-flex items-center gap-1.5"
            title="Log out of your account"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>Sign Out</span>
          </button>
        </div>

        {/* Profile Overview Hero Card */}
        <div className="cw-card p-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6">
            <div className="flex items-center gap-5">
              {/* Avatar with upload and remove overlay */}
              <div className="relative w-20 h-20 shrink-0">
                <div className="w-20 h-20 rounded-2xl bg-gradient-to-tr from-slate-900 to-blue-700 text-white flex items-center justify-center text-2xl font-bold overflow-hidden shadow-xs border-2 border-white">
                  {profile.profile_photo_path ? (
                    <img
                      src={profile.profile_photo_path}
                      alt="Profile"
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <span>{initials}</span>
                  )}
                </div>

                {/* Upload camera trigger */}
                <label
                  htmlFor="profilePhotoUploadInput"
                  title="Upload new avatar"
                  className="absolute -bottom-1 -right-1 w-7 h-7 rounded-lg bg-blue-600 hover:bg-blue-700 text-white flex items-center justify-center cursor-pointer shadow-sm border-2 border-white transition-colors"
                >
                  <Camera className="w-3.5 h-3.5" />
                  <input
                    id="profilePhotoUploadInput"
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    onChange={onFileChange}
                    className="hidden"
                  />
                </label>

                {/* Remove photo button */}
                {profile.profile_photo_path && (
                  <button
                    type="button"
                    onClick={deletePhoto}
                    title="Remove avatar"
                    className="absolute -top-1 -right-1 w-6 h-6 rounded-lg bg-red-600 hover:bg-red-700 text-white border-2 border-white flex items-center justify-center text-xs cursor-pointer shadow-sm"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                )}
              </div>

              <div>
                <div className="flex items-center gap-2.5">
                  <h2 className="text-xl font-bold text-slate-900 m-0">
                    {profile.name || profile.email}
                  </h2>
                  <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md bg-blue-50 text-blue-700 border border-blue-200">
                    {profile.role || "User"}
                  </span>
                </div>
                <div className="flex items-center gap-3 text-xs text-slate-500 mt-1.5 flex-wrap">
                  <span className="inline-flex items-center gap-1 text-emerald-600 font-medium">
                    <ShieldCheck className="w-3.5 h-3.5" /> Verified Account
                  </span>
                  <span>•</span>
                  <span>
                    Member since {profile.created_at ? new Date(profile.created_at).toLocaleDateString("en-US", { month: "short", year: "numeric" }) : "2024"}
                  </span>
                </div>
              </div>
            </div>

            {/* Quick stats badge group */}
            <div className="flex gap-3 flex-wrap">
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 text-left">
                <span className="text-[11px] text-slate-400 block font-medium">Last Login</span>
                <span className="text-xs font-semibold text-slate-800 mt-0.5 block">{lastLogin}</span>
              </div>
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 text-left">
                <span className="text-[11px] text-slate-400 block font-medium">Account Status</span>
                <span className="text-xs font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full inline-block mt-0.5">
                  Active
                </span>
              </div>
            </div>
          </div>

          {photoUploading && (
            <div className="mt-4 p-2.5 bg-blue-50 text-blue-700 rounded-lg text-xs flex items-center gap-2 border border-blue-200 animate-pulse">
              <div className="w-3.5 h-3.5 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
              <span>Uploading profile photo...</span>
            </div>
          )}
        </div>

        {/* Section 1: Personal Details */}
        <div className="cw-card p-6 space-y-5">
          <div className="flex items-center gap-2 font-bold text-slate-900 text-sm border-b border-slate-100 pb-3">
            <User className="w-4 h-4 text-blue-600" />
            <span>Personal Information</span>
          </div>

          <form onSubmit={save} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">
                  Full Legal Name
                </label>
                <input
                  type="text"
                  className="cw-input"
                  id="name"
                  value={profile.name || ""}
                  onChange={(e) => setProfile({ ...profile, name: e.target.value })}
                  placeholder="e.g. Johnathan Doe"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">
                  Email Address (Read-only)
                </label>
                <input
                  type="email"
                  className="cw-input opacity-70 cursor-not-allowed bg-slate-50"
                  id="email"
                  value={profile.email || ""}
                  disabled
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">
                  Mobile Number
                </label>
                <input
                  type="text"
                  className="cw-input"
                  id="mobile"
                  value={profile.mobile || ""}
                  onChange={(e) => setProfile({ ...profile, mobile: e.target.value })}
                  placeholder="+91 98765 43210"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">
                  Date of Birth
                </label>
                <input
                  type="date"
                  className="cw-input"
                  id="dob"
                  value={dobVal}
                  onChange={(e) => setProfile({ ...profile, dob: e.target.value })}
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">
                  Gender
                </label>
                <select
                  className="cw-select"
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
                <label className="text-xs font-semibold text-slate-700 block mb-1">
                  Residential Address
                </label>
                <input
                  type="text"
                  className="cw-input"
                  id="address"
                  value={profile.address || ""}
                  onChange={(e) => setProfile({ ...profile, address: e.target.value })}
                  placeholder="Street, Landmark, Apartment"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">
                  City / Region
                </label>
                <input
                  type="text"
                  className="cw-input"
                  id="city"
                  value={profile.city || ""}
                  onChange={(e) => setProfile({ ...profile, city: e.target.value })}
                  placeholder="e.g. Mumbai, Pune, Delhi"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">
                  Postal Pincode
                </label>
                <input
                  type="text"
                  className="cw-input"
                  id="pincode"
                  value={profile.pincode || ""}
                  onChange={(e) => setProfile({ ...profile, pincode: e.target.value })}
                  placeholder="e.g. 400001"
                />
              </div>
            </div>

            <div className="pt-2 flex items-center gap-3">
              <button
                type="submit"
                className="cw-btn-primary text-xs py-2 px-4 inline-flex items-center gap-1.5"
                disabled={saving}
              >
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>{saving ? "Saving..." : "Save Personal Details"}</span>
              </button>
              {message && (
                <span className={`text-xs font-semibold px-2.5 py-1 rounded-md ${
                  message.includes("successfully") ? "bg-emerald-50 text-emerald-700 border border-emerald-200" : "bg-red-50 text-red-700 border border-red-200"
                }`}>
                  {message}
                </span>
              )}
            </div>
          </form>
        </div>

        {/* Section 2: Loan & Financial Parameters */}
        <div className="cw-card p-6 space-y-5">
          <div className="flex items-center gap-2 font-bold text-slate-900 text-sm border-b border-slate-100 pb-3">
            <Briefcase className="w-4 h-4 text-emerald-600" />
            <span>Loan & Employment Profile</span>
          </div>

          <form onSubmit={save} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">
                  Designation / Occupation
                </label>
                <input
                  type="text"
                  className="cw-input"
                  id="occupation"
                  value={profile.occupation || ""}
                  onChange={(e) => setProfile({ ...profile, occupation: e.target.value })}
                  placeholder="e.g. Software Engineer, Business Owner"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">
                  Employment Classification
                </label>
                <select
                  className="cw-select"
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
                <label className="text-xs font-semibold text-slate-700 block mb-1">
                  Monthly Net Income (₹)
                </label>
                <input
                  type="number"
                  className="cw-input"
                  id="monthly_income"
                  value={profile.monthly_income || ""}
                  onChange={(e) => setProfile({ ...profile, monthly_income: e.target.value })}
                  placeholder="e.g. 75000"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">
                  Marital Status
                </label>
                <select
                  className="cw-select"
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
                <label className="text-xs font-semibold text-slate-700 block mb-1">
                  Residence Type
                </label>
                <select
                  className="cw-select"
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
                <label className="text-xs font-semibold text-slate-700 block mb-1">
                  PAN Number
                </label>
                <input
                  type="text"
                  className="cw-input"
                  id="pan"
                  value={profile.pan || ""}
                  onChange={(e) => setProfile({ ...profile, pan: e.target.value.toUpperCase() })}
                  placeholder="e.g. ABCDE1234F"
                  maxLength={10}
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">
                  Aadhaar Number (Last 4 digits or ID)
                </label>
                <input
                  type="text"
                  className="cw-input"
                  id="aadhar"
                  value={profile.aadhar || ""}
                  onChange={(e) => setProfile({ ...profile, aadhar: e.target.value })}
                  placeholder="e.g. 1234 5678 9012"
                  maxLength={14}
                />
              </div>
            </div>

            <div className="pt-2">
              <button
                type="submit"
                className="cw-btn-primary text-xs py-2 px-4 inline-flex items-center gap-1.5"
                disabled={saving}
              >
                <ShieldCheck className="w-3.5 h-3.5" />
                <span>Save Financial Profile</span>
              </button>
            </div>
          </form>
        </div>

        {/* Section 3: Security & Password Update */}
        <div className="cw-card p-6 space-y-5">
          <div className="flex items-center gap-2 font-bold text-slate-900 text-sm border-b border-slate-100 pb-3">
            <Lock className="w-4 h-4 text-amber-600" />
            <span>Security Credentials & Password</span>
          </div>

          <form onSubmit={changePassword} className="space-y-4 max-w-lg">
            <div>
              <label className="text-xs font-semibold text-slate-700 block mb-1">
                New Account Password
              </label>
              <div className="relative">
                <input
                  type={showNewPw ? "text" : "password"}
                  className="cw-input pr-10"
                  id="newPassword"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Minimum 4 characters"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowNewPw(!showNewPw)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
                  aria-label="Toggle password visibility"
                >
                  {showNewPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-700 block mb-1">
                Confirm New Password
              </label>
              <div className="relative">
                <input
                  type={showConfirmPw ? "text" : "password"}
                  className="cw-input pr-10"
                  id="confirmPassword"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Re-enter new password"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPw(!showConfirmPw)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
                  aria-label="Toggle password visibility"
                >
                  {showConfirmPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {passMessage && (
              <div className={`p-3 rounded-lg text-xs font-medium flex items-center gap-2 ${
                passMessage.type === "success"
                  ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                  : "bg-red-50 text-red-700 border border-red-200"
              }`}>
                {passMessage.type === "success" ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                ) : (
                  <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
                )}
                <span>{passMessage.text}</span>
              </div>
            )}

            <button
              type="submit"
              className="cw-btn-secondary text-xs py-2 px-4 inline-flex items-center gap-1.5"
            >
              <Key className="w-3.5 h-3.5 text-slate-500" />
              <span>Update Password</span>
            </button>

            <p className="text-[11px] text-slate-400 mt-2">
              Keep your credentials protected. We recommend using a strong password with letters, numbers, and symbols.
            </p>
          </form>
        </div>
      </main>
    </div>
  );
}
