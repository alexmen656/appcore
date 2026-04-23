import { useState, useEffect } from "react";
import { authHeaders } from "../../hooks/useApi";
import SectionCard from "./SectionCard";
import { btnPrimary, btnSecondary, inputCls } from "../../styles";
import { X } from "lucide-react";

interface EnvVar {
  key: string;
  value: string;
}

interface Props {
  appId: string;
  addToast: (msg: string, type: "success" | "error" | "info") => void;
}

export default function SnapshotEnvSection({ appId, addToast }: Props) {
  const [envVars, setEnvVars] = useState<EnvVar[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);

  const fetchEnvVars = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/github/snapshot-env/${appId}`, {
        headers: authHeaders(),
      });
      if (res.ok) {
        const data = await res.json();
        setEnvVars(data.envVars ?? []);
      }
    } finally {
      setLoading(false);
      setDirty(false);
    }
  };

  useEffect(() => {
    fetchEnvVars();
  }, [appId]);

  const update = (index: number, field: "key" | "value", val: string) => {
    setEnvVars((prev) =>
      prev.map((e, i) => (i === index ? { ...e, [field]: val } : e)),
    );
    setDirty(true);
  };

  const addRow = () => {
    setEnvVars((prev) => [...prev, { key: "", value: "" }]);
    setDirty(true);
  };

  const removeRow = (index: number) => {
    setEnvVars((prev) => prev.filter((_, i) => i !== index));
    setDirty(true);
  };

  const handleSave = async () => {
    const valid = envVars.filter((e) => e.key.trim());
    setSaving(true);
    try {
      const res = await fetch(`/api/github/snapshot-env/${appId}`, {
        method: "PUT",
        headers: { ...authHeaders(), "Content-Type": "application/json" },
        body: JSON.stringify({ envVars: valid }),
      });
      if (!res.ok)
        throw new Error((await res.json()).error ?? "Failed to save");
      setEnvVars(valid);
      setDirty(false);
      addToast("Environment variables saved", "success");
    } catch (err: any) {
      addToast(err.message, "error");
    } finally {
      setSaving(false);
    }
  };

  if (loading) return null;

  return (
    <SectionCard
      title="UI Test Environment"
      desc="Environment variables passed to xcodebuild during fastlane snapshot - use these to inject login credentials or other secrets needed by your UI tests."
    >
      <div className="flex flex-col gap-2">
        {envVars.length === 0 && !dirty && (
          <p className="text-sm text-[#6b7280] dark:text-[#8b93a5] mb-2">
            No variables configured. Add key-value pairs for credentials your UI
            tests need.
          </p>
        )}

        {envVars.map((e, i) => (
          <div key={i} className="flex items-center gap-2">
            <input
              type="text"
              className={`${inputCls} flex-1 font-mono text-[13px]`}
              placeholder="KEY"
              value={e.key}
              onChange={(ev) => update(i, "key", ev.target.value)}
              spellCheck={false}
            />
            <input
              type="password"
              className={`${inputCls} flex-1 font-mono text-[13px]`}
              placeholder="value"
              value={e.value}
              onChange={(ev) => update(i, "value", ev.target.value)}
            />
            <button
              onClick={() => removeRow(i)}
              className="p-1.5 rounded-lg text-[#9ca3af] hover:text-[#ef4444] hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors flex-shrink-0"
              title="Remove"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        ))}

        <div className="flex items-center gap-2 pt-1">
          <button className={btnSecondary} onClick={addRow}>
            + Add Variable
          </button>
          {dirty && (
            <button
              className={btnPrimary}
              onClick={handleSave}
              disabled={saving}
            >
              {saving ? "Saving…" : "Save"}
            </button>
          )}
        </div>
      </div>
    </SectionCard>
  );
}
