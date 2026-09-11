// ============================================================
// Parseur de fichier BIA au format BPCE (modèle standard bancaire)
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
    if (/semaine/.test(raw)) return 168;
    if (/mois/.test(raw)) return 720;
    if (/jour|journ/.test(raw)) return 24;
    if (/heure/.test(raw)) return 1;
    const num = parseFloat(raw.replace(",", "."));
    return Number.isFinite(num) ? num : null;
  }
  return total > 0 ? total : null;
};

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

/**
 * ✅ Nettoie un nom de ressource : tronque les descriptions longues.
 * Ex: "Dépositaires (Envoi en automatique des messages de paiement RL titres — T ; PEE : Non ; prestation critique : Oui.)"
 *     → name = "Dépositaires"
 *     → detail = "Envoi en automatique des messages..."
 */
const cleanResourceName = (raw: string): { name: string; detail: string } => {
  const cleaned = norm(raw);
  if (!cleaned) return { name: "", detail: "" };

  // Détecte une parenthèse avec du contenu descriptif long
  const parenMatch = cleaned.match(/^([^(]{2,80}?)\s*\((.{10,})\)\s*$/);
  if (parenMatch) {
    return {
      name: parenMatch[1].trim().slice(0, 80),
      detail: parenMatch[2].trim().slice(0, 500),
    };
  }

  // Détecte un tiret long " — " avec description après
  const dashMatch = cleaned.match(/^([^—]{2,80}?)\s*—\s*(.{10,})$/);
  if (dashMatch) {
    return {
      name: dashMatch[1].trim().slice(0, 80),
      detail: dashMatch[2].trim().slice(0, 500),
    };
  }

  // Nom "normal" : on tronque à 80 caractères max
  if (cleaned.length > 80) {
    const cut = cleaned.slice(0, 77);
    const lastSpace = cut.lastIndexOf(" ");
    return {
      name: (lastSpace > 40 ? cut.slice(0, lastSpace) : cut) + "…",
      detail: cleaned,
    };
  }
  return { name: cleaned, detail: "" };
};

/**
 * Filtre les ressources bidon ("Fournisseur 1", "N/A", vides...)
 */
const isBogusResourceName = (name: string): boolean => {
  const n = name.trim().toLowerCase();
  if (!n) return true;
  if (n === "n/a" || n === "na" || n === "-" || n === "?" || n === "0") return true;
  if (/^\d+$/.test(n)) return true;
  if (/^(fournisseur|fourn|collaborateur|collab|ressource|prestataire|app|application)\s*\d*$/.test(n)) return true;
  return false;
};

const sheetRows = (wb: XLSX.WorkBook, name: string): any[][] => {
  const match = wb.SheetNames.find((n) => lower(n) === lower(name)) ||
    wb.SheetNames.find((n) => lower(n).includes(lower(name).split(" ")[0]));
  if (!match) return [];
  const ws = wb.Sheets[match];
  if (!ws) return [];
  return XLSX.utils.sheet_to_json<any[]>(ws, { header: 1, defval: "", blankrows: true });
};

const DELAY_TO_PERIODS: (TimePeriod[] | null)[] = [
  ["P0_4H", "P4_8H"],
  ["P1D"],
  ["P2D"],
  ["P1W"],
  ["P2W"],
  ["P1M"],
  null,
];

const AXIS_ROW_MAP: { matches: string[]; axis: ImpactAxis }[] = [
  { matches: ["image", "réputation", "reputation"], axis: "reputation" },
  { matches: ["financ"], axis: "financial" },
  { matches: ["organis"], axis: "operational" },
  { matches: ["juridi", "réglement", "reglement", "conform"], axis: "regulatory" },
  { matches: ["client"], axis: "client" },
];

const detectAxisFromRow = (row: any[]): ImpactAxis | null => {
  if (!row) return null;
  const maxCols = Math.min(row.length, 7);
  for (let c = 0; c < maxCols; c++) {
    const cell = lower(row[c]);
    if (!cell) continue;
    if (/^activit/.test(cell)) continue;
    if (/^\d+([.,]\d+)?$/.test(cell)) continue;
    for (const mapping of AXIS_ROW_MAP) {
      if (mapping.matches.some((m) => cell.includes(m))) {
        return mapping.axis;
      }
    }
  }
  return null;
};

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

  report("Calcul des matrices d'impact…", 3);
  const impactRows = sheetRows(wb, "Impacts IFOJR");
  const axisRows: { axis: ImpactAxis; row: any[] }[] = [];
  for (const row of impactRows) {
    const axis = detectAxisFromRow(row);
    if (axis) axisRows.push({ axis, row });
  }

  const AXES_PER_ACTIVITY = 5;
  for (let a = 0; a < activities.length; a++) {
    const block = axisRows.slice(a * AXES_PER_ACTIVITY, a * AXES_PER_ACTIVITY + AXES_PER_ACTIVITY);
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

  report("Détection des ressources…", 5);

  // Collaborateurs
  const collabRows = sheetRows(wb, "Collaborateurs");
  const collabActCol = findActivityColumn(collabRows[7] || collabRows[6] || []);
  let collabFound = false;
  for (let i = 8; i < collabRows.length; i++) {
    const row = collabRows[i] || [];
    const rawNom = norm(row[1]);
    if (!rawNom || isBogusResourceName(rawNom)) continue;
    const { name: nom } = cleanResourceName(rawNom);
    if (!nom) continue;
    const actRef = collabActCol >= 0 ? norm(row[collabActCol]) : "";
    const idx = actRef ? matchActivityIndex(actRef, names) : -1;
    const targets = idx >= 0 ? [idx] : activities.map((_, k) => k);
    for (const t of targets) {
      activities[t].collaborators.push({ nom, prenom: norm(row[2]), fonction: norm(row[4]) });
    }
    collabFound = true;
  }

  // Applications
  const appRows = sheetRows(wb, "Applications");
  const appHeader = appRows[5] || appRows[4] || [];
  const appActCol = findActivityColumn(appHeader);
  const dmidCol = appHeader.findIndex((c) => lower(c).includes("dmid"));
  const pmddCol = appHeader.findIndex((c) => lower(c).includes("pmdd"));
  let appFound = false;
  for (let i = 6; i < appRows.length; i++) {
    const row = appRows[i] || [];
    const rawName = norm(row[0]);
    if (!rawName || isBogusResourceName(rawName)) continue;
    if (lower(rawName).includes("nom de l'application")) continue;
    const { name, detail } = cleanResourceName(rawName);
    if (!name) continue;
    const actRef = appActCol >= 0 ? norm(row[appActCol]) : "";
    const idx = actRef ? matchActivityIndex(actRef, names) : -1;
    const targets = idx >= 0 ? [idx] : activities.map((_, k) => k);
    const app: ParsedApplication = {
      name,
      description: detail || norm(row[1]),
      rto_hours: dmidCol >= 0 ? parseFrenchDuration(row[dmidCol]) : null,
      rpo_hours: pmddCol >= 0 ? parseFrenchDuration(row[pmddCol]) : null,
    };
    for (const t of targets) activities[t].applications.push({ ...app });
    appFound = true;
  }

  // Fournisseurs — ✅ NETTOYAGE du nom (retire la description entre parenthèses)
  const suppRows = sheetRows(wb, "Fournisseurs");
  const suppActCol = findActivityColumn(suppRows[8] || suppRows[7] || []);
  let suppFound = false;
  for (let i = 9; i < suppRows.length; i++) {
    const row = suppRows[i] || [];
    const rawName = norm(row[0]);
    if (!rawName || isBogusResourceName(rawName)) continue;
    const { name, detail } = cleanResourceName(rawName);
    if (!name) continue;
    const actRef = suppActCol >= 0 ? norm(row[suppActCol]) : "";
    const idx = actRef ? matchActivityIndex(actRef, names) : -1;
    const targets = idx >= 0 ? [idx] : activities.map((_, k) => k);
    const supp: ParsedSupplier = {
      name,
      detail: detail || norm(row[1]),  // ✅ description courte séparée
      rto_hours: parseFrenchDuration(row[17]),
    };
    for (const t of targets) activities[t].suppliers.push({ ...supp });
    suppFound = true;
  }

  return activities;
};