import React, { useState, useEffect } from 'react';
import { collection, onSnapshot, query, orderBy } from 'firebase/firestore';
import { db } from '../firebase';
import { StatusBadge } from './Dashboard';
import { motion } from 'motion/react';
import { MoreVertical, Phone, Star } from 'lucide-react';

const COLUMNS = [
  { id: 'novo', title: 'Novo Atendimento' },
  { id: 'atendido', title: 'Sendo Atendido' },
  { id: 'negociacao', title: 'Em Negociação' },
  { id: 'fechamento', title: 'Fechamento' },
  { id: 'pagamento', title: 'Encaminhado (Pagto)' },
  { id: 'humano', title: 'Aguardando Humano' },
];

export default function Kanban() {
  const [leads, setLeads] = useState<any[]>([]);

  useEffect(() => {
    const unsubscribe = onSnapshot(collection(db, 'leads'), (snapshot) => {
      setLeads(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });
    return () => unsubscribe();
  }, []);

  return (
    <div className="h-full flex flex-col gap-6">
      <div>
        <h2 className="text-2xl font-bold text-slate-900">BANT Kanban</h2>
        <p className="text-slate-500">Acompanhe a jornada dos seus leads através do funil BANT.</p>
      </div>

      <div className="flex-1 flex gap-6 overflow-x-auto pb-6">
        {COLUMNS.map((column) => (
          <div key={column.id} className="flex-shrink-0 w-80 flex flex-col gap-4">
            <div className="flex items-center justify-between px-2">
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-slate-700">{column.title}</h3>
                <span className="bg-slate-200 text-slate-600 text-xs px-2 py-0.5 rounded-full font-bold">
                  {leads.filter(l => l.status === column.id).length}
                </span>
              </div>
              <button className="text-slate-400 hover:text-slate-600">
                <MoreVertical className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 bg-slate-100/50 rounded-2xl p-3 space-y-3 min-h-[500px]">
              {leads
                .filter(l => l.status === column.id)
                .map((lead) => (
                  <div key={lead.id}>
                    <KanbanCard lead={lead} />
                  </div>
                ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function KanbanCard({ lead }: { lead: any }) {
  return (
    <motion.div 
      layoutId={lead.id}
      className="bg-white p-4 rounded-xl shadow-sm border border-slate-200 hover:border-blue-300 transition-all cursor-grab active:cursor-grabbing"
    >
      <div className="flex justify-between items-start mb-3">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-blue-50 text-blue-600 rounded-lg flex items-center justify-center text-xs font-bold">
            {lead.name[0]}
          </div>
          <div>
            <p className="text-sm font-bold text-slate-900 truncate max-w-[140px]">{lead.name}</p>
            <div className="flex items-center gap-1 text-[10px] text-slate-400">
              <Phone className="w-3 h-3" />
              {lead.phone}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-1 bg-yellow-50 text-yellow-600 px-1.5 py-0.5 rounded text-[10px] font-bold">
          <Star className="w-3 h-3 fill-current" />
          {lead.score}
        </div>
      </div>

      <p className="text-xs text-slate-600 line-clamp-2 mb-4 italic">
        "{lead.lastMessage}"
      </p>

      <div className="flex items-center justify-between">
        <div className="flex gap-1">
          {['B', 'A', 'N', 'T'].map((letter, i) => {
            const key = ['budget', 'authority', 'need', 'timeline'][i];
            const active = lead.bant?.[key];
            return (
              <span 
                key={letter}
                className={`w-5 h-5 rounded flex items-center justify-center text-[8px] font-bold ${active ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-400'}`}
              >
                {letter}
              </span>
            );
          })}
        </div>
        <div className="w-16 h-1 bg-slate-100 rounded-full overflow-hidden">
          <div 
            className="h-full bg-blue-500"
            style={{ width: `${lead.score}%` }}
          ></div>
        </div>
      </div>
    </motion.div>
  );
}
