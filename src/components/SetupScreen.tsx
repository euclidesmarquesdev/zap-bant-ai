import React, { useState } from 'react';
import { Shield, Key, Database, Globe, Save, Loader2, CheckCircle2, User } from 'lucide-react';
import { motion } from 'motion/react';
import { toast } from 'sonner';

export default function SetupScreen({ onComplete }: { onComplete: () => void }) {
  const [loading, setLoading] = useState(false);
  const [config, setConfig] = useState({
    apiKey: '',
    authDomain: '',
    projectId: '',
    storageBucket: '',
    messagingSenderId: '',
    appId: '',
    firestoreDatabaseId: '(default)',
    adminEmail: ''
  });

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      // Basic validation
      if (!config.adminEmail.includes('@')) {
        throw new Error('Por favor, insira um e-mail de administrador válido.');
      }

      // 1. Save config to server
      const res = await fetch('/api/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(config)
      });

      if (!res.ok) throw new Error('Falha ao salvar configuração no servidor');

      toast.success('Configuração salva! Reiniciando sistema...');
      
      setTimeout(() => {
        window.location.reload();
      }, 2000);
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="bg-white max-w-3xl w-full rounded-3xl shadow-2xl border border-slate-200 overflow-hidden"
      >
        <div className="bg-blue-600 p-8 text-white">
          <div className="flex items-center gap-4 mb-4">
            <div className="p-3 bg-white/20 rounded-2xl backdrop-blur-md">
              <Shield className="w-8 h-8" />
            </div>
            <div>
              <h1 className="text-2xl font-bold">Instalação do Sistema</h1>
              <p className="text-blue-100 text-sm">Configure sua própria nuvem Firebase para controle total dos seus dados.</p>
            </div>
          </div>
          
          <div className="bg-blue-700/50 rounded-2xl p-4 border border-white/10 text-xs space-y-2">
            <p className="font-bold flex items-center gap-2"><CheckCircle2 className="w-3 h-3" /> Pré-requisitos no Firebase Console:</p>
            <ul className="list-disc list-inside opacity-80 space-y-1 ml-2">
              <li>Ativar <b>Authentication</b> (E-mail/Senha e Google)</li>
              <li>Criar banco de dados <b>Firestore</b></li>
              <li>Configurar as regras de segurança (disponíveis na pasta raiz do projeto)</li>
            </ul>
          </div>
        </div>

        <form onSubmit={handleSave} className="p-8 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="md:col-span-2 space-y-2">
              <label className="text-xs font-bold text-slate-500 uppercase flex items-center gap-2">
                <User className="w-3 h-3" /> E-mail do Administrador Principal
              </label>
              <input 
                required
                type="email"
                value={config.adminEmail}
                onChange={e => setConfig({...config, adminEmail: e.target.value})}
                className="w-full px-4 py-3 bg-blue-50 border border-blue-100 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none transition-all font-bold text-blue-900"
                placeholder="seu-email@admin.com"
              />
              <p className="text-[10px] text-slate-400">Este e-mail terá poderes totais no sistema e poderá cadastrar outros atendentes.</p>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-500 uppercase flex items-center gap-2">
                <Key className="w-3 h-3" /> API Key
              </label>
              <input 
                required
                type="text"
                value={config.apiKey}
                onChange={e => setConfig({...config, apiKey: e.target.value})}
                className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none transition-all text-sm"
                placeholder="AIzaSy..."
              />
            </div>
            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-500 uppercase flex items-center gap-2">
                <Globe className="w-3 h-3" /> Auth Domain
              </label>
              <input 
                required
                type="text"
                value={config.authDomain}
                onChange={e => setConfig({...config, authDomain: e.target.value})}
                className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none transition-all text-sm"
                placeholder="projeto.firebaseapp.com"
              />
            </div>
            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-500 uppercase flex items-center gap-2">
                <Database className="w-3 h-3" /> Project ID
              </label>
              <input 
                required
                type="text"
                value={config.projectId}
                onChange={e => setConfig({...config, projectId: e.target.value})}
                className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none transition-all text-sm"
                placeholder="meu-projeto-123"
              />
            </div>
            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-500 uppercase flex items-center gap-2">
                <Database className="w-3 h-3" /> Firestore DB ID
              </label>
              <input 
                required
                type="text"
                value={config.firestoreDatabaseId}
                onChange={e => setConfig({...config, firestoreDatabaseId: e.target.value})}
                className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none transition-all text-sm"
                placeholder="(default)"
              />
            </div>
            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-500 uppercase flex items-center gap-2">
                <Database className="w-3 h-3" /> App ID
              </label>
              <input 
                required
                type="text"
                value={config.appId}
                onChange={e => setConfig({...config, appId: e.target.value})}
                className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none transition-all text-sm"
                placeholder="1:123:web:abc"
              />
            </div>
            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-500 uppercase flex items-center gap-2">
                <Database className="w-3 h-3" /> Storage Bucket
              </label>
              <input 
                required
                type="text"
                value={config.storageBucket}
                onChange={e => setConfig({...config, storageBucket: e.target.value})}
                className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none transition-all text-sm"
                placeholder="projeto.appspot.com"
              />
            </div>
          </div>

          <div className="pt-6 border-t border-slate-100 flex items-center justify-between">
            <button 
              type="button"
              onClick={() => {
                if (confirm('Deseja realmente limpar as configurações?')) {
                  setConfig({
                    apiKey: '',
                    authDomain: '',
                    projectId: '',
                    storageBucket: '',
                    messagingSenderId: '',
                    appId: '',
                    firestoreDatabaseId: '(default)',
                    adminEmail: ''
                  });
                }
              }}
              className="text-slate-400 hover:text-red-500 text-sm font-medium transition-all"
            >
              Limpar Campos
            </button>
            <button 
              type="submit"
              disabled={loading}
              className="flex items-center gap-2 px-8 py-3 bg-blue-600 text-white font-bold rounded-2xl hover:bg-blue-700 transition-all shadow-lg shadow-blue-100 disabled:opacity-50"
            >
              {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />}
              Finalizar Instalação
            </button>
          </div>
        </form>
      </motion.div>
    </div>
  );
}
