import React from 'react';
import { LayoutDashboard, MessageSquare, Users, Bot, BarChart3, Settings, QrCode, Kanban as KanbanIcon, ShieldCheck, CreditCard } from 'lucide-react';
import { cn } from '../lib/utils';

interface SidebarProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  userPhone?: string;
  userRole?: 'admin' | 'agent' | null;
  isSuperAdmin?: boolean;
}

const menuItems = [
  { id: 'super_admin', label: 'Super Admin', icon: ShieldCheck, superAdminOnly: true },
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { id: 'kanban', label: 'BANT Kanban', icon: KanbanIcon },
  { id: 'chat', label: 'Conversas', icon: MessageSquare },
  { id: 'ranking', label: 'Ranking de Leads', icon: BarChart3 },
  { id: 'agents', label: 'Agentes IA', icon: Bot, adminOnly: true },
  { id: 'human_agents', label: 'Gerenciar Equipe', icon: Users, adminOnly: true },
  { id: 'whatsapp', label: 'WhatsApp', icon: QrCode, adminOnly: true },
  { id: 'license', label: 'Licenciamento', icon: CreditCard, adminOnly: true },
];

export default function Sidebar({ activeTab, setActiveTab, userPhone, userRole, isSuperAdmin }: SidebarProps) {
  const filteredItems = menuItems.filter(item => {
    if (item.superAdminOnly) return isSuperAdmin;
    if (item.adminOnly) return userRole === 'admin';
    return true;
  });

  return (
    <aside className="w-64 bg-white border-r border-slate-200 flex flex-col">
      <div className="p-6 flex flex-col gap-1">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center shadow-lg shadow-blue-100 relative">
            <Bot className="text-white w-6 h-6" />
            <div className={cn(
              "absolute -top-1 -right-1 w-3 h-3 rounded-full border-2 border-white",
              userPhone ? "bg-green-500 animate-pulse" : "bg-slate-300"
            )} />
          </div>
          <div className="flex flex-col overflow-hidden">
            <span className="font-bold text-lg text-slate-900 tracking-tight leading-none truncate">
              BANT Agent
            </span>
            <span className="text-[8px] font-bold text-slate-300 uppercase tracking-widest mt-1">
              v2.5.1-SaaS
            </span>
            {isSuperAdmin && localStorage.getItem('isMasterSession') === 'true' && (
              <span className="text-[7px] font-black text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded-full mt-1 w-fit border border-blue-100 uppercase tracking-tighter">
                Sessão Master
              </span>
            )}
          </div>
        </div>
      </div>
      
      <nav className="flex-1 px-4 py-4 space-y-1">
        {filteredItems.map((item) => (
          <button
            key={item.id}
            onClick={() => setActiveTab(item.id)}
            className={cn(
              "w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all",
              activeTab === item.id
                ? "bg-blue-50 text-blue-600 shadow-sm"
                : "text-slate-500 hover:bg-slate-50 hover:text-slate-900"
            )}
          >
            <item.icon className="w-5 h-5" />
            {item.label}
          </button>
        ))}
      </nav>
      
      <div className="p-4 border-t border-slate-100">
        <button 
          onClick={() => setActiveTab('settings')}
          className={cn(
            "w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all",
            activeTab === 'settings'
              ? "bg-blue-50 text-blue-600 shadow-sm"
              : "text-slate-500 hover:bg-slate-50 hover:text-slate-900"
          )}
        >
          <Settings className="w-5 h-5" />
          Configurações
        </button>
      </div>
    </aside>
  );
}
