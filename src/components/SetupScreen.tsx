import React, { useState } from 'react';
import { Shield, Key, Database, Globe, Save, Loader2, CheckCircle2 } from 'lucide-react';
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
    firestoreDatabaseId: '(default)'
  });

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      // 1. Save config to server
      const res = await fetch('/api/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(config)
      });

      if (!res.ok) throw new Error('Falha ao salvar configuração no servidor');

      // 2. Trigger installation routine (initial data)
      // We'll do this by calling a special endpoint or just letting the app handle it on first run
      toast.success('Configuração salva! Reiniciando sistema...');
      
      // Give time for the server to write the file
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
        className="bg-white max-w-2xl w-full rounded-3xl shadow-2xl border border-slate-200 overflow-hidden"
      >
        <div className="bg-blue-600 p-8 text-white">
          <div className="flex items-center gap-4 mb-4">
            <div className="p-3 bg-white/20 rounded-2xl backdrop-blur-md">
              <Shield className="w-8 h-8" />
            </div>
            <div>
              <h1 className="text-2xl font-bold">Configuração Inicial</h1>
              <p className="text-blue-100 text-sm">Configure seu Firebase para começar a usar o Agente.</p>
            </div>
          </div>
        </div>

        <form onSubmit={handleSave} className="p-8 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-500 uppercase flex items-center gap-2">
                <Key className="w-3 h-3" /> API Key
              </label>
              <input 
                required
                type="text"
                value={config.apiKey}
                onChange={e => setConfig({...config, apiKey: e.target.value})}
                className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none transition-all"
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
                className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                placeholder="meu-projeto.firebaseapp.com"
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
                className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none transition-all"
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
                className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none transition-all"
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
                className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                placeholder="1:123456789:web:abc123"
              />
            </div>
          </div>

          <div className="pt-6 border-t border-slate-100 flex items-center justify-between">
            <button 
              type="button"
              onClick={() => {
                if (confirm('Deseja realmente limpar as configurações e tentar novamente?')) {
                  setConfig({
                    apiKey: '',
                    authDomain: '',
                    projectId: '',
                    storageBucket: '',
                    messagingSenderId: '',
                    appId: '',
                    firestoreDatabaseId: '(default)'
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
