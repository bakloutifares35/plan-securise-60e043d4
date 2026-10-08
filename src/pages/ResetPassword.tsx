import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { supabase } from "@/integrations/resillia/client";
import { useAuth } from "@/contexts/AuthContext";
import { AuthLayout } from "@/components/auth/AuthLayout";
import { AuthLoading } from "@/components/auth/ProtectedRoute";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";

// Page publique : le lien de récupération Supabase ouvre une session temporaire de type "recovery".
export default function ResetPassword() {
  const { session, loading } = useAuth();
  const navigate = useNavigate();
  const [pwd, setPwd] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);

  if (loading) return <AuthLoading />;

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (pwd.length < 8) return setError("Le mot de passe doit contenir au moins 8 caractères.");
    if (pwd !== confirm) return setError("Les mots de passe ne correspondent pas.");
    setError(null);
    setBusy(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: pwd });
      if (error) throw error;
      setDone(true);
      setTimeout(() => navigate("/dashboard", { replace: true }), 1500);
    } catch {
      setError("La réinitialisation a échoué. Le lien a peut-être expiré : refaites une demande.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <AuthLayout>
      <h2 className="font-display text-3xl text-[#172030]">Nouveau mot de passe</h2>
      <div aria-live="polite" className="mt-4 space-y-2">
        {!session && !done && (
          <p role="alert" className="rounded-md bg-[#FFEBEE] px-3 py-2 text-sm text-destructive">
            Lien invalide ou expiré. Demandez un nouveau lien depuis la page de connexion.
          </p>
        )}
        {error && <p role="alert" className="rounded-md bg-[#FFEBEE] px-3 py-2 text-sm text-destructive">{error}</p>}
        {done && <p className="rounded-md bg-[#E8F5E9] px-3 py-2 text-sm text-[#2A5141]">Mot de passe modifié avec succès. Redirection…</p>}
      </div>
      {session && !done && (
        <form onSubmit={onSubmit} noValidate className="mt-4 space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="new-password">Nouveau mot de passe</Label>
            <Input id="new-password" type="password" autoComplete="new-password" value={pwd}
              onChange={(e) => setPwd(e.target.value)} className="h-11 bg-white" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="confirm-password">Confirmer le mot de passe</Label>
            <Input id="confirm-password" type="password" autoComplete="new-password" value={confirm}
              onChange={(e) => setConfirm(e.target.value)} className="h-11 bg-white"
              aria-invalid={!!confirm && confirm !== pwd} />
            {confirm && confirm === pwd && <p className="text-xs text-[#2A5141]">Les mots de passe correspondent.</p>}
          </div>
          <Button type="submit" disabled={busy} className="h-11 w-full bg-[#2A5141] hover:bg-[#1f3d31] text-white">
            {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden />}
            Enregistrer le mot de passe
          </Button>
        </form>
      )}
      <button type="button" onClick={() => navigate("/login")} className="mt-4 w-full text-sm text-[#2A5141] hover:underline">
        ← Retour à la connexion
      </button>
    </AuthLayout>
  );
}
