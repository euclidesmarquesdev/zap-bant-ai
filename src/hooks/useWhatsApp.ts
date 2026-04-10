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

  return { qrCode, isReady, lastMessage, sendAIResponse };
}
