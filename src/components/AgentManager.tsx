import React, { useState, useEffect } from 'react';
import { collection, onSnapshot, addDoc, updateDoc, doc, deleteDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { Bot, Plus, Edit2, Trash2, CheckCircle2, XCircle, Settings2 } from 'lucide-react';
import { motion } from 'motion/react';

export default function AgentManager() {
  const [agents, setAgents] = useState<any[]>([]);
  const [isAdding, setIsAdding] = useState(false);

  useEffect(() => {
    const unsubscribe = onSnapshot(collection(db, 'agents'), (snapshot) => {
      setAgents(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });
    // For demo, if empty, add default
    return () => unsubscribe();
  }, []);

  // Mock agents if none in firestore
  const mockAgents = [
    { id: '1', name: 'Agente BANT Vendas', description: 'Focado em qualificação e fechamento de vendas usando metodologia IBM.', isActive: true },
    { id: '2', name: 'Agente Suporte Técnico', description: 'Especialista em resolver problemas técnicos e dúvidas sobre o produto.', isActive: false },
  ];

  const displayAgents = agents.length > 0 ? agents : mockAgents;

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">Gerenciar Agentes</h2>
          <p className="text-slate-500">Configure e alterne entre diferentes modelos de IA.</p>
        </div>
        <button 
          onClick={() => setIsAdding(true)}
          className="flex items-center gap-2 px-6 py-3 bg-blue-600 rounded-xl text-sm font-bold text-white hover:bg-blue-700 transition-all shadow-lg shadow-blue-100"
        >
          <Plus className="w-5 h-5" />
          Novo Agente
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {displayAgents.map((agent) => (
          <motion.div 
            key={agent.id}
            whileHover={{ y: -4 }}
            className={`bg-white p-8 rounded-3xl border ${agent.isActive ? 'border-blue-500 ring-4 ring-blue-50' : 'border-slate-200'} shadow-sm`}
          >
            <div className="flex justify-between items-start mb-6">
              <div className={`p-4 rounded-2xl ${agent.isActive ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-400'}`}>
                <Bot className="w-8 h-8" />
              </div>
              <div className="flex gap-2">
                <button className="p-2 text-slate-400 hover:text-blue-600 transition-all">
                  <Edit2 className="w-5 h-5" />
                </button>
                <button className="p-2 text-slate-400 hover:text-red-500 transition-all">
                  <Trash2 className="w-5 h-5" />
                </button>
              </div>
            </div>

            <h3 className="text-xl font-bold text-slate-900 mb-2">{agent.name}</h3>
            <p className="text-slate-500 text-sm mb-8 leading-relaxed">{agent.description}</p>

            <div className="flex items-center justify-between pt-6 border-t border-slate-50">
              <div className="flex items-center gap-2">
                {agent.isActive ? (
                  <>
                    <CheckCircle2 className="w-5 h-5 text-green-500" />
                    <span className="text-sm font-bold text-green-600">Ativo no WhatsApp</span>
                  </>
                ) : (
                  <>
                    <XCircle className="w-5 h-5 text-slate-300" />
                    <span className="text-sm font-bold text-slate-400">Inativo</span>
                  </>
                )}
              </div>
              <button className={`px-6 py-2 rounded-xl text-xs font-bold transition-all ${
                agent.isActive 
                  ? 'bg-slate-100 text-slate-600 hover:bg-slate-200' 
                  : 'bg-blue-600 text-white hover:bg-blue-700 shadow-md shadow-blue-100'
              }`}>
                {agent.isActive ? 'Desativar' : 'Ativar Agora'}
              </button>
            </div>
          </motion.div>
        ))}
      </div>

      <div className="bg-slate-900 p-8 rounded-3xl text-white flex items-center justify-between overflow-hidden relative">
        <div className="relative z-10">
          <h4 className="text-2xl font-bold mb-2">Treinamento Avançado</h4>
          <p className="text-slate-400 max-w-md">Personalize o comportamento psicológico e as regras de negócio editando os arquivos AGENT.md e SHOP.md.</p>
          <button className="mt-6 flex items-center gap-2 px-6 py-3 bg-white/10 hover:bg-white/20 rounded-xl text-sm font-bold transition-all backdrop-blur-sm">
            <Settings2 className="w-5 h-5" />
            Abrir Editor de Regras
          </button>
        </div>
        <Bot className="w-64 h-64 text-white/5 absolute -right-12 -bottom-12" />
      </div>
    </div>
  );
}
