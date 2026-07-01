import { useState, useMemo, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from "@/components/ui/dialog";
import { AlertTriangle, FileText, Bold, Italic, List, Heading, Save, History, Upload, Loader2 } from "lucide-react";
import { useGovernance } from "@/contexts/GovernanceContext";
import { useRole } from "@/contexts/RoleContext";
import { type PolicyVersion } from "@/data/governance";
import { toast } from "sonner";
import * as pdfjsLib from 'pdfjs-dist';

pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/build/pdf.worker.min.js`;

const Toolbar = ({ exec }: { exec: (cmd: string, val?: string) => void }) => (
  <div className="flex flex-wrap gap-1 border border-border rounded-t-md p-1.5 bg-secondary/40">
    <Button type="button" variant="ghost" size="sm" onClick={() => exec("bold")}><Bold className="h-3.5 w-3.5" /></Button>
    <Button type="button" variant="ghost" size="sm" onClick={() => exec("italic")}><Italic className="h-3.5 w-3.5" /></Button>
    <Button type="button" variant="ghost" size="sm" onClick={() => exec("formatBlock", "h2")}><Heading className="h-3.5 w-3.5" /> H2</Button>
    <Button type="button" variant="ghost" size="sm" onClick={() => exec("formatBlock", "h3")}><Heading className="h-3.5 w-3.5" /> H3</Button>
    <Button type="button" variant="ghost" size="sm" onClick={() => exec("insertUnorderedList")}><List className="h-3.5 w-3.5" /></Button>
  </div>
);

export const PolicyEditor = () => {
  const { policies, setPolicies } = useGovernance();
  const { can } = useRole();
  const current = policies[0];
  const [editing, setEditing] = useState<string | null>(null);
  const [meta, setMeta] = useState({ version: "", signatory: "", scope: "", nextRevision: "" });
  const [open, setOpen] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const ageMonths = useMemo(() => {
    if (!current) return 0;
    const d = new Date(current.approvalDate);
    return (Date.now() - d.getTime()) / (1000 * 60 * 60 * 24 * 30);
  }, [current]);
  const isOld = ageMonths > 12;

  const exec = (cmd: string, val?: string) => document.execCommand(cmd, false, val);

  // ✅ Fonction d'import PDF
  const handlePdfImport = async (file: File) => {
    setIsImporting(true);
    try {
      console.log("🔵 Import PDF Politique:", file.name);
      
      // Lire le PDF
      const arrayBuffer = await file.arrayBuffer();
      const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
      
      // Extraire le texte de toutes les pages
      let fullText = "";
      for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
        const page = await pdf.getPage(pageNum);
        const textContent = await page.getTextContent();
        const pageText = textContent.items.map((item: any) => item.str).join(' ');
        fullText += pageText + '\n';
      }
      
      console.log("📄 Texte extrait:", fullText.substring(0, 500));
      
      // 🔍 Analyser le texte pour extraire les informations
      const extracted = extractPolicyInfo(fullText);
      console.log("📋 Informations extraites:", extracted);
      
      // Pré-remplir le formulaire avec les données extraites
      setMeta({
        version: extracted.version || "1.0",
        signatory: extracted.signatory || "",
        scope: extracted.scope || "Toutes les entités du groupe",
        nextRevision: extracted.nextRevision || new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
      });
      
      // Convertir le texte en HTML (gérer les retours à la ligne)
      const htmlContent = extracted.content
        .split('\n')
        .filter(line => line.trim())
        .map(line => {
          // Détecter les titres (lignes en majuscules ou avec des numéros)
          if (line.toUpperCase() === line.trim() && line.length > 5) {
            return `<h3>${line.trim()}</h3>`;
          }
          if (line.match(/^\d+\./)) {
            return `<p><strong>${line.trim()}</strong></p>`;
          }
          return `<p>${line.trim()}</p>`;
        })
        .join('');
      
      setEditing(htmlContent);
      
      // Ouvrir le dialog
      setOpen(true);
      toast.success("📄 PDF importé avec succès !");
      
    } catch (error: any) {
      console.error("🔴 Erreur import PDF:", error);
      toast.error("Erreur lors de l'import du PDF: " + error.message);
    } finally {
      setIsImporting(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  // 🔍 Fonction d'extraction des informations du texte
  const extractPolicyInfo = (text: string) => {
    const lines = text.split('\n').filter(line => line.trim());
    let version = "1.0";
    let signatory = "";
    let scope = "";
    let nextRevision = "";
    let content = text;
    
    // Chercher la version
    const versionMatch = text.match(/[Vv]ersion\s*[:]?\s*([\d.]+)/);
    if (versionMatch) version = versionMatch[1];
    
    // Chercher le signataire
    const signatoryMatch = text.match(/Signataire\s*[:]?\s*([^\n]+)/i);
    if (signatoryMatch) signatory = signatoryMatch[1].trim();
    
    // Chercher le périmètre
    const scopeMatch = text.match(/P[ée]rim[èe]tre\s*[:]?\s*([^\n]+)/i);
    if (scopeMatch) scope = scopeMatch[1].trim();
    
    // Chercher la prochaine révision
    const revisionMatch = text.match(/Prochaine\s*r[ée]vision\s*[:]?\s*([\d-]+)/i);
    if (revisionMatch) nextRevision = revisionMatch[1].trim();
    
    // Nettoyer le contenu (enlever les métadonnées)
    let cleanContent = text;
    const linesToRemove = ['Version', 'Signataire', 'Périmètre', 'Date', 'Révision'];
    for (const word of linesToRemove) {
      cleanContent = cleanContent.replace(new RegExp(`${word}\\s*[:]?\\s*[^\n]+`, 'gi'), '');
    }
    cleanContent = cleanContent.replace(/[|]{2,}/g, '').replace(/[-]{3,}/g, '');
    cleanContent = cleanContent.replace(/Activer Windows.*$/s, '').trim();
    
    return {
      version,
      signatory,
      scope: scope || "Toutes les entités du groupe",
      nextRevision,
      content: cleanContent || text,
    };
  };

  const startNewVersion = () => {
    if (!can("write")) { toast.error("Permissions insuffisantes"); return; }
    setEditing(current?.content || "");
    const major = parseFloat(current?.version || "1.0");
    setMeta({
      version: (major + 0.1).toFixed(1),
      signatory: "",
      scope: current?.scope || "",
      nextRevision: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
    });
    setOpen(true);
  };

  const saveVersion = () => {
    if (!meta.version || !meta.signatory) { toast.error("Version et signataire obligatoires"); return; }
    const editor = document.getElementById("policy-editor") as HTMLDivElement | null;
    const newPolicy: PolicyVersion = {
      id: `p${Date.now()}`,
      version: meta.version,
      approvalDate: new Date().toISOString().slice(0, 10),
      signatory: meta.signatory,
      scope: meta.scope || "Toutes les entités du groupe",
      nextRevision: meta.nextRevision || new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
      content: editor?.innerHTML || editing || "",
    };
    setPolicies([newPolicy, ...policies]);
    setOpen(false);
    setEditing(null);
    toast.success("Nouvelle version enregistrée");
  };

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-3xl font-bold">Politique PCA</h1>
          <p className="text-muted-foreground mt-1">Édition et gestion de versions du document</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {can("write") && (
            <>
              <Button variant="outline" onClick={() => fileInputRef.current?.click()} disabled={isImporting}>
                {isImporting ? (
                  <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                ) : (
                  <Upload className="h-4 w-4 mr-1" />
                )}
                Importer PDF
              </Button>
              <input
                ref={fileInputRef}
                type="file"
                accept=".pdf"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) handlePdfImport(file);
                }}
                className="hidden"
              />
              <Button onClick={startNewVersion}>
                <FileText className="h-4 w-4 mr-1" /> Nouvelle version
              </Button>
            </>
          )}
        </div>
      </div>

      {isOld && (
        <Card className="border-destructive/40 bg-destructive/5">
          <CardContent className="flex items-center gap-3 py-4">
            <AlertTriangle className="h-5 w-5 text-destructive" />
            <div>
              <p className="font-semibold text-destructive">Politique obsolète</p>
              <p className="text-sm text-muted-foreground">La politique en vigueur a plus de 12 mois ({Math.floor(ageMonths)} mois). Une révision est requise.</p>
            </div>
          </CardContent>
        </Card>
      )}

      {current && (
        <Card>
          <CardHeader>
            <div className="flex items-start justify-between flex-wrap gap-4">
              <div>
                <CardTitle>Version en vigueur — v{current.version}</CardTitle>
                <CardDescription>Approuvée le {current.approvalDate} · Prochaine révision : {current.nextRevision}</CardDescription>
              </div>
              <Badge className="bg-success text-success-foreground">Active</Badge>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid md:grid-cols-3 gap-4 mb-4 text-sm">
              <div><p className="text-muted-foreground text-xs">Signataire</p><p className="font-medium">{current.signatory}</p></div>
              <div><p className="text-muted-foreground text-xs">Périmètre</p><p className="font-medium">{current.scope}</p></div>
              <div><p className="text-muted-foreground text-xs">Date d'approbation</p><p className="font-medium">{current.approvalDate}</p></div>
            </div>
            <div className="prose prose-sm max-w-none p-4 bg-secondary/30 rounded-md border border-border" dangerouslySetInnerHTML={{ __html: current.content }} />
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader><CardTitle className="flex items-center gap-2"><History className="h-4 w-4 text-primary" /> Historique des versions</CardTitle></CardHeader>
        <CardContent className="space-y-2">
          {policies.map((p, i) => (
            <div key={p.id} className="flex items-center justify-between p-3 border border-border rounded-md text-sm">
              <div className="flex items-center gap-3">
                <Badge variant={i === 0 ? "default" : "secondary"}>v{p.version}</Badge>
                <div>
                  <p className="font-medium">{p.signatory}</p>
                  <p className="text-xs text-muted-foreground">Approuvée le {p.approvalDate} · {p.scope}</p>
                </div>
              </div>
              <span className="text-xs text-muted-foreground">Révision : {p.nextRevision}</span>
            </div>
          ))}
        </CardContent>
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-3xl">
          <DialogHeader><DialogTitle>Nouvelle version de la politique</DialogTitle></DialogHeader>
          <div className="grid gap-3">
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Version *</Label><Input value={meta.version} onChange={(e) => setMeta({ ...meta, version: e.target.value })} /></div>
              <div><Label>Prochaine révision</Label><Input type="date" value={meta.nextRevision} onChange={(e) => setMeta({ ...meta, nextRevision: e.target.value })} /></div>
            </div>
            <div><Label>Signataire *</Label><Input value={meta.signatory} onChange={(e) => setMeta({ ...meta, signatory: e.target.value })} placeholder="Nom et fonction" /></div>
            <div><Label>Périmètre</Label><Input value={meta.scope} onChange={(e) => setMeta({ ...meta, scope: e.target.value })} /></div>
            <div>
              <Label>Contenu</Label>
              <Toolbar exec={exec} />
              <div
                id="policy-editor"
                contentEditable
                suppressContentEditableWarning
                className="min-h-[260px] p-4 border border-border border-t-0 rounded-b-md focus:outline-none focus:ring-2 focus:ring-ring prose prose-sm max-w-none"
                dangerouslySetInnerHTML={{ __html: editing || "" }}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Annuler</Button>
            <Button onClick={saveVersion}><Save className="h-4 w-4 mr-1" /> Enregistrer</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};