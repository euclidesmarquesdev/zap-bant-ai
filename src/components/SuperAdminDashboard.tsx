import React, { useState, useEffect } from 'react';
import { collection, onSnapshot, query, orderBy, doc, updateDoc, getDocs, Timestamp } from 'firebase/firestore';
import { db } from '../firebase';
import { 
  Building2, 
  Users, 
  CreditCard, 
  ShieldCheck, 
  ShieldAlert, 
  Search, 
  MoreVertical, 
  CheckCircle2, 
  XCircle, 
  TrendingUp, 
  DollarSign,
  Calendar,
  ExternalLink,
  Loader2,
  Filter,
  Clock
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { toast } from 'sonner';

export default function SuperAdminDashboard() {
  const [orgs, setOrgs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filter, setFilter] = useState<'all' | 'active' | 'inactive'>('all');

  useEffect(() => {
    const q = query(collection(db, 'organizations'), orderBy('createdAt', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setOrgs(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const toggleOrgStatus = async (orgId: string, currentStatus: string) => {
    if (orgId === 'master-org' || orgId === 'suprema') {
      toast.error('Esta organização é protegida e não pode ser desativada.');
      return;
    }
    try {
      const newStatus = currentStatus === 'active' ? 'inactive' : 'active';
      await updateDoc(doc(db, 'organizations', orgId), {
        status: newStatus,
        active: newStatus === 'active',
        updatedAt: Timestamp.now()
      });
      toast.success(`Organização ${newStatus === 'active' ? 'ativada' : 'desativada'} com sucesso!`);
    } catch (error) {
      console.error('Erro ao alternar status:', error);
      toast.error('Erro ao alterar status da organização.');
    }
  };

  const filteredOrgs = orgs.filter(org => {
    const matchesSearch = (org.name || '').toLowerCase().includes(searchTerm.toLowerCase()) || 
                          (org.id || '').toLowerCase().includes(searchTerm.toLowerCase());
    const matchesFilter = filter === 'all' || 
                         (filter === 'active' ? org.status === 'active' : org.status === 'inactive');
    return matchesSearch && matchesFilter;
  });

  const stats = {
    totalOrgs: orgs.length,
    activeOrgs: orgs.filter(o => o.status === 'active').length,
    pendingOrgs: orgs.filter(o => o.status === 'pending').length,
    totalRevenue: orgs.reduce((acc, o) => {
      const plans: any = { free: 0, basic: 97, pro: 197, enterprise: 497 };
      return acc + (o.subscriptionStatus === 'active' ? (plans[o.plan] || 0) : 0);
    }, 0),
  };

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    );
  }

  return (
    <div className="space-y-8 pb-12">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">Painel de Controle Global</h2>
          <p className="text-slate-500">Gestão completa de instâncias, faturamento e licenciamento SaaS.</p>
        </div>

        <div className="flex items-center gap-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
            <input 
              type="text" 
              placeholder="Buscar organização..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9 pr-4 py-2 bg-white border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 w-64 shadow-sm"
            />
          </div>
          <div className="flex bg-white p-1 rounded-xl border border-slate-200 shadow-sm">
            {(['all', 'active', 'inactive'] as const).map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all ${
                  filter === f ? 'bg-blue-600 text-white shadow-md' : 'text-slate-500 hover:bg-slate-50'
                }`}
              >
                {f === 'all' ? 'Todas' : f === 'active' ? 'Ativas' : 'Inativas'}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard title="Total de Orgs" value={stats.totalOrgs} icon={Building2} color="blue" />
        <StatCard title="Orgs Ativas" value={stats.activeOrgs} icon={CheckCircle2} color="green" />
        <StatCard title="Receita Mensal (MRR)" value={`R$ ${stats.totalRevenue.toLocaleString()}`} icon={DollarSign} color="purple" />
        <StatCard title="Aguardando Aprovação" value={stats.pendingOrgs} icon={ShieldAlert} color="orange" highlight={stats.pendingOrgs > 0} />
      </div>

      {/* Orgs Table */}
      <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
          <h3 className="font-bold text-slate-900 flex items-center gap-2">
            <Filter className="w-4 h-4 text-slate-400" />
            Lista de Organizações
          </h3>
          <span className="text-xs font-medium text-slate-500">{filteredOrgs.length} instâncias encontradas</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-slate-50/50 text-slate-500 text-[10px] uppercase tracking-widest">
                <th className="px-6 py-4 font-bold">Organização / ID</th>
                <th className="px-6 py-4 font-bold">Status</th>
                <th className="px-6 py-4 font-bold">Plano</th>
                <th className="px-6 py-4 font-bold">Financeiro</th>
                <th className="px-6 py-4 font-bold">Criado em</th>
                <th className="px-6 py-4 font-bold text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredOrgs.map((org) => (
                <tr key={org.id} className="hover:bg-slate-50/50 transition-all group">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold text-lg ${org.active ? 'bg-blue-100 text-blue-600' : 'bg-slate-100 text-slate-400'}`}>
                        {org.name?.[0] || '?'}
                      </div>
                      <div>
                        <p className="font-bold text-slate-900">{org.name || 'Sem Nome'}</p>
                        <p className="text-[10px] text-slate-400 font-mono">{org.id}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <button 
                        onClick={() => toggleOrgStatus(org.id, org.status)}
                        className={`relative w-10 h-5 rounded-full transition-all ${
                          org.status === 'active' ? 'bg-green-500' : 'bg-slate-300'
                        }`}
                      >
                        <div className={`absolute top-1 w-3 h-3 bg-white rounded-full transition-all ${
                          org.status === 'active' ? 'left-6' : 'left-1'
                        }`} />
                      </button>
                      <span className={`text-[10px] font-bold uppercase tracking-wider ${
                        org.status === 'active' ? 'text-green-600' : 
                        org.status === 'pending' ? 'text-amber-600' :
                        'text-red-600'
                      }`}>
                        {org.status === 'active' ? 'Ativa' : org.status === 'pending' ? 'Pendente' : 'Desativada'}
                      </span>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <span className={`px-2 py-1 rounded-lg text-[10px] font-bold uppercase tracking-widest ${
                      org.plan === 'enterprise' ? 'bg-purple-100 text-purple-700' :
                      org.plan === 'pro' ? 'bg-blue-100 text-blue-700' :
                      org.plan === 'basic' ? 'bg-green-100 text-green-700' :
                      'bg-slate-100 text-slate-500'
                    }`}>
                      {org.plan || 'free'}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex flex-col gap-1">
                      <span className={`text-[10px] font-bold uppercase ${
                        org.subscriptionStatus === 'active' ? 'text-green-600' :
                        org.subscriptionStatus === 'past_due' ? 'text-orange-600' :
                        'text-slate-400'
                      }`}>
                        {org.subscriptionStatus || 'N/A'}
                      </span>
                      {org.nextBillingDate && (
                        <span className="text-[9px] text-slate-400 flex items-center gap-1">
                          <Calendar className="w-2.5 h-2.5" />
                          {format(org.nextBillingDate.toDate(), "dd/MM/yy")}
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-4 text-xs text-slate-500">
                    {org.createdAt ? format(org.createdAt.toDate(), "dd/MM/yyyy", { locale: ptBR }) : '-'}
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-all">
                      <button className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-xl transition-all" title="Ver Detalhes">
                        <ExternalLink className="w-4 h-4" />
                      </button>
                      <button className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-xl transition-all">
                        <MoreVertical className="w-4 h-4" />
                      </button>
                    </div>
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

function StatCard({ title, value, icon: Icon, color, highlight }: any) {
  const colors: any = {
    blue: "bg-blue-50 text-blue-600",
    green: "bg-green-50 text-green-600",
    purple: "bg-purple-50 text-purple-600",
    orange: "bg-orange-50 text-orange-600",
  };

  return (
    <div className={`bg-white p-6 rounded-3xl border ${highlight ? 'border-orange-500 ring-4 ring-orange-50' : 'border-slate-200'} shadow-sm`}>
      <div className="flex items-center justify-between mb-4">
        <div className={`p-3 rounded-2xl ${colors[color]}`}>
          <Icon className="w-6 h-6" />
        </div>
      </div>
      <p className="text-slate-500 text-xs font-bold uppercase tracking-widest">{title}</p>
      <h4 className="text-2xl font-black text-slate-900 mt-1">{value}</h4>
    </div>
  );
}
