import { createContext, useContext, useState, ReactNode } from "react";

export type Role = "admin" | "referent" | "auditor" | "manager";

export const ROLE_LABELS: Record<Role, string> = {
  admin: "Administrateur PCA",
  referent: "Référent PCA d'entité",
  auditor: "Auditeur / Risk Manager",
  manager: "Manager",
};

export const ROLE_DESCRIPTIONS: Record<Role, string> = {
  admin: "Accès complet à toutes les fonctionnalités",
  referent: "Accès limité au périmètre de son entité",
  auditor: "Lecture seule sur l'ensemble du périmètre",
  manager: "Lecture seule",
};

type Permission = "read" | "write" | "admin";

const PERMISSIONS: Record<Role, Permission> = {
  admin: "admin",
  referent: "write",
  auditor: "read",
  manager: "read",
};

type Ctx = {
  role: Role;
  setRole: (r: Role) => void;
  can: (action: "read" | "write" | "admin") => boolean;
};

const RoleContext = createContext<Ctx | null>(null);

export const RoleProvider = ({ children }: { children: ReactNode }) => {
  const [role, setRole] = useState<Role>("admin");
  const can = (action: "read" | "write" | "admin") => {
    const p = PERMISSIONS[role];
    if (action === "read") return true;
    if (action === "write") return p === "write" || p === "admin";
    return p === "admin";
  };
  return <RoleContext.Provider value={{ role, setRole, can }}>{children}</RoleContext.Provider>;
};

export const useRole = () => {
  const ctx = useContext(RoleContext);
  if (!ctx) throw new Error("useRole must be used within RoleProvider");
  return ctx;
};
