import React, { useState } from 'react';
import { 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword, 
  sendPasswordResetEmail, 
  updateProfile, 
  signInWithPopup,
  signInWithRedirect,
  getRedirectResult,
  browserLocalPersistence,
  setPersistence
} from 'firebase/auth';
import { doc, setDoc, getDoc, serverTimestamp, collection, query, where, getDocs, updateDoc, deleteDoc } from 'firebase/firestore';
import { auth, db, googleProvider } from '../../firebase';
import { Bot, Mail, Lock, User, ArrowRight, Loader2, Sparkles, Chrome, Shield, ShieldAlert } from 'lucide-react';
import { motion } from 'motion/react';
import { toast } from 'sonner';

type AuthMode = 'login' | 'signup' | 'forgot' | 'superadmin';

export default function AuthScreen() {
  const [mode, setMode] = useState<AuthMode>('login');
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [superAdminUser, setSuperAdminUser] = useState('');
  const [superAdminPass, setSuperAdminPass] = useState('');
  const [isMasterSession] = useState(localStorage.getItem('isMasterSession') === 'true');

  const handleGoogleLogin = async (useRedirect = false) => {
    console.log('🔴 [AUTH_SCREEN] Click Google. Redirect:', useRedirect);
    setLoading(true);
    try {
      // Garantir persistência local antes do login
      await setPersistence(auth, browserLocalPersistence);
      
      if (useRedirect || window.self !== window.top) {
        console.log('📡 [AUTH_SCREEN] Usando Redirect (mais seguro para iframes)');
        await signInWithRedirect(auth, googleProvider);
        return;
      }
      
      console.log('📡 [AUTH_SCREEN] Usando Popup');
      const result = await signInWithPopup(auth, googleProvider);
      console.log('✅ [AUTH_SCREEN] Popup concluído:', result.user.email);
      toast.success('Login concluído!');
    } catch (error: any) {
      console.error('❌ [AUTH_SCREEN] Erro fatal no login:', error.code, error.message);
      
      if (error.code === 'auth/popup-blocked' || error.code === 'auth/cancelled-popup-request') {
        toast.info('Popup bloqueado. Tentando redirecionamento...');
        await signInWithRedirect(auth, googleProvider);
      } else {
        toast.error('Erro ao entrar com Google: ' + error.message);
      }
    } finally {
      if (!useRedirect) setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      if (mode === 'superadmin') {
        const res = await fetch('/api/super-admin/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            username: superAdminUser.trim(), 
            password: superAdminPass.trim() 
          })
        });
        const data = await res.json();
        if (data.success) {
          console.log('Master Login Success! Setting localStorage...');
          localStorage.setItem('isMasterSession', 'true');
          toast.success('Sessão Master Ativada! Agora entre com sua conta Google para assumir o controle global.');
          setMode('login');
          // Force reload to pick up the new session state in App.tsx
          setTimeout(() => window.location.reload(), 2000);
        } else {
          toast.error(data.error);
        }
        return;
      }

      if (mode === 'login') {
        await signInWithEmailAndPassword(auth, email, password);
        toast.success('Bem-vindo de volta!');
      } else if (mode === 'signup') {
        const { user } = await createUserWithEmailAndPassword(auth, email, password);
        const currentEmail = email.toLowerCase().trim();

        await updateProfile(user, { displayName: name });
        
        // Check for invited user doc or create new
        const usersRef = collection(db, 'users');
        const q = query(usersRef, where('email', '==', currentEmail));
        
        try {
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
            const role = 'agent';
            await setDoc(doc(db, 'users', user.uid), {
              uid: user.uid,
              email: currentEmail,
              displayName: name,
              role: role,
              active: true,
              createdAt: serverTimestamp()
            });
          }
        } catch (dbError) {
          console.error('Database error during signup:', dbError);
          throw dbError;
        }
        toast.success('Conta criada com sucesso!');
      } else if (mode === 'forgot') {
        await sendPasswordResetEmail(auth, email);
        toast.success('E-mail de recuperação enviado!');
        setMode('login');
      }
    } catch (error: any) {
      console.error('Auth error:', error);
      if (error.code === 'auth/popup-closed-by-user') {
        toast.error(
          <div className="flex flex-col gap-2">
            <span>A janela de login foi fechada.</span>
            <button 
              onClick={() => window.open(window.location.href, '_blank')}
              className="text-[10px] bg-white text-slate-900 px-2 py-1 rounded font-bold border border-slate-200"
            >
              ABRIR EM NOVA ABA
            </button>
          </div>
        );
      } else if (error.code === 'auth/network-request-failed') {
        toast.error(
          <div className="flex flex-col gap-2">
            <span className="font-bold">Erro de Rede (Network Error)</span>
            <p className="text-[10px] leading-relaxed">
              O Firebase não conseguiu se comunicar com os servidores de autenticação. 
              Isso geralmente acontece por:
            </p>
            <ul className="text-[10px] list-disc ml-4 space-y-1">
              <li>Domínio não autorizado no Firebase Console</li>
              <li>Bloqueador de anúncios (AdBlock) ativado</li>
              <li>Rede corporativa/Firewall bloqueando o Firebase</li>
            </ul>
            <button 
              onClick={() => window.open('https://console.firebase.google.com/', '_blank')}
              className="mt-2 text-[10px] bg-blue-600 text-white px-2 py-1 rounded font-bold"
            >
              CONFIGURAR DOMÍNIOS NO CONSOLE
            </button>
          </div>,
          { duration: 10000 }
        );
      } else if (error.code === 'auth/operation-not-allowed') {
        toast.error('O login por E-mail/Senha está desativado no seu Firebase Console. Ative-o ou use o Google Login.');
      } else {
        toast.error(error.message || 'Erro na autenticação');
      }
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
            <div className="w-16 h-16 bg-blue-600 rounded-2xl flex items-center justify-center shadow-lg shadow-blue-200 mb-6 relative">
              <Bot className="text-white w-10 h-10" />
              {isMasterSession && (
                <div className="absolute -top-2 -right-2 w-6 h-6 bg-slate-900 rounded-full flex items-center justify-center border-2 border-white shadow-sm">
                  <Shield className="w-3 h-3 text-blue-400" />
                </div>
              )}
            </div>
            <h1 className="text-3xl font-bold text-slate-900 tracking-tight">
              {isMasterSession ? 'Sessão Master' : (
                <>
                  {mode === 'login' && 'Bem-vindo'}
                  {mode === 'signup' && 'Criar Conta'}
                  {mode === 'forgot' && 'Recuperar Senha'}
                </>
              )}
            </h1>
            <p className="text-slate-500 mt-2 text-sm">
              {isMasterSession 
                ? 'Identidade master validada. Entre com seu Google para assumir o controle.' 
                : (
                  <>
                    {mode === 'login' && 'Acesse sua central de atendimento inteligente'}
                    {mode === 'signup' && 'Comece a qualificar seus leads com IA'}
                    {mode === 'forgot' && 'Enviaremos um link para resetar sua senha'}
                  </>
                )
              }
            </p>
          </div>

          <div className="space-y-4 mb-8">
            {isMasterSession ? (
              <div className="space-y-4">
                <button 
                  onClick={() => handleGoogleLogin(false)}
                  disabled={loading}
                  className="w-full py-5 bg-slate-900 text-white font-bold rounded-2xl hover:bg-black transition-all flex items-center justify-center gap-3 shadow-xl shadow-slate-200 disabled:opacity-50 group"
                >
                  {loading ? (
                    <Loader2 className="w-5 h-5 animate-spin" />
                  ) : (
                    <>
                      <Chrome className="w-5 h-5 text-blue-400 group-hover:scale-110 transition-transform" />
                      ENTRAR COMO SUPER ADMIN
                    </>
                  )}
                </button>
                
                <button 
                  onClick={() => handleGoogleLogin(true)}
                  disabled={loading}
                  className="w-full text-[10px] text-blue-600 hover:text-blue-800 font-bold flex items-center justify-center gap-1"
                >
                  Problemas com o login? Tente por redirecionamento
                </button>
              </div>
            ) : (
              <button 
                type="button"
                onClick={() => {
                  console.log('🔴 [AUTH_SCREEN] Botão Google Clicado!');
                  handleGoogleLogin(false);
                }}
                disabled={loading}
                className="w-full py-4 bg-white border border-slate-200 text-slate-700 font-bold rounded-2xl hover:bg-slate-50 transition-all flex items-center justify-center gap-3 shadow-sm disabled:opacity-50"
              >
                <Chrome className="w-5 h-5 text-blue-600" />
                Continuar com Google
              </button>
            )}

            <div className="relative flex items-center justify-center">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-slate-100"></div>
              </div>
              <span className="relative px-4 bg-white text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                {isMasterSession ? 'Ou mude de conta' : 'Ou use seu e-mail'}
              </span>
            </div>
          </div>

            {mode === 'superadmin' && (
              <form onSubmit={handleSubmit} className="space-y-6">
                <div className="p-4 bg-slate-900 rounded-2xl border border-slate-800 space-y-2">
                  <h3 className="text-white font-bold text-sm flex items-center gap-2">
                    <Shield className="w-4 h-4 text-blue-400" />
                    Painel de Controle Master
                  </h3>
                  <p className="text-[10px] text-slate-400 leading-relaxed">
                    Acesso restrito para administradores globais do sistema.
                    <br />
                    <span className="text-blue-400 font-mono">superadmin@email.com / admin123</span>
                  </p>
                </div>

                <div className="space-y-4">
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-slate-500 uppercase ml-1">E-mail Master</label>
                    <input 
                      type="email" 
                      required
                      value={superAdminUser}
                      onChange={e => setSuperAdminUser(e.target.value)}
                      className="w-full px-6 py-4 bg-slate-50 border border-slate-200 rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-slate-900/10 transition-all font-mono"
                      placeholder="seu@email.com"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-slate-500 uppercase ml-1">Senha Master</label>
                    <input 
                      type="password" 
                      required
                      value={superAdminPass}
                      onChange={e => setSuperAdminPass(e.target.value)}
                      className="w-full px-6 py-4 bg-slate-50 border border-slate-200 rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-slate-900/10 transition-all"
                      placeholder="••••••••"
                    />
                  </div>
                  <button 
                    type="submit"
                    disabled={loading}
                    className="w-full py-4 bg-slate-900 text-white font-bold rounded-2xl hover:bg-black transition-all shadow-xl flex items-center justify-center gap-2 disabled:opacity-50"
                  >
                    {loading ? (
                      <Loader2 className="w-5 h-5 animate-spin" />
                    ) : (
                      <>
                        <Shield className="w-5 h-5" />
                        Validar Credenciais Master
                      </>
                    )}
                  </button>
                  <button 
                    type="button"
                    onClick={() => setMode('login')}
                    className="w-full text-xs text-slate-400 hover:text-slate-600 font-bold"
                  >
                    Voltar para Login Comum
                  </button>
                </div>
              </form>
            )}

            {mode !== 'superadmin' && (
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
            )}

          <div className="mt-8 pt-8 border-t border-slate-100 text-center space-y-4">
            {mode === 'login' ? (
              <p className="text-sm text-slate-500">
                Não tem uma conta?{' '}
                <button onClick={() => setMode('signup')} className="font-bold text-blue-600 hover:underline">
                  Cadastre-se
                </button>
              </p>
            ) : mode !== 'superadmin' ? (
              <p className="text-sm text-slate-500">
                Já tem uma conta?{' '}
                <button onClick={() => setMode('login')} className="font-bold text-blue-600 hover:underline">
                  Faça login
                </button>
              </p>
            ) : null}

            {mode !== 'superadmin' && (
              <div className="flex flex-col gap-4">
                <button 
                  onClick={() => setMode('superadmin')}
                  className="group relative w-full py-3 bg-slate-50 border border-slate-200 rounded-2xl text-[10px] font-bold text-slate-400 hover:text-slate-900 hover:border-slate-900 transition-all flex items-center justify-center gap-2 overflow-hidden"
                >
                  <Shield className="w-3 h-3" />
                  PAINEL DE CONTROLE MASTER
                  <div className="absolute inset-0 bg-slate-900 translate-y-full group-hover:translate-y-0 transition-transform duration-300 -z-10" />
                </button>
              </div>
            )}
          </div>
        </div>
      </motion.div>
    </div>
  );
}
