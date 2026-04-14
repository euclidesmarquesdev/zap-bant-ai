import React, { useState } from 'react';
import { signInWithEmailAndPassword, createUserWithEmailAndPassword, sendPasswordResetEmail, updateProfile, signInWithPopup } from 'firebase/auth';
import { doc, setDoc, getDoc, serverTimestamp, collection, query, where, getDocs, updateDoc, deleteDoc } from 'firebase/firestore';
import { auth, db, googleProvider, adminEmail } from '../../firebase';
import { Bot, Mail, Lock, User, ArrowRight, Loader2, Sparkles, Chrome } from 'lucide-react';
import { motion } from 'motion/react';
import { toast } from 'sonner';

type AuthMode = 'login' | 'signup' | 'forgot';

export default function AuthScreen() {
  const [mode, setMode] = useState<AuthMode>('login');
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');

  const handleGoogleLogin = async () => {
    setLoading(true);
    try {
      const { user } = await signInWithPopup(auth, googleProvider);
      
      // Check for invited user doc or create new
      const usersRef = collection(db, 'users');
      const q = query(usersRef, where('email', '==', user.email?.toLowerCase()));
      const querySnap = await getDocs(q);
      
      if (!querySnap.empty) {
        // Merge with invited doc
        const invitedDoc = querySnap.docs[0];
        const data = invitedDoc.data();
        
        await setDoc(doc(db, 'users', user.uid), {
          ...data,
          uid: user.uid,
          displayName: user.displayName,
          invited: false,
          updatedAt: serverTimestamp()
        });
        
        if (invitedDoc.id !== user.uid) {
          await deleteDoc(doc(db, 'users', invitedDoc.id));
        }
      } else {
        const userRef = doc(db, 'users', user.uid);
        const userSnap = await getDoc(userRef);
        
        if (!userSnap.exists()) {
          const role = user.email?.toLowerCase() === adminEmail.toLowerCase() ? 'admin' : 'agent';
          await setDoc(userRef, {
            uid: user.uid,
            email: user.email?.toLowerCase(),
            displayName: user.displayName,
            role: role,
            active: true,
            createdAt: serverTimestamp()
          });
        }
      }
      toast.success('Login realizado com sucesso!');
    } catch (error: any) {
      console.error('Google login error:', error);
      if (error.code === 'auth/popup-blocked') {
        toast.error('O popup de login foi bloqueado pelo navegador.');
      } else if (error.code === 'auth/unauthorized-domain') {
        toast.error('Este domínio não está autorizado no Firebase Console.');
      } else {
        toast.error('Erro ao entrar com Google: ' + (error.message || 'Erro desconhecido'));
      }
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      if (mode === 'login') {
        await signInWithEmailAndPassword(auth, email, password);
        toast.success('Bem-vindo de volta!');
      } else if (mode === 'signup') {
        const { user } = await createUserWithEmailAndPassword(auth, email, password);
        await updateProfile(user, { displayName: name });
        
        // Check for invited user doc or create new
        const usersRef = collection(db, 'users');
        const q = query(usersRef, where('email', '==', email.toLowerCase()));
        const querySnap = await getDocs(q);
        
        if (!querySnap.empty) {
          // Merge with invited doc
          const invitedDoc = querySnap.docs[0];
          const data = invitedDoc.data();
          
          await setDoc(doc(db, 'users', user.uid), {
            ...data,
            uid: user.uid,
            displayName: name,
            invited: false,
            updatedAt: serverTimestamp()
          });
          
          if (invitedDoc.id !== user.uid) {
            await deleteDoc(doc(db, 'users', invitedDoc.id));
          }
        } else {
          const role = email.toLowerCase() === adminEmail.toLowerCase() ? 'admin' : 'agent';
          await setDoc(doc(db, 'users', user.uid), {
            uid: user.uid,
            email: user.email?.toLowerCase(),
            displayName: name,
            role: role,
            active: true,
            createdAt: serverTimestamp()
          });
        }
        toast.success('Conta criada com sucesso!');
      } else if (mode === 'forgot') {
        await sendPasswordResetEmail(auth, email);
        toast.success('E-mail de recuperação enviado!');
        setMode('login');
      }
    } catch (error: any) {
      console.error('Auth error:', error);
      toast.error(error.message || 'Erro na autenticação');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="max-w-md w-full bg-white rounded-[2.5rem] shadow-2xl shadow-blue-100/50 border border-slate-100 overflow-hidden"
      >
        <div className="p-10">
          <div className="flex flex-col items-center text-center mb-10">
            <div className="w-16 h-16 bg-blue-600 rounded-2xl flex items-center justify-center shadow-lg shadow-blue-200 mb-6">
              <Bot className="text-white w-10 h-10" />
            </div>
            <h1 className="text-3xl font-bold text-slate-900 tracking-tight">
              {mode === 'login' && 'Bem-vindo'}
              {mode === 'signup' && 'Criar Conta'}
              {mode === 'forgot' && 'Recuperar Senha'}
            </h1>
            <p className="text-slate-500 mt-2 text-sm">
              {mode === 'login' && 'Acesse sua central de atendimento inteligente'}
              {mode === 'signup' && 'Comece a qualificar seus leads com IA'}
              {mode === 'forgot' && 'Enviaremos um link para resetar sua senha'}
            </p>
          </div>

          <div className="space-y-4 mb-8">
            <button 
              onClick={handleGoogleLogin}
              disabled={loading}
              className="w-full py-4 bg-white border border-slate-200 text-slate-700 font-bold rounded-2xl hover:bg-slate-50 transition-all flex items-center justify-center gap-3 shadow-sm disabled:opacity-50"
            >
              <Chrome className="w-5 h-5 text-blue-600" />
              Continuar com Google
            </button>

            <div className="relative flex items-center justify-center">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-slate-100"></div>
              </div>
              <span className="relative px-4 bg-white text-[10px] font-bold text-slate-400 uppercase tracking-widest">Ou use seu e-mail</span>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            {mode === 'signup' && (
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-500 uppercase ml-1">Nome Completo</label>
                <div className="relative">
                  <User className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                  <input 
                    type="text" 
                    required
                    value={name}
                    onChange={e => setName(e.target.value)}
                    className="w-full pl-12 pr-4 py-4 bg-slate-50 border border-slate-200 rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 transition-all"
                    placeholder="Seu nome"
                  />
                </div>
              </div>
            )}

            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-500 uppercase ml-1">E-mail</label>
              <div className="relative">
                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                <input 
                  type="email" 
                  required
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  className="w-full pl-12 pr-4 py-4 bg-slate-50 border border-slate-200 rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 transition-all"
                  placeholder="seu@email.com"
                />
              </div>
            </div>

            {mode !== 'forgot' && (
              <div className="space-y-2">
                <div className="flex justify-between items-center ml-1">
                  <label className="text-xs font-bold text-slate-500 uppercase">Senha</label>
                  {mode === 'login' && (
                    <button 
                      type="button"
                      onClick={() => setMode('forgot')}
                      className="text-[10px] font-bold text-blue-600 hover:underline"
                    >
                      Esqueceu a senha?
                    </button>
                  )}
                </div>
                <div className="relative">
                  <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                  <input 
                    type="password" 
                    required
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    className="w-full pl-12 pr-4 py-4 bg-slate-50 border border-slate-200 rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 transition-all"
                    placeholder="••••••••"
                  />
                </div>
              </div>
            )}

            <button 
              type="submit"
              disabled={loading}
              className="w-full py-4 bg-blue-600 text-white font-bold rounded-2xl hover:bg-blue-700 transition-all shadow-lg shadow-blue-100 flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {loading ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <>
                  {mode === 'login' && 'Entrar'}
                  {mode === 'signup' && 'Criar Conta'}
                  {mode === 'forgot' && 'Enviar Link'}
                  <ArrowRight className="w-5 h-5" />
                </>
              )}
            </button>
          </form>

          <div className="mt-8 pt-8 border-t border-slate-100 text-center">
            {mode === 'login' ? (
              <p className="text-sm text-slate-500">
                Não tem uma conta?{' '}
                <button onClick={() => setMode('signup')} className="font-bold text-blue-600 hover:underline">
                  Cadastre-se
                </button>
              </p>
            ) : (
              <p className="text-sm text-slate-500">
                Já tem uma conta?{' '}
                <button onClick={() => setMode('login')} className="font-bold text-blue-600 hover:underline">
                  Faça login
                </button>
              </p>
            )}
          </div>
        </div>
      </motion.div>
    </div>
  );
}
