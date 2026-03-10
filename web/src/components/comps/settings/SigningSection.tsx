import { useState, useEffect, useRef } from "react";
import { authHeaders } from "../../../hooks/useApi";
import SectionCard from "./SectionCard";
import { btnPrimary, btnSecondary, inputCls } from "../../../styles";

interface SigningStatus {
  hasCert: boolean;
  hasProfile: boolean;
  teamId: string | null;
}

interface Props {
  appId: string;
  addToast: (msg: string, type: "success" | "error" | "info") => void;
}

function readFileAsBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      const b64 = result.includes(",") ? result.split(",")[1] : result;
      resolve(b64);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export default function SigningSection({ appId, addToast }: Props) {
  const [status, setStatus] = useState<SigningStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [removing, setRemoving] = useState(false);
  const [showForm, setShowForm] = useState(false);

  const [p12File, setP12File] = useState<File | null>(null);
  const [profileFile, setProfileFile] = useState<File | null>(null);
  const [password, setPassword] = useState("");
  const [teamId, setTeamId] = useState("");

  const p12Ref = useRef<HTMLInputElement>(null);
  const profileRef = useRef<HTMLInputElement>(null);

  const fetchStatus = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/apps/${appId}/signing`, { headers: authHeaders() });
      if (res.ok) setStatus(await res.json());
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchStatus(); }, [appId]);

  const handleSave = async () => {
    if (!p12File || !profileFile || !password) {
      addToast("Certificate (.p12), provisioning profile, and password are required", "error");
      return;
    }
    setSaving(true);
    try {
      const p12Base64 = await readFileAsBase64(p12File);
      const profileBase64 = await readFileAsBase64(profileFile);
      const res = await fetch(`/api/apps/${appId}/signing`, {
        method: "PUT",
        headers: { ...authHeaders(), "Content-Type": "application/json" },
        body: JSON.stringify({ p12Base64, p12Password: password, profileBase64, teamId: teamId || undefined }),
      });
      if (!res.ok) throw new Error((await res.json()).error ?? "Failed to save");
      addToast("Signing credentials saved", "success");
      setShowForm(false);
      setP12File(null);
      setProfileFile(null);
      setPassword("");
      setTeamId("");
      fetchStatus();
    } catch (err: any) {
      addToast(err.message, "error");
    } finally {
      setSaving(false);
    }
  };

  const handleRemove = async () => {
    if (!confirm("Remove signing credentials? Binary builds will fail until new credentials are added.")) return;
    setRemoving(true);
    try {
      const res = await fetch(`/api/apps/${appId}/signing`, {
        method: "DELETE",
        headers: authHeaders(),
      });
      if (!res.ok) throw new Error((await res.json()).error ?? "Failed to remove");
      addToast("Signing credentials removed", "success");
      fetchStatus();
    } catch (err: any) {
      addToast(err.message, "error");
    } finally {
      setRemoving(false);
    }
  };

  if (loading) return null;

  const hasAll = status?.hasCert && status?.hasProfile;

  return (
    <SectionCard
      title="iOS Code Signing"
      desc="Upload your .p12 certificate and .mobileprovision profile so AppCore can build a signed IPA on each commit."
    >
      {hasAll && !showForm ? (
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-emerald-50 dark:bg-emerald-900/20 flex items-center justify-center">
              <svg className="w-4 h-4 text-emerald-600 dark:text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div>
              <div className="text-sm font-medium text-[#111827] dark:text-[#e8eaf0]">
                Credentials configured
              </div>
              <div className="text-[11px] text-[#9ca3af] dark:text-[#5c6478]">
                {status?.teamId ? `Team ID: ${status.teamId}` : "Cert + profile stored"}
              </div>
            </div>
          </div>
          <div className="flex gap-2">
            <button className={btnSecondary} onClick={() => setShowForm(true)}>Update</button>
            <button className={btnSecondary} onClick={handleRemove} disabled={removing}>
              {removing ? "Removing…" : "Remove"}
            </button>
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          {!hasAll && !showForm && (
            <div className="flex items-center justify-between">
              <div className="text-sm text-[#6b7280] dark:text-[#8b93a5]">
                No signing credentials configured — binary builds will be skipped.
              </div>
              <button className={btnPrimary} onClick={() => setShowForm(true)}>
                Add Credentials
              </button>
            </div>
          )}

          {showForm && (
            <div className="flex flex-col gap-3">
              {/* .p12 */}
              <div>
                <label className="block text-xs font-medium text-[#6b7280] dark:text-[#8b93a5] mb-1.5">
                  Certificate (.p12)
                </label>
                <div
                  className="flex items-center gap-3 px-3.5 py-[9px] rounded-xl border border-[#eef0f3] dark:border-[#2a2f3d] bg-white dark:bg-[#1c2028] cursor-pointer hover:border-[#ea0e2b] transition-colors"
                  onClick={() => p12Ref.current?.click()}
                >
                  <svg className="w-4 h-4 text-[#9ca3af] flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M18.375 12.739l-7.693 7.693a4.5 4.5 0 01-6.364-6.364l10.94-10.94A3 3 0 1119.5 7.372L8.552 18.32m.009-.01l-.01.01m5.699-9.941l-7.81 7.81a1.5 1.5 0 002.112 2.13" />
                  </svg>
                  <span className="text-[13px] text-[#9ca3af] dark:text-[#5c6478]">
                    {p12File ? p12File.name : "Choose .p12 file…"}
                  </span>
                  <input
                    ref={p12Ref}
                    type="file"
                    accept=".p12,.pfx"
                    className="hidden"
                    onChange={(e) => setP12File(e.target.files?.[0] ?? null)}
                  />
                </div>
              </div>

              {/* Password */}
              <div>
                <label className="block text-xs font-medium text-[#6b7280] dark:text-[#8b93a5] mb-1.5">
                  Certificate Password
                </label>
                <input
                  type="password"
                  className={inputCls}
                  placeholder="Password used to export the .p12"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </div>

              {/* .mobileprovision */}
              <div>
                <label className="block text-xs font-medium text-[#6b7280] dark:text-[#8b93a5] mb-1.5">
                  Provisioning Profile (.mobileprovision)
                </label>
                <div
                  className="flex items-center gap-3 px-3.5 py-[9px] rounded-xl border border-[#eef0f3] dark:border-[#2a2f3d] bg-white dark:bg-[#1c2028] cursor-pointer hover:border-[#ea0e2b] transition-colors"
                  onClick={() => profileRef.current?.click()}
                >
                  <svg className="w-4 h-4 text-[#9ca3af] flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
                  </svg>
                  <span className="text-[13px] text-[#9ca3af] dark:text-[#5c6478]">
                    {profileFile ? profileFile.name : "Choose .mobileprovision file…"}
                  </span>
                  <input
                    ref={profileRef}
                    type="file"
                    accept=".mobileprovision"
                    className="hidden"
                    onChange={(e) => setProfileFile(e.target.files?.[0] ?? null)}
                  />
                </div>
              </div>

              {/* Team ID */}
              <div>
                <label className="block text-xs font-medium text-[#6b7280] dark:text-[#8b93a5] mb-1.5">
                  Apple Team ID <span className="font-normal text-[#9ca3af]">(optional)</span>
                </label>
                <input
                  type="text"
                  className={inputCls}
                  placeholder="e.g. ABC123XYZ"
                  value={teamId}
                  onChange={(e) => setTeamId(e.target.value)}
                />
              </div>

              <div className="flex gap-2 pt-1">
                <button className={btnPrimary} onClick={handleSave} disabled={saving}>
                  {saving ? "Saving…" : "Save Credentials"}
                </button>
                <button className={btnSecondary} onClick={() => { setShowForm(false); setP12File(null); setProfileFile(null); setPassword(""); }}>
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </SectionCard>
  );
}
