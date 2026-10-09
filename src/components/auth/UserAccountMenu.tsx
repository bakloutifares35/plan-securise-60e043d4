import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ChevronDown, LogOut, ShieldCheck, UserRound } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { ROLE_LABELS, useRole } from "@/contexts/RoleContext";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";

function initials(email?: string) {
  if (!email) return "R";
  const name = email.split("@")[0].split(/[._-]+/).filter(Boolean);
  return name.slice(0, 2).map((part) => part[0]?.toUpperCase()).join("") || "R";
}

export function UserAccountMenu({ compact = false, sidebar = false }: { compact?: boolean; sidebar?: boolean }) {
  const { user, signOut } = useAuth();
  const { role, activeOrganizationName, memberships } = useRole();
  const navigate = useNavigate();
  const [profileOpen, setProfileOpen] = useState(false);
  const email = user?.email ?? "Compte Resillia";

  const handleSignOut = async () => {
    await signOut();
    navigate("/login", { replace: true });
  };

  return <>
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" aria-label={"Menu du compte " + email} className={sidebar
          ? "h-14 w-full min-w-0 justify-start gap-2 rounded-lg px-2 text-left text-[#F8F6F2] hover:bg-white/10 focus-visible:ring-2 focus-visible:ring-[#8FBFA8]"
          : compact
          ? "h-10 w-[3.25rem] gap-1 rounded-lg px-1 text-[#172030] hover:bg-[#172030]/[.06]"
          : "h-11 max-w-[18rem] min-w-0 gap-3 rounded-xl px-2.5 py-1.5 text-left text-[#172030] hover:bg-white/80"}>
          <span className={`grid shrink-0 place-items-center rounded-full border font-semibold ${sidebar ? "border-white/20 bg-white/10 text-[#A7E8C7]" : "border-[#2A5141]/20 bg-[#2A5141]/10 text-[#2A5141]"} ${compact ? "h-8 w-8 text-[10px]" : "h-9 w-9 text-xs"}`}>{initials(user?.email)}</span>
          {!compact && <span className={`min-w-0 flex-col items-start ${sidebar ? "flex flex-1" : "hidden sm:flex"}`}>
            <span className={`truncate text-xs font-semibold ${sidebar ? "max-w-[9.5rem]" : "max-w-48"}`}>{email}</span>
            <span className={`mt-0.5 truncate text-[10px] ${sidebar ? "max-w-[9.5rem] text-white/60" : "text-[#3B4454]/70"}`}>{role ? ROLE_LABELS[role] : "Compte"}</span>
          </span>}
          <ChevronDown className={`shrink-0 ${sidebar ? "text-white/65" : "text-[#3B4454]/65"} ${compact ? "h-3 w-3" : "h-3.5 w-3.5"}`} aria-hidden />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" side="bottom" sideOffset={8} collisionPadding={12} className="z-[60] w-64 max-w-[calc(100vw-1.5rem)] rounded-xl border-[#172030]/10 p-1.5 shadow-xl">
        <DropdownMenuLabel className="px-3 py-2">
          <span className="block truncate text-sm font-semibold text-[#172030]">{email}</span>
          <span className="mt-1 block text-xs font-normal text-[#3B4454]/70">{role ? ROLE_LABELS[role] : "Compte Resillia"}</span>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={() => setProfileOpen(true)} className="min-h-10 gap-2 rounded-lg focus:bg-[#2A5141]/10 focus:text-[#172030]"><UserRound className="h-4 w-4 text-[#2A5141]" />Mon profil</DropdownMenuItem>
        <DropdownMenuItem asChild className="min-h-10 gap-2 rounded-lg focus:bg-[#2A5141]/10 focus:text-[#172030]"><Link to="/onboarding"><ShieldCheck className="h-4 w-4 text-[#2A5141]" />Revoir l’onboarding</Link></DropdownMenuItem>
        {role === "admin_pca" && <DropdownMenuItem asChild className="min-h-10 gap-2 rounded-lg focus:bg-[#2A5141]/10 focus:text-[#172030]"><Link to="/admin/users"><UserRound className="h-4 w-4 text-[#2A5141]" />Utilisateurs et rôles</Link></DropdownMenuItem>}
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={() => void handleSignOut()} className="min-h-10 gap-2 rounded-lg text-[#8b3838] focus:bg-red-50 focus:text-[#8b3838]"><LogOut className="h-4 w-4" />Se déconnecter</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>

    <Dialog open={profileOpen} onOpenChange={setProfileOpen}>
      <DialogContent className="max-w-md rounded-2xl border-[#172030]/10">
        <DialogHeader>
          <DialogTitle className="font-display text-2xl text-[#172030]">Mon profil</DialogTitle>
          <DialogDescription>Informations associées à votre session Resillia.</DialogDescription>
        </DialogHeader>
        <dl className="space-y-4 rounded-xl bg-[#F8F6F2] p-4 text-sm">
          <div><dt className="text-xs font-medium uppercase tracking-wide text-[#3B4454]/65">Adresse e-mail</dt><dd className="mt-1 break-all font-medium text-[#172030]">{email}</dd></div>
          <div><dt className="text-xs font-medium uppercase tracking-wide text-[#3B4454]/65">Rôle actif</dt><dd className="mt-1 font-medium text-[#172030]">{role ? ROLE_LABELS[role] : "Aucun rôle actif"}</dd></div>
          <div><dt className="text-xs font-medium uppercase tracking-wide text-[#3B4454]/65">Organisation sélectionnée</dt><dd className="mt-1 font-medium text-[#172030]">{activeOrganizationName ?? (role === "admin_pca" ? "Accès administrateur global" : "Aucune organisation assignée — isolation prévue en phase B")}</dd></div>
          {memberships.length > 1 && <div><dt className="text-xs font-medium uppercase tracking-wide text-[#3B4454]/65">Memberships actives</dt><dd className="mt-1 space-y-1 text-[#172030]">{memberships.map((membership) => <span key={membership.id} className="block">{membership.organization_name ?? "Aucune organisation assignée"} · {ROLE_LABELS[membership.role]}</span>)}</dd></div>}
        </dl>
      </DialogContent>
    </Dialog>
  </>;
}
