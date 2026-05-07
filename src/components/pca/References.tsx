import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Plus, Trash2, Lock, Settings } from "lucide-react";
import { useGovernance } from "@/contexts/GovernanceContext";
import { useRole, ROLE_LABELS, ROLE_DESCRIPTIONS, type Role } from "@/contexts/RoleContext";
import { type RefItem } from "@/data/governance";
import { toast } from "sonner";

type RefKey = "incidentTypes" | "criticalityLevels" | "severityLevels";

const SECTIONS: { key: RefKey; title: string; desc: string; hasLevel: boolean }[] = [
  { key: "incidentTypes", title: "Types d'incident", desc: "Catégories d'événements pouvant déclencher un PCA", hasLevel: false },
  { key: "criticalityLevels", title: "Niveaux de criticité", desc: "Classement de criticité des processus métier", hasLevel: true },
  { key: "severityLevels", title: "Niveaux de sévérité", desc: "Classement de sévérité des incidents", hasLevel: true },
];

const RefSection = ({ sec }: { sec: typeof SECTIONS[0] }) => {
  const { refs, setRefs } = useGovernance();
  const { can } = useRole();
  const items = refs[sec.key];
  const [label, setLabel] = useState("");
  const [level, setLevel] = useState("");

  const add = () => {
    if (!label.trim()) return;
    const item: RefItem = { id: `${sec.key}${Date.now()}`, label: label.trim(), level: sec.hasLevel ? Number(level) || items.length + 1 : undefined };
    setRefs({ ...refs, [sec.key]: [...items, item] });
    setLabel(""); setLevel("");
    toast.success("Élément ajouté");
  };

  const remove = (id: string) => {
    setRefs({ ...refs, [sec.key]: items.filter((i) => i.id !== id) });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">{sec.title}</CardTitle>
        <CardDescription>{sec.desc}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="space-y-2">
          {items.map((i) => (
            <div key={i.id} className="flex items-center justify-between p-2.5 border border-border rounded-md text-sm">
              <div className="flex items-center gap-2">
                {sec.hasLevel && <Badge variant="secondary">N{i.level}</Badge>}
                <span className="font-medium">{i.label}</span>
              </div>
              {can("admin") && <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => remove(i.id)}><Trash2 className="h-3.5 w-3.5" /></Button>}
            </div>
          ))}
        </div>
        {can("admin") && (
          <div className="flex gap-2 pt-2 border-t border-border">
            <Input placeholder="Nouveau libellé" value={label} onChange={(e) => setLabel(e.target.value)} />
            {sec.hasLevel && <Input className="w-24" type="number" placeholder="Niveau" value={level} onChange={(e) => setLevel(e.target.value)} />}
            <Button onClick={add}><Plus className="h-4 w-4" /></Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export const References = () => {
  const { role, can } = useRole();

  if (!can("admin")) {
    return (
      <Card className="border-warning/40 bg-warning/5">
        <CardContent className="flex items-start gap-3 py-6">
          <Lock className="h-5 w-5 text-warning shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold">Accès restreint</p>
            <p className="text-sm text-muted-foreground">La configuration des référentiels est réservée aux Administrateurs PCA. Rôle actuel : {ROLE_LABELS[role]}.</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold flex items-center gap-2"><Settings className="h-7 w-7 text-primary" /> Référentiels & Rôles</h1>
        <p className="text-muted-foreground mt-1">Configuration des référentiels et matrice des permissions</p>
      </div>

      <div className="grid lg:grid-cols-3 gap-4">
        {SECTIONS.map((s) => <RefSection key={s.key} sec={s} />)}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Rôles & permissions</CardTitle>
          <CardDescription>Matrice des accès par rôle</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-3">
            {(Object.keys(ROLE_LABELS) as Role[]).map((r) => (
              <div key={r} className="p-4 border border-border rounded-md">
                <Badge className="mb-2">{ROLE_LABELS[r]}</Badge>
                <p className="text-sm text-muted-foreground">{ROLE_DESCRIPTIONS[r]}</p>
                <ul className="mt-3 text-xs space-y-1">
                  <li>✓ Lecture</li>
                  <li className={r === "admin" || r === "referent" ? "" : "text-muted-foreground line-through"}>{r === "admin" || r === "referent" ? "✓" : "✗"} Écriture</li>
                  <li className={r === "admin" ? "" : "text-muted-foreground line-through"}>{r === "admin" ? "✓" : "✗"} Administration</li>
                </ul>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
