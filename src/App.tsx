import React, { useState, useEffect } from 'react';
import { auth, googleProvider, db, isValidConfig } from './firebase';
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
import AuthScreen from './components/Auth/AuthScreen';
import { LogIn, MessageSquare, LayoutDashboard, Users, Bot, BarChart3, Settings as SettingsIcon } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { toast } from 'sonner';

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [userRole, setUserRole] = useState<'admin' | 'agent' | null>(null);
  const [isRoleLoading, setIsRoleLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('dashboard');
  const [selectedLeadId, setSelectedLeadId] = useState<string | null>(null);
  const [trainingData, setTrainingData] = useState({ agentMd: '', shopMd: '' });
  const { qrCode, isReady, userPhone, lastMessage, sendAIResponse, disconnect, setTyping } = useWhatsApp();

  useEffect(() => {
    if (!isValidConfig || !auth) return;

    let unsubscribeConfig: (() => void) | null = null;
    let unsubscribeUser: (() => void) | null = null;

    const unsubscribeAuth = onAuthStateChanged(auth, async (user) => {
      if (user) {
        setUser(user);
        
        // Fetch user role and data
        const userRef = doc(db, 'users', user.uid);
        unsubscribeUser = onSnapshot(userRef, (snap) => {
          if (snap.exists()) {
            const data = snap.data();
            // Primary admin always has admin role in UI
            if (user.email === "euclidesmarques.dev@gmail.com") {
              setUserRole('admin');
              // Auto-fix if role was changed by mistake
              if (data.role !== 'admin') {
                updateDoc(userRef, { role: 'admin' }).catch(console.error);
              }
            } else {
              setUserRole(data.role);
            }
          } else {
            // If user doc doesn't exist yet, they are likely a new signup
            // The AuthScreen handles creation, but there might be a delay
            setUserRole('agent');
          }
          setIsRoleLoading(false);
        }, (error) => {
          console.error("Error fetching user role:", error);
          setIsRoleLoading(false);
        });

        // Real-time training data from Firestore
        const configRef = doc(db, 'settings', 'training');
        if (unsubscribeConfig) unsubscribeConfig();
        
        unsubscribeConfig = onSnapshot(configRef, (snap) => {
          if (snap.exists()) {
            setTrainingData(snap.data() as any);
          } else {
            // Fallback to API if not in firestore yet
            fetch('/api/training')
              .then(res => res.json())
              .then(async (data) => {
                setTrainingData(data);
                await setDoc(configRef, data);
              })
              .catch(err => console.error('Error fetching training data:', err));
          }
        });
      } else {
        setUser(null);
        if (unsubscribeConfig) {
          unsubscribeConfig();
          unsubscribeConfig = null;
        }
      }
    });

    return () => {
      unsubscribeAuth();
      if (unsubscribeConfig) unsubscribeConfig();
    };
  }, []);

  // Process incoming WhatsApp messages with Gemini
  useEffect(() => {
    if (user && lastMessage && trainingData.agentMd) {
      handleIncomingMessage(lastMessage);
    }
  }, [user, lastMessage, trainingData]);

  const handleIncomingMessage = async (msg: any) => {
    if (!user) return; // Guard against unauthenticated processing

    const leadId = msg.lid || msg.from; // Use LID as stable ID if available
    const leadRef = doc(db, 'leads', leadId);
    const leadSnap = await getDoc(leadRef);

    let history: any[] = [];
    let currentLeadData: any = null;

    // Create or update lead
    if (leadSnap.exists()) {
      currentLeadData = leadSnap.data();
      
      // Update phone if it was a LID and now we have a real number
      // msg.from is the real number extracted by the server
      if (msg.from && msg.from !== leadId && currentLeadData.phone !== msg.from) {
        console.log(`UPDATING LEAD ${leadId} PHONE TO ${msg.from}`);
        await updateDoc(leadRef, { 
          phone: msg.from,
          updatedAt: serverTimestamp()
        });
        currentLeadData.phone = msg.from;
      }

      // Fetch last 10 messages for context
      const messagesRef = collection(db, 'leads', leadId, 'messages');
      const q = query(messagesRef, orderBy('timestamp', 'desc'), limit(10));
      const querySnapshot = await getDocs(q);
      history = querySnapshot.docs
        .map(doc => ({
          role: doc.data().sender === 'lead' ? 'user' : 'model',
          content: doc.data().text
        }))
        .reverse();
    } else {
      // Create new lead
      currentLeadData = {
        id: leadId,
        phone: msg.from, 
        chatId: msg.chatId || leadId,
        name: msg.pushName || 'Cliente WhatsApp',
        photoUrl: msg.profilePicUrl || '',
        status: 'novo',
        score: 0,
        bant: { budget: false, authority: false, need: false, timeline: false },
        lastMessage: msg.body,
        updatedAt: new Date() 
      };
      await setDoc(leadRef, {
        ...currentLeadData,
        updatedAt: serverTimestamp()
      });

      // SEND WELCOME MESSAGE
      const welcomeRef = doc(db, 'settings', 'welcome');
      const welcomeSnap = await getDoc(welcomeRef);
      if (welcomeSnap.exists()) {
        const welcome = welcomeSnap.data();
        if (welcome.text || (welcome.mediaUrl && welcome.mediaType !== 'none')) {
          await fetch('/api/whatsapp/send', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
              to: msg.chatId || leadId, 
              message: welcome.text,
              mediaUrl: welcome.mediaUrl,
              mediaType: welcome.mediaType,
              fileName: welcome.fileName
            })
          });
          
          // Save welcome message to firestore
          await addDoc(collection(db, 'leads', leadId, 'messages'), {
            text: welcome.text || `[Mídia: ${welcome.mediaType}]`,
            sender: 'ai',
            timestamp: serverTimestamp()
          });
        }
      }
    }

    // Update photo if changed
    if (msg.profilePicUrl) {
      await updateDoc(leadRef, { photoUrl: msg.profilePicUrl });
    }

    // Save message to firestore
    await addDoc(collection(db, 'leads', leadId, 'messages'), {
      text: msg.body,
      sender: 'lead',
      timestamp: serverTimestamp()
    });

    // Process with Gemini
    try {
      const userDoc = await getDoc(doc(db, 'users', user!.uid));
      const userApiKey = userDoc.exists() ? userDoc.data().geminiApiKey : undefined;

      // START TYPING STATUS
      setTyping(msg.chatId || leadId, 'composing');

      const result = await processMessage(
        msg.body, 
        history, 
        trainingData.agentMd, 
        trainingData.shopMd,
        currentLeadData,
        userApiKey
      );
      
      // Update lead status and BANT
      const updateData: any = {
        status: result.status,
        score: result.leadScore,
        bant: {
          budget: result.budget,
          authority: result.authority,
          need: result.need,
          timeline: result.timeline
        },
        lastMessage: result.response,
        updatedAt: serverTimestamp()
      };

      if (result.name) {
        updateData.name = result.name;
      }

      await updateDoc(leadRef, updateData);

      // HUMAN AGENT DISTRIBUTION
      if (result.status === 'humano' && currentLeadData.status !== 'humano') {
        const usersRef = collection(db, 'users');
        const q = query(usersRef, orderBy('lastAssignedAt', 'asc'), limit(10));
        const usersSnap = await getDocs(q);
        const availableAgents = usersSnap.docs
          .map(doc => ({ id: doc.id, ...doc.data() }))
          .filter((a: any) => a.active && a.role === 'agent');

        if (availableAgents.length > 0) {
          const selectedAgent: any = availableAgents[0];
          
          // Assign lead to agent in system
          await updateDoc(leadRef, {
            assignedTo: selectedAgent.id
          });

          // Notify the agent (if they have a phone registered)
          if (selectedAgent.phone) {
            const agentMsg = `🚨 *NOVO LEAD QUALIFICADO*\n\nO robô identificou que o cliente *${currentLeadData.name}* precisa de atendimento humano.\n\n*Score:* ${result.leadScore}\n*BANT:* ${Object.entries(updateData.bant).filter(([_, v]) => v).map(([k]) => k.toUpperCase()).join(', ')}\n\nPor favor, acesse o painel para assumir o atendimento.`;
            
            await fetch('/api/whatsapp/send', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ 
                to: selectedAgent.phone, 
                message: agentMsg,
                contact: {
                  name: currentLeadData.name,
                  phone: msg.from 
                }
              })
            });
          }

          // Update agent last assigned time
          await updateDoc(doc(db, 'users', selectedAgent.id), {
            lastAssignedAt: serverTimestamp()
          });

          toast.info(`Lead encaminhado para ${selectedAgent.displayName || selectedAgent.name}`);
        }
      }

      // Get the correct chat ID for reply
      const currentLeadSnap = await getDoc(leadRef);
      const targetChatId = currentLeadSnap.data()?.chatId || leadId;

      // Save AI message to firestore
      await addDoc(collection(db, 'leads', leadId, 'messages'), {
        text: result.response,
        sender: 'ai',
        timestamp: serverTimestamp()
      });

      // Send via WhatsApp
      sendAIResponse(targetChatId, result.response);
    } catch (error: any) {
      console.error('Error processing message with Gemini:', error);
      if (error.message?.includes("GEMINI_API_KEY") || error.message?.includes("Autenticação")) {
        toast.error(error.message);
      } else {
        toast.error("Erro ao processar mensagem com a IA. Verifique os logs.");
      }
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
      <Sidebar activeTab={activeTab} setActiveTab={setActiveTab} userPhone={userPhone} userRole={userRole} />
      
      <div className="flex-1 flex flex-col overflow-hidden">
        <Header user={user} userPhone={userPhone} userRole={userRole} />
        
        <main className="flex-1 overflow-y-auto p-6">
          <AnimatePresence mode="wait">
            {activeTab === 'dashboard' && (
              <motion.div key="dashboard" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
                <Dashboard 
                  userPhone={userPhone}
                  userRole={userRole}
                  userId={user.uid}
                  onSelectLead={(id) => { setSelectedLeadId(id); setActiveTab('chat'); }} 
                />
              </motion.div>
            )}
            {activeTab === 'kanban' && (
              <motion.div key="kanban" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
                <Kanban userPhone={userPhone} userRole={userRole} userId={user.uid} />
              </motion.div>
            )}
            {activeTab === 'chat' && (
              <motion.div key="chat" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="h-full">
                <Chat selectedLeadId={selectedLeadId} userRole={userRole} userId={user.uid} />
              </motion.div>
            )}
            {activeTab === 'ranking' && (
              <motion.div key="ranking" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
                <LeadRanking userRole={userRole} userId={user.uid} />
              </motion.div>
            )}
            {activeTab === 'agents' && userRole === 'admin' && (
              <motion.div key="agents" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
                <AgentManager />
              </motion.div>
            )}
            {activeTab === 'human_agents' && userRole === 'admin' && (
              <motion.div key="human_agents" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
                <TeamManager currentUserEmail={user.email} />
              </motion.div>
            )}
            {activeTab === 'whatsapp' && userRole === 'admin' && (
              <motion.div key="whatsapp" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
                <WhatsAppConnector qrCode={qrCode} isReady={isReady} userPhone={userPhone} onDisconnect={disconnect} />
              </motion.div>
            )}
            {activeTab === 'settings' && (
              <motion.div key="settings" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
                <Settings user={user} userRole={userRole} />
              </motion.div>
            )}
          </AnimatePresence>
        </main>
      </div>
    </div>
  );
}
