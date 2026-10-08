import { useRole, ROLE_LABELS } from "@/contexts/RoleContext";

export const RoleSwitcher = () => {
  const { role } = useRole();
  if (!role) return null;
  return <div className="px-3 py-3 border-t border-border text-xs text-muted-foreground">{ROLE_LABELS[role]}</div>;
};
