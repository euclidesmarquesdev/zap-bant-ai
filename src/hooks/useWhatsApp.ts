import { useState, useEffect, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';

export function useWhatsApp() {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [qrCode, setQrCode] = useState<string>("");
  const [isReady, setIsReady] = useState(false);
  const [userPhone, setUserPhone] = useState<string>("");
  const [lastMessage, setLastMessage] = useState<any>(null);
  const [currentOrgId, setCurrentOrgId] = useState<string | null>(null);

  useEffect(() => {
    const newSocket = io();
    setSocket(newSocket);

    newSocket.on('whatsapp:qr', (qr) => {
      setQrCode(qr);
      setIsReady(false);
      setUserPhone("");
    });

    newSocket.on('whatsapp:ready', (data?: { userPhone: string }) => {
      setIsReady(true);
      setQrCode("");
      if (data?.userPhone) {
        setUserPhone(data.userPhone);
      }
    });

    newSocket.on('whatsapp:message', (msg) => {
      setLastMessage(msg);
    });

    return () => {
      newSocket.disconnect();
    };
  }, []);

  useEffect(() => {
    if (socket && currentOrgId) {
      socket.emit('join', currentOrgId);
      
      // Trigger connection check on server
      fetch('/api/whatsapp/connect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orgId: currentOrgId })
      }).catch(console.error);
    }
  }, [socket, currentOrgId]);

  const joinOrg = useCallback((orgId: string) => {
    setCurrentOrgId(orgId);
  }, []);

  const sendAIResponse = (to: string, message: string) => {
    if (socket?.connected && currentOrgId) {
      socket.emit('ai:response', { orgId: currentOrgId, to, message });
    } else if (currentOrgId) {
      console.warn('⚠️ [WHATSAPP] Socket desconectado. Usando fallback REST...');
      fetch('/api/whatsapp/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orgId: currentOrgId, to, message })
      }).catch(err => console.error('❌ [WHATSAPP] Erro no fallback REST:', err));
    }
  };

  const disconnect = async () => {
    if (!currentOrgId) return false;
    try {
      const response = await fetch('/api/whatsapp/disconnect', { 
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orgId: currentOrgId })
      });
      const data = await response.json();
      if (data.success) {
        setIsReady(false);
        setQrCode("");
      }
      return data.success;
    } catch (error) {
      console.error('Error disconnecting WhatsApp:', error);
      return false;
    }
  };

  const setTyping = (to: string, status: 'composing' | 'paused') => {
    if (socket?.connected && currentOrgId) {
      socket.emit('whatsapp:typing', { orgId: currentOrgId, to, status });
    } else if (currentOrgId) {
      fetch('/api/whatsapp/typing', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orgId: currentOrgId, to, status })
      }).catch(() => {});
    }
  };

  const markAsRead = (keys: any[]) => {
    if (socket?.connected && currentOrgId) {
      socket.emit('whatsapp:read', { orgId: currentOrgId, keys });
    } else if (currentOrgId) {
      fetch('/api/whatsapp/read', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orgId: currentOrgId, keys })
      }).catch(() => {});
    }
  };

  return { qrCode, isReady, userPhone, lastMessage, sendAIResponse, disconnect, setTyping, markAsRead, joinOrg };
}
