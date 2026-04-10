import express from "express";
import { createServer } from "http";
import { Server } from "socket.io";
import { createServer as createViteServer } from "vite";
import path from "path";
import cors from "cors";
import pkg from 'whatsapp-web.js';
const { Client, LocalAuth } = pkg;
import qrcode from "qrcode";
import fs from "fs";

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

  // WhatsApp Client
  const client = new Client({
    authStrategy: new LocalAuth(),
    puppeteer: {
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    }
  });

  let qrCodeData = "";
  let isReady = false;

  client.on('qr', (qr) => {
    console.log('QR RECEIVED', qr);
    qrcode.toDataURL(qr, (err, url) => {
      qrCodeData = url;
      io.emit('whatsapp:qr', url);
    });
  });

  client.on('ready', () => {
    console.log('Client is ready!');
    isReady = true;
    qrCodeData = "";
    io.emit('whatsapp:ready');
  });

  client.on('message', async (msg) => {
    console.log('MESSAGE RECEIVED', msg.body);
    
    // Send to frontend to process with Gemini
    io.emit('whatsapp:message', {
      id: msg.id.id,
      from: msg.from,
      body: msg.body,
      timestamp: new Date().toISOString()
    });
  });

  client.initialize();

  // API Routes
  app.get("/api/whatsapp/status", (req, res) => {
    res.json({ isReady, qrCodeData });
  });

  app.post("/api/whatsapp/send", async (req, res) => {
    const { to, message } = req.body;
    if (!isReady) return res.status(400).json({ error: "WhatsApp not ready" });
    
    try {
      await client.sendMessage(to, message);
      res.json({ success: true });
    } catch (error) {
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
      const { to, message } = data;
      console.log('AI RESPONSE TO SEND', to, message);
      if (isReady) {
        try {
          await client.sendMessage(to, message);
        } catch (err) {
          console.error('Error sending AI message:', err);
        }
      }
    });
  });
}

startServer();
