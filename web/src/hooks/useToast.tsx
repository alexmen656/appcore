import { useState, useCallback } from "react";

interface Toast {
  id: number;
  message: string;
  type: "success" | "error" | "info";
}

let nextId = 0;

export function useToast() {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const addToast = useCallback(
    (message: string, type: "success" | "error" | "info" = "info") => {
      const id = nextId++;
      setToasts((t) => [...t, { id, message, type }]);
      setTimeout(() => {
        setToasts((t) => t.filter((x) => x.id !== id));
      }, 3500);
    },
    []
  );

  return { toasts, addToast };
}

const toastCls: Record<Toast["type"], string> = {
  success: "bg-emerald-500 text-white",
  error:   "bg-red-500 text-white",
  info:    "bg-blue-500 text-white",
};

export function ToastContainer({ toasts }: { toasts: Toast[] }) {
  if (toasts.length === 0) return null;
  return (
    <div className="fixed top-5 right-5 z-50 flex flex-col gap-2">
      {toasts.map((t) => (
        <div key={t.id} className={`px-4 py-3 rounded-lg text-sm font-medium shadow-lg slide-in ${toastCls[t.type]}`}>
          {t.message}
        </div>
      ))}
    </div>
  );
}
