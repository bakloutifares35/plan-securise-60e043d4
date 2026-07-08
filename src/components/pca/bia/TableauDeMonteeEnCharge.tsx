import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { computeMaxScore, scoreToCriticality } from "@/data/bia";
import { 
  RefreshCw, 
  Filter, 
  Eye, 
  EyeOff, 
  Save, 
  Search, 
  ChevronLeft, 
  ChevronRight,
  PlusCircle,
  X
} from "lucide-react";

// Configuration des colonnes
const PERIOD_COLUMNS = [
  { key: "dediee_0h", label: "Dédiée 0h", short: "0h" },
  { key: "p_4h", label: "4h", short: "4h" },
  { key: "p_j1", label: "J+1", short: "J+1" },
  { key: "p_j2", label: "J+2", short: "J+2" },
  { key: "p_j3", label: "J+3", short: "J+3" },
  { key: "p_j5", label: "J+5", short: "J+5" },
  { key: "p_j10", label: "J+10", short: "J+10" },
  { key: "p_j15", label: "J+15", short: "J+15" },
] as const;

type PeriodKey = typeof PERIOD_COLUMNS[number]['key'];

// Options de proximité
const PROXIMITE_OPTIONS = [
  "Site principal",
  "Site de secours",
  "Télétravail",
  "Autre site du groupe",
  "Non applicable",
  "Autre..."
];

interface MonteeEnCharge {
  id?: string;
  processus_id: string;
  dediee_0h: number;
  p_4h: number;
  p_j1: number;
  p_j2: number;
  p_j3: number;
  p_j5: number;
  p_j10: number;
  p_j15: number;
  dmia_heures: number | null;
  effectif_normal: number | null;
  necessite_proximite: string | null;
}

interface TableauDeMonteeEnChargeProps {
  processes: any[];
  serviceName: string;
}

// Composant Check pour le bouton de validation (déclaré en haut pour clarté)
const Check = ({ className }: { className?: string }) => (
  <svg
    className={className}
    fill="none"
    stroke="currentColor"
    viewBox="0 0 24 24"
  >
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
  </svg>
);

// Composant d'input numérique sans spinner
const NumericInput = ({ 
  value, 
  onChange, 
  className,
  placeholder = "0",
  allowDecimal = false,
  ...props 
}: { 
  value: number | null | undefined;
  onChange: (value: number | null) => void;
  className?: string;
  placeholder?: string;
  allowDecimal?: boolean;
  [key: string]: any;
}) => {
  const [displayValue, setDisplayValue] = useState<string>(value?.toString() ?? '');

  // Synchroniser la valeur affichée avec la valeur externe
  useEffect(() => {
    const newDisplayValue = value?.toString() ?? '';
    if (newDisplayValue !== displayValue) {
      setDisplayValue(newDisplayValue);
    }
  }, [value]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value;
    
    // Autoriser la chaîne vide
    if (raw === '') {
      setDisplayValue('');
      onChange(null);
      return;
    }

    // Valider le format numérique
    const regex = allowDecimal ? /^\d*\.?\d*$/ : /^\d*$/;
    if (!regex.test(raw)) {
      // Ne pas mettre à jour si la valeur ne matche pas
      return;
    }

    setDisplayValue(raw);
    
    // Convertir en nombre pour la sauvegarde
    const numValue = parseFloat(raw);
    if (!isNaN(numValue)) {
      onChange(numValue);
    } else {
      onChange(null);
    }
  };

  return (
    <Input
      type="text"
      inputMode="numeric"
      pattern={allowDecimal ? "[0-9.]*" : "[0-9]*"}
      value={displayValue}
      onChange={handleChange}
      className={cn("h-8 text-center text-sm bg-transparent border-transparent hover:border-[#E8E4DC] focus:border-[#2A5141] focus:ring-1 focus:ring-[#2A5141] transition-all", className)}
      placeholder={placeholder}
      {...props}
    />
  );
};

export const TableauDeMonteeEnCharge = ({ processes, serviceName }: TableauDeMonteeEnChargeProps) => {
  const [monteeData, setMonteeData] = useState<Record<string, MonteeEnCharge>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<Record<string, boolean>>({});
  // ✅ CHANGEMENT DEMANDÉ : true par défaut = tous les processus visibles
  const [showAllProcesses, setShowAllProcesses] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [customProximite, setCustomProximite] = useState<Record<string, string>>({});
  const [showCustomProximite, setShowCustomProximite] = useState<Record<string, boolean>>({});
  
  const ROWS_PER_PAGE = 15;
  const tableContainerRef = useRef<HTMLDivElement>(null);

  const getProcessScore = useCallback((process: any) => {
    return computeMaxScore(process.impacts);
  }, []);

  // Filtrer les processus
  const filteredProcesses = useMemo(() => {
    let result = processes;
    
    // Filtre de criticité (actif uniquement si showAllProcesses === false)
    if (!showAllProcesses) {
      result = result.filter(p => {
        const score = getProcessScore(p);
        return score >= 4;
      });
    }
    
    // Filtre de recherche
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      result = result.filter(p => 
        p.name?.toLowerCase().includes(q) ||
        p.owner?.toLowerCase().includes(q) ||
        p.department?.toLowerCase().includes(q)
      );
    }
    
    return result;
  }, [processes, showAllProcesses, searchQuery, getProcessScore]);

  // Pagination
  const totalPages = Math.ceil(filteredProcesses.length / ROWS_PER_PAGE);
  const paginatedProcesses = useMemo(() => {
    const start = (currentPage - 1) * ROWS_PER_PAGE;
    const end = start + ROWS_PER_PAGE;
    return filteredProcesses.slice(start, end);
  }, [filteredProcesses, currentPage]);

  // Charger ou initialiser les données (persistance : lecture Supabase)
  const loadData = useCallback(async () => {
    if (processes.length === 0) {
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const processIds = processes.map(p => p.id);
      
      const { data, error } = await supabase
        .from('montee_en_charge')
        .select('*')
        .in('processus_id', processIds);

      if (error) {
        console.warn('Table montee_en_charge non trouvée, utilisation de données locales');
        const localData: Record<string, MonteeEnCharge> = {};
        for (const p of processes) {
          localData[p.id] = {
            processus_id: p.id,
            dediee_0h: 0,
            p_4h: 0,
            p_j1: 0,
            p_j2: 0,
            p_j3: 0,
            p_j5: 0,
            p_j10: 0,
            p_j15: 0,
            dmia_heures: null,
            effectif_normal: null,
            necessite_proximite: null,
          };
        }
        setMonteeData(localData);
        setLoading(false);
        return;
      }

      const dataMap: Record<string, MonteeEnCharge> = {};
      data?.forEach((item: any) => {
        dataMap[item.processus_id] = {
          id: item.id,
          processus_id: item.processus_id,
          dediee_0h: item.dediee_0h || 0,
          p_4h: item.p_4h || 0,
          p_j1: item.p_j1 || 0,
          p_j2: item.p_j2 || 0,
          p_j3: item.p_j3 || 0,
          p_j5: item.p_j5 || 0,
          p_j10: item.p_j10 || 0,
          p_j15: item.p_j15 || 0,
          dmia_heures: item.dmia_heures,
          effectif_normal: item.effectif_normal,
          necessite_proximite: item.necessite_proximite,
        };
      });

      for (const p of processes) {
        if (!dataMap[p.id]) {
          dataMap[p.id] = {
            processus_id: p.id,
            dediee_0h: 0,
            p_4h: 0,
            p_j1: 0,
            p_j2: 0,
            p_j3: 0,
            p_j5: 0,
            p_j10: 0,
            p_j15: 0,
            dmia_heures: null,
            effectif_normal: null,
            necessite_proximite: null,
          };
        }
      }

      setMonteeData(dataMap);
    } catch (error: any) {
      console.error('Erreur chargement:', error);
      const localData: Record<string, MonteeEnCharge> = {};
      for (const p of processes) {
        localData[p.id] = {
          processus_id: p.id,
          dediee_0h: 0,
          p_4h: 0,
          p_j1: 0,
          p_j2: 0,
          p_j3: 0,
          p_j5: 0,
          p_j10: 0,
          p_j15: 0,
          dmia_heures: null,
          effectif_normal: null,
          necessite_proximite: null,
        };
      }
      setMonteeData(localData);
    } finally {
      setLoading(false);
    }
  }, [processes]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Sauvegarder une valeur (persistance : écriture Supabase à chaque modif)
  const saveField = useCallback(async (processId: string, field: keyof MonteeEnCharge, value: any) => {
    if (value === undefined) return;

    setMonteeData(prev => ({
      ...prev,
      [processId]: {
        ...prev[processId],
        [field]: value,
      },
    }));

    setSaving(prev => ({ ...prev, [processId]: true }));

    try {
      const data = {
        ...monteeData[processId],
        [field]: value,
      };
      if (!data) return;

      const upsertData: any = {
        processus_id: processId,
        dediee_0h: data.dediee_0h || 0,
        p_4h: data.p_4h || 0,
        p_j1: data.p_j1 || 0,
        p_j2: data.p_j2 || 0,
        p_j3: data.p_j3 || 0,
        p_j5: data.p_j5 || 0,
        p_j10: data.p_j10 || 0,
        p_j15: data.p_j15 || 0,
        dmia_heures: data.dmia_heures,
        effectif_normal: data.effectif_normal,
        necessite_proximite: data.necessite_proximite,
      };

      if (data.id) upsertData.id = data.id;

      const { error } = await supabase
        .from('montee_en_charge')
        .upsert(upsertData, { onConflict: 'processus_id' });

      if (error) {
        console.warn('Erreur sauvegarde:', error);
        toast({ title: "Erreur", description: "La sauvegarde a échoué, réessayez.", variant: "destructive" });
      }
    } catch (error: any) {
      console.error('Erreur:', error);
      toast({ title: "Erreur", description: "La sauvegarde a échoué, réessayez.", variant: "destructive" });
    } finally {
      setSaving(prev => ({ ...prev, [processId]: false }));
    }
  }, [monteeData]);

  // Gérer les changements numériques
  const handleNumberChange = useCallback((processId: string, field: PeriodKey | 'dmia_heures' | 'effectif_normal', value: number | null) => {
    if (value !== null && value < 0) return;
    saveField(processId, field, value);
  }, [saveField]);

  // Gérer le changement de proximité
  const handleProximiteChange = useCallback((processId: string, value: string) => {
    if (value === "Autre...") {
      setShowCustomProximite(prev => ({ ...prev, [processId]: true }));
      setCustomProximite(prev => ({ ...prev, [processId]: "" }));
      return;
    }
    setShowCustomProximite(prev => ({ ...prev, [processId]: false }));
    saveField(processId, 'necessite_proximite', value);
  }, [saveField]);

  const handleCustomProximiteChange = useCallback((processId: string, value: string) => {
    setCustomProximite(prev => ({ ...prev, [processId]: value }));
  }, []);

  const handleCustomProximiteSave = useCallback((processId: string) => {
    const value = customProximite[processId]?.trim();
    if (value) {
      saveField(processId, 'necessite_proximite', value);
      setShowCustomProximite(prev => ({ ...prev, [processId]: false }));
    }
  }, [customProximite, saveField]);

  // Calculer les totaux
  const calculateRowTotal = useCallback((data: MonteeEnCharge) => {
    return PERIOD_COLUMNS.reduce((sum, col) => {
      return sum + (data[col.key as PeriodKey] || 0);
    }, 0);
  }, []);

  const calculateColumnTotals = useCallback(() => {
    const totals: Record<string, number> = {};
    PERIOD_COLUMNS.forEach(col => { totals[col.key] = 0; });

    for (const p of filteredProcesses) {
      const data = monteeData[p.id];
      if (data) {
        PERIOD_COLUMNS.forEach(col => {
          totals[col.key] += (data[col.key as PeriodKey] || 0);
        });
      }
    }
    return totals;
  }, [filteredProcesses, monteeData]);

  const columnTotals = calculateColumnTotals();
  const totalRowSum = PERIOD_COLUMNS.reduce((sum, col) => sum + (columnTotals[col.key] || 0), 0);

  // Réinitialiser la page quand les filtres changent
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, showAllProcesses]);

  if (loading) {
    return <div className="flex justify-center py-8"><div className="animate-spin rounded-full h-6 w-6 border-b-2 border-[#2A5141]"></div></div>;
  }

  if (filteredProcesses.length === 0) {
    return (
      <div className="text-center py-8 text-[#172030]/40">
        <p>Aucun processus {!showAllProcesses ? 'critique ' : ''}à afficher</p>
        {!showAllProcesses && (
          <Button variant="outline" size="sm" className="mt-2" onClick={() => setShowAllProcesses(true)}>
            <Eye className="h-3.5 w-3.5 mr-1" /> Afficher tous
          </Button>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* En-tête avec contrôles */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h3 className="text-lg font-semibold text-[#172030]" style={{ fontFamily: "Playfair Display, serif" }}>
            📊 Montée en charge — {serviceName}
          </h3>
          <p className="text-xs text-[#172030]/50">
            {processes.length} processus • 
            {processes.filter(p => getProcessScore(p) >= 4).length} critiques
            {filteredProcesses.length !== processes.length && ` • ${filteredProcesses.length} affichés`}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {/* Barre de recherche */}
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-[#172030]/30" />
            <Input
              type="text"
              placeholder="Rechercher un processus..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-8 h-8 w-[180px] text-sm border-[#E8E4DC] focus:border-[#2A5141]"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery("")}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#172030]/30 hover:text-[#172030]"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>

          <Button
            variant={!showAllProcesses ? "default" : "outline"}
            size="sm"
            className={cn("gap-1.5 text-xs h-8", !showAllProcesses && "bg-[#2A5141] hover:bg-[#1a3329]")}
            onClick={() => setShowAllProcesses(!showAllProcesses)}
          >
            {showAllProcesses ? <Filter className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5" />}
            {showAllProcesses ? "Critiques" : "Tous"}
          </Button>
          <Button variant="ghost" size="sm" className="h-8 text-xs" onClick={loadData}>
            <RefreshCw className="h-3.5 w-3.5 mr-1" /> Rafraîchir
          </Button>
        </div>
      </div>

      {/* Tableau avec scroll */}
      <div 
        ref={tableContainerRef}
        className="border rounded-xl overflow-hidden bg-white shadow-sm max-h-[600px] overflow-y-auto relative"
      >
        <div className="overflow-x-auto">
          <Table className="table-sticky-header table-sticky-footer">
            <TableHeader>
              <TableRow className="bg-[#F8F6F2] border-b border-[#E8E4DC]">
                <TableHead className="text-[10px] font-semibold text-[#172030]/50 uppercase tracking-wider py-3 px-3 min-w-[160px] sticky left-0 bg-[#F8F6F2] z-20">
                  Processus
                </TableHead>
                <TableHead className="text-[10px] font-semibold text-[#172030]/50 uppercase tracking-wider py-3 px-2 text-center min-w-[70px]">
                  Critique
                </TableHead>
                <TableHead className="text-[10px] font-semibold text-[#172030]/50 uppercase tracking-wider py-3 px-2 text-center min-w-[70px]">
                  DMIA (h)
                </TableHead>
                <TableHead className="text-[10px] font-semibold text-[#172030]/50 uppercase tracking-wider py-3 px-2 text-center min-w-[80px]">
                  ETP
                </TableHead>
                <TableHead className="text-[10px] font-semibold text-[#172030]/50 uppercase tracking-wider py-3 px-2 text-center min-w-[130px]">
                  Proximité
                </TableHead>
                {PERIOD_COLUMNS.map((col) => (
                  <TableHead key={col.key} className="text-[10px] font-semibold text-[#172030]/50 uppercase tracking-wider py-3 px-1 text-center min-w-[55px]">
                    {col.short}
                  </TableHead>
                ))}
                <TableHead className="text-[10px] font-semibold text-[#172030]/50 uppercase tracking-wider py-3 px-3 text-center min-w-[70px] bg-[#F8F6F2] sticky right-0 z-10">
                  Total
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {paginatedProcesses.map((process, idx) => {
                const data = monteeData[process.id];
                if (!data) return null;

                const score = getProcessScore(process);
                const isCritical = score >= 4;
                const rowTotal = calculateRowTotal(data);
                const isSaving = saving[process.id] || false;
                const showCustom = showCustomProximite[process.id] || false;
                const currentProximite = data.necessite_proximite || "";
                const selectValue = PROXIMITE_OPTIONS.includes(currentProximite) ? currentProximite : "Autre...";

                return (
                  <TableRow 
                    key={process.id}
                    className={cn(
                      "border-b border-[#E8E4DC] transition-colors",
                      idx % 2 === 0 ? "bg-white" : "bg-[#FAFAF9]",
                      isCritical && "border-l-4 border-l-[#ef4444]"
                    )}
                  >
                    <TableCell className="py-2 px-3 sticky left-0 bg-inherit z-10">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-[#172030]">{process.name}</span>
                        {isSaving && <Save className="h-3 w-3 text-[#2A5141] animate-pulse" />}
                      </div>
                    </TableCell>

                    <TableCell className="py-2 px-2 text-center">
                      {isCritical ? (
                        <Badge className="bg-red-100 text-red-700 border-red-200 text-[10px]">OUI</Badge>
                      ) : (
                        <Badge variant="outline" className="text-[10px] text-[#172030]/40 border-[#E8E4DC]">Non</Badge>
                      )}
                    </TableCell>

                    <TableCell className="py-2 px-2 text-center">
                      <NumericInput
                        value={data.dmia_heures}
                        onChange={(val) => handleNumberChange(process.id, 'dmia_heures', val)}
                        className="w-16"
                        placeholder="-"
                      />
                    </TableCell>

                    <TableCell className="py-2 px-2 text-center">
                      <NumericInput
                        value={data.effectif_normal}
                        onChange={(val) => handleNumberChange(process.id, 'effectif_normal', val)}
                        className="w-16"
                        placeholder="-"
                        allowDecimal
                      />
                    </TableCell>

                    <TableCell className="py-2 px-2">
                      {!showCustom ? (
                        <Select
                          value={selectValue === "Autre..." ? "" : (data.necessite_proximite || "")}
                          onValueChange={(val) => handleProximiteChange(process.id, val)}
                        >
                          <SelectTrigger className="h-8 w-[120px] text-sm border-transparent hover:border-[#E8E4DC] focus:border-[#2A5141] focus:ring-1 focus:ring-[#2A5141] bg-transparent">
                            <SelectValue placeholder="Sélectionner..." />
                          </SelectTrigger>
                          <SelectContent>
                            {PROXIMITE_OPTIONS.map((option) => (
                              <SelectItem key={option} value={option}>
                                {option}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      ) : (
                        <div className="flex items-center gap-1">
                          <Input
                            type="text"
                            value={customProximite[process.id] || ""}
                            onChange={(e) => handleCustomProximiteChange(process.id, e.target.value)}
                            className="h-8 w-[100px] text-sm bg-transparent border-transparent hover:border-[#E8E4DC] focus:border-[#2A5141] focus:ring-1 focus:ring-[#2A5141] transition-all"
                            placeholder="Précisez..."
                            autoFocus
                          />
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 w-7 p-0"
                            onClick={() => handleCustomProximiteSave(process.id)}
                            disabled={!customProximite[process.id]?.trim()}
                          >
                            <Check className="h-3.5 w-3.5 text-[#2A5141]" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 w-7 p-0"
                            onClick={() => {
                              setShowCustomProximite(prev => ({ ...prev, [process.id]: false }));
                            }}
                          >
                            <X className="h-3.5 w-3.5 text-[#172030]/40" />
                          </Button>
                        </div>
                      )}
                    </TableCell>

                    {PERIOD_COLUMNS.map((col) => {
                      const value = data[col.key as PeriodKey] || 0;
                      return (
                        <TableCell key={col.key} className="py-2 px-1 text-center">
                          <NumericInput
                            value={value}
                            onChange={(val) => handleNumberChange(process.id, col.key, val)}
                            className="w-14"
                          />
                        </TableCell>
                      );
                    })}

                    <TableCell className="py-2 px-3 text-center font-mono font-semibold text-sm text-[#2A5141] bg-[#FAFAF9] sticky right-0 z-10">
                      {rowTotal}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
            <tfoot>
              <TableRow className="bg-[#F8F6F2] border-t-2 border-[#E8E4DC]">
                <TableCell className="py-3 px-3 font-semibold text-sm text-[#172030] sticky left-0 bg-[#F8F6F2] z-10">
                  TOTAL
                </TableCell>
                <TableCell className="py-3 px-2 text-center text-sm text-[#172030]/50">—</TableCell>
                <TableCell className="py-3 px-2 text-center text-sm text-[#172030]/50">—</TableCell>
                <TableCell className="py-3 px-2 text-center text-sm text-[#172030]/50">—</TableCell>
                <TableCell className="py-3 px-2 text-center text-sm text-[#172030]/50">—</TableCell>
                {PERIOD_COLUMNS.map((col) => (
                  <TableCell key={col.key} className="py-3 px-1 text-center font-mono font-semibold text-sm text-[#2A5141]">
                    {columnTotals[col.key] || 0}
                  </TableCell>
                ))}
                <TableCell className="py-3 px-3 text-center font-mono font-bold text-sm text-[#2A5141] bg-[#F8F6F2] sticky right-0 z-10">
                  {totalRowSum}
                </TableCell>
              </TableRow>
            </tfoot>
          </Table>
        </div>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between gap-4 pt-2">
          <div className="text-xs text-[#172030]/40">
            Page {currentPage} sur {totalPages} • {filteredProcesses.length} processus
          </div>
          <div className="flex gap-1">
            <Button
              variant="outline"
              size="sm"
              className="h-8 w-8 p-0"
              onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
              disabled={currentPage === 1}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="h-8 w-8 p-0"
              onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
              disabled={currentPage === totalPages}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}

      {/* Légende */}
      <div className="flex flex-wrap items-center gap-4 text-xs text-[#172030]/50">
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded-full bg-red-100 border border-red-200" />
          <span>Processus critique</span>
        </div>
        <div className="flex items-center gap-1.5">
          <Save className="h-3 w-3 text-[#2A5141]" />
          <span>Sauvegarde auto</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="font-mono text-[#2A5141]">Total</span>
          <span>— Somme des positions</span>
        </div>
        <div className="text-[#172030]/30 text-[10px]">
          Cliquez sur une cellule pour modifier • Sauvegarde automatique
        </div>
      </div>
    </div>
  );
};