import React, { useState, useEffect } from 'react';
import { collection, onSnapshot, query, orderBy, where, limit, getDocs } from 'firebase/firestore';
import { db } from '../firebase';
import { Trophy, Star, TrendingUp, Filter, Download } from 'lucide-react';
import { motion } from 'motion/react';
import { formatPhoneNumber } from '../lib/utils';

interface LeadRankingProps {
  userRole?: 'admin' | 'agent' | null;
  userId?: string;
  orgId?: string | null;
}

export default function LeadRanking({ userRole, userId, orgId }: LeadRankingProps) {
  const [leads, setLeads] = useState<any[]>([]);

  useEffect(() => {
    if (!userRole || !userId || !orgId) return;

    const fetchLeads = async () => {
      let q = query(collection(db, 'organizations', orgId, 'leads'), orderBy('score', 'desc'), limit(50));
      
      if (userRole === 'agent') {
        q = query(
          collection(db, 'organizations', orgId, 'leads'),
          where('assignedTo', '==', userId),
          orderBy('score', 'desc'),
          limit(50)
        );
      }

      try {
        const snapshot = await getDocs(q);
        setLeads(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      } catch (error) {
        console.error("Error fetching ranking:", error);
      }
    };

    fetchLeads();
    const interval = setInterval(fetchLeads, 60000);
    return () => clearInterval(interval);
  }, [userRole, userId, orgId]);

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">Ranking de Leads</h2>
          <p className="text-slate-500">Identifique os leads com maior potencial de conversão.</p>
        </div>
        <div className="flex gap-3">
          <button className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 rounded-xl text-sm font-semibold text-slate-700 hover:bg-slate-50 transition-all">
            <Filter className="w-4 h-4" />
            Filtrar
          </button>
          <button className="flex items-center gap-2 px-4 py-2 bg-blue-600 rounded-xl text-sm font-semibold text-white hover:bg-blue-700 transition-all shadow-lg shadow-blue-100">
            <Download className="w-4 h-4" />
            Exportar Relatório
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {leads.slice(0, 3).map((lead, index) => (
          <motion.div 
            key={lead.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.1 }}
            className="bg-white p-8 rounded-3xl border border-slate-200 shadow-sm relative overflow-hidden"
          >
            <div className="absolute top-0 right-0 p-6">
              {index === 0 && <Trophy className="w-12 h-12 text-yellow-400 opacity-20" />}
              {index === 1 && <Trophy className="w-12 h-12 text-slate-400 opacity-20" />}
              {index === 2 && <Trophy className="w-12 h-12 text-orange-400 opacity-20" />}
            </div>
            
            <div className="relative z-10">
              <div className="flex items-center gap-4 mb-6">
                <div className={`w-14 h-14 rounded-2xl flex items-center justify-center text-xl font-bold shrink-0 overflow-hidden ${
                  index === 0 ? 'bg-yellow-50 text-yellow-600' : 
                  index === 1 ? 'bg-slate-50 text-slate-600' : 
                  'bg-orange-50 text-orange-600'
                }`}>
                  {lead.photoUrl ? (
                    <img src={lead.photoUrl} alt={lead.name} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                  ) : (
                    `#${index + 1}`
                  )}
                </div>
                <div>
                  <h4 className="font-bold text-slate-900 text-lg">
                    {lead.name === 'Cliente WhatsApp' && lead.phone?.length <= 15 
                      ? formatPhoneNumber(lead.phone) 
                      : lead.name || 'Cliente s/ Nome'}
                  </h4>
                  <p className="text-sm text-slate-500">
                    {lead.phone?.length > 15 ? (
                      <span className="text-blue-500">Mapeando...</span>
                    ) : (
                      lead.name === 'Cliente WhatsApp' ? 'WhatsApp' : formatPhoneNumber(lead.phone)
                    )}
                  </p>
                </div>
              </div>

              <div className="space-y-4">
                <div className="flex justify-between items-end">
                  <span className="text-sm text-slate-500">Lead Score</span>
                  <span className="text-3xl font-black text-slate-900">{lead.score}</span>
                </div>
                <div className="w-full bg-slate-100 h-3 rounded-full overflow-hidden">
                  <motion.div 
                    initial={{ width: 0 }}
                    animate={{ width: `${lead.score}%` }}
                    className={`h-full rounded-full ${
                      index === 0 ? 'bg-yellow-500' : 
                      index === 1 ? 'bg-slate-400' : 
                      'bg-orange-500'
                    }`}
                  />
                </div>
              </div>

              <div className="mt-6 pt-6 border-t border-slate-50 flex justify-between items-center">
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
                <span className="text-xs font-bold text-blue-600 uppercase tracking-widest">{lead.status}</span>
              </div>
            </div>
          </motion.div>
        ))}
      </div>

      <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-6 border-b border-slate-100">
          <h3 className="font-bold text-slate-900">Todos os Leads Qualificados</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-slate-50 text-slate-500 text-xs uppercase tracking-wider">
                <th className="px-6 py-4 font-semibold">Posição</th>
                <th className="px-6 py-4 font-semibold">Lead</th>
                <th className="px-6 py-4 font-semibold">Engajamento</th>
                <th className="px-6 py-4 font-semibold">Potencial</th>
                <th className="px-6 py-4 font-semibold">Status</th>
                <th className="px-6 py-4 font-semibold">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {leads.slice(3).map((lead, index) => (
                <tr key={lead.id} className="hover:bg-slate-50 transition-all">
                  <td className="px-6 py-4">
                    <span className="font-bold text-slate-400">#{index + 4}</span>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-slate-100 rounded-xl flex items-center justify-center text-slate-600 font-bold overflow-hidden border border-slate-200">
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
                        <p className="text-xs text-slate-500">
                          {lead.phone?.length > 15 ? (
                            <span className="text-blue-500">Mapeando...</span>
                          ) : (
                            lead.name === 'Cliente WhatsApp' ? 'WhatsApp' : formatPhoneNumber(lead.phone)
                          )}
                        </p>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2">
                      <TrendingUp className="w-4 h-4 text-green-500" />
                      <span className="text-sm font-medium text-slate-700">Alta</span>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-1">
                      {[1, 2, 3, 4, 5].map((star) => (
                        <Star 
                          key={star} 
                          className={`w-4 h-4 ${star <= Math.ceil(lead.score / 20) ? 'text-yellow-400 fill-current' : 'text-slate-200'}`} 
                        />
                      ))}
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <span className="text-xs font-bold text-slate-500 uppercase">{lead.status}</span>
                  </td>
                  <td className="px-6 py-4">
                    <button className="text-blue-600 text-sm font-bold hover:underline">Ver Detalhes</button>
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
