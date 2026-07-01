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
} from "recharts";

// Données
const stats = [
  { 
    label: "Risques critiques", 
    value: "12", 
    change: "+2",
    icon: AlertTriangle,
    color: "text-rose-500",
    bg: "bg-rose-50"
  },
  { 
    label: "Plans PCA actifs", 
    value: "8", 
    change: "100%",
    icon: ShieldCheck,
    color: "text-emerald-500",
    bg: "bg-emerald-50"
  },
  { 
    label: "Tests réalisés", 
    value: "23", 
    change: "+5",
    icon: Activity,
    color: "text-blue-500",
    bg: "bg-blue-50"
  },
  { 
    label: "Maturité BCM", 
    value: "76%", 
    change: "+4%",
    icon: TrendingUp,
    color: "text-indigo-500",
    bg: "bg-indigo-50"
  },
];

const alerts = [
  { title: "Plan PCA expiré", priority: "Critique", date: "Aujourd'hui", icon: AlertOctagon },
  { title: "Test PCA en retard", priority: "Élevé", date: "Hier", icon: AlertTriangle },
  { title: "BIA à réviser", priority: "Moyen", date: "Il y a 3j", icon: FileCheck },
];

const topRisks = [
  { name: "Cyberattaque", score: 90, level: "Critique" },
  { name: "Panne IT", score: 78, level: "Élevé" },
  { name: "Incendie", score: 68, level: "Élevé" },
  { name: "Pandémie", score: 58, level: "Moyen" },
];

const riskDistribution = [
  { name: "Critique", value: 2, color: "#ef4444" },
  { name: "Élevé", value: 3, color: "#f59e0b" },
  { name: "Moyen", value: 4, color: "#3b82f6" },
  { name: "Faible", value: 5, color: "#10b981" },
];

const activities = [
  { user: "Ahmed", action: "a validé un BIA", time: "2h", icon: CheckCircle },
  { user: "Julie", action: "a créé un PCA", time: "4h", icon: FileText },
  { user: "Marc", action: "Nouvelle analyse", time: "8h", icon: AlertTriangle },
];

const bcmStatus = [
  { label: "Plans PCA", value: 82 },
  { label: "BIA", value: 91 },
  { label: "Exercices", value: 68 },
];

export const Dashboard = () => {
  return (
    <div className="h-full bg-slate-50/50 p-6 space-y-5 animate-fadeIn overflow-auto">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900 tracking-tight">
            Tableau de bord BCM
          </h1>
          <p className="text-slate-500 text-sm">Vue globale de la continuité d'activité</p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-400">
            {new Date().toLocaleDateString('fr-FR')}
          </span>
          <Button variant="outline" size="sm" className="h-8 gap-1">
            <RefreshCw className="h-3.5 w-3.5" />
          </Button>
          <Button size="sm" className="h-8 gap-1 bg-slate-900 hover:bg-slate-800">
            <FileText className="h-3.5 w-3.5" />
            PDF
          </Button>
        </div>
      </div>

      {/* KPI - 4 cartes */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {stats.map((s) => {
          const Icon = s.icon;
          return (
            <Card key={s.label} className="border-0 shadow-sm">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs text-slate-500 font-medium">{s.label}</p>
                    <p className="text-xl font-bold text-slate-900 mt-0.5">{s.value}</p>
                  </div>
                  <div className={`h-9 w-9 rounded-xl ${s.bg} flex items-center justify-center`}>
                    <Icon className={`h-4 w-4 ${s.color}`} />
                  </div>
                </div>
                <div className="flex items-center gap-1 mt-2">
                  <ArrowUpRight className="h-3 w-3 text-emerald-500" />
                  <span className="text-xs font-medium text-emerald-500">{s.change}</span>
                  <span className="text-xs text-slate-400">
                    {s.label === "Plans PCA actifs" ? "couverture" : "semaine"}
                  </span>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Alertes + Graphiques - 2 colonnes */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
        {/* Alertes - colonne de gauche */}
        <Card className="lg:col-span-2 border-0 shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-slate-900 flex items-center gap-2">
              <Bell className="h-4 w-4 text-amber-500" />
              Alertes
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {alerts.map((alert, index) => {
              const Icon = alert.icon;
              const priorityColors = {
                "Critique": "bg-rose-100 text-rose-700",
                "Élevé": "bg-orange-100 text-orange-700",
                "Moyen": "bg-amber-100 text-amber-700",
              };
              return (
                <div key={index} className="flex items-center justify-between py-2 border-b border-slate-100 last:border-0">
                  <div className="flex items-center gap-3">
                    <div className={`h-7 w-7 rounded-lg ${priorityColors[alert.priority as keyof typeof priorityColors]} flex items-center justify-center`}>
                      <Icon className="h-3.5 w-3.5" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-slate-900">{alert.title}</p>
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="text-[10px] px-1.5">{alert.priority}</Badge>
                        <span className="text-[10px] text-slate-400">{alert.date}</span>
                      </div>
                    </div>
                  </div>
                  <Button variant="ghost" size="sm" className="h-7 w-7 p-0">
                    <Eye className="h-3.5 w-3.5 text-slate-400" />
                  </Button>
                </div>
              );
            })}
          </CardContent>
        </Card>

        {/* Graphiques - colonne de droite */}
        <div className="lg:col-span-3 grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Bar Chart */}
          <Card className="border-0 shadow-sm">
            <CardHeader className="pb-0">
              <CardTitle className="text-sm text-slate-900">Top risques</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={140}>
                <BarChart data={topRisks} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" horizontal={false} />
                  <XAxis type="number" hide />
                  <YAxis type="category" dataKey="name" fontSize={10} tickLine={false} axisLine={false} width={55} />
                  <Tooltip />
                  <Bar dataKey="score" fill="#3b82f6" radius={[0, 4, 4, 0]} barSize={12} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* Donut Chart */}
          <Card className="border-0 shadow-sm">
            <CardHeader className="pb-0">
              <CardTitle className="text-sm text-slate-900">Criticité</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={140}>
                <PieChart>
                  <Pie
                    data={riskDistribution}
                    dataKey="value"
                    nameKey="name"
                    innerRadius={30}
                    outerRadius={55}
                    paddingAngle={2}
                  >
                    {riskDistribution.map((d) => (
                      <Cell key={d.name} fill={d.color} />
                    ))}
                  </Pie>
                  <Legend 
                    verticalAlign="bottom" 
                    height={20}
                    iconSize={8}
                    formatter={(value) => <span className="text-[10px] text-slate-600">{value}</span>}
                  />
                </PieChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Activité récente + État BCM - 2 colonnes */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
        {/* Activité récente */}
        <Card className="lg:col-span-3 border-0 shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-slate-900">Activité récente</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {activities.map((activity, index) => {
                const Icon = activity.icon;
                return (
                  <div key={index} className="flex items-center gap-3 p-2 rounded-lg bg-slate-50/50">
                    <div className="h-8 w-8 rounded-lg bg-white flex items-center justify-center">
                      <Icon className="h-4 w-4 text-slate-600" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-slate-900 truncate">{activity.user}</p>
                      <p className="text-xs text-slate-500 truncate">{activity.action}</p>
                    </div>
                    <span className="text-[10px] text-slate-400 whitespace-nowrap">{activity.time}</span>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>

        {/* État BCM */}
        <Card className="lg:col-span-2 border-0 shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-slate-900">État BCM</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {bcmStatus.map((item, index) => (
              <div key={index} className="space-y-1">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-slate-600">{item.label}</span>
                  <span className="text-xs font-semibold text-slate-900">{item.value}%</span>
                </div>
                <Progress value={item.value} className="h-1.5 bg-slate-100" />
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};