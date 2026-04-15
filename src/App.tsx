import React, { useState, useEffect } from 'react';
import { auth, googleProvider, db, isValidConfig, adminEmail } from './firebase';
import { signInWithPopup, onAuthStateChanged, User } from 'firebase/auth';
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
import AuthScreen from './components/Auth/AuthScreen';
import { assignLeadToAgent } from './services/assignmentService';
import { LogIn, MessageSquare, LayoutDashboard, Users, Bot, BarChart3, Settings as SettingsIcon } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { toast } from 'sonner';

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [orgId, setOrgId] = useState<string | null>(null);
  const [userRole, setUserRole] = useState<'admin' | 'agent' | null>(null);
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);
  const [userData, setUserData] = useState<any>(null);
  const [welcomeSettings, setWelcomeSettings] = useState<any>(null);
  const [isRoleLoading, setIsRoleLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('dashboard');
  const [selectedLeadId, setSelectedLeadId] = useState<string | null>(null);
  const [trainingData, setTrainingData] = useState({ agentMd: '', shopMd: '' });
  const [processedMessages] = useState(new Set<string>());
  const { qrCode, isReady, userPhone, lastMessage, sendAIResponse, disconnect, setTyping, joinOrg } = useWhatsApp();

  useEffect(() => {
    if (!isValidConfig || !auth) return;

    let unsubscribeConfig: (() => void) | null = null;
    let unsubscribeUser: (() => void) | null = null;
    let unsubscribeWelcome: (() => void) | null = null;

    const unsubscribeAuth = onAuthStateChanged(auth, async (user) => {
      console.log('Auth State Changed:', user?.email);
      if (user) {
        setUser(user);
        
        const currentEmail = user.email?.toLowerCase().trim() || '';
        const primaryAdminEmail = adminEmail.toLowerCase().trim();
        const isPrimaryAdmin = currentEmail === primaryAdminEmail;
        setIsSuperAdmin(isPrimaryAdmin);

        if (isPrimaryAdmin && activeTab === 'dashboard') {
          setActiveTab('super_admin');
        }

        // 1. Fetch User Global Record to get orgId
        const userGlobalRef = doc(db, 'users', user.uid);
        const userGlobalSnap = await getDoc(userGlobalRef);
        
        let currentOrgId = '';

        if (userGlobalSnap.exists()) {
          currentOrgId = userGlobalSnap.data().orgId;
        }

        // If primary admin, ensure they have the master-org and admin role
        if (isPrimaryAdmin) {
          currentOrgId = currentOrgId || 'master-org';
          
          // Update global record
          await setDoc(userGlobalRef, {
            uid: user.uid,
            email: currentEmail,
            orgId: currentOrgId,
            role: 'admin',
            updatedAt: serverTimestamp()
          }, { merge: true });
          
          // Ensure Org exists
          const orgRef = doc(db, 'organizations', currentOrgId);
          const orgSnap = await getDoc(orgRef);
          if (!orgSnap.exists()) {
            await setDoc(orgRef, {
              id: currentOrgId,
              name: 'Master Administration',
              ownerUid: user.uid,
              createdAt: serverTimestamp(),
              active: true
            });
          }

          // Ensure User is Admin in the Org
          const userInOrgRef = doc(db, 'organizations', currentOrgId, 'users', user.uid);
          await setDoc(userInOrgRef, {
            uid: user.uid,
            orgId: currentOrgId,
            email: currentEmail,
            displayName: user.displayName || 'Super Admin',
            role: 'admin',
            active: true,
            updatedAt: serverTimestamp()
          }, { merge: true });
        }

        if (currentOrgId) {
          setOrgId(currentOrgId);
          joinOrg(currentOrgId); // Join socket room

          // 2. Fetch User Data from Org
          const userRef = doc(db, 'organizations', currentOrgId, 'users', user.uid);
          unsubscribeUser = onSnapshot(userRef, (snap) => {
            if (isPrimaryAdmin) {
              setUserRole('admin');
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
              setUserRole(snap.data().role);
              setUserData(snap.data());
            } else {
              // Fallback if not in org users yet
              setUserRole('agent');
            }
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
          });

          // 4. Welcome Settings
          const welcomeRef = doc(db, 'organizations', currentOrgId, 'settings', 'welcome');
          unsubscribeWelcome = onSnapshot(welcomeRef, (snap) => {
            if (snap.exists()) setWelcomeSettings(snap.data());
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

  if (isRoleLoading) {
    return (
      <div className="h-screen flex items-center justify-center bg-slate-50">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 bg-blue-600 rounded-2xl flex items-center justify-center shadow-lg shadow-blue-200">
            <Bot className="text-white w-8 h-8 animate-pulse" />
          </div>
          <p className="text-slate-500 font-medium animate-pulse">Carregando perfil...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-slate-50 overflow-hidden">
      <Sidebar activeTab={activeTab} setActiveTab={setActiveTab} userPhone={userPhone} userRole={userRole} isSuperAdmin={isSuperAdmin} />
      
      <div className="flex-1 flex flex-col overflow-hidden">
        <Header user={user} userPhone={userPhone} userRole={userRole} />
        
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
