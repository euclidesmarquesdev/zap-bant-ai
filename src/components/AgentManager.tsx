import React, { useState, useEffect } from 'react';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { Bot, Save, Loader2, Settings2, Store, MessageSquare, ShieldCheck, Sparkles, Image as ImageIcon, Video, FileText, X } from 'lucide-react';
import { motion } from 'motion/react';
import { toast } from 'sonner';

export default function AgentManager({ orgId }: { orgId?: string | null }) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [activeEditor, setActiveEditor] = useState<'agent' | 'shop' | 'welcome'>('agent');
  const [config, setConfig] = useState({
    agentMd: '',
    shopMd: ''
  });
  const [welcomeConfig, setWelcomeConfig] = useState({
    text: '',
    mediaUrl: '',
    mediaType: 'none',
    fileName: ''
  });

  useEffect(() => {
    async function loadConfig() {
      if (!orgId) return;
      try {
        const configRef = doc(db, 'organizations', orgId, 'settings', 'training');
        const configSnap = await getDoc(configRef);
        if (configSnap.exists()) {
          setConfig(configSnap.data() as any);
        }

        const welcomeRef = doc(db, 'organizations', orgId, 'settings', 'welcome');
        const welcomeSnap = await getDoc(welcomeRef);
        if (welcomeSnap.exists()) {
          setWelcomeConfig(welcomeSnap.data() as any);
        }
      } catch (error) {
        console.error('Erro ao carregar configurações:', error);
      } finally {
        setLoading(false);
      }
    }
    loadConfig();
  }, [orgId]);

  const handleSave = async () => {
    if (!orgId) return;
    setSaving(true);
    try {
      await setDoc(doc(db, 'organizations', orgId, 'settings', 'training'), { ...config, orgId });
      await setDoc(doc(db, 'organizations', orgId, 'settings', 'welcome'), { ...welcomeConfig, orgId });
      toast.success('Configurações salvas!');
    } catch (error) {
      console.error('Erro ao salvar:', error);
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

          <button 
            onClick={() => setActiveEditor('welcome')}
            className={`w-full flex items-center gap-3 p-4 rounded-2xl transition-all ${
              activeEditor === 'welcome' 
                ? 'bg-blue-600 text-white shadow-lg shadow-blue-100' 
                : 'bg-white text-slate-600 hover:bg-slate-50 border border-slate-200'
            }`}
          >
            <Sparkles className="w-5 h-5" />
            <span className="font-bold">Boas-vindas & Mídia</span>
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
          {activeEditor === 'welcome' ? (
            <div className="bg-white p-8 rounded-3xl border border-slate-200 shadow-sm space-y-8">
              <div className="space-y-4">
                <h3 className="text-lg font-bold text-slate-900">Mensagem de Boas-vindas</h3>
                <p className="text-sm text-slate-500">Esta mensagem será enviada automaticamente para novos leads, acompanhada de mídia se configurada.</p>
                <textarea 
                  value={welcomeConfig.text}
                  onChange={(e) => setWelcomeConfig({...welcomeConfig, text: e.target.value})}
                  className="w-full h-32 p-4 bg-slate-50 border border-slate-200 rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                  placeholder="Olá! Seja bem-vindo à nossa loja..."
                />
              </div>

              <div className="space-y-4">
                <h3 className="text-lg font-bold text-slate-900">Mídia de Boas-vindas</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-slate-500 uppercase">Tipo de Mídia</label>
                    <div className="flex gap-2">
                      {[
                        { id: 'none', icon: X, label: 'Nenhuma' },
                        { id: 'image', icon: ImageIcon, label: 'Imagem' },
                        { id: 'video', icon: Video, label: 'Vídeo' },
                        { id: 'document', icon: FileText, label: 'PDF/Doc' }
                      ].map(type => (
                        <button
                          key={type.id}
                          onClick={() => setWelcomeConfig({...welcomeConfig, mediaType: type.id as any})}
                          className={`flex-1 flex flex-col items-center gap-2 p-3 rounded-xl border transition-all ${
                            welcomeConfig.mediaType === type.id 
                              ? 'bg-blue-600 border-blue-600 text-white' 
                              : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                          }`}
                        >
                          <type.icon className="w-5 h-5" />
                          <span className="text-[10px] font-bold">{type.label}</span>
                        </button>
                      ))}
                    </div>
                  </div>

                  {welcomeConfig.mediaType !== 'none' && (
                    <div className="space-y-4 animate-in fade-in slide-in-from-top-2">
                      <div className="space-y-2">
                        <label className="text-xs font-bold text-slate-500 uppercase">URL da Mídia</label>
                        <input 
                          type="text"
                          value={welcomeConfig.mediaUrl}
                          onChange={(e) => setWelcomeConfig({...welcomeConfig, mediaUrl: e.target.value})}
                          className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                          placeholder="https://exemplo.com/arquivo.pdf"
                        />
                      </div>
                      {welcomeConfig.mediaType === 'document' && (
                        <div className="space-y-2">
                          <label className="text-xs font-bold text-slate-500 uppercase">Nome do Arquivo</label>
                          <input 
                            type="text"
                            value={welcomeConfig.fileName}
                            onChange={(e) => setWelcomeConfig({...welcomeConfig, fileName: e.target.value})}
                            className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                            placeholder="Cardapio.pdf"
                          />
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>
          ) : (
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
          )}

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
