import { useRole, ROLE_LABELS, ROLE_DESCRIPTIONS, type Role } from "@/contexts/RoleContext";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { UserCog } from "lucide-react";

export const RoleSwitcher = () => {
  const { role, setRole } = useRole();
  return (
    <div className="px-3 py-3 border-t border-border">
      <div className="flex items-center gap-2 mb-2 text-xs text-muted-foreground">
        <UserCog className="h-3.5 w-3.5" />
        <span>Rôle actif</span>
      </div>
      <Select value={role} onValueChange={(v) => setRole(v as Role)}>
        <SelectTrigger className="h-9 text-sm">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {(Object.keys(ROLE_LABELS) as Role[]).map((r) => (
            <SelectItem key={r} value={r}>
              <div className="flex flex-col">
                <span className="font-medium">{ROLE_LABELS[r]}</span>
                <span className="text-xs text-muted-foreground">{ROLE_DESCRIPTIONS[r]}</span>
              </div>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
};
