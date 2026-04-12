import express from "express";
import { createServer } from "http";
import { Server } from "socket.io";
import { createServer as createViteServer } from "vite";
import path from "path";
import cors from "cors";
import qrcode from "qrcode";
import fs from "fs";
import makeWASocket, { 
  DisconnectReason, 
  useMultiFileAuthState, 
  fetchLatestBaileysVersion,
  makeCacheableSignalKeyStore
} from "@whiskeysockets/baileys";
import { Boom } from "@hapi/boom";
import pino from "pino";

async function startServer() {
  const app = express();
  const httpServer = createServer(app);
  const io = new Server(httpServer, {
    cors: {
      origin: "*",
      methods: ["GET", "POST"]
    }
  });

  app.use(cors());
  app.use(express.json());

  const PORT = 3000;

  // WhatsApp Connection Logic
  let sock: any;
  let qrCodeData = "";
  let isReady = false;

  // Map to store LID to real JID mapping
  const lidMap = new Map<string, string>();
  const LID_MAP_PATH = path.join(process.cwd(), 'lid-map.json');

  // Load lidMap from file
  try {
    if (fs.existsSync(LID_MAP_PATH)) {
      const data = JSON.parse(fs.readFileSync(LID_MAP_PATH, 'utf-8'));
      Object.entries(data).forEach(([lid, jid]) => lidMap.set(lid, jid as string));
      console.log(`LID MAP LOADED: ${lidMap.size} entries`);
    }
  } catch (e) {
    console.error('Error loading LID map:', e);
  }

  function saveLidMap() {
    try {
      const data = Object.fromEntries(lidMap);
      fs.writeFileSync(LID_MAP_PATH, JSON.stringify(data, null, 2));
    } catch (e) {
      console.error('Error saving LID map:', e);
    }
  }

  let streamErrorCount = 0;

  const connectToWhatsApp = async () => {
    console.log('WhatsApp: Starting connection process...');
    const { state, saveCreds } = await useMultiFileAuthState('auth_info_baileys');
    const { version } = await fetchLatestBaileysVersion();

    sock = makeWASocket({
      version,
      printQRInTerminal: true,
      auth: {
        creds: state.creds,
        keys: makeCacheableSignalKeyStore(state.keys, pino({ level: 'silent' })),
      },
      logger: pino({ level: 'silent' }),
      browser: ["Ubuntu", "Chrome", "20.0.04"],
      markOnlineOnConnect: true,
      connectTimeoutMs: 60000,
      defaultQueryTimeoutMs: 0,
      keepAliveIntervalMs: 10000,
    });

    sock.ev.on('creds.update', saveCreds);

    sock.ev.on('connection.update', async (update: any) => {
      const { connection, lastDisconnect, qr } = update;
      
      if (qr) {
        console.log('WhatsApp: QR RECEIVED');
        qrcode.toDataURL(qr, (err, url) => {
          if (err) {
            console.error('Error generating QR DataURL:', err);
            return;
          }
          qrCodeData = url;
          io.emit('whatsapp:qr', url);
        });
      }

      if (connection === 'close') {
        const statusCode = (lastDisconnect?.error as Boom)?.output?.statusCode;
        const errorMessage = lastDisconnect?.error?.message || "";
        const shouldReconnect = statusCode !== DisconnectReason.loggedOut;
        
        console.log('WhatsApp: Conexão fechada. Código:', statusCode, 'Erro:', errorMessage);

        // Erro 401 ou LoggedOut: Reset total da sessão
        if (statusCode === DisconnectReason.loggedOut || statusCode === 401) {
          console.log('WhatsApp: Sessão inválida ou deslogada. Limpando e gerando novo QR...');
          isReady = false;
          qrCodeData = "";
          streamErrorCount = 0;
          io.emit('whatsapp:qr', "");
          
          const authPath = path.join(process.cwd(), 'auth_info_baileys');
          if (fs.existsSync(authPath)) {
            try {
              fs.rmSync(authPath, { recursive: true, force: true });
            } catch (e) {
              console.error('Error clearing auth folder:', e);
            }
          }
          
          setTimeout(() => connectToWhatsApp(), 2000);
        } 
        // Erro 515 ou Stream Errored: Reinício imediato
        else if (statusCode === 515 || errorMessage.includes('Stream Errored')) {
          streamErrorCount++;
          console.log(`WhatsApp: Erro de Stream (515) - Tentativa ${streamErrorCount}. Reiniciando...`);
          isReady = false;
          
          if (streamErrorCount > 3) {
            console.log('WhatsApp: Erro 515 persistente. Limpando sessão para forçar novo QR...');
            const authPath = path.join(process.cwd(), 'auth_info_baileys');
            if (fs.existsSync(authPath)) {
              try { fs.rmSync(authPath, { recursive: true, force: true }); } catch (e) {}
            }
            streamErrorCount = 0;
          }
          
          setTimeout(() => connectToWhatsApp(), 1000);
        }
        // Outros erros: Tentativa de reconexão padrão
        else {
          console.log('WhatsApp: Tentando reconectar em 5 segundos...', shouldReconnect);
          isReady = false;
          if (shouldReconnect) {
            setTimeout(() => connectToWhatsApp(), 5000);
          }
        }
      } else if (connection === 'open') {
        console.log('WhatsApp: Connection opened successfully');
        isReady = true;
        qrCodeData = "";
        streamErrorCount = 0;
        
        // Set presence to available to help with notifications
        try {
          await sock.sendPresenceUpdate('available');
        } catch (e) {}
        
        // Extrair o número do usuário conectado
        let userPhone = "";
        try {
          const me = sock?.authState?.creds?.me;
          if (me) {
            const rawId = typeof me === 'string' ? me : (me.id || "");
            userPhone = rawId.split('@')[0].split(':')[0];
            console.log(`WhatsApp: USER CONNECTED: ${userPhone}`);
          }
        } catch (err) {
          console.error('WhatsApp: Error getting user phone:', err);
        }
        
        io.emit('whatsapp:ready', { userPhone });
      }
    });

    sock.ev.on('contacts.upsert', (contacts: any) => {
      contacts.forEach((c: any) => {
        if (c.id && c.lid) {
          const cleanLid = c.lid.split('@')[0];
          const cleanJid = c.id.split('@')[0];
          if (lidMap.get(cleanLid) !== cleanJid) {
            lidMap.set(cleanLid, cleanJid);
            console.log(`MAPPING LID ${cleanLid} TO JID ${cleanJid}`);
            saveLidMap();
          }
        }
      });
    });

    sock.ev.on('messaging-history.set', ({ contacts }: any) => {
      if (contacts) {
        let changed = false;
        contacts.forEach((c: any) => {
          if (c.id && c.lid) {
            const cleanLid = c.lid.split('@')[0];
            const cleanJid = c.id.split('@')[0];
            if (lidMap.get(cleanLid) !== cleanJid) {
              lidMap.set(cleanLid, cleanJid);
              changed = true;
            }
          }
        });
        if (changed) saveLidMap();
        console.log(`HISTORY SET: Mapped ${contacts.length} contacts. Total map size: ${lidMap.size}`);
      }
    });

    sock.ev.on('contacts.upsert', (contacts: any) => {
      let changed = false;
      contacts.forEach((c: any) => {
        if (c.id && c.lid) {
          const cleanLid = c.lid.split('@')[0];
          const cleanJid = c.id.split('@')[0];
          if (lidMap.get(cleanLid) !== cleanJid) {
            lidMap.set(cleanLid, cleanJid);
            changed = true;
          }
        }
      });
      if (changed) {
        console.log(`CONTACTS UPSERT: Mapped ${contacts.length} contacts.`);
        saveLidMap();
      }
    });

    sock.ev.on('contacts.update', (updates: any) => {
      updates.forEach((u: any) => {
        if (u.id && u.lid) {
          const cleanLid = u.lid.split('@')[0];
          const cleanJid = u.id.split('@')[0];
          if (lidMap.get(cleanLid) !== cleanJid) {
            lidMap.set(cleanLid, cleanJid);
            console.log(`UPDATE MAPPING LID ${cleanLid} TO JID ${cleanJid}`);
            saveLidMap();
          }
        }
      });
    });

    sock.ev.on('messages.upsert', async (m: any) => {
      if (m.type === 'notify') {
        for (const msg of m.messages) {
          if (!msg.key.fromMe && msg.message) {
            const remoteJid = msg.key.remoteJid;
            const participant = msg.key.participant;
            const pushName = msg.pushName || "";

            // Dynamic mapping if we see both LID and JID in the same message
            if (remoteJid?.includes('@lid') && participant?.includes('@s.whatsapp.net')) {
              const cleanLid = remoteJid.split('@')[0].split(':')[0];
              const cleanJid = participant.split('@')[0].split(':')[0];
              if (lidMap.get(cleanLid) !== cleanJid) {
                lidMap.set(cleanLid, cleanJid);
                saveLidMap();
                console.log(`DYNAMIC MAPPING LID ${cleanLid} TO JID ${cleanJid}`);
              }
            }
            
            // Extract real phone number from JID
            const extractPhone = (jid: string) => {
              if (!jid) return "";
              const parts = jid.split('@');
              if (parts.length < 2) return jid;
              
              const clean = parts[0].split(':')[0];
              const domain = parts[1];

              // If it's a standard WhatsApp JID, it's the phone number
              if (domain === 's.whatsapp.net') {
                return clean;
              }

              // Check if we have a mapping for this LID
              if (lidMap.has(clean)) {
                const mapped = lidMap.get(clean)!;
                return mapped;
              }
              
              return clean;
            };

            const from = extractPhone(remoteJid || participant);
            const chatId = remoteJid;
            const originalLid = remoteJid?.includes('@lid') ? remoteJid.split('@')[0].split(':')[0] : null;
            
            console.log('DEBUG: remoteJid:', remoteJid, 'participant:', participant, 'from:', from, 'lid:', originalLid);
            
            // Try to fetch profile picture
            let profilePicUrl = "";
            try {
              profilePicUrl = await sock.profilePictureUrl(remoteJid, 'image');
            } catch (e) {
              // No profile pic or restricted
            }
            
            const body = msg.message.conversation || 
                         msg.message.extendedTextMessage?.text || 
                         msg.message.imageMessage?.caption || "";
            
            if (body) {
              console.log('MESSAGE RECEIVED', body, 'FROM', from, 'LID', originalLid);
              
              // Mark as read (blue ticks)
              try {
                await sock.readMessages([msg.key]);
              } catch (err) {
                console.error('Error marking message as read:', err);
              }

              io.emit('whatsapp:message', {
                id: msg.key.id,
                from,
                lid: originalLid,
                chatId,
                pushName,
                profilePicUrl,
                body,
                timestamp: new Date().toISOString()
              });
            }
          }
        }
      }
    });
  };

  connectToWhatsApp();

  // API Routes
  app.get("/api/whatsapp/status", (req, res) => {
    res.json({ isReady, qrCodeData });
  });

  app.post("/api/whatsapp/send", async (req, res) => {
    let { to, message } = req.body;
    if (!isReady || !sock) return res.status(400).json({ error: "WhatsApp not ready" });
    
    try {
      // Ensure 'to' is a proper JID
      let targetJid = to;
      if (to && !to.includes('@')) {
        targetJid = `${to}@s.whatsapp.net`;
      }
      
      console.log(`SENDING MANUAL MESSAGE TO ${targetJid}: ${message}`);
      
      // Mostrar "Digitando..." antes de enviar manualmente também
      await sock.sendPresenceUpdate('composing', targetJid);
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      await sock.sendMessage(targetJid, { text: message });
      
      await sock.sendPresenceUpdate('paused', targetJid);
      
      res.json({ success: true });
    } catch (error: any) {
      console.error('ERROR SENDING MESSAGE:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // Firebase Configuration Endpoints
  const CONFIG_PATH = path.join(process.cwd(), 'firebase-applet-config.json');

  app.get("/api/config", (req, res) => {
    try {
      if (fs.existsSync(CONFIG_PATH)) {
        const config = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf-8'));
        // Don't send the full config if it's just placeholders
        if (config.apiKey === "TODO_KEYHERE") {
          return res.json(null);
        }
        res.json(config);
      } else {
        res.json(null);
      }
    } catch (e) {
      res.json(null);
    }
  });

  app.post("/api/config", (req, res) => {
    try {
      const config = req.body;
      fs.writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2));
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Read training files
  app.get("/api/training", (req, res) => {
    try {
      const agentMd = fs.readFileSync(path.join(process.cwd(), "AGENT.md"), "utf-8");
      const shopMd = fs.readFileSync(path.join(process.cwd(), "SHOP.md"), "utf-8");
      res.json({ agentMd, shopMd });
    } catch (error) {
      res.status(500).json({ error: "Failed to read training files" });
    }
  });

  app.post("/api/whatsapp/disconnect", async (req, res) => {
    try {
      if (sock) {
        try {
          await sock.logout();
        } catch (e) {}
        sock.end(undefined);
      }
      
      // Remove auth folder
      const authPath = path.join(process.cwd(), 'auth_info_baileys');
      if (fs.existsSync(authPath)) {
        fs.rmSync(authPath, { recursive: true, force: true });
      }
      
      isReady = false;
      qrCodeData = "";
      io.emit('whatsapp:qr', ""); // Clear QR on clients
      
      console.log('WhatsApp: Disconnected and session cleared. Restarting for new QR...');
      
      // Restart connection process to generate new QR
      setTimeout(() => {
        connectToWhatsApp();
      }, 2000);

      res.json({ success: true });
    } catch (error: any) {
      console.error('Error disconnecting:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  httpServer.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });

  // Socket events from frontend
  io.on('connection', (socket) => {
    console.log('A user connected');
    if (qrCodeData) socket.emit('whatsapp:qr', qrCodeData);
    if (isReady) {
      let userPhone = "";
      try {
        if (sock?.authState?.creds?.me) {
          const meJid = sock.authState.creds.me.id || sock.authState.creds.me;
          userPhone = (typeof meJid === 'string' ? meJid : meJid.id).split('@')[0].split(':')[0];
        }
      } catch (e) {}
      socket.emit('whatsapp:ready', { userPhone });
    }

    socket.on('whatsapp:typing', async (data) => {
      const { to, status } = data; // status: 'composing' or 'paused'
      if (isReady && sock) {
        try {
          let targetJid = to;
          if (to && !to.includes('@')) {
            targetJid = to.length > 15 ? `${to}@lid` : `${to}@s.whatsapp.net`;
          }
          await sock.sendPresenceUpdate(status, targetJid);
        } catch (err) {
          console.error('Error sending typing status:', err);
        }
      }
    });

    socket.on('ai:response', async (data) => {
      let { to, message } = data;
      console.log('AI RESPONSE TO SEND', to, message);
      if (isReady && sock) {
        try {
          // Ensure 'to' is a proper JID
          let targetJid = to;
          if (to && !to.includes('@')) {
            if (to.length > 15) {
              targetJid = `${to}@lid`;
            } else {
              targetJid = `${to}@s.whatsapp.net`;
            }
          }

          // Enviar a mensagem (o status de digitando já foi iniciado pelo frontend)
          await sock.sendMessage(targetJid, { text: message });

          // Parar "Digitando..."
          await sock.sendPresenceUpdate('paused', targetJid);
        } catch (err) {
          console.error('Error sending AI message:', err);
        }
      }
    });
  });
}

startServer();
