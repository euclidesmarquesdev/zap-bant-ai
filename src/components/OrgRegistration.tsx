import React, { useState } from 'react';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase';
import { Building2, ArrowRight, Loader2, Sparkles } from 'lucide-react';
import { motion } from 'motion/react';
import { toast } from 'sonner';

interface OrgRegistrationProps {
  user: any;
  onComplete: (orgId: string) => void;
}

export default function OrgRegistration({ user, onComplete }: OrgRegistrationProps) {
  const [loading, setLoading] = useState(false);
  const [orgName, setOrgName] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      // Gera IDs aleatórios para organização e token de convite
      const characters = 'abcdefghijklmnopqrstuvwxyz0123456789';
      const generateToken = () => {
        let res = '';
        for (let i = 0; i < 16; i++) {
          res += characters.charAt(Math.floor(Math.random() * characters.length));
        }
        return res;
      };

      const orgId = generateToken();
      const inviteToken = generateToken();
      
      // 1. Create Organization
      await setDoc(doc(db, 'organizations', orgId), {
        id: orgId,
        name: orgName,
        ownerUid: user.uid,
        status: 'pending',
        inviteToken,
        active: false,
        plan: 'free',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });

      // 2. Update User Global Record
      await setDoc(doc(db, 'users', user.uid), {
        orgId: orgId,
        role: 'admin',
        updatedAt: serverTimestamp()
      }, { merge: true });

      // 3. Add User to Organization
      await setDoc(doc(db, 'organizations', orgId, 'users', user.uid), {
        uid: user.uid,
        email: user.email,
        displayName: user.displayName,
        role: 'admin',
        active: true,
        createdAt: serverTimestamp()
      });

      toast.success('Organização criada! Aguarde a liberação do Super Admin.');
      onComplete(orgId);
    } catch (error: any) {
      console.error('Error creating org:', error);
      toast.error('Erro ao criar organização: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="max-w-md w-full bg-white rounded-[2.5rem] shadow-2xl shadow-blue-100/50 border border-slate-100 p-10"
      >
        <div className="flex flex-col items-center text-center mb-10">
          <div className="w-16 h-16 bg-blue-600 rounded-2xl flex items-center justify-center shadow-lg shadow-blue-200 mb-6">
            <Building2 className="text-white w-10 h-10" />
          </div>
          <h1 className="text-3xl font-bold text-slate-900 tracking-tight">Crie sua Instância</h1>
          <p className="text-slate-500 mt-2 text-sm">
            Dê um nome para sua organização e comece a automatizar seus atendimentos.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="space-y-2">
            <label className="text-xs font-bold text-slate-500 uppercase ml-1">Nome da Organização</label>
            <input 
              type="text" 
              required
              value={orgName}
              onChange={e => setOrgName(e.target.value)}
              className="w-full px-6 py-4 bg-slate-50 border border-slate-200 rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 transition-all"
              placeholder="Ex: Suprema Vendas"
            />
          </div>

          <button 
            type="submit"
            disabled={loading || !orgName}
            className="w-full py-4 bg-blue-600 text-white font-bold rounded-2xl hover:bg-blue-700 transition-all shadow-lg shadow-blue-100 flex items-center justify-center gap-2 disabled:opacity-50"
          >
            {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : (
              <>
                Criar e Solicitar Acesso
                <ArrowRight className="w-5 h-5" />
              </>
            )}
          </button>
        </form>

        <div className="mt-8 p-4 bg-amber-50 rounded-2xl border border-amber-100 flex gap-3">
          <Sparkles className="w-5 h-5 text-amber-600 shrink-0" />
          <p className="text-[10px] text-amber-700 leading-relaxed">
            Após a criação, sua conta passará por uma breve análise do Super Admin para liberação da licença.
          </p>
        </div>
      </motion.div>
    </div>
  );
}
