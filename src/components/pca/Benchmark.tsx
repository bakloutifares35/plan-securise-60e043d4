import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Check, X } from "lucide-react";

const rows = [
  { criterion: "Maturité PCA globale", us: "76%", finance: "88%", industrie: "72%", tech: "81%", retail: "65%" },
  { criterion: "RTO moyen (heures)", us: "4h", finance: "1h", industrie: "8h", tech: "2h", retail: "12h" },
  { criterion: "RPO moyen (heures)", us: "2h", finance: "0.5h", industrie: "4h", tech: "1h", retail: "6h" },
  { criterion: "Tests annuels", us: "4", finance: "12", industrie: "2", tech: "6", retail: "2" },
  { criterion: "Conformité ISO 22301", us: true, finance: true, industrie: true, tech: true, retail: false },
  { criterion: "Site de repli actif", us: true, finance: true, industrie: false, tech: true, retail: false },
  { criterion: "Cellule de crise dédiée", us: true, finance: true, industrie: true, tech: true, retail: false },
  { criterion: "Budget PCA (% IT)", us: "8%", finance: "15%", industrie: "6%", tech: "10%", retail: "4%" },
];

const Cell = ({ v, highlight = false }: { v: string | boolean; highlight?: boolean }) => {
  if (typeof v === "boolean") {
    return v ? (
      <Check className="h-5 w-5 text-success" />
    ) : (
      <X className="h-5 w-5 text-destructive" />
    );
  }
  return <span className={highlight ? "font-semibold text-primary" : ""}>{v}</span>;
};

export const Benchmark = () => {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-foreground">Benchmark sectoriel</h1>
        <p className="text-muted-foreground mt-1">Comparaison de votre PCA avec les standards du marché</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="shadow-[var(--shadow-card)]">
          <CardContent className="p-5">
            <p className="text-sm text-muted-foreground">Votre score</p>
            <p className="text-3xl font-bold text-primary mt-1">76 / 100</p>
            <Badge variant="secondary" className="mt-2">Au-dessus de la moyenne</Badge>
          </CardContent>
        </Card>
        <Card className="shadow-[var(--shadow-card)]">
          <CardContent className="p-5">
            <p className="text-sm text-muted-foreground">Moyenne sectorielle</p>
            <p className="text-3xl font-bold text-foreground mt-1">71 / 100</p>
            <p className="text-xs text-muted-foreground mt-2">+5 pts vs moyenne</p>
          </CardContent>
        </Card>
        <Card className="shadow-[var(--shadow-card)]">
          <CardContent className="p-5">
            <p className="text-sm text-muted-foreground">Leader du secteur</p>
            <p className="text-3xl font-bold text-success mt-1">88 / 100</p>
            <p className="text-xs text-muted-foreground mt-2">Finance & Banque</p>
          </CardContent>
        </Card>
      </div>

      <Card className="shadow-[var(--shadow-card)]">
        <CardHeader>
          <CardTitle>Comparaison détaillée</CardTitle>
          <CardDescription>Vos indicateurs face aux principaux secteurs</CardDescription>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Critère</TableHead>
                <TableHead className="text-center bg-secondary/50">Votre entreprise</TableHead>
                <TableHead className="text-center">Finance</TableHead>
                <TableHead className="text-center">Industrie</TableHead>
                <TableHead className="text-center">Tech</TableHead>
                <TableHead className="text-center">Retail</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((r) => (
                <TableRow key={r.criterion}>
                  <TableCell className="font-medium">{r.criterion}</TableCell>
                  <TableCell className="text-center bg-secondary/30"><Cell v={r.us} highlight /></TableCell>
                  <TableCell className="text-center"><Cell v={r.finance} /></TableCell>
                  <TableCell className="text-center"><Cell v={r.industrie} /></TableCell>
                  <TableCell className="text-center"><Cell v={r.tech} /></TableCell>
                  <TableCell className="text-center"><Cell v={r.retail} /></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
};
