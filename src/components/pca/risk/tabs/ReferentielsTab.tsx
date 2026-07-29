import { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Boxes, Pencil, Plus, Search, ShieldAlert, Trash2 } from "lucide-react";
import type { RiskData } from "../useRiskData";
import {
  Actif, CATEGORIES_MENACE, INTENTIONS_MENACE, Menace, ORIGINES_MENACE, TYPES_ACTIF,
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

const emptyActif = (): Partial<Actif> => ({
  nom: "", type: "Information", criticite: 3, besoin_d: 3, besoin_i: 3, besoin_c: 3, besoin_t: 3,
});
const emptyMenace = (): Partial<Menace> => ({
  nom: "", categorie: "Cyber", origine: "Externe", intention: "Délibérée", referentiel: "ISO 27005",
});

export const ReferentielsTab = ({ data }: { data: RiskData }) => {
  const [sub, setSub] = useState<"actifs" | "menaces">("actifs");
  const [q, setQ] = useState("");
  const [actif, setActif] = useState<Partial<Actif> | null>(null);
  const [menace, setMenace] = useState<Partial<Menace> | null>(null);

  const actifs = useMemo(
    () => data.actifs.filter((a) => a.nom.toLowerCase().includes(q.toLowerCase())),
    [data.actifs, q]
  );
  const menaces = useMemo(
    () => data.menaces.filter((m) => `${m.code} ${m.nom} ${m.categorie}`.toLowerCase().includes(q.toLowerCase())),
    [data.menaces, q]
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex gap-1.5">
          {([["actifs", "Actifs", Boxes], ["menaces", "Menaces", ShieldAlert]] as const).map(([id, label, Icon]) => (
            <button key={id} onClick={() => setSub(id)}
              className={`inline-flex items-center gap-2 px-3.5 py-2 rounded-lg text-sm font-medium border transition-colors ${
                sub === id ? "bg-[#2A5141] text-white border-[#2A5141]" : "bg-white text-[#172030]/70 border-[#172030]/10 hover:bg-[#F8F6F2]"
              }`}>
              <Icon className="h-4 w-4" /> {label}
              <Badge variant="secondary" className="ml-1 bg-white/20 text-inherit">
                {id === "actifs" ? data.actifs.length : data.menaces.length}
              </Badge>
            </button>
          ))}
        </div>
        <div className="flex gap-2">
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-[#172030]/40" />
            <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Rechercher…" className="pl-8 w-56" />
          </div>
          <Button className="bg-[#2A5141] hover:bg-[#22412F]"
            onClick={() => (sub === "actifs" ? setActif(emptyActif()) : setMenace(emptyMenace()))}>
            <Plus className="h-4 w-4 mr-1.5" /> {sub === "actifs" ? "Nouvel actif" : "Nouvelle menace"}
          </Button>
        </div>
      </div>

      <Card className="border-[#172030]/10">
        <CardHeader className="pb-3">
          <CardTitle className="font-serif text-[#172030] text-base">
            {sub === "actifs" ? "Inventaire des actifs" : "Référentiel de menaces"}
          </CardTitle>
          <CardDescription>
            {sub === "actifs"
              ? "Actifs supports rattachés aux processus métier, avec leurs besoins DICT."
              : "Catalogue des menaces types utilisables dans le registre des risques."}
          </CardDescription>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          {sub === "actifs" ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Actif</TableHead><TableHead>Type</TableHead><TableHead>Processus</TableHead>
                  <TableHead>Propriétaire</TableHead><TableHead className="text-center">Criticité</TableHead>
                  <TableHead className="text-center">D / I / C / T</TableHead><TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {actifs.map((a) => (
                  <TableRow key={a.id}>
                    <TableCell className="font-medium text-[#172030]">{a.nom}</TableCell>
                    <TableCell><Badge variant="outline" className="border-[#172030]/15">{a.type}</Badge></TableCell>
                    <TableCell className="text-sm text-[#172030]/60">
                      {data.processus.find((p) => p.id === a.processus_id)?.name ?? "—"}
                    </TableCell>
                    <TableCell className="text-sm text-[#172030]/60">{a.proprietaire || "—"}</TableCell>
                    <TableCell className="text-center font-semibold">{a.criticite}</TableCell>
                    <TableCell className="text-center text-sm tabular-nums text-[#172030]/60">
                      {a.besoin_d}/{a.besoin_i}/{a.besoin_c}/{a.besoin_t}
                    </TableCell>
                    <TableCell className="text-right whitespace-nowrap">
                      <Button variant="ghost" size="icon" onClick={() => setActif({ ...a })}><Pencil className="h-4 w-4" /></Button>
                      <Button variant="ghost" size="icon" onClick={() => data.deleteRow("actifs", a.id)}><Trash2 className="h-4 w-4 text-rose-600" /></Button>
                    </TableCell>
                  </TableRow>
                ))}
                {actifs.length === 0 && (
                  <TableRow><TableCell colSpan={7} className="text-center text-[#172030]/50 italic py-8">Aucun actif.</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Code</TableHead><TableHead>Menace</TableHead><TableHead>Catégorie</TableHead>
                  <TableHead>Origine</TableHead><TableHead>Intention</TableHead><TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {menaces.map((m) => (
                  <TableRow key={m.id}>
                    <TableCell className="font-mono text-xs text-[#172030]/60">{m.code || "—"}</TableCell>
                    <TableCell>
                      <div className="font-medium text-[#172030]">{m.nom}</div>
                      {m.description && <div className="text-xs text-[#172030]/50">{m.description}</div>}
                    </TableCell>
                    <TableCell><Badge variant="outline" className="border-[#172030]/15">{m.categorie}</Badge></TableCell>
                    <TableCell className="text-sm text-[#172030]/60">{m.origine}</TableCell>
                    <TableCell className="text-sm text-[#172030]/60">{m.intention}</TableCell>
                    <TableCell className="text-right whitespace-nowrap">
                      <Button variant="ghost" size="icon" onClick={() => setMenace({ ...m })}><Pencil className="h-4 w-4" /></Button>
                      <Button variant="ghost" size="icon" onClick={() => data.deleteRow("menaces", m.id)}><Trash2 className="h-4 w-4 text-rose-600" /></Button>
                    </TableCell>
                  </TableRow>
                ))}
                {menaces.length === 0 && (
                  <TableRow><TableCell colSpan={6} className="text-center text-[#172030]/50 italic py-8">Aucune menace.</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Dialog actif */}
      <Dialog open={!!actif} onOpenChange={(o) => !o && setActif(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader><DialogTitle className="font-serif text-[#172030]">{actif?.id ? "Modifier l'actif" : "Nouvel actif"}</DialogTitle></DialogHeader>
          {actif && (
            <div className="space-y-4">
              <div className="grid md:grid-cols-2 gap-3">
                <div><Label>Nom *</Label><Input value={actif.nom ?? ""} onChange={(e) => setActif({ ...actif, nom: e.target.value })} /></div>
                <div>
                  <Label>Type</Label>
                  <Select value={actif.type} onValueChange={(v) => setActif({ ...actif, type: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{TYPES_ACTIF.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Processus rattaché</Label>
                  <Select value={actif.processus_id ?? "none"} onValueChange={(v) => setActif({ ...actif, processus_id: v === "none" ? null : v })}>
                    <SelectTrigger><SelectValue placeholder="Aucun" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Aucun</SelectItem>
                      {data.processus.map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div><Label>Propriétaire</Label><Input value={actif.proprietaire ?? ""} onChange={(e) => setActif({ ...actif, proprietaire: e.target.value })} /></div>
              </div>
              <div><Label>Description</Label><Textarea rows={2} value={actif.description ?? ""} onChange={(e) => setActif({ ...actif, description: e.target.value })} /></div>
              <div className="grid md:grid-cols-2 gap-4">
                <div><Label>Criticité</Label><Scale value={actif.criticite ?? 3} onChange={(n) => setActif({ ...actif, criticite: n })} /></div>
                <div><Label>Disponibilité</Label><Scale value={actif.besoin_d ?? 3} onChange={(n) => setActif({ ...actif, besoin_d: n })} /></div>
                <div><Label>Intégrité</Label><Scale value={actif.besoin_i ?? 3} onChange={(n) => setActif({ ...actif, besoin_i: n })} /></div>
                <div><Label>Confidentialité</Label><Scale value={actif.besoin_c ?? 3} onChange={(n) => setActif({ ...actif, besoin_c: n })} /></div>
                <div><Label>Traçabilité</Label><Scale value={actif.besoin_t ?? 3} onChange={(n) => setActif({ ...actif, besoin_t: n })} /></div>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setActif(null)}>Annuler</Button>
            <Button className="bg-[#2A5141] hover:bg-[#22412F]" disabled={!actif?.nom}
              onClick={async () => { await data.saveActif(actif!); setActif(null); }}>Enregistrer</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog menace */}
      <Dialog open={!!menace} onOpenChange={(o) => !o && setMenace(null)}>
        <DialogContent className="max-w-xl">
          <DialogHeader><DialogTitle className="font-serif text-[#172030]">{menace?.id ? "Modifier la menace" : "Nouvelle menace"}</DialogTitle></DialogHeader>
          {menace && (
            <div className="space-y-3">
              <div className="grid md:grid-cols-3 gap-3">
                <div><Label>Code</Label><Input value={menace.code ?? ""} onChange={(e) => setMenace({ ...menace, code: e.target.value })} /></div>
                <div className="md:col-span-2"><Label>Nom *</Label><Input value={menace.nom ?? ""} onChange={(e) => setMenace({ ...menace, nom: e.target.value })} /></div>
              </div>
              <div className="grid md:grid-cols-3 gap-3">
                <div>
                  <Label>Catégorie</Label>
                  <Select value={menace.categorie} onValueChange={(v) => setMenace({ ...menace, categorie: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{CATEGORIES_MENACE.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Origine</Label>
                  <Select value={menace.origine} onValueChange={(v) => setMenace({ ...menace, origine: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{ORIGINES_MENACE.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Intention</Label>
                  <Select value={menace.intention} onValueChange={(v) => setMenace({ ...menace, intention: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{INTENTIONS_MENACE.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
              </div>
              <div><Label>Description</Label><Textarea rows={2} value={menace.description ?? ""} onChange={(e) => setMenace({ ...menace, description: e.target.value })} /></div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setMenace(null)}>Annuler</Button>
            <Button className="bg-[#2A5141] hover:bg-[#22412F]" disabled={!menace?.nom}
              onClick={async () => { await data.saveMenace(menace!); setMenace(null); }}>Enregistrer</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};
