import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { 
  AlertCircle, Database, Clock, Server, TrendingUp, AlertTriangle, 
  Building2, Activity, Globe, Shield, Download, RefreshCw,
  Users, Monitor, Handshake, FileText, CheckCircle, XCircle,
  ChevronDown, ChevronRight, Package, Wifi, HardDrive, Cpu,
  Printer, FileSpreadsheet
} from 'lucide-react';
import { useBia } from '@/contexts/BiaContext';
import { useGovernance } from '@/contexts/GovernanceContext';
import { supabase } from '@/integrations/supabase/client';
import { cn } from '@/lib/utils';
import { scoreToCriticality, criticalityColor } from '@/data/bia';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { toast } from '@/hooks/use-toast';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

// Types
interface ProcessWithResources {
  id: string;
  name: string;
  department: string;
  entityId: string;
  owner: string;
  rto: number;
  rpo: number;
  mtpd: number;
  impacts: any;
  depends_on: string[];
  linkedHR: any[];
  linkedEquipment: any[];
  linkedApps: any[];
  linkedSuppliers: any[];
}

interface ImpactSeverity {
  financier: number;
  conformite: number;
  operationnel: number;
  reputationnel: number;
}

interface DirectionDetail {
  services: Set<string>;
  count: number;
  critiques: number;
  complet: number;
  apps: Set<string>;
  suppliers: Set<string>;
  rtoMin: number;
  processes: ProcessWithResources[];
}

const BIASynthesis: React.FC = () => {
  const { processes } = useBia();
  const { entities } = useGovernance();
  const contentRef = useRef<HTMLDivElement>(null);
  
  const [isLoading, setIsLoading] = useState(true);
  const [enrichedProcesses, setEnrichedProcesses] = useState<ProcessWithResources[]>([]);
  const [allHR, setAllHR] = useState<any[]>([]);
  const [allEquipment, setAllEquipment] = useState<any[]>([]);
  const [allApps, setAllApps] = useState<any[]>([]);
  const [allSuppliers, setAllSuppliers] = useState<any[]>([]);
  const [expandedDirections, setExpandedDirections] = useState<Set<string>>(new Set());
  const [isExporting, setIsExporting] = useState(false);

  // ============================================================
  // 1. CHARGEMENT DES DONNÉES SUPABASE
  // ============================================================
  const loadAllResources = useCallback(async () => {
    setIsLoading(true);
    try {
      const processIds = processes.map(p => p.id);
      
      if (processIds.length === 0) {
        setIsLoading(false);
        return;
      }

      const { data: hrLinks } = await supabase
        .from('processus_ressources_humaines')
        .select('processus_id, ressource_humaine_id')
        .in('processus_id', processIds);

      const hrIds = hrLinks ? hrLinks.map(l => l.ressource_humaine_id) : [];
      let hrData: any[] = [];
      if (hrIds.length > 0) {
        const { data } = await supabase
          .from('ressources_humaines')
          .select('*')
          .in('id', hrIds);
        hrData = data || [];
      }

      const { data: equipLinks } = await supabase
        .from('processus_equipements')
        .select('processus_id, equipement_id, rto_hours')
        .in('processus_id', processIds);

      const equipIds = equipLinks ? equipLinks.map(l => l.equipement_id) : [];
      let equipData: any[] = [];
      if (equipIds.length > 0) {
        const { data } = await supabase
          .from('ressources_equipements')
          .select('*')
          .in('id', equipIds);
        equipData = data || [];
        equipData = equipData.map(eq => {
          const link = equipLinks?.find(l => l.equipement_id === eq.id);
          return { ...eq, _linkRto: link?.rto_hours || 4 };
        });
      }

      const { data: appLinks } = await supabase
        .from('processus_applications')
        .select('processus_id, application_id, rto_hours, rpo_hours')
        .in('processus_id', processIds);

      const appIds = appLinks ? appLinks.map(l => l.application_id) : [];
      let appData: any[] = [];
      if (appIds.length > 0) {
        const { data } = await supabase
          .from('applications_it')
          .select('*')
          .in('id', appIds);
        appData = data || [];
        appData = appData.map(app => {
          const link = appLinks?.find(l => l.application_id === app.id);
          return { 
            ...app, 
            _linkRto: link?.rto_hours || 4,
            _linkRpo: link?.rpo_hours || 2
          };
        });
      }

      const { data: suppLinks } = await supabase
        .from('processus_fournisseurs')
        .select('processus_id, fournisseur_id, rto_hours')
        .in('processus_id', processIds);

      const suppIds = suppLinks ? suppLinks.map(l => l.fournisseur_id) : [];
      let suppData: any[] = [];
      if (suppIds.length > 0) {
        const { data } = await supabase
          .from('fournisseurs')
          .select('*')
          .in('id', suppIds);
        suppData = data || [];
        suppData = suppData.map(sup => {
          const link = suppLinks?.find(l => l.fournisseur_id === sup.id);
          return { ...sup, _linkRto: link?.rto_hours || 4 };
        });
      }

      setAllHR(hrData);
      setAllEquipment(equipData);
      setAllApps(appData);
      setAllSuppliers(suppData);

      const hrMap: Record<string, any[]> = {};
      const equipMap: Record<string, any[]> = {};
      const appMap: Record<string, any[]> = {};
      const suppMap: Record<string, any[]> = {};

      for (const pid of processIds) {
        hrMap[pid] = [];
        equipMap[pid] = [];
        appMap[pid] = [];
        suppMap[pid] = [];
      }

      if (hrLinks) {
        for (const link of hrLinks) {
          const hr = hrData.find(h => h.id === link.ressource_humaine_id);
          if (hr) hrMap[link.processus_id].push(hr);
        }
      }

      if (equipLinks) {
        for (const link of equipLinks) {
          const eq = equipData.find(e => e.id === link.equipement_id);
          if (eq) equipMap[link.processus_id].push(eq);
        }
      }

      if (appLinks) {
        for (const link of appLinks) {
          const app = appData.find(a => a.id === link.application_id);
          if (app) appMap[link.processus_id].push(app);
        }
      }

      if (suppLinks) {
        for (const link of suppLinks) {
          const sup = suppData.find(s => s.id === link.fournisseur_id);
          if (sup) suppMap[link.processus_id].push(sup);
        }
      }

      const enriched = processes.map(p => ({
        ...p,
        linkedHR: hrMap[p.id] || [],
        linkedEquipment: equipMap[p.id] || [],
        linkedApps: appMap[p.id] || [],
        linkedSuppliers: suppMap[p.id] || [],
      }));

      setEnrichedProcesses(enriched);

    } catch (error) {
      console.error('Erreur chargement ressources:', error);
    } finally {
      setIsLoading(false);
    }
  }, [processes]);

  useEffect(() => {
    loadAllResources();
  }, [loadAllResources]);

  // ============================================================
  // 2. RÉSOLUTION DES NOMS D'ENTITÉS
  // ============================================================
  const getEntityName = useCallback((entityId: string): string => {
    if (!entityId) return 'Non défini';
    const entity = entities.find(e => e.id === entityId);
    return entity?.name || 'Non défini';
  }, [entities]);

  const getFullEntityPath = useCallback((entityId: string): string => {
    if (!entityId) return 'Non défini';
    const entity = entities.find(e => e.id === entityId);
    if (!entity) return 'Non défini';
    
    const path: string[] = [entity.name];
    let parentId = entity.parentId;
    while (parentId) {
      const parent = entities.find(e => e.id === parentId);
      if (parent) {
        path.unshift(parent.name);
        parentId = parent.parentId;
      } else {
        break;
      }
    }
    return path.join(' / ');
  }, [entities]);

  const getDirectionName = useCallback((entityId: string): string => {
    if (!entityId) return 'Non défini';
    const entity = entities.find(e => e.id === entityId);
    if (!entity) return 'Non défini';
    
    let current = entity;
    let parent = entities.find(e => e.id === current.parentId);
    while (parent && parent.parentId !== null) {
      current = parent;
      parent = entities.find(e => e.id === current.parentId);
    }
    return current.name || 'Non défini';
  }, [entities]);

  // ============================================================
  // 3. FONCTIONS DE CALCUL
  // ============================================================
  const computeMaxScore = useCallback((impacts: any): number => {
    if (!impacts) return 0;
    let max = 0;
    for (const period of Object.values(impacts)) {
      if (typeof period === 'object' && period !== null) {
        for (const val of Object.values(period as any)) {
          const num = typeof val === 'number' ? val : parseInt(String(val));
          if (num > max) max = num;
        }
      }
    }
    return max;
  }, []);

  const isProcessComplete = useCallback((p: ProcessWithResources): boolean => {
    const hasImpacts = p.impacts && Object.keys(p.impacts).length > 0;
    const hasResources = p.linkedHR.length > 0 || 
                         p.linkedEquipment.length > 0 || 
                         p.linkedApps.length > 0 || 
                         p.linkedSuppliers.length > 0;
    return hasImpacts && hasResources;
  }, []);

  const countSevereImpacts = useCallback((impacts: any): ImpactSeverity => {
    const result: ImpactSeverity = {
      financier: 0,
      conformite: 0,
      operationnel: 0,
      reputationnel: 0
    };
    
    if (!impacts) return result;
    
    const periodsToCheck = ['P0_4H', 'P4_8H', 'P1D', 'P2D', 'P1W'];
    
    for (const period of periodsToCheck) {
      const periodData = impacts[period];
      if (!periodData || typeof periodData !== 'object') continue;
      
      const financial = periodData.financial || 0;
      const regulatory = periodData.regulatory || 0;
      const operational = periodData.operational || 0;
      const reputation = periodData.reputation || 0;
      
      if (financial >= 4) result.financier++;
      if (regulatory >= 4) result.conformite++;
      if (operational >= 4) result.operationnel++;
      if (reputation >= 4) result.reputationnel++;
    }
    
    return result;
  }, []);

  // ============================================================
  // 4. MÉMOÏSATION DES STATISTIQUES
  // ============================================================
  const stats = useMemo(() => {
    const totalProcessus = enrichedProcesses.length;
    const completeCount = enrichedProcesses.filter(isProcessComplete).length;
    const completude = totalProcessus > 0 ? Math.round((completeCount / totalProcessus) * 100) : 0;
    
    const processusCritiques = enrichedProcesses.filter(p => computeMaxScore(p.impacts) >= 4).length;
    const pourcentageCritique = totalProcessus > 0 ? Math.round((processusCritiques / totalProcessus) * 100) : 0;
    
    const rtoValues = enrichedProcesses.map(p => p.rto || 0);
    const rtoLePlusCourt = rtoValues.length > 0 ? Math.min(...rtoValues) : 0;
    const processAvecRtoLePlusCourt = enrichedProcesses.filter(p => (p.rto || 0) === rtoLePlusCourt).length;
    
    const rtoDistribution = [
      { label: '2h', count: enrichedProcesses.filter(p => (p.rto || 0) <= 2).length },
      { label: '24h', count: enrichedProcesses.filter(p => (p.rto || 0) > 2 && (p.rto || 0) <= 24).length },
      { label: '48h', count: enrichedProcesses.filter(p => (p.rto || 0) > 24 && (p.rto || 0) <= 48).length },
      { label: '120h', count: enrichedProcesses.filter(p => (p.rto || 0) > 48 && (p.rto || 0) <= 120).length },
    ];
    const totalAlerte = rtoDistribution[0].count + rtoDistribution[1].count;
    
    const serviceIds = new Set(enrichedProcesses.map(p => p.entityId));
    const servicesCount = serviceIds.size;
    
    const allAppNames = new Set<string>();
    for (const p of enrichedProcesses) {
      for (const app of p.linkedApps) {
        allAppNames.add(app.name);
      }
    }
    const totalApps = allAppNames.size;
    
    const appsWithoutSLA = enrichedProcesses.flatMap(p => p.linkedApps)
      .filter(app => !app._linkRto || app._linkRto === 0);
    const appsSansSLA = new Set(appsWithoutSLA.map(a => a.name)).size;
    
    const fichesIncompletes = totalProcessus - completeCount;
    
    return {
      totalProcessus,
      completeCount,
      completude,
      processusCritiques,
      pourcentageCritique,
      rtoLePlusCourt,
      processAvecRtoLePlusCourt,
      rtoDistribution,
      totalAlerte,
      servicesCount,
      totalApps,
      appsSansSLA,
      fichesIncompletes,
    };
  }, [enrichedProcesses, computeMaxScore, isProcessComplete]);

  // ============================================================
  // 5. RESSOURCES PAR PALIER DE TEMPS (SIMPLIFIÉ)
  // ============================================================
  const resourcesByTimeframe = useMemo(() => {
    const paliers = [
      { label: '≤ 2H', max: 2 },
      { label: '≤ 24H', max: 24 },
      { label: '≤ 48H', max: 48 },
      { label: '≤ 120H', max: 120 },
      { label: '> 120H', max: Infinity },
    ];

    const resourceTypes = [
      { key: 'hr', label: 'Personnel (FTE)', icon: Users },
      { key: 'postes', label: 'Postes de bureau de secours', icon: Monitor },
      { key: 'equipements', label: 'Équipements', icon: Package },
    ];

    const result: Record<string, Record<string, number>> = {};
    
    for (const rt of resourceTypes) {
      result[rt.key] = {};
      for (const palier of paliers) {
        result[rt.key][palier.label] = 0;
      }
    }

    for (const p of enrichedProcesses) {
      const rto = p.rto || 0;
      
      let processPalier = '> 120H';
      for (const palier of paliers) {
        if (rto <= palier.max) {
          processPalier = palier.label;
          break;
        }
      }

      for (const hr of p.linkedHR) {
        result['hr'][processPalier] = (result['hr'][processPalier] || 0) + 1;
      }

      for (const eq of p.linkedEquipment) {
        const eqType = eq.type?.toLowerCase() || '';
        if (eqType.includes('poste') || eqType.includes('bureau') || eqType.includes('station')) {
          result['postes'][processPalier] = (result['postes'][processPalier] || 0) + (eq.quantity || 1);
        }
      }

      let otherEquipCount = 0;
      for (const eq of p.linkedEquipment) {
        const eqType = eq.type?.toLowerCase() || '';
        if (!eqType.includes('poste') && !eqType.includes('bureau') && !eqType.includes('station')) {
          otherEquipCount += (eq.quantity || 1);
        }
      }
      if (otherEquipCount > 0) {
        result['equipements'][processPalier] = (result['equipements'][processPalier] || 0) + otherEquipCount;
      }
    }

    return {
      paliers,
      data: resourceTypes.map(rt => ({
        ...rt,
        values: paliers.map(p => result[rt.key][p.label] || 0)
      }))
    };
  }, [enrichedProcesses]);

  // ============================================================
  // 6. TOP APPLICATIONS
  // ============================================================
  const topApps = useMemo(() => {
    const appCount: Record<string, { count: number; rto: number; sla: boolean }> = {};
    
    for (const p of enrichedProcesses) {
      for (const app of p.linkedApps) {
        if (!appCount[app.name]) {
          appCount[app.name] = { count: 0, rto: app._linkRto || 4, sla: true };
        }
        appCount[app.name].count++;
        if (!app._linkRto || app._linkRto === 0) {
          appCount[app.name].sla = false;
        }
      }
    }
    
    return Object.entries(appCount)
      .sort((a, b) => b[1].count - a[1].count)
      .slice(0, 5)
      .map(([name, data]) => ({ name, ...data }));
  }, [enrichedProcesses]);

  // ============================================================
  // 7. TOP PRESTATAIRES
  // ============================================================
  const topPrestataires = useMemo(() => {
    const suppCount: Record<string, { count: number; rto: number }> = {};
    
    for (const p of enrichedProcesses) {
      for (const sup of p.linkedSuppliers) {
        if (!suppCount[sup.name]) {
          suppCount[sup.name] = { count: 0, rto: sup._linkRto || 4 };
        }
        suppCount[sup.name].count++;
      }
    }
    
    return Object.entries(suppCount)
      .sort((a, b) => b[1].count - a[1].count)
      .slice(0, 5)
      .map(([name, data]) => ({ name, ...data }));
  }, [enrichedProcesses]);

  // ============================================================
  // 8. TOP ÉQUIPEMENTS
  // ============================================================
  const topEquipements = useMemo(() => {
    const equipCount: Record<string, { count: number; type: string; rto: number }> = {};
    
    for (const p of enrichedProcesses) {
      for (const eq of p.linkedEquipment) {
        if (!equipCount[eq.name]) {
          equipCount[eq.name] = { count: 0, type: eq.type || 'Équipement', rto: eq._linkRto || 4 };
        }
        equipCount[eq.name].count += (eq.quantity || 1);
      }
    }
    
    return Object.entries(equipCount)
      .sort((a, b) => b[1].count - a[1].count)
      .slice(0, 5)
      .map(([name, data]) => ({ name, ...data }));
  }, [enrichedProcesses]);

  // ============================================================
  // 9. DÉTAIL PAR DIRECTION
  // ============================================================
  const directionsDetail = useMemo(() => {
    const result: Record<string, DirectionDetail> = {};
    
    for (const p of enrichedProcesses) {
      const direction = getDirectionName(p.entityId);
      if (!result[direction]) {
        result[direction] = {
          services: new Set<string>(),
          count: 0,
          critiques: 0,
          complet: 0,
          apps: new Set<string>(),
          suppliers: new Set<string>(),
          rtoMin: Infinity,
          processes: []
        };
      }
      
      const detail = result[direction];
      detail.services.add(p.entityId);
      detail.count++;
      detail.processes.push(p);
      
      if (computeMaxScore(p.impacts) >= 4) detail.critiques++;
      if (isProcessComplete(p)) detail.complet++;
      
      for (const app of p.linkedApps) {
        detail.apps.add(app.name);
      }
      for (const sup of p.linkedSuppliers) {
        detail.suppliers.add(sup.name);
      }
      
      const rto = p.rto || 0;
      if (rto < detail.rtoMin) detail.rtoMin = rto;
    }
    
    for (const key of Object.keys(result)) {
      if (result[key].rtoMin === Infinity) result[key].rtoMin = 0;
    }
    
    return result;
  }, [enrichedProcesses, getDirectionName, computeMaxScore, isProcessComplete]);

 // ============================================================
// 10. EXPORT PDF (SIMPLIFIÉ ET NET)
// ============================================================
const exportPDF = useCallback(async () => {
  if (enrichedProcesses.length === 0) {
    toast({
      title: "Erreur",
      description: "Aucune donnée à exporter",
      variant: "destructive"
    });
    return;
  }

  setIsExporting(true);
  
  try {
    const doc = new jsPDF({
      orientation: 'landscape',
      unit: 'mm',
      format: 'a4'
    });

    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const margin = 10;
    let y = margin;
    let pageNumber = 1;

    const addNewPage = () => {
      doc.addPage();
      y = margin;
      pageNumber++;
    };

    // ===== EN-TÊTE =====
    doc.setFillColor(42, 81, 65);
    doc.rect(0, 0, pageWidth, 20, 'F');
    
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(18);
    doc.setFont('helvetica', 'bold');
    doc.text('Synthèse BIA consolidée', margin, 14);
    
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.text(
      `Généré le ${new Date().toLocaleDateString('fr-FR')}`,
      pageWidth - margin - 45,
      14
    );

    y = 30;

    // ===== CARTES STATISTIQUES =====
    const cardWidth = (pageWidth - margin * 2) / 4 - 3;
    
    const safeStats = {
      totalProcessus: stats?.totalProcessus ?? 0,
      servicesCount: stats?.servicesCount ?? 0,
      processusCritiques: stats?.processusCritiques ?? 0,
      pourcentageCritique: stats?.pourcentageCritique ?? 0,
      rtoLePlusCourt: stats?.rtoLePlusCourt ?? 0,
      processAvecRtoLePlusCourt: stats?.processAvecRtoLePlusCourt ?? 0,
      totalApps: stats?.totalApps ?? 0,
      appsSansSLA: stats?.appsSansSLA ?? 0,
      completude: stats?.completude ?? 0,
      fichesIncompletes: stats?.fichesIncompletes ?? 0,
      totalAlerte: stats?.totalAlerte ?? 0,
      rtoDistribution: stats?.rtoDistribution ?? [
        { label: '2h', count: 0 },
        { label: '24h', count: 0 },
        { label: '48h', count: 0 },
        { label: '120h', count: 0 }
      ]
    };

    const statCards = [
      { label: 'Processus analysés', value: safeStats.totalProcessus, sub: `sur ${safeStats.servicesCount} services` },
      { label: 'Processus critiques', value: safeStats.processusCritiques, sub: `${safeStats.pourcentageCritique}% du total`, color: [239, 68, 68] },
      { label: 'RTO le plus court', value: `${safeStats.rtoLePlusCourt}h`, sub: `${safeStats.processAvecRtoLePlusCourt} processus` },
      { label: 'Applications IT', value: safeStats.totalApps, sub: `dont ${safeStats.appsSansSLA} sans SLA` }
    ];

    for (let i = 0; i < statCards.length; i++) {
      const card = statCards[i];
      const x = margin + i * (cardWidth + 3);
      
      doc.setFillColor(245, 245, 245);
      doc.rect(x, y, cardWidth, 22, 'F');
      doc.setDrawColor(232, 228, 220);
      doc.rect(x, y, cardWidth, 22, 'S');
      
      doc.setTextColor(23, 32, 48);
      doc.setFontSize(8);
      doc.setFont('helvetica', 'bold');
      doc.text(card.label, x + 3, y + 6);
      
      if (card.color) {
        doc.setTextColor(card.color[0], card.color[1], card.color[2]);
      } else {
        doc.setTextColor(23, 32, 48);
      }
      doc.setFontSize(14);
      doc.text(String(card.value), x + 3, y + 16);
      
      doc.setTextColor(23, 32, 48);
      doc.setFontSize(6);
      doc.setFont('helvetica', 'normal');
      doc.text(card.sub, x + 3, y + 21);
    }

    y += 30;

    // ===== COMPLÉTUDE =====
    doc.setFillColor(248, 246, 242);
    doc.rect(margin, y, pageWidth - margin * 2, 10, 'F');
    doc.setDrawColor(232, 228, 220);
    doc.rect(margin, y, pageWidth - margin * 2, 10, 'S');
    
    doc.setTextColor(23, 32, 48);
    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    doc.text('Complétude globale', margin + 5, y + 7);
    
    const barWidth = 80;
    const barX = margin + 55;
    const barY = y + 2.5;
    
    doc.setDrawColor(232, 228, 220);
    doc.setFillColor(232, 228, 220);
    doc.rect(barX, barY, barWidth, 5, 'F');
    
    const completionColor = safeStats.completude >= 80 ? [42, 81, 65] : 
                            safeStats.completude >= 50 ? [234, 179, 8] : [239, 68, 68];
    doc.setFillColor(completionColor[0], completionColor[1], completionColor[2]);
    const fillWidth = (barWidth * safeStats.completude) / 100;
    doc.rect(barX, barY, fillWidth, 5, 'F');
    
    doc.setTextColor(23, 32, 48);
    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    doc.text(`${safeStats.completude}%`, barX + barWidth + 5, y + 7);

    if (safeStats.fichesIncompletes > 0) {
      doc.setTextColor(234, 179, 8);
      doc.setFontSize(7);
      doc.setFont('helvetica', 'normal');
      doc.text(`${safeStats.fichesIncompletes} fiches incomplètes`, pageWidth - margin - 40, y + 7);
    }

    y += 18;

    // ===== CONCENTRATION DU RISQUE =====
    doc.setFillColor(248, 246, 242);
    doc.rect(margin, y, pageWidth - margin * 2, 28, 'F');
    doc.setDrawColor(232, 228, 220);
    doc.rect(margin, y, pageWidth - margin * 2, 28, 'S');
    
    doc.setTextColor(23, 32, 48);
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.text('Concentration du risque', margin + 5, y + 6);
    doc.setFontSize(6);
    doc.setFont('helvetica', 'normal');
    doc.text('Distribution des RTO - Nombre de processus devant redémarrer dans chaque fenêtre', margin + 5, y + 11);

    const rtoColors = [
      [239, 68, 68],
      [249, 115, 22],
      [234, 179, 8],
      [59, 130, 246]
    ];

    const rtoWidth = (pageWidth - margin * 2 - 20) / 4;
    let rtoX = margin + 5;
    const rtoY = y + 15;

    for (let i = 0; i < safeStats.rtoDistribution.length && i < 4; i++) {
      const r = safeStats.rtoDistribution[i];
      const maxCount = Math.max(1, ...safeStats.rtoDistribution.map(d => d.count));
      const height = 6 + (r.count / maxCount) * 10;
      
      doc.setFillColor(rtoColors[i][0], rtoColors[i][1], rtoColors[i][2]);
      doc.rect(rtoX, rtoY + 10 - height, rtoWidth - 3, height, 'F');
      doc.setDrawColor(232, 228, 220);
      doc.rect(rtoX, rtoY + 10 - height, rtoWidth - 3, height, 'S');
      
      doc.setTextColor(23, 32, 48);
      doc.setFontSize(7);
      doc.setFont('helvetica', 'bold');
      doc.text(`≤ ${r.label}`, rtoX + 2, rtoY + 4);
      doc.setFontSize(11);
      doc.text(`${r.count}`, rtoX + 2, rtoY + 14);
      doc.setFontSize(5);
      doc.setFont('helvetica', 'normal');
      doc.text(`${r.count} processus`, rtoX + 2, rtoY + 19);
      
      rtoX += rtoWidth;
    }

    if (safeStats.totalAlerte > 0) {
      y += 32;
      doc.setFillColor(254, 242, 242);
      doc.rect(margin, y, pageWidth - margin * 2, 8, 'F');
      doc.setDrawColor(254, 202, 202);
      doc.rect(margin, y, pageWidth - margin * 2, 8, 'S');
      
      doc.setTextColor(220, 38, 38);
      doc.setFontSize(7);
      doc.setFont('helvetica', 'normal');
      doc.text(
        `✅ ${safeStats.totalAlerte} processus sur ${safeStats.totalProcessus} exigent une reprise en moins de 24h. Le dispositif de secours doit prioriser cette fenêtre.`,
        margin + 5,
        y + 6
      );
      y += 12;
    }

    // ===== RESSOURCES PAR PALIER =====
    if (resourcesByTimeframe && resourcesByTimeframe.data && resourcesByTimeframe.data.length > 0) {
      y += 3;
      doc.setFillColor(248, 246, 242);
      doc.rect(margin, y, pageWidth - margin * 2, 18, 'F');
      doc.setDrawColor(232, 228, 220);
      doc.rect(margin, y, pageWidth - margin * 2, 18, 'S');
      
      doc.setTextColor(23, 32, 48);
      doc.setFontSize(9);
      doc.setFont('helvetica', 'bold');
      doc.text('Ressources à mobiliser par palier de temps', margin + 5, y + 5);
      doc.setFontSize(5);
      doc.setFont('helvetica', 'normal');
      doc.text('Somme des besoins de tous les processus critiques', margin + 5, y + 9);

      // Utiliser autoTable pour un tableau propre
      const paliers = resourcesByTimeframe.paliers || [];
      const headers = ['RESSOURCE', ...paliers.map(p => p.label || '')];
      
      const body = resourcesByTimeframe.data.map(rt => {
        const values = rt.values || [];
        return [rt.label || '', ...values.map(v => String(v || 0))];
      });

      autoTable(doc, {
        head: [headers],
        body: body,
        startY: y + 12,
        margin: { left: margin + 2, right: margin + 2 },
        styles: { 
          fontSize: 6, 
          cellPadding: 2,
          halign: 'center'
        },
        headStyles: { 
          fillColor: [248, 246, 242], 
          textColor: [23, 32, 48], 
          fontSize: 6, 
          fontStyle: 'bold',
          halign: 'center'
        },
        alternateRowStyles: { fillColor: [250, 250, 249] },
        columnStyles: {
          0: { cellWidth: 35, halign: 'left', fontStyle: 'bold' },
        },
        didDrawPage: (data) => {
          // Ajouter le pied de page sur chaque page
        }
      });

      y = (doc as any).lastAutoTable?.finalY + 8 || y + 40;
    }

    // ===== DÉTAIL PAR DIRECTION =====
    if (Object.keys(directionsDetail).length > 0) {
      // Ajouter une nouvelle page si nécessaire
      if (y > pageHeight - 30) {
        doc.addPage();
        y = margin;
        pageNumber++;
      }

      doc.setFillColor(248, 246, 242);
      doc.rect(margin, y, pageWidth - margin * 2, 8, 'F');
      doc.setDrawColor(232, 228, 220);
      doc.rect(margin, y, pageWidth - margin * 2, 8, 'S');
      doc.setTextColor(23, 32, 48);
      doc.setFontSize(9);
      doc.setFont('helvetica', 'bold');
      doc.text('Détail par direction & département', margin + 5, y + 6);
      y += 10;

      for (const [direction, data] of Object.entries(directionsDetail)) {
        if (y > pageHeight - 30) {
          doc.addPage();
          y = margin;
          pageNumber++;
        }

        const completionRate = data.count > 0 ? Math.round((data.complet / data.count) * 100) : 0;
        
        doc.setFillColor(248, 246, 242);
        doc.rect(margin, y, pageWidth - margin * 2, 8, 'F');
        doc.setDrawColor(232, 228, 220);
        doc.rect(margin, y, pageWidth - margin * 2, 8, 'S');
        
        doc.setTextColor(23, 32, 48);
        doc.setFontSize(7);
        doc.setFont('helvetica', 'bold');
        doc.text(direction, margin + 5, y + 6);
        
        const infoText = `${data.count} Processus · ${data.critiques} Critiques · ${data.apps.size} Applis IT · ${data.suppliers.size} Prestataires · ${completionRate}% Complétude`;
        doc.setTextColor(23, 32, 48);
        doc.setFontSize(5);
        doc.setFont('helvetica', 'normal');
        doc.text(infoText, margin + 55, y + 6);
        
        doc.setTextColor(23, 32, 48);
        doc.setFontSize(5);
        doc.setFont('helvetica', 'bold');
        doc.text(`RTO min: ${data.rtoMin}h`, pageWidth - margin - 25, y + 6);

        y += 10;

        // Tableau des départements
        const deptMap: Record<string, ProcessWithResources[]> = {};
        for (const p of data.processes) {
          const deptName = getEntityName(p.entityId);
          if (!deptMap[deptName]) deptMap[deptName] = [];
          deptMap[deptName].push(p);
        }

        const deptTableData = Object.entries(deptMap).map(([deptName, procs]) => {
          const deptProcesses = procs.length;
          const deptCritiques = procs.filter(p => computeMaxScore(p.impacts) >= 4).length;
          const deptRtoMin = Math.min(...procs.map(p => p.rto || 0));
          const deptApps = new Set<string>();
          const deptSuppliers = new Set<string>();
          let deptComplet = 0;
          
          for (const p of procs) {
            if (isProcessComplete(p)) deptComplet++;
            for (const app of p.linkedApps) deptApps.add(app.name);
            for (const sup of p.linkedSuppliers) deptSuppliers.add(sup.name);
          }
          
          const deptCompletionRate = deptProcesses > 0 ? Math.round((deptComplet / deptProcesses) * 100) : 0;
          
          return [
            deptName,
            String(deptProcesses),
            String(deptCritiques),
            deptRtoMin === Infinity ? '-' : `${deptRtoMin}h`,
            String(deptApps.size),
            String(deptSuppliers.size),
            `${deptCompletionRate}%`
          ];
        });

        if (deptTableData.length > 0) {
          autoTable(doc, {
            head: [['DÉPARTEMENT', 'Processus', 'Critiques', 'RTO MIN', 'Applis IT', 'Prestataires', 'Complétude']],
            body: deptTableData,
            startY: y,
            margin: { left: margin + 2, right: margin + 2 },
            styles: { fontSize: 5, cellPadding: 1.5 },
            headStyles: { 
              fillColor: [250, 250, 249], 
              textColor: [23, 32, 48], 
              fontSize: 5, 
              fontStyle: 'bold',
              halign: 'center'
            },
            alternateRowStyles: { fillColor: [250, 250, 249] },
            columnStyles: {
              0: { cellWidth: 40, halign: 'left' },
              1: { cellWidth: 15, halign: 'center' },
              2: { cellWidth: 15, halign: 'center' },
              3: { cellWidth: 18, halign: 'center' },
              4: { cellWidth: 18, halign: 'center' },
              5: { cellWidth: 18, halign: 'center' },
              6: { cellWidth: 20, halign: 'center' },
            },
          });

          y = (doc as any).lastAutoTable?.finalY + 4 || y + 20;
        }
      }
    }

    // ===== PIED DE PAGE =====
    doc.setFontSize(6);
    doc.setTextColor(128, 128, 128);
    doc.setFont('helvetica', 'italic');
    doc.text(
      `Document généré automatiquement depuis la plateforme BCM - Page ${pageNumber}`,
      margin,
      pageHeight - 5
    );

    // Sauvegarde du PDF
    doc.save(`Synthèse_BIA_${new Date().toISOString().split('T')[0]}.pdf`);
    
    toast({
      title: "Succès",
      description: "Le PDF a été généré avec succès"
    });

  } catch (error: any) {
    console.error('Erreur export PDF:', error);
    toast({
      title: "Erreur",
      description: error?.message || "Erreur lors de la génération du PDF",
      variant: "destructive"
    });
  } finally {
    setIsExporting(false);
  }
}, [enrichedProcesses, stats, resourcesByTimeframe, directionsDetail]);
  // ============================================================
  // 11. TOGGLE EXPANSION
  // ============================================================
  const toggleDirection = (direction: string) => {
    setExpandedDirections(prev => {
      const newSet = new Set(prev);
      if (newSet.has(direction)) {
        newSet.delete(direction);
      } else {
        newSet.add(direction);
      }
      return newSet;
    });
  };

  // ============================================================
  // 12. RENDU
  // ============================================================
  if (isLoading) {
    return (
      <div className="p-4 md:p-6 max-w-7xl mx-auto">
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <RefreshCw className="h-8 w-8 animate-spin text-[#2A5141] mx-auto mb-4" />
            <p className="text-sm text-[#172030]/60">Chargement des données BIA...</p>
          </div>
        </div>
      </div>
    );
  }

  if (!enrichedProcesses || enrichedProcesses.length === 0) {
    return (
      <div className="p-4 md:p-6 max-w-7xl mx-auto">
        <div className="flex items-center justify-center h-64">
          <Card className="border-[#E8E4DC] shadow-sm">
            <CardContent className="p-8 text-center">
              <Database className="h-12 w-12 text-[#172030]/30 mx-auto mb-4" />
              <p className="text-[#172030] font-medium">Aucune donnée BIA disponible</p>
              <p className="text-sm text-[#172030]/50">Veuillez créer des processus dans le module BIA</p>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 max-w-7xl mx-auto" ref={contentRef}>
      {/* En-tête */}
      <div className="mb-6 flex flex-col md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-[#172030]" style={{ fontFamily: 'Playfair Display, serif' }}>
            Synthèse BIA consolidée
          </h1>
          <p className="text-sm text-[#172030]/60 mt-1">
            Vue agrégée de toutes les analyses d'impact, par direction et par département.
          </p>
        </div>
        <div className="flex items-center gap-2 mt-2 md:mt-0">
          <span className="text-xs text-[#172030]/60 bg-[#F8F6F2] px-3 py-1 rounded-full border border-[#E8E4DC]">
            {stats.completeCount} fiches · {new Date().toLocaleDateString('fr-FR')}
          </span>
          <Button 
            onClick={exportPDF} 
            disabled={isExporting}
            className="gap-1.5 bg-[#2A5141] hover:bg-[#1a3329] text-white shadow-sm"
            size="sm"
          >
            {isExporting ? (
              <RefreshCw className="h-4 w-4 animate-spin" />
            ) : (
              <FileSpreadsheet className="h-4 w-4" />
            )}
            {isExporting ? 'Génération...' : 'Exporter PDF'}
          </Button>
        </div>
      </div>

      {/* ===== CARTES STATISTIQUES ===== */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4 mb-6">
        <Card className="border-[#E8E4DC] shadow-sm hover:shadow-md transition-shadow">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[10px] font-semibold text-[#172030]/50 uppercase tracking-wider">Processus analysés</p>
                <p className="text-2xl font-bold text-[#172030]" style={{ fontFamily: 'Playfair Display, serif' }}>
                  {stats.totalProcessus}
                </p>
                <p className="text-xs text-[#172030]/40">sur {stats.servicesCount} services</p>
              </div>
              <Database className="h-8 w-8 text-[#2A5141] opacity-40" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-[#E8E4DC] shadow-sm hover:shadow-md transition-shadow">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[10px] font-semibold text-[#172030]/50 uppercase tracking-wider">Processus critiques</p>
                <p className="text-2xl font-bold text-[#ef4444]" style={{ fontFamily: 'Playfair Display, serif' }}>
                  {stats.processusCritiques}
                </p>
                <p className="text-xs text-[#172030]/40">{stats.pourcentageCritique}% du total</p>
              </div>
              <AlertCircle className="h-8 w-8 text-[#ef4444] opacity-40" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-[#E8E4DC] shadow-sm hover:shadow-md transition-shadow">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[10px] font-semibold text-[#172030]/50 uppercase tracking-wider">RTO le plus court</p>
                <p className="text-2xl font-bold text-[#172030]" style={{ fontFamily: 'Playfair Display, serif' }}>
                  {stats.rtoLePlusCourt}h
                </p>
                <p className="text-xs text-[#172030]/40">{stats.processAvecRtoLePlusCourt} processus</p>
              </div>
              <Clock className="h-8 w-8 text-[#f97316] opacity-40" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-[#E8E4DC] shadow-sm hover:shadow-md transition-shadow">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[10px] font-semibold text-[#172030]/50 uppercase tracking-wider">Applications IT</p>
                <p className="text-2xl font-bold text-[#172030]" style={{ fontFamily: 'Playfair Display, serif' }}>
                  {stats.totalApps}
                </p>
                <p className="text-xs text-[#172030]/40">dont {stats.appsSansSLA} sans SLA</p>
              </div>
              <Server className="h-8 w-8 text-[#7c3aed] opacity-40" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Complétude */}
      <Card className="mb-6 border-[#E8E4DC] shadow-sm">
        <CardContent className="p-4">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-3">
              <p className="text-sm font-medium text-[#172030]">Complétude globale</p>
              <div className="w-48 h-2 bg-[#E8E4DC] rounded-full overflow-hidden">
                <div 
                  className={`h-full rounded-full transition-all ${
                    stats.completude >= 80 ? 'bg-[#2A5141]' : 
                    stats.completude >= 50 ? 'bg-[#eab308]' : 
                    'bg-[#ef4444]'
                  }`} 
                  style={{ width: `${stats.completude}%` }} 
                />
              </div>
              <span className="text-sm font-semibold text-[#172030]">{stats.completude}%</span>
            </div>
            {stats.fichesIncompletes > 0 && (
              <div className="flex items-center gap-2 text-sm text-[#eab308]">
                <AlertCircle className="h-4 w-4" />
                <span>{stats.fichesIncompletes} fiches incomplètes</span>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Concentration du risque */}
      <Card className="mb-6 border-[#E8E4DC] shadow-sm">
        <CardHeader className="pb-2">
          <div className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-[#2A5141]" />
            <CardTitle className="text-base text-[#172030]" style={{ fontFamily: 'Playfair Display, serif' }}>
              Concentration du risque
            </CardTitle>
          </div>
          <p className="text-xs text-[#172030]/50">
            Distribution des RTO - Combien de processus critiques doivent redémarrer dans chaque fenêtre de temps
          </p>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {stats.rtoDistribution.map(({ label, count }) => {
              const colors: Record<string, string> = {
                '2h': 'bg-[#ef4444]',
                '24h': 'bg-[#f97316]',
                '48h': 'bg-[#eab308]',
                '120h': 'bg-[#3b82f6]',
              };
              const maxCount = Math.max(...stats.rtoDistribution.map(d => d.count), 1);
              const percentage = Math.round((count / maxCount) * 100);
              
              return (
                <div key={label} className="p-3 rounded-lg bg-[#F8F6F2] border border-[#E8E4DC]">
                  <p className="text-sm font-medium text-[#172030]">≤ {label}</p>
                  <p className="text-2xl font-bold text-[#172030]" style={{ fontFamily: 'Playfair Display, serif' }}>
                    {count}
                  </p>
                  <div className="mt-1 h-1.5 bg-[#E8E4DC] rounded-full overflow-hidden">
                    <div className={`h-full rounded-full ${colors[label] || 'bg-[#94a3b8]'}`} style={{ width: `${percentage}%` }} />
                  </div>
                  <p className="text-xs text-[#172030]/40 mt-1">{count} processus</p>
                </div>
              );
            })}
          </div>
          {stats.totalAlerte > 0 && (
            <div className="mt-3 p-3 bg-[#fef2f2] border border-[#fecaca] rounded-lg">
              <p className="text-sm text-[#dc2626]">
                ✅ <span className="font-bold">{stats.totalAlerte} processus sur {stats.totalProcessus}</span> exigent une reprise en moins de 24h. Le dispositif de secours doit prioriser cette fenêtre.
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ===== RESSOURCES À MOBILISER PAR PALIER ===== */}
      <Card className="mb-6 border-[#E8E4DC] shadow-sm">
        <CardHeader className="pb-2">
          <div className="flex items-center gap-2">
            <Users className="h-5 w-5 text-[#2A5141]" />
            <CardTitle className="text-base text-[#172030]" style={{ fontFamily: 'Playfair Display, serif' }}>
              Ressources à mobiliser par palier de temps
            </CardTitle>
          </div>
          <p className="text-xs text-[#172030]/50">
            Somme des besoins de tous les processus critiques. Le pic à ≤120h dimensionne le site de repli.
          </p>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[#E8E4DC]">
                  <th className="text-left py-2 px-3 font-medium text-[#172030]/50 text-[10px] uppercase tracking-wider">
                    RESSOURCE
                  </th>
                  {resourcesByTimeframe.paliers.map(p => (
                    <th key={p.label} className="text-center py-2 px-3 font-medium text-[#172030]/50 text-[10px] uppercase tracking-wider">
                      {p.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {resourcesByTimeframe.data.map((rt, idx) => {
                  const Icon = rt.icon;
                  return (
                    <tr key={rt.key} className={idx % 2 === 0 ? 'bg-white' : 'bg-[#FAFAF9]'}>
                      <td className="py-2 px-3 font-medium text-[#172030] flex items-center gap-2">
                        <Icon className="h-4 w-4 text-[#2A5141]" />
                        {rt.label}
                      </td>
                      {rt.values.map((val, i) => (
                        <td key={i} className="text-center py-2 px-3 font-mono text-[#172030]">
                          {val}
                        </td>
                      ))}
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-[#E8E4DC] bg-[#F8F6F2]">
                  <td className="py-2 px-3 font-semibold text-[#172030]">TOTAL</td>
                  {resourcesByTimeframe.paliers.map((p, i) => {
                    const total = resourcesByTimeframe.data.reduce((sum, rt) => sum + rt.values[i], 0);
                    return (
                      <td key={i} className="text-center py-2 px-3 font-bold text-[#172030]">
                        {total}
                      </td>
                    );
                  })}
                </tr>
              </tfoot>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* ===== APPLICATIONS IT, PRESTATAIRES ET ÉQUIPEMENTS ===== */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        {/* Applications IT */}
        <Card className="border-[#E8E4DC] shadow-sm">
          <CardHeader className="pb-2">
            <div className="flex items-center gap-2">
              <Server className="h-5 w-5 text-[#2A5141]" />
              <CardTitle className="text-sm text-[#172030]" style={{ fontFamily: 'Playfair Display, serif' }}>
                Applications IT les plus partagées
              </CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            {topApps.length > 0 ? (
              <div className="space-y-2">
                {topApps.map((app, index) => (
                  <div key={app.name} className="flex items-center justify-between p-2 bg-[#F8F6F2] rounded-lg border border-[#E8E4DC]">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-bold text-[#172030]/40">#{index + 1}</span>
                        <p className="font-medium text-sm text-[#172030] truncate">{app.name}</p>
                      </div>
                      <p className="text-xs text-[#172030]/40">RTO {app.rto}h{!app.sla && ' · sans SLA'}</p>
                    </div>
                    <Badge className="bg-[#2A5141] text-white text-[10px]">
                      {app.count}
                    </Badge>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-4 text-[#172030]/40 text-sm">
                Aucune application
              </div>
            )}
          </CardContent>
        </Card>

        {/* Prestataires */}
        <Card className="border-[#E8E4DC] shadow-sm">
          <CardHeader className="pb-2">
            <div className="flex items-center gap-2">
              <Handshake className="h-5 w-5 text-[#2A5141]" />
              <CardTitle className="text-sm text-[#172030]" style={{ fontFamily: 'Playfair Display, serif' }}>
                Prestataires les plus critiques
              </CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            {topPrestataires.length > 0 ? (
              <div className="space-y-2">
                {topPrestataires.map((presta, index) => (
                  <div key={presta.name} className="flex items-center justify-between p-2 bg-[#fef2f2] rounded-lg border border-[#fecaca]">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-bold text-[#172030]/40">#{index + 1}</span>
                        <p className="font-medium text-sm text-[#dc2626] truncate">{presta.name}</p>
                      </div>
                      <p className="text-xs text-[#172030]/40">RTO {presta.rto}h</p>
                    </div>
                    <Badge className="bg-[#dc2626] text-white text-[10px]">
                      {presta.count}
                    </Badge>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-4 text-[#172030]/40 text-sm">
                Aucun prestataire
              </div>
            )}
          </CardContent>
        </Card>

        {/* Équipements */}
        <Card className="border-[#E8E4DC] shadow-sm">
          <CardHeader className="pb-2">
            <div className="flex items-center gap-2">
              <Package className="h-5 w-5 text-[#2A5141]" />
              <CardTitle className="text-sm text-[#172030]" style={{ fontFamily: 'Playfair Display, serif' }}>
                Équipements les plus partagés
              </CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            {topEquipements.length > 0 ? (
              <div className="space-y-2">
                {topEquipements.map((eq, index) => (
                  <div key={eq.name} className="flex items-center justify-between p-2 bg-[#F8F6F2] rounded-lg border border-[#E8E4DC]">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-bold text-[#172030]/40">#{index + 1}</span>
                        <p className="font-medium text-sm text-[#172030] truncate">{eq.name}</p>
                      </div>
                      <p className="text-xs text-[#172030]/40">{eq.type} · RTO {eq.rto}h</p>
                    </div>
                    <Badge className="bg-[#2A5141] text-white text-[10px]">
                      {eq.count}
                    </Badge>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-4 text-[#172030]/40 text-sm">
                Aucun équipement
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* ===== DÉTAIL PAR DIRECTION & DÉPARTEMENT ===== */}
      <Card className="border-[#E8E4DC] shadow-sm">
        <CardHeader className="pb-2">
          <div className="flex items-center gap-2">
            <Building2 className="h-5 w-5 text-[#2A5141]" />
            <CardTitle className="text-base text-[#172030]" style={{ fontFamily: 'Playfair Display, serif' }}>
              Détail par direction & département
            </CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          {Object.entries(directionsDetail).length === 0 ? (
            <div className="text-center py-6 text-[#172030]/40 text-sm">
              Aucune direction
            </div>
          ) : (
            <div className="space-y-4">
              {Object.entries(directionsDetail).map(([direction, data]) => {
                const completionRate = data.count > 0 ? Math.round((data.complet / data.count) * 100) : 0;
                const isExpanded = expandedDirections.has(direction);
                
                const deptMap: Record<string, ProcessWithResources[]> = {};
                for (const p of data.processes) {
                  const deptName = getEntityName(p.entityId);
                  if (!deptMap[deptName]) deptMap[deptName] = [];
                  deptMap[deptName].push(p);
                }

                return (
                  <div key={direction} className="border border-[#E8E4DC] rounded-lg overflow-hidden">
                    <div 
                      className="flex items-center justify-between p-4 bg-[#F8F6F2] cursor-pointer hover:bg-[#F0EDE8] transition-colors"
                      onClick={() => toggleDirection(direction)}
                    >
                      <div className="flex items-center gap-4">
                        {isExpanded ? (
                          <ChevronDown className="h-4 w-4 text-[#172030]/40" />
                        ) : (
                          <ChevronRight className="h-4 w-4 text-[#172030]/40" />
                        )}
                        <h3 className="font-semibold text-[#172030]">{direction}</h3>
                        <div className="flex items-center gap-3 text-xs">
                          <span className="text-[#172030]/60">
                            <span className="font-medium text-[#172030]">{data.count}</span> Processus
                          </span>
                          {data.critiques > 0 && (
                            <span className="text-[#ef4444] font-medium">
                              ⚠️ {data.critiques} Critiques
                            </span>
                          )}
                          <span className="text-[#172030]/60">
                            <span className="font-medium text-[#172030]">{data.apps.size}</span> Applis IT
                          </span>
                          <span className="text-[#172030]/60">
                            <span className="font-medium text-[#172030]">{data.suppliers.size}</span> Prestataires
                          </span>
                          <Badge className={cn(
                            completionRate >= 80 ? 'bg-[#2A5141] text-white' :
                            completionRate >= 50 ? 'bg-[#eab308] text-white' :
                            'bg-[#ef4444] text-white'
                          )}>
                            {completionRate}% Complétude
                          </Badge>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-[#172030]/40">
                          RTO min: <span className="font-medium text-[#172030]">{data.rtoMin}h</span>
                        </span>
                      </div>
                    </div>

                    {isExpanded && (
                      <div className="p-4 bg-white">
                        <div className="overflow-x-auto">
                          <table className="w-full text-sm">
                            <thead>
                              <tr className="border-b border-[#E8E4DC]">
                                <th className="text-left py-2 px-3 font-medium text-[#172030]/50 text-[10px] uppercase tracking-wider">
                                  DÉPARTEMENT / SERVICE
                                </th>
                                <th className="text-center py-2 px-3 font-medium text-[#172030]/50 text-[10px] uppercase tracking-wider">
                                  Processus
                                </th>
                                <th className="text-center py-2 px-3 font-medium text-[#172030]/50 text-[10px] uppercase tracking-wider">
                                  Critiques
                                </th>
                                <th className="text-center py-2 px-3 font-medium text-[#172030]/50 text-[10px] uppercase tracking-wider">
                                  RTO MIN
                                </th>
                                <th className="text-center py-2 px-3 font-medium text-[#172030]/50 text-[10px] uppercase tracking-wider">
                                  Applis IT
                                </th>
                                <th className="text-center py-2 px-3 font-medium text-[#172030]/50 text-[10px] uppercase tracking-wider">
                                  Prestataires
                                </th>
                                <th className="text-center py-2 px-3 font-medium text-[#172030]/50 text-[10px] uppercase tracking-wider">
                                  Complétude
                                </th>
                              </tr>
                            </thead>
                            <tbody>
                              {Object.entries(deptMap).map(([deptName, procs], idx) => {
                                const deptProcesses = procs.length;
                                const deptCritiques = procs.filter(p => computeMaxScore(p.impacts) >= 4).length;
                                const deptRtoMin = Math.min(...procs.map(p => p.rto || 0));
                                const deptApps = new Set<string>();
                                const deptSuppliers = new Set<string>();
                                let deptComplet = 0;
                                
                                for (const p of procs) {
                                  if (isProcessComplete(p)) deptComplet++;
                                  for (const app of p.linkedApps) deptApps.add(app.name);
                                  for (const sup of p.linkedSuppliers) deptSuppliers.add(sup.name);
                                }
                                
                                const deptCompletionRate = deptProcesses > 0 ? Math.round((deptComplet / deptProcesses) * 100) : 0;
                                
                                return (
                                  <tr key={deptName} className={idx % 2 === 0 ? 'bg-white' : 'bg-[#FAFAF9]'}>
                                    <td className="py-2 px-3 font-medium text-[#172030]">{deptName}</td>
                                    <td className="text-center py-2 px-3 text-[#172030]">{deptProcesses}</td>
                                    <td className="text-center py-2 px-3 text-[#ef4444] font-medium">{deptCritiques}</td>
                                    <td className="text-center py-2 px-3 font-mono text-[#172030]">
                                      {deptRtoMin === Infinity ? '-' : `${deptRtoMin}h`}
                                    </td>
                                    <td className="text-center py-2 px-3 text-[#172030]">{deptApps.size}</td>
                                    <td className="text-center py-2 px-3 text-[#172030]">{deptSuppliers.size}</td>
                                    <td className="text-center py-2 px-3">
                                      <Badge className={cn(
                                        deptCompletionRate >= 80 ? 'bg-[#2A5141] text-white' :
                                        deptCompletionRate >= 50 ? 'bg-[#eab308] text-white' :
                                        'bg-[#ef4444] text-white'
                                      )}>
                                        {deptCompletionRate}%
                                      </Badge>
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default BIASynthesis;