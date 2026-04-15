import React from 'react';
import { User } from 'firebase/auth';
import { Bell, Search, LogOut } from 'lucide-react';
import { auth } from '../firebase';
import { toast } from 'sonner';

interface HeaderProps {
  user: User;
  userPhone?: string;
  userRole?: 'admin' | 'agent' | null;
}

export default function Header({ user, userPhone, userRole }: HeaderProps) {
  return (
    <header className="h-20 bg-white border-bottom border-slate-200 px-8 flex items-center justify-between">
      <div className="flex-1 max-w-xl">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-5 h-5" />
          <input 
            type="text" 
            placeholder="Pesquisar leads, conversas..." 
            className="w-full pl-11 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 transition-all"
          />
        </div>
      </div>
      
      <div className="flex items-center gap-6">
        <button className="relative text-slate-500 hover:text-slate-900 transition-all">
          <Bell className="w-6 h-6" />
          <span className="absolute top-0 right-0 w-2 h-2 bg-red-500 rounded-full border-2 border-white"></span>
        </button>
        
        <div className="flex items-center gap-3 pl-6 border-l border-slate-200">
          <div className="text-right">
            <p className="text-sm font-semibold text-slate-900">{user.displayName || user.email}</p>
            <div className="flex flex-col items-end">
              <p className="text-xs font-medium text-blue-600">
                {userRole === 'admin' ? 'Administrador' : 'Atendente'}
              </p>
              {userPhone && (
                <span className="text-[10px] font-bold text-green-600 flex items-center gap-1">
                  <div className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse" />
                  +{userPhone}
                </span>
              )}
            </div>
          </div>
          <img 
            src={user.photoURL || `https://ui-avatars.com/api/?name=${user.displayName || user.email}`} 
            className="w-10 h-10 rounded-full border-2 border-slate-100"
            alt={user.displayName || 'User'}
          />
          <button 
            onClick={async () => {
              try {
                await auth.signOut();
                toast.success('Sessão encerrada com sucesso');
              } catch (error) {
                console.error('Erro ao sair:', error);
                toast.error('Erro ao encerrar sessão');
              }
            }}
            className="p-2 text-slate-400 hover:text-red-500 transition-all"
            title="Sair da conta"
          >
            <LogOut className="w-5 h-5" />
          </button>
        </div>
      </div>
    </header>
  );
}
