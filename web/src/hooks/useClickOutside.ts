import { useEffect, RefObject } from "react";

/**
 * Calls `onClose` when a click occurs outside the referenced element.
 * Replaces the duplicated useEffect pattern in AppSwitcher / ProfileMenu.
 */
export function useClickOutside(
  ref: RefObject<HTMLElement | null>,
  onClose: () => void,
) {
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [ref, onClose]);
}
