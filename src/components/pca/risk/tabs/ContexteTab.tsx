import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Save, Trash2, Users, X } from "lucide-react";
import type { RiskData } from "../useRiskData";
import { ContexteAnalyse, fmtDate } from "../riskModel";

const empty = (): Partial<ContexteAnalyse> => ({
  nom: "",
  perimetre: "",
  objectifs: "",
  criteres_acceptation: "",
  methodologie: "ISO 27005",
  parties_prenantes: [],
  responsable: "",
  version: "1.0",
  statut: "Brouillon",
  actif: true,
  organisation_id: null,
});

export const ContexteTab = ({ data }: { data: RiskData }) => {
  const [form, setForm] = useState<Partial<ContexteAnalyse>>(
    data.contextes[0] ? { ...data.contextes[0] } : empty()
  );
  const [pp, setPp] = useState("");
  const set = (k: keyof ContexteAnalyse, v: any) => setForm((f) => ({ ...f, [k]: v }));

  return (
    <div className="grid lg:grid-cols-3 gap-5">
      <Card className="lg:col-span-2 border-[#172030]/10">
        <CardHeader>
          <CardTitle className="font-serif text-[#172030]">Contexte de l'analyse</CardTitle>
          <CardDescription>
            Périmètre, objectifs et critères d'acceptation du risque (ISO 31000 / ISO 27005).
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid md:grid-cols-2 gap-4">
            <div>
              <Label>Intitulé de l'analyse *</Label>
              <Input value={form.nom ?? ""} onChange={(e) => set("nom", e.target.value)} placeholder="Analyse des risques 2026" />
            </div>
            <div>
              <Label>Entité concernée</Label>
              <Select value={form.organisation_id ?? "none"} onValueChange={(v) => set("organisation_id", v === "none" ? null : v)}>
                <SelectTrigger><SelectValue placeholder="Toutes" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Toutes les entités</SelectItem>
                  {data.organisations.map((o) => <SelectItem key={o.id} value={o.id}>{o.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div>
            <Label>Périmètre</Label>
            <Textarea rows={3} value={form.perimetre ?? ""} onChange={(e) => set("perimetre", e.target.value)}
              placeholder="Processus, sites, systèmes et activités couverts par l'analyse…" />
          </div>
          <div>
            <Label>Objectifs</Label>
            <Textarea rows={3} value={form.objectifs ?? ""} onChange={(e) => set("objectifs", e.target.value)}
              placeholder="Ce que l'analyse doit permettre de décider…" />
          </div>
          <div>
            <Label>Critères d'acceptation du risque</Label>
            <Textarea rows={3} value={form.criteres_acceptation ?? ""} onChange={(e) => set("criteres_acceptation", e.target.value)}
              placeholder="Ex. : tout risque résiduel supérieur à 12 doit faire l'objet d'un plan de traitement validé par le COMEX." />
          </div>

          <div className="grid md:grid-cols-4 gap-4">
            <div>
              <Label>Méthodologie</Label>
              <Select value={form.methodologie ?? "ISO 27005"} onValueChange={(v) => set("methodologie", v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {["ISO 27005", "ISO 31000", "Méthode 5×5 interne", "Autre"].map((m) => (
                    <SelectItem key={m} value={m}>{m}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Responsable</Label>
              <Input value={form.responsable ?? ""} onChange={(e) => set("responsable", e.target.value)} />
            </div>
            <div>
              <Label>Version</Label>
              <Input value={form.version ?? ""} onChange={(e) => set("version", e.target.value)} />
            </div>
            <div>
              <Label>Statut</Label>
              <Select value={form.statut ?? "Brouillon"} onValueChange={(v) => set("statut", v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {["Brouillon", "En revue", "Validé", "Archivé"].map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid md:grid-cols-2 gap-4">
            <div>
              <Label>Date d'analyse</Label>
              <Input type="date" value={form.date_analyse ?? ""} onChange={(e) => set("date_analyse", e.target.value)} />
            </div>
            <div>
              <Label>Prochaine revue</Label>
              <Input type="date" value={form.date_revue ?? ""} onChange={(e) => set("date_revue", e.target.value)} />
            </div>
          </div>

          <div>
            <Label className="flex items-center gap-1.5"><Users className="h-3.5 w-3.5" /> Parties prenantes</Label>
            <div className="flex gap-2 mt-1">
              <Input value={pp} onChange={(e) => setPp(e.target.value)} placeholder="Direction, RSSI, Métiers…"
                onKeyDown={(e) => {
                  if (e.key === "Enter" && pp.trim()) {
                    e.preventDefault();
                    set("parties_prenantes", [...(form.parties_prenantes ?? []), pp.trim()]);
                    setPp("");
                  }
                }} />
              <Button type="button" variant="outline" onClick={() => {
                if (!pp.trim()) return;
                set("parties_prenantes", [...(form.parties_prenantes ?? []), pp.trim()]);
                setPp("");
              }}><Plus className="h-4 w-4" /></Button>
            </div>
            <div className="flex flex-wrap gap-1.5 mt-2">
              {(form.parties_prenantes ?? []).map((p, i) => (
                <Badge key={`${p}-${i}`} variant="outline" className="gap-1 border-[#172030]/15">
                  {p}
                  <button onClick={() => set("parties_prenantes", (form.parties_prenantes ?? []).filter((_, j) => j !== i))}>
                    <X className="h-3 w-3" />
                  </button>
                </Badge>
              ))}
            </div>
          </div>

          <div className="flex gap-2 pt-2">
            <Button className="bg-[#2A5141] hover:bg-[#22412F]" disabled={!form.nom} onClick={() => data.saveContexte(form)}>
              <Save className="h-4 w-4 mr-1.5" /> Enregistrer
            </Button>
            <Button variant="outline" onClick={() => setForm(empty())}>Nouveau contexte</Button>
          </div>
        </CardContent>
      </Card>

      <Card className="border-[#172030]/10 h-fit">
        <CardHeader>
          <CardTitle className="font-serif text-[#172030] text-base">Analyses enregistrées</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {data.contextes.length === 0 && (
            <p className="text-sm text-[#172030]/50 italic">Aucun contexte enregistré.</p>
          )}
          {data.contextes.map((c) => (
            <button key={c.id} onClick={() => setForm({ ...c })}
              className={`w-full text-left p-3 rounded-lg border transition-colors ${
                form.id === c.id ? "border-[#2A5141] bg-[#2A5141]/5" : "border-[#172030]/10 hover:bg-[#F8F6F2]"
              }`}>
              <div className="flex items-center justify-between gap-2">
                <span className="font-medium text-sm text-[#172030] truncate">{c.nom}</span>
                <Badge variant="outline" className="text-[10px] border-[#172030]/15">{c.statut}</Badge>
              </div>
              <div className="text-xs text-[#172030]/50 mt-1">
                v{c.version} · {fmtDate(c.date_analyse)} · {c.responsable || "—"}
              </div>
              <div className="mt-2 flex justify-end">
                <span role="button" tabIndex={0}
                  onClick={(e) => { e.stopPropagation(); data.deleteRow("contexte_analyse", c.id); }}
                  className="text-xs text-rose-600 inline-flex items-center gap-1 hover:underline">
                  <Trash2 className="h-3 w-3" /> Supprimer
                </span>
              </div>
            </button>
          ))}
        </CardContent>
      </Card>
    </div>
  );
};
