import { useState, useMemo } from "react";
import {
  ChevronDown, ChevronRight, Plus, Upload, FileText, Network,
  Building2, Landmark, Layers, CheckCircle2, AlertTriangle, Target,
  TrendingUp, Users, Search, Download, MoreVertical, Link2
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

type Entity = {
  id: string;
  name: string;
  type: string;
  parentId: string | null;
  country?: string;
  referent?: string;
};

type Process = {
  id: string;
  name: string;
  entity?: string;
  entityId?: string;
  owner?: string;
  rto?: number;
  rpo?: number;
  criticality?: string;
};

type TaxonomyTabProps = {
  entities: Entity[];
  processes: Process[];
  onImportExcel?: () => void;
  onImportPdf?: () => void;
  onAddProcess?: (entityId: string) => void;
  onOpenProcess?: (processId: string) => void;
};

export const TaxonomyTab = ({
  entities,
  processes,
  onImportExcel,
  onImportPdf,
  onAddProcess,
  onOpenProcess,
}: TaxonomyTabProps) => {
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [searchQuery, setSearchQuery] = useState("");

  // ============ KPIs ============
  const stats = useMemo(() => {
    const filiales = entities.filter(e => e.type === "FILIALE");
    const directions = entities.filter(e => e.type === "DIRECTION");
    const services = entities.filter(e => ["SERVICE", "DÉPARTEMENT"].includes(e.type));

    const directionsWithoutProcesses = directions.filter(d => {
      const hasOwnProcesses = processes.some(p => p.entity === d.name || p.entityId === d.id);
      const children = entities.filter(e => e.parentId === d.id);
      const hasChildProcesses = children.some(c =>
        processes.some(p => p.entity === c.name || p.entityId === c.id)
      );
      return !hasOwnProcesses && !hasChildProcesses;
    });

    const processesWithoutRto = processes.filter(p => !p.rto);

    const totalEntitiesWithProcesses = entities.filter(e => {
      return processes.some(p => p.entity === e.name || p.entityId === e.id);
    }).length;
    const coverage = entities.length > 0
      ? Math.round((totalEntitiesWithProcesses / entities.length) * 100)
      : 0;

    return {
      filiales: filiales.length,
      directions: directions.length,
      services: services.length,
      totalProcesses: processes.length,
      directionsWithoutProcesses: directionsWithoutProcesses.length,
      processesWithoutRto: processesWithoutRto.length,
      coverage,
    };
  }, [entities, processes]);

  const getEntityProcesses = (entity: Entity) => {
    return processes.filter(p => p.entity === entity.name || p.entityId === entity.id);
  };

  const renderNode = (entity: Entity, depth = 0) => {
    const children = entities.filter(e => e.parentId === entity.id);
    const entityProcesses = getEntityProcesses(entity);
    const isExpanded = expanded[entity.id] ?? depth < 1;
    const hasChildren = children.length > 0;

    const totalProcessesInBranch = useMemo(() => {
      let total = entityProcesses.length;
      const countRecursive = (parentId: string) => {
        entities.filter(e => e.parentId === parentId).forEach(child => {
          total += getEntityProcesses(child).length;
          countRecursive(child.id);
        });
      };
      countRecursive(entity.id);
      return total;
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [entity.id, entities, processes]);

    const matchesSearch = searchQuery === "" ||
      entity.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      entityProcesses.some(p => p.name.toLowerCase().includes(searchQuery.toLowerCase()));

    if (searchQuery && !matchesSearch && hasChildren === false) return null;

    const getIcon = () => {
      const t = entity.type?.toUpperCase();
      if (t === "FILIALE") return <Building2 className="h-4 w-4" />;
      if (t === "DIRECTION") return <Landmark className="h-4 w-4" />;
      return <Layers className="h-4 w-4" />;
    };

    const getColors = () => {
      const t = entity.type?.toUpperCase();
      if (t === "FILIALE") return { bg: "bg-[#172030]", text: "text-white", badge: "bg-[#172030]" };
      if (t === "DIRECTION") return { bg: "bg-[#2A5141]", text: "text-white", badge: "bg-[#2A5141]" };
      if (t === "SERVICE") return { bg: "bg-blue-100", text: "text-blue-700", badge: "bg-blue-100" };
      if (t === "DÉPARTEMENT") return { bg: "bg-purple-100", text: "text-purple-700", badge: "bg-purple-100" };
      return { bg: "bg-gray-100", text: "text-gray-700", badge: "bg-gray-100" };
    };

    const colors = getColors();

    return (
      <div key={entity.id} className="relative">
        {/* Ligne du nœud */}
        <div
          className={cn(
            "group flex items-center gap-2 py-2 pr-2 rounded-md transition-all duration-150",
            "hover:bg-[#F8F6F2] cursor-pointer",
            depth === 0 && "py-2.5"
          )}
          style={{ paddingLeft: `${depth * 24 + 8}px` }}
          onClick={() => setExpanded(prev => ({ ...prev, [entity.id]: !isExpanded }))}
        >
          {/* Chevron */}
          <button
            className="flex-shrink-0 w-5 h-5 flex items-center justify-center rounded hover:bg-gray-200/70"
            onClick={(e) => { e.stopPropagation(); setExpanded(prev => ({ ...prev, [entity.id]: !isExpanded })); }}
          >
            {hasChildren ? (
              isExpanded
                ? <ChevronDown className="h-4 w-4 text-gray-500" />
                : <ChevronRight className="h-4 w-4 text-gray-500" />
            ) : (
              <span className="inline-block w-4" />
            )}
          </button>

          {/* Icône type */}
          <div className={cn(
            "flex-shrink-0 rounded-md flex items-center justify-center",
            depth === 0 ? "h-8 w-8" : "h-6 w-6",
            colors.bg, colors.text
          )}>
            {getIcon()}
          </div>

          {/* Nom */}
          <span className={cn(
            "truncate flex-1",
            depth === 0 ? "text-sm font-bold text-[#172030]" : "text-sm font-medium text-[#172030]"
          )}>
            {entity.name}
          </span>

          {/* Badge type — ✅ parent <div>, OK */}
          <Badge className={cn("text-[10px] font-medium", colors.badge, colors.text, "border-0")}>
            {entity.type}
          </Badge>

          {/* Compteur processus — ✅ parent <div>, OK */}
          {totalProcessesInBranch > 0 && (
            <Badge className="text-[10px] bg-[#2A5141]/10 text-[#2A5141] border-0">
              {totalProcessesInBranch} processus
            </Badge>
          )}

          {/* Actions hover */}
          <div className="opacity-0 group-hover:opacity-100 transition-opacity">
            <DropdownMenu>
              <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                <Button variant="ghost" size="icon" className="h-6 w-6">
                  <MoreVertical className="h-3.5 w-3.5 text-gray-400" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => onAddProcess?.(entity.id)}>
                  <Plus className="h-4 w-4 mr-2" /> Ajouter un processus
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => onImportExcel?.()}>
                  <Upload className="h-4 w-4 mr-2" /> Importer depuis Excel
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => onImportPdf?.()}>
                  <FileText className="h-4 w-4 mr-2" /> Importer depuis PDF
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        {/* Processus de cette entité — ✅ remplacé les <>...</> par <div>...</div> */}
        {isExpanded && entityProcesses.length > 0 && (
          <div className="mt-1 space-y-1" style={{ paddingLeft: `${depth * 24 + 56}px` }}>
            {entityProcesses.map(p => {
              const hasRto = !!p.rto;
              const criticality = p.criticality || "Non défini";
              const isCritical = criticality === "Critique" || criticality === "Élevé";

              return (
                <div
                  key={p.id}
                  className="group flex items-center gap-2 py-1.5 px-3 rounded-md bg-white border border-[#E8E4DC] hover:border-[#2A5141]/40 hover:shadow-sm transition-all cursor-pointer"
                  onClick={() => {
                    console.log("🔵 Clic processus (TaxonomyTab):", p.id, p.name);
                    onOpenProcess?.(p.id);
                  }}
                >
                  <Target className="h-3.5 w-3.5 text-[#2A5141] flex-shrink-0" />
                  <span className="text-[13px] text-[#172030] truncate flex-1">{p.name}</span>

                  {/* ✅ Remplacé le fragment <>...</> par un <div> inline : plus de <span> "orphelins" */}
                  {p.owner && (
                    <div className="flex items-center gap-1 flex-shrink-0">
                      <span className="text-[10px] text-gray-400">•</span>
                      <span className="text-[11px] text-gray-500 truncate max-w-[100px]">{p.owner}</span>
                    </div>
                  )}

                  <div className="flex items-center gap-1.5 flex-shrink-0">
                    {hasRto ? (
                      <Badge className="text-[9px] font-mono bg-blue-50 text-blue-700 border-0">
                        RTO {p.rto}h
                      </Badge>
                    ) : (
                      <Badge className="text-[9px] bg-orange-50 text-orange-700 border-0">
                        <AlertTriangle className="h-2.5 w-2.5 mr-0.5" />
                        RTO manquant
                      </Badge>
                    )}

                    {criticality !== "Non défini" && (
                      <span
                        className={cn(
                          "w-2 h-2 rounded-full",
                          isCritical ? "bg-red-500" : criticality === "Modéré" ? "bg-amber-500" : "bg-emerald-500"
                        )}
                        title={criticality}
                      />
                    )}

                    {hasRto && !isCritical && (
                      <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Enfants */}
        {isExpanded && hasChildren && (
          <div className="relative">
            <div
              className="absolute top-0 bottom-0 w-px bg-[#E8E4DC]"
              style={{ left: `${depth * 24 + 20}px` }}
            />
            {children.map(child => renderNode(child, depth + 1))}
          </div>
        )}
      </div>
    );
  };

  const filiales = entities.filter(e => e.type === "FILIALE" && !e.parentId);

  return (
    <div className="space-y-5">
      {/* ============ KPIs ============ */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card className="border-[#E8E4DC] shadow-sm">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-[#172030]/10 flex items-center justify-center flex-shrink-0">
              <Building2 className="h-5 w-5 text-[#172030]" />
            </div>
            <div>
              <p className="text-[10px] uppercase tracking-wider text-gray-400 font-medium">Filiales</p>
              <p className="text-2xl font-bold text-[#172030]">{stats.filiales}</p>
            </div>
          </CardContent>
        </Card>

        <Card className="border-[#E8E4DC] shadow-sm">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-[#2A5141]/10 flex items-center justify-center flex-shrink-0">
              <Landmark className="h-5 w-5 text-[#2A5141]" />
            </div>
            <div>
              <p className="text-[10px] uppercase tracking-wider text-gray-400 font-medium">Directions</p>
              <p className="text-2xl font-bold text-[#172030]">{stats.directions}</p>
            </div>
          </CardContent>
        </Card>

        <Card className="border-[#E8E4DC] shadow-sm">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-emerald-50 flex items-center justify-center flex-shrink-0">
              <Target className="h-5 w-5 text-emerald-600" />
            </div>
            <div>
              <p className="text-[10px] uppercase tracking-wider text-gray-400 font-medium">Processus</p>
              <p className="text-2xl font-bold text-[#172030]">{stats.totalProcesses}</p>
            </div>
          </CardContent>
        </Card>

        <Card className="border-[#E8E4DC] shadow-sm">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-blue-50 flex items-center justify-center flex-shrink-0">
              <TrendingUp className="h-5 w-5 text-blue-600" />
            </div>
            <div>
              <p className="text-[10px] uppercase tracking-wider text-gray-400 font-medium">Couverture</p>
              <p className="text-2xl font-bold text-[#172030]">{stats.coverage}%</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* ============ ALERTES ============ */}
      {(stats.directionsWithoutProcesses > 0 || stats.processesWithoutRto > 0) && (
        <div className="flex flex-wrap gap-2">
          {stats.directionsWithoutProcesses > 0 && (
            <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-orange-50 border border-orange-200 text-[12px] text-orange-700">
              <AlertTriangle className="h-3.5 w-3.5" />
              <span><strong>{stats.directionsWithoutProcesses}</strong> direction{stats.directionsWithoutProcesses > 1 ? "s" : ""} sans processus associé</span>
            </div>
          )}
          {stats.processesWithoutRto > 0 && (
            <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-red-50 border border-red-200 text-[12px] text-red-700">
              <AlertTriangle className="h-3.5 w-3.5" />
              <span><strong>{stats.processesWithoutRto}</strong> processus sans RTO défini</span>
            </div>
          )}
        </div>
      )}

      {/* ============ ARBORESCENCE ============ */}
      <Card className="border-[#E8E4DC] shadow-sm">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div>
              <CardTitle className="flex items-center gap-2 text-base">
                <Network className="h-4 w-4 text-[#2A5141]" />
                Arborescence des taxonomies
              </CardTitle>
              <CardDescription className="text-xs mt-1">
                Vue hiérarchique des entités et de leurs processus métier
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400" />
                <Input
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Rechercher..."
                  className="h-8 w-[200px] pl-8 text-xs border-[#E8E4DC]"
                />
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={onImportExcel}
                className="h-8 border-[#E8E4DC] text-xs"
              >
                <Upload className="h-3.5 w-3.5 mr-1" /> Excel
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={onImportPdf}
                className="h-8 border-[#E8E4DC] text-xs"
              >
                <FileText className="h-3.5 w-3.5 mr-1" /> PDF
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="pt-0">
          {filiales.length === 0 ? (
            <div className="text-center py-12">
              <div className="h-12 w-12 rounded-full bg-gray-50 mx-auto flex items-center justify-center mb-3">
                <Network className="h-6 w-6 text-gray-300" />
              </div>
              <p className="text-sm text-gray-500 font-medium">Aucune entité dans la taxonomie</p>
              <p className="text-xs text-gray-400 mt-1">Créez d'abord des entités pour voir l'arborescence</p>
            </div>
          ) : (
            <div className="space-y-1">
              {filiales.map(f => renderNode(f, 0))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};