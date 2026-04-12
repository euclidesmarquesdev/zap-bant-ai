import React, { useState, useEffect } from 'react';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { Bot, Save, Loader2, Settings2, Store, MessageSquare, ShieldCheck, Sparkles } from 'lucide-react';
import { motion } from 'motion/react';
import { toast } from 'sonner';

export default function AgentManager() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [activeEditor, setActiveEditor] = useState<'agent' | 'shop'>('agent');
  const [config, setConfig] = useState({
    agentMd: '',
    shopMd: ''
  });

  useEffect(() => {
    async function loadConfig() {
      try {
        const configRef = doc(db, 'settings', 'training');
        const configSnap = await getDoc(configRef);
        if (configSnap.exists()) {
          setConfig(configSnap.data() as any);
        }
      } catch (error) {
        console.error('Erro ao carregar configurações:', error);
      } finally {
        setLoading(false);
      }
    }
    loadConfig();
  }, []);

  const handleSave = async () => {
    setSaving(true);
    try {
      await setDoc(doc(db, 'settings', 'training'), config);
      toast.success('Configurações do agente salvas com sucesso!');
    } catch (error) {
      console.error('Erro ao salvar:', error);
      toast.error('Erro ao salvar configurações.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto space-y-8 pb-12">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold text-slate-900">Personalização do Agente</h2>
          <p className="text-slate-500">Ajuste o comportamento psicológico e as regras de negócio da sua IA.</p>
        </div>
        <button 
          onClick={handleSave}
          disabled={saving}
          className="flex items-center gap-2 px-8 py-3 bg-blue-600 text-white font-bold rounded-2xl hover:bg-blue-700 transition-all shadow-lg shadow-blue-100 disabled:opacity-50"
        >
          {saving ? <Loader2 className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />}
          {saving ? 'Salvando...' : 'Salvar Alterações'}
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Sidebar de Navegação do Editor */}
        <div className="lg:col-span-3 space-y-4">
          <button 
            onClick={() => setActiveEditor('agent')}
            className={`w-full flex items-center gap-3 p-4 rounded-2xl transition-all ${
              activeEditor === 'agent' 
                ? 'bg-blue-600 text-white shadow-lg shadow-blue-100' 
                : 'bg-white text-slate-600 hover:bg-slate-50 border border-slate-200'
            }`}
          >
            <Bot className="w-5 h-5" />
            <span className="font-bold">Personalidade (AGENT.md)</span>
          </button>
          
          <button 
            onClick={() => setActiveEditor('shop')}
            className={`w-full flex items-center gap-3 p-4 rounded-2xl transition-all ${
              activeEditor === 'shop' 
                ? 'bg-blue-600 text-white shadow-lg shadow-blue-100' 
                : 'bg-white text-slate-600 hover:bg-slate-50 border border-slate-200'
            }`}
          >
            <Store className="w-5 h-5" />
            <span className="font-bold">Loja & Produtos (SHOP.md)</span>
          </button>

          <div className="p-6 bg-amber-50 rounded-2xl border border-amber-100 space-y-3">
            <div className="flex items-center gap-2 text-amber-700">
              <ShieldCheck className="w-5 h-5" />
              <span className="font-bold text-sm">Dica de Prompt</span>
            </div>
            <p className="text-xs text-amber-600 leading-relaxed">
              Use Markdown para estruturar as regras. A IA respeita melhor instruções em tópicos e com exemplos de diálogos.
            </p>
          </div>
        </div>

        {/* Área do Editor */}
        <div className="lg:col-span-9 space-y-6">
          <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="px-6 py-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
              <div className="flex items-center gap-2">
                {activeEditor === 'agent' ? <Bot className="w-4 h-4 text-blue-600" /> : <Store className="w-4 h-4 text-blue-600" />}
                <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                  {activeEditor === 'agent' ? 'Instruções de Comportamento' : 'Catálogo e Regras de Venda'}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                <span className="text-[10px] font-bold text-slate-400">EDITOR ATIVO</span>
              </div>
            </div>
            
            <textarea 
              value={activeEditor === 'agent' ? config.agentMd : config.shopMd}
              onChange={(e) => setConfig({
                ...config,
                [activeEditor === 'agent' ? 'agentMd' : 'shopMd']: e.target.value
              })}
              className="w-full h-[600px] p-8 font-mono text-sm text-slate-700 focus:outline-none resize-none leading-relaxed"
              placeholder={activeEditor === 'agent' ? "# Defina a personalidade do seu agente aqui..." : "# Liste seus produtos e regras da loja aqui..."}
            />
          </div>

          {/* Cards de Ajuda Contextual */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="p-6 bg-white rounded-2xl border border-slate-200 flex gap-4">
              <div className="p-3 bg-blue-50 rounded-xl h-fit">
                <MessageSquare className="text-blue-600 w-6 h-6" />
              </div>
              <div>
                <h5 className="font-bold text-slate-900">Metodologia BANT</h5>
                <p className="text-xs text-slate-500 mt-1">O agente está configurado para identificar Budget, Authority, Need e Timeline automaticamente.</p>
              </div>
            </div>
            <div className="p-6 bg-white rounded-2xl border border-slate-200 flex gap-4">
              <div className="p-3 bg-purple-50 rounded-xl h-fit">
                <Sparkles className="text-purple-600 w-6 h-6" />
              </div>
              <div>
                <h5 className="font-bold text-slate-900">IA Generativa</h5>
                <p className="text-xs text-slate-500 mt-1">As alterações entram em vigor na próxima mensagem que o agente processar.</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
