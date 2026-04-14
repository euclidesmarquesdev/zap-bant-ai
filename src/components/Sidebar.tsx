import React from 'react';
import { LayoutDashboard, MessageSquare, Users, Bot, BarChart3, Settings, QrCode, Kanban as KanbanIcon } from 'lucide-react';
import { cn } from '../lib/utils';

interface SidebarProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  userPhone?: string;
  userRole?: 'admin' | 'agent' | null;
}

const menuItems = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { id: 'kanban', label: 'BANT Kanban', icon: KanbanIcon },
  { id: 'chat', label: 'Conversas', icon: MessageSquare },
  { id: 'ranking', label: 'Ranking de Leads', icon: BarChart3 },
  { id: 'agents', label: 'Agentes IA', icon: Bot, adminOnly: true },
  { id: 'human_agents', label: 'Gerenciar Equipe', icon: Users, adminOnly: true },
  { id: 'whatsapp', label: 'WhatsApp', icon: QrCode, adminOnly: true },
];

export default function Sidebar({ activeTab, setActiveTab, userPhone, userRole }: SidebarProps) {
  const filteredItems = menuItems.filter(item => !item.adminOnly || userRole === 'admin');

  return (
    <aside className="w-64 bg-white border-r border-slate-200 flex flex-col">
      <div className="p-6 flex flex-col gap-1">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center shadow-lg shadow-blue-100">
            <Bot className="text-white w-6 h-6" />
          </div>
          <div className="flex flex-col overflow-hidden">
            <span className="font-bold text-lg text-slate-900 tracking-tight leading-none truncate">
              {userPhone ? `+${userPhone}` : 'BANT Agent'}
            </span>
            {userPhone && <span className="text-[10px] text-green-600 font-bold uppercase tracking-widest mt-0.5">Conectado</span>}
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
