import React, { useState, useEffect, useMemo } from 'react';
import { collection, onSnapshot, query, orderBy, doc, updateDoc, serverTimestamp, addDoc, where, limit, getDocs } from 'firebase/firestore';
import { db } from '../firebase';
import { StatusBadge } from './Dashboard';
import { motion } from 'motion/react';
import { MoreVertical, Phone, Star } from 'lucide-react';
import { formatPhoneNumber } from '../lib/utils';
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';
import { toast } from 'sonner';
import { assignLeadToAgent } from '../services/assignmentService';

const COLUMNS = [
  { id: 'novo', title: 'Novo Atendimento' },
  { id: 'atendido', title: 'Sendo Atendido' },
  { id: 'negociacao', title: 'Em Negociação' },
  { id: 'fechamento', title: 'Fechamento' },
  { id: 'pagamento', title: 'Encaminhado (Pagto)' },
  { id: 'humano', title: 'Aguardando Humano' },
];

interface KanbanProps {
  userPhone?: string;
  userRole?: 'admin' | 'agent' | null;
  userId?: string;
  orgId?: string | null;
}

export default function Kanban({ userPhone, userRole, userId, orgId }: KanbanProps) {
  const [leads, setLeads] = useState<any[]>([]);

  useEffect(() => {
    if (!userRole || !userId || !orgId) return;

    const fetchLeads = async () => {
      let q = query(
        collection(db, 'organizations', orgId, 'leads'),
        orderBy('updatedAt', 'desc'),
        limit(100)
      );
      
      if (userRole === 'agent') {
        q = query(
          collection(db, 'organizations', orgId, 'leads'),
          where('assignedTo', '==', userId),
          orderBy('updatedAt', 'desc'),
          limit(100)
        );
      }

      try {
        const snapshot = await getDocs(q);
        setLeads(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      } catch (error) {
        console.error('Error fetching leads for Kanban:', error);
      }
    };

    fetchLeads();
    const interval = setInterval(fetchLeads, 45000);
    return () => clearInterval(interval);
  }, [userRole, userId, orgId]);

  const leadsByStatus = useMemo(() => {
    const map: Record<string, any[]> = {};
    COLUMNS.forEach(col => map[col.id] = []);
    leads.forEach(lead => {
      if (map[lead.status]) map[lead.status].push(lead);
    });
    return map;
  }, [leads]);

  const onDragEnd = async (result: any) => {
    const { destination, source, draggableId } = result;
    if (!destination || !orgId) return;
    if (destination.droppableId === source.droppableId && destination.index === source.index) return;

    const newStatus = destination.droppableId;

    try {
      const leadData = leads.find(l => l.id === draggableId);
      const leadRef = doc(db, 'organizations', orgId, 'leads', draggableId);

      const updateData: any = {
        status: newStatus,
        updatedAt: serverTimestamp()
      };

      if (newStatus === 'atendido') {
        const resumeMessage = "Olá! Estou retomando seu atendimento agora.";
        await addDoc(collection(db, 'organizations', orgId, 'leads', draggableId, 'messages'), {
          text: resumeMessage, sender: 'ai', timestamp: serverTimestamp(), orgId
        });
        await fetch('/api/whatsapp/send', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ orgId, to: draggableId, message: resumeMessage })
        });
        updateData.lastMessage = resumeMessage;
      }

      if (newStatus === 'humano') {
        const humanMessage = "Aguarde um momento. Estou encaminhando seu atendimento para um especialista humano.";
        await addDoc(collection(db, 'organizations', orgId, 'leads', draggableId, 'messages'), {
          text: humanMessage, sender: 'ai', timestamp: serverTimestamp(), orgId
        });
        await fetch('/api/whatsapp/send', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ orgId, to: draggableId, message: humanMessage })
        });
        updateData.lastMessage = humanMessage;
      }

      await updateDoc(leadRef, updateData);
      toast.success(`Lead movido para ${COLUMNS.find(c => c.id === newStatus)?.title}`);
    } catch (error) {
      console.error('Error updating lead status:', error);
    }
  };

  return (
    <div className="h-full flex flex-col gap-6">
      <div>
        <h2 className="text-2xl font-bold text-slate-900">BANT Kanban</h2>
        <p className="text-slate-500">Acompanhe a jornada dos seus leads através do funil BANT.</p>
      </div>

      <DragDropContext onDragEnd={onDragEnd}>
        <div className="flex-1 flex gap-6 overflow-x-auto pb-6 min-h-0">
          {COLUMNS.map((column) => (
            <div key={column.id} className="flex-shrink-0 w-80 flex flex-col gap-4 h-full">
              <div className="flex items-center justify-between px-2 shrink-0">
                <div className="flex items-center gap-2">
                  <h3 className="font-bold text-slate-700">{column.title}</h3>
                  <span className="bg-slate-200 text-slate-600 text-xs px-2 py-0.5 rounded-full font-bold">
                    {leadsByStatus[column.id]?.length || 0}
                  </span>
                </div>
              </div>

              <Droppable droppableId={column.id}>
                {(provided, snapshot) => (
                  <div 
                    {...provided.droppableProps}
                    ref={provided.innerRef}
                    className={`flex-1 rounded-2xl p-3 space-y-3 min-h-[500px] overflow-y-auto transition-colors ${
                      snapshot.isDraggingOver ? 'bg-blue-50/50 ring-2 ring-blue-200 ring-inset' : 'bg-slate-100/50'
                    }`}
                  >
                    {leadsByStatus[column.id]?.map((lead, index) => {
                        const DraggableAny = Draggable as any;
                        return (
                          <DraggableAny key={lead.id} draggableId={lead.id} index={index}>
                            {(provided: any, snapshot: any) => (
                              <div
                                ref={provided.innerRef}
                                {...provided.draggableProps}
                                {...provided.dragHandleProps}
                                className={snapshot.isDragging ? 'z-50' : ''}
                              >
                                <KanbanCard lead={lead} isDragging={snapshot.isDragging} />
                              </div>
                            )}
                          </DraggableAny>
                        );
                      })}
                    {provided.placeholder}
                  </div>
                )}
              </Droppable>
            </div>
          ))}
        </div>
      </DragDropContext>
    </div>
  );
}

function KanbanCard({ lead, isDragging }: { lead: any, isDragging?: boolean }) {
  return (
    <div 
      className={`bg-white p-4 rounded-xl shadow-sm border transition-all cursor-grab active:cursor-grabbing ${
        isDragging ? 'border-blue-500 shadow-lg scale-105 ring-4 ring-blue-500/10' : 'border-slate-200 hover:border-blue-300'
      }`}
    >
      <div className="flex justify-between items-start mb-3">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-blue-50 text-blue-600 rounded-lg flex items-center justify-center text-xs font-bold overflow-hidden border border-slate-100">
            {lead.photoUrl ? (
              <img src={lead.photoUrl} alt={lead.name} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
            ) : (
              lead.name ? lead.name[0] : '?'
            )}
          </div>
          <div>
            <p className="text-sm font-bold text-slate-900 truncate max-w-[140px]">
              {lead.name === 'Cliente WhatsApp' && lead.phone?.length <= 15 
                ? formatPhoneNumber(lead.phone) 
                : lead.name}
            </p>
            <div className="flex items-center gap-1 text-[10px] text-slate-400">
              <Phone className="w-3 h-3" />
              {lead.phone?.length > 15 ? (
                <span className="text-blue-500">Mapeando...</span>
              ) : (
                lead.name === 'Cliente WhatsApp' ? 'WhatsApp' : formatPhoneNumber(lead.phone || lead.id)
              )}
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
    </div>
  );
}
