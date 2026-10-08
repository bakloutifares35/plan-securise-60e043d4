import { useState, type FormEvent } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { supabase } from "@/integrations/resillia/client";
import { useAuth } from "@/contexts/AuthContext";
import { AuthLayout } from "@/components/auth/AuthLayout";
import { AuthLoading } from "@/components/auth/ProtectedRoute";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function Login() {
  const { session, loading, sessionExpired } = useAuth();
  const navigate = useNavigate();
  const [mode, setMode] = useState<"login" | "forgot">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errors, setErrors] = useState<{ email?: string; password?: string; form?: string }>({});
  const [info, setInfo] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (loading) return <AuthLoading />;
  if (session) return <Navigate to="/dashboard" replace />;

  const validateEmail = () => (!EMAIL_RE.test(email.trim()) ? "Adresse e-mail invalide." : undefined);

  const onLogin = async (e: FormEvent) => {
    e.preventDefault();
    setInfo(null);
    const errs = { email: validateEmail(), password: password ? undefined : "Le mot de passe est requis." };
    setErrors(errs);
    if (errs.email || errs.password) return;
    setBusy(true);
    try {
      const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
      if (error) {
        const msg = /invalid login/i.test(error.message)
          ? "E-mail ou mot de passe incorrect."
          : /email not confirmed/i.test(error.message)
          ? "Votre adresse e-mail n’est pas encore confirmée."
          : "Connexion impossible. Réessayez dans un instant.";
        setErrors({ form: msg });
      } else {
        navigate("/dashboard", { replace: true });
      }
    } catch {
      setErrors({ form: "Erreur réseau. Vérifiez votre connexion internet." });
    } finally {
      setBusy(false);
    }
  };

  const onForgot = async (e: FormEvent) => {
    e.preventDefault();
    setInfo(null);
    const emailErr = validateEmail();
    setErrors({ email: emailErr });
    if (emailErr) return;
    setBusy(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
        redirectTo: `${window.location.origin}/reset-password`,
      });
      if (error && !/rate|limit/i.test(error.message)) throw error;
      if (error) setErrors({ form: "Trop de demandes. Réessayez dans quelques minutes." });
      else setInfo("Si un compte correspond à cette adresse, un e-mail de réinitialisation a été envoyé.");
    } catch {
      setErrors({ form: "Impossible d’envoyer l’e-mail pour le moment. Réessayez plus tard." });
    } finally {
      setBusy(false);
    }
  };

  return (
    <AuthLayout>
      <h2 className="font-display text-3xl text-[#172030]">
        {mode === "login" ? "Connexion" : "Mot de passe oublié"}
      </h2>
      <p className="mt-2 text-sm text-[#3B4454]">
        {mode === "login"
          ? "Accédez à votre espace Resillia."
          : "Saisissez votre e-mail pour recevoir un lien de réinitialisation."}
      </p>

      <div aria-live="polite" className="mt-4 space-y-2">
        {sessionExpired && mode === "login" && !errors.form && (
          <p className="rounded-md bg-[#FFF3E0] px-3 py-2 text-sm text-[#172030]">Votre session a expiré. Reconnectez-vous.</p>
        )}
        {errors.form && <p role="alert" className="rounded-md bg-[#FFEBEE] px-3 py-2 text-sm text-destructive">{errors.form}</p>}
        {info && <p className="rounded-md bg-[#E8F5E9] px-3 py-2 text-sm text-[#2A5141]">{info}</p>}
      </div>

      <form onSubmit={mode === "login" ? onLogin : onForgot} noValidate className="mt-4 space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="email">E-mail</Label>
          <Input
            id="email" type="email" autoComplete="email" value={email}
            onChange={(e) => setEmail(e.target.value)}
            aria-invalid={!!errors.email} aria-describedby={errors.email ? "email-error" : undefined}
            className="h-11 bg-white"
          />
          {errors.email && <p id="email-error" className="text-xs text-destructive">{errors.email}</p>}
        </div>

        {mode === "login" && (
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label htmlFor="password">Mot de passe</Label>
              <button type="button" onClick={() => { setMode("forgot"); setErrors({}); setInfo(null); }}
                className="text-xs text-[#2A5141] underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded">
                Mot de passe oublié ?
              </button>
            </div>
            <Input
              id="password" type="password" autoComplete="current-password" value={password}
              onChange={(e) => setPassword(e.target.value)}
              aria-invalid={!!errors.password} aria-describedby={errors.password ? "password-error" : undefined}
              className="h-11 bg-white"
            />
            {errors.password && <p id="password-error" className="text-xs text-destructive">{errors.password}</p>}
          </div>
        )}

        <Button type="submit" disabled={busy} className="h-11 w-full bg-[#2A5141] hover:bg-[#1f3d31] text-white">
          {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden />}
          {mode === "login" ? (busy ? "Connexion en cours…" : "Se connecter") : busy ? "Envoi en cours…" : "Envoyer le lien"}
        </Button>

        {mode === "forgot" && (
          <button type="button" onClick={() => { setMode("login"); setErrors({}); setInfo(null); }}
            className="w-full text-sm text-[#2A5141] hover:underline">
            ← Retour à la connexion
          </button>
        )}
      </form>

      <p className="mt-6 text-center text-sm text-[#3B4454]">
        Pas encore de compte ?<br /><Link to="/signup" className="text-[#2A5141] underline-offset-2 hover:underline">Créer un compte</Link>
      </p>
    </AuthLayout>
  );
}
