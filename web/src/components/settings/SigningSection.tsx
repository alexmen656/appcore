import { useState, useEffect, useRef } from "react";
import { authHeaders } from "../../hooks/useApi";
import SectionCard from "./SectionCard";
import { borderDefault, btnPrimary, btnSecondary, inputCls, textMuted, textPrimary, textSecondary } from "../../styles";
import { CheckCircle, Paperclip, FileText } from "lucide-react";

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
      const res = await fetch(`/api/apps/${appId}/signing`, {
        headers: authHeaders(),
      });
      if (res.ok) setStatus(await res.json());
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStatus();
  }, [appId]);

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
        body: JSON.stringify({
          p12Base64,
          p12Password: password,
          profileBase64,
          teamId: teamId || undefined,
        }),
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
      desc="Upload your .p12 certificate and .mobileprovision profile so Marteso can build a signed IPA on each commit."
    >
      {hasAll && !showForm ? (
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-emerald-50 dark:bg-emerald-900/20 flex items-center justify-center">
              <CheckCircle className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
            </div>
            <div>
              <div className={`text-sm font-medium ${textPrimary}`}>Credentials configured</div>
              <div className={`text-[11px] ${textMuted}`}>
                {status?.teamId ? `Team ID: ${status.teamId}` : "Cert + profile stored"}
              </div>
            </div>
          </div>
          <div className="flex gap-2">
            <button className={btnSecondary} onClick={() => setShowForm(true)}>
              Update
            </button>
            <button className={btnSecondary} onClick={handleRemove} disabled={removing}>
              {removing ? "Removing…" : "Remove"}
            </button>
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          {!hasAll && !showForm && (
            <div className="flex items-center justify-between">
              <div className={`text-sm ${textSecondary}`}>
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
                <label className={`block text-xs font-medium ${textSecondary} mb-1.5`}>Certificate (.p12)</label>
                <div
                  className={`flex items-center gap-3 px-3.5 py-[9px] rounded-xl border ${borderDefault} bg-white dark:bg-[#1c2028] cursor-pointer hover:border-[#D94412] transition-colors`}
                  onClick={() => p12Ref.current?.click()}
                >
                  <Paperclip className="w-4 h-4 text-[#9ca3af] flex-shrink-0" />
                  <span className={`text-[13px] ${textMuted}`}>{p12File ? p12File.name : "Choose .p12 file…"}</span>
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
                <label className={`block text-xs font-medium ${textSecondary} mb-1.5`}>Certificate Password</label>
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
                <label className={`block text-xs font-medium ${textSecondary} mb-1.5`}>
                  Provisioning Profile (.mobileprovision)
                </label>
                <div
                  className={`flex items-center gap-3 px-3.5 py-[9px] rounded-xl border ${borderDefault} bg-white dark:bg-[#1c2028] cursor-pointer hover:border-[#D94412] transition-colors`}
                  onClick={() => profileRef.current?.click()}
                >
                  <FileText className="w-4 h-4 text-[#9ca3af] flex-shrink-0" />
                  <span className={`text-[13px] ${textMuted}`}>
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
                <label className={`block text-xs font-medium ${textSecondary} mb-1.5`}>
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
                <button
                  className={btnSecondary}
                  onClick={() => {
                    setShowForm(false);
                    setP12File(null);
                    setProfileFile(null);
                    setPassword("");
                  }}
                >
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
