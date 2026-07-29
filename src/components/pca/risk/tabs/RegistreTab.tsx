import { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Pencil, Plus, Search, Trash2 } from "lucide-react";
import type { RiskData } from "../useRiskData";
import {
  AXES_IMPACT, DECISIONS, NIVEAU_STYLE, NiveauRisque, Risque, STATUTS_RISQUE,
  emptyRisque, fmtDate, recompute,
} from "../riskModel";

const Scale = ({ value, onChange }: { value: number; onChange: (n: number) => void }) => (
  <div className="flex gap-1">
    {[1, 2, 3, 4, 5].map((n) => (
      <button key={n} type="button" onClick={() => onChange(n)}
        className={`h-8 w-8 rounded-md text-xs font-medium border transition-colors ${
          value >= n ? "bg-[#2A5141] text-white border-[#2A5141]" : "bg-white border-[#172030]/15 text-[#172030]/60"
        }`}>{n}</button>
    ))}
  </div>
);

export const RegistreTab = ({ data }: { data: RiskData }) => {
  const [q, setQ] = useState("");
  const [niveau, setNiveau] = useState<string>("all");
  const [form, setForm] = useState<Partial<Risque> | null>(null);

  const rows = useMemo(
    () => data.risques.filter((r) =>
      `${r.reference} ${r.title} ${r.category ?? ""} ${r.owner ?? ""}`.toLowerCase().includes(q.toLowerCase()) &&
      (niveau === "all" || r.niveau === niveau)
    ),
    [data.risques, q, niveau]
  );

  const live = form ? recompute(form, data.params) : null;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex gap-2">
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-[#172030]/40" />
            <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Rechercher un risque…" className="pl-8 w-64" />
          </div>
          <Select value={niveau} onValueChange={setNiveau}>
            <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tous les niveaux</SelectItem>
              {(["Faible", "Modéré", "Élevé", "Critique"] as NiveauRisque[]).map((n) => (
                <SelectItem key={n} value={n}>{n}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <Button className="bg-[#2A5141] hover:bg-[#22412F]" onClick={() => setForm(emptyRisque())}>
          <Plus className="h-4 w-4 mr-1.5" /> Nouveau risque
        </Button>
      </div>

      <Card className="border-[#172030]/10">
        <CardHeader className="pb-3">
          <CardTitle className="font-serif text-[#172030] text-base">Registre des risques ({rows.length})</CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Réf.</TableHead><TableHead>Risque</TableHead><TableHead>Actif / Menace</TableHead>
                <TableHead className="text-center">P</TableHead><TableHead className="text-center">I</TableHead>
                <TableHead className="text-center">Brut</TableHead><TableHead className="text-center">Maîtrise</TableHead>
                <TableHead className="text-center">Résiduel</TableHead><TableHead>Niveau</TableHead>
                <TableHead>Pilote</TableHead><TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((r) => {
                const st = NIVEAU_STYLE[(r.niveau as NiveauRisque) ?? "Faible"] ?? NIVEAU_STYLE.Faible;
                return (
                  <TableRow key={r.id}>
                    <TableCell className="font-mono text-xs text-[#172030]/60">{r.reference || "—"}</TableCell>
                    <TableCell>
                      <div className="font-medium text-[#172030]">{r.title}</div>
                      <div className="text-xs text-[#172030]/50">{r.status} · revue {fmtDate(r.date_revue)}</div>
                    </TableCell>
                    <TableCell className="text-xs text-[#172030]/60">
                      {data.actifs.find((a) => a.id === r.actif_id)?.nom ?? "—"}
                      <br />
                      {data.menaces.find((m) => m.id === r.menace_id)?.nom ?? "—"}
                    </TableCell>
                    <TableCell className="text-center">{r.probabilite}</TableCell>
                    <TableCell className="text-center">{r.impact_global}</TableCell>
                    <TableCell className="text-center font-semibold">{r.score_brut}</TableCell>
                    <TableCell className="text-center">{r.maitrise}</TableCell>
                    <TableCell className="text-center font-semibold">{r.score_residuel}</TableCell>
                    <TableCell><Badge variant="outline" className={st.badge}>{r.niveau ?? "—"}</Badge></TableCell>
                    <TableCell className="text-sm text-[#172030]/60">{r.owner || "—"}</TableCell>
                    <TableCell className="text-right whitespace-nowrap">
                      <Button variant="ghost" size="icon" onClick={() => setForm({ ...r })}><Pencil className="h-4 w-4" /></Button>
                      <Button variant="ghost" size="icon" onClick={() => data.deleteRow("risques", r.id)}><Trash2 className="h-4 w-4 text-rose-600" /></Button>
                    </TableCell>
                  </TableRow>
                );
              })}
              {rows.length === 0 && (
                <TableRow><TableCell colSpan={11} className="text-center py-10 text-[#172030]/50 italic">Aucun risque enregistré.</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={!!form} onOpenChange={(o) => !o && setForm(null)}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-serif text-[#172030]">{form?.id ? `Risque ${form.reference ?? ""}` : "Nouveau risque"}</DialogTitle>
          </DialogHeader>
          {form && (
            <div className="space-y-4">
              <div className="grid md:grid-cols-2 gap-3">
                <div className="md:col-span-2"><Label>Intitulé *</Label><Input value={form.title ?? ""} onChange={(e) => setForm({ ...form, title: e.target.value })} /></div>
                <div className="md:col-span-2"><Label>Description</Label><Textarea rows={2} value={form.description ?? ""} onChange={(e) => setForm({ ...form, description: e.target.value })} /></div>
                <div>
                  <Label>Contexte</Label>
                  <Select value={form.contexte_id ?? "none"} onValueChange={(v) => setForm({ ...form, contexte_id: v === "none" ? null : v })}>
                    <SelectTrigger><SelectValue placeholder="Aucun" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Aucun</SelectItem>
                      {data.contextes.map((c) => <SelectItem key={c.id} value={c.id}>{c.nom}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Processus impacté</Label>
                  <Select value={form.processus_id ?? "none"} onValueChange={(v) => setForm({ ...form, processus_id: v === "none" ? null : v })}>
                    <SelectTrigger><SelectValue placeholder="Aucun" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Aucun</SelectItem>
                      {data.processus.map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Actif concerné</Label>
                  <Select value={form.actif_id ?? "none"} onValueChange={(v) => setForm({ ...form, actif_id: v === "none" ? null : v })}>
                    <SelectTrigger><SelectValue placeholder="Aucun" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Aucun</SelectItem>
                      {data.actifs.map((a) => <SelectItem key={a.id} value={a.id}>{a.nom}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Menace</Label>
                  <Select value={form.menace_id ?? "none"} onValueChange={(v) => {
                    const m = data.menaces.find((x) => x.id === v);
                    setForm({ ...form, menace_id: v === "none" ? null : v, category: m?.categorie ?? form.category });
                  }}>
                    <SelectTrigger><SelectValue placeholder="Aucune" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Aucune</SelectItem>
                      {data.menaces.map((m) => <SelectItem key={m.id} value={m.id}>{m.code ? `${m.code} — ` : ""}{m.nom}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="md:col-span-2"><Label>Vulnérabilité exploitée</Label><Input value={form.vulnerabilite ?? ""} onChange={(e) => setForm({ ...form, vulnerabilite: e.target.value })} /></div>
                <div><Label>Cause</Label><Input value={form.cause ?? ""} onChange={(e) => setForm({ ...form, cause: e.target.value })} /></div>
                <div><Label>Conséquence</Label><Input value={form.consequence ?? ""} onChange={(e) => setForm({ ...form, consequence: e.target.value })} /></div>
              </div>

              <div className="rounded-lg border border-[#172030]/10 p-4 space-y-3 bg-[#F8F6F2]">
                <div><Label>Probabilité</Label><Scale value={form.probabilite ?? 3} onChange={(n) => setForm({ ...form, probabilite: n })} />
                  <p className="text-xs text-[#172030]/50 mt-1">
                    {data.params.echelle_probabilite.find((e) => e.n === (form.probabilite ?? 3))?.desc}
                  </p>
                </div>
                <div className="grid md:grid-cols-2 gap-3">
                  {AXES_IMPACT.map((a) => (
                    <div key={a.id}>
                      <Label className="text-xs">{a.icon} {a.label}</Label>
                      <Scale value={(form as any)[a.col] ?? 1} onChange={(n) => setForm({ ...form, [a.col]: n })} />
                    </div>
                  ))}
                </div>
              </div>

              <div className="grid md:grid-cols-2 gap-3">
                <div><Label>Niveau de maîtrise actuel</Label><Scale value={form.maitrise ?? 1} onChange={(n) => setForm({ ...form, maitrise: n })} /></div>
                <div><Label>Mesures existantes</Label><Input value={form.mesures_existantes ?? ""} onChange={(e) => setForm({ ...form, mesures_existantes: e.target.value })} /></div>
              </div>

              {live && (
                <div className="grid grid-cols-4 gap-2 text-center">
                  {[["Impact global", live.impact_global], ["Score brut", live.score_brut], ["Score résiduel", live.score_residuel]].map(([l, v]) => (
                    <div key={l as string} className="rounded-lg border border-[#172030]/10 p-3">
                      <div className="text-xs text-[#172030]/50">{l}</div>
                      <div className="text-xl font-semibold text-[#172030]">{v}</div>
                    </div>
                  ))}
                  <div className="rounded-lg border border-[#172030]/10 p-3">
                    <div className="text-xs text-[#172030]/50">Niveau</div>
                    <Badge variant="outline" className={`mt-1 ${NIVEAU_STYLE[live.niveau].badge}`}>{live.niveau}</Badge>
                  </div>
                </div>
              )}

              <div className="grid md:grid-cols-4 gap-3">
                <div><Label>Pilote</Label><Input value={form.owner ?? ""} onChange={(e) => setForm({ ...form, owner: e.target.value })} /></div>
                <div>
                  <Label>Statut</Label>
                  <Select value={form.status ?? "À analyser"} onValueChange={(v) => setForm({ ...form, status: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{STATUTS_RISQUE.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Décision</Label>
                  <Select value={form.decision ?? "À décider"} onValueChange={(v) => setForm({ ...form, decision: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{DECISIONS.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div><Label>Prochaine revue</Label><Input type="date" value={form.date_revue ?? ""} onChange={(e) => setForm({ ...form, date_revue: e.target.value })} /></div>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setForm(null)}>Annuler</Button>
            <Button className="bg-[#2A5141] hover:bg-[#22412F]" disabled={!form?.title}
              onClick={async () => { await data.saveRisque(form!); setForm(null); }}>Enregistrer</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};
