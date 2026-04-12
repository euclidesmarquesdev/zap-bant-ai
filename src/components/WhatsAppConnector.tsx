import React from 'react';
import { QrCode, CheckCircle2, Loader2, AlertCircle, Settings } from 'lucide-react';
import { motion } from 'motion/react';

interface WhatsAppConnectorProps {
  qrCode: string;
  isReady: boolean;
  userPhone?: string;
  onDisconnect: () => Promise<boolean>;
}

export default function WhatsAppConnector({ qrCode, isReady, userPhone, onDisconnect }: WhatsAppConnectorProps) {
  const [isDisconnecting, setIsDisconnecting] = React.useState(false);
  const [showConfirm, setShowConfirm] = React.useState(false);

  const handleDisconnect = async () => {
    setIsDisconnecting(true);
    await onDisconnect();
    setIsDisconnecting(false);
    setShowConfirm(false);
  };

  return (
    <div className="max-w-2xl mx-auto py-12">
      <div className="text-center mb-12">
        <h2 className="text-3xl font-bold text-slate-900">Conectar WhatsApp</h2>
        <p className="text-slate-500 mt-2">Escaneie o QR Code para iniciar o agente de IA.</p>
      </div>

      <div className="bg-white p-12 rounded-3xl border border-slate-200 shadow-xl text-center">
        {isReady ? (
          <motion.div 
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="flex flex-col items-center"
          >
            <div className="w-24 h-24 bg-green-100 rounded-full flex items-center justify-center mb-6">
              <CheckCircle2 className="text-green-600 w-12 h-12" />
            </div>
            <h3 className="text-2xl font-bold text-slate-900">Conectado com Sucesso!</h3>
            
            {userPhone && (
              <div className="mt-2 px-4 py-2 bg-green-50 rounded-lg border border-green-100">
                <p className="text-green-700 font-medium text-sm">
                  📱 Conectado como: <span className="font-mono font-bold">+{userPhone}</span>
                </p>
              </div>
            )}

            <p className="text-slate-500 mt-4">Seu agente de IA já está respondendo mensagens.</p>
            
            {!showConfirm ? (
              <button 
                onClick={() => setShowConfirm(true)}
                className="mt-8 px-8 py-3 bg-red-50 text-red-600 font-bold rounded-xl hover:bg-red-100 transition-all"
              >
                Desconectar Dispositivo
              </button>
            ) : (
              <motion.div 
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="mt-8 p-6 bg-red-50 rounded-2xl border border-red-100 w-full max-w-sm"
              >
                <p className="text-red-900 font-bold mb-4">Tem certeza?</p>
                <p className="text-red-700 text-sm mb-6">Você precisará escanear o QR Code novamente para reconectar.</p>
                <div className="flex gap-3">
                  <button 
                    onClick={handleDisconnect}
                    disabled={isDisconnecting}
                    className="flex-1 px-4 py-2 bg-red-600 text-white font-bold rounded-lg hover:bg-red-700 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                  >
                    {isDisconnecting && <Loader2 className="w-4 h-4 animate-spin" />}
                    {isDisconnecting ? 'Desconectando...' : 'Sim, Desconectar'}
                  </button>
                  <button 
                    onClick={() => setShowConfirm(false)}
                    disabled={isDisconnecting}
                    className="flex-1 px-4 py-2 bg-white text-slate-600 font-bold rounded-lg border border-slate-200 hover:bg-slate-50 transition-all"
                  >
                    Cancelar
                  </button>
                </div>
              </motion.div>
            )}
          </motion.div>
        ) : qrCode ? (
          <div className="flex flex-col items-center">
            <div className="bg-white p-4 rounded-2xl border-4 border-slate-100 shadow-inner mb-8">
              <img src={qrCode} alt="WhatsApp QR Code" className="w-64 h-64" />
            </div>
            <div className="flex items-center gap-3 text-slate-600 bg-slate-50 px-6 py-3 rounded-full">
              <Loader2 className="w-5 h-5 animate-spin text-blue-600" />
              <span className="text-sm font-medium">Aguardando escaneamento...</span>
            </div>
            <div className="mt-12 text-left w-full max-w-sm">
              <h4 className="font-bold text-slate-900 mb-4">Instruções:</h4>
              <ol className="space-y-3 text-sm text-slate-600 list-decimal pl-4">
                <li>Abra o WhatsApp no seu celular.</li>
                <li>Toque em <b>Aparelhos Conectados</b>.</li>
                <li>Toque em <b>Conectar um Aparelho</b>.</li>
                <li>Aponte a câmera para este QR Code.</li>
              </ol>
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center py-12">
            <Loader2 className="w-12 h-12 animate-spin text-blue-600 mb-4" />
            <p className="text-slate-500">Gerando QR Code...</p>
          </div>
        )}
      </div>

      <div className="mt-8 grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-blue-50 p-6 rounded-2xl flex gap-4">
          <div className="p-3 bg-blue-100 rounded-xl h-fit">
            <AlertCircle className="text-blue-600 w-6 h-6" />
          </div>
          <div>
            <h5 className="font-bold text-blue-900">Dica de Performance</h5>
            <p className="text-sm text-blue-700 mt-1">Mantenha o celular conectado à internet para evitar quedas no atendimento.</p>
          </div>
        </div>
        <div className="bg-slate-50 p-6 rounded-2xl flex gap-4">
          <div className="p-3 bg-slate-200 rounded-xl h-fit">
            <Settings className="text-slate-600 w-6 h-6" />
          </div>
          <div>
            <h5 className="font-bold text-slate-900">Multi-Agentes</h5>
            <p className="text-sm text-slate-600 mt-1">Você pode alternar entre modelos de agentes na aba de configurações.</p>
          </div>
        </div>
      </div>
    </div>
  );
}
