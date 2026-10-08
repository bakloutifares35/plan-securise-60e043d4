import { useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { supabase } from "@/integrations/resillia/client";
import { AuthLayout } from "@/components/auth/AuthLayout";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function Signup() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [busy, setBusy] = useState(false);

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);

    const normalizedEmail = email.trim();
    if (!normalizedEmail || !password || !confirmPassword) {
      setError("Tous les champs sont requis.");
      return;
    }
    if (!EMAIL_RE.test(normalizedEmail)) {
      setError("Adresse e-mail invalide.");
      return;
    }
    if (password !== confirmPassword) {
      setError("Les mots de passe ne correspondent pas.");
      return;
    }

    setBusy(true);
    try {
      const { error: signupError } = await supabase.auth.signUp({
        email: normalizedEmail,
        password,
        options: {
          emailRedirectTo: `${window.location.origin}/login`,
        },
      });
      if (signupError) {
        setError("La création du compte a échoué. Vérifiez les informations saisies et réessayez.");
        return;
      }
      setSuccess(true);
    } catch {
      setError("Impossible de créer le compte pour le moment. Vérifiez votre connexion et réessayez.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <AuthLayout>
      <h2 className="font-display text-3xl text-[#172030]">Créer un compte</h2>
      <p className="mt-2 text-sm text-[#3B4454]">Inscrivez-vous à Resillia.</p>

      <div aria-live="polite" className="mt-4 space-y-2">
        {error && <p role="alert" className="rounded-md bg-[#FFEBEE] px-3 py-2 text-sm text-destructive">{error}</p>}
        {success && (
          <p role="status" className="rounded-md bg-[#E8F5E9] px-3 py-2 text-sm text-[#2A5141]">
            Votre compte a été créé. Vérifiez votre adresse e-mail. Votre accès devra être activé par l’administrateur.
          </p>
        )}
      </div>

      {!success && (
        <form onSubmit={onSubmit} noValidate className="mt-4 space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="signup-email">E-mail</Label>
            <Input id="signup-email" type="email" autoComplete="email" value={email}
              onChange={(event) => setEmail(event.target.value)} className="h-11 bg-white" />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="signup-password">Mot de passe</Label>
            <Input id="signup-password" type="password" autoComplete="new-password" value={password}
              onChange={(event) => setPassword(event.target.value)} className="h-11 bg-white" />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="signup-confirm-password">Confirmer le mot de passe</Label>
            <Input id="signup-confirm-password" type="password" autoComplete="new-password" value={confirmPassword}
              onChange={(event) => setConfirmPassword(event.target.value)} className="h-11 bg-white" />
          </div>

          <Button type="submit" disabled={busy} className="h-11 w-full bg-[#2A5141] hover:bg-[#1f3d31] text-white">
            {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden />}
            {busy ? "Création en cours…" : "Créer mon compte"}
          </Button>
        </form>
      )}

      <Link to="/login" className="mt-4 block w-full text-center text-sm text-[#2A5141] hover:underline">
        Retour à la connexion
      </Link>
    </AuthLayout>
  );
}
