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
import { LogIn, MessageSquare, LayoutDashboard, Users, Bot, BarChart3, Settings as SettingsIcon } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { toast } from 'sonner';

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [activeTab, setActiveTab] = useState('dashboard');
  const [selectedLeadId, setSelectedLeadId] = useState<string | null>(null);
  const [trainingData, setTrainingData] = useState({ agentMd: '', shopMd: '' });
  const { qrCode, isReady, userPhone, lastMessage, sendAIResponse, disconnect, setTyping } = useWhatsApp();

  useEffect(() => {
    if (!isValidConfig || !auth) return;

    let unsubscribeConfig: (() => void) | null = null;

    const unsubscribeAuth = onAuthStateChanged(auth, async (user) => {
      if (user) {
        setUser(user);
        // Save user to firestore
        await setDoc(doc(db, 'users', user.uid), {
          uid: user.uid,
          email: user.email,
          displayName: user.displayName,
          role: 'admin' // Default to admin for the first user
        }, { merge: true });

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

    if (leadSnap.exists()) {
      currentLeadData = leadSnap.data();
      
      // Update phone if it was a LID and now we have a real number
      if (msg.from !== leadId && currentLeadData.phone !== msg.from) {
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
        phone: msg.from, // Use the best available number (Phone or LID)
        chatId: msg.chatId || leadId,
        name: msg.pushName || 'Cliente WhatsApp',
        photoUrl: msg.profilePicUrl || '',
        status: 'novo',
        score: 0,
        bant: { budget: false, authority: false, need: false, timeline: false },
        lastMessage: msg.body,
        updatedAt: new Date() // Use local date for immediate context
      };
      await setDoc(leadRef, {
        ...currentLeadData,
        updatedAt: serverTimestamp()
      });
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
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white p-8 rounded-2xl shadow-xl max-w-md w-full text-center"
        >
          <div className="w-20 h-20 bg-blue-600 rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-lg shadow-blue-200">
            <Bot className="text-white w-12 h-12" />
          </div>
          <h1 className="text-3xl font-bold text-slate-900 mb-2">WhatsApp AI Agent</h1>
          <p className="text-slate-500 mb-8">Sistema de vendas consultivas com metodologia BANT e IA.</p>
          <button 
            onClick={login}
            className="w-full flex items-center justify-center gap-3 bg-white border border-slate-200 text-slate-700 font-semibold py-3 px-4 rounded-xl hover:bg-slate-50 transition-all shadow-sm"
          >
            <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" className="w-5 h-5" alt="Google" />
            Entrar com Google
          </button>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-slate-50 overflow-hidden">
      <Sidebar activeTab={activeTab} setActiveTab={setActiveTab} userPhone={userPhone} />
      
      <div className="flex-1 flex flex-col overflow-hidden">
        <Header user={user} userPhone={userPhone} />
        
        <main className="flex-1 overflow-y-auto p-6">
          <AnimatePresence mode="wait">
            {activeTab === 'dashboard' && (
              <motion.div key="dashboard" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
                <Dashboard 
                  userPhone={userPhone}
                  onSelectLead={(id) => { setSelectedLeadId(id); setActiveTab('chat'); }} 
                />
              </motion.div>
            )}
            {activeTab === 'kanban' && (
              <motion.div key="kanban" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
                <Kanban userPhone={userPhone} />
              </motion.div>
            )}
            {activeTab === 'chat' && (
              <motion.div key="chat" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="h-full">
                <Chat selectedLeadId={selectedLeadId} />
              </motion.div>
            )}
            {activeTab === 'ranking' && (
              <motion.div key="ranking" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
                <LeadRanking />
              </motion.div>
            )}
            {activeTab === 'agents' && (
              <motion.div key="agents" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
                <AgentManager />
              </motion.div>
            )}
            {activeTab === 'whatsapp' && (
              <motion.div key="whatsapp" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
                <WhatsAppConnector qrCode={qrCode} isReady={isReady} userPhone={userPhone} onDisconnect={disconnect} />
              </motion.div>
            )}
            {activeTab === 'settings' && (
              <motion.div key="settings" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
                <Settings user={user} />
              </motion.div>
            )}
          </AnimatePresence>
        </main>
      </div>
    </div>
  );
}
