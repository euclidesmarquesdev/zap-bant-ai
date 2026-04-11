import { useState, useEffect } from 'react';
import { io, Socket } from 'socket.io-client';

export function useWhatsApp() {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [qrCode, setQrCode] = useState<string>("");
  const [isReady, setIsReady] = useState(false);
  const [lastMessage, setLastMessage] = useState<any>(null);

  useEffect(() => {
    const newSocket = io();
    setSocket(newSocket);

    newSocket.on('whatsapp:qr', (qr) => {
      setQrCode(qr);
      setIsReady(false);
    });

    newSocket.on('whatsapp:ready', () => {
      setIsReady(true);
      setQrCode("");
    });

    newSocket.on('whatsapp:message', (msg) => {
      setLastMessage(msg);
    });

    return () => {
      newSocket.disconnect();
    };
  }, []);

  const sendAIResponse = (to: string, message: string) => {
    if (socket) {
      socket.emit('ai:response', { to, message });
    }
  };

  const disconnect = async () => {
    try {
      const response = await fetch('/api/whatsapp/disconnect', { method: 'POST' });
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

  return { qrCode, isReady, lastMessage, sendAIResponse, disconnect };
}
