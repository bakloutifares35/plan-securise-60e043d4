// ============================================================
// Parseur de fichier BIA au format BPCE (modèle standard bancaire)
// Utilisé par BiaExcelImport.tsx
// ============================================================
import * as XLSX from "xlsx";
import { emptyImpacts, type ImpactMatrix, type TimePeriod, type ImpactAxis } from "@/data/bia";

export type ParsedCollaborator = { nom: string; prenom: string; fonction: string };
export type ParsedApplication = { name: string; description: string; rto_hours: number | null; rpo_hours: number | null };
export type ParsedSupplier = { name: string; detail: string; rto_hours: number | null };

export type ParsedActivity = {
  key: string;
  name: string;
  description: string;
  owner: string;
  dependance: string;
  impacts: ImpactMatrix;
  filledCells: number;
  rtoDeclared: number | null;
  periodeCritique: string;
  collaborators: ParsedCollaborator[];
  applications: ParsedApplication[];
  suppliers: ParsedSupplier[];
  warnings: string[];
};

export type ParseProgress = (step: string, done: number, total: number) => void;

/**
 * Convertit une durée exprimée en français ("2 jours", "1 semaine") en heures.
 */
export const parseFrenchDuration = (text: any): number | null => {
  if (text === null || text === undefined) return null;
  const raw = String(text).toLowerCase().trim();
  if (!raw) return null;

  let total = 0;
  let found = false;
  const units: { re: RegExp; factor: number }[] = [
    { re: /(\d+(?:[.,]\d+)?)\s*(?:h\b|heure)/g, factor: 1 },
    { re: /(\d+(?:[.,]\d+)?)\s*(?:j\b|jour)/g, factor: 24 },
    { re: /(\d+(?:[.,]\d+)?)\s*semaine/g, factor: 168 },
    { re: /(\d+(?:[.,]\d+)?)\s*mois/g, factor: 720 },
  ];

  for (const u of units) {
    let m: RegExpExecArray | null;
    while ((m = u.re.exec(raw)) !== null) {
      total += parseFloat(m[1].replace(",", ".")) * u.factor;
      found = true;
    }
  }

  if (!found) {
    // Formes sans quantité explicite : "une journée", "un mois"...
    if (/semaine/.test(raw)) return 168;
    if (/mois/.test(raw)) return 720;
    if (/jour|journ/.test(raw)) return 24;
    if (/heure/.test(raw)) return 1;
    const num = parseFloat(raw.replace(",", "."));
    return Number.isFinite(num) ? num : null;
  }

  return total > 0 ? total : null;
};

// Échelle fichier (0-4) -> échelle Resillia (0-5)
const SCALE_MAP: Record<number, number> = { 0: 0, 1: 1, 2: 2, 3: 3, 4: 5 };

const parseScore = (cell: any): number | null => {
  if (cell === null || cell === undefined || cell === "") return null;
  if (typeof cell === "number") return SCALE_MAP[Math.max(0, Math.min(4, Math.round(cell)))] ?? 0;
  const m = String(cell).trim().match(/^(\d)/);
  if (!m) return null;
  return SCALE_MAP[Math.max(0, Math.min(4, parseInt(m[1], 10)))] ?? 0;
};

const norm = (v: any) => String(v ?? "").trim();
const lower = (v: any) => norm(v).toLowerCase();

const sheetRows = (wb: XLSX.WorkBook, name: string): any[][] => {
  const match = wb.SheetNames.find((n) => lower(n) === lower(name)) ||
    wb.SheetNames.find((n) => lower(n).includes(lower(name).split(" ")[0]));
  if (!match) return [];
  const ws = wb.Sheets[match];
  if (!ws) return [];
  return XLSX.utils.sheet_to_json<any[]>(ws, { header: 1, defval: "", blankrows: true });
};

// Colonnes D..J -> périodes Resillia (">1mois" ignoré)
const DELAY_TO_PERIODS: (TimePeriod[] | null)[] = [
  ["P0_4H", "P4_8H"],
  ["P1D"],
  ["P2D"],
  ["P1W"],
  ["P2W"],
  ["P1M"],
  null,
];

const AXIS_ROW_MAP: { match: string; axis: ImpactAxis }[] = [
  { match: "image", axis: "reputation" },
  { match: "financ", axis: "financial" },
  { match: "organis", axis: "operational" },
  { match: "juridi", axis: "regulatory" },
  { match: "réglement", axis: "regulatory" },
  { match: "reglement", axis: "regulatory" },
];

const findActivityColumn = (headerRow: any[]): number => {
  if (!headerRow) return -1;
  return headerRow.findIndex((c) => lower(c).includes("activit"));
};

const matchActivityIndex = (value: string, activityNames: string[]): number => {
  const v = lower(value);
  if (!v) return -1;
  const byName = activityNames.findIndex((n) => lower(n) && (lower(n) === v || v.includes(lower(n)) || lower(n).includes(v)));
  if (byName !== -1) return byName;
  const num = v.match(/(\d+)/);
  if (num) {
    const idx = parseInt(num[1], 10) - 1;
    if (idx >= 0 && idx < activityNames.length) return idx;
  }
  return -1;
};

export const parseBpceWorkbook = (buffer: ArrayBuffer, onProgress?: ParseProgress): ParsedActivity[] => {
  const TOTAL = 5;
  const report = (label: string, n: number) => onProgress?.(label, n, TOTAL);

  report("Lecture du fichier…", 1);
  const wb = XLSX.read(buffer, { type: "array" });

  // ---------- 1. Identification Activité ----------
  report("Extraction des activités…", 2);
  const idRows = sheetRows(wb, "Identification Activité");
  const activities: ParsedActivity[] = [];

  for (let i = 13; i < idRows.length; i++) {
    const row = idRows[i] || [];
    const name = norm(row[1]);
    if (!name) continue;
    if (lower(name).startsWith("nom de l") || lower(name) === "activité") continue;
    const dependance = norm(row[6]);
    let description = norm(row[3]);
    if (dependance) {
      description = `${description}${description ? "\n\n" : ""}[Dépendance déclarée BIA source] : ${dependance}`;
    }
    activities.push({
      key: `act-${activities.length}`,
      name,
      description,
      owner: norm(row[9]),
      dependance,
      impacts: emptyImpacts(),
      filledCells: 0,
      rtoDeclared: null,
      periodeCritique: "",
      collaborators: [],
      applications: [],
      suppliers: [],
      warnings: [],
    });
  }

  if (activities.length === 0) return [];
  const names = activities.map((a) => a.name);

  // ---------- 2. Matrice d'impact (Impacts IFOJR) ----------
  report("Calcul des matrices d'impact…", 3);
  const impactRows = sheetRows(wb, "Impacts IFOJR");
  const axisRows: { axis: ImpactAxis; row: any[] }[] = [];
  for (const row of impactRows) {
    const label = lower(row?.[0]) || lower(row?.[1]) || lower(row?.[2]);
    if (!label) continue;
    const hit = AXIS_ROW_MAP.find((m) => label.includes(m.match));
    if (hit) axisRows.push({ axis: hit.axis, row });
  }

  for (let a = 0; a < activities.length; a++) {
    const block = axisRows.slice(a * 5, a * 5 + 5);
    if (block.length === 0) {
      activities[a].warnings.push("Matrice d'impact non trouvée");
      continue;
    }
    const impacts = activities[a].impacts;
    let filled = 0;
    for (const { axis, row } of block) {
      for (let d = 0; d < DELAY_TO_PERIODS.length; d++) {
        const periods = DELAY_TO_PERIODS[d];
        if (!periods) continue;
        const score = parseScore(row[3 + d]);
        if (score === null) continue;
        filled++;
        for (const p of periods) {
          impacts[p][axis] = Math.max(impacts[p][axis] || 0, score);
        }
      }
    }
    activities[a].filledCells = Math.min(filled, 28);
  }

  // ---------- 3. DMIA (RTO déclaré) ----------
  report("Lecture des durées d'interruption (DMIA)…", 4);
  const dmiaRows = sheetRows(wb, "DMIA");
  const durations: number[] = [];
  for (const row of dmiaRows) {
    const v = norm(row?.[2]);
    if (!v) continue;
    if (lower(v).includes("dmia") || lower(v).includes("durée")) continue;
    const h = parseFrenchDuration(v);
    if (h !== null) durations.push(h);
  }
  activities.forEach((act, i) => {
    act.rtoDeclared = durations[i] ?? null;
    if (act.rtoDeclared === null) act.warnings.push("DMIA non trouvée");
  });

  // ---------- 3bis. Période critique ----------
  const critRows = sheetRows(wb, "Criticité");
  const headerIdx = critRows.findIndex((r) => (r || []).some((c) => lower(c).includes("matin")));
  if (headerIdx !== -1) {
    const labels = critRows[headerIdx] || [];
    const dataRows = critRows.slice(headerIdx + 1).filter((r) => (r || []).some((c) => norm(c) !== ""));
    activities.forEach((act, i) => {
      const row = dataRows[i];
      if (!row) return;
      const picked: string[] = [];
      for (let c = 3; c <= 14; c++) {
        const val = lower(row[c]);
        const label = norm(labels[c]);
        if (!label) continue;
        if (val && val !== "0" && val !== "non" && val !== "false") picked.push(label);
      }
      act.periodeCritique = picked.join(", ");
    });
  } else {
    activities.forEach((a) => a.warnings.push("Période critique non trouvée"));
  }

  // ---------- 4. Ressources ----------
  report("Détection des ressources…", 5);

  // Collaborateurs (ligne 9+)
  const collabRows = sheetRows(wb, "Collaborateurs");
  const collabActCol = findActivityColumn(collabRows[7] || collabRows[6] || []);
  let collabFound = false;
  for (let i = 8; i < collabRows.length; i++) {
    const row = collabRows[i] || [];
    const nom = norm(row[1]);
    if (!nom) continue;
    const actRef = collabActCol >= 0 ? norm(row[collabActCol]) : "";
    const idx = actRef ? matchActivityIndex(actRef, names) : -1;
    const targets = idx >= 0 ? [idx] : activities.map((_, k) => k);
    for (const t of targets) {
      activities[t].collaborators.push({ nom, prenom: norm(row[2]), fonction: norm(row[4]) });
    }
    collabFound = true;
  }
  if (!collabFound) activities.forEach((a) => a.warnings.push("Collaborateurs non trouvés"));

  // Applications (ligne 7+)
  const appRows = sheetRows(wb, "Applications");
  const appHeader = appRows[5] || appRows[4] || [];
  const appActCol = findActivityColumn(appHeader);
  const dmidCol = appHeader.findIndex((c) => lower(c).includes("dmid"));
  const pmddCol = appHeader.findIndex((c) => lower(c).includes("pmdd"));
  let appFound = false;
  for (let i = 6; i < appRows.length; i++) {
    const row = appRows[i] || [];
    const name = norm(row[0]);
    if (!name) continue;
    if (lower(name).includes("nom de l'application")) continue;
    const actRef = appActCol >= 0 ? norm(row[appActCol]) : "";
    const idx = actRef ? matchActivityIndex(actRef, names) : -1;
    const targets = idx >= 0 ? [idx] : activities.map((_, k) => k);
    const app: ParsedApplication = {
      name,
      description: norm(row[1]),
      rto_hours: dmidCol >= 0 ? parseFrenchDuration(row[dmidCol]) : null,
      rpo_hours: pmddCol >= 0 ? parseFrenchDuration(row[pmddCol]) : null,
    };
    for (const t of targets) activities[t].applications.push({ ...app });
    appFound = true;
  }
  if (!appFound) activities.forEach((a) => a.warnings.push("Applications non trouvées"));

  // Fournisseurs (ligne 10+)
  const suppRows = sheetRows(wb, "Fournisseurs");
  const suppActCol = findActivityColumn(suppRows[8] || suppRows[7] || []);
  let suppFound = false;
  for (let i = 9; i < suppRows.length; i++) {
    const row = suppRows[i] || [];
    const name = norm(row[0]);
    if (!name) continue;
    const actRef = suppActCol >= 0 ? norm(row[suppActCol]) : "";
    const idx = actRef ? matchActivityIndex(actRef, names) : -1;
    const targets = idx >= 0 ? [idx] : activities.map((_, k) => k);
    const supp: ParsedSupplier = {
      name,
      detail: norm(row[1]),
      rto_hours: parseFrenchDuration(row[17]),
    };
    for (const t of targets) activities[t].suppliers.push({ ...supp });
    suppFound = true;
  }
  if (!suppFound) activities.forEach((a) => a.warnings.push("Prestataires non trouvés"));

  return activities;
};
