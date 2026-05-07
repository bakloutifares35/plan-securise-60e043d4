import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Building2, MapPin, Users, ShieldCheck, GitBranch } from "lucide-react";
import { useGovernance } from "@/contexts/GovernanceContext";
import { cn } from "@/lib/utils";

export const EntityProfile = ({ onBack }: { onBack: () => void }) => {
  const { entities, selectedEntityId, setSelectedEntityId } = useGovernance();
  const entity = entities.find((e) => e.id === selectedEntityId);

  if (!entity) {
    return (
      <div className="space-y-4">
        <Button variant="ghost" onClick={onBack}><ArrowLeft className="h-4 w-4 mr-1" /> Retour</Button>
        <p className="text-muted-foreground">Sélectionnez une entité depuis l'organigramme.</p>
      </div>
    );
  }

  const parent = entities.find((e) => e.id === entity.parentId);
  const children = entities.filter((e) => e.parentId === entity.id);

  const pcaColor: Record<typeof entity.pcaStatus, string> = {
    "Validé": "bg-success text-success-foreground",
    "En cours": "bg-accent text-accent-foreground",
    "À réviser": "bg-warning text-warning-foreground",
    "Non démarré": "bg-muted text-muted-foreground",
  };

  return (
    <div className="space-y-6">
      <Button variant="ghost" onClick={onBack}><ArrowLeft className="h-4 w-4 mr-1" /> Retour à l'organigramme</Button>

      <div className="flex items-start justify-between flex-wrap gap-4">
        <div className="flex items-start gap-4">
          <div className="h-14 w-14 rounded-lg bg-gradient-to-br from-primary to-primary-glow flex items-center justify-center">
            <Building2 className="h-7 w-7 text-primary-foreground" />
          </div>
          <div>
            <h1 className="text-3xl font-bold">{entity.name}</h1>
            <p className="text-muted-foreground mt-1">ID: {entity.id} · {entity.sector}</p>
          </div>
        </div>
        <div className="flex gap-2">
          <Badge className={cn(entity.status === "Actif" ? "bg-success text-success-foreground" : "bg-muted text-muted-foreground")}>{entity.status}</Badge>
          <Badge className={pcaColor[entity.pcaStatus]}>PCA: {entity.pcaStatus}</Badge>
        </div>
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        <Card>
          <CardHeader><CardTitle className="text-lg flex items-center gap-2"><MapPin className="h-4 w-4 text-primary" /> Informations générales</CardTitle></CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="flex justify-between"><span className="text-muted-foreground">Pays</span><span className="font-medium">{entity.country}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Secteur</span><span className="font-medium">{entity.sector}</span></div>
            <div className="flex justify-between items-center">
              <span className="text-muted-foreground">Entité parente</span>
              {parent ? (
                <button onClick={() => setSelectedEntityId(parent.id)} className="font-medium text-primary hover:underline">{parent.name}</button>
              ) : <span className="font-medium">Racine</span>}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-lg flex items-center gap-2"><Users className="h-4 w-4 text-primary" /> Référents PCA</CardTitle></CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="flex justify-between"><span className="text-muted-foreground">Référent principal</span><span className="font-medium">{entity.referent}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Suppléant (backup)</span><span className="font-medium">{entity.referentBackup}</span></div>
          </CardContent>
        </Card>

        <Card className="md:col-span-2">
          <CardHeader><CardTitle className="text-lg flex items-center gap-2"><ShieldCheck className="h-4 w-4 text-primary" /> Statut PCA actuel</CardTitle></CardHeader>
          <CardContent>
            <div className="flex items-center gap-3">
              <Badge className={pcaColor[entity.pcaStatus]}>{entity.pcaStatus}</Badge>
              <CardDescription>Dernière mise à jour automatique selon le cycle de gouvernance.</CardDescription>
            </div>
          </CardContent>
        </Card>

        {children.length > 0 && (
          <Card className="md:col-span-2">
            <CardHeader><CardTitle className="text-lg flex items-center gap-2"><GitBranch className="h-4 w-4 text-primary" /> Sous-entités ({children.length})</CardTitle></CardHeader>
            <CardContent className="space-y-2">
              {children.map((c) => (
                <button key={c.id} onClick={() => setSelectedEntityId(c.id)} className="w-full flex items-center justify-between p-3 rounded-md border border-border hover:bg-secondary transition-colors text-sm">
                  <div className="flex items-center gap-3">
                    <Building2 className="h-4 w-4 text-primary" />
                    <div className="text-left">
                      <p className="font-medium">{c.name}</p>
                      <p className="text-xs text-muted-foreground">{c.country} · {c.sector}</p>
                    </div>
                  </div>
                  <Badge className={pcaColor[c.pcaStatus]}>{c.pcaStatus}</Badge>
                </button>
              ))}
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
};
