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
    if (socket && currentOrgId) {
      socket.emit('ai:response', { orgId: currentOrgId, to, message });
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
    if (socket && currentOrgId) {
      socket.emit('whatsapp:typing', { orgId: currentOrgId, to, status });
    }
  };

  return { qrCode, isReady, userPhone, lastMessage, sendAIResponse, disconnect, setTyping, joinOrg };
}
