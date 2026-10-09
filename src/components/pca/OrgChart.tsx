// src/components/governance/OrgChart.tsx
import { useState, useMemo } from "react";
import { supabase as functionsClient } from "@/integrations/resillia/client";
import {
  ChevronDown, ChevronRight, Plus, Building2, Trash2, Pencil, Save, X,
  ExternalLink, FileText, Loader2, PlusCircle, Landmark, Layers,
  Network, Target, TrendingUp, Search, CheckCircle2, AlertTriangle,
  Upload, CheckCircle, Sparkles, Wand2,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useGovernance } from "@/contexts/GovernanceContext";
import { useRole } from "@/contexts/RoleContext";
import { useBia } from "@/contexts/BiaContext";
import { computeMaxScore, scoreToCriticality, criticalityColor } from "@/data/bia";
import { type Entity, type EntityType } from "@/data/governance";
import { supabase } from "@/integrations/supabase/db";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import * as XLSX from 'xlsx';
import * as pdfjsLib from 'pdfjs-dist';
import Tesseract from 'tesseract.js';
import jsPDF from 'jspdf';

pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/build/pdf.worker.min.js`;

const ENTITY_TYPES_FILTERED = ["FILIALE", "DIRECTION", "SERVICE", "DÉPARTEMENT"];

const isLowLevel = (type?: string) => {
  const normalized = (type || "").toUpperCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  return ["SERVICE", "DEPARTEMENT"].includes(normalized);
};

const isDirection = (type?: string) => {
  const normalized = (type || "").toUpperCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  return normalized === "DIRECTION";
};

const isFiliale = (type?: string) => {
  const normalized = (type || "").toUpperCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  return normalized === "FILIALE";
};

const validateHierarchy = (type: string, parentId: string | null, entities: Entity[]): { valid: boolean; error?: string } => {
  const normalizedType = type.toUpperCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  if (normalizedType === "FILIALE") {
    if (parentId) return { valid: false, error: "Une filiale ne peut pas avoir d'entité parente" };
    return { valid: true };
  }
  if (normalizedType === "DIRECTION") {
    if (!parentId) return { valid: false, error: "Une direction doit avoir une filiale parente" };
    const parent = entities.find(e => e.id === parentId);
    if (!parent) return { valid: false, error: "L'entité parente n'existe pas" };
    if (!isFiliale(parent.type)) return { valid: false, error: "Une direction doit être rattachée à une filiale" };
    return { valid: true };
  }
  if (["SERVICE", "DEPARTEMENT"].includes(normalizedType)) {
    if (!parentId) return { valid: false, error: "Un service/département doit avoir une direction parente" };
    const parent = entities.find(e => e.id === parentId);
    if (!parent) return { valid: false, error: "L'entité parente n'existe pas" };
    if (!isDirection(parent.type)) return { valid: false, error: "Un service/département doit être rattaché à une direction" };
    return { valid: true };
  }
  return { valid: false, error: "Type d'entité invalide" };
};

const getChildren = (entities: Entity[], parentId: string) => entities.filter(e => e.parentId === parentId);

const getEntityProcesses = (entity: Entity, allProcesses: any[]) => allProcesses.filter(p => p.entityId === entity.id);

const buildTree = (entities: Entity[], parentId: string | null = null): Entity[] =>
  entities.filter((e) => e.parentId === parentId).map((e) => ({ ...e, children: buildTree(entities, e.id) }));

const normalizeCriticite = (raw: string | null): string | null => {
  if (!raw) return null;
  const n = raw.toUpperCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
  if (n === "CRITIQUE" || n === "TRES SEVERE" || n === "SEVERE" || n === "ELEVE" || n === "HAUT" || n === "HAUTE") return "CRITIQUE";
  if (n === "MAJEUR") return "MAJEUR";
  if (n === "MODERE" || n === "MOYEN" || n === "MOYENNE") return "MODERE";
  if (n === "MINEUR" || n === "FAIBLE" || n === "BAS") return "MINEUR";
  return "MINEUR";
};

const normalizeProcessStatus = (raw: string | null): string => {
  if (!raw) return "ACTIF";
  const n = raw.toUpperCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
  if (n === "ACTIF" || n === "ACTIVE" || n === "EN COURS") return "ACTIF";
  if (n === "INACTIF" || n === "INACTIVE" || n === "DESACTIVE") return "INACTIF";
  if (n === "EN_REVISION" || n === "EN REVISION" || n === "REVISION" || n === "A REVISER") return "EN_REVISION";
  return "ACTIF";
};

const COLUMN_PATTERNS = {
  name: ['nom', 'name', 'libelle', 'libellé', 'intitulé', 'intitule', 'entité', 'entite'],
  type: ['type', 'niveau', 'nature', 'categorie', 'catégorie'],
  parent: ['parent', 'mère', 'mere', 'rattach', 'supérieur', 'superieur', 'hiérarchie', 'hierarchie'],
  referent: ['référent', 'referent', 'responsable pca', 'responsable_pca', 'pilote pca', 'owner'],
  country: ['pays', 'country', 'zone', 'région', 'region'],
  processName: ['processus', 'process', 'activité', 'activite', 'procédure', 'procedure'],
  processOwner: ['responsable processus', 'responsable du processus', 'process owner', 'responsable process'],
  rto: ['rto', 'délai', 'delai', 'reprise'],
  rpo: ['rpo', 'perte'],
  criticality: ['criticité', 'criticite', 'criticality', 'sévérité', 'severite'],
};

const detectColumn = (headers: string[], key: keyof typeof COLUMN_PATTERNS): string | null => {
  const patterns = COLUMN_PATTERNS[key];
  for (const header of headers) {
    const normalized = header.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
    for (const pattern of patterns) {
      const normPattern = pattern.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
      if (normalized === normPattern || normalized.includes(normPattern)) {
        return header;
      }
    }
  }
  return null;
};

const detectAllColumns = (headers: string[]) => {
  return {
    name: detectColumn(headers, 'name'),
    type: detectColumn(headers, 'type'),
    parent: detectColumn(headers, 'parent'),
    referent: detectColumn(headers, 'referent'),
    country: detectColumn(headers, 'country'),
    processName: detectColumn(headers, 'processName'),
    processOwner: detectColumn(headers, 'processOwner'),
    rto: detectColumn(headers, 'rto'),
    rpo: detectColumn(headers, 'rpo'),
    criticality: detectColumn(headers, 'criticality'),
  };
};

type ParsedEntity = {
  name: string;
  type: string;
  parentName: string | null;
  referent: string;
  country: string;
  rowIndex: number;
  isValid: boolean;
  error?: string;
};

type ParsedProcess = {
  name: string;
  entityName: string;
  owner: string | null;
  rto: number | null;
  rpo: number | null;
  criticality: string | null;
  rowIndex: number;
  isValid: boolean;
  error?: string;
};

type AIAnalysis = {
  summary: string;
  hierarchyDepth: number;
  entities: { name: string; type: string; parentName: string | null; referent: string | null }[];
  processes: { name: string; entityName: string; owner: string | null; rto: number | null; rpo: number | null; criticality: string | null }[];
  warnings: string[];
  model?: string;
};

const ImportExcelDialog = ({
  open,
  onOpenChange,
  entities,
  onImported,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  entities: Entity[];
  onImported: () => void;
}) => {
  const [step, setStep] = useState<1 | 2>(1);
  const [file, setFile] = useState<File | null>(null);
  const [detectedColumns, setDetectedColumns] = useState<any>(null);
  const [aiAnalysis, setAiAnalysis] = useState<AIAnalysis | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const [parsedEntities, setParsedEntities] = useState<ParsedEntity[]>([]);
  const [parsedProcesses, setParsedProcesses] = useState<ParsedProcess[]>([]);
  const [detectedNewEntities, setDetectedNewEntities] = useState<string[]>([]);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<{ entities: number; processes: number; errors: string[] } | null>(null);

  const reset = () => {
    setStep(1); setFile(null); setDetectedColumns(null);
    setAiAnalysis(null); setAiError(null); setAiLoading(false);
    setParsedEntities([]); setParsedProcesses([]);
    setDetectedNewEntities([]); setImportResult(null);
  };

  const processFile = async (f: File) => {
    setFile(f);
    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array' });
        const sheet = workbook.Sheets[workbook.SheetNames[0]];
        const jsonData: any[] = XLSX.utils.sheet_to_json(sheet, { defval: '' });

        if (jsonData.length === 0) {
          toast.error("Le fichier est vide");
          return;
        }

        const normalized = jsonData.map((row) => {
          const out: any = {};
          for (const [k, v] of Object.entries(row)) {
            out[k.toString().trim()] = typeof v === 'string' ? v.trim() : v;
          }
          return out;
        });

        const headers = Object.keys(normalized[0] || {});
        const detected = detectAllColumns(headers);
        setDetectedColumns(detected);

        await analyzeWithAI(normalized, headers, f.name, detected);
        setStep(2);
      } catch (err: any) {
        toast.error("Erreur lecture Excel : " + err.message);
      }
    };
    reader.readAsArrayBuffer(f);
  };

  const analyzeWithAI = async (rows: any[], headers: string[], fileName: string, fallbackDetected: any) => {
    setAiLoading(true);
    setAiError(null);
    setAiAnalysis(null);

    try {
      const { data, error } = await functionsClient.functions.invoke("groq-import-taxonomy", {
        body: { rows, headers, fileName },
      });

      if (error) throw new Error(error.message || "Erreur Edge Function");
      if (!data || !data.success) throw new Error(data?.error || "Réponse invalide");

      const analysis: AIAnalysis = {
        summary: data.summary || "Analyse terminée.",
        hierarchyDepth: data.hierarchyDepth || 3,
        entities: data.entities || [],
        processes: data.processes || [],
        warnings: data.warnings || [],
        model: data.model,
      };
      setAiAnalysis(analysis);

      const newEntities: ParsedEntity[] = analysis.entities.map((e, i) => ({
        name: e.name,
        type: e.type,
        parentName: e.parentName,
        referent: e.referent || "",
        country: "FR",
        rowIndex: i + 1,
        isValid: true,
      }));

      const entityNameSet = new Set(newEntities.map(e => e.name.toLowerCase()));
      const newProcesses: ParsedProcess[] = analysis.processes.map((p, i) => {
        const valid = entityNameSet.has((p.entityName || "").toLowerCase());
        return {
          name: p.name,
          entityName: p.entityName,
          owner: p.owner,
          rto: p.rto,
          rpo: p.rpo,
          criticality: p.criticality,
          rowIndex: i + 1,
          isValid: valid,
          error: valid ? undefined : `Entité "${p.entityName}" non trouvée dans l'analyse`,
        };
      });

      const existingNames = new Set(entities.map(e => e.name.toLowerCase()));
      const newEntityNames = newEntities
        .filter(e => !existingNames.has(e.name.toLowerCase()))
        .map(e => e.name);

      setParsedEntities(newEntities);
      setParsedProcesses(newProcesses);
      setDetectedNewEntities(newEntityNames);
      toast.success(`✨ IA : ${analysis.entities.length} entités, ${analysis.processes.length} processus détectés`);
    } catch (err: any) {
      console.warn("Fallback sur pattern-matching:", err);
      setAiError(err.message || "Erreur IA");
      analyzeDataFallback(rows, fallbackDetected);
      toast.warning("⚠️ IA indisponible — mode secours activé");
    } finally {
      setAiLoading(false);
    }
  };

  const analyzeDataFallback = (data: any[], cols: any) => {
    const newEntities: ParsedEntity[] = [];
    const newProcesses: ParsedProcess[] = [];

    const getValue = (row: any, col: string | null) => {
      if (!col) return '';
      const val = row[col];
      return val !== undefined && val !== null ? String(val).trim() : '';
    };

    data.forEach((row, idx) => {
      const rowIndex = idx + 2;
      const name = getValue(row, cols.name);
      const type = getValue(row, cols.type).toUpperCase();
      const parentName = getValue(row, cols.parent) || null;
      const referent = getValue(row, cols.referent);
      const country = getValue(row, cols.country) || 'FR';
      const processName = getValue(row, cols.processName);
      const processOwner = getValue(row, cols.processOwner) || null;
      const rtoRaw = getValue(row, cols.rto);
      const rpoRaw = getValue(row, cols.rpo);
      const criticality = getValue(row, cols.criticality) || null;

      if (name && type && ENTITY_TYPES_FILTERED.includes(type)) {
        const entityParent = parentName;
        const isValidParent = !entityParent || entities.some(e => e.name.toLowerCase() === entityParent.toLowerCase())
          || data.some(r => getValue(r, cols.name).toLowerCase() === entityParent.toLowerCase());
        newEntities.push({
          name, type, parentName: entityParent, referent, country, rowIndex,
          isValid: isValidParent,
          error: isValidParent ? undefined : `Entité parente "${entityParent}" introuvable`,
        });
      } else if (processName) {
        const entityName = name;
        const isValidEntity = entityName && (
          entities.some(e => e.name.toLowerCase() === entityName.toLowerCase())
          || data.some(r => getValue(r, cols.name).toLowerCase() === entityName.toLowerCase())
        );
        const rto = rtoRaw ? parseFloat(rtoRaw.replace(',', '.')) : null;
        const rpo = rpoRaw ? parseFloat(rpoRaw.replace(',', '.')) : null;
        newProcesses.push({
          name: processName, entityName: entityName || '', owner: processOwner,
          rto: isNaN(rto as number) ? null : rto, rpo: isNaN(rpo as number) ? null : rpo,
          criticality, rowIndex,
          isValid: !!isValidEntity,
          error: !entityName ? 'Entité manquante' : !isValidEntity ? `Entité "${entityName}" introuvable` : undefined,
        });
      }
    });

    const existingNames = new Set(entities.map(e => e.name.toLowerCase()));
    const newEntityNames = newEntities
      .filter(e => !existingNames.has(e.name.toLowerCase()))
      .map(e => e.name);

    setParsedEntities(newEntities);
    setParsedProcesses(newProcesses);
    setDetectedNewEntities(newEntityNames);
  };

  // ============================================================
  // IMPORT : exécution robuste + hiérarchie stricte
  // ============================================================
  const executeImport = async () => {
    setImporting(true);
    const errors: string[] = [];
    let entitiesCount = 0;
    let processesCount = 0;

    const norm = (s: string) => (s || "").trim().toLowerCase().replace(/\s+/g, ' ');

    try {
      // ---- 1. ENTITÉS : tri STRICT ----
      const rankType = (t: string): number => {
        const n = (t || "").toUpperCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
        if (n === "FILIALE") return 1;
        if (n === "DIRECTION") return 2;
        if (n === "SERVICE" || n === "DEPARTEMENT") return 3;
        return 4;
      };

      const entitiesToCreate = parsedEntities.filter(e => e.isValid);
      const sortedEntities = [...entitiesToCreate].sort(
        (a, b) => rankType(a.type) - rankType(b.type)
      );

      const createdEntityMap = new Map<string, string>();
      for (const e of entities) {
        createdEntityMap.set(norm(e.name), e.id);
      }

      // Suivi du type réel par id (pour valider côté processus)
      const entityTypeById = new Map<string, string>();

      for (const e of sortedEntities) {
        const key = norm(e.name);
        if (createdEntityMap.has(key)) {
          // déjà existant → on stocke son type
          const existingId = createdEntityMap.get(key)!;
          entityTypeById.set(existingId, (e.type || "").toUpperCase().normalize("NFD").replace(/[\u0300-\u036f]/g, ""));
          continue;
        }

        const typeNorm = (e.type || "").toUpperCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");

        let parentId: string | null = null;
        if (e.parentName) {
          parentId = createdEntityMap.get(norm(e.parentName)) || null;
        }

        // ✅ CONTRÔLE SERVICE/DÉPARTEMENT
        if (["SERVICE", "DEPARTEMENT"].includes(typeNorm)) {
          if (!parentId) {
            errors.push(`Entité "${e.name}" (${e.type}) ignorée : parent "${e.parentName || "—"}" introuvable ou non inséré avant.`);
            continue;
          }
          const parentType = entityTypeById.get(parentId);
          if (parentType && parentType !== "DIRECTION") {
            errors.push(`Entité "${e.name}" (${e.type}) ignorée : son parent "${e.parentName}" n'est pas une DIRECTION (type : ${parentType}).`);
            continue;
          }
        }

        // ✅ CONTRÔLE DIRECTION
        if (typeNorm === "DIRECTION") {
          if (!parentId) {
            errors.push(`Direction "${e.name}" ignorée : parent "${e.parentName || "—"}" introuvable.`);
            continue;
          }
          const parentType = entityTypeById.get(parentId);
          if (parentType && parentType !== "FILIALE") {
            errors.push(`Direction "${e.name}" ignorée : son parent "${e.parentName}" n'est pas une FILIALE (type : ${parentType}).`);
            continue;
          }
        }

        // ✅ FILIALE sans parent
        if (typeNorm === "FILIALE" && parentId) {
          errors.push(`Filiale "${e.name}" : parent ignoré (une filiale est toujours racine).`);
          parentId = null;
        }

        let normalizedType = typeNorm;
        if (normalizedType === "DEPARTEMENT") normalizedType = "DÉPARTEMENT";
        if (!["FILIALE", "DIRECTION", "SERVICE", "DÉPARTEMENT"].includes(normalizedType)) {
          normalizedType = "SERVICE";
        }

        const { data, error } = await (supabase as any).from('organisations').insert({
          name: e.name,
          type: normalizedType,
          country_code: e.country || 'FR',
          parent_id: parentId,
          pca_referent: e.referent || '—',
          pca_status: 'Non démarré',
          sector: 'Général',
          status: 'ACTIVE',
        }).select().single();

        if (error) {
          errors.push(`Entité "${e.name}": ${error.message}`);
        } else {
          createdEntityMap.set(key, data.id);
          entityTypeById.set(data.id, normalizedType);
          entitiesCount++;
        }
      }

      // Ajouter aussi les types des entités déjà en base
      for (const e of entities) {
        const t = (e.type || "").toUpperCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
        entityTypeById.set(e.id, t);
      }

      // ---- 2. PROCESSUS ----
      const existingProcessesByEntity: Record<string, Set<string>> = {};
      const { data: existingProcesses } = await (supabase as any)
        .from('processus_metier')
        .select('name, entity_id');

      if (existingProcesses) {
        for (const p of existingProcesses) {
          if (!existingProcessesByEntity[p.entity_id]) existingProcessesByEntity[p.entity_id] = new Set();
          existingProcessesByEntity[p.entity_id].add(norm(p.name));
        }
      }

      for (const p of parsedProcesses.filter(p => p.isValid)) {
        const entityId = createdEntityMap.get(norm(p.entityName));
        if (!entityId) {
          errors.push(`Processus "${p.name}": entité "${p.entityName}" introuvable.`);
          continue;
        }

        // ⚠️ INTERDIRE un processus sur une FILIALE
        const entityType = entityTypeById.get(entityId) || "";
        if (entityType === "FILIALE") {
          errors.push(
            `Processus "${p.name}" ignoré : accroché à la filiale "${p.entityName}". ` +
            `Un processus doit toujours être porté par une direction ou un service.`
          );
          continue;
        }

        if (!existingProcessesByEntity[entityId]) existingProcessesByEntity[entityId] = new Set();
        const pKey = norm(p.name);
        if (existingProcessesByEntity[entityId].has(pKey)) {
          errors.push(`Processus "${p.name}": existe déjà dans cette entité.`);
          continue;
        }

        const entityName = entities.find(x => x.id === entityId)?.name
          || parsedEntities.find(e => norm(e.name) === norm(p.entityName))?.name
          || p.entityName;

        const { error } = await (supabase as any).from('processus_metier').insert({
          name: p.name,
          entity_id: entityId,
          direction: entityName,
          owner: p.owner,
          description: null,
          criticality_level: normalizeCriticite(p.criticality),
          rto_hours: p.rto,
          rpo_hours: p.rpo,
          mtpd_hours: null,
          mbco_percent: null,
          status: normalizeProcessStatus('ACTIF'),
          impacts: {},
          depends_on: [],
          resources: [],
          apps_critiques: [],
        });

        if (error) {
          errors.push(`Processus "${p.name}": ${error.message}`);
        } else {
          processesCount++;
          existingProcessesByEntity[entityId].add(pKey);
        }
      }

      setImportResult({ entities: entitiesCount, processes: processesCount, errors });

      if (typeof window !== "undefined") {
        window.dispatchEvent(new CustomEvent("bia:refresh", {
          detail: { reason: "import", entitiesCount, processesCount, timestamp: Date.now() }
        }));
      }

      onImported();

      if (errors.length === 0) {
        toast.success(`✅ ${entitiesCount} entités et ${processesCount} processus importés`);
      } else {
        toast.warning(`${entitiesCount} entités, ${processesCount} processus · ${errors.length} erreur(s)`);
      }
    } catch (err: any) {
      setImportResult({ entities: entitiesCount, processes: processesCount, errors: [err.message] });
      toast.error("Erreur import : " + err.message);
    }
    setImporting(false);
  };

  const totalValid = parsedEntities.filter(e => e.isValid).length + parsedProcesses.filter(p => p.isValid).length;
  const totalErrors = parsedEntities.filter(e => !e.isValid).length + parsedProcesses.filter(p => !p.isValid).length;

  const aiFilialesCount = parsedEntities.filter(e => isFiliale(e.type)).length;
  const aiDirectionsCount = parsedEntities.filter(e => isDirection(e.type)).length;
  const aiServicesCount = parsedEntities.filter(e => isLowLevel(e.type)).length;

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o && !importing) reset(); onOpenChange(o); }}>
      <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Wand2 className="h-5 w-5 text-[#2A5141]" />
            Import Excel
            {aiAnalysis && (
              <Badge className="bg-[#2A5141] text-white border-0 text-[9px] font-bold uppercase tracking-wider ml-1">
                <Sparkles className="h-2.5 w-2.5 mr-0.5" /> IA
              </Badge>
            )}
          </DialogTitle>
          <DialogDescription>
            {step === 1 && "L'IA analyse votre fichier et reconstruit la structure automatiquement"}
            {step === 2 && "Vérifiez ce que l'IA a compris avant d'importer"}
          </DialogDescription>
        </DialogHeader>

        {step === 1 && (
          <div className="space-y-4 py-4">
            <div
              className="border-2 border-dashed border-[#2A5141]/30 rounded-xl p-10 text-center hover:border-[#2A5141] hover:bg-[#2A5141]/[0.02] transition-all cursor-pointer group"
              onClick={() => document.getElementById('generic-file-input')?.click()}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f) processFile(f); }}
            >
              <input id="generic-file-input" type="file" accept=".xlsx,.xls,.csv" className="hidden"
                onChange={(e) => { const f = e.target.files?.[0]; if (f) processFile(f); }} />
              <div className="flex flex-col items-center gap-3">
                <div className="h-16 w-16 rounded-full bg-[#2A5141]/10 flex items-center justify-center group-hover:scale-110 transition-transform">
                  {aiLoading
                    ? <Loader2 className="h-8 w-8 text-[#2A5141] animate-spin" />
                    : <Upload className="h-8 w-8 text-[#2A5141]" />}
                </div>
                <div>
                  <p className="text-base font-semibold text-[#172030]">
                    {aiLoading ? "Analyse par l'IA en cours..." : "Déposez votre fichier Excel"}
                  </p>
                  <p className="text-sm text-gray-500 mt-1">
                    {aiLoading
                      ? "L'IA lit votre fichier et reconstruit la structure"
                      : "N'importe quelle structure — l'IA s'adapte"}
                  </p>
                </div>
                <div className="flex items-center gap-2 text-xs text-gray-400 mt-2">
                  <span className="px-2 py-1 rounded bg-gray-100">.xlsx</span>
                  <span className="px-2 py-1 rounded bg-gray-100">.xls</span>
                  <span className="px-2 py-1 rounded bg-gray-100">.csv</span>
                </div>
              </div>
            </div>

            <div className="p-4 bg-gradient-to-r from-[#2A5141]/5 to-transparent border border-[#2A5141]/20 rounded-lg">
              <div className="flex items-start gap-3">
                <div className="h-8 w-8 rounded-lg bg-[#2A5141]/15 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <Sparkles className="h-4 w-4 text-[#2A5141]" />
                </div>
                <div className="flex-1">
                  <p className="text-sm font-semibold text-[#172030] mb-2">Analyse IA — comment ça marche ?</p>
                  <ul className="text-xs text-gray-600 space-y-1">
                    <li>• L'IA <strong>lit le fichier entier</strong> et comprend sa structure</li>
                    <li>• Elle détecte la hiérarchie même si elle est encodée en plusieurs colonnes</li>
                    <li>• Elle identifie les entités ET les processus métier</li>
                    <li>• Les processus sont toujours rattachés à une direction ou un service (jamais une filiale)</li>
                    <li>• En cas d'échec IA, un fallback automatique prend le relais</li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-4 py-4">
            {aiAnalysis && !aiError && (
              <div className="p-4 bg-gradient-to-r from-[#2A5141] to-[#1a3329] text-white rounded-xl shadow-sm">
                <div className="flex items-start gap-3">
                  <div className="h-9 w-9 rounded-lg bg-white/15 flex items-center justify-center flex-shrink-0">
                    <Sparkles className="h-4 w-4 text-white" />
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-semibold mb-1 flex items-center gap-2">
                      Analyse IA réussie
                      {aiAnalysis.model && (
                        <Badge className="bg-white/20 text-white border-0 text-[9px]">{aiAnalysis.model}</Badge>
                      )}
                    </p>
                    <p className="text-xs text-white/80 leading-relaxed">{aiAnalysis.summary}</p>
                    <p className="text-[11px] text-white/60 mt-2">
                      Hiérarchie détectée : <strong className="text-white">{aiAnalysis.hierarchyDepth} niveaux</strong>
                      {" · "}
                      <strong className="text-white">{aiFilialesCount}</strong> filiale{aiFilialesCount > 1 ? "s" : ""}
                      {" · "}
                      <strong className="text-white">{aiDirectionsCount}</strong> direction{aiDirectionsCount > 1 ? "s" : ""}
                      {" · "}
                      <strong className="text-white">{aiServicesCount}</strong> service{aiServicesCount > 1 ? "s" : ""}
                      {" · "}
                      <strong className="text-white">{parsedProcesses.length}</strong> processus
                    </p>
                  </div>
                </div>
              </div>
            )}

            {aiError && (
              <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg">
                <p className="text-sm font-semibold text-amber-800 flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4" />
                  Analyse IA indisponible — mode secours activé
                </p>
                <p className="text-xs text-amber-700 mt-1">Raison : {aiError}.</p>
              </div>
            )}

            {detectedColumns && !aiAnalysis && (
              <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
                <p className="text-sm font-semibold text-blue-800 mb-2 flex items-center gap-2">
                  <CheckCircle className="h-4 w-4" /> Colonnes détectées automatiquement
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {Object.entries(detectedColumns).map(([key, val]) => val && (
                    <span key={key} className="text-xs px-2 py-0.5 rounded bg-white text-blue-700 border border-blue-200">
                      <strong>{key}</strong> → {val as string}
                    </span>
                  ))}
                </div>
              </div>
            )}

            <div className="grid grid-cols-4 gap-3">
              <div className="p-3 rounded-lg bg-[#172030]/5 border border-[#172030]/10">
                <p className="text-xs text-gray-500 mb-1">Entités</p>
                <p className="text-2xl font-bold text-[#172030]">{parsedEntities.length}</p>
              </div>
              <div className="p-3 rounded-lg bg-[#2A5141]/5 border border-[#2A5141]/10">
                <p className="text-xs text-gray-500 mb-1">Processus</p>
                <p className="text-2xl font-bold text-[#2A5141]">{parsedProcesses.length}</p>
              </div>
              <div className="p-3 rounded-lg bg-emerald-50 border border-emerald-200">
                <p className="text-xs text-gray-500 mb-1">À importer</p>
                <p className="text-2xl font-bold text-emerald-600">{totalValid}</p>
              </div>
              <div className="p-3 rounded-lg bg-red-50 border border-red-200">
                <p className="text-xs text-gray-500 mb-1">Erreurs</p>
                <p className="text-2xl font-bold text-red-600">{totalErrors}</p>
              </div>
            </div>

            {aiAnalysis && aiAnalysis.warnings.length > 0 && (
              <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg">
                <p className="text-sm font-semibold text-amber-800 mb-1">⚠️ Points d'attention :</p>
                <ul className="text-xs text-amber-700 space-y-1">
                  {aiAnalysis.warnings.map((w, i) => <li key={i}>• {w}</li>)}
                </ul>
              </div>
            )}

            {detectedNewEntities.length > 0 && (
              <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
                <p className="text-sm font-semibold text-blue-800 flex items-center gap-2 mb-2">
                  <Sparkles className="h-4 w-4" />
                  {detectedNewEntities.length} nouvelle{detectedNewEntities.length > 1 ? "s" : ""} entité{detectedNewEntities.length > 1 ? "s" : ""}
                </p>
                <div className="flex flex-wrap gap-1">
                  {detectedNewEntities.slice(0, 10).map((n, i) => (
                    <span key={i} className="text-xs px-2 py-0.5 rounded-full bg-white text-blue-700 border border-blue-200">{n}</span>
                  ))}
                  {detectedNewEntities.length > 10 && (
                    <span className="text-xs px-2 py-0.5 rounded-full bg-white text-blue-700 border border-blue-200">
                      +{detectedNewEntities.length - 10}
                    </span>
                  )}
                </div>
              </div>
            )}

            {totalErrors > 0 && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-lg max-h-32 overflow-y-auto">
                <p className="text-sm font-semibold text-red-800 mb-2">Erreurs :</p>
                <ul className="text-xs text-red-600 space-y-1">
                  {parsedEntities.filter(e => !e.isValid).map((e, i) => (
                    <li key={`e-${i}`}>• {e.name}: {e.error}</li>
                  ))}
                  {parsedProcesses.filter(p => !p.isValid).map((p, i) => (
                    <li key={`p-${i}`}>• {p.name}: {p.error}</li>
                  ))}
                </ul>
              </div>
            )}

            {parsedEntities.length > 0 && (
              <div>
                <p className="text-sm font-semibold text-[#172030] mb-2 flex items-center gap-2">
                  <Building2 className="h-4 w-4 text-[#172030]" /> Entités ({parsedEntities.length})
                </p>
                <div className="border rounded-lg overflow-x-auto max-h-40 overflow-y-auto">
                  <Table>
                    <TableHeader><TableRow className="bg-gray-50 sticky top-0">
                      <TableHead className="text-xs">Nom</TableHead>
                      <TableHead className="text-xs">Type</TableHead>
                      <TableHead className="text-xs">Parent</TableHead>
                      <TableHead className="text-xs w-16">OK</TableHead>
                    </TableRow></TableHeader>
                    <TableBody>
                      {parsedEntities.slice(0, 30).map((e, i) => (
                        <TableRow key={i} className={!e.isValid ? "bg-red-50/50" : ""}>
                          <TableCell className="text-xs font-medium">{e.name}</TableCell>
                          <TableCell className="text-xs"><Badge variant="outline" className="text-[10px]">{e.type}</Badge></TableCell>
                          <TableCell className="text-xs text-gray-500">{e.parentName || "Racine"}</TableCell>
                          <TableCell>{e.isValid ? <CheckCircle2 className="h-4 w-4 text-emerald-500" /> : <AlertTriangle className="h-4 w-4 text-red-500" />}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </div>
            )}

            {parsedProcesses.length > 0 && (
              <div>
                <p className="text-sm font-semibold text-[#172030] mb-2 flex items-center gap-2">
                  <Target className="h-4 w-4 text-[#2A5141]" /> Processus ({parsedProcesses.length})
                </p>
                <div className="border rounded-lg overflow-x-auto max-h-40 overflow-y-auto">
                  <Table>
                    <TableHeader><TableRow className="bg-gray-50 sticky top-0">
                      <TableHead className="text-xs">Processus</TableHead>
                      <TableHead className="text-xs">Entité</TableHead>
                      <TableHead className="text-xs">RTO</TableHead>
                      <TableHead className="text-xs">RPO</TableHead>
                      <TableHead className="text-xs w-16">OK</TableHead>
                    </TableRow></TableHeader>
                    <TableBody>
                      {parsedProcesses.slice(0, 30).map((p, i) => (
                        <TableRow key={i} className={!p.isValid ? "bg-red-50/50" : ""}>
                          <TableCell className="text-xs font-medium">{p.name}</TableCell>
                          <TableCell className="text-xs text-gray-500">{p.entityName}</TableCell>
                          <TableCell className="text-xs font-mono">{p.rto ?? "—"}</TableCell>
                          <TableCell className="text-xs font-mono">{p.rpo ?? "—"}</TableCell>
                          <TableCell>{p.isValid ? <CheckCircle2 className="h-4 w-4 text-emerald-500" /> : <AlertTriangle className="h-4 w-4 text-red-500" />}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </div>
            )}

            {importResult && (
              <div className={cn("rounded-lg p-4", importResult.errors.length > 0 ? 'bg-orange-50 border border-orange-200' : 'bg-green-50 border border-green-200')}>
                <p className="text-sm font-semibold">✅ {importResult.entities} entités et {importResult.processes} processus importés</p>
                {importResult.errors.length > 0 && (
                  <ul className="mt-2 text-xs space-y-1 max-h-24 overflow-y-auto">
                    {importResult.errors.slice(0, 10).map((e, i) => <li key={i}>• {e}</li>)}
                  </ul>
                )}
              </div>
            )}

            <DialogFooter className="gap-2">
              <Button variant="outline" onClick={reset} disabled={importing}>Changer de fichier</Button>
              <Button onClick={executeImport} disabled={importing || !!importResult || totalValid === 0} className="bg-[#2A5141] hover:bg-[#1a3329] text-white">
                {importing ? (<><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Import...</>) : importResult ? "Terminé" : (<><Wand2 className="h-4 w-4 mr-2" /> Importer {totalValid} élément{totalValid > 1 ? "s" : ""}</>)}
              </Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};

// ============================================================
// NODE
// ============================================================
const Node = ({ node, depth, onDelete, onSelect, onQuickAdd }: {
  node: Entity; depth: number;
  onDelete: (id: string) => void;
  onSelect: (id: string) => void;
  onQuickAdd: (parentId: string, type: EntityType) => void;
}) => {
  const [open, setOpen] = useState(true);
  const [addMenuOpen, setAddMenuOpen] = useState(false);
  const hasChildren = (node.children?.length ?? 0) > 0;
  const { can } = useRole();
  const isDir = isDirection(node.type);
  const isFil = isFiliale(node.type);

  const allowedChildTypes: { type: EntityType; label: string; icon: any }[] =
    isFil ? [{ type: "DIRECTION" as EntityType, label: "Ajouter une direction", icon: Landmark }]
    : isDir ? [
        { type: "SERVICE" as EntityType, label: "Ajouter un service", icon: Layers },
        { type: "DÉPARTEMENT" as EntityType, label: "Ajouter un département", icon: Layers },
      ] : [];
  const canAddChild = allowedChildTypes.length > 0 && can("write");

  const getTypeColors = (type?: string) => {
    if (isFil) return { iconBg: "bg-[#172030]", iconColor: "text-white", badgeBg: "bg-[#172030]", badgeText: "text-white", borderColor: "border-[#172030]", textSize: "text-base font-bold" };
    if (isDir) return { iconBg: "bg-[#2A5141]", iconColor: "text-white", badgeBg: "bg-[#2A5141]", badgeText: "text-white", borderColor: "border-[#2A5141]", textSize: "text-sm font-semibold" };
    if (type?.toUpperCase() === "SERVICE") return { iconBg: "bg-blue-100", iconColor: "text-blue-700", badgeBg: "bg-blue-100", badgeText: "text-blue-700", borderColor: "border-blue-200", textSize: "text-sm font-medium" };
    if (type?.toUpperCase() === "DÉPARTEMENT") return { iconBg: "bg-purple-100", iconColor: "text-purple-700", badgeBg: "bg-purple-100", badgeText: "text-purple-700", borderColor: "border-purple-200", textSize: "text-sm font-medium" };
    return { iconBg: "bg-gray-100", iconColor: "text-gray-600", badgeBg: "bg-gray-100", badgeText: "text-gray-600", borderColor: "border-gray-200", textSize: "text-sm font-medium" };
  };

  const colors = getTypeColors(node.type);
  const iconSize = isFil ? "h-5 w-5" : isDir ? "h-4.5 w-4.5" : "h-4 w-4";
  const iconContainerSize = isFil ? "h-9 w-9" : isDir ? "h-8 w-8" : "h-7 w-7";

  const getDisplayName = () => {
    const siblingsWithSameName = node.parentId
      ? (getChildren([], node.parentId) as any).filter((e: any) => e.name === node.name && e.id !== node.id)
      : [];
    if (siblingsWithSameName.length > 0) return `${node.name} (${node.country || 'FR'})`;
    return node.name;
  };

  const bgColor = depth % 2 === 0 ? "bg-white" : "bg-[#F8F6F2]/30";
  const highlight = typeof window !== 'undefined' && (window as any).__lastCreatedEntityId === node.id;

  return (
    <div className={cn("relative", bgColor)}>
      {depth > 0 && (
        <div className="absolute left-[18px] top-0 bottom-0 w-px bg-gray-200" style={{ height: '100%', left: `${depth * 24 + 18}px` }} />
      )}
      <div
        className={cn("py-3 px-3 rounded-lg hover:bg-secondary/40 transition-all duration-200 group cursor-pointer relative", isFil ? "py-4" : "py-2.5", highlight && "ring-2 ring-[#2A5141]/40 ring-offset-2 bg-[#E8F5E9]/40 animate-pulse")}
        style={{ paddingLeft: `${depth * 28 + 12}px` }}
        onClick={() => onSelect(node.id)}
      >
        <div className="flex items-center gap-3">
          <button onClick={(e) => { e.stopPropagation(); setOpen(!open); }}
            className={cn("flex items-center justify-center rounded-full transition-all duration-200", hasChildren ? "hover:bg-gray-200/70 w-6 h-6" : "w-6 h-6 opacity-0")}>
            {hasChildren ? (open ? <ChevronDown className="h-4 w-4 text-gray-500" /> : <ChevronRight className="h-4 w-4 text-gray-500" />) : <span className="inline-block w-4" />}
          </button>
          <div className={cn("rounded-lg flex items-center justify-center flex-shrink-0 transition-all", iconContainerSize, colors.iconBg)}>
            <Building2 className={cn(iconSize, colors.iconColor)} />
          </div>
          <div className="flex-1 min-w-0 grid grid-cols-1 md:grid-cols-4 gap-2 items-center">
            <div className="flex items-center gap-2 min-w-0">
              <span className={cn("truncate", colors.textSize, isFil ? "text-[#172030]" : "text-gray-800")}>{getDisplayName()}</span>
            </div>
            <div><Badge className={cn("font-medium px-2.5 py-0.5 rounded-full text-[10px]", colors.badgeBg, colors.badgeText, colors.borderColor)}>{node.type || "—"}</Badge></div>
            <span className="text-xs text-muted-foreground">{node.country || "FR"}</span>
            <span className="text-xs truncate text-muted-foreground">{node.referent || "—"}</span>
          </div>
          <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity" onClick={(e) => e.stopPropagation()}>
            {canAddChild && (
              <Popover open={addMenuOpen} onOpenChange={setAddMenuOpen}>
                <PopoverTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-7 w-7 rounded-full text-[#2A5141] hover:bg-[#2A5141]/10">
                    <PlusCircle className="h-3.5 w-3.5" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-56 p-1.5 z-50" align="end" side="bottom">
                  <div className="px-2 py-1.5 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider border-b border-border mb-1">
                    Sous « {node.name.length > 25 ? node.name.slice(0, 25) + '…' : node.name} »
                  </div>
                  {allowedChildTypes.map((opt) => {
                    const Icon = opt.icon;
                    return (
                      <button key={opt.type} onClick={() => { setAddMenuOpen(false); onQuickAdd(node.id, opt.type); }}
                        className="w-full flex items-center gap-2 px-2 py-2 text-sm rounded-md hover:bg-[#F8F6F2] transition-colors text-left">
                        <Icon className="h-4 w-4 text-[#2A5141] flex-shrink-0" />
                        <span className="text-[#172030] font-medium">{opt.label}</span>
                      </button>
                    );
                  })}
                </PopoverContent>
              </Popover>
            )}
            {can("admin") && (
              <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:bg-destructive/10 rounded-full" onClick={() => onDelete(node.id)}>
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            )}
          </div>
        </div>
      </div>
      {hasChildren && open && (
        <div className="relative">
          {node.children!.map((c, index) => (
            <div key={c.id} className="relative">
              {index === node.children!.length - 1 && depth > 0 && (
                <div className="absolute w-px bg-gray-200" style={{ left: `${depth * 28 + 18}px`, top: 0, bottom: '50%', height: '50%' }} />
              )}
              <Node key={c.id} node={c} depth={depth + 1} onDelete={onDelete} onSelect={onSelect} onQuickAdd={onQuickAdd} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

// ============================================================
// TAXONOMY TAB
// ============================================================
const TaxonomyTab = ({ entities, processes, onOpenImport, onDownloadTemplate, onNavigateToBIA }: { entities: Entity[]; processes: any[]; onOpenImport: () => void; onDownloadTemplate: () => void; onNavigateToBIA?: (processId: string) => void }) => {
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [searchQuery, setSearchQuery] = useState("");

  const stats = useMemo(() => {
    const filiales = entities.filter(e => isFiliale(e.type));
    const directions = entities.filter(e => isDirection(e.type));
    const directionsWithoutProcesses = directions.filter(d => {
      const hasOwn = processes.some(p => p.entityId === d.id);
      const children = entities.filter(e => e.parentId === d.id);
      const hasChild = children.some(c => processes.some(p => p.entityId === c.id));
      return !hasOwn && !hasChild;
    });
    const processesWithoutRto = processes.filter(p => !p.rto && !p.rto_hours);
    const entitiesWithProcesses = entities.filter(e => processes.some(p => p.entityId === e.id)).length;
    const coverage = entities.length > 0 ? Math.round((entitiesWithProcesses / entities.length) * 100) : 0;
    return { filiales: filiales.length, directions: directions.length, totalProcesses: processes.length, directionsWithoutProcesses: directionsWithoutProcesses.length, processesWithoutRto: processesWithoutRto.length, coverage };
  }, [entities, processes]);

  const getProcessesOf = (entity: Entity) => processes.filter(p => p.entityId === entity.id);
  const toggleEntity = (entityId: string) => setExpanded(prev => ({ ...prev, [entityId]: !prev[entityId] }));

  const highlightMatch = (text: string, query: string) => {
    if (!query || !text) return text;
    const idx = text.toLowerCase().indexOf(query.toLowerCase());
    if (idx === -1) return text;
    return (
      <>
        {text.slice(0, idx)}
        <mark className="bg-yellow-200 text-[#172030] font-semibold px-0.5 rounded">{text.slice(idx, idx + query.length)}</mark>
        {text.slice(idx + query.length)}
      </>
    );
  };

  const renderNode = (entity: Entity, depth = 0) => {
    const children = entities.filter(e => e.parentId === entity.id);
    const entityProcesses = getProcessesOf(entity);
    const isExpanded = expanded[entity.id] ?? false;
    const hasChildren = children.length > 0;
    const hasProcesses = entityProcesses.length > 0;
    const canExpand = hasChildren || hasProcesses;

    let totalInBranch = entityProcesses.length;
    let withRto = entityProcesses.filter(p => p.rto || p.rto_hours).length;
    const countRec = (pid: string) => {
      entities.filter(e => e.parentId === pid).forEach(c => {
        const cp = getProcessesOf(c);
        totalInBranch += cp.length;
        withRto += cp.filter(p => p.rto || p.rto_hours).length;
        countRec(c.id);
      });
    };
    countRec(entity.id);

    const coverage = totalInBranch > 0 ? Math.round((withRto / totalInBranch) * 100) : 0;

    const matchesSearch = searchQuery === "" ||
      entity.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      entityProcesses.some(p => (p.name || "").toLowerCase().includes(searchQuery.toLowerCase()));
    if (searchQuery && !matchesSearch && !hasChildren) return null;

    const getIcon = () => {
      if (isFiliale(entity.type)) return <Building2 className="h-4 w-4" />;
      if (isDirection(entity.type)) return <Landmark className="h-4 w-4" />;
      return <Layers className="h-4 w-4" />;
    };

    const getColors = () => {
      if (isFiliale(entity.type)) return { bg: "bg-[#172030]", text: "text-white" };
      if (isDirection(entity.type)) return { bg: "bg-[#2A5141]", text: "text-white" };
      if (entity.type?.toUpperCase() === "SERVICE") return { bg: "bg-blue-100", text: "text-blue-700" };
      if (entity.type?.toUpperCase() === "DÉPARTEMENT") return { bg: "bg-purple-100", text: "text-purple-700" };
      return { bg: "bg-gray-100", text: "text-gray-700" };
    };

    const colors = getColors();

    return (
      <div key={entity.id} className="relative">
        <div
          className={cn("group flex items-center gap-2 py-2.5 pr-2 rounded-lg transition-all duration-200 cursor-pointer select-none", depth === 0 && "py-3", isExpanded ? "bg-[#F8F6F2]" : "hover:bg-[#F8F6F2]", "active:scale-[0.995]")}
          style={{ paddingLeft: `${depth * 24 + 8}px` }}
          onClick={() => canExpand && toggleEntity(entity.id)}
        >
          <div className={cn("flex-shrink-0 w-6 h-6 rounded-md flex items-center justify-center transition-all", canExpand ? "bg-white border border-[#E8E4DC] group-hover:border-[#2A5141]/40" : "opacity-30")}>
            {canExpand ? (isExpanded ? <ChevronDown className="h-4 w-4 text-[#2A5141]" /> : <ChevronRight className="h-4 w-4 text-[#2A5141]" />) : <span className="w-4" />}
          </div>
          <div className={cn("flex-shrink-0 rounded-md flex items-center justify-center", depth === 0 ? "h-8 w-8" : "h-7 w-7", colors.bg, colors.text)}>
            {getIcon()}
          </div>
          <span className={cn("truncate flex-1", depth === 0 ? "text-sm font-bold text-[#172030]" : "text-sm font-semibold text-[#172030]")}>
            {highlightMatch(entity.name, searchQuery)}
          </span>
          <Badge className={cn("text-[10px] font-medium border-0", colors.bg, colors.text)}>{entity.type}</Badge>
          {totalInBranch > 0 && (
            <div className="hidden md:flex items-center gap-1.5 flex-shrink-0">
              <span className="text-[9px] font-semibold text-[#172030]/50">{coverage}%</span>
              <div className="w-12 h-1.5 rounded-full bg-[#E8E4DC] overflow-hidden">
                <div className="h-full rounded-full transition-all duration-500" style={{ width: `${coverage}%`, backgroundColor: coverage >= 80 ? "#22c55e" : coverage >= 40 ? "#eab308" : "#ef4444" }} />
              </div>
            </div>
          )}
          {totalInBranch > 0 && (
            <Badge className={cn("text-[10px] font-semibold border-0 transition-colors", isExpanded ? "bg-[#2A5141] text-white" : "bg-[#2A5141]/10 text-[#2A5141]")}>
              <Target className="h-2.5 w-2.5 mr-1" /> {totalInBranch}
            </Badge>
          )}
          {canExpand && !isExpanded && (
            <span className="text-[10px] text-[#2A5141]/60 font-medium hidden lg:inline">Cliquer pour voir</span>
          )}
        </div>

        {isExpanded && (
          <div className="relative">
            <div className="absolute top-0 bottom-0 w-px bg-[#E8E4DC]" style={{ left: `${depth * 24 + 20}px` }} />
            {hasProcesses && (
              <div className="mt-1 mb-2 space-y-1" style={{ paddingLeft: `${depth * 24 + 56}px` }}>
                {entityProcesses.map(p => {
                  const hasRto = !!(p.rto || p.rto_hours);
                  const rtoValue = p.rto || p.rto_hours;
                  const crit = p.criticality_level || p.criticality || (p.impacts ? scoreToCriticality(computeMaxScore(p.impacts)) : "Non défini");
                  const isCritical = crit === "Critique" || crit === "Élevé" || crit === "CRITIQUE";
                  const dotColor = isCritical ? "#ef4444" : crit === "Modéré" || crit === "MODERE" ? "#eab308" : "#22c55e";

                  return (
                    <div
                      key={p.id}
                      className="group flex items-center gap-2 py-2 px-3 rounded-md bg-white border border-[#E8E4DC] hover:border-[#2A5141]/40 hover:shadow-sm transition-all cursor-pointer"
                      style={{ borderLeft: `3px solid ${dotColor}` }}
                      onClick={(e) => { e.stopPropagation(); onNavigateToBIA?.(p.id); }}
                      title="Ouvrir la fiche BIA de ce processus"
                    >
                      <Target className="h-3.5 w-3.5 text-[#2A5141] flex-shrink-0" />
                      <span className="text-[13px] text-[#172030] truncate flex-1">{highlightMatch(p.name, searchQuery)}</span>
                      {p.owner && <><span className="text-[10px] text-gray-400">•</span><span className="text-[11px] text-gray-500 truncate max-w-[100px]">{p.owner}</span></>}
                      <div className="flex items-center gap-1.5 flex-shrink-0">
                        {hasRto ? (
                          <Badge className="text-[9px] font-mono bg-blue-50 text-blue-700 border-0">RTO {rtoValue}h</Badge>
                        ) : (
                          <Badge className="text-[9px] bg-orange-50 text-orange-700 border-0"><AlertTriangle className="h-2.5 w-2.5 mr-0.5" /> RTO manquant</Badge>
                        )}
                        {crit !== "Non défini" && (<span className="w-2 h-2 rounded-full" style={{ backgroundColor: dotColor }} title={crit} />)}
                        {hasRto && !isCritical && <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />}
                        <ExternalLink className="h-3 w-3 text-[#2A5141] opacity-0 group-hover:opacity-100 transition-opacity" />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
            {hasChildren && children.map(c => renderNode(c, depth + 1))}
          </div>
        )}
      </div>
    );
  };

  const filiales = entities.filter(e => isFiliale(e.type) && !e.parentId);

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card className="border-[#E8E4DC] shadow-sm"><CardContent className="p-4 flex items-center gap-3"><div className="h-10 w-10 rounded-lg bg-[#172030]/10 flex items-center justify-center flex-shrink-0"><Building2 className="h-5 w-5 text-[#172030]" /></div><div><p className="text-[10px] uppercase tracking-wider text-gray-400 font-medium">Filiales</p><p className="text-2xl font-bold text-[#172030]">{stats.filiales}</p></div></CardContent></Card>
        <Card className="border-[#E8E4DC] shadow-sm"><CardContent className="p-4 flex items-center gap-3"><div className="h-10 w-10 rounded-lg bg-[#2A5141]/10 flex items-center justify-center flex-shrink-0"><Landmark className="h-5 w-5 text-[#2A5141]" /></div><div><p className="text-[10px] uppercase tracking-wider text-gray-400 font-medium">Directions</p><p className="text-2xl font-bold text-[#172030]">{stats.directions}</p></div></CardContent></Card>
        <Card className="border-[#E8E4DC] shadow-sm"><CardContent className="p-4 flex items-center gap-3"><div className="h-10 w-10 rounded-lg bg-emerald-50 flex items-center justify-center flex-shrink-0"><Target className="h-5 w-5 text-emerald-600" /></div><div><p className="text-[10px] uppercase tracking-wider text-gray-400 font-medium">Processus</p><p className="text-2xl font-bold text-[#172030]">{stats.totalProcesses}</p></div></CardContent></Card>
        <Card className="border-[#E8E4DC] shadow-sm"><CardContent className="p-4 flex items-center gap-3"><div className="h-10 w-10 rounded-lg bg-blue-50 flex items-center justify-center flex-shrink-0"><TrendingUp className="h-5 w-5 text-blue-600" /></div><div><p className="text-[10px] uppercase tracking-wider text-gray-400 font-medium">Couverture</p><p className="text-2xl font-bold text-[#172030]">{stats.coverage}%</p></div></CardContent></Card>
      </div>

      <div className="flex items-center justify-between gap-3 flex-wrap p-3 rounded-lg bg-gradient-to-r from-[#2A5141]/[0.04] to-transparent border border-[#2A5141]/20">
        <div className="flex items-center gap-3">
          <div className="h-9 w-9 rounded-lg bg-[#2A5141] flex items-center justify-center shadow-sm">
            <Wand2 className="h-4 w-4 text-white" />
          </div>
          <div>
            <p className="text-sm font-semibold text-[#172030] flex items-center gap-2">
              Import Excel
              <Badge className="bg-[#2A5141] text-white border-0 text-[9px] font-bold uppercase tracking-wider">
                <Sparkles className="h-2.5 w-2.5 mr-0.5" /> IA
              </Badge>
            </p>
            <p className="text-[11px] text-gray-500">Analyse intelligente — détecte la structure automatiquement</p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={onDownloadTemplate} className="h-8 border-[#2A5141]/30 text-[#2A5141] text-xs">
            <FileText className="h-3.5 w-3.5 mr-1" /> Télécharger le modèle
          </Button>
          <Button size="sm" onClick={onOpenImport} className="h-8 bg-[#2A5141] hover:bg-[#1a3329] text-white text-xs">
            <Upload className="h-3.5 w-3.5 mr-1" /> Lancer l'import
          </Button>
        </div>
      </div>

      {(stats.directionsWithoutProcesses > 0 || stats.processesWithoutRto > 0) && (
        <div className="flex flex-wrap gap-2">
          {stats.directionsWithoutProcesses > 0 && (
            <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-orange-50 border border-orange-200 text-[12px] text-orange-700">
              <AlertTriangle className="h-3.5 w-3.5" /><span><strong>{stats.directionsWithoutProcesses}</strong> direction{stats.directionsWithoutProcesses > 1 ? "s" : ""} sans processus</span>
            </div>
          )}
          {stats.processesWithoutRto > 0 && (
            <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-red-50 border border-red-200 text-[12px] text-red-700">
              <AlertTriangle className="h-3.5 w-3.5" /><span><strong>{stats.processesWithoutRto}</strong> processus sans RTO défini</span>
            </div>
          )}
        </div>
      )}

      <div className="space-y-2">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-2">
            <Network className="h-4 w-4 text-[#2A5141]" />
            <span className="text-sm font-semibold text-[#172030]">Vue hiérarchique interactive</span>
            <span className="text-xs text-gray-400 hidden md:inline">— Cliquez sur une direction, puis sur un processus pour ouvrir sa fiche BIA</span>
          </div>
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400" />
            <Input value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder="Rechercher..." className="h-8 w-[220px] pl-8 text-xs border-[#E8E4DC]" />
          </div>
        </div>

        {filiales.length === 0 ? (
          <div className="text-center py-12">
            <Network className="h-12 w-12 mx-auto text-gray-200 mb-3" />
            <p className="text-sm text-gray-500 font-medium">Aucune entité dans la taxonomie</p>
          </div>
        ) : (
          <div className="space-y-1 border border-[#E8E4DC] rounded-lg p-3 bg-white">
            {filiales.map(f => renderNode(f, 0))}
          </div>
        )}
      </div>
    </div>
  );
};

// ============================================================
// FormState / emptyForm
// ============================================================
type FormState = {
  name: string; type: EntityType | ""; country: string;
  referent: string; referentContact: string; suppleant: string;
  suppleantContact: string; parentId: string;
};

const emptyForm: FormState = {
  name: "", type: "", country: "", referent: "", referentContact: "",
  suppleant: "", suppleantContact: "", parentId: "",
};

// ============================================================
// COMPOSANT PRINCIPAL
// ============================================================
export const OrgChart = ({ onNavigate }: { onNavigate?: (section: string, entityId?: string) => void }) => {
  const { entities, setEntities, setSelectedEntityId } = useGovernance();
  const biaContext = useBia();
  const { processes } = biaContext;
  const { can } = useRole();

  const [panelId, setPanelId] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [editForm, setEditForm] = useState<FormState>(emptyForm);
  const [form, setForm] = useState<FormState>(emptyForm);

  const [activeView, setActiveView] = useState<"entities" | "taxonomy">("entities");
  const [importOpen, setImportOpen] = useState(false);

  const [isProcessingPdf, setIsProcessingPdf] = useState(false);
  const [processingStep, setProcessingStep] = useState<string>("");
  const [pendingFile, setPendingFile] = useState<File | null>(null);

  const [quickAddOpen, setQuickAddOpen] = useState(false);
  const [quickAddParentId, setQuickAddParentId] = useState<string>("");
  const [quickAddType, setQuickAddType] = useState<EntityType | "">("");
  const [quickAddForm, setQuickAddForm] = useState<FormState>(emptyForm);
  const [isSubmittingQuickAdd, setIsSubmittingQuickAdd] = useState(false);

  const tree = buildTree(entities);
  const panelEntity = entities.find((e) => e.id === panelId) || null;
  const panelParent = panelEntity ? entities.find((e) => e.id === panelEntity.parentId) : null;
  const panelChildren = panelEntity ? getChildren(entities, panelEntity.id) : [];
  const panelProcesses = panelEntity ? getEntityProcesses(panelEntity, processes) : [];

  const reloadEntities = async () => {
    const { data } = await (supabase as any).from('organisations').select('*');
    if (data) {
      setEntities(data.map((e: any) => ({
        id: e.id, name: e.name, type: e.type, country: e.country_code, parentId: e.parent_id,
        referent: e.pca_referent || '—',
        status: 'Actif', pcaStatus: e.pca_status || 'Non démarré',
        maturity: typeof e.maturity_score === "number" ? e.maturity_score : undefined,
      })));
    }
  };

  const reloadBiaProcesses = async () => {
    try {
      const ctx = biaContext as any;
      if (typeof ctx.refreshProcesses === "function") {
        await ctx.refreshProcesses();
      } else if (typeof ctx.reload === "function") {
        await ctx.reload();
      }
    } catch (e) {
      console.warn("Impossible de recharger les processus BIA :", e);
    }
  };

  const handleQuickAdd = (parentId: string, type: EntityType) => {
    const parent = entities.find(e => e.id === parentId);
    setQuickAddParentId(parentId); setQuickAddType(type);
    setQuickAddForm({ ...emptyForm, type, parentId, country: parent?.country || "FR" });
    setQuickAddOpen(true);
  };

  const submitQuickAdd = async () => {
    if (!can("write")) { toast.error("Permissions insuffisantes"); return; }
    if (!quickAddForm.name.trim()) { toast.error("Le nom est obligatoire"); return; }
    if (!quickAddForm.type) { toast.error("Le type est obligatoire"); return; }
    const validation = validateHierarchy(quickAddForm.type, quickAddParentId || null, entities);
    if (!validation.valid) { toast.error(validation.error); return; }

    setIsSubmittingQuickAdd(true);
    try {
      const parent = entities.find(e => e.id === quickAddParentId);
      const { data, error } = await (supabase as any).from('organisations').insert({
        name: quickAddForm.name.trim(),
        type: quickAddForm.type.toUpperCase(),
        country_code: quickAddForm.country || parent?.country || "FR",
        parent_id: quickAddParentId || null,
        pca_referent: quickAddForm.referent || "—",
        pca_status: "Non démarré",
        sector: "Général",
        status: "ACTIVE",
      }).select().single();

      if (error) { toast.error("Erreur: " + error.message); setIsSubmittingQuickAdd(false); return; }

      const newEntity: any = {
        id: data.id, name: quickAddForm.name.trim(), type: quickAddForm.type as EntityType,
        country: quickAddForm.country || parent?.country || "FR", sector: "Général",
        parentId: quickAddParentId || null, referent: quickAddForm.referent || "—",
        referentContact: quickAddForm.referentContact || undefined,
        referentBackup: quickAddForm.suppleant || "—",
        suppleantContact: quickAddForm.suppleantContact || undefined,
      };
      setEntities([...entities, newEntity]);
      toast.success(`✅ ${quickAddForm.type} « ${newEntity.name} » créé${(quickAddForm.type as string) === "DIRECTION" ? "e" : ""}`);
      (window as any).__lastCreatedEntityId = newEntity.id;
      setTimeout(() => { (window as any).__lastCreatedEntityId = null; setEntities([...entities] as Entity[]); }, 3000);
      setQuickAddOpen(false); setQuickAddForm(emptyForm); setQuickAddParentId(""); setQuickAddType("");
    } finally { setIsSubmittingQuickAdd(false); }
  };

  const submitInline = async () => {
    if (!can("write")) { toast.error("Permissions insuffisantes"); return; }
    if (!form.name) { toast.error("Le nom est obligatoire"); return; }
    if (!form.type) { toast.error("Le type est obligatoire"); return; }
    const normalizedType = form.type.toUpperCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    if (normalizedType !== "FILIALE" && !form.parentId) { toast.error("L'entité parente est obligatoire"); return; }
    const validation = validateHierarchy(form.type, form.parentId || null, entities);
    if (!validation.valid) { toast.error(validation.error); return; }

    const entityToInsert = {
      name: form.name,
      type: form.type?.toUpperCase(),
      country_code: form.country || "FR",
      parent_id: form.parentId || null,
      pca_referent: form.referent || "—",
      pca_status: "Non démarré",
      sector: "Général",
      status: "ACTIVE",
    };
    const { data, error } = await (supabase as any).from('organisations').insert(entityToInsert).select();
    if (error) { toast.error("Erreur: " + error.message); return; }

    const newEntity: any = {
      id: data[0].id, name: form.name, type: form.type as EntityType,
      country: form.country || "FR", sector: "Général", parentId: form.parentId || null,
      referent: form.referent || "—", referentContact: form.referentContact || undefined,
      referentBackup: form.suppleant || "—", suppleantContact: form.suppleantContact || undefined,
    };
    setEntities([...entities, newEntity]);
    setForm(emptyForm);
    toast.success("Entité créée et sauvegardée");
  };

  const handleDelete = async (id: string) => {
    if (!can("admin")) { toast.error("Action réservée à l'administrateur"); return; }
    const entityName = entities.find(e => e.id === id)?.name || id;
    if (!confirm(`⚠️ Voulez-vous vraiment supprimer "${entityName}" et toutes ses entités filles ?`)) return;

    const { data: freshEntities, error: fetchError } = await (supabase as any).from('organisations').select('id, parent_id');
    if (fetchError) { toast.error("Erreur: " + fetchError.message); return; }

    const toRemove = new Set<string>([id]);
    let changed = true;
    while (changed) {
      changed = false;
      for (const e of freshEntities) {
        if (e.parent_id && toRemove.has(e.parent_id) && !toRemove.has(e.id)) { toRemove.add(e.id); changed = true; }
      }
    }

    const { error: deleteError } = await (supabase as any).from('organisations').delete().in('id', Array.from(toRemove));
    if (deleteError) { toast.error("Erreur: " + deleteError.message); return; }
    await reloadEntities();
    if (panelId && toRemove.has(panelId)) { setPanelId(null); setEditing(false); }
    toast.success(`${toRemove.size} entité(s) supprimée(s) avec succès`);
  };

  const openPanel = (id: string) => {
    setPanelId(id); setSelectedEntityId(id); setEditing(false);
    const e = entities.find((x) => x.id === id);
    if (e) {
      setEditForm({
        name: e.name, type: e.type || "", country: e.country, referent: e.referent,
        referentContact: (e as any).referentContact || "", suppleant: e.referentBackup || "",
        suppleantContact: (e as any).suppleantContact || "", parentId: e.parentId || "",
      });
    }
  };

  const saveEdit = async () => {
    if (!panelEntity) return;
    if (!can("write")) { toast.error("Permissions insuffisantes"); return; }
    if (!editForm.name) { toast.error("Le nom est obligatoire"); return; }
    if (!editForm.type) { toast.error("Le type est obligatoire"); return; }
    const normalizedType = editForm.type.toUpperCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    if (normalizedType !== "FILIALE" && !editForm.parentId) { toast.error("L'entité parente est obligatoire"); return; }
    if (editForm.parentId === panelEntity.id) { toast.error("Une entité ne peut pas être son propre parent"); return; }
    const validation = validateHierarchy(editForm.type, editForm.parentId || null, entities.filter(e => e.id !== panelEntity.id));
    if (!validation.valid) { toast.error(validation.error); return; }

    await (supabase as any).from('organisations').update({
      name: editForm.name,
      type: editForm.type?.toUpperCase(),
      country_code: editForm.country || "FR",
      parent_id: editForm.parentId || null,
      pca_referent: editForm.referent || "—",
    }).eq('id', panelEntity.id);

    setEntities(entities.map((e) => e.id === panelEntity.id ? {
      ...panelEntity, name: editForm.name, type: (editForm.type || undefined) as EntityType | undefined,
      country: editForm.country || "FR", referent: editForm.referent || "—",
      referentContact: editForm.referentContact || undefined, referentBackup: editForm.suppleant || "—",
      suppleantContact: editForm.suppleantContact || undefined, parentId: editForm.parentId || null,
    } as any : e));
    setEditing(false);
    toast.success("Entité mise à jour");
  };

  const renderFormGrid = (state: FormState, set: (s: FormState) => void, excludeId?: string) => {
    const getFullPath = (entityId: string): string => {
      const entity = entities.find(e => e.id === entityId);
      if (!entity) return "";
      const path: string[] = [entity.name];
      let current = entity; let maxLevels = 5;
      while (current.parentId && maxLevels > 0) {
        const parent = entities.find(e => e.id === current.parentId);
        if (parent) { path.unshift(parent.name); current = parent; } else break;
        maxLevels--;
      }
      return path.join(" → ");
    };

    const getAvailableParents = () => {
      if (!state.type) return [];
      const n = state.type.toUpperCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
      if (n === "FILIALE") return [];
      if (n === "DIRECTION") return entities.filter(e => e.id !== excludeId && isFiliale(e.type));
      if (["SERVICE", "DEPARTEMENT"].includes(n)) return entities.filter(e => e.id !== excludeId && isDirection(e.type));
      return [];
    };

    const availableParents = getAvailableParents();
    const showParentField = state.type && state.type.toUpperCase() !== "FILIALE";

    return (
      <div className="grid md:grid-cols-3 gap-3">
        <div><Label>Nom <span className="text-destructive">*</span></Label><Input value={state.name} onChange={(e) => set({ ...state, name: e.target.value })} placeholder="Direction Marketing" /></div>
        <div><Label>Type <span className="text-destructive">*</span></Label><Select value={state.type} onValueChange={(v) => set({ ...state, type: v as EntityType, parentId: "" })}><SelectTrigger><SelectValue placeholder="Type" /></SelectTrigger><SelectContent>{ENTITY_TYPES_FILTERED.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent></Select></div>
        <div><Label>Pays</Label><Input value={state.country} onChange={(e) => set({ ...state, country: e.target.value })} placeholder="France" /></div>
        <div><Label>Référent PCA</Label><Input value={state.referent} onChange={(e) => set({ ...state, referent: e.target.value })} placeholder="Nom du responsable" /></div>
        <div><Label>Coordonnées référent</Label><Input value={state.referentContact} onChange={(e) => set({ ...state, referentContact: e.target.value })} placeholder="email ou téléphone" /></div>
        <div><Label>Suppléant</Label><Input value={state.suppleant} onChange={(e) => set({ ...state, suppleant: e.target.value })} placeholder="Nom du suppléant" /></div>
        <div><Label>Coordonnées suppléant</Label><Input value={state.suppleantContact} onChange={(e) => set({ ...state, suppleantContact: e.target.value })} placeholder="email ou téléphone" /></div>
        {showParentField && (
          <div className="md:col-span-2">
            <Label className="flex items-center gap-2">Entité parente <span className="text-destructive">*</span><span className="text-xs font-normal text-muted-foreground">(doit être une {String(state.type) === "DIRECTION" ? "Filiale" : "Direction"})</span></Label>
            {availableParents.length === 0 ? (
              <div className="mt-1 p-3 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-700">⚠️ Aucune {String(state.type) === "DIRECTION" ? "filiale" : "direction"} disponible.</div>
            ) : (
              <Select value={state.parentId || "__root__"} onValueChange={(v) => set({ ...state, parentId: v === "__root__" ? "" : v })}>
                <SelectTrigger className="mt-1"><SelectValue placeholder="Sélectionner un parent" /></SelectTrigger>
                <SelectContent className="max-h-[300px]">
                  {availableParents.map((e) => (
                    <SelectItem key={e.id} value={e.id}>
                      <div className="flex items-center gap-2 w-full">
                        <span className="truncate">{e.name}</span>
                        <span className="text-[10px] text-muted-foreground whitespace-nowrap">{getFullPath(e.id)}</span>
                        <Badge variant="outline" className="text-[9px] ml-auto bg-muted/30">{e.type}</Badge>
                      </div>
                    </SelectItem>
                  ))}
                  <div className="border-t border-[#E8E4DC] mt-1 pt-1">
                    <SelectItem value="__root__" className="text-muted-foreground italic">— Aucun parent (entité racine) —</SelectItem>
                  </div>
                </SelectContent>
              </Select>
            )}
            {state.parentId && state.parentId !== "__root__" && (
              <div className="mt-1.5 text-xs text-muted-foreground flex items-center gap-2 bg-[#F8F6F2] p-2 rounded-lg border border-[#E8E4DC]">
                <div className="h-2 w-2 rounded-full bg-[#2A5141] flex-shrink-0"></div>
                <span>📍 Chemin : <span className="font-medium text-[#172030]">{getFullPath(state.parentId)}</span></span>
              </div>
            )}
          </div>
        )}
      </div>
    );
  };

  const downloadGenericTemplate = () => {
    const data = [
      ['Nom', 'Type', 'Entité Parente', 'Référent PCA', 'Pays', 'Processus', 'Responsable Processus', 'RTO', 'RPO', 'Criticité'],
      ['Novatech France', 'FILIALE', '', 'Jean Dupont', 'France', '', '', '', '', ''],
      ['Direction SI', 'DIRECTION', 'Novatech France', 'Sophie Martin', 'France', '', '', '', '', ''],
      ['Direction Financière', 'DIRECTION', 'Novatech France', 'Marc Dubois', 'France', '', '', '', '', ''],
      ['Service Comptabilité', 'SERVICE', 'Direction Financière', 'Claire Petit', 'France', '', '', '', '', ''],
      ['Service Infrastructure', 'SERVICE', 'Direction SI', 'Ahmed Ben Ali', 'France', '', '', '', '', ''],
      ['Service Infrastructure', '', '', '', '', 'Gestion des serveurs', 'Ahmed Ben Ali', 4, 1, 'CRITIQUE'],
      ['Service Infrastructure', '', '', '', '', 'Messagerie d\'entreprise', 'Sophie Martin', 2, 0.5, 'CRITIQUE'],
      ['Service Comptabilité', '', '', '', '', 'Clôture mensuelle', 'Claire Petit', 8, 4, 'MAJEUR'],
      ['Direction SI', '', '', '', '', 'Support utilisateurs', 'Youssef KAAK', 8, 4, 'MODERE'],
    ];

    const ws = XLSX.utils.aoa_to_sheet(data);
    ws['!cols'] = [
      { wch: 22 }, { wch: 12 }, { wch: 22 }, { wch: 18 }, { wch: 12 },
      { wch: 25 }, { wch: 20 }, { wch: 8 }, { wch: 8 }, { wch: 12 },
    ];

    const instructions = [
      ['📋 IMPORT EXCEL — Un seul fichier pour tout'],
      [''],
      ['🎯 COMMENT ÇA MARCHE :'],
      ['   Le système DÉTECTE AUTOMATIQUEMENT vos colonnes par leur nom.'],
      ['   Pas besoin d\'un format figé — tant que les noms de colonnes sont explicites, ça marche.'],
      [''],
      ['📌 RECONNAISSANCE AUTOMATIQUE DES COLONNES :'],
      ['   • "Nom" / "Name" / "Libellé"        → Nom de l\'entité'],
      ['   • "Type" / "Niveau" / "Nature"       → Type (FILIALE, DIRECTION, SERVICE, DÉPARTEMENT)'],
      ['   • "Parent" / "Mère" / "Rattaché"     → Entité parente'],
      ['   • "Référent" / "Responsable PCA"     → Référent PCA'],
      ['   • "Pays" / "Country"                 → Pays'],
      ['   • "Processus" / "Activité"           → Nom du processus (si rempli = ligne processus)'],
      ['   • "RTO" / "Délai"                    → RTO en heures'],
      ['   • "RPO" / "Perte"                    → RPO en heures'],
      ['   • "Criticité" / "Sévérité"           → Criticité (CRITIQUE, MAJEUR, MODERE, MINEUR)'],
      [''],
      ['📌 DÉTECTION DU TYPE DE LIGNE :'],
      ['   • Ligne ENTITÉ si la colonne "Type" contient FILIALE / DIRECTION / SERVICE / DÉPARTEMENT'],
      ['   • Ligne PROCESSUS si la colonne "Processus" est remplie'],
      [''],
      ['🔑 RÈGLES :'],
      ['   • Pour un processus, la colonne "Nom" (ou "Entité") = nom de l\'entité porteuse'],
      ['   • Un processus doit toujours être rattaché à une DIRECTION ou un SERVICE, JAMAIS à une FILIALE'],
      ['   • L\'ordre des lignes n\'a pas d\'importance'],
      ['   • Les entités existantes ne sont PAS recréées'],
      ['   • Les accents sont supportés'],
      [''],
      ['💡 EXEMPLE DE STRUCTURE :'],
      ['   Novatech France (FILIALE)'],
      ['   ├── Direction SI (DIRECTION)'],
      ['   │   ├── Service Infrastructure (SERVICE)'],
      ['   │   │   ├── Processus : Gestion des serveurs (RTO 4h)'],
      ['   │   │   └── Processus : Messagerie d\'entreprise (RTO 2h)'],
      ['   │   └── Processus : Support utilisateurs (porté par Direction SI)'],
      ['   └── Direction Financière (DIRECTION)'],
      ['       └── Service Comptabilité (SERVICE)'],
      ['           └── Processus : Clôture mensuelle (RTO 8h)'],
    ];

    const wsInstr = XLSX.utils.aoa_to_sheet(instructions);
    wsInstr['!cols'] = [{ wch: 100 }];

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Import');
    XLSX.utils.book_append_sheet(wb, wsInstr, 'Instructions');
    XLSX.writeFile(wb, 'modele_import_excel.xlsx');
    toast.success("📊 Modèle générique téléchargé !");
  };

  const downloadTemplate = () => {
    const data = [
      ['Nom', 'Type', 'Pays', 'Référent PCA', 'Coordonnées référent', 'Suppléant', 'Coordonnées suppléant', 'Entité Parente'],
      ['Filiale 1', 'FILIALE', 'France', 'Jean Dupont', 'jean@email.com', 'Marie Martin', 'marie@email.com', ''],
      ['Direction 1', 'DIRECTION', 'France', 'Sophie Leroy', 'sophie@email.com', 'Marc Dubois', 'marc@email.com', 'Filiale 1'],
      ['Service 1', 'SERVICE', 'France', 'Lucie Bernard', 'lucie@email.com', 'Paul Dubois', 'paul@email.com', 'Direction 1'],
    ];
    const ws = XLSX.utils.aoa_to_sheet(data);
    ws['!cols'] = [{ wch: 20 }, { wch: 15 }, { wch: 12 }, { wch: 20 }, { wch: 25 }, { wch: 20 }, { wch: 25 }, { wch: 25 }];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Organigramme');
    XLSX.writeFile(wb, 'modele_organigramme.xlsx');
    toast.success("📊 Modèle Excel téléchargé !");
  };

  const downloadPdfTemplate = () => {
    try {
      const doc = new jsPDF();
      doc.setFillColor(23, 32, 48);
      doc.rect(0, 0, 210, 28, 'F');
      doc.setFontSize(16);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(248, 246, 242);
      doc.text("Resillia", 20, 18);
      doc.setFontSize(10);
      doc.setTextColor(200, 200, 200);
      doc.text("ORGANIGRAMME DU GROUPE - MODÈLE", 190, 18, { align: "right" });
      doc.save('modele_organigramme.pdf');
      toast.success("📄 Modèle PDF téléchargé !");
    } catch (error) {
      toast.error("Erreur lors de la génération du PDF");
    }
  };

  const handleFileImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setPendingFile(file);
    if (file.type === "application/pdf") { await processFileWithAI(file); e.target.value = ''; return; }
    toast.info("Utilisez l'Import Excel pour les fichiers Excel");
    e.target.value = '';
  };

  const processFileWithAI = async (file: File) => {
    setIsProcessingPdf(true);
    try {
      toast.info("📄 Extraction du texte...");
      const arrayBuffer = await file.arrayBuffer();
      const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
      let fullText = "";
      for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
        const page = await pdf.getPage(pageNum);
        const textContent = await page.getTextContent();
        fullText += textContent.items.map((item: any) => item.str).join(' ') + '\n';
      }
      let extractedText = fullText;
      if (!extractedText || extractedText.trim().length < 50) {
        const page = await pdf.getPage(1);
        const viewport = page.getViewport({ scale: 2.0 });
        const canvas = document.createElement('canvas');
        canvas.width = viewport.width; canvas.height = viewport.height;
        await page.render({ canvasContext: canvas.getContext('2d'), viewport }).promise;
        const { data: { text } } = await Tesseract.recognize(canvas.toDataURL('image/png'), 'fra');
        extractedText = text;
      }
      toast.info("🧠 Analyse par l'IA...");
      const { data, error } = await functionsClient.functions.invoke('groq-extract', {
        body: { text: extractedText.replace(/\s+/g, ' ').trim().substring(0, 10000) }
      });
      if (error || !data?.response) { toast.error("Erreur d'analyse"); setIsProcessingPdf(false); return; }
      const cleanResponse = data.response.replace(/```json\s*/g, '').replace(/```\s*/g, '');
      const jsonMatch = cleanResponse.match(/\{[\s\S]*\}/);
      if (!jsonMatch) { toast.error("Pas de JSON trouvé"); setIsProcessingPdf(false); return; }
      const parsed = JSON.parse(jsonMatch[0]);
      if (parsed?.entities?.length > 0) {
        for (const entity of parsed.entities) {
          await (supabase as any).from('organisations').insert({
            name: entity.name,
            type: entity.type?.toUpperCase() || "SERVICE",
            country_code: 'FR',
            parent_id: null,
            pca_referent: 'À définir',
            pca_status: 'Non démarré',
            sector: 'Général',
            status: 'ACTIVE',
          });
        }
        const { data: allEntities } = await (supabase as any).from('organisations').select('*');
        if (allEntities) {
          setEntities(allEntities.map((e: any) => ({
            id: e.id, name: e.name, type: e.type, country: e.country_code, parentId: e.parent_id,
            referent: e.pca_referent || '—', status: 'Actif', pcaStatus: e.pca_status || 'Non démarré',
            maturity: typeof e.maturity_score === "number" ? e.maturity_score : undefined,
          })));
        }
        toast.success(`${parsed.entities.length} entités importées`);
      }
    } catch (err: any) { toast.error(`Erreur: ${err.message}`); }
    setIsProcessingPdf(false);
  };

  const navigateToInventory = () => {
    if (panelEntity && isLowLevel(panelEntity.type)) {
      if (onNavigate) onNavigate("inventory", panelEntity.id);
      else { localStorage.setItem("currentDepartmentId", panelEntity.id); window.location.href = "/?section=inventory"; }
    }
  };

   const navigateToBIA = (processId: string) => {
    if (typeof window === "undefined") return;

    // 1. Stocker le processId pour que ProcessInventory le lise au montage
    sessionStorage.setItem("pendingBiaProcessId", processId);
    localStorage.setItem("pendingBiaProcessId", processId);

    // 2. Demander à l'app de basculer sur l'onglet BIA (module inventory)
    window.dispatchEvent(new CustomEvent("app:navigate", {
      detail: { section: "inventory", processId, module: "bia" }
    }));

    // 3. Émettre aussi l'événement BIA (si le module est déjà monté)
    window.dispatchEvent(new CustomEvent("bia:openProcess", { detail: { processId } }));

    // 4. Callback parent si fourni
    if (onNavigate) onNavigate("inventory", processId);
  };

  const renderChildren = (children: Entity[], parentType?: string) => {
    if (children.length === 0) return null;
    const directions = children.filter(c => c.type?.toUpperCase() === "DIRECTION");
    if (parentType && isFiliale(parentType)) {
      return (
        <div className="space-y-2">
          {directions.map(d => (
            <div key={d.id} className="flex items-center justify-between p-3 rounded-lg border border-border hover:bg-secondary/50 cursor-pointer" onClick={() => openPanel(d.id)}>
              <div className="flex items-center gap-3">
                <div className="h-8 w-8 rounded-lg bg-blue-50 flex items-center justify-center"><Building2 className="h-4 w-4 text-blue-500" /></div>
                <div><div className="font-medium text-sm">{d.name}</div><div className="text-xs text-muted-foreground">{d.type}</div></div>
              </div>
              <Badge variant="outline" className="text-xs">{d.country || "FR"}</Badge>
            </div>
          ))}
        </div>
      );
    }
    return (
      <div className="space-y-2">
        {children.map(c => (
          <div key={c.id} className="flex items-center justify-between p-3 rounded-lg border border-border hover:bg-secondary/50 cursor-pointer" onClick={() => openPanel(c.id)}>
            <div className="flex items-center gap-3"><Building2 className="h-4 w-4 text-muted-foreground" /><span className="font-medium text-sm">{c.name}</span></div>
            <Badge variant="outline" className="text-xs">{c.type}</Badge>
          </div>
        ))}
      </div>
    );
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-foreground">Organigramme du Groupe</h1>
        <p className="text-muted-foreground mt-1">Cliquez sur une entité pour voir ses détails.</p>
      </div>

      {can("write") && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2"><Plus className="h-4 w-4 text-primary" /> Créer une entité</CardTitle>
            <CardDescription>Renseignez les informations de la nouvelle entité</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {renderFormGrid(form, setForm)}
            <div className="flex justify-end"><Button onClick={submitInline}><Plus className="h-4 w-4 mr-1" /> Ajouter l'entité</Button></div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader className="border-b border-[#E8E4DC]/70 pb-0">
          <div className="flex gap-1">
            <button onClick={() => setActiveView("entities")} className={cn("px-4 py-2.5 text-sm font-medium transition-all relative -mb-px", activeView === "entities" ? "text-[#172030] border-b-2 border-[#2A5141]" : "text-[#172030]/50 hover:text-[#172030] border-b-2 border-transparent")}>Arborescence des entités</button>
            <button onClick={() => setActiveView("taxonomy")} className={cn("px-4 py-2.5 text-sm font-medium transition-all relative -mb-px", activeView === "taxonomy" ? "text-[#172030] border-b-2 border-[#2A5141]" : "text-[#172030]/50 hover:text-[#172030] border-b-2 border-transparent")}>Arborescence des taxonomies</button>
          </div>
        </CardHeader>
        <CardContent className="pt-4">
          {activeView === "entities" ? (
            <>
              <Card className="mb-4">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2"><Plus className="h-4 w-4 text-primary" /> Importer un organigramme (ancien format)</CardTitle>
                  <CardDescription>Import simple des entités uniquement (Excel, CSV ou PDF)</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="flex flex-col gap-4">
                    <input type="file" accept=".xlsx,.xls,.csv,.pdf" onChange={handleFileImport} disabled={isProcessingPdf} className="block w-full text-sm text-muted-foreground file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-primary file:text-primary-foreground hover:file:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed" />
                    {isProcessingPdf && <div className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" />{processingStep || "Traitement en cours..."}</div>}
                    <div className="flex flex-wrap gap-2">
                      <Button variant="outline" onClick={downloadTemplate} className="flex items-center gap-2">📊 Télécharger le modèle Excel</Button>
                      <Button variant="outline" onClick={downloadPdfTemplate} className="flex items-center gap-2"><FileText className="h-4 w-4" /> 📄 Télécharger le modèle PDF</Button>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <div className="hidden md:grid grid-cols-4 gap-2 px-3 pb-2 ml-12 text-xs font-semibold text-muted-foreground border-b border-border">
                <span>Entité</span><span>Type</span><span>Pays</span><span>Référent PCA</span>
              </div>
              <div className="mt-2">
                {tree.map((n) => (<Node key={n.id} node={n} depth={0} onDelete={handleDelete} onSelect={openPanel} onQuickAdd={handleQuickAdd} />))}
              </div>
            </>
          ) : (
            <TaxonomyTab
              entities={entities as Entity[]}
              processes={processes}
              onOpenImport={() => setImportOpen(true)}
              onDownloadTemplate={downloadGenericTemplate}
              onNavigateToBIA={navigateToBIA}
            />
          )}
        </CardContent>
      </Card>

      <ImportExcelDialog
        open={importOpen}
        onOpenChange={setImportOpen}
        entities={entities as Entity[]}
        onImported={async () => {
          await reloadEntities();
          await reloadBiaProcesses();
        }}
      />

      <Sheet open={quickAddOpen} onOpenChange={(o) => { if (!o) { setQuickAddOpen(false); setQuickAddForm(emptyForm); } }}>
        <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
          {(() => {
            const parent = entities.find(e => e.id === quickAddParentId);
            const typeLabel = (quickAddType as string) === "DIRECTION" ? "direction" : (quickAddType as string) === "SERVICE" ? "service" : (quickAddType as string) === "DÉPARTEMENT" ? "département" : "entité";
            return (
              <div className="space-y-5">
                <SheetHeader>
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-lg bg-[#2A5141]/15 flex items-center justify-center"><PlusCircle className="h-5 w-5 text-[#2A5141]" /></div>
                    <div>
                      <SheetTitle className="text-[#172030]" style={{ fontFamily: "'Playfair Display', serif" }}>Nouvelle {typeLabel}</SheetTitle>
                      <SheetDescription className="text-xs">{parent ? <>Sous « <span className="font-medium text-[#172030]">{parent.name}</span> » ({parent.type})</> : "Création d'une entité"}</SheetDescription>
                    </div>
                  </div>
                </SheetHeader>
                <div className="space-y-4">
                  <div><Label>Nom <span className="text-destructive">*</span></Label><Input autoFocus value={quickAddForm.name} onChange={(e) => setQuickAddForm({ ...quickAddForm, name: e.target.value })} /></div>
                  <div className="grid grid-cols-2 gap-3">
                    <div><Label>Type</Label><Input value={quickAddType} disabled className="bg-muted/50" /></div>
                    <div><Label>Pays</Label><Input value={quickAddForm.country} onChange={(e) => setQuickAddForm({ ...quickAddForm, country: e.target.value })} /></div>
                  </div>
                </div>
                <div className="flex justify-end gap-2 pt-3 border-t border-border">
                  <Button variant="ghost" onClick={() => { setQuickAddOpen(false); setQuickAddForm(emptyForm); }} disabled={isSubmittingQuickAdd}><X className="h-4 w-4 mr-1" /> Annuler</Button>
                  <Button onClick={submitQuickAdd} disabled={isSubmittingQuickAdd || !quickAddForm.name.trim()} className="bg-[#2A5141] hover:bg-[#1a3329] text-white">
                    {isSubmittingQuickAdd ? (<><Loader2 className="h-4 w-4 mr-1 animate-spin" /> Création...</>) : (<><Plus className="h-4 w-4 mr-1" /> Créer la {typeLabel}</>)}
                  </Button>
                </div>
              </div>
            );
          })()}
        </SheetContent>
      </Sheet>

      <Sheet open={!!panelEntity} onOpenChange={(o) => { if (!o) { setPanelId(null); setEditing(false); } }}>
        <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
          {panelEntity && (() => {
            const m = panelEntity.maturity;
            const isLow = isLowLevel(panelEntity.type);
            const isDir = isDirection(panelEntity.type);
            const isFil = isFiliale(panelEntity.type);
            return (
              <div className="space-y-5">
                <SheetHeader>
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 rounded-lg bg-primary/15 flex items-center justify-center"><Building2 className="h-5 w-5 text-primary" /></div>
                      <div><SheetTitle>{panelEntity.name}</SheetTitle><SheetDescription>{panelEntity.type || "—"}</SheetDescription></div>
                    </div>
                    {!editing && (
                      <div className="flex gap-1">
                        {can("write") && <Button variant="outline" size="sm" onClick={() => setEditing(true)}><Pencil className="h-3.5 w-3.5 mr-1" /> Éditer</Button>}
                        {can("admin") && <Button variant="outline" size="sm" className="text-destructive border-destructive/40 hover:bg-destructive/10" onClick={() => handleDelete(panelEntity.id)}><Trash2 className="h-3.5 w-3.5 mr-1" /> Supprimer</Button>}
                      </div>
                    )}
                  </div>
                </SheetHeader>
                {editing ? (
                  <div className="space-y-4">
                    {renderFormGrid(editForm, setEditForm, panelEntity.id)}
                    <div className="flex justify-end gap-2 pt-2 border-t border-border">
                      <Button variant="ghost" onClick={() => setEditing(false)}><X className="h-4 w-4 mr-1" /> Annuler</Button>
                      <Button onClick={saveEdit}><Save className="h-4 w-4 mr-1" /> Enregistrer</Button>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="space-y-2">
                      <h4 className="text-xs font-semibold text-muted-foreground uppercase">Détails</h4>
                      <div className="grid grid-cols-2 gap-2 text-sm">
                        <div className="text-muted-foreground">Type</div><div className="font-medium">{panelEntity.type || "—"}</div>
                        <div className="text-muted-foreground">Pays</div><div className="font-medium">{panelEntity.country}</div>
                        <div className="text-muted-foreground">Parent</div><div className="font-medium">{panelParent?.name || "Racine"}</div>
                      </div>
                    </div>
                    <div className="space-y-2">
                      <div className="flex items-center justify-between"><h4 className="text-xs font-semibold text-muted-foreground uppercase">Maturité PCA</h4><span className="text-sm font-bold">{typeof m === "number" && Number.isFinite(m) ? `${m}%` : "Non calculable"}</span></div>
                      {typeof m === "number" && Number.isFinite(m) && <div className="h-3 w-full rounded-full bg-secondary overflow-hidden"><div className="h-full transition-all bg-primary" style={{ width: `${Math.max(0, Math.min(m, 100))}%` }} /></div>}
                      {typeof m !== "number" && <p className="text-xs text-muted-foreground">Aucune donnée de maturité n’est enregistrée pour cette entité.</p>}
                    </div>
                    {isFil && panelChildren.length > 0 && (<div className="space-y-3"><h4 className="text-sm font-semibold">Directions ({panelChildren.length})</h4>{renderChildren(panelChildren, panelEntity.type)}</div>)}
                    {isLow && (
                      <div className="space-y-3">
                        <h4 className="text-sm font-semibold">Processus associés ({panelProcesses.length})</h4>
                        {panelProcesses.length === 0 ? (
                          <p className="text-sm text-muted-foreground italic">Aucun processus rattaché.</p>
                        ) : (
                          <div className="overflow-auto max-h-64 border rounded-lg">
                            <Table>
                              <TableHeader><TableRow className="bg-muted/30"><TableHead>Processus</TableHead><TableHead className="text-center">RTO</TableHead><TableHead>Criticité</TableHead></TableRow></TableHeader>
                              <TableBody>
                                {panelProcesses.map(p => {
                                  const criticality = scoreToCriticality(computeMaxScore(p.impacts));
                                  return (<TableRow key={p.id} className="cursor-pointer hover:bg-[#F8F6F2]" onClick={() => navigateToBIA(p.id)}><TableCell className="font-medium">{p.name}</TableCell><TableCell className="text-center">{p.rto}h</TableCell><TableCell><Badge className={criticalityColor(criticality)}>{criticality}</Badge></TableCell></TableRow>);
                                })}
                              </TableBody>
                            </Table>
                          </div>
                        )}
                        <Button variant="outline" size="sm" className="w-full mt-2 gap-2" onClick={navigateToInventory}><ExternalLink className="h-4 w-4" /> Accéder à l'inventaire</Button>
                      </div>
                    )}
                  </>
                )}
              </div>
            );
          })()}
        </SheetContent>
      </Sheet>
    </div>
  );
};

export default OrgChart;
