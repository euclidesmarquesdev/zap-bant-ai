import React, { useState, useEffect, useMemo } from 'react';
import { collection, onSnapshot, query, orderBy, limit, updateDoc, doc, deleteDoc, getDocs, writeBatch, serverTimestamp, addDoc, where, Timestamp } from 'firebase/firestore';
import { db } from '../firebase';
import { Users, MessageSquare, TrendingUp, AlertCircle, ArrowUpRight, ArrowDownRight, RotateCcw, Play, CheckCircle2, UserCog, Trash2, Calendar, Copy } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { format, subHours, subDays, subWeeks, subMonths, startOfDay } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { formatPhoneNumber } from '../lib/utils';
import { toast } from 'sonner';
import { assignLeadToAgent } from '../services/assignmentService';

interface DashboardProps {
  onSelectLead: (id: string) => void;
  userPhone?: string;
  userRole?: 'admin' | 'agent' | null;
  userId?: string;
}

type Period = 'hoje' | '48h' | 'semana' | 'mes';

export default function Dashboard({ onSelectLead, userPhone, userRole, userId }: DashboardProps) {
  const [leads, setLeads] = useState<any[]>([]);
  const [agents, setAgents] = useState<any[]>([]);
  const [period, setPeriod] = useState<Period>('semana');

  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  const handleQuickAction = async (e: React.MouseEvent, leadId: string, newStatus: string) => {
    e.preventDefault();
    e.stopPropagation();
    
    if (newStatus === 'delete') {
      setDeleteConfirmId(leadId);
      return;
    }

    try {
      const leadData = leads.find(l => l.id === leadId);
      const leadRef = doc(db, 'leads', leadId);

      const updateData: any = { 
        status: newStatus,
        updatedAt: serverTimestamp()
      };

      if (newStatus === 'novo') {
        updateData.score = 0;
        updateData.bant = { budget: false, authority: false, need: false, timeline: false };
        updateData.lastMessage = "Atendimento resetado pelo administrador";
        updateData.product = null;
      }

      // Se estiver retomando o atendimento, envia mensagem automática
      if (newStatus === 'atendido') {
        const resumeMessage = "Olá! Estou retomando seu atendimento agora. Como posso te ajudar?";
        
        console.log('RETOMANDO ATENDIMENTO PARA:', leadId);

        // Salva mensagem no Firestore
        await addDoc(collection(db, 'leads', leadId, 'messages'), {
          text: resumeMessage,
          sender: 'ai',
          timestamp: serverTimestamp()
        });

        // Envia via WhatsApp
        const targetTo = leadData?.chatId || leadId;
        try {
          const response = await fetch('/api/whatsapp/send', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ to: targetTo, message: resumeMessage })
          });
          const resData = await response.json();
          if (!resData.success) {
            console.error('Failed to send WhatsApp message:', resData.error);
            toast.error('Erro ao enviar mensagem de retomada via WhatsApp');
          } else {
            console.log('WhatsApp message sent successfully');
          }
        } catch (err) {
          console.error('Fetch error sending WhatsApp message:', err);
        }
        
        updateData.lastMessage = resumeMessage;
      }

      // Se estiver encaminhando para humano, envia mensagem automática
      if (newStatus === 'humano') {
        const humanMessage = "Aguarde um momento. Estou encaminhando seu atendimento para um especialista humano que continuará a conversa com você em breve. 👨‍💻";
        
        console.log('ENCAMINHANDO PARA HUMANO:', leadId);

        // Salva mensagem no Firestore
        await addDoc(collection(db, 'leads', leadId, 'messages'), {
          text: humanMessage,
          sender: 'ai',
          timestamp: serverTimestamp()
        });

        // Envia via WhatsApp
        const targetTo = leadData?.chatId || leadId;
        try {
          await fetch('/api/whatsapp/send', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ to: targetTo, message: humanMessage })
          });

          // Notifica o administrador no próprio WhatsApp
          if (userPhone) {
            const adminNotifyMessage = `🚨 ATENÇÃO: O lead ${leadData?.name || formatPhoneNumber(leadData?.phone || leadId)} solicitou atendimento humano. Verifique o painel!`;
            await fetch('/api/whatsapp/send', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ to: `${userPhone}@s.whatsapp.net`, message: adminNotifyMessage })
            });
          }
        } catch (err) {
          console.error('Error sending human notification:', err);
        }
        
        updateData.lastMessage = humanMessage;

        // DISTRIBUIÇÃO AUTOMÁTICA DE ATENDENTES
        const assignedAgent = await assignLeadToAgent(leadId, {
          ...leadData,
          ...updateData
        });

        if (assignedAgent) {
          toast.info(`Lead encaminhado para ${assignedAgent.displayName || assignedAgent.name}`);
        }
      }

      await updateDoc(leadRef, updateData);
      toast.info(`Status atualizado para: ${newStatus}`);
    } catch (error) {
      console.error('Error updating status:', error);
      toast.error('Erro ao atualizar status');
    }
  };

  const confirmDelete = async (leadId: string) => {
    try {
      const batch = writeBatch(db);
      const messagesRef = collection(db, 'leads', leadId, 'messages');
      const messagesSnap = await getDocs(messagesRef);
      messagesSnap.forEach((msgDoc) => {
        batch.delete(msgDoc.ref);
      });
      batch.delete(doc(db, 'leads', leadId));
      await batch.commit();
      toast.success('Lead e mensagens excluídos com sucesso');
      setDeleteConfirmId(null);
    } catch (error) {
      console.error('Error deleting lead:', error);
      toast.error('Erro ao excluir lead');
    }
  };

  useEffect(() => {
    if (!userRole || !userId) return;

    let startDate: Date;
    const now = new Date();

    switch (period) {
      case 'hoje':
        startDate = startOfDay(now);
        break;
      case '48h':
        startDate = subHours(now, 48);
        break;
      case 'semana':
        startDate = subWeeks(now, 1);
        break;
      case 'mes':
        startDate = subMonths(now, 1);
        break;
      default:
        startDate = subWeeks(now, 1);
    }

    let q = query(
      collection(db, 'leads'), 
      where('updatedAt', '>=', Timestamp.fromDate(startDate)),
      orderBy('updatedAt', 'desc'),
      limit(50)
    );

    // If agent, only show assigned leads
    if (userRole === 'agent' && userId) {
      q = query(
        collection(db, 'leads'),
        where('assignedTo', '==', userId),
        where('updatedAt', '>=', Timestamp.fromDate(startDate)),
        orderBy('updatedAt', 'desc'),
        limit(50)
      );
    }

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const leadsData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setLeads(leadsData);
    });

    return () => unsubscribe();
  }, [period, userRole, userId]);

  const stats = useMemo(() => {
    const total = leads.length;
    const waiting = leads.filter((l: any) => l.status === 'humano').length;
    const closed = leads.filter((l: any) => l.status === 'fechamento' || l.status === 'pagamento').length;
    const active = leads.filter((l: any) => 
      l.status !== 'novo' && 
      l.status !== 'fechamento' && 
      l.status !== 'pagamento'
    ).length;

    return {
      totalLeads: total,
      activeChats: active,
      closedChats: closed,
      waitingHuman: waiting
    };
  }, [leads]);

  useEffect(() => {
    if (userRole === 'admin') {
      const unsubscribe = onSnapshot(collection(db, 'users'), (snap) => {
        setAgents(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      });
      return () => unsubscribe();
    }
  }, [userRole]);

  return (
    <div className="space-y-8">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">Visão Geral</h2>
          <p className="text-slate-500">Acompanhe o desempenho dos seus agentes e leads em tempo real.</p>
        </div>

        <div className="flex items-center gap-2 bg-white p-1 rounded-xl border border-slate-200 shadow-sm">
          {(['hoje', '48h', 'semana', 'mes'] as Period[]).map((p) => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              className={`px-4 py-2 rounded-lg text-xs font-bold transition-all ${
                period === p 
                  ? 'bg-blue-600 text-white shadow-md shadow-blue-100' 
                  : 'text-slate-500 hover:bg-slate-50'
              }`}
            >
              {p === '48h' ? '48 Horas' : p.charAt(0).toUpperCase() + p.slice(1)}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {userRole === 'admin' && (
          <div className="md:col-span-2 lg:col-span-4 bg-blue-600 rounded-3xl p-6 text-white shadow-xl shadow-blue-200 flex flex-col md:flex-row items-center justify-between gap-6 overflow-hidden relative group">
            <div className="absolute top-0 right-0 -mr-16 -mt-16 w-64 h-64 bg-white/10 rounded-full blur-3xl group-hover:bg-white/20 transition-all duration-500"></div>
            <div className="relative z-10">
              <h2 className="text-xl font-bold mb-1">Central de Atendimento Ativa</h2>
              <p className="text-blue-100 text-sm">Compartilhe o link abaixo com sua equipe para que eles possam logar e atender os leads.</p>
            </div>
            <div className="relative z-10 flex items-center gap-3 bg-white/10 backdrop-blur-md p-2 pl-4 rounded-2xl border border-white/20 w-full md:w-auto">
              <code className="text-sm font-mono font-bold truncate max-w-[200px] md:max-w-none">{window.location.origin}</code>
              <button 
                onClick={() => {
                  navigator.clipboard.writeText(window.location.origin);
                  toast.success('Link copiado!');
                }}
                className="p-2 bg-white text-blue-600 rounded-xl hover:bg-blue-50 transition-all shadow-lg"
              >
                <Copy className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
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
          trend="-5%" 
          trendUp={false} 
          color="purple"
        />
        <KPICard 
          title="Atendimentos Encerrados" 
          value={stats.closedChats} 
          icon={CheckCircle2} 
          trend="+18%" 
          trendUp={true} 
          color="green"
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
                {userRole === 'admin' && <th className="px-6 py-4 font-semibold">Atendente</th>}
                <th className="px-6 py-4 font-semibold">Score</th>
                <th className="px-6 py-4 font-semibold">BANT</th>
                <th className="px-6 py-4 font-semibold">Última Atividade</th>
                <th className="px-6 py-4 font-semibold">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {leads.map((lead) => {
                const assignedAgent = agents.find(a => a.id === lead.assignedTo);
                return (
                  <tr key={lead.id} className="hover:bg-slate-50 transition-all cursor-pointer" onClick={() => onSelectLead(lead.id)}>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-slate-100 rounded-full flex items-center justify-center text-slate-600 font-bold overflow-hidden border border-slate-200">
                          {lead.photoUrl ? (
                            <img src={lead.photoUrl} alt={lead.name} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                          ) : (
                            lead.name ? lead.name[0] : '?'
                          )}
                        </div>
                        <div>
                          <p className="font-semibold text-slate-900">
                            {lead.name === 'Cliente WhatsApp' && lead.phone?.length <= 15 
                              ? formatPhoneNumber(lead.phone) 
                              : lead.name || 'Cliente s/ Nome'}
                          </p>
                          <p className="text-xs text-slate-500 font-mono tracking-wider">
                            {lead.phone?.length > 15 ? (
                              <span className="text-blue-500 flex items-center gap-1">
                                <RotateCcw className="w-3 h-3 animate-spin" />
                                Mapeando Telefone...
                              </span>
                            ) : (
                              lead.name === 'Cliente WhatsApp' ? 'WhatsApp' : formatPhoneNumber(lead.phone || lead.id)
                            )}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <StatusBadge status={lead.status} />
                    </td>
                    {userRole === 'admin' && (
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          {assignedAgent ? (
                            <div className="flex items-center gap-2">
                              <div className="w-6 h-6 bg-blue-100 rounded-full flex items-center justify-center text-[10px] font-bold text-blue-600">
                                {assignedAgent.displayName?.[0] || assignedAgent.email?.[0]}
                              </div>
                              <span className="text-xs font-medium text-slate-700">{assignedAgent.displayName || assignedAgent.email}</span>
                            </div>
                          ) : (
                            <span className="text-xs text-slate-400 italic">Não atribuído</span>
                          )}
                        </div>
                      </td>
                    )}
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
                    <div className="flex items-center gap-2">
                      <button 
                        onClick={(e) => handleQuickAction(e, lead.id, 'novo')}
                        className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-all"
                        title="Resetar Status"
                      >
                        <RotateCcw className="w-4 h-4" />
                      </button>
                      <button 
                        onClick={(e) => handleQuickAction(e, lead.id, 'atendido')}
                        className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-all"
                        title="Retomar Atendimento"
                      >
                        <Play className="w-4 h-4" />
                      </button>
                      <button 
                        onClick={(e) => handleQuickAction(e, lead.id, 'fechamento')}
                        className="p-2 text-slate-400 hover:text-green-600 hover:bg-green-50 rounded-lg transition-all"
                        title="Encerrar/Fechamento"
                      >
                        <CheckCircle2 className="w-4 h-4" />
                      </button>
                      <button 
                        onClick={(e) => handleQuickAction(e, lead.id, 'humano')}
                        className="p-2 text-slate-400 hover:text-orange-600 hover:bg-orange-50 rounded-lg transition-all"
                        title="Encaminhar Humano"
                      >
                        <UserCog className="w-4 h-4" />
                      </button>
                      <button 
                        onClick={(e) => handleQuickAction(e, lead.id, 'delete')}
                        className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all"
                        title="Apagar Tudo"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
          </table>
        </div>
      </div>

      {/* Modal de Confirmação de Exclusão */}
      <AnimatePresence>
        {deleteConfirmId && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-2xl p-8 max-w-md w-full shadow-2xl border border-slate-200"
            >
              <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mb-6 mx-auto">
                <Trash2 className="text-red-600 w-8 h-8" />
              </div>
              <h3 className="text-xl font-bold text-slate-900 text-center mb-2">Excluir Lead Permanentemente?</h3>
              <p className="text-slate-500 text-center mb-8">
                Esta ação não pode ser desfeita. Todas as mensagens e dados deste lead serão apagados do banco de dados.
              </p>
              <div className="flex gap-4">
                <button 
                  onClick={() => confirmDelete(deleteConfirmId)}
                  className="flex-1 px-6 py-3 bg-red-600 text-white font-bold rounded-xl hover:bg-red-700 transition-all"
                >
                  Sim, Excluir
                </button>
                <button 
                  onClick={() => setDeleteConfirmId(null)}
                  className="flex-1 px-6 py-3 bg-slate-100 text-slate-600 font-bold rounded-xl hover:bg-slate-200 transition-all"
                >
                  Cancelar
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
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
