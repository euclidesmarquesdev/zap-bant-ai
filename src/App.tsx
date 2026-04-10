import React, { useState, useEffect } from 'react';
import { auth, googleProvider, db } from './firebase';
import { signInWithPopup, onAuthStateChanged, User } from 'firebase/auth';
import { doc, setDoc, getDoc, collection, onSnapshot, query, orderBy, addDoc, updateDoc, serverTimestamp } from 'firebase/firestore';
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
import { LogIn, MessageSquare, LayoutDashboard, Users, Bot, BarChart3, Settings } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [activeTab, setActiveTab] = useState('dashboard');
  const [selectedLeadId, setSelectedLeadId] = useState<string | null>(null);
  const [trainingData, setTrainingData] = useState({ agentMd: '', shopMd: '' });
  const { qrCode, isReady, lastMessage, sendAIResponse } = useWhatsApp();

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        setUser(user);
        // Save user to firestore
        await setDoc(doc(db, 'users', user.uid), {
          uid: user.uid,
          email: user.email,
          displayName: user.displayName,
          role: 'admin' // Default to admin for the first user
        }, { merge: true });
      } else {
        setUser(null);
      }
    });

    // Fetch training data
    fetch('/api/training')
      .then(res => res.json())
      .then(data => setTrainingData(data))
      .catch(err => console.error('Error fetching training data:', err));

    return () => unsubscribe();
  }, []);

  // Process incoming WhatsApp messages with Gemini
  useEffect(() => {
    if (lastMessage && trainingData.agentMd) {
      handleIncomingMessage(lastMessage);
    }
  }, [lastMessage, trainingData]);

  const handleIncomingMessage = async (msg: any) => {
    const leadId = msg.from;
    const leadRef = doc(db, 'leads', leadId);
    const leadSnap = await getDoc(leadRef);

    let history: any[] = [];
    if (leadSnap.exists()) {
      // Fetch recent messages for context
      // For simplicity, we'll just use the last message for now
      // In a real app, you'd fetch the last 5-10 messages
    } else {
      // Create new lead
      await setDoc(leadRef, {
        id: leadId,
        phone: leadId.split('@')[0],
        name: 'Cliente WhatsApp',
        status: 'novo',
        score: 0,
        bant: { budget: false, authority: false, need: false, timeline: false },
        lastMessage: msg.body,
        updatedAt: serverTimestamp()
      });
    }

    // Save message to firestore
    await addDoc(collection(db, 'leads', leadId, 'messages'), {
      text: msg.body,
      sender: 'lead',
      timestamp: serverTimestamp()
    });

    // Process with Gemini
    try {
      const result = await processMessage(msg.body, history, trainingData.agentMd, trainingData.shopMd);
      
      // Update lead status and BANT
      await updateDoc(leadRef, {
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
      });

      // Save AI message to firestore
      await addDoc(collection(db, 'leads', leadId, 'messages'), {
        text: result.response,
        sender: 'ai',
        timestamp: serverTimestamp()
      });

      // Send via WhatsApp
      sendAIResponse(leadId, result.response);
    } catch (error) {
      console.error('Error processing message with Gemini:', error);
    }
  };

  const login = () => signInWithPopup(auth, googleProvider);

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
      <Sidebar activeTab={activeTab} setActiveTab={setActiveTab} />
      
      <div className="flex-1 flex flex-col overflow-hidden">
        <Header user={user} />
        
        <main className="flex-1 overflow-y-auto p-6">
          <AnimatePresence mode="wait">
            {activeTab === 'dashboard' && (
              <motion.div key="dashboard" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
                <Dashboard onSelectLead={(id) => { setSelectedLeadId(id); setActiveTab('chat'); }} />
              </motion.div>
            )}
            {activeTab === 'kanban' && (
              <motion.div key="kanban" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
                <Kanban />
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
                <WhatsAppConnector qrCode={qrCode} isReady={isReady} />
              </motion.div>
            )}
          </AnimatePresence>
        </main>
      </div>
    </div>
  );
}
