import { useState } from "react";
import { useEbios, uid, EbiosKillChainEtape } from "@/contexts/EbiosContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Plus, Trash2 } from "lucide-react";

const ETAPES: EbiosKillChainEtape[] = ["Reconnaissance", "Intrusion", "Exploitation", "Exfiltration"];

const Level = ({ value, onChange }: { value: number; onChange: (v: number) => void }) => (
  <div className="flex gap-1">
    {[1, 2, 3, 4, 5].map((n) => (
      <button key={n} type="button" onClick={() => onChange(n)}
        className={`h-7 w-7 rounded text-xs font-medium border ${value >= n ? "bg-primary text-primary-foreground border-primary" : "bg-background border-border"}`}>{n}</button>
    ))}
  </div>
);

export const EBIOSAtelier4 = () => {
  const { state, update } = useEbios();
  const a = state.atelier4;
  const [sc, setSc] = useState<{ nom: string; etape: EbiosKillChainEtape; modeOperatoire: string; vraisemblance: number }>({
    nom: "", etape: "Reconnaissance", modeOperatoire: "", vraisemblance: 3,
  });

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Atelier 4 — Scénarios opérationnels</CardTitle>
          <CardDescription>Détailler les modes opératoires selon la Cyber Kill Chain.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2">
            {ETAPES.map((e) => (
              <Badge key={e} variant="secondary">{e}</Badge>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Ajouter un scénario opérationnel</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="grid md:grid-cols-2 gap-3">
            <div>
              <Label>Nom</Label>
              <Input value={sc.nom} onChange={(e) => setSc({ ...sc, nom: e.target.value })} />
            </div>
            <div>
              <Label>Étape Kill Chain</Label>
              <Select value={sc.etape} onValueChange={(v) => setSc({ ...sc, etape: v as EbiosKillChainEtape })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{ETAPES.map((e) => <SelectItem key={e} value={e}>{e}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </div>
          <div>
            <Label>Mode opératoire</Label>
            <Textarea rows={3} value={sc.modeOperatoire} onChange={(e) => setSc({ ...sc, modeOperatoire: e.target.value })} />
          </div>
          <div>
            <Label>Vraisemblance (1-5)</Label>
            <Level value={sc.vraisemblance} onChange={(v) => setSc({ ...sc, vraisemblance: v })} />
          </div>
          <Button size="sm" disabled={!sc.nom} onClick={() => {
            update("atelier4", { ...a, scenarios: [...a.scenarios, { id: uid(), ...sc }] });
            setSc({ nom: "", etape: "Reconnaissance", modeOperatoire: "", vraisemblance: 3 });
          }}><Plus className="h-4 w-4 mr-1" />Ajouter le scénario</Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Scénarios opérationnels ({a.scenarios.length})</CardTitle></CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-2">
            {ETAPES.map((e) => (
              <div key={e} className="space-y-2">
                <h4 className="text-sm font-semibold text-muted-foreground">{e}</h4>
                {a.scenarios.filter((s) => s.etape === e).map((s) => (
                  <div key={s.id} className="p-3 rounded-md border space-y-1">
                    <div className="flex items-start justify-between gap-2">
                      <div className="font-medium">{s.nom}</div>
                      <div className="flex items-center gap-1">
                        <Badge>V {s.vraisemblance}</Badge>
                        <Button variant="ghost" size="icon" onClick={() => update("atelier4", { ...a, scenarios: a.scenarios.filter((x) => x.id !== s.id) })}><Trash2 className="h-4 w-4" /></Button>
                      </div>
                    </div>
                    <div className="text-xs text-muted-foreground">{s.modeOperatoire}</div>
                  </div>
                ))}
                {a.scenarios.filter((s) => s.etape === e).length === 0 && (
                  <div className="text-xs text-muted-foreground italic">Aucun scénario</div>
                )}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
