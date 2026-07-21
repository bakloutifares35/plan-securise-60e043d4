import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import {
  AlertTriangle,
  ShieldCheck,
  Activity,
  TrendingUp,
  RefreshCw,
  FileText,
  Bell,
  Calendar,
  ArrowUpRight,
  Eye,
  CheckCircle,
  FileCheck,
  PlayCircle,
  AlertOctagon,
  ChevronRight,
  Building2,
  Users,
  Server,
  Handshake,
  Database,
  Clock,
  AlertCircle,
  CheckCircle2,
  BarChart3,
  PieChart as PieChartIcon,
  Layers,
  Gauge,
  Target,
  Zap,
  Shield,
  FileBarChart,
  ListChecks,
  ClipboardCheck,
  Timer,
  Flame,
  ArrowRight,
  Circle,
  CircleCheck,
  CircleDot,
  CircleDashed,
  Link,
} from "lucide-react";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  PieChart,
  Pie,
  Cell,
  Legend,
  LineChart,
  Line,
  AreaChart,
  Area,
  ComposedChart,
} from "recharts";
import { cn } from "@/lib/utils";

// ============================================================
// DONNÉES DYNAMIQUES (à remplacer par vos vraies données)
// ============================================================
const stats = [
  { 
    label: "Total ressources", 
    value: "29", 
    change: "+3",
    icon: Database,
    color: "#172030",
    bg: "bg-[#F8F6F2]"
  },
  { 
    label: "Ressources utilisées", 
    value: "18", 
    change: "62%",
    icon: CheckCircle2,
    color: "#2A5141",
    bg: "bg-[#E8F5E9]"
  },
  { 
    label: "Ressources non utilisées", 
    value: "11", 
    change: "38%",
    icon: AlertCircle,
    color: "#f97316",
    bg: "bg-[#FFF3E0]"
  },
  { 
    label: "Processus liés", 
    value: "14", 
    change: "+2",
    icon: Link,
    color: "#6B4C3B",
    bg: "bg-[#F3E8E0]"
  },
];

const alerts = [
  { 
    title: "BIA à réviser - Service R&D", 
    priority: "Critique", 
    date: "Aujourd'hui", 
    icon: AlertOctagon,
    description: "Dernière révision il y a 18 mois"
  },
  { 
    title: "Test PCA en retard", 
    priority: "Élevé", 
    date: "Hier", 
    icon: AlertTriangle,
    description: "Test prévu le 15/06/2026"
  },
  { 
    title: "Plan PCA expiré", 
    priority: "Moyen", 
    date: "Il y a 3j", 
    icon: FileCheck,
    description: "Plan PCA - Infrastructure critique"
  },
];

const topRisks = [
  { name: "Cyberattaque", score: 90, level: "Critique", color: "#ef4444" },
  { name: "Panne IT", score: 78, level: "Élevé", color: "#f97316" },
  { name: "Incendie", score: 68, level: "Élevé", color: "#f97316" },
  { name: "Pandémie", score: 58, level: "Moyen", color: "#eab308" },
];

const riskDistribution = [
  { name: "Critique", value: 2, color: "#ef4444" },
  { name: "Élevé", value: 3, color: "#f97316" },
  { name: "Moyen", value: 4, color: "#eab308" },
  { name: "Faible", value: 5, color: "#22c55e" },
];

const recentActivity = [
  { user: "Ahmed Benali", action: "a validé un BIA", time: "2h", icon: CheckCircle2, department: "Direction Financière" },
  { user: "Julie Martin", action: "a créé un PCA", time: "4h", icon: FileText, department: "Direction des Systèmes d'Information" },
  { user: "Marc Dupont", action: "a mis à jour le référentiel CMDB", time: "8h", icon: Database, department: "Direction des Opérations" },
  { user: "Sophie Leclerc", action: "a lancé un exercice PCA", time: "12h", icon: PlayCircle, department: "Direction des Ressources Humaines" },
];

const bcmStatus = [
  { label: "BIA - Processus critiques", value: 91, color: "#2A5141" },
  { label: "Plans PCA", value: 82, color: "#4A7A6A" },
  { label: "Exercices PCA", value: 68, color: "#6A9A8A" },
  { label: "Référentiel CMDB", value: 75, color: "#8A9A9A" },
];

const weeklyProgress = [
  { day: "Lun", value: 65 },
  { day: "Mar", value: 72 },
  { day: "Mer", value: 68 },
  { day: "Jeu", value: 85 },
  { day: "Ven", value: 90 },
  { day: "Sam", value: 78 },
  { day: "Dim", value: 82 },
];

const resourceDistribution = [
  { name: "RH", value: 12, color: "#2563eb" },
  { name: "Équipements", value: 8, color: "#eab308" },
  { name: "Applications", value: 6, color: "#8b5cf6" },
  { name: "Prestataires", value: 3, color: "#f97316" },
];

const criticalProcesses = [
  { name: "Gestion de la paie", status: "Critique", rto: "4h", owner: "DRH" },
  { name: "Système CRM", status: "Critique", rto: "8h", owner: "DSI" },
  { name: "Gestion des commandes", status: "Majeur", rto: "12h", owner: "DO" },
  { name: "Infrastructure réseau", status: "Critique", rto: "2h", owner: "DSI" },
];

// ============================================================
// COMPOSANTS
// ============================================================
const StatsCard = ({ stat }: { stat: any }) => {
  const Icon = stat.icon;
  return (
    <Card className="border-[#E8E4DC] shadow-sm bg-white hover:shadow-md transition-all duration-200">
      <CardContent className="p-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-[10px] font-semibold text-[#172030]/50 uppercase tracking-wider">
              {stat.label}
            </p>
            <p className="text-2xl font-bold text-[#172030] mt-0.5" style={{ fontFamily: "'Playfair Display', serif" }}>
              {stat.value}
            </p>
          </div>
          <div className={`h-10 w-10 rounded-xl ${stat.bg} flex items-center justify-center`}>
            <Icon className="h-5 w-5" style={{ color: stat.color }} />
          </div>
        </div>
        <div className="flex items-center gap-1.5 mt-2">
          <ArrowUpRight className="h-3 w-3 text-[#2A5141]" />
          <span className="text-xs font-medium text-[#2A5141]">{stat.change}</span>
          <span className="text-[10px] text-[#172030]/40">
            {stat.label === "Total ressources" ? "ressources" : 
             stat.label === "Processus liés" ? "ce mois" : 
             "du total"}
          </span>
        </div>
      </CardContent>
    </Card>
  );
};

const AlertItem = ({ alert, index }: { alert: any; index: number }) => {
  const Icon = alert.icon;
  const priorityStyles = {
    "Critique": "bg-rose-50 text-rose-700 border-rose-200",
    "Élevé": "bg-orange-50 text-orange-700 border-orange-200",
    "Moyen": "bg-amber-50 text-amber-700 border-amber-200",
  };
  const priorityDot = {
    "Critique": "bg-rose-500",
    "Élevé": "bg-orange-500",
    "Moyen": "bg-amber-500",
  };

  return (
    <div className="flex items-start gap-3 py-3 border-b border-[#E8E4DC] last:border-0 hover:bg-[#FAFAF9] -mx-2 px-2 rounded-lg transition-colors">
      <div className={`h-8 w-8 rounded-lg ${priorityStyles[alert.priority as keyof typeof priorityStyles]} flex items-center justify-center flex-shrink-0 border`}>
        <Icon className="h-4 w-4" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <p className="text-sm font-medium text-[#172030] truncate">{alert.title}</p>
          <div className={`w-1.5 h-1.5 rounded-full ${priorityDot[alert.priority as keyof typeof priorityDot]} flex-shrink-0`} />
        </div>
        <p className="text-xs text-[#172030]/50 truncate">{alert.description}</p>
        <div className="flex items-center gap-2 mt-1">
          <Badge variant="outline" className={`text-[9px] px-1.5 py-0 ${priorityStyles[alert.priority as keyof typeof priorityStyles]}`}>
            {alert.priority}
          </Badge>
          <span className="text-[10px] text-[#172030]/40">{alert.date}</span>
        </div>
      </div>
      <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-[#172030]/30 hover:text-[#2A5141] flex-shrink-0">
        <Eye className="h-3.5 w-3.5" />
      </Button>
    </div>
  );
};

const ActivityItem = ({ activity }: { activity: any }) => {
  const Icon = activity.icon;
  return (
    <div className="flex items-center gap-3 p-2.5 rounded-lg bg-[#FAFAF9] hover:bg-[#F8F6F2] transition-colors border border-transparent hover:border-[#E8E4DC]">
      <div className="h-9 w-9 rounded-xl bg-white border border-[#E8E4DC] flex items-center justify-center flex-shrink-0">
        <Icon className="h-4 w-4 text-[#172030]/60" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-[#172030] truncate">{activity.user}</p>
        <p className="text-xs text-[#172030]/60 truncate">{activity.action}</p>
        <p className="text-[10px] text-[#172030]/40 truncate">{activity.department}</p>
      </div>
      <div className="flex flex-col items-end flex-shrink-0">
        <span className="text-[10px] font-medium text-[#2A5141]">{activity.time}</span>
        <ArrowRight className="h-3 w-3 text-[#172030]/20" />
      </div>
    </div>
  );
};

// ============================================================
// COMPOSANT PRINCIPAL - Dashboard
// ============================================================
export const Dashboard = () => {
  return (
    <div className="h-full bg-[#FAFAF9] p-6 space-y-6 overflow-y-auto">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-[#172030]" style={{ fontFamily: "'Playfair Display', serif" }}>
            Tableau de bord BCM
          </h1>
          <p className="text-sm text-[#172030]/60 mt-1">
            Vue globale de la continuité d'activité
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 text-xs text-[#172030]/40">
            <Calendar className="h-4 w-4" />
            {new Date().toLocaleDateString('fr-FR', { 
              weekday: 'long', 
              day: 'numeric', 
              month: 'long', 
              year: 'numeric' 
            })}
          </div>
          <Button variant="outline" size="sm" className="h-8 gap-1.5 border-[#E8E4DC] text-[#172030]/60 hover:text-[#172030]">
            <RefreshCw className="h-3.5 w-3.5" />
          </Button>
          <Button size="sm" className="h-8 gap-1.5 bg-[#2A5141] hover:bg-[#1a3329] text-white">
            <FileBarChart className="h-3.5 w-3.5" />
            Rapport
          </Button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {stats.map((stat) => (
          <StatsCard key={stat.label} stat={stat} />
        ))}
      </div>

      {/* Alerts + Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
        {/* Alerts */}
        <Card className="lg:col-span-2 border-[#E8E4DC] shadow-sm bg-white">
          <CardHeader className="pb-2 pt-4 px-4">
            <CardTitle className="text-sm font-semibold text-[#172030] flex items-center gap-2">
              <Bell className="h-4 w-4 text-[#f97316]" />
              Alertes critiques
              <Badge className="bg-rose-100 text-rose-700 border-rose-200 text-[9px] ml-1">
                {alerts.length}
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4">
            {alerts.map((alert, index) => (
              <AlertItem key={index} alert={alert} index={index} />
            ))}
          </CardContent>
        </Card>

        {/* Charts - Right Column */}
        <div className="lg:col-span-3 grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Top Risks Chart */}
          <Card className="border-[#E8E4DC] shadow-sm bg-white">
            <CardHeader className="pb-0 pt-4 px-4">
              <CardTitle className="text-sm font-semibold text-[#172030] flex items-center gap-2">
                <Flame className="h-4 w-4 text-[#ef4444]" />
                Top risques
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-2 px-4 pb-4">
              <ResponsiveContainer width="100%" height={150}>
                <BarChart data={topRisks} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" horizontal={false} />
                  <XAxis type="number" hide domain={[0, 100]} />
                  <YAxis 
                    type="category" 
                    dataKey="name" 
                    fontSize={10} 
                    tickLine={false} 
                    axisLine={false} 
                    width={55}
                    tick={{ fill: '#172030', opacity: 0.6 }}
                  />
                  <Tooltip 
                    formatter={(value: any) => [`${value}%`, 'Score']}
                    contentStyle={{ 
                      borderRadius: '8px', 
                      border: '1px solid #E8E4DC',
                      fontSize: '12px'
                    }}
                  />
                  <Bar 
                    dataKey="score" 
                    radius={[0, 4, 4, 0]} 
                    barSize={10}
                  >
                    {topRisks.map((entry, index) => (
                      <Cell key={index} fill={entry.color} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
              <div className="flex flex-wrap gap-2 mt-1 justify-center">
                {topRisks.map((risk) => (
                  <Badge 
                    key={risk.name} 
                    variant="outline" 
                    className="text-[9px]"
                    style={{ borderColor: risk.color, color: risk.color }}
                  >
                    {risk.level}
                  </Badge>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Risk Distribution Donut */}
          <Card className="border-[#E8E4DC] shadow-sm bg-white">
            <CardHeader className="pb-0 pt-4 px-4">
              <CardTitle className="text-sm font-semibold text-[#172030] flex items-center gap-2">
                <PieChartIcon className="h-4 w-4 text-[#2A5141]" />
                Distribution des risques
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-2 px-4 pb-4">
              <ResponsiveContainer width="100%" height={150}>
                <PieChart>
                  <Pie
                    data={riskDistribution}
                    dataKey="value"
                    nameKey="name"
                    innerRadius={30}
                    outerRadius={55}
                    paddingAngle={2}
                    stroke="white"
                    strokeWidth={2}
                  >
                    {riskDistribution.map((d) => (
                      <Cell key={d.name} fill={d.color} />
                    ))}
                  </Pie>
                  <Legend 
                    verticalAlign="bottom" 
                    height={20}
                    iconSize={6}
                    iconType="circle"
                    formatter={(value) => (
                      <span className="text-[9px] text-[#172030]/60 font-medium">{value}</span>
                    )}
                  />
                </PieChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Recent Activity + BCM Status */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
        {/* Recent Activity */}
        <Card className="lg:col-span-3 border-[#E8E4DC] shadow-sm bg-white">
          <CardHeader className="pb-2 pt-4 px-4">
            <CardTitle className="text-sm font-semibold text-[#172030] flex items-center justify-between">
              <span className="flex items-center gap-2">
                <Activity className="h-4 w-4 text-[#2A5141]" />
                Activité récente
              </span>
              <Button variant="ghost" size="sm" className="h-7 text-xs text-[#2A5141] hover:text-[#1a3329]">
                Voir tout <ChevronRight className="h-3 w-3" />
              </Button>
            </CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4 space-y-1.5">
            {recentActivity.map((activity, index) => (
              <ActivityItem key={index} activity={activity} />
            ))}
          </CardContent>
        </Card>

        {/* BCM Status */}
        <Card className="lg:col-span-2 border-[#E8E4DC] shadow-sm bg-white">
          <CardHeader className="pb-2 pt-4 px-4">
            <CardTitle className="text-sm font-semibold text-[#172030] flex items-center gap-2">
              <Gauge className="h-4 w-4 text-[#2A5141]" />
              État BCM
            </CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4 space-y-3">
            {bcmStatus.map((item, index) => (
              <div key={index} className="space-y-1">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-[#172030]/60">{item.label}</span>
                  <span className="text-xs font-semibold text-[#172030]">{item.value}%</span>
                </div>
                <div className="h-1.5 bg-[#F8F6F2] rounded-full overflow-hidden">
                  <div 
                    className="h-full rounded-full transition-all duration-500"
                    style={{ 
                      width: `${item.value}%`,
                      backgroundColor: item.color 
                    }}
                  />
                </div>
              </div>
            ))}
            <div className="mt-2 pt-2 border-t border-[#E8E4DC]">
              <div className="flex items-center justify-between text-xs">
                <span className="text-[#172030]/40">Maturité globale</span>
                <span className="font-bold text-[#2A5141]">79%</span>
              </div>
              <div className="h-1.5 bg-[#F8F6F2] rounded-full overflow-hidden mt-1">
                <div 
                  className="h-full rounded-full transition-all duration-500"
                  style={{ 
                    width: '79%',
                    background: 'linear-gradient(90deg, #2A5141, #4A7A6A)'
                  }}
                />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Bottom Row - Critical Processes & Resource Distribution */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Critical Processes */}
        <Card className="border-[#E8E4DC] shadow-sm bg-white">
          <CardHeader className="pb-2 pt-4 px-4">
            <CardTitle className="text-sm font-semibold text-[#172030] flex items-center gap-2">
              <AlertOctagon className="h-4 w-4 text-[#ef4444]" />
              Processus critiques
              <Badge className="bg-rose-100 text-rose-700 border-rose-200 text-[9px] ml-1">
                {criticalProcesses.filter(p => p.status === "Critique").length} critiques
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4">
            <div className="space-y-1.5">
              {criticalProcesses.map((process, index) => (
                <div key={index} className="flex items-center justify-between p-2 rounded-lg bg-[#FAFAF9] hover:bg-[#F8F6F2] transition-colors">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className={cn(
                      "w-1.5 h-1.5 rounded-full flex-shrink-0",
                      process.status === "Critique" ? "bg-[#ef4444]" : "bg-[#f97316]"
                    )} />
                    <span className="text-sm text-[#172030] truncate">{process.name}</span>
                  </div>
                  <div className="flex items-center gap-3 flex-shrink-0">
                    <Badge variant="outline" className="text-[9px] bg-white">
                      RTO {process.rto}
                    </Badge>
                    <span className="text-[10px] text-[#172030]/40">{process.owner}</span>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Resource Distribution */}
        <Card className="border-[#E8E4DC] shadow-sm bg-white">
          <CardHeader className="pb-2 pt-4 px-4">
            <CardTitle className="text-sm font-semibold text-[#172030] flex items-center gap-2">
              <Layers className="h-4 w-4 text-[#2A5141]" />
              Répartition des ressources
            </CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4">
            <ResponsiveContainer width="100%" height={120}>
              <BarChart data={resourceDistribution} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" horizontal={false} />
                <XAxis type="number" hide />
                <YAxis 
                  type="category" 
                  dataKey="name" 
                  fontSize={11} 
                  tickLine={false} 
                  axisLine={false} 
                  width={35}
                  tick={{ fill: '#172030', opacity: 0.6 }}
                />
                <Tooltip 
                  formatter={(value: any) => [`${value}`, 'Ressources']}
                  contentStyle={{ 
                    borderRadius: '8px', 
                    border: '1px solid #E8E4DC',
                    fontSize: '12px'
                  }}
                />
                <Bar dataKey="value" radius={[0, 4, 4, 0]} barSize={12}>
                  {resourceDistribution.map((entry, index) => (
                    <Cell key={index} fill={entry.color} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
            <div className="flex flex-wrap gap-3 justify-center mt-1">
              {resourceDistribution.map((item) => (
                <div key={item.name} className="flex items-center gap-1.5">
                  <div className="w-2 h-2 rounded-full" style={{ backgroundColor: item.color }} />
                  <span className="text-[9px] text-[#172030]/60">{item.name}</span>
                  <span className="text-[9px] font-semibold text-[#172030]">{item.value}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};