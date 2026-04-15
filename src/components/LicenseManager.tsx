import React, { useState, useEffect } from 'react';
import { doc, onSnapshot, updateDoc, Timestamp } from 'firebase/firestore';
import { db } from '../firebase';
import { 
  CreditCard, 
  CheckCircle2, 
  Zap, 
  ShieldCheck, 
  Crown, 
  ArrowRight, 
  Loader2,
  AlertCircle,
  Calendar,
  Clock
} from 'lucide-react';
import { motion } from 'motion/react';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface LicenseManagerProps {
  orgId: string;
}

const PLANS = [
  {
    id: 'basic',
    name: 'Plano Basic',
    price: '97',
    description: 'Ideal para pequenos negócios começando na automação.',
    features: [
      'Até 500 leads/mês',
      '1 Agente IA personalizado',
      'Dashboard BANT básico',
      'Suporte via E-mail'
    ],
    color: 'blue'
  },
  {
    id: 'pro',
    name: 'Plano Pro',
    price: '197',
    description: 'Para empresas que buscam escala e alta performance.',
    features: [
      'Leads Ilimitados',
      'Até 5 Agentes IA',
      'Kanban Avançado',
      'Suporte Prioritário',
      'Integração com CRM'
    ],
    color: 'purple',
    popular: true
  },
  {
    id: 'enterprise',
    name: 'Plano Enterprise',
    price: '497',
    description: 'Solução completa para grandes operações de vendas.',
    features: [
      'Tudo do Pro',
      'Agentes Ilimitados',
      'API de Integração',
      'Gerente de Conta Dedicado',
      'SLA de 99.9%'
    ],
    color: 'amber'
  }
];

export default function LicenseManager({ orgId }: LicenseManagerProps) {
  const [orgData, setOrgData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [upgrading, setUpgrading] = useState<string | null>(null);

  useEffect(() => {
    if (!orgId) return;
    const unsubscribe = onSnapshot(doc(db, 'organizations', orgId), (snap) => {
      if (snap.exists()) {
        setOrgData(snap.data());
      }
      setLoading(false);
    });
    return () => unsubscribe();
  }, [orgId]);

  const handleUpgrade = async (planId: string) => {
    setUpgrading(planId);
    try {
      // Simulação de integração com Stripe
      // Em um cenário real, aqui chamaríamos uma API para criar um Checkout Session
      await new Promise(resolve => setTimeout(resolve, 1500));
      
      await updateDoc(doc(db, 'organizations', orgId), {
        plan: planId,
        subscriptionStatus: 'active',
        nextBillingDate: Timestamp.fromDate(new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)),
        updatedAt: Timestamp.now()
      });
      
      toast.success(`Plano ${planId.toUpperCase()} ativado com sucesso!`);
    } catch (error) {
      console.error('Erro ao atualizar plano:', error);
      toast.error('Erro ao processar assinatura.');
    } finally {
      setUpgrading(null);
    }
  };

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    );
  }

  const currentPlan = orgData?.plan || 'free';
  const status = orgData?.subscriptionStatus || 'inactive';

  return (
    <div className="max-w-6xl mx-auto space-y-12 pb-12">
      <div className="text-center space-y-4">
        <h2 className="text-4xl font-black text-slate-900 tracking-tight">Licenciamento e Planos</h2>
        <p className="text-slate-500 max-w-2xl mx-auto">
          Escolha o plano ideal para o seu volume de vendas e potencialize seus resultados com nossa IA.
        </p>
      </div>

      {/* Current Status Banner */}
      <div className={`p-6 rounded-3xl border flex flex-col md:flex-row items-center justify-between gap-6 ${
        status === 'active' ? 'bg-green-50 border-green-100' : 'bg-amber-50 border-amber-100'
      }`}>
        <div className="flex items-center gap-4">
          <div className={`w-14 h-14 rounded-2xl flex items-center justify-center ${
            status === 'active' ? 'bg-green-600 text-white' : 'bg-amber-600 text-white'
          }`}>
            {status === 'active' ? <ShieldCheck className="w-8 h-8" /> : <AlertCircle className="w-8 h-8" />}
          </div>
          <div>
            <h3 className="text-lg font-bold text-slate-900">
              Assinatura {status === 'active' ? 'Ativa' : 'Pendente'}
            </h3>
            <p className="text-sm text-slate-600">
              Você está no plano <span className="font-bold uppercase text-blue-600">{currentPlan}</span>
            </p>
          </div>
        </div>

        {orgData?.nextBillingDate && (
          <div className="flex items-center gap-6">
            <div className="text-right">
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Próximo Vencimento</p>
              <p className="text-sm font-bold text-slate-900">
                {format(orgData.nextBillingDate.toDate(), "dd 'de' MMMM, yyyy", { locale: ptBR })}
              </p>
            </div>
            <div className="h-10 w-px bg-slate-200 hidden md:block"></div>
            <div className="text-right">
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Valor Mensal</p>
              <p className="text-sm font-bold text-slate-900">
                R$ {PLANS.find(p => p.id === currentPlan)?.price || '0'},00
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Plans Comparison */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        {PLANS.map((plan) => (
          <motion.div 
            key={plan.id}
            whileHover={{ y: -8 }}
            className={`relative bg-white p-8 rounded-[2rem] border-2 transition-all ${
              currentPlan === plan.id ? 'border-blue-600 shadow-xl shadow-blue-100' : 'border-slate-100 hover:border-slate-200 shadow-sm'
            }`}
          >
            {plan.popular && (
              <div className="absolute -top-4 left-1/2 -translate-x-1/2 bg-blue-600 text-white px-4 py-1 rounded-full text-[10px] font-black uppercase tracking-widest shadow-lg">
                Mais Popular
              </div>
            )}

            <div className="space-y-6">
              <div>
                <h4 className="text-xl font-black text-slate-900">{plan.name}</h4>
                <p className="text-xs text-slate-500 mt-1">{plan.description}</p>
              </div>

              <div className="flex items-baseline gap-1">
                <span className="text-sm font-bold text-slate-400">R$</span>
                <span className="text-5xl font-black text-slate-900">{plan.price}</span>
                <span className="text-sm font-bold text-slate-400">/mês</span>
              </div>

              <ul className="space-y-4">
                {plan.features.map((feature, i) => (
                  <li key={i} className="flex items-center gap-3 text-sm text-slate-600">
                    <CheckCircle2 className={`w-5 h-5 shrink-0 ${currentPlan === plan.id ? 'text-blue-600' : 'text-slate-300'}`} />
                    {feature}
                  </li>
                ))}
              </ul>

              <button 
                onClick={() => handleUpgrade(plan.id)}
                disabled={currentPlan === plan.id || upgrading !== null}
                className={`w-full py-4 rounded-2xl font-bold text-sm transition-all flex items-center justify-center gap-2 ${
                  currentPlan === plan.id 
                    ? 'bg-green-50 text-green-600 cursor-default' 
                    : 'bg-slate-900 text-white hover:bg-blue-600 hover:shadow-lg hover:shadow-blue-200'
                } disabled:opacity-50`}
              >
                {upgrading === plan.id ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : currentPlan === plan.id ? (
                  <><ShieldCheck className="w-5 h-5" /> Plano Atual</>
                ) : (
                  <><Zap className="w-5 h-5" /> Assinar Agora</>
                )}
              </button>
            </div>
          </motion.div>
        ))}
      </div>

      {/* FAQ / Trust */}
      <div className="bg-slate-900 rounded-[3rem] p-12 text-white flex flex-col md:flex-row items-center gap-12 overflow-hidden relative">
        <div className="absolute top-0 right-0 -mr-24 -mt-24 w-96 h-96 bg-blue-600/20 rounded-full blur-3xl"></div>
        <div className="flex-1 space-y-6 relative z-10">
          <h3 className="text-3xl font-black leading-tight">Segurança e Transparência no seu Faturamento</h3>
          <p className="text-slate-400 text-sm">
            Utilizamos o Stripe para processar todos os pagamentos. Seus dados de cartão nunca tocam nossos servidores. 
            Cancele a qualquer momento sem taxas ocultas.
          </p>
          <div className="flex flex-wrap gap-4">
            <div className="flex items-center gap-2 bg-white/5 px-4 py-2 rounded-xl border border-white/10">
              <ShieldCheck className="w-4 h-4 text-blue-400" />
              <span className="text-xs font-bold">PCI Compliance</span>
            </div>
            <div className="flex items-center gap-2 bg-white/5 px-4 py-2 rounded-xl border border-white/10">
              <Clock className="w-4 h-4 text-blue-400" />
              <span className="text-xs font-bold">Suporte 24/7</span>
            </div>
          </div>
        </div>
        <div className="w-full md:w-72 aspect-square bg-white/5 backdrop-blur-xl rounded-[2.5rem] border border-white/10 flex items-center justify-center relative z-10">
          <CreditCard className="w-24 h-24 text-blue-500 opacity-50" />
        </div>
      </div>
    </div>
  );
}
