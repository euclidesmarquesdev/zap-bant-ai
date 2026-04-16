import React, { useState, useEffect } from 'react';
import { doc, getDoc, setDoc, updateDoc, serverTimestamp } from 'firebase/firestore';
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
  Globe,
  RotateCcw,
  Copy
} from 'lucide-react';
import { motion } from 'motion/react';
import { toast } from 'sonner';

interface SettingsProps {
  user: User;
  userRole?: 'admin' | 'agent' | null;
  orgId?: string | null;
  isSuperAdmin?: boolean;
}

export default function Settings({ user, userRole, orgId, isSuperAdmin }: SettingsProps) {
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
    firestoreDatabaseId: '(default)',
    adminEmail: ''
  });
  const [settings, setSettings] = useState({
    geminiApiKey: '',
    notificationsEnabled: true,
    autoResponse: true,
    displayName: user.displayName || '',
    email: user.email || '',
    phone: '',
    orgName: '',
    inviteToken: '',
  });

  useEffect(() => {
    let isMounted = true;
    async function loadSettings() {
      if (!orgId) return;
      try {
        const [userDoc, orgDoc] = await Promise.all([
          getDoc(doc(db, 'organizations', orgId, 'users', user.uid)),
          getDoc(doc(db, 'organizations', orgId))
        ]);

        if (isMounted) {
          if (userDoc.exists()) {
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
          if (orgDoc.exists()) {
            const data = orgDoc.data();
            setSettings(prev => ({
              ...prev,
              orgName: data.name || '',
              inviteToken: data.inviteToken || ''
            }));
          }
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
      await Promise.all([
        setDoc(doc(db, 'organizations', orgId, 'users', user.uid), {
          geminiApiKey: settings.geminiApiKey,
          notificationsEnabled: settings.notificationsEnabled,
          autoResponse: settings.autoResponse,
          displayName: settings.displayName,
          phone: settings.phone,
          orgId,
          updatedAt: new Date(),
        }, { merge: true }),
        userRole === 'admin' ? updateDoc(doc(db, 'organizations', orgId), {
          name: settings.orgName,
          updatedAt: new Date()
        }) : Promise.resolve()
      ]);
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

  const handleRegenerateInviteToken = async () => {
    if (!orgId) return;
    const characters = 'abcdefghijklmnopqrstuvwxyz0123456789';
    let newToken = '';
    for (let i = 0; i < 16; i++) {
        newToken += characters.charAt(Math.floor(Math.random() * characters.length));
    }

    try {
        await updateDoc(doc(db, 'organizations', orgId), {
            inviteToken: newToken,
            updatedAt: serverTimestamp()
        });
        setSettings(prev => ({ ...prev, inviteToken: newToken }));
        toast.success('Novo link gerado com sucesso!');
    } catch (error) {
        console.error('Erro ao gerar novo token:', error);
        toast.error('Erro ao gerar novo link de convite.');
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
                  <label className="text-xs font-bold text-slate-500 uppercase">API Key</label>
                  <input 
                    type={showApiKey ? "text" : "password"}
                    value={fbConfig.apiKey}
                    onChange={e => setFbConfig({...fbConfig, apiKey: e.target.value})}
                    disabled={!isSuperAdmin}
                    className={`w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-blue-500/20 transition-all font-mono ${!isSuperAdmin ? 'bg-slate-100 text-slate-500 cursor-not-allowed' : ''}`}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-500 uppercase">Auth Domain</label>
                  <input 
                    type="text" 
                    value={fbConfig.authDomain}
                    onChange={e => setFbConfig({...fbConfig, authDomain: e.target.value})}
                    disabled={!isSuperAdmin}
                    className={`w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-blue-500/20 transition-all ${!isSuperAdmin ? 'bg-slate-100 text-slate-500 cursor-not-allowed' : ''}`}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-500 uppercase">Project ID</label>
                  <input 
                    type="text" 
                    value={fbConfig.projectId}
                    onChange={e => setFbConfig({...fbConfig, projectId: e.target.value})}
                    disabled={!isSuperAdmin}
                    className={`w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-blue-500/20 transition-all ${!isSuperAdmin ? 'bg-slate-100 text-slate-500 cursor-not-allowed' : ''}`}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-500 uppercase">Firestore DB ID</label>
                  <input 
                    type="text" 
                    value={fbConfig.firestoreDatabaseId}
                    onChange={e => setFbConfig({...fbConfig, firestoreDatabaseId: e.target.value})}
                    disabled={!isSuperAdmin}
                    className={`w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-blue-500/20 transition-all ${!isSuperAdmin ? 'bg-slate-100 text-slate-500 cursor-not-allowed' : ''}`}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-500 uppercase">Storage Bucket</label>
                  <input 
                    type="text" 
                    value={fbConfig.storageBucket}
                    onChange={e => setFbConfig({...fbConfig, storageBucket: e.target.value})}
                    disabled={!isSuperAdmin}
                    className={`w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-blue-500/20 transition-all ${!isSuperAdmin ? 'bg-slate-100 text-slate-500 cursor-not-allowed' : ''}`}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-500 uppercase">App ID</label>
                  <input 
                    type="text" 
                    value={fbConfig.appId}
                    onChange={e => setFbConfig({...fbConfig, appId: e.target.value})}
                    disabled={!isSuperAdmin}
                    className={`w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-blue-500/20 transition-all ${!isSuperAdmin ? 'bg-slate-100 text-slate-500 cursor-not-allowed' : ''}`}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-500 uppercase">Messaging Sender ID</label>
                  <input 
                    type="text" 
                    value={fbConfig.messagingSenderId}
                    onChange={e => setFbConfig({...fbConfig, messagingSenderId: e.target.value})}
                    disabled={!isSuperAdmin}
                    className={`w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-blue-500/20 transition-all ${!isSuperAdmin ? 'bg-slate-100 text-slate-500 cursor-not-allowed' : ''}`}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-500 uppercase">Super Admin Email (Mestre)</label>
                  <input 
                    type="email" 
                    value={fbConfig.adminEmail}
                    onChange={e => setFbConfig({...fbConfig, adminEmail: e.target.value})}
                    disabled={!isSuperAdmin}
                    className={`w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-blue-500/20 transition-all ${!isSuperAdmin ? 'bg-slate-100 text-slate-500 cursor-not-allowed' : ''}`}
                  />
                </div>
              </div>

              {isSuperAdmin && (
                <div className="flex justify-end">
                  <button 
                    onClick={handleSaveFirebase}
                    disabled={savingFirebase}
                    className="flex items-center gap-2 px-6 py-2 bg-slate-900 text-white text-xs font-bold rounded-xl hover:bg-black transition-all shadow-lg shadow-slate-200 disabled:opacity-50"
                  >
                    {savingFirebase ? <Loader2 className="w-3 h-3 animate-spin" /> : <Shield className="w-3 h-3" />}
                    {savingFirebase ? 'Sincronizando...' : 'Atualizar Infraestrutura'}
                  </button>
                </div>
              )}

              <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200">
                <p className="text-[10px] text-slate-500 leading-relaxed">
                  {isSuperAdmin ? 'Atenção: A alteração desses campos afetará todos os usuários da plataforma. Use com cuidado.' : 'As chaves de infraestrutura são gerenciadas pelo Super Admin para maior segurança e não podem ser editadas diretamente por administradores de organização.'}
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

              <div className="space-y-4">
                <div className="space-y-2">
                  <label className="text-sm font-bold text-slate-700 ml-1">Nome da Organização</label>
                  <input 
                    type="text" 
                    value={settings.orgName}
                    onChange={e => setSettings({...settings, orgName: e.target.value})}
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 transition-all"
                    placeholder="Nome da sua empresa"
                  />
                </div>

                <div className="p-4 bg-purple-50 rounded-2xl border border-purple-100 space-y-3">
                  <p className="text-xs text-purple-700 leading-relaxed">
                    Este é o link exclusivo para sua equipe de atendimento. Compartilhe este link com seus atendentes.
                  </p>
                  <div className="flex items-center gap-2">
                    <input 
                      readOnly
                      value={`${window.location.origin}/login?org=${settings.inviteToken || orgId}`}
                      className="flex-1 px-3 py-2 bg-white border border-purple-200 rounded-lg text-[10px] font-mono text-purple-900"
                    />
                    <button 
                      onClick={() => {
                        navigator.clipboard.writeText(`${window.location.origin}/login?org=${settings.inviteToken || orgId}`);
                        toast.success('Link copiado!');
                      }}
                      className="px-3 py-2 bg-purple-600 text-white text-[10px] font-bold rounded-lg hover:bg-purple-700 transition-all shadow-sm"
                    >
                      <Copy className="w-3 h-3" />
                    </button>
                    <button 
                      onClick={handleRegenerateInviteToken}
                      className="px-3 py-2 bg-white border border-slate-200 text-slate-600 text-[10px] font-bold rounded-lg hover:bg-slate-50 transition-all shadow-sm flex items-center gap-1"
                      title="Gerar novo link (tokens anteriores pararão de funcionar)"
                    >
                      <RotateCcw className="w-3 h-3" />
                      Novo Link
                    </button>
                  </div>
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
