import React, { useState, useEffect } from 'react';
import { auth, googleProvider, db, isValidConfig, adminEmail } from './firebase';
import { signInWithPopup, onAuthStateChanged, User, getRedirectResult } from 'firebase/auth';
import { doc, setDoc, getDoc, collection, onSnapshot, query, orderBy, addDoc, updateDoc, serverTimestamp, getDocs, limit, where } from 'firebase/firestore';
import { useWhatsApp } from './hooks/useWhatsApp';
import { processMessage } from './services/geminiService';
import Sidebar from './components/Sidebar';
import Header from './components/Header';
import Dashboard from './components/Dashboard';
import Kanban from './components/Kanban';
import Chat from './components/Chat';
import LeadRanking from './components/LeadRanking';
import AgentManager from './components/AgentManager';
import WhatsAppConnector from './components/WhatsAppConnector';
import Settings from './components/Settings';
import SetupScreen from './components/SetupScreen';
import TeamManager from './components/TeamManager';
import SuperAdminDashboard from './components/SuperAdminDashboard';
import LicenseManager from './components/LicenseManager';
import OrgRegistration from './components/OrgRegistration';
import WaitingApproval from './components/WaitingApproval';
import AuthScreen from './components/Auth/AuthScreen';
import { bootstrapDatabase } from './services/dbSetup';
import { assignLeadToAgent } from './services/assignmentService';
import { LogIn, MessageSquare, LayoutDashboard, Users, Bot, BarChart3, Settings as SettingsIcon } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { toast } from 'sonner';

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [orgId, setOrgId] = useState<string | null>(null);
  const [userRole, setUserRole] = useState<'admin' | 'agent' | null>(null);
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);
  const [isMasterSession, setIsMasterSession] = useState(() => {
    const val = localStorage.getItem('isMasterSession') === 'true';
    console.log('Initial Master Session State:', val);
    return val;
  });
  const [orgStatus, setOrgStatus] = useState<'pending' | 'active' | 'inactive' | null>(null);
  const [userData, setUserData] = useState<any>(null);
  const [welcomeSettings, setWelcomeSettings] = useState<any>(null);
  const [isRoleLoading, setIsRoleLoading] = useState(true);
  
  console.log('💎 [APP] Renderizando. User:', user?.email || 'NULL', 'RoleLoading:', isRoleLoading);
  const [isBootstrapping, setIsBootstrapping] = useState(false);
  const [activeTab, setActiveTab] = useState(() => {
    return localStorage.getItem('isMasterSession') === 'true' ? 'super_admin' : 'dashboard';
  });
  const [selectedLeadId, setSelectedLeadId] = useState<string | null>(null);
  const [trainingData, setTrainingData] = useState({ agentMd: '', shopMd: '' });
  const [processedMessages] = useState(new Set<string>());
  const { qrCode, isReady, userPhone, lastMessage, sendAIResponse, disconnect, setTyping, joinOrg } = useWhatsApp();
  
  // Effect force super_admin tab if master session is detected later
  useEffect(() => {
    if (isSuperAdmin && activeTab !== 'super_admin' && localStorage.getItem('isMasterSession') === 'true') {
        setActiveTab('super_admin');
    }
  }, [isSuperAdmin]);

  // 🚀 Efeito para capturar convites via URL
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const invitedOrgId = urlParams.get('org');
    
    if (user && invitedOrgId) {
      console.log('🔗 Convite detectado na URL:', invitedOrgId);
      handleInvitation(user, invitedOrgId);
    }
  }, [user, window.location.search]);

  const handleInvitation = async (currentUser: User, invitedToken: string) => {
    try {
      const currentEmail = currentUser.email?.toLowerCase().trim() || '';
      const userGlobalRef = doc(db, 'users', currentUser.uid);
      const userGlobalSnap = await getDoc(userGlobalRef);
      const currentStoredOrgId = userGlobalSnap.exists() ? userGlobalSnap.data().orgId : null;

      // Primeiro, tentamos ver se o token é um orgId direto (compatibilidade)
      let resolvedOrgId = invitedToken;
      let orgExists = false;
      
      try {
        const orgRef = doc(db, 'organizations', invitedToken);
        const orgSnap = await getDoc(orgRef);
        if (orgSnap.exists()) {
          orgExists = true;
        }
      } catch (e) {
        console.log('📝 invitedToken não é um ID direto ou acesso negado, buscando como token...');
      }

      // Se não for um ID de documento, buscamos pelo campo inviteToken
      if (!orgExists) {
        console.log('🔍 Buscando por inviteToken...');
        const q = query(collection(db, 'organizations'), where('inviteToken', '==', invitedToken), limit(1));
        const qSnap = await getDocs(q);
        
        if (!qSnap.empty) {
          resolvedOrgId = qSnap.docs[0].id;
          console.log('✅ Organização resolvida via token:', resolvedOrgId);
        } else {
          console.error('❌ Token de convite inválido:', invitedToken);
          toast.error('Link de convite inválido ou expirado.');
          return;
        }
      }

      if (resolvedOrgId !== currentStoredOrgId) {
        console.log('📝 Registrando novo vínculo de organização:', resolvedOrgId);
        
        // 1. Registro Global
        await setDoc(userGlobalRef, {
          uid: currentUser.uid,
          email: currentEmail,
          orgId: resolvedOrgId,
          role: 'agent',
          updatedAt: serverTimestamp()
        }, { merge: true });

        // 2. Registro na Organização
        await setDoc(doc(db, 'organizations', resolvedOrgId, 'users', currentUser.uid), {
          uid: currentUser.uid,
          orgId: resolvedOrgId,
          email: currentEmail,
          displayName: currentUser.displayName || 'Atendente',
          role: 'agent',
          active: true,
          createdAt: serverTimestamp()
        }, { merge: true });

        setOrgId(resolvedOrgId);
        toast.success('Você entrou na organização com sucesso!');
      }
      
      // Limpa a URL sem recarregar a página
      const newUrl = window.location.pathname;
      window.history.replaceState({}, document.title, newUrl);
    } catch (error) {
      console.error('❌ Erro ao processar convite:', error);
      toast.error('Erro ao entrar na organização.');
    }
  };

  useEffect(() => {
    console.log('🚀 [APP] useEffect inicializando. Config:', isValidConfig, 'Auth:', !!auth);
    
    if (!isValidConfig || !auth) {
      console.warn('⚠️ [APP] Abortando inicialização: Config inválida ou Auth ausente.');
      return;
    }

    let unsubscribeConfig: (() => void) | null = null;
    let unsubscribeUser: (() => void) | null = null;
    let unsubscribeWelcome: (() => void) | null = null;

    console.log('📡 [APP] Registrando listener onAuthStateChanged...');
    
    // Diagnóstico de Host
    console.log('🌍 [APP] Host Atual:', window.location.hostname);
    if (!window.location.hostname.includes('firebaseapp.com') && !window.location.hostname.includes('web.app') && !window.location.hostname.includes('localhost')) {
      console.warn('⚠️ [APP] Domínio customizado detectado. Certifique-se de que "' + window.location.hostname + '" esteja nos domínios autorizados do Firebase.');
    }

    // Capturar resultado de redirecionamento (caso o popup falhe)
    getRedirectResult(auth).then((result) => {
      if (result) {
        console.log('📥 [AUTH] Resultado de redirecionamento capturado:', result.user.email);
        setUser(result.user);
        toast.success('Login recuperado por redirecionamento!');
      } else {
        console.log('📥 [AUTH] Nenhum resultado de redirecionamento pendente.');
      }
    }).catch((err) => {
      console.error('❌ [AUTH] Erro no getRedirectResult:', err.code, err.message);
      if (err.code === 'auth/unauthorized-domain') {
        toast.error('Domínio "' + window.location.hostname + '" não autorizado no Firebase!');
      }
    });

    const unsubscribeAuth = onAuthStateChanged(auth, async (user) => {
      console.log('🔄 [AUTH] Evento onAuthStateChanged. Usuário:', user?.email || 'NULL');
      
      try {
        if (user) {
          setUser(user);
          setIsRoleLoading(true);
          
          const masterSessionActive = localStorage.getItem('isMasterSession') === 'true';
          const primaryAdminEmail = adminEmail.toLowerCase().trim();
          const currentEmail = user.email?.toLowerCase().trim() || '';
          const isPrimaryAdmin = currentEmail === primaryAdminEmail || masterSessionActive;
          
          setIsSuperAdmin(isPrimaryAdmin);
          setIsMasterSession(masterSessionActive);
          
          console.log('🔐 [AUTH] Sessão:', { email: currentEmail, isPrimaryAdmin, masterSessionActive });

          // 1. Fetch User Global Record
          const userGlobalRef = doc(db, 'users', user.uid);
          let userGlobalData = null;
          
          try {
            const snap = await getDoc(userGlobalRef);
            if (snap.exists()) {
              userGlobalData = snap.data();
              console.log('✅ [AUTH] Doc global encontrado:', userGlobalData);
            } else {
              console.log('⚠️ [AUTH] Doc global ausente. Criando perfil padrão...');
              userGlobalData = {
                uid: user.uid,
                email: currentEmail,
                role: 'agent',
                updatedAt: serverTimestamp()
              };
              await setDoc(userGlobalRef, userGlobalData);
            }
          } catch (e: any) {
            console.error('❌ [AUTH] Erro ao acessar users/' + user.uid + ':', e.message);
          }
          
          let currentOrgId = userGlobalData?.orgId || '';
          let isSuperAdminFromDB = userGlobalData?.role === 'super_admin';

          if (isSuperAdminFromDB) {
            console.log('👑 [AUTH] Role Super Admin (DB) ativa');
            setIsSuperAdmin(true);
          }

          if (isPrimaryAdmin || masterSessionActive || isSuperAdminFromDB) {
            currentOrgId = currentOrgId || 'master-org';
            console.log('👑 [AUTH] Acesso Administrativo forçado para org:', currentOrgId);
          }

          if (currentOrgId) {
            setOrgId(currentOrgId);
            joinOrg(currentOrgId); 
            console.log('📡 [AUTH] Monitorando organização:', currentOrgId);

            const orgRef = doc(db, 'organizations', currentOrgId);
            onSnapshot(orgRef, (snap) => {
              if (snap.exists()) {
                const data = snap.data();
                setOrgStatus(data.status || (data.active ? 'active' : 'inactive'));
              }
            }, (err) => console.error('❌ [AUTH] Erro Snapshot Org:', err.message));

            const userRef = doc(db, 'organizations', currentOrgId, 'users', user.uid);
            unsubscribeUser = onSnapshot(userRef, (snap) => {
              console.log('👤 [AUTH] Snapshot Org User. Existe:', snap.exists(), 'Org:', currentOrgId);
              if (isPrimaryAdmin || masterSessionActive || isSuperAdminFromDB) {
                setUserRole('admin');
                setUserData({
                  uid: user.uid,
                  email: currentEmail,
                  displayName: user.displayName || 'Super Admin',
                  role: 'admin',
                  active: true
                });
              } else if (snap.exists()) {
                const data = snap.data();
                setUserRole(data.role);
                setUserData(data);
              } else {
                console.warn('⚠️ [AUTH] Usuário não vinculado na org:', currentOrgId);
                setUserRole('agent');
                setUserData({ uid: user.uid, email: currentEmail, role: 'agent' });
              }
              setIsRoleLoading(false);
            }, (err) => {
              console.error('❌ [AUTH] Erro Snapshot User Orp:', err.message);
              setIsRoleLoading(false);
            });

            const configRef = doc(db, 'organizations', currentOrgId, 'settings', 'training');
            unsubscribeConfig = onSnapshot(configRef, (snap) => {
              if (snap.exists()) setTrainingData(snap.data() as any);
            });

            const welcomeRef = doc(db, 'organizations', currentOrgId, 'settings', 'welcome');
            unsubscribeWelcome = onSnapshot(welcomeRef, (snap) => {
              if (snap.exists()) setWelcomeSettings(snap.data());
            });
          } else {
            console.log('⚠️ [AUTH] Nenhuma organização vinculada ao usuário final.');
            setUserRole('agent');
            setUserData({ uid: user.uid, email: currentEmail, role: 'agent' });
            setOrgId("");
            setIsRoleLoading(false);
          }

          if (isPrimaryAdmin) {
            try {
              console.log('⚡ [AUTH] Executando Bootstrap...');
              setIsBootstrapping(true);
              await bootstrapDatabase(user, masterSessionActive);
              console.log('✅ [AUTH] Bootstrap OK.');
            } catch (err: any) {
              console.error('❌ [AUTH] Falha no Bootstrap:', err.message);
            } finally {
              setIsBootstrapping(false);
            }
          }

        } else {
          console.log('🚪 [AUTH] Usuário deslogado (NULL)');
          setUser(null);
          setOrgId(null);
          setUserRole(null);
          setIsSuperAdmin(false);
          setIsMasterSession(false);
          setIsRoleLoading(false);
          if (unsubscribeConfig) unsubscribeConfig();
          if (unsubscribeUser) unsubscribeUser();
          if (unsubscribeWelcome) unsubscribeWelcome();
        }
      } catch (fatalError: any) {
        console.error('💥 [AUTH] ERRO FATAL:', fatalError.message);
        setIsRoleLoading(false);
      }
    });

    return () => {
      console.log('🧹 [APP] Limpando listeners...');
      unsubscribeAuth();
      if (unsubscribeConfig) unsubscribeConfig();
      if (unsubscribeUser) unsubscribeUser();
      if (unsubscribeWelcome) unsubscribeWelcome();
    };
  }, [auth, isValidConfig]);

  // Process incoming WhatsApp messages
  useEffect(() => {
    if (user && orgId && lastMessage && trainingData.agentMd) {
      const msgId = lastMessage.id || `${lastMessage.from}_${lastMessage.timestamp}`;
      if (!processedMessages.has(msgId)) {
        processedMessages.add(msgId);
        handleIncomingMessage(lastMessage);
      }
    }
  }, [user, orgId, lastMessage, trainingData]);

  const handleIncomingMessage = async (msg: any) => {
    if (!user || !orgId) return;

    const leadId = msg.from;
    const leadRef = doc(db, 'organizations', orgId, 'leads', leadId);
    const leadSnap = await getDoc(leadRef);

    let history: any[] = [];
    let currentLeadData: any = null;

    if (leadSnap.exists()) {
      currentLeadData = leadSnap.data();
      const messagesRef = collection(db, 'organizations', orgId, 'leads', leadId, 'messages');
      const q = query(messagesRef, orderBy('timestamp', 'desc'), limit(10));
      const querySnapshot = await getDocs(q);
      history = querySnapshot.docs.map(doc => ({
        role: doc.data().sender === 'lead' ? 'user' : 'model',
        content: doc.data().text
      })).reverse();
    } else {
      currentLeadData = {
        id: leadId,
        orgId,
        phone: msg.from,
        name: msg.pushName || 'Cliente',
        status: 'novo',
        score: 0,
        bant: { budget: false, authority: false, need: false, timeline: false },
        lastMessage: msg.body,
        updatedAt: new Date()
      };
      await setDoc(leadRef, { ...currentLeadData, updatedAt: serverTimestamp() });

      if (welcomeSettings) {
        const welcome = welcomeSettings;
        if (welcome.text || (welcome.mediaUrl && welcome.mediaType !== 'none')) {
          await fetch('/api/whatsapp/send', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ orgId, to: leadId, message: welcome.text })
          });
          await addDoc(collection(db, 'organizations', orgId, 'leads', leadId, 'messages'), {
            text: welcome.text || `[Mídia]`,
            sender: 'ai',
            timestamp: serverTimestamp(),
            orgId
          });
        }
      }
    }

    await addDoc(collection(db, 'organizations', orgId, 'leads', leadId, 'messages'), {
      text: msg.body,
      sender: 'lead',
      timestamp: serverTimestamp(),
      orgId
    });

    try {
      setTyping(leadId, 'composing');
      const result = await processMessage(msg.body, history, trainingData.agentMd, trainingData.shopMd, currentLeadData, userData?.geminiApiKey);
      
      const updateData = {
        status: result.status,
        score: result.leadScore,
        bant: { budget: result.budget, authority: result.authority, need: result.need, timeline: result.timeline },
        lastMessage: result.response,
        updatedAt: serverTimestamp()
      };
      await updateDoc(leadRef, updateData);

      await addDoc(collection(db, 'organizations', orgId, 'leads', leadId, 'messages'), {
        text: result.response,
        sender: 'ai',
        timestamp: serverTimestamp(),
        orgId
      });

      sendAIResponse(leadId, result.response);
    } catch (error) {
      console.error('Gemini Error:', error);
    }
  };

  const login = () => signInWithPopup(auth, googleProvider);

  if (!isValidConfig) {
    return <SetupScreen onComplete={() => window.location.reload()} />;
  }

  if (!user) {
    return <AuthScreen />;
  }

  if (!orgId && !isSuperAdmin) {
    return <OrgRegistration user={user} onComplete={(id) => setOrgId(id)} />;
  }

  if (orgId && orgStatus !== 'active' && !isSuperAdmin) {
    return <WaitingApproval />;
  }

  if (isRoleLoading || isBootstrapping) {
    return (
      <div className="h-screen flex items-center justify-center bg-slate-50">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 bg-blue-600 rounded-2xl flex items-center justify-center shadow-lg shadow-blue-200">
            <Bot className="text-white w-8 h-8 animate-pulse" />
          </div>
          <p className="text-slate-500 font-medium animate-pulse">
            {isBootstrapping ? 'Configurando ambiente master...' : 'Carregando perfil...'}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-slate-50 overflow-hidden">
      <Sidebar activeTab={activeTab} setActiveTab={setActiveTab} userPhone={userPhone} userRole={userRole} isSuperAdmin={isSuperAdmin} />
      
      <div className="flex-1 flex flex-col overflow-hidden">
        <Header user={user} userPhone={userPhone} userRole={userRole} isSuperAdmin={isSuperAdmin} />
        
        <main className="flex-1 overflow-y-auto p-6">
          <AnimatePresence mode="wait">
            {activeTab === 'super_admin' && isSuperAdmin && (
              <motion.div key="super_admin" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
                <SuperAdminDashboard />
              </motion.div>
            )}
            {activeTab === 'dashboard' && (
              <motion.div key="dashboard" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
                <Dashboard 
                  userPhone={userPhone}
                  userRole={userRole}
                  userId={user.uid}
                  orgId={orgId}
                  onSelectLead={(id) => { setSelectedLeadId(id); setActiveTab('chat'); }} 
                />
              </motion.div>
            )}
            {activeTab === 'kanban' && (
              <motion.div key="kanban" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
                <Kanban userPhone={userPhone} userRole={userRole} userId={user.uid} orgId={orgId} />
              </motion.div>
            )}
            {activeTab === 'chat' && (
              <motion.div key="chat" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="h-full">
                <Chat selectedLeadId={selectedLeadId} userRole={userRole} userId={user.uid} orgId={orgId} />
              </motion.div>
            )}
            {activeTab === 'ranking' && (
              <motion.div key="ranking" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
                <LeadRanking userRole={userRole} userId={user.uid} orgId={orgId} />
              </motion.div>
            )}
            {activeTab === 'agents' && userRole === 'admin' && (
              <motion.div key="agents" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
                <AgentManager orgId={orgId} />
              </motion.div>
            )}
            {activeTab === 'human_agents' && userRole === 'admin' && (
              <motion.div key="human_agents" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
                <TeamManager currentUserEmail={user.email} orgId={orgId} />
              </motion.div>
            )}
            {activeTab === 'whatsapp' && userRole === 'admin' && (
              <motion.div key="whatsapp" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
                <WhatsAppConnector qrCode={qrCode} isReady={isReady} userPhone={userPhone} onDisconnect={disconnect} />
              </motion.div>
            )}
            {activeTab === 'license' && userRole === 'admin' && orgId && (
              <motion.div key="license" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
                <LicenseManager orgId={orgId} />
              </motion.div>
            )}
            {activeTab === 'settings' && (
              <motion.div key="settings" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
                <Settings user={user} userRole={userRole} orgId={orgId} isSuperAdmin={isSuperAdmin} />
              </motion.div>
            )}
          </AnimatePresence>
        </main>
      </div>
    </div>
  );
}
