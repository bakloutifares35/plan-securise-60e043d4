import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Lock, Save, AlertTriangle, CheckCircle2 } from "lucide-react";
import { useRisk } from "@/contexts/RiskContext";
import { useRole } from "@/contexts/RoleContext";
import { toast } from "@/hooks/use-toast";

export const RiskSettings = () => {
  const { appetite, setAppetite } = useRisk();
  const { role } = useRole();
  const isAdmin = role === "admin";

  const [draft, setDraft] = useState(appetite);

  const last = new Date(appetite.lastReview).getTime();
  const months = (Date.now() - last) / (1000 * 60 * 60 * 24 * 30);
  const stale = months > 6;

  const save = () => {
    setAppetite({ ...draft, lastReview: new Date().toISOString().slice(0, 10) });
    toast({ title: "Paramètres mis à jour", description: "Seuils d'appétence enregistrés." });
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl md:text-3xl font-bold text-foreground">Paramètres</h1>
        <p className="text-muted-foreground mt-1">Appétence aux risques et revue semestrielle.</p>
      </div>

      {!isAdmin && (
        <div className="flex items-start gap-3 rounded-lg border border-border bg-secondary/50 p-4 text-sm">
          <Lock className="h-5 w-5 text-muted-foreground mt-0.5" />
          <p className="text-muted-foreground">Les seuils d'appétence ne sont modifiables que par l'Administrateur PCA. Vous consultez ces paramètres en lecture seule.</p>
        </div>
      )}

      {stale ? (
        <div className="flex items-start gap-3 rounded-lg border border-warning/40 bg-warning/10 p-4 text-sm">
          <AlertTriangle className="h-5 w-5 text-warning mt-0.5" />
          <div>
            <p className="font-medium text-foreground">Revue semestrielle requise</p>
            <p className="text-muted-foreground">Dernière révision : {new Date(appetite.lastReview).toLocaleDateString("fr-FR")} ({Math.floor(months)} mois). Une mise à jour est attendue.</p>
          </div>
        </div>
      ) : (
        <div className="flex items-start gap-3 rounded-lg border border-success/40 bg-success/10 p-4 text-sm">
          <CheckCircle2 className="h-5 w-5 text-success mt-0.5" />
          <p className="text-muted-foreground">Dernière révision : {new Date(appetite.lastReview).toLocaleDateString("fr-FR")} — à jour.</p>
        </div>
      )}

      <Card>
        <CardHeader><CardTitle className="text-base">Seuils d'appétence aux risques</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-3">
            <div className="space-y-2">
              <Label>Seuil acceptable (score ≤)</Label>
              <Input type="number" min={1} max={25} value={draft.acceptable} disabled={!isAdmin}
                onChange={(e) => setDraft({ ...draft, acceptable: Number(e.target.value) })} />
              <p className="text-xs text-muted-foreground">Risques considérés acceptables sans action.</p>
            </div>
            <div className="space-y-2">
              <Label>Seuil tolérable (score ≤)</Label>
              <Input type="number" min={1} max={25} value={draft.tolerable} disabled={!isAdmin}
                onChange={(e) => setDraft({ ...draft, tolerable: Number(e.target.value) })} />
              <p className="text-xs text-muted-foreground">Surveillance et plan de réduction requis.</p>
            </div>
            <div className="space-y-2">
              <Label>Seuil inacceptable (score ≥)</Label>
              <Input type="number" min={1} max={25} value={draft.unacceptable} disabled={!isAdmin}
                onChange={(e) => setDraft({ ...draft, unacceptable: Number(e.target.value) })} />
              <p className="text-xs text-muted-foreground">Traitement immédiat et PCA obligatoire.</p>
            </div>
          </div>
          <div className="flex justify-end pt-2">
            <Button onClick={save} disabled={!isAdmin}>
              <Save className="h-4 w-4 mr-1" /> Enregistrer la révision
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Visualisation des seuils</CardTitle></CardHeader>
        <CardContent>
          <div className="flex h-10 rounded-md overflow-hidden">
            <div className="bg-success/70 flex items-center justify-center text-xs font-medium text-success-foreground" style={{ flexBasis: `${(draft.acceptable / 25) * 100}%` }}>
              Acceptable
            </div>
            <div className="bg-warning/70 flex items-center justify-center text-xs font-medium text-warning-foreground" style={{ flexBasis: `${((draft.tolerable - draft.acceptable) / 25) * 100}%` }}>
              Tolérable
            </div>
            <div className="bg-destructive/80 flex items-center justify-center text-xs font-medium text-destructive-foreground flex-1">
              Inacceptable
            </div>
          </div>
          <div className="flex justify-between text-xs text-muted-foreground mt-2">
            <span>0</span><span>{draft.acceptable}</span><span>{draft.tolerable}</span><span>25</span>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
