import { createContext, useContext } from "react";
import type { AuthUser, TeamRole } from "../types";

export interface Permissions {
  role: TeamRole | null;
  isViewer: boolean;
  canWrite: boolean;
  canManageTeam: boolean;
}

export function getPermissions(user: AuthUser | null): Permissions {
  const role = user?.teamRole ?? null;
  const isAdmin = user?.role === "ADMIN";
  const isViewer = role === "VIEWER" && !isAdmin;
  const canWrite = isAdmin || (role !== null && role !== "VIEWER");
  const canManageTeam = isAdmin || role === "OWNER" || role === "ADMIN";
  return { role, isViewer, canWrite, canManageTeam };
}

const PermissionsContext = createContext<Permissions>({
  role: null,
  isViewer: false,
  canWrite: true,
  canManageTeam: false,
});

export const PermissionsProvider = PermissionsContext.Provider;

export function usePermissions(): Permissions {
  return useContext(PermissionsContext);
}
