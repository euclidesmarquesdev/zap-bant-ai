import React from 'react';
import { ShieldAlert, Clock, LogOut, MessageCircle } from 'lucide-react';
import { motion } from 'motion/react';
import { auth } from '../firebase';
import { signOut } from 'firebase/auth';

export default function WaitingApproval() {
  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6 text-center">
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="max-w-md w-full bg-white rounded-[2.5rem] shadow-2xl shadow-blue-100/50 border border-slate-100 p-10 space-y-8"
      >
        <div className="flex flex-col items-center">
          <div className="w-20 h-20 bg-amber-100 rounded-full flex items-center justify-center mb-6 relative">
            <Clock className="text-amber-600 w-10 h-10 animate-pulse" />
            <div className="absolute -top-1 -right-1 w-6 h-6 bg-amber-500 rounded-full border-4 border-white flex items-center justify-center">
              <ShieldAlert className="text-white w-3 h-3" />
            </div>
          </div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight">Aguardando Liberação</h1>
          <p className="text-slate-500 mt-2 text-sm leading-relaxed">
            Sua organização foi criada com sucesso! Agora o **Super Admin** precisa ativar sua licença para que você possa acessar o painel completo.
          </p>
        </div>

        <div className="bg-slate-50 p-6 rounded-3xl border border-slate-100 space-y-4">
          <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">O que acontece agora?</p>
          <ul className="text-left space-y-3">
            <li className="flex gap-3 text-xs text-slate-600">
              <div className="w-5 h-5 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center shrink-0 font-bold">1</div>
              O Super Admin receberá sua solicitação.
            </li>
            <li className="flex gap-3 text-xs text-slate-600">
              <div className="w-5 h-5 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center shrink-0 font-bold">2</div>
              Sua licença será ativada manualmente.
            </li>
            <li className="flex gap-3 text-xs text-slate-600">
              <div className="w-5 h-5 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center shrink-0 font-bold">3</div>
              Você receberá acesso total ao dashboard.
            </li>
          </ul>
        </div>

        <div className="flex flex-col gap-3">
          <button 
            onClick={() => window.location.reload()}
            className="w-full py-4 bg-blue-600 text-white font-bold rounded-2xl hover:bg-blue-700 transition-all shadow-lg shadow-blue-100"
          >
            Verificar Status
          </button>
          <button 
            onClick={() => signOut(auth)}
            className="w-full py-4 bg-white border border-slate-200 text-slate-600 font-bold rounded-2xl hover:bg-slate-50 transition-all flex items-center justify-center gap-2"
          >
            <LogOut className="w-4 h-4" />
            Sair da Conta
          </button>
        </div>

        <p className="text-[10px] text-slate-400">
          Dúvidas? Entre em contato com o suporte global.
        </p>
      </motion.div>
    </div>
  );
}
