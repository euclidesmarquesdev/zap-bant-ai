import React, { useState, useEffect } from 'react';
import { collection, onSnapshot, deleteDoc, doc, updateDoc, query, orderBy, setDoc, getDoc, serverTimestamp } from 'firebase/firestore';
import { db, adminEmail } from '../firebase';
import { Trash2, Phone, User, CheckCircle2, XCircle, Loader2, Shield, UserCog, UserPlus, Copy, ExternalLink } from 'lucide-react';
import { toast } from 'sonner';
import { formatPhoneNumber } from '../lib/utils';

interface TeamManagerProps {
  currentUserEmail?: string | null;
  orgId?: string | null;
}

export default function TeamManager({ currentUserEmail, orgId }: TeamManagerProps) {
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);
  const [newUser, setNewUser] = useState({ email: '', name: '', phone: '', role: 'agent' as 'admin' | 'agent' });
  const [isAdding, setIsAdding] = useState(false);
  const PRIMARY_ADMIN_EMAIL = adminEmail;
  const PORTAL_URL = `${window.location.origin}/login?org=${orgId}`;

  useEffect(() => {
    if (!orgId) return;
    const q = query(collection(db, 'organizations', orgId, 'users'), orderBy('email', 'asc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setUsers(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      setLoading(false);
    });
    return () => unsubscribe();
  }, [orgId]);

  const handleAddUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!orgId) return;
    setIsAdding(true);
    try {
      const tempId = `invited_${Date.now()}`;
      await setDoc(doc(db, 'organizations', orgId, 'users', tempId), {
        email: newUser.email.toLowerCase(),
        displayName: newUser.name,
        phone: newUser.phone.replace(/\D/g, ''),
        role: newUser.role,
        orgId,
        active: true,
        invited: true,
        lastAssignedAt: serverTimestamp(),
        createdAt: serverTimestamp()
      });
      
      toast.success('Convite registrado!');
      setNewUser({ email: '', name: '', phone: '', role: 'agent' });
      setShowAddForm(false);
    } catch (error) {
      toast.error('Erro ao registrar convite.');
    } finally {
      setIsAdding(false);
    }
  };

  const copyPortalUrl = () => {
    navigator.clipboard.writeText(PORTAL_URL);
    toast.success('Link do portal copiado!');
  };

  const toggleUserStatus = async (id: string, currentStatus: boolean, userEmail: string) => {
    if (!orgId) return;
    if (userEmail.toLowerCase() === PRIMARY_ADMIN_EMAIL.toLowerCase()) {
      toast.error('O administrador principal não pode ser desativado.');
      return;
    }
    try {
      await updateDoc(doc(db, 'organizations', orgId, 'users', id), { active: !currentStatus });
      toast.success('Status atualizado!');
    } catch (error) {
      toast.error('Erro ao atualizar status.');
    }
  };

  const changeUserRole = async (id: string, newRole: 'admin' | 'agent', userEmail: string) => {
    if (!orgId) return;
    if (userEmail.toLowerCase() === PRIMARY_ADMIN_EMAIL.toLowerCase()) {
      toast.error('O papel do administrador principal não pode ser alterado.');
      return;
    }
    if (userEmail === currentUserEmail) {
      toast.error('Você não pode alterar seu próprio papel.');
      return;
    }
    try {
      await updateDoc(doc(db, 'organizations', orgId, 'users', id), { role: newRole });
      toast.success(`Papel alterado para ${newRole === 'admin' ? 'Administrador' : 'Atendente'}`);
    } catch (error) {
      toast.error('Erro ao alterar papel.');
    }
  };

  const deleteUser = async (id: string, userEmail: string) => {
    if (!orgId) return;
    if (userEmail.toLowerCase() === PRIMARY_ADMIN_EMAIL.toLowerCase()) {
      toast.error('O administrador principal não pode ser excluído.');
      return;
    }
    if (!confirm('Deseja remover este usuário?')) return;
    try {
      await deleteDoc(doc(db, 'organizations', orgId, 'users', id));
      toast.success('Usuário removido.');
    } catch (error) {
      toast.error('Erro ao remover usuário.');
    }
  };

  return (
    <div className="max-w-5xl mx-auto space-y-8 pb-12">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">Gerenciamento de Equipe</h2>
          <p className="text-slate-500">Gerencie os usuários do sistema, seus papéis e permissões.</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="bg-blue-50 px-4 py-2 rounded-xl border border-blue-100 flex items-center gap-3">
            <div className="text-[10px] font-bold text-blue-600 uppercase tracking-wider">Link do Portal</div>
            <code className="text-xs text-blue-700 bg-white px-2 py-1 rounded border border-blue-200">{PORTAL_URL}</code>
            <button onClick={copyPortalUrl} className="p-1.5 text-blue-600 hover:bg-white rounded-lg transition-all">
              <Copy className="w-4 h-4" />
            </button>
          </div>
          <button 
            onClick={() => setShowAddForm(!showAddForm)}
            className="flex items-center gap-2 px-6 py-2.5 bg-blue-600 text-white font-bold rounded-xl hover:bg-blue-700 transition-all shadow-lg shadow-blue-100"
          >
            <UserPlus className="w-4 h-4" />
            Adicionar Atendente
          </button>
        </div>
      </div>

      {showAddForm && (
        <div className="bg-white p-8 rounded-3xl border border-slate-200 shadow-sm animate-in fade-in slide-in-from-top-4 duration-300">
          <form onSubmit={handleAddUser} className="grid grid-cols-1 md:grid-cols-4 gap-6 items-end">
            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-500 uppercase ml-1">Nome</label>
              <input 
                type="text" 
                required
                value={newUser.name}
                onChange={e => setNewUser({...newUser, name: e.target.value})}
                className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                placeholder="Nome do atendente"
              />
            </div>
            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-500 uppercase ml-1">E-mail</label>
              <input 
                type="email" 
                required
                value={newUser.email}
                onChange={e => setNewUser({...newUser, email: e.target.value})}
                className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                placeholder="atendente@empresa.com"
              />
            </div>
            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-500 uppercase ml-1">WhatsApp</label>
              <input 
                type="text" 
                required
                value={newUser.phone}
                onChange={e => setNewUser({...newUser, phone: e.target.value})}
                className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                placeholder="5511999999999"
              />
            </div>
            <div className="flex gap-2">
              <button 
                type="submit"
                disabled={isAdding}
                className="flex-1 py-2.5 bg-blue-600 text-white font-bold rounded-xl hover:bg-blue-700 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {isAdding ? <Loader2 className="w-4 h-4 animate-spin" /> : <UserPlus className="w-4 h-4" />}
                Registrar
              </button>
              <button 
                type="button"
                onClick={() => setShowAddForm(false)}
                className="px-4 py-2.5 bg-slate-100 text-slate-600 font-bold rounded-xl hover:bg-slate-200 transition-all"
              >
                Cancelar
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-slate-50 text-slate-500 text-xs uppercase tracking-wider">
                <th className="px-6 py-4 font-semibold">Usuário</th>
                <th className="px-6 py-4 font-semibold">Papel</th>
                <th className="px-6 py-4 font-semibold">Status</th>
                <th className="px-6 py-4 font-semibold">WhatsApp</th>
                <th className="px-6 py-4 font-semibold text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center">
                    <Loader2 className="w-8 h-8 animate-spin text-blue-600 mx-auto" />
                  </td>
                </tr>
              ) : users.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center text-slate-400">
                    Nenhum usuário encontrado.
                  </td>
                </tr>
              ) : (
                users.map(user => (
                  <tr key={user.id} className="hover:bg-slate-50 transition-all">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold ${user.role === 'admin' ? 'bg-blue-100 text-blue-600' : 'bg-slate-100 text-slate-600'}`}>
                          {user.displayName?.[0] || user.email?.[0]}
                        </div>
                        <div>
                          <p className="font-bold text-slate-900">{user.displayName || 'Sem Nome'}</p>
                          <p className="text-xs text-slate-500">{user.email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        {user.role === 'admin' ? (
                          <span className="flex items-center gap-1 px-2 py-1 bg-blue-50 text-blue-600 rounded-lg text-[10px] font-bold uppercase tracking-wider">
                            <Shield className="w-3 h-3" />
                            Admin
                          </span>
                        ) : (
                          <span className="flex items-center gap-1 px-2 py-1 bg-slate-50 text-slate-600 rounded-lg text-[10px] font-bold uppercase tracking-wider">
                            <UserCog className="w-3 h-3" />
                            Atendente
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <button 
                        onClick={() => toggleUserStatus(user.id, user.active, user.email)}
                        className={`flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all ${user.active ? 'bg-green-50 text-green-600' : 'bg-red-50 text-red-600'}`}
                      >
                        {user.active ? (
                          <><CheckCircle2 className="w-3 h-3" /> Ativo</>
                        ) : (
                          <><XCircle className="w-3 h-3" /> Inativo</>
                        )}
                      </button>
                    </td>
                    <td className="px-6 py-4 text-sm text-slate-500">
                      {user.phone ? formatPhoneNumber(user.phone) : '-'}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button 
                          onClick={() => changeUserRole(user.id, user.role === 'admin' ? 'agent' : 'admin', user.email)}
                          className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-xl transition-all"
                          title="Alternar Papel"
                        >
                          <UserCog className="w-5 h-5" />
                        </button>
                        <button 
                          onClick={() => deleteUser(user.id, user.email)}
                          className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition-all"
                          title="Excluir Usuário"
                        >
                          <Trash2 className="w-5 h-5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
