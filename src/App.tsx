import React, { useState, useEffect } from 'react';
import { auth, googleProvider, db, isValidConfig, adminEmail } from './firebase';
import { signInWithPopup, onAuthStateChanged, User, getRedirectResult } from 'firebase/auth';
import { doc, setDoc, getDoc, collection, onSnapshot, query, orderBy, addDoc, updateDoc, serverTimestamp, getDocs, limit } from 'firebase/firestore';
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

  const handleInvitation = async (currentUser: User, invitedOrgId: string) => {
    try {
      const currentEmail = currentUser.email?.toLowerCase().trim() || '';
      const userGlobalRef = doc(db, 'users', currentUser.uid);
      const userGlobalSnap = await getDoc(userGlobalRef);
      const currentStoredOrgId = userGlobalSnap.exists() ? userGlobalSnap.data().orgId : null;

      if (invitedOrgId !== currentStoredOrgId) {
        console.log('📝 Registrando novo vínculo de organização:', invitedOrgId);
        
        // 1. Registro Global
        await setDoc(userGlobalRef, {
          uid: currentUser.uid,
          email: currentEmail,
          orgId: invitedOrgId,
          role: 'agent',
          updatedAt: serverTimestamp()
        }, { merge: true });

        // 2. Registro na Organização
        await setDoc(doc(db, 'organizations', invitedOrgId, 'users', currentUser.uid), {
          uid: currentUser.uid,
          orgId: invitedOrgId,
          email: currentEmail,
          displayName: currentUser.displayName || 'Atendente',
          role: 'agent',
          active: true,
          createdAt: serverTimestamp()
        }, { merge: true });

        setOrgId(invitedOrgId);
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
    if (!isValidConfig || !auth) return;

    let unsubscribeConfig: (() => void) | null = null;
    let unsubscribeUser: (() => void) | null = null;
    let unsubscribeWelcome: (() => void) | null = null;

    const unsubscribeAuth = onAuthStateChanged(auth, async (user) => {
      console.log('Auth State Changed:', user?.email);
      
      // Check for redirect result
      try {
        const result = await getRedirectResult(auth);
        if (result?.user) {
          console.log('Redirect login success:', result.user.email);
        }
      } catch (redirectError: any) {
        console.error('Redirect auth error:', redirectError);
      }

      if (user) {
        setUser(user);
        
        const urlParams = new URLSearchParams(window.location.search);
        const invitedOrgId = urlParams.get('org');

        const currentEmail = user.email?.toLowerCase().trim() || '';
        const primaryAdminEmail = adminEmail.toLowerCase().trim();
        
        // Check localStorage directly to avoid state closure issues
        const masterSessionActive = localStorage.getItem('isMasterSession') === 'true';
        const isPrimaryAdmin = currentEmail === primaryAdminEmail || masterSessionActive;
        
        setIsSuperAdmin(isPrimaryAdmin);
        setIsMasterSession(masterSessionActive);
        
        console.log('🔐 Estado de Autenticação:', { 
          email: currentEmail, 
          isPrimaryAdmin, 
          masterSessionActive,
          uid: user.uid 
        });

        // 🚀 Bootstrap Idempotente de Hierarquia
        if (isPrimaryAdmin) {
          try {
            console.log('⚡ Iniciando bootstrap para Super Admin...');
            setIsBootstrapping(true);
            await bootstrapDatabase(user, masterSessionActive);
            console.log('✅ Bootstrap finalizado.');
            
            // Força a aba para super_admin se for uma sessão master
            if (masterSessionActive) {
                console.log('🎯 Forçando aba Super Admin');
                setActiveTab('super_admin');
            }
          } catch (err) {
            console.error('❌ Erro no bootstrap:', err);
          } finally {
            setIsBootstrapping(false);
          }
        }

        // 1. Fetch User Global Record to get orgId
        const userGlobalRef = doc(db, 'users', user.uid);
        const userGlobalSnap = await getDoc(userGlobalRef);
        
        let currentOrgId = '';

        if (userGlobalSnap.exists()) {
          currentOrgId = userGlobalSnap.data().orgId;
          console.log('📂 Organização atual do usuário:', currentOrgId);
        }

        // If primary admin or master session, prioritize master-org if nothing else is set
        if (isPrimaryAdmin || masterSessionActive) {
          currentOrgId = currentOrgId || 'master-org';
          console.log('👑 Super Admin/Master - Usando organização:', currentOrgId);
        }

        if (currentOrgId) {
          setOrgId(currentOrgId);
          joinOrg(currentOrgId); // Join socket room
          console.log('📡 Conectando à organização:', currentOrgId);

          // Fetch Org Status
          const orgRef = doc(db, 'organizations', currentOrgId);
          onSnapshot(orgRef, (snap) => {
            if (snap.exists()) {
              setOrgStatus(snap.data().status || (snap.data().active ? 'active' : 'inactive'));
            }
          }, (err) => {
            console.error('Erro no snapshot da organização:', err);
            if (err.message.includes('permission-denied')) {
              toast.error('Acesso negado à organização. Certifique-se de estar usando o e-mail master para a primeira configuração.');
            }
          });

          // 2. Fetch User Data from Org
          const userRef = doc(db, 'organizations', currentOrgId, 'users', user.uid);
          unsubscribeUser = onSnapshot(userRef, (snap) => {
            // Se for admin primário ou sessão master, forçamos o papel de admin
            if (isPrimaryAdmin || masterSessionActive) {
              console.log('👑 Super Admin detectado - Forçando papel de Administrador');
              setUserRole('admin');
              setUserData({
                uid: user.uid,
                email: currentEmail,
                displayName: user.displayName || 'Super Admin',
                role: 'admin',
                active: true
              });
              
              if (!snap.exists()) {
                setDoc(userRef, {
                  uid: user.uid,
                  orgId: currentOrgId,
                  email: currentEmail,
                  displayName: user.displayName,
                  role: 'admin',
                  active: true,
                  createdAt: serverTimestamp()
                }).catch(console.error);
              }
            } else if (snap.exists()) {
              console.log('👤 Usuário comum detectado - Papel:', snap.data().role);
              setUserRole(snap.data().role);
              setUserData(snap.data());
            } else {
              console.log('⚠️ Usuário não encontrado na organização - Fallback para Atendente');
              setUserRole('agent');
            }
            setIsRoleLoading(false);
          }, (err) => {
            console.error('Erro no snapshot do usuário:', err);
            setIsRoleLoading(false);
          });

          // 3. Training Data
          const configRef = doc(db, 'organizations', currentOrgId, 'settings', 'training');
          unsubscribeConfig = onSnapshot(configRef, (snap) => {
            if (snap.exists()) {
              setTrainingData(snap.data() as any);
            } else {
              fetch('/api/training')
                .then(res => res.json())
                .then(async (data) => {
                  setTrainingData(data);
                  await setDoc(configRef, data);
                }).catch(console.error);
            }
          }, (err) => {
            console.error('Erro no snapshot de treinamento:', err);
          });

          // 4. Welcome Settings
          const welcomeRef = doc(db, 'organizations', currentOrgId, 'settings', 'welcome');
          unsubscribeWelcome = onSnapshot(welcomeRef, (snap) => {
            if (snap.exists()) setWelcomeSettings(snap.data());
          }, (err) => {
            console.error('Erro no snapshot de boas-vindas:', err);
          });
        } else {
          // No org found and not primary admin
          setIsRoleLoading(false);
          toast.error("Você não está vinculado a nenhuma organização.");
        }
      } else {
        setUser(null);
        setOrgId(null);
        if (unsubscribeConfig) unsubscribeConfig();
        if (unsubscribeUser) unsubscribeUser();
        if (unsubscribeWelcome) unsubscribeWelcome();
      }
    });

    return () => {
      unsubscribeAuth();
      if (unsubscribeConfig) unsubscribeConfig();
      if (unsubscribeUser) unsubscribeUser();
      if (unsubscribeWelcome) unsubscribeWelcome();
    };
  }, []);

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
                <Settings user={user} userRole={userRole} orgId={orgId} />
              </motion.div>
            )}
          </AnimatePresence>
        </main>
      </div>
    </div>
  );
}
