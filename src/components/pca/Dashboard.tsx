import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { AlertTriangle, ShieldCheck, Activity, TrendingUp } from "lucide-react";
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

const risks = [
  { name: "Cyberattaque", probability: 4, impact: 5, score: 20 },
  { name: "Panne IT", probability: 3, impact: 4, score: 12 },
  { name: "Incendie", probability: 2, impact: 5, score: 10 },
  { name: "Pandémie", probability: 2, impact: 4, score: 8 },
  { name: "Perte fournisseur", probability: 3, impact: 3, score: 9 },
  { name: "Catastrophe naturelle", probability: 1, impact: 5, score: 5 },
];

const distribution = [
  { name: "Critique", value: 2, color: "hsl(var(--destructive))" },
  { name: "Élevé", value: 3, color: "hsl(var(--warning))" },
  { name: "Modéré", value: 4, color: "hsl(var(--primary-glow))" },
  { name: "Faible", value: 5, color: "hsl(var(--success))" },
];

const stats = [
  { label: "Risques identifiés", value: "14", icon: AlertTriangle, tone: "text-warning" },
  { label: "Plans actifs", value: "8", icon: ShieldCheck, tone: "text-success" },
  { label: "Tests réalisés", value: "23", icon: Activity, tone: "text-primary" },
  { label: "Maturité PCA", value: "76%", icon: TrendingUp, tone: "text-accent" },
];

export const Dashboard = () => {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-foreground">Tableau de bord</h1>
        <p className="text-muted-foreground mt-1">Vue d'ensemble de l'analyse des risques et de la continuité d'activité</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((s) => {
          const Icon = s.icon;
          return (
            <Card key={s.label} className="shadow-[var(--shadow-card)]">
              <CardContent className="p-5 flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">{s.label}</p>
                  <p className="text-2xl font-bold mt-1">{s.value}</p>
                </div>
                <div className="h-11 w-11 rounded-lg bg-secondary flex items-center justify-center">
                  <Icon className={`h-5 w-5 ${s.tone}`} />
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2 shadow-[var(--shadow-card)]">
          <CardHeader>
            <CardTitle>Cartographie des risques</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={risks}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="name" stroke="hsl(var(--muted-foreground))" fontSize={12} />
                <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "hsl(var(--card))",
                    border: "1px solid hsl(var(--border))",
                    borderRadius: "var(--radius)",
                  }}
                />
                <Bar dataKey="score" fill="hsl(var(--primary))" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card className="shadow-[var(--shadow-card)]">
          <CardHeader>
            <CardTitle>Répartition par criticité</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie data={distribution} dataKey="value" nameKey="name" innerRadius={50} outerRadius={90} paddingAngle={3}>
                  {distribution.map((d) => (
                    <Cell key={d.name} fill={d.color} />
                  ))}
                </Pie>
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      <Card className="shadow-[var(--shadow-card)]">
        <CardHeader>
          <CardTitle>Top risques à surveiller</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {risks.slice(0, 4).map((r) => {
            const level = r.score >= 15 ? "Critique" : r.score >= 10 ? "Élevé" : "Modéré";
            const variant = r.score >= 15 ? "destructive" : r.score >= 10 ? "default" : "secondary";
            return (
              <div key={r.name} className="space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className="font-medium text-foreground">{r.name}</span>
                    <Badge variant={variant as any}>{level}</Badge>
                  </div>
                  <span className="text-sm text-muted-foreground">Score {r.score}/25</span>
                </div>
                <Progress value={(r.score / 25) * 100} />
              </div>
            );
          })}
        </CardContent>
      </Card>
    </div>
  );
};
