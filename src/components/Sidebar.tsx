import React from 'react';
import { LayoutDashboard, MessageSquare, Users, Bot, BarChart3, Settings, QrCode, Kanban as KanbanIcon } from 'lucide-react';
import { cn } from '../lib/utils';

interface SidebarProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
}

const menuItems = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { id: 'kanban', label: 'BANT Kanban', icon: KanbanIcon },
  { id: 'chat', label: 'Conversas', icon: MessageSquare },
  { id: 'ranking', label: 'Ranking de Leads', icon: BarChart3 },
  { id: 'agents', label: 'Agentes IA', icon: Bot },
  { id: 'whatsapp', label: 'WhatsApp', icon: QrCode },
];

export default function Sidebar({ activeTab, setActiveTab }: SidebarProps) {
  return (
    <aside className="w-64 bg-white border-r border-slate-200 flex flex-col">
      <div className="p-6 flex items-center gap-3">
        <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center shadow-lg shadow-blue-100">
          <Bot className="text-white w-6 h-6" />
        </div>
        <span className="font-bold text-xl text-slate-900 tracking-tight">BANT Agent</span>
      </div>
      
      <nav className="flex-1 px-4 py-4 space-y-1">
        {menuItems.map((item) => (
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
        <button className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium text-slate-500 hover:bg-slate-50 hover:text-slate-900 transition-all">
          <Settings className="w-5 h-5" />
          Configurações
        </button>
      </div>
    </aside>
  );
}
