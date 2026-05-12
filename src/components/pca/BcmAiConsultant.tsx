import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Sparkles, Loader2, Download, ChevronRight, AlertTriangle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { useBia } from "@/contexts/BiaContext";
import { useGovernance } from "@/contexts/GovernanceContext";
import { emptyImpacts, type Process, type Criticality } from "@/data/bia";

type OrgNode = { name: string; children?: OrgNode[] };
type AiProcess = { name: string; department: string; rto: string; rpo: string; mtpd: string; mbco: string; criticality: Criticality };
type AiRisk = { name: string; category: string; probability: number; impact: number; measures: string[] };
type AiResult = { org_chart: OrgNode[]; processes: AiProcess[]; risks: AiRisk[] };

const SECTORS = ["Banque & Finance", "Assurance", "Industrie", "Santé", "Retail", "Autre"];
const SIZES = ["Moins de 50", "50-200", "200-500", "500-2000", "Plus de 2000 employés"];

const SECTOR_CHECKLISTS: Record<string, string[]> = {
  "Banque & Finance": ["Paiements interbancaires", "Gestion des crédits", "Trading", "Service client", "Infrastructure IT", "Cybersécurité", "Paie et RH", "Conformité"],
  "Assurance": ["Gestion des sinistres", "Souscription", "Indemnisation", "Service client", "Comptabilité", "IT"],
  "Industrie": ["Production", "Logistique", "Approvisionnement", "Maintenance", "IT", "RH"],
  "Santé": ["Consultations", "Chirurgie", "Pharmacie", "Imagerie médicale", "Dossiers patients", "IT"],
  "Retail": ["Ventes en magasin", "E-commerce", "Logistique", "Marketing", "Fidélisation", "IT"],
  "Autre": ["Opérations", "Finance", "Marketing", "RH", "IT", "Service client"],
};

const parseDuration = (s: string): number => {
  const m = s.toLowerCase().match(/(\d+(?:[.,]\d+)?)\s*(h|j|jour|jours|d|day|days|w|sem|semaine|m|mois)?/);
  if (!m) return 0;
  const n = parseFloat(m[1].replace(",", "."));
  const u = (m[2] || "h").toLowerCase();
  if (u.startsWith("h")) return n;
  if (u.startsWith("d") || u.startsWith("j")) return n * 24;
  if (u.startsWith("w") || u.startsWith("s")) return n * 168;
  if (u.startsWith("m")) return n * 720;
  return n;
};

const TreeNode = ({ node, level = 0 }: { node: OrgNode; level?: number }) => (
  <div className="ml-2">
    <div className="flex items-center gap-2 py-1">
      <ChevronRight className="h-3 w-3 text-muted-foreground" />
      <span className={level === 0 ? "font-semibold text-foreground" : level === 1 ? "font-medium text-foreground" : "text-muted-foreground"}>
        {node.name}
      </span>
    </div>
    {node.children && node.children.length > 0 && (
      <div className="ml-4 border-l border-border pl-3 space-y-0.5">
        {node.children.map((c, i) => <TreeNode key={i} node={c} level={level + 1} />)}
      </div>
    )}
  </div>
);

const critColor = (c: Criticality) => {
  switch (c) {
    case "Critique": return "bg-destructive/15 text-destructive border-destructive/30";
    case "Majeur": return "bg-warning/15 text-warning border-warning/30";
    case "Modéré": return "bg-accent/15 text-accent border-accent/30";
    default: return "bg-muted text-muted-foreground border-border";
  }
};

const riskScoreColor = (n: number) => {
  if (n >= 15) return "bg-destructive text-destructive-foreground";
  if (n >= 9) return "bg-warning text-warning-foreground";
  if (n >= 4) return "bg-accent text-accent-foreground";
  return "bg-success text-success-foreground";
};

export const BcmAiConsultant = () => {
  const [sector, setSector] = useState("");
  const [size, setSize] = useState("");
  const [country, setCountry] = useState("France");
  const [subsidiaries, setSubsidiaries] = useState<number>(0);
  const [description, setDescription] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<AiResult | null>(null);

  const { setProcesses, processes } = useBia();
  const { entities, setEntities } = useGovernance();

  const generate = async () => {
    if (!sector || !size) {
      toast({ title: "Champs requis", description: "Veuillez sélectionner un secteur et une taille.", variant: "destructive" });
      return;
    }
    setLoading(true);
    setResult(null);
    try {
      const { data, error } = await supabase.functions.invoke("bcm-ai-consultant", {
        body: { sector, size, country, subsidiaries, description },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      setResult(data as AiResult);
      toast({ title: "Suggestion générée", description: "L'IA a produit une proposition de PCA." });
    } catch (e: any) {
      toast({ title: "Erreur", description: e.message || "Échec de la génération.", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const importToPlatform = () => {
    if (!result) return;
    const rootEntityId = entities[0]?.id ?? "e1";

    // Import org chart as entities (1 level under root)
    const newEntities = result.org_chart.flatMap((root) =>
      (root.children ?? []).map((dept, i) => ({
        id: `ai-${Date.now()}-${i}`,
        name: dept.name,
        country,
        sector,
        parentId: rootEntityId,
        referent: "À définir",
        referentBackup: "À définir",
        status: "Actif" as const,
        pcaStatus: "Non démarré" as const,
      }))
    );
    setEntities([...entities, ...newEntities]);

    // Import processes
    const newProcesses: Process[] = result.processes.map((p, i) => {
      const score = p.criticality === "Critique" ? 5 : p.criticality === "Majeur" ? 4 : p.criticality === "Modéré" ? 3 : 2;
      const impacts = emptyImpacts();
      for (const period of Object.keys(impacts) as (keyof typeof impacts)[]) {
        for (const a of Object.keys(impacts[period]) as (keyof typeof impacts[typeof period])[]) {
          impacts[period][a] = score;
        }
      }
      return {
        id: `AI-P${Date.now()}-${i}`,
        name: p.name,
        entityId: rootEntityId,
        department: p.department,
        owner: "À définir",
        description: `Importé depuis BCM AI Consultant — ${sector}`,
        status: "En revue",
        impacts,
        rto: parseDuration(p.rto),
        rpo: parseDuration(p.rpo),
        mtpd: parseDuration(p.mtpd),
        mbco: parseInt(p.mbco) || 50,
        resources: [],
        dependsOn: [],
        lastUpdated: new Date().toISOString().slice(0, 10),
      };
    });
    setProcesses([...processes, ...newProcesses]);

    toast({
      title: "Import réussi",
      description: `${newEntities.length} département(s) ajouté(s) à M1, ${newProcesses.length} processus ajouté(s) à M2.`,
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gradient-to-br from-primary to-primary-glow">
          <Sparkles className="h-5 w-5 text-primary-foreground" />
        </div>
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-foreground">BCM AI Consultant</h1>
          <p className="text-muted-foreground mt-1">Générez une ébauche de PCA adaptée à votre contexte grâce à l'IA.</p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Informations sur l'entreprise</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Secteur d'activité *</Label>
              <Select value={sector} onValueChange={setSector}>
                <SelectTrigger><SelectValue placeholder="Sélectionner un secteur" /></SelectTrigger>
                <SelectContent>
                  {SECTORS.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Taille de l'entreprise *</Label>
              <Select value={size} onValueChange={setSize}>
                <SelectTrigger><SelectValue placeholder="Sélectionner une taille" /></SelectTrigger>
                <SelectContent>
                  {SIZES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Pays</Label>
              <Input value={country} onChange={(e) => setCountry(e.target.value)} placeholder="France" />
            </div>
            <div className="space-y-2">
              <Label>Nombre de filiales</Label>
              <Input type="number" min={0} value={subsidiaries} onChange={(e) => setSubsidiaries(parseInt(e.target.value) || 0)} />
            </div>
          </div>
          <div className="space-y-2">
            <Label>Description libre</Label>
            <Textarea
              rows={5}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Décrivez vos processus principaux, vos spécificités et vos contraintes..."
            />
          </div>
          <div className="flex justify-end">
            <Button onClick={generate} disabled={loading} size="lg">
              {loading ? (
                <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Génération en cours...</>
              ) : (
                <><Sparkles className="h-4 w-4 mr-2" /> Générer avec l'IA</>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>

      {loading && (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16 gap-4">
            <Loader2 className="h-10 w-10 animate-spin text-primary" />
            <p className="text-muted-foreground">L'IA analyse votre contexte et construit votre PCA...</p>
          </CardContent>
        </Card>
      )}

      {result && !loading && (
        <Card>
          <CardHeader>
            <CardTitle>Résultats de la suggestion IA</CardTitle>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="org">
              <TabsList className="grid grid-cols-3 w-full md:w-auto">
                <TabsTrigger value="org">Organigramme suggéré</TabsTrigger>
                <TabsTrigger value="proc">Processus & RTO/RPO</TabsTrigger>
                <TabsTrigger value="risk">Risques principaux</TabsTrigger>
              </TabsList>

              <TabsContent value="org" className="mt-6">
                <div className="rounded-lg border border-border bg-card p-4 space-y-2">
                  {result.org_chart.map((n, i) => <TreeNode key={i} node={n} />)}
                </div>
              </TabsContent>

              <TabsContent value="proc" className="mt-6">
                <div className="overflow-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Processus</TableHead>
                        <TableHead>Département</TableHead>
                        <TableHead>RTO</TableHead>
                        <TableHead>RPO</TableHead>
                        <TableHead>MTPD</TableHead>
                        <TableHead>MBCO</TableHead>
                        <TableHead>Criticité</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {result.processes.map((p, i) => (
                        <TableRow key={i}>
                          <TableCell className="font-medium">{p.name}</TableCell>
                          <TableCell>{p.department}</TableCell>
                          <TableCell>{p.rto}</TableCell>
                          <TableCell>{p.rpo}</TableCell>
                          <TableCell>{p.mtpd}</TableCell>
                          <TableCell>{p.mbco}</TableCell>
                          <TableCell>
                            <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium border ${critColor(p.criticality)}`}>{p.criticality}</span>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </TabsContent>

              <TabsContent value="risk" className="mt-6 space-y-3">
                {result.risks.map((r, i) => {
                  const score = r.probability * r.impact;
                  return (
                    <div key={i} className="rounded-lg border border-border bg-card p-4">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div className="flex items-start gap-3">
                          <AlertTriangle className="h-5 w-5 text-warning mt-0.5" />
                          <div>
                            <p className="font-semibold text-foreground">{r.name}</p>
                            <Badge variant="outline" className="mt-1">{r.category}</Badge>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge variant="outline">P: {r.probability}/5</Badge>
                          <Badge variant="outline">I: {r.impact}/5</Badge>
                          <span className={`px-2 py-1 rounded text-xs font-bold ${riskScoreColor(score)}`}>Score: {score}</span>
                        </div>
                      </div>
                      <div className="mt-3 pl-8">
                        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">Mesures recommandées</p>
                        <ul className="text-sm text-foreground space-y-1 list-disc list-inside">
                          {r.measures.map((m, j) => <li key={j}>{m}</li>)}
                        </ul>
                      </div>
                    </div>
                  );
                })}
              </TabsContent>
            </Tabs>

            <div className="flex justify-end mt-6 pt-6 border-t border-border">
              <Button onClick={importToPlatform} size="lg">
                <Download className="h-4 w-4 mr-2" /> Importer dans la plateforme
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};
