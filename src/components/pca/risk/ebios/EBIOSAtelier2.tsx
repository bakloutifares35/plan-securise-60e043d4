import { useState } from "react";
import { useEbios, uid } from "@/contexts/EbiosContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Plus, Trash2 } from "lucide-react";

const Level = ({ value, onChange }: { value: number; onChange: (v: number) => void }) => (
  <div className="flex gap-1">
    {[1, 2, 3, 4, 5].map((n) => (
      <button key={n} type="button" onClick={() => onChange(n)}
        className={`h-7 w-7 rounded text-xs font-medium border ${value >= n ? "bg-primary text-primary-foreground border-primary" : "bg-background border-border"}`}>
        {n}
      </button>
    ))}
  </div>
);

export const EBIOSAtelier2 = () => {
  const { state, update } = useEbios();
  const a = state.atelier2;
  const [sr, setSr] = useState({ nom: "", motivation: "", capacite: 3 });
  const [ov, setOv] = useState({ nom: "", description: "" });
  const [cp, setCp] = useState({ sourceId: "", objectifId: "", pertinence: 3 });

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Atelier 2 — Sources de risque</CardTitle>
          <CardDescription>Identifier qui pourrait porter atteinte à l'organisation et leurs objectifs.</CardDescription>
        </CardHeader>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Sources de risque (SR)</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="grid md:grid-cols-4 gap-3 items-end">
            <Input placeholder="Nom (ex: cybercriminel)" value={sr.nom} onChange={(e) => setSr({ ...sr, nom: e.target.value })} />
            <Input placeholder="Motivation" value={sr.motivation} onChange={(e) => setSr({ ...sr, motivation: e.target.value })} className="md:col-span-2" />
            <div><Label className="text-xs">Capacité</Label><Level value={sr.capacite} onChange={(v) => setSr({ ...sr, capacite: v })} /></div>
          </div>
          <Button size="sm" disabled={!sr.nom} onClick={() => {
            update("atelier2", { ...a, sources: [...a.sources, { id: uid(), ...sr }] });
            setSr({ nom: "", motivation: "", capacite: 3 });
          }}><Plus className="h-4 w-4 mr-1" />Ajouter</Button>
          <div className="space-y-2">
            {a.sources.map((s) => (
              <div key={s.id} className="flex items-center justify-between p-3 rounded-md border">
                <div><div className="font-medium">{s.nom}</div><div className="text-sm text-muted-foreground">{s.motivation}</div></div>
                <div className="flex items-center gap-2"><Badge>Capacité {s.capacite}</Badge>
                  <Button variant="ghost" size="icon" onClick={() => update("atelier2", { ...a, sources: a.sources.filter((x) => x.id !== s.id) })}><Trash2 className="h-4 w-4" /></Button>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Objectifs visés (OV)</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="grid md:grid-cols-3 gap-3">
            <Input placeholder="Nom" value={ov.nom} onChange={(e) => setOv({ ...ov, nom: e.target.value })} />
            <Input placeholder="Description" value={ov.description} onChange={(e) => setOv({ ...ov, description: e.target.value })} className="md:col-span-2" />
          </div>
          <Button size="sm" disabled={!ov.nom} onClick={() => {
            update("atelier2", { ...a, objectifs: [...a.objectifs, { id: uid(), ...ov }] });
            setOv({ nom: "", description: "" });
          }}><Plus className="h-4 w-4 mr-1" />Ajouter</Button>
          <div className="space-y-2">
            {a.objectifs.map((o) => (
              <div key={o.id} className="flex items-center justify-between p-3 rounded-md border">
                <div><div className="font-medium">{o.nom}</div><div className="text-sm text-muted-foreground">{o.description}</div></div>
                <Button variant="ghost" size="icon" onClick={() => update("atelier2", { ...a, objectifs: a.objectifs.filter((x) => x.id !== o.id) })}><Trash2 className="h-4 w-4" /></Button>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Couples SR / OV</CardTitle><CardDescription>Évaluer la pertinence de chaque couple.</CardDescription></CardHeader>
        <CardContent className="space-y-4">
          <div className="grid md:grid-cols-4 gap-3 items-end">
            <Select value={cp.sourceId} onValueChange={(v) => setCp({ ...cp, sourceId: v })}>
              <SelectTrigger><SelectValue placeholder="Source" /></SelectTrigger>
              <SelectContent>{a.sources.map((s) => <SelectItem key={s.id} value={s.id}>{s.nom}</SelectItem>)}</SelectContent>
            </Select>
            <Select value={cp.objectifId} onValueChange={(v) => setCp({ ...cp, objectifId: v })}>
              <SelectTrigger><SelectValue placeholder="Objectif" /></SelectTrigger>
              <SelectContent>{a.objectifs.map((o) => <SelectItem key={o.id} value={o.id}>{o.nom}</SelectItem>)}</SelectContent>
            </Select>
            <div><Label className="text-xs">Pertinence</Label><Level value={cp.pertinence} onChange={(v) => setCp({ ...cp, pertinence: v })} /></div>
            <Button size="sm" disabled={!cp.sourceId || !cp.objectifId} onClick={() => {
              update("atelier2", { ...a, couples: [...a.couples, { id: uid(), ...cp }] });
              setCp({ sourceId: "", objectifId: "", pertinence: 3 });
            }}><Plus className="h-4 w-4 mr-1" />Ajouter</Button>
          </div>
          <div className="space-y-2">
            {a.couples.map((c) => {
              const s = a.sources.find((x) => x.id === c.sourceId);
              const o = a.objectifs.find((x) => x.id === c.objectifId);
              return (
                <div key={c.id} className="flex items-center justify-between p-3 rounded-md border">
                  <div className="text-sm"><span className="font-medium">{s?.nom}</span> → <span className="font-medium">{o?.nom}</span></div>
                  <div className="flex items-center gap-2"><Badge>Pertinence {c.pertinence}</Badge>
                    <Button variant="ghost" size="icon" onClick={() => update("atelier2", { ...a, couples: a.couples.filter((x) => x.id !== c.id) })}><Trash2 className="h-4 w-4" /></Button>
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
