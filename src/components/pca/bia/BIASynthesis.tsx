import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { 
  AlertCircle, Database, Clock, Server, TrendingUp, AlertTriangle, 
  Building2, Activity, Globe, Shield, Download
} from 'lucide-react';
import { useBia } from '@/contexts/BiaContext';

const BIASynthesis: React.FC = () => {
  const { processes } = useBia();
  
  // Si pas de données
  if (!processes || processes.length === 0) {
    return (
      <div className="p-4 md:p-6 max-w-7xl mx-auto">
        <div className="flex items-center justify-center h-64">
          <Card>
            <CardContent className="p-8 text-center">
              <Database className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-500">Aucune donnée BIA disponible</p>
              <p className="text-sm text-gray-400">Veuillez créer des processus dans le module BIA</p>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  // ===== CALCULS DIRECTS DEPUIS L'INVENTAIRE =====
  const totalProcessus = processes.length;
  
  // Processus critiques (score >= 4)
  const computeMaxScore = (impacts: any) => {
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
  };
  
  const processusCritiques = processes.filter(p => computeMaxScore(p.impacts) >= 4).length;
  const pourcentageCritique = Math.round((processusCritiques / totalProcessus) * 100);
  const rtoLePlusCourt = Math.min(...processes.map(p => p.rto || 0));
  const processAvecRtoLePlusCourt = processes.filter(p => p.rto === rtoLePlusCourt).length;
  const servicesCount = new Set(processes.map(p => p.department || p.entityId)).size;
  
  // Applications IT
  const allApps = processes.flatMap(p => (p as any).appsCritiques || []);
  const totalApps = new Set(allApps.map((a: any) => a.name)).size;
  const appsSansSLA = allApps.filter((a: any) => !a.sla).length;
  
  // Complétude
  const completeCount = processes.filter(p => {
    const hasImpacts = p.impacts && Object.keys(p.impacts).length > 0;
    const hasResources = p.resources && p.resources.length > 0;
    return hasImpacts && hasResources;
  }).length;
  const completude = Math.round((completeCount / totalProcessus) * 100);
  const fichesIncompletes = totalProcessus - completeCount;

  // Distribution RTO (comme dans l'image)
  const rtoDistribution = [
    { label: '2h', count: processes.filter(p => p.rto <= 2).length },
    { label: '24h', count: processes.filter(p => p.rto > 2 && p.rto <= 24).length },
    { label: '48h', count: processes.filter(p => p.rto > 24 && p.rto <= 48).length },
    { label: '120h', count: processes.filter(p => p.rto > 48 && p.rto <= 120).length },
  ];
  const totalAlerte = rtoDistribution[0].count + rtoDistribution[1].count;

  // Impacts par direction (depuis les données)
  const impactsParDirection = processes.reduce((acc, p) => {
    const dir = p.department || 'Non défini';
    if (!acc[dir]) {
      acc[dir] = { financier: 0, conformite: 0, operationnel: 0, reputationnel: 0 };
    }
    const impacts = p.impacts || {};
    // Agrégation simple des impacts
    for (const period of Object.values(impacts)) {
      if (typeof period === 'object' && period !== null) {
        acc[dir].financier += (period as any).financial || 0;
        acc[dir].conformite += (period as any).regulatory || 0;
        acc[dir].operationnel += (period as any).operational || 0;
        acc[dir].reputationnel += (period as any).reputation || 0;
      }
    }
    return acc;
  }, {} as Record<string, { financier: number; conformite: number; operationnel: number; reputationnel: number }>);

  // Top applications
  const appCount = allApps.reduce((acc: any, app: any) => {
    if (!acc[app.name]) acc[app.name] = { count: 0, sla: true, rto: app.rto || 0 };
    acc[app.name].count++;
    if (!app.sla) acc[app.name].sla = false;
    return acc;
  }, {});
  
  const topApps = Object.entries(appCount)
    .sort((a: any, b: any) => b[1].count - a[1].count)
    .slice(0, 4)
    .map(([name, data]: [string, any]) => ({ name, ...data }));

  // Top prestataires (fournisseurs dans les ressources)
  const allPrestataires = processes.flatMap(p => 
    (p.resources || []).filter((r: any) => r.type === 'Fournisseur')
  );
  const prestatairesCount = allPrestataires.reduce((acc: any, p: any) => {
    if (!acc[p.name]) acc[p.name] = { count: 0, criticalite: p.criticalite || 'majeur', rto: p.rto || 0 };
    acc[p.name].count++;
    return acc;
  }, {});
  
  const topPrestataires = Object.entries(prestatairesCount)
    .sort((a: any, b: any) => b[1].count - a[1].count)
    .slice(0, 4)
    .map(([name, data]: [string, any]) => ({ name, ...data }));

  // Ressources par palier
  const paliers = ['≤ 24h', '≤ 48h', '≤ 120h', '> 120h'];
  const allRessources = processes.flatMap(p => p.resources || []);
  const ressourcesParPalier = paliers.map(palier => {
    const grouped: Record<string, number> = {};
    for (const r of allRessources) {
      if (r.palier === palier || (r.availability && r.availability[palier])) {
        const name = r.name || r.type || 'Ressource';
        if (!grouped[name]) grouped[name] = 0;
        grouped[name] += r.quantite || 1;
      }
    }
    return { palier, ressources: grouped };
  });

  return (
    <div className="p-4 md:p-6 max-w-7xl mx-auto">
      {/* En-tête */}
      <div className="mb-6 flex flex-col md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-gray-900">Synthèse BIA consolidée</h1>
          <p className="text-sm text-gray-500 mt-1">
            Vue agrégée de toutes les analyses d'impact, par direction et par département.
          </p>
        </div>
        <div className="flex items-center gap-2 mt-2 md:mt-0">
          <span className="text-xs text-gray-500 bg-gray-100 px-3 py-1 rounded-full">
            {completeCount} fiches · {new Date().toLocaleDateString('fr-FR')}
          </span>
          <button className="text-xs bg-blue-600 text-white px-3 py-1 rounded-full hover:bg-blue-700 flex items-center gap-1">
            <Download className="h-3 w-3" />
            Export COMEX
          </button>
        </div>
      </div>

      {/* ===== CARTES ===== */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4 mb-6">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-gray-500 font-medium">Processus analysés</p>
                <p className="text-2xl font-bold">{totalProcessus}</p>
                <p className="text-xs text-gray-400">sur {servicesCount} services</p>
              </div>
              <Database className="h-8 w-8 text-blue-500 opacity-50" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-gray-500 font-medium">Processus critiques</p>
                <p className="text-2xl font-bold text-red-600">{processusCritiques}</p>
                <p className="text-xs text-gray-400">{pourcentageCritique}% du total</p>
              </div>
              <AlertCircle className="h-8 w-8 text-red-500 opacity-50" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-gray-500 font-medium">RTO le plus court</p>
                <p className="text-2xl font-bold">{rtoLePlusCourt}h</p>
                <p className="text-xs text-gray-400">{processAvecRtoLePlusCourt} processus</p>
              </div>
              <Clock className="h-8 w-8 text-orange-500 opacity-50" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-gray-500 font-medium">Applications IT</p>
                <p className="text-2xl font-bold">{totalApps}</p>
                <p className="text-xs text-gray-400">dont {appsSansSLA} sans SLA</p>
              </div>
              <Server className="h-8 w-8 text-purple-500 opacity-50" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Complétude */}
      <Card className="mb-6">
        <CardContent className="p-4">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-3">
              <p className="text-sm font-medium">Complétude globale</p>
              <div className="w-48 h-2 bg-gray-200 rounded-full overflow-hidden">
                <div className={`h-full rounded-full ${completude >= 80 ? 'bg-green-500' : completude >= 50 ? 'bg-yellow-500' : 'bg-red-500'}`} style={{ width: `${completude}%` }} />
              </div>
              <span className="text-sm font-semibold">{completude}%</span>
            </div>
            {fichesIncompletes > 0 && (
              <div className="flex items-center gap-2 text-sm text-yellow-600">
                <AlertCircle className="h-4 w-4" />
                <span>{fichesIncompletes} fiches incomplètes</span>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Concentration du risque */}
      <Card className="mb-6">
        <CardHeader className="pb-2">
          <div className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-blue-600" />
            <CardTitle className="text-base">Concentration du risque</CardTitle>
          </div>
          <p className="text-xs text-gray-500">Distribution des RTO - Combien de processus critiques doivent redémarrer dans chaque fenêtre de temps</p>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {rtoDistribution.map(({ label, count }) => {
              const colors: Record<string, string> = {
                '2h': 'bg-red-600',
                '24h': 'bg-orange-500',
                '48h': 'bg-yellow-500',
                '120h': 'bg-blue-400',
              };
              return (
                <div key={label} className={`p-3 rounded-lg ${colors[label] || 'bg-gray-200'} text-white`}>
                  <p className="text-sm font-medium">{label}</p>
                  <p className="text-2xl font-bold">{count}</p>
                  <p className="text-xs opacity-80">processus</p>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Impacts sévères */}
      <Card className="mb-6">
        <CardHeader className="pb-2">
          <div className="flex items-center gap-2">
            <Building2 className="h-5 w-5 text-purple-600" />
            <CardTitle className="text-base">Impacts sévères par direction</CardTitle>
          </div>
          <p className="text-xs text-gray-500">Nombre d'impacts « sévère » ou « très sévère » détectés (≤ 120h)</p>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-2 px-3 font-medium text-gray-500 text-xs">Direction</th>
                  <th className="text-center py-2 px-3 font-medium text-gray-500 text-xs">Fin.</th>
                  <th className="text-center py-2 px-3 font-medium text-gray-500 text-xs">Conf.</th>
                  <th className="text-center py-2 px-3 font-medium text-gray-500 text-xs">Opér.</th>
                  <th className="text-center py-2 px-3 font-medium text-gray-500 text-xs">Rép.</th>
                </tr>
              </thead>
              <tbody>
                {Object.entries(impactsParDirection).map(([direction, impacts], index) => {
                  const isLast = index === Object.keys(impactsParDirection).length - 1;
                  return (
                    <tr key={direction} className={!isLast ? 'border-b' : ''}>
                      <td className="py-2 px-3 font-medium">{direction}</td>
                      <td className={`text-center py-2 px-3 ${impacts.financier >= 3 ? 'font-bold text-red-600' : ''}`}>
                        {impacts.financier}
                      </td>
                      <td className={`text-center py-2 px-3 ${impacts.conformite >= 3 ? 'font-bold text-red-600' : ''}`}>
                        {impacts.conformite}
                      </td>
                      <td className={`text-center py-2 px-3 ${impacts.operationnel >= 3 ? 'font-bold text-red-600' : ''}`}>
                        {impacts.operationnel}
                      </td>
                      <td className={`text-center py-2 px-3 ${impacts.reputationnel >= 3 ? 'font-bold text-red-600' : ''}`}>
                        {impacts.reputationnel}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div className="mt-3 flex items-center gap-4 text-xs text-gray-500">
            <span className="inline-block w-3 h-3 bg-red-100 border border-red-300 rounded mr-1"></span>
            0
            <span className="inline-block w-3 h-3 bg-red-300 border border-red-400 rounded ml-2 mr-1"></span>
            1-2
            <span className="inline-block w-3 h-3 bg-red-500 border border-red-600 rounded ml-2 mr-1"></span>
            3+
          </div>
        </CardContent>
      </Card>

      {/* Alerte */}
      <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
        <div className="flex items-start gap-3">
          <AlertCircle className="h-5 w-5 text-red-600 mt-0.5 shrink-0" />
          <p className="text-sm text-red-700">
            <span className="font-bold">{totalAlerte} processus sur {totalProcessus}</span> exigent une reprise en moins de 24h.
          </p>
        </div>
      </div>

      {/* Ressources critiques partagées */}
      <Card className="mb-6 border-yellow-200 bg-yellow-50">
        <CardContent className="p-4">
          <div className="flex items-start gap-3">
            <AlertTriangle className="h-5 w-5 text-yellow-600 mt-0.5 shrink-0" />
            <div>
              <p className="text-sm font-medium text-yellow-800">Ressources critiques partagées</p>
              <p className="text-sm text-yellow-700">
                Ces ressources sont requises par plusieurs services critiques. Leur défaillance impacterait simultanément plusieurs directions.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Applications IT et Prestataires */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center gap-2">
              <Server className="h-5 w-5 text-indigo-600" />
              <CardTitle className="text-base">Applications IT les plus partagées</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {topApps.length > 0 ? (
                topApps.map((app, index) => (
                  <div key={app.name} className="flex items-center justify-between p-2 bg-gray-50 rounded">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-gray-400">#{index + 1}</span>
                        <p className="font-medium text-sm">{app.name}</p>
                      </div>
                      <p className="text-xs text-gray-500">RTO {app.rto}h{!app.sla && ' - sans SLA'}</p>
                    </div>
                    <span className="text-xs font-medium bg-blue-100 text-blue-700 px-2 py-1 rounded">
                      {app.count} service{app.count > 1 ? 's' : ''}
                    </span>
                  </div>
                ))
              ) : (
                <p className="text-sm text-gray-500 text-center py-4">Aucune application référencée</p>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center gap-2">
              <Globe className="h-5 w-5 text-emerald-600" />
              <CardTitle className="text-base">Prestataires les plus critiques</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {topPrestataires.length > 0 ? (
                topPrestataires.map((presta, index) => (
                  <div key={presta.name} className="flex items-center justify-between p-2 bg-red-50 rounded">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-gray-400">#{index + 1}</span>
                        <p className="font-medium text-sm text-red-700">{presta.name}</p>
                      </div>
                      <p className="text-xs text-gray-500">RTO {presta.rto}h</p>
                    </div>
                    <span className="text-xs font-medium bg-red-100 text-red-700 px-2 py-1 rounded">
                      {presta.count} service{presta.count > 1 ? 's' : ''}
                    </span>
                  </div>
                ))
              ) : (
                <p className="text-sm text-gray-500 text-center py-4">Aucun prestataire référencé</p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Détail par direction */}
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center gap-2">
            <Building2 className="h-5 w-5 text-gray-600" />
            <CardTitle className="text-base">Détail par direction & département</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {Object.entries(
              processes.reduce((acc, p) => {
                const dir = p.department || 'Non défini';
                if (!acc[dir]) acc[dir] = { services: new Set(), count: 0, critiques: 0 };
                acc[dir].services.add(p.entityId || p.department);
                acc[dir].count++;
                if (computeMaxScore(p.impacts) >= 4) acc[dir].critiques++;
                return acc;
              }, {} as Record<string, { services: Set<string>; count: number; critiques: number }>)
            ).map(([direction, data]) => (
              <div key={direction} className="p-3 border rounded-lg">
                <p className="font-medium text-sm">{direction}</p>
                <p className="text-xs text-gray-500">{data.services.size} départements · {data.count} processus</p>
                <p className="text-xs text-red-600">{data.critiques} critiques</p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default BIASynthesis;