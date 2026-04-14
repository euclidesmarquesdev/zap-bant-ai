import React, { useState, useEffect, useRef } from 'react';
import { collection, onSnapshot, query, orderBy, addDoc, serverTimestamp, doc, getDoc, where, limit } from 'firebase/firestore';
import { db } from '../firebase';
import { Send, User, Bot, Phone, MoreVertical, Search, ShieldCheck, MessageSquare } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { formatPhoneNumber, cn } from '../lib/utils';

interface ChatProps {
  selectedLeadId: string | null;
  userRole?: 'admin' | 'agent' | null;
  userId?: string;
}

export default function Chat({ selectedLeadId, userRole, userId }: ChatProps) {
  const [leads, setLeads] = useState<any[]>([]);
  const [messages, setMessages] = useState<any[]>([]);
  const [activeLeadId, setActiveLeadId] = useState<string | null>(selectedLeadId);
  const [inputText, setInputText] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!userRole || !userId) return;

    let q = query(collection(db, 'leads'), orderBy('updatedAt', 'desc'), limit(50));
    
    if (userRole === 'agent' && userId) {
      q = query(
        collection(db, 'leads'), 
        where('assignedTo', '==', userId),
        orderBy('updatedAt', 'desc'),
        limit(50)
      );
    }

    const unsubscribe = onSnapshot(q, (snapshot) => {
      setLeads(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });
    return () => unsubscribe();
  }, [userRole, userId]);

  useEffect(() => {
    if (activeLeadId) {
      const q = query(
        collection(db, 'leads', activeLeadId, 'messages'), 
        orderBy('timestamp', 'desc'),
        limit(50)
      );
      const unsubscribe = onSnapshot(q, (snapshot) => {
        setMessages(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })).reverse());
      });
      return () => unsubscribe();
    }
  }, [activeLeadId]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const activeLead = leads.find(l => l.id === activeLeadId);

  const sendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim() || !activeLeadId) return;

    const text = inputText;
    setInputText('');

    // Save human message to firestore
    await addDoc(collection(db, 'leads', activeLeadId, 'messages'), {
      text,
      sender: 'human',
      timestamp: serverTimestamp()
    });

    // Send via WhatsApp
    await fetch('/api/whatsapp/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ to: activeLead.chatId || activeLeadId, message: text })
    });
  };

  return (
    <div className="h-full flex bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
      {/* Sidebar */}
      <div className="w-80 border-r border-slate-100 flex flex-col">
        <div className="p-6 border-b border-slate-100">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
            <input 
              type="text" 
              placeholder="Buscar conversa..." 
              className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-blue-500/20"
            />
          </div>
        </div>
        <div className="flex-1 overflow-y-auto">
          {leads.map((lead) => (
            <button
              key={lead.id}
              onClick={() => setActiveLeadId(lead.id)}
              className={cn(
                "w-full p-4 flex gap-3 border-b border-slate-50 hover:bg-slate-50 transition-all text-left",
                activeLeadId === lead.id && "bg-blue-50/50 border-l-4 border-l-blue-600"
              )}
            >
              <div className="w-12 h-12 bg-slate-100 rounded-full flex items-center justify-center text-slate-600 font-bold shrink-0 overflow-hidden border border-slate-200">
                {lead.photoUrl ? (
                  <img src={lead.photoUrl} alt={lead.name} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                ) : (
                  lead.name ? lead.name[0] : '?'
                )}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex justify-between items-start">
                  <p className="font-bold text-slate-900 truncate">
                    {lead.name === 'Cliente WhatsApp' && lead.phone?.length <= 15 
                      ? formatPhoneNumber(lead.phone) 
                      : lead.name}
                  </p>
                  <span className="text-[10px] text-slate-400">
                    {lead.updatedAt ? format(lead.updatedAt.toDate(), "HH:mm") : ''}
                  </span>
                </div>
                <p className="text-[10px] text-slate-400 font-mono mt-0.5">
                  {lead.phone?.length > 15 ? (
                    <span className="text-blue-500">Mapeando Telefone...</span>
                  ) : (
                    lead.name === 'Cliente WhatsApp' ? 'WhatsApp' : formatPhoneNumber(lead.phone)
                  )}
                </p>
                <p className="text-xs text-slate-500 truncate mt-1">{lead.lastMessage}</p>
                <div className="flex items-center gap-2 mt-2">
                  <span className={`w-2 h-2 rounded-full ${lead.status === 'humano' ? 'bg-orange-500 animate-pulse' : 'bg-green-500'}`}></span>
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{lead.status}</span>
                </div>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Chat Area */}
      <div className="flex-1 flex flex-col bg-slate-50/30">
        {activeLead ? (
          <>
            <div className="p-6 bg-white border-b border-slate-100 flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-blue-600 rounded-full flex items-center justify-center text-white font-bold overflow-hidden border border-slate-200">
                  {activeLead.photoUrl ? (
                    <img src={activeLead.photoUrl} alt={activeLead.name} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                  ) : (
                    activeLead.name ? activeLead.name[0] : '?'
                  )}
                </div>
                <div>
                  <h4 className="font-bold text-slate-900">
                    {activeLead.name === 'Cliente WhatsApp' && activeLead.phone?.length <= 15 
                      ? formatPhoneNumber(activeLead.phone) 
                      : activeLead.name}
                  </h4>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-slate-500">
                      {activeLead.phone?.length > 15 ? (
                        <span className="text-blue-500">Mapeando Telefone...</span>
                      ) : (
                        activeLead.name === 'Cliente WhatsApp' ? 'WhatsApp' : formatPhoneNumber(activeLead.phone)
                      )}
                    </span>
                    <span className="w-1 h-1 bg-slate-300 rounded-full"></span>
                    <span className="text-xs font-bold text-blue-600 uppercase tracking-wider">Score: {activeLead.score}</span>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <button className="p-2 text-slate-400 hover:text-slate-600 transition-all">
                  <Phone className="w-5 h-5" />
                </button>
                <button className="p-2 text-slate-400 hover:text-slate-600 transition-all">
                  <ShieldCheck className="w-5 h-5" />
                </button>
                <button className="p-2 text-slate-400 hover:text-slate-600 transition-all">
                  <MoreVertical className="w-5 h-5" />
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-4 flex flex-col">
              {messages.map((msg) => (
                <div 
                  key={msg.id} 
                  className={cn(
                    "flex flex-col max-w-[80%] md:max-w-[70%]",
                    msg.sender === 'lead' ? "self-start" : "self-end items-end"
                  )}
                >
                  <div className={cn(
                    "p-4 rounded-2xl text-sm shadow-sm transition-all",
                    msg.sender === 'lead' 
                      ? "bg-white text-slate-800 rounded-tl-none border border-slate-100" 
                      : msg.sender === 'ai'
                        ? "bg-blue-600 text-white rounded-tr-none"
                        : "bg-slate-800 text-white rounded-tr-none"
                  )}>
                    {msg.text}
                  </div>
                  <div className={cn(
                    "flex items-center gap-1 mt-1 px-1",
                    msg.sender === 'lead' ? "flex-row" : "flex-row-reverse"
                  )}>
                    {msg.sender === 'ai' && <Bot className="w-3 h-3 text-blue-500" />}
                    {msg.sender === 'human' && <User className="w-3 h-3 text-slate-500" />}
                    <span className="text-[10px] text-slate-400">
                      {msg.timestamp ? format(msg.timestamp.toDate(), "HH:mm") : ''}
                    </span>
                  </div>
                </div>
              ))}
              <div ref={messagesEndRef} />
            </div>

            <form onSubmit={sendMessage} className="p-6 bg-white border-t border-slate-100">
              <div className="flex gap-4">
                <input 
                  type="text" 
                  value={inputText}
                  onChange={(e) => setInputText(e.target.value)}
                  placeholder="Digite sua mensagem..." 
                  className="flex-1 px-6 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 transition-all"
                />
                <button 
                  type="submit"
                  className="bg-blue-600 text-white p-3 rounded-2xl hover:bg-blue-700 transition-all shadow-lg shadow-blue-100"
                >
                  <Send className="w-6 h-6" />
                </button>
              </div>
            </form>
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-slate-400">
            <MessageSquare className="w-16 h-16 mb-4 opacity-20" />
            <p>Selecione uma conversa para começar</p>
          </div>
        )}
      </div>
    </div>
  );
}
