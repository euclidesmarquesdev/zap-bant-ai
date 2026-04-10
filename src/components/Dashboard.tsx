import React, { useState, useEffect } from 'react';
import { collection, onSnapshot, query, orderBy, limit } from 'firebase/firestore';
import { db } from '../firebase';
import { Users, MessageSquare, TrendingUp, AlertCircle, ArrowUpRight, ArrowDownRight } from 'lucide-react';
import { motion } from 'motion/react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface DashboardProps {
  onSelectLead: (id: string) => void;
}

export default function Dashboard({ onSelectLead }: DashboardProps) {
  const [leads, setLeads] = useState<any[]>([]);
  const [stats, setStats] = useState({
    totalLeads: 0,
    activeChats: 0,
    conversionRate: 0,
    waitingHuman: 0
  });

  useEffect(() => {
    const q = query(collection(db, 'leads'), orderBy('updatedAt', 'desc'), limit(10));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const leadsData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setLeads(leadsData);
      
      // Calculate stats
      const total = snapshot.size;
      const waiting = leadsData.filter((l: any) => l.status === 'humano').length;
      setStats({
        totalLeads: total,
        activeChats: leadsData.filter((l: any) => l.status !== 'novo').length,
        conversionRate: 12.5, // Mock value for now
        waitingHuman: waiting
      });
    });

    return () => unsubscribe();
  }, []);

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-2xl font-bold text-slate-900">Visão Geral</h2>
        <p className="text-slate-500">Acompanhe o desempenho dos seus agentes e leads em tempo real.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <KPICard 
          title="Total de Leads" 
          value={stats.totalLeads} 
          icon={Users} 
          trend="+12%" 
          trendUp={true} 
          color="blue"
        />
        <KPICard 
          title="Atendimentos Ativos" 
          value={stats.activeChats} 
          icon={MessageSquare} 
          trend="+5%" 
          trendUp={true} 
          color="green"
        />
        <KPICard 
          title="Taxa de Conversão" 
          value={`${stats.conversionRate}%`} 
          icon={TrendingUp} 
          trend="-2%" 
          trendUp={false} 
          color="purple"
        />
        <KPICard 
          title="Aguardando Humano" 
          value={stats.waitingHuman} 
          icon={AlertCircle} 
          trend="Urgente" 
          trendUp={false} 
          color="orange"
          highlight={stats.waitingHuman > 0}
        />
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-6 border-b border-slate-100 flex items-center justify-between">
          <h3 className="font-bold text-slate-900">Leads Recentes</h3>
          <button className="text-blue-600 text-sm font-semibold hover:underline">Ver todos</button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-slate-50 text-slate-500 text-xs uppercase tracking-wider">
                <th className="px-6 py-4 font-semibold">Cliente</th>
                <th className="px-6 py-4 font-semibold">Status</th>
                <th className="px-6 py-4 font-semibold">Score</th>
                <th className="px-6 py-4 font-semibold">BANT</th>
                <th className="px-6 py-4 font-semibold">Última Atividade</th>
                <th className="px-6 py-4 font-semibold">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {leads.map((lead) => (
                <tr key={lead.id} className="hover:bg-slate-50 transition-all cursor-pointer" onClick={() => onSelectLead(lead.id)}>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-slate-100 rounded-full flex items-center justify-center text-slate-600 font-bold">
                        {lead.name[0]}
                      </div>
                      <div>
                        <p className="font-semibold text-slate-900">{lead.name}</p>
                        <p className="text-xs text-slate-500">{lead.phone}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <StatusBadge status={lead.status} />
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2">
                      <div className="w-12 bg-slate-100 h-2 rounded-full overflow-hidden">
                        <div 
                          className={`h-full rounded-full ${lead.score > 70 ? 'bg-green-500' : lead.score > 40 ? 'bg-yellow-500' : 'bg-blue-500'}`}
                          style={{ width: `${lead.score}%` }}
                        ></div>
                      </div>
                      <span className="text-sm font-bold text-slate-700">{lead.score}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex gap-1">
                      {['B', 'A', 'N', 'T'].map((letter, i) => {
                        const key = ['budget', 'authority', 'need', 'timeline'][i];
                        const active = lead.bant?.[key];
                        return (
                          <span 
                            key={letter}
                            className={`w-6 h-6 rounded flex items-center justify-center text-[10px] font-bold ${active ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-400'}`}
                          >
                            {letter}
                          </span>
                        );
                      })}
                    </div>
                  </td>
                  <td className="px-6 py-4 text-sm text-slate-500">
                    {lead.updatedAt ? format(lead.updatedAt.toDate(), "HH:mm 'em' dd/MM", { locale: ptBR }) : '-'}
                  </td>
                  <td className="px-6 py-4">
                    <button className="p-2 text-slate-400 hover:text-blue-600 transition-all">
                      <ArrowUpRight className="w-5 h-5" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function KPICard({ title, value, icon: Icon, trend, trendUp, color, highlight }: any) {
  const colors: any = {
    blue: "bg-blue-50 text-blue-600",
    green: "bg-green-50 text-green-600",
    purple: "bg-purple-50 text-purple-600",
    orange: "bg-orange-50 text-orange-600",
  };

  return (
    <motion.div 
      whileHover={{ y: -4 }}
      className={`bg-white p-6 rounded-2xl border ${highlight ? 'border-orange-500 ring-4 ring-orange-50' : 'border-slate-200'} shadow-sm`}
    >
      <div className="flex items-center justify-between mb-4">
        <div className={`p-3 rounded-xl ${colors[color]}`}>
          <Icon className="w-6 h-6" />
        </div>
        <div className={`flex items-center gap-1 text-xs font-bold ${trendUp ? 'text-green-600' : 'text-red-500'}`}>
          {trendUp ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
          {trend}
        </div>
      </div>
      <p className="text-slate-500 text-sm font-medium">{title}</p>
      <h4 className="text-3xl font-bold text-slate-900 mt-1">{value}</h4>
    </motion.div>
  );
}

export function StatusBadge({ status }: { status: string }) {
  const styles: any = {
    novo: "bg-blue-50 text-blue-600 border-blue-100",
    atendido: "bg-indigo-50 text-indigo-600 border-indigo-100",
    negociacao: "bg-purple-50 text-purple-600 border-purple-100",
    fechamento: "bg-green-50 text-green-600 border-green-100",
    pagamento: "bg-emerald-50 text-emerald-600 border-emerald-100",
    humano: "bg-orange-50 text-orange-600 border-orange-100 animate-pulse",
  };

  const labels: any = {
    novo: "Novo",
    atendido: "Atendido",
    negociacao: "Negociação",
    fechamento: "Fechamento",
    pagamento: "Pagamento",
    humano: "Aguardando Humano",
  };

  return (
    <span className={`px-3 py-1 rounded-full text-xs font-bold border ${styles[status] || styles.novo}`}>
      {labels[status] || status}
    </span>
  );
}
