import React, { useState, useEffect } from 'react';
import { doc, getDoc, setDoc, updateDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { User } from 'firebase/auth';
import { 
  Settings as SettingsIcon, 
  Key, 
  User as UserIcon, 
  Bell, 
  Shield, 
  Save, 
  Loader2, 
  Eye, 
  EyeOff,
  CheckCircle2,
  AlertCircle,
  Bot,
  Globe
} from 'lucide-react';
import { motion } from 'motion/react';
import { toast } from 'sonner';

interface SettingsProps {
  user: User;
  userRole?: 'admin' | 'agent' | null;
  orgId?: string | null;
}

export default function Settings({ user, userRole, orgId }: SettingsProps) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savingFirebase, setSavingFirebase] = useState(false);
  const [showApiKey, setShowApiKey] = useState(false);
  const [fbConfig, setFbConfig] = useState({
    apiKey: '',
    authDomain: '',
    projectId: '',
    storageBucket: '',
    messagingSenderId: '',
    appId: '',
    firestoreDatabaseId: '(default)'
  });
  const [settings, setSettings] = useState({
    geminiApiKey: '',
    notificationsEnabled: true,
    autoResponse: true,
    displayName: user.displayName || '',
    email: user.email || '',
    phone: '',
  });

  useEffect(() => {
    let isMounted = true;
    async function loadSettings() {
      if (!orgId) return;
      try {
        const userDoc = await getDoc(doc(db, 'organizations', orgId, 'users', user.uid));
        if (isMounted && userDoc.exists()) {
          const data = userDoc.data();
          setSettings(prev => ({
            ...prev,
            geminiApiKey: data.geminiApiKey || '',
            notificationsEnabled: data.notificationsEnabled ?? true,
            autoResponse: data.autoResponse ?? true,
            displayName: data.displayName || user.displayName || '',
            phone: data.phone || '',
          }));
        }

        if (userRole === 'admin') {
          const res = await fetch('/api/config');
          const fbData = await res.json();
          if (isMounted && fbData) setFbConfig(fbData);
        }
      } catch (error) {
        console.error('Erro ao carregar configurações:', error);
      } finally {
        if (isMounted) setLoading(false);
      }
    }
    loadSettings();
    return () => { isMounted = false; };
  }, [user, userRole, orgId]);

  const handleSave = async () => {
    if (!orgId) return;
    setSaving(true);
    try {
      await setDoc(doc(db, 'organizations', orgId, 'users', user.uid), {
        ...settings,
        orgId,
        updatedAt: new Date(),
      }, { merge: true });
      toast.success('Configurações salvas!');
    } catch (error) {
      console.error('Erro ao salvar:', error);
    } finally {
      setSaving(false);
    }
  };

  const handleSaveFirebase = async () => {
    setSavingFirebase(true);
    try {
      const res = await fetch('/api/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(fbConfig)
      });
      if (!res.ok) throw new Error('Erro ao salvar no servidor');
      toast.success('Firebase configurado! Reiniciando...');
      setTimeout(() => window.location.reload(), 2000);
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setSavingFirebase(false);
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
    <div className="max-w-4xl mx-auto space-y-8 pb-12">
      <div>
        <h2 className="text-2xl font-bold text-slate-900">Configurações</h2>
        <p className="text-slate-500">Gerencie sua conta, chaves de API e preferências do agente.</p>
      </div>

      <div className="space-y-6">
        {/* Seção de Perfil */}
        <section className="bg-white p-8 rounded-3xl border border-slate-200 shadow-sm space-y-6">
            <div className="flex items-center gap-4 mb-2">
              <div className="w-12 h-12 bg-slate-100 rounded-2xl flex items-center justify-center text-slate-400">
                <UserIcon className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-bold text-slate-900">Perfil do Usuário</h3>
            </div>
            
            <div className="grid grid-cols-1 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-bold text-slate-700 ml-1">Nome de Exibição</label>
                <input 
                  type="text" 
                  value={settings.displayName}
                  onChange={e => setSettings({...settings, displayName: e.target.value})}
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 transition-all"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-bold text-slate-700 ml-1">E-mail</label>
                <input 
                  type="email" 
                  value={settings.email}
                  disabled
                  className="w-full px-4 py-3 bg-slate-100 border border-slate-200 rounded-xl text-sm text-slate-500 cursor-not-allowed"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-bold text-slate-700 ml-1">Telefone (para notificações WhatsApp)</label>
                <input 
                  type="text" 
                  value={settings.phone}
                  onChange={e => setSettings({...settings, phone: e.target.value})}
                  placeholder="5511999999999"
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 transition-all"
                />
              </div>
            </div>
          </section>

          {/* Seção de Firebase (Instalação) - Admin Only */}
          {userRole === 'admin' && (
            <section className="bg-white p-8 rounded-3xl border border-slate-200 shadow-sm space-y-6">
              <div className="flex items-center gap-4 mb-2">
                <div className="w-12 h-12 bg-amber-50 rounded-2xl flex items-center justify-center text-amber-600">
                  <Shield className="w-6 h-6" />
                </div>
                <h3 className="text-lg font-bold text-slate-900">Infraestrutura Firebase</h3>
              </div>

              <div className="p-4 bg-amber-50 rounded-2xl border border-amber-100 flex gap-3">
                <AlertCircle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                <p className="text-xs text-amber-700 leading-relaxed">
                  Configure as chaves do seu projeto Firebase para habilitar o banco de dados e autenticação. 
                  Obtenha esses dados no <a href={`https://console.firebase.google.com/project/${fbConfig.projectId || '_'}/settings/general`} target="_blank" rel="noreferrer" className="text-amber-700 font-bold hover:underline">Console do Firebase</a>.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-500 uppercase">Project ID</label>
                  <input 
                    type="text" 
                    value={fbConfig.projectId}
                    disabled
                    className="w-full px-4 py-2 bg-slate-100 border border-slate-200 rounded-xl text-xs text-slate-500 cursor-not-allowed"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-500 uppercase">Firestore DB ID</label>
                  <input 
                    type="text" 
                    value={fbConfig.firestoreDatabaseId}
                    disabled
                    className="w-full px-4 py-2 bg-slate-100 border border-slate-200 rounded-xl text-xs text-slate-500 cursor-not-allowed"
                  />
                </div>
              </div>

              <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200">
                <p className="text-[10px] text-slate-500 leading-relaxed">
                  As chaves de infraestrutura (API Key, Auth Domain, etc) são gerenciadas pelo servidor para maior segurança e não podem ser editadas diretamente pelo painel.
                </p>
              </div>
            </section>
          )}

          {/* Seção de Portal do Atendente - Admin Only */}
          {userRole === 'admin' && (
            <section className="bg-white p-8 rounded-3xl border border-slate-200 shadow-sm space-y-6">
              <div className="flex items-center gap-4 mb-2">
                <div className="w-12 h-12 bg-purple-50 rounded-2xl flex items-center justify-center text-purple-600">
                  <Globe className="w-6 h-6" />
                </div>
                <h3 className="text-lg font-bold text-slate-900">Portal do Atendente (SaaS)</h3>
              </div>

              <div className="p-4 bg-purple-50 rounded-2xl border border-purple-100 space-y-3">
                <p className="text-xs text-purple-700 leading-relaxed">
                  Este é o link exclusivo para sua equipe de atendimento. Compartilhe este link com seus atendentes para que eles possam acessar o painel desta organização.
                </p>
                <div className="flex items-center gap-2">
                  <input 
                    readOnly
                    value={`${window.location.origin}/login?org=${orgId}`}
                    className="flex-1 px-3 py-2 bg-white border border-purple-200 rounded-lg text-[10px] font-mono text-purple-900"
                  />
                  <button 
                    onClick={() => {
                      navigator.clipboard.writeText(`${window.location.origin}/login?org=${orgId}`);
                      toast.success('Link copiado!');
                    }}
                    className="px-3 py-2 bg-purple-600 text-white text-[10px] font-bold rounded-lg hover:bg-purple-700 transition-all"
                  >
                    Copiar Link
                  </button>
                </div>
              </div>
            </section>
          )}

          {/* Seção de API Keys - Admin Only */}
          {userRole === 'admin' && (
            <section className="bg-white p-8 rounded-3xl border border-slate-200 shadow-sm space-y-6">
              <div className="flex items-center gap-4 mb-2">
                <div className="w-12 h-12 bg-blue-50 rounded-2xl flex items-center justify-center text-blue-600">
                  <Key className="w-6 h-6" />
                </div>
                <h3 className="text-lg font-bold text-slate-900">Integração Gemini AI</h3>
              </div>

              <div className="p-4 bg-blue-50 rounded-2xl border border-blue-100 flex gap-3">
                <AlertCircle className="w-5 h-5 text-blue-600 shrink-0 mt-0.5" />
                <p className="text-xs text-blue-700 leading-relaxed">
                  Sua chave de API é armazenada de forma segura e usada apenas para processar as mensagens dos seus leads. 
                  Cada usuário utiliza sua própria cota da Google AI Studio.
                </p>
              </div>
              
              <div className="space-y-2">
                <label className="text-sm font-bold text-slate-700 ml-1">Gemini API Key</label>
                <div className="relative">
                  <input 
                    type={showApiKey ? "text" : "password"}
                    value={settings.geminiApiKey}
                    onChange={e => setSettings({...settings, geminiApiKey: e.target.value})}
                    placeholder="Insira sua chave AI_..."
                    className="w-full pl-4 pr-12 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 transition-all font-mono"
                  />
                  <button 
                    onClick={() => setShowApiKey(!showApiKey)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-all"
                  >
                    {showApiKey ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                  </button>
                </div>
                <p className="text-[10px] text-slate-400 ml-1">
                  Obtenha sua chave gratuitamente em <a href="https://aistudio.google.com/app/apikey" target="_blank" rel="noreferrer" className="text-blue-600 hover:underline">Google AI Studio</a>.
                </p>
              </div>
            </section>
          )}

          {/* Seção de Preferências do Agente */}
          <section className="bg-white p-8 rounded-3xl border border-slate-200 shadow-sm space-y-6">
            <div className="flex items-center gap-4 mb-2">
              <div className="w-12 h-12 bg-green-50 rounded-2xl flex items-center justify-center text-green-600">
                <Bot className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-bold text-slate-900">Preferências do Agente</h3>
            </div>

            <div className="space-y-4">
              <div className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl">
                <div>
                  <p className="text-sm font-bold text-slate-900">Resposta Automática</p>
                  <p className="text-xs text-slate-500">Permitir que a IA responda mensagens instantaneamente.</p>
                </div>
                <button 
                  onClick={() => setSettings({...settings, autoResponse: !settings.autoResponse})}
                  className={`w-12 h-6 rounded-full transition-all relative ${settings.autoResponse ? 'bg-blue-600' : 'bg-slate-300'}`}
                >
                  <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all ${settings.autoResponse ? 'left-7' : 'left-1'}`} />
                </button>
              </div>

              <div className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl">
                <div>
                  <p className="text-sm font-bold text-slate-900">Notificações Push</p>
                  <p className="text-xs text-slate-500">Receber alertas quando um lead atingir score alto.</p>
                </div>
                <button 
                  onClick={() => setSettings({...settings, notificationsEnabled: !settings.notificationsEnabled})}
                  className={`w-12 h-6 rounded-full transition-all relative ${settings.notificationsEnabled ? 'bg-blue-600' : 'bg-slate-300'}`}
                >
                  <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all ${settings.notificationsEnabled ? 'left-7' : 'left-1'}`} />
                </button>
              </div>
            </div>
          </section>

          {/* Botão de Salvar */}
          <div className="flex justify-end pt-4">
            <button 
              onClick={handleSave}
              disabled={saving}
              className="flex items-center gap-2 px-8 py-4 bg-blue-600 text-white font-bold rounded-2xl hover:bg-blue-700 transition-all shadow-lg shadow-blue-100 disabled:opacity-50"
            >
              {saving ? <Loader2 className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />}
              {saving ? 'Salvando...' : 'Salvar Alterações'}
            </button>
          </div>
      </div>
    </div>
  );
}
