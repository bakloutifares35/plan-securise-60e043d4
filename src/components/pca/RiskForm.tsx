import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

type Risk = { id: string; name: string; category: string; probability: number; impact: number };

export const RiskForm = () => {
  const [company, setCompany] = useState({ name: "", sector: "", size: "", contact: "" });
  const [risks, setRisks] = useState<Risk[]>([
    { id: "1", name: "Cyberattaque par ransomware", category: "Cyber", probability: 4, impact: 5 },
  ]);
  const [draft, setDraft] = useState<Omit<Risk, "id">>({ name: "", category: "Cyber", probability: 3, impact: 3 });

  const addRisk = () => {
    if (!draft.name.trim()) {
      toast.error("Veuillez saisir le nom du risque");
      return;
    }
    setRisks((r) => [...r, { ...draft, id: crypto.randomUUID() }]);
    setDraft({ name: "", category: "Cyber", probability: 3, impact: 3 });
    toast.success("Risque ajouté");
  };

  const removeRisk = (id: string) => setRisks((r) => r.filter((x) => x.id !== id));

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!company.name.trim()) {
      toast.error("Le nom de l'entreprise est requis");
      return;
    }
    toast.success("Analyse enregistrée avec succès");
  };

  const scoreColor = (s: number) =>
    s >= 15 ? "destructive" : s >= 10 ? "default" : s >= 5 ? "secondary" : "outline";

  return (
    <form onSubmit={submit} className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-foreground">Identification des risques</h1>
        <p className="text-muted-foreground mt-1">Renseignez les informations de votre entreprise et identifiez les risques</p>
      </div>

      <Card className="shadow-[var(--shadow-card)]">
        <CardHeader>
          <CardTitle>Informations de l'entreprise</CardTitle>
          <CardDescription>Données utilisées pour calibrer votre PCA</CardDescription>
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="name">Nom de l'entreprise</Label>
            <Input id="name" maxLength={100} value={company.name} onChange={(e) => setCompany({ ...company, name: e.target.value })} placeholder="Ex. Acme SAS" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="sector">Secteur d'activité</Label>
            <Select value={company.sector} onValueChange={(v) => setCompany({ ...company, sector: v })}>
              <SelectTrigger id="sector"><SelectValue placeholder="Sélectionner" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="finance">Finance & Banque</SelectItem>
                <SelectItem value="industrie">Industrie</SelectItem>
                <SelectItem value="sante">Santé</SelectItem>
                <SelectItem value="tech">Technologie</SelectItem>
                <SelectItem value="services">Services</SelectItem>
                <SelectItem value="retail">Distribution</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="size">Effectif</Label>
            <Select value={company.size} onValueChange={(v) => setCompany({ ...company, size: v })}>
              <SelectTrigger id="size"><SelectValue placeholder="Sélectionner" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="tpe">TPE (&lt; 10)</SelectItem>
                <SelectItem value="pme">PME (10-249)</SelectItem>
                <SelectItem value="eti">ETI (250-4999)</SelectItem>
                <SelectItem value="ge">Grande entreprise (5000+)</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="contact">Responsable PCA</Label>
            <Input id="contact" maxLength={100} value={company.contact} onChange={(e) => setCompany({ ...company, contact: e.target.value })} placeholder="Nom et fonction" />
          </div>
        </CardContent>
      </Card>

      <Card className="shadow-[var(--shadow-card)]">
        <CardHeader>
          <CardTitle>Ajouter un risque</CardTitle>
          <CardDescription>Probabilité et impact notés de 1 (faible) à 5 (très élevé)</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
            <div className="md:col-span-5 space-y-2">
              <Label>Description du risque</Label>
              <Textarea maxLength={300} rows={2} value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} placeholder="Ex. Indisponibilité du datacenter principal" />
            </div>
            <div className="md:col-span-3 space-y-2">
              <Label>Catégorie</Label>
              <Select value={draft.category} onValueChange={(v) => setDraft({ ...draft, category: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Cyber">Cyber</SelectItem>
                  <SelectItem value="IT">IT / Infrastructure</SelectItem>
                  <SelectItem value="Humain">Humain</SelectItem>
                  <SelectItem value="Naturel">Naturel</SelectItem>
                  <SelectItem value="Fournisseur">Fournisseur</SelectItem>
                  <SelectItem value="Réglementaire">Réglementaire</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="md:col-span-2 space-y-2">
              <Label>Probabilité</Label>
              <Select value={String(draft.probability)} onValueChange={(v) => setDraft({ ...draft, probability: Number(v) })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{[1, 2, 3, 4, 5].map((n) => <SelectItem key={n} value={String(n)}>{n}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="md:col-span-2 space-y-2">
              <Label>Impact</Label>
              <Select value={String(draft.impact)} onValueChange={(v) => setDraft({ ...draft, impact: Number(v) })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{[1, 2, 3, 4, 5].map((n) => <SelectItem key={n} value={String(n)}>{n}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </div>
          <Button type="button" onClick={addRisk} variant="secondary" className="gap-2">
            <Plus className="h-4 w-4" /> Ajouter le risque
          </Button>
        </CardContent>
      </Card>

      <Card className="shadow-[var(--shadow-card)]">
        <CardHeader>
          <CardTitle>Risques identifiés ({risks.length})</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {risks.length === 0 && <p className="text-sm text-muted-foreground">Aucun risque ajouté pour l'instant.</p>}
          {risks.map((r) => {
            const score = r.probability * r.impact;
            return (
              <div key={r.id} className="flex items-center justify-between gap-4 p-4 rounded-lg border border-border bg-card">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-medium text-foreground truncate">{r.name}</p>
                    <Badge variant="outline">{r.category}</Badge>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">P: {r.probability} · I: {r.impact}</p>
                </div>
                <Badge variant={scoreColor(score) as any}>Score {score}</Badge>
                <Button type="button" variant="ghost" size="icon" onClick={() => removeRisk(r.id)}>
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              </div>
            );
          })}
        </CardContent>
      </Card>

      <div className="flex justify-end gap-3">
        <Button type="button" variant="outline">Annuler</Button>
        <Button type="submit">Enregistrer l'analyse</Button>
      </div>
    </form>
  );
};
