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

interface Session {
  sock: any;
  qr: string;
  isReady: boolean;
  userPhone: string;
  streamErrorCount: number;
}

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
  const sessions = new Map<string, Session>();
  const lidMaps = new Map<string, Map<string, string>>();

  function getLidMapPath(orgId: string) {
    const dir = path.join(process.cwd(), 'data', orgId);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    return path.join(dir, 'lid-map.json');
  }

  function loadLidMap(orgId: string) {
    const path = getLidMapPath(orgId);
    const map = new Map<string, string>();
    try {
      if (fs.existsSync(path)) {
        const data = JSON.parse(fs.readFileSync(path, 'utf-8'));
        Object.entries(data).forEach(([lid, jid]) => map.set(lid, jid as string));
      }
    } catch (e) {}
    lidMaps.set(orgId, map);
    return map;
  }

  function saveLidMap(orgId: string) {
    const map = lidMaps.get(orgId);
    if (!map) return;
    try {
      const data = Object.fromEntries(map);
      fs.writeFileSync(getLidMapPath(orgId), JSON.stringify(data, null, 2));
    } catch (e) {}
  }

  const connectToWhatsApp = async (orgId: string) => {
    console.log(`WhatsApp [${orgId}]: Starting connection process...`);
    const authPath = path.join(process.cwd(), 'data', orgId, 'auth_info');
    if (!fs.existsSync(authPath)) fs.mkdirSync(authPath, { recursive: true });

    const { state, saveCreds } = await useMultiFileAuthState(authPath);
    const { version } = await fetchLatestBaileysVersion();
    const lidMap = loadLidMap(orgId);

    const sock = makeWASocket({
      version,
      printQRInTerminal: false,
      auth: {
        creds: state.creds,
        keys: makeCacheableSignalKeyStore(state.keys, pino({ level: 'silent' })),
      },
      logger: pino({ level: 'silent' }),
      browser: ["ZapBant AI", "Chrome", "1.0.0"],
      markOnlineOnConnect: true,
    });

    const session: Session = {
      sock,
      qr: "",
      isReady: false,
      userPhone: "",
      streamErrorCount: 0
    };
    sessions.set(orgId, session);

    sock.ev.on('creds.update', saveCreds);

    sock.ev.on('connection.update', async (update: any) => {
      const { connection, lastDisconnect, qr } = update;
      
      if (qr) {
        qrcode.toDataURL(qr, (err, url) => {
          if (!err) {
            session.qr = url;
            io.to(orgId).emit('whatsapp:qr', url);
          }
        });
      }

      if (connection === 'close') {
        const statusCode = (lastDisconnect?.error as Boom)?.output?.statusCode;
        const shouldReconnect = statusCode !== DisconnectReason.loggedOut;
        session.isReady = false;

        if (statusCode === DisconnectReason.loggedOut || statusCode === 401) {
          session.qr = "";
          io.to(orgId).emit('whatsapp:qr', "");
          if (fs.existsSync(authPath)) fs.rmSync(authPath, { recursive: true, force: true });
          setTimeout(() => connectToWhatsApp(orgId), 2000);
        } else {
          setTimeout(() => connectToWhatsApp(orgId), 5000);
        }
      } else if (connection === 'open') {
        session.isReady = true;
        session.qr = "";
        const me = sock?.authState?.creds?.me;
        if (me) {
          session.userPhone = (typeof me === 'string' ? me : (me.id || "")).split('@')[0].split(':')[0];
        }
        io.to(orgId).emit('whatsapp:ready', { userPhone: session.userPhone });
      }
    });

    sock.ev.on('messages.upsert', async (m: any) => {
      if (m.type === 'notify') {
        for (const msg of m.messages) {
          if (!msg.key.fromMe && msg.message) {
            const remoteJid = msg.key.remoteJid;
            if (remoteJid?.endsWith('@g.us')) continue;

            const body = msg.message.conversation || msg.message.extendedTextMessage?.text || "";
            if (body) {
              const from = remoteJid?.split('@')[0].split(':')[0];
              io.to(orgId).emit('whatsapp:message', {
                id: msg.key.id,
                from,
                chatId: remoteJid,
                pushName: msg.pushName || "",
                body,
                timestamp: new Date().toISOString(),
                orgId
              });
            }
          }
        }
      }
    });
  };

  // API Routes
  app.get("/api/whatsapp/status", (req, res) => {
    const { orgId } = req.query;
    if (!orgId) return res.status(400).json({ error: "orgId required" });
    const session = sessions.get(orgId as string);
    res.json({ 
      isReady: session?.isReady || false, 
      qrCodeData: session?.qr || "" 
    });
  });

  app.post("/api/whatsapp/connect", (req, res) => {
    const { orgId } = req.body;
    if (!orgId) return res.status(400).json({ error: "orgId required" });
    
    const session = sessions.get(orgId);
    if (!session) {
      console.log(`WhatsApp [${orgId}]: No session found, creating new...`);
      connectToWhatsApp(orgId);
    } else {
      console.log(`WhatsApp [${orgId}]: Session already exists. Ready: ${session.isReady}, Has QR: ${!!session.qr}`);
      // If session exists but is stuck without QR and not ready, we could force reconnect
      // but Baileys usually handles this. We'll just emit current state.
      if (session.qr) io.to(orgId).emit('whatsapp:qr', session.qr);
      if (session.isReady) io.to(orgId).emit('whatsapp:ready', { userPhone: session.userPhone });
    }
    res.json({ success: true });
  });

  app.post("/api/whatsapp/disconnect", async (req, res) => {
    const { orgId } = req.body;
    if (!orgId) return res.status(400).json({ error: "orgId required" });
    const session = sessions.get(orgId);
    if (session) {
      try {
        await session.sock.logout();
        sessions.delete(orgId);
        const authPath = path.join(process.cwd(), 'data', orgId, 'auth_info');
        if (fs.existsSync(authPath)) fs.rmSync(authPath, { recursive: true, force: true });
        res.json({ success: true });
      } catch (e: any) {
        res.status(500).json({ error: e.message });
      }
    } else {
      res.json({ success: true });
    }
  });

  app.get("/api/config", (req, res) => {
    try {
      const config = JSON.parse(fs.readFileSync(path.join(process.cwd(), 'firebase-applet-config.json'), 'utf-8'));
      // Only send non-sensitive info to the frontend settings page
      const publicConfig = {
        projectId: config.projectId,
        firestoreDatabaseId: config.firestoreDatabaseId
      };
      res.json(publicConfig);
    } catch (e) {
      res.status(500).json({ error: "Failed to read config" });
    }
  });

  app.post("/api/config", (req, res) => {
    try {
      const config = req.body;
      fs.writeFileSync(path.join(process.cwd(), 'firebase-applet-config.json'), JSON.stringify(config, null, 2));
      
      // Also update adminEmail in firebase.ts if provided
      if (config.adminEmail) {
        const firebaseTsPath = path.join(process.cwd(), 'src', 'firebase.ts');
        let content = fs.readFileSync(firebaseTsPath, 'utf-8');
        content = content.replace(/export const adminEmail = ".*";/, `export const adminEmail = "${config.adminEmail}";`);
        fs.writeFileSync(firebaseTsPath, content);
      }
      
      res.json({ success: true });
    } catch (e) {
      res.status(500).json({ error: "Failed to save config" });
    }
  });

  app.post("/api/whatsapp/send", async (req, res) => {
    const { orgId, to, message } = req.body;
    const session = sessions.get(orgId);
    if (!session || !session.isReady) return res.status(400).json({ error: "WhatsApp not ready" });
    
    try {
      let targetJid = to.includes('@') ? to : `${to}@s.whatsapp.net`;
      await session.sock.sendMessage(targetJid, { text: message });
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/training", (req, res) => {
    try {
      const agentMd = fs.readFileSync(path.join(process.cwd(), 'AGENT.md'), 'utf-8');
      const shopMd = fs.readFileSync(path.join(process.cwd(), 'SHOP.md'), 'utf-8');
      res.json({ agentMd, shopMd });
    } catch (error) {
      res.json({ agentMd: '', shopMd: '' });
    }
  });

  // Vite middleware
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({ server: { middlewareMode: true }, appType: "spa" });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => res.sendFile(path.join(distPath, 'index.html')));
  }

  httpServer.listen(PORT, "0.0.0.0", () => console.log(`Server running on port ${PORT}`));

  io.on('connection', (socket) => {
    socket.on('join', (orgId) => {
      socket.join(orgId);
      const session = sessions.get(orgId);
      if (session) {
        if (session.qr) socket.emit('whatsapp:qr', session.qr);
        if (session.isReady) socket.emit('whatsapp:ready', { userPhone: session.userPhone });
      }
    });
  });
}

startServer();
