import { useEbios } from "@/contexts/EbiosContext";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { FileDown } from "lucide-react";

export const EBIOSSummary = () => {
  const { state } = useEbios();

  const exportPdf = () => {
    const html = `
      <html><head><meta charset="utf-8"><title>Synthèse EBIOS RM</title>
      <style>
        body{font-family:Arial,sans-serif;padding:40px;color:#1a1a1a}
        h1{color:#1e40af;border-bottom:2px solid #1e40af;padding-bottom:8px}
        h2{color:#1e3a8a;margin-top:24px}
        table{border-collapse:collapse;width:100%;margin:8px 0}
        td,th{border:1px solid #cbd5e1;padding:6px 10px;text-align:left;font-size:13px}
        th{background:#f1f5f9}
        .badge{display:inline-block;padding:2px 8px;border-radius:4px;background:#e0e7ff;color:#3730a3;font-size:12px}
      </style></head><body>
      <h1>Synthèse EBIOS Risk Manager</h1>
      <p>Document généré le ${new Date().toLocaleDateString("fr-FR")}</p>

      <h2>Atelier 1 — Cadrage</h2>
      <p><strong>Valeurs métier (${state.atelier1.valeursMetier.length})</strong></p>
      <table><tr><th>Nom</th><th>Description</th><th>Impact</th></tr>
      ${state.atelier1.valeursMetier.map(v => `<tr><td>${v.nom}</td><td>${v.description}</td><td>${v.impact}</td></tr>`).join("")}
      </table>
      <p><strong>Événements redoutés</strong></p>
      <table><tr><th>Nom</th><th>Sévérité</th></tr>
      ${state.atelier1.evenementsRedoutes.map(e => `<tr><td>${e.nom}</td><td>${e.severite}</td></tr>`).join("")}
      </table>

      <h2>Atelier 2 — Sources de risque</h2>
      <table><tr><th>Source</th><th>Motivation</th><th>Capacité</th></tr>
      ${state.atelier2.sources.map(s => `<tr><td>${s.nom}</td><td>${s.motivation}</td><td>${s.capacite}</td></tr>`).join("")}
      </table>

      <h2>Atelier 3 — Scénarios stratégiques</h2>
      <table><tr><th>Nom</th><th>Description</th><th>Sévérité</th></tr>
      ${state.atelier3.scenarios.map(s => `<tr><td>${s.nom}</td><td>${s.description}</td><td>${s.severite}</td></tr>`).join("")}
      </table>

      <h2>Atelier 4 — Scénarios opérationnels</h2>
      <table><tr><th>Nom</th><th>Étape</th><th>Vraisemblance</th></tr>
      ${state.atelier4.scenarios.map(s => `<tr><td>${s.nom}</td><td>${s.etape}</td><td>${s.vraisemblance}</td></tr>`).join("")}
      </table>

      <h2>Atelier 5 — Traitement</h2>
      <table><tr><th>Mesure</th><th>Stratégie</th><th>Risque résiduel</th></tr>
      ${state.atelier5.mesures.map(m => `<tr><td>${m.libelle}</td><td>${m.strategie}</td><td>${m.risqueResiduel}</td></tr>`).join("")}
      </table>
      </body></html>`;
    const w = window.open("", "_blank");
    if (w) { w.document.write(html); w.document.close(); setTimeout(() => w.print(), 300); }
  };

  const counts = {
    vm: state.atelier1.valeursMetier.length,
    er: state.atelier1.evenementsRedoutes.length,
    sr: state.atelier2.sources.length,
    ss: state.atelier3.scenarios.length,
    so: state.atelier4.scenarios.length,
    me: state.atelier5.mesures.length,
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold">Synthèse EBIOS RM</h2>
          <p className="text-sm text-muted-foreground">Vue consolidée des 5 ateliers.</p>
        </div>
        <Button onClick={exportPdf}><FileDown className="h-4 w-4 mr-2" />Exporter en PDF</Button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        {[
          ["Valeurs métier", counts.vm],
          ["Événements redoutés", counts.er],
          ["Sources de risque", counts.sr],
          ["Scénarios stratégiques", counts.ss],
          ["Scénarios opérationnels", counts.so],
          ["Mesures de traitement", counts.me],
        ].map(([label, n]) => (
          <Card key={label as string}>
            <CardContent className="pt-6">
              <div className="text-3xl font-bold text-primary">{n}</div>
              <div className="text-sm text-muted-foreground mt-1">{label}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      {state.atelier5.mesures.length > 0 && (
        <Card>
          <CardHeader><CardTitle>Mesures de traitement clé</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {state.atelier5.mesures.slice(0, 10).map((m) => (
              <div key={m.id} className="flex items-center justify-between p-2 rounded border">
                <span className="text-sm">{m.libelle}</span>
                <div className="flex gap-2"><Badge variant="secondary">{m.strategie}</Badge><Badge variant="outline">R {m.risqueResiduel}</Badge></div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
};
