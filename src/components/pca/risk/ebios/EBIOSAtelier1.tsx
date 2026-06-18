import { useState } from "react";
import { useEbios, uid } from "@/contexts/EbiosContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Plus, Trash2, Users } from "lucide-react";

const Severity = ({ value, onChange }: { value: number; onChange: (v: number) => void }) => (
  <div className="flex gap-1">
    {[1, 2, 3, 4, 5].map((n) => (
      <button
        key={n}
        type="button"
        onClick={() => onChange(n)}
        className={`h-7 w-7 rounded text-xs font-medium border transition ${
          value >= n ? "bg-primary text-primary-foreground border-primary" : "bg-background border-border hover:border-primary"
        }`}
      >
        {n}
      </button>
    ))}
  </div>
);

export const EBIOSAtelier1 = () => {
  const { state, update } = useEbios();
  const a = state.atelier1;

  const [vm, setVm] = useState({ nom: "", description: "", impact: 3 });
  const [bs, setBs] = useState({ nom: "", type: "", proprietaire: "" });
  const [er, setEr] = useState({ nom: "", severite: 3 });

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Atelier 1 — Cadrage et Socle de sécurité</CardTitle>
          <CardDescription>
            Définir le périmètre, identifier les valeurs métier, les biens supports et le socle de sécurité existant.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Users className="h-4 w-4" />
            Participants attendus :
            {a.participants.map((p) => (
              <Badge key={p} variant="secondary">{p}</Badge>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Valeurs métier</CardTitle>
          <CardDescription>Processus, informations ou services indispensables à l'organisation.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid md:grid-cols-4 gap-3">
            <div className="md:col-span-1">
              <Label>Nom</Label>
              <Input value={vm.nom} onChange={(e) => setVm({ ...vm, nom: e.target.value })} />
            </div>
            <div className="md:col-span-2">
              <Label>Description</Label>
              <Input value={vm.description} onChange={(e) => setVm({ ...vm, description: e.target.value })} />
            </div>
            <div>
              <Label>Impact (1-5)</Label>
              <Severity value={vm.impact} onChange={(v) => setVm({ ...vm, impact: v })} />
            </div>
          </div>
          <Button
            size="sm"
            disabled={!vm.nom}
            onClick={() => {
              update("atelier1", { ...a, valeursMetier: [...a.valeursMetier, { id: uid(), ...vm }] });
              setVm({ nom: "", description: "", impact: 3 });
            }}
          >
            <Plus className="h-4 w-4 mr-1" /> Ajouter
          </Button>
          <div className="space-y-2">
            {a.valeursMetier.map((v) => (
              <div key={v.id} className="flex items-center justify-between p-3 rounded-md border">
                <div>
                  <div className="font-medium">{v.nom}</div>
                  <div className="text-sm text-muted-foreground">{v.description}</div>
                </div>
                <div className="flex items-center gap-3">
                  <Badge>Impact {v.impact}</Badge>
                  <Button variant="ghost" size="icon" onClick={() => update("atelier1", { ...a, valeursMetier: a.valeursMetier.filter((x) => x.id !== v.id) })}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Biens supports</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid md:grid-cols-3 gap-3">
            <Input placeholder="Nom" value={bs.nom} onChange={(e) => setBs({ ...bs, nom: e.target.value })} />
            <Input placeholder="Type (SI, humain, physique...)" value={bs.type} onChange={(e) => setBs({ ...bs, type: e.target.value })} />
            <Input placeholder="Propriétaire" value={bs.proprietaire} onChange={(e) => setBs({ ...bs, proprietaire: e.target.value })} />
          </div>
          <Button size="sm" disabled={!bs.nom} onClick={() => {
            update("atelier1", { ...a, biensSupports: [...a.biensSupports, { id: uid(), ...bs }] });
            setBs({ nom: "", type: "", proprietaire: "" });
          }}>
            <Plus className="h-4 w-4 mr-1" /> Ajouter
          </Button>
          <div className="space-y-2">
            {a.biensSupports.map((b) => (
              <div key={b.id} className="flex items-center justify-between p-3 rounded-md border">
                <div>
                  <div className="font-medium">{b.nom} <span className="text-xs text-muted-foreground">· {b.type}</span></div>
                  <div className="text-sm text-muted-foreground">Propriétaire : {b.proprietaire}</div>
                </div>
                <Button variant="ghost" size="icon" onClick={() => update("atelier1", { ...a, biensSupports: a.biensSupports.filter((x) => x.id !== b.id) })}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Événements redoutés</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid md:grid-cols-3 gap-3 items-end">
            <div className="md:col-span-2">
              <Label>Nom</Label>
              <Input value={er.nom} onChange={(e) => setEr({ ...er, nom: e.target.value })} />
            </div>
            <div>
              <Label>Sévérité (1-5)</Label>
              <Severity value={er.severite} onChange={(v) => setEr({ ...er, severite: v })} />
            </div>
          </div>
          <Button size="sm" disabled={!er.nom} onClick={() => {
            update("atelier1", { ...a, evenementsRedoutes: [...a.evenementsRedoutes, { id: uid(), ...er }] });
            setEr({ nom: "", severite: 3 });
          }}>
            <Plus className="h-4 w-4 mr-1" /> Ajouter
          </Button>
          <div className="space-y-2">
            {a.evenementsRedoutes.map((e) => (
              <div key={e.id} className="flex items-center justify-between p-3 rounded-md border">
                <div className="font-medium">{e.nom}</div>
                <div className="flex items-center gap-2">
                  <Badge variant="destructive">Sévérité {e.severite}</Badge>
                  <Button variant="ghost" size="icon" onClick={() => update("atelier1", { ...a, evenementsRedoutes: a.evenementsRedoutes.filter((x) => x.id !== e.id) })}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Socle de sécurité</CardTitle>
          <CardDescription>Mesures déjà en place dans l'organisation.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          {a.socle.map((m) => (
            <label key={m.id} className="flex items-center gap-3 p-3 rounded-md border cursor-pointer hover:bg-accent/30">
              <Checkbox
                checked={m.applique}
                onCheckedChange={(v) => update("atelier1", { ...a, socle: a.socle.map((x) => x.id === m.id ? { ...x, applique: !!v } : x) })}
              />
              <span className="flex-1">{m.libelle}</span>
            </label>
          ))}
        </CardContent>
      </Card>
    </div>
  );
};
