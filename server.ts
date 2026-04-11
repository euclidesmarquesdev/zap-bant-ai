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

  const connectToWhatsApp = async () => {
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
    });

    sock.ev.on('creds.update', saveCreds);

    sock.ev.on('connection.update', (update: any) => {
      const { connection, lastDisconnect, qr } = update;
      
      if (qr) {
        console.log('QR RECEIVED');
        qrcode.toDataURL(qr, (err, url) => {
          qrCodeData = url;
          io.emit('whatsapp:qr', url);
        });
      }

      if (connection === 'close') {
        const statusCode = (lastDisconnect?.error as Boom)?.output?.statusCode;
        const shouldReconnect = statusCode !== DisconnectReason.loggedOut;
        
        if (statusCode === DisconnectReason.loggedOut) {
          console.log('WhatsApp: Desconectado intencionalmente.');
        } else {
          console.log('WhatsApp: Conexão fechada devido a:', lastDisconnect?.error, '. Tentando reconectar:', shouldReconnect);
        }
        
        isReady = false;
        if (shouldReconnect) {
          connectToWhatsApp();
        }
      } else if (connection === 'open') {
        console.log('opened connection');
        isReady = true;
        qrCodeData = "";
        io.emit('whatsapp:ready');
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
              const clean = parts[0].split(':')[0];
              const domain = parts[1];

              // If it's a standard WhatsApp JID, it's the phone number
              if (domain === 's.whatsapp.net' && /^\d+$/.test(clean)) {
                return clean;
              }

              // Check if we have a mapping for this LID
              if (lidMap.has(clean)) {
                const mapped = lidMap.get(clean)!;
                console.log(`USING MAPPED JID FOR LID ${clean}: ${mapped}`);
                return mapped;
              }
              
              return clean;
            };

            const from = extractPhone(participant || remoteJid);
            const chatId = remoteJid;
            
            console.log('DEBUG: remoteJid:', remoteJid, 'participant:', participant, 'from:', from);
            
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
              console.log('MESSAGE RECEIVED', body, 'FROM', from, 'PIC', profilePicUrl);
              
              // Mark as read (blue ticks)
              try {
                await sock.readMessages([msg.key]);
              } catch (err) {
                console.error('Error marking message as read:', err);
              }

              io.emit('whatsapp:message', {
                id: msg.key.id,
                from,
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
      if (to && !to.includes('@')) {
        to = `${to}@s.whatsapp.net`;
      }
      
      console.log(`SENDING MESSAGE TO ${to}: ${message}`);
      await sock.sendMessage(to, { text: message });
      res.json({ success: true });
    } catch (error: any) {
      console.error('ERROR SENDING MESSAGE:', error);
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
        await sock.logout();
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
    if (isReady) socket.emit('whatsapp:ready');

    socket.on('ai:response', async (data) => {
      let { to, message } = data;
      console.log('AI RESPONSE TO SEND', to, message);
      if (isReady && sock) {
        try {
          // Ensure 'to' is a proper JID
          if (to && !to.includes('@')) {
            to = `${to}@s.whatsapp.net`;
          }
          await sock.sendMessage(to, { text: message });
        } catch (err) {
          console.error('Error sending AI message:', err);
        }
      }
    });
  });
}

startServer();
