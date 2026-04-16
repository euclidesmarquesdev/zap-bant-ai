# 🤖 WhatsApp AI Sales Agent - BANT Methodology
**Versão: 2.5.1-SaaS**

Este é um sistema avançado de automação de vendas via WhatsApp, integrando a inteligência do **Google Gemini AI** com a robustez do **Firebase** e a versatilidade da biblioteca **Baileys**. O foco principal é a qualificação de leads utilizando a metodologia **BANT** (Budget, Authority, Need, Timeline).

---

## 🚀 Stack Tecnológica

*   **Frontend**: React 18 + TypeScript + Vite
*   **Backend**: Node.js + Express (Full-stack) + Socket.io
*   **IA**: Google Gemini AI (Modelos Flash 1.5/2.0)
*   **Banco de Dados**: Firebase Firestore (Real-time)
*   **Autenticação**: Firebase Auth (Google Login)
*   **WhatsApp**: Baileys SDK (Conexão via Socket)
*   **Estilização**: Tailwind CSS + Framer Motion (Animações)
*   **Ícones**: Lucide React

---

## ✨ Principais Recursos (SaaS Multi-Tenant)

### 🏢 Arquitetura Multi-Tenant & Monetização
*   **Isolamento Total**: Cada organização (`orgId`) possui seus próprios leads, mensagens, agentes e configurações.
*   **Super Admin Dashboard**: Controle global da plataforma, gestão de faturamento (MRR) e ativação/desativação de instâncias.
*   **Gestão de Licenciamento**: Sistema de planos (Basic, Pro, Enterprise) integrado com lógica de checkout.
*   **Instâncias Dinâmicas**: Cada cliente conecta seu próprio número de WhatsApp de forma independente.

### 🧠 Inteligência Artificial (RAG)
*   **Processamento de Linguagem Natural**: Respostas humanas e contextuais.
*   **Memória de Curto Prazo**: Mantém o contexto das últimas 10 mensagens.
*   **Zero Alucinação**: Regras rígidas para responder apenas o que está no catálogo (`SHOP.md`).
*   **Status de Digitação**: Ativa o "Digitando..." no WhatsApp enquanto a IA processa a resposta.

## 📁 Estrutura de Componentes

*   `📄 Sidebar.tsx` — 🧭 Menu lateral com suporte a Super Admin e Licenciamento.
*   `📄 SuperAdminDashboard.tsx` — 👑 Painel global para gestão de todas as organizações e faturamento.
*   `📄 LicenseManager.tsx` — 💳 Gestão de planos e assinaturas para administradores de instâncias.

### 📊 Painel de Controle (Dashboard)
*   **Gestão de Leads**: Visualização clara do score de cada lead e status do funil.
*   **Metodologia BANT**: Indicadores visuais para Orçamento, Autoridade, Necessidade e Urgência.
*   **Ranking de Leads**: Identificação automática dos leads mais quentes.
*   **Kanban**: Fluxo visual de vendas (Novo -> Atendido -> Negociação -> Fechamento).

### ⚙️ Gestão de Agentes e Regras
*   **Editor AGENT.md**: Configure a personalidade e o tom de voz do seu robô por organização.
*   **Editor SHOP.md**: Gerencie produtos, preços e links de pagamento diretamente no painel.
*   **Mensagens de Boas-vindas**: Envio automático de textos e mídias (Imagens, Vídeos, PDFs) para novos contatos.

---

## 📡 API Completa

O sistema expõe uma API REST para integração e controle das instâncias.

### 📱 WhatsApp
*   `GET /api/whatsapp/status?orgId={id}`: Retorna o status da conexão e o QR Code atual.
*   `POST /api/whatsapp/connect`: Inicia o processo de conexão para uma organização.
*   `POST /api/whatsapp/disconnect`: Finaliza a sessão e limpa os dados de autenticação.
*   `POST /api/whatsapp/send`: Envia uma mensagem de texto.
    *   Body: `{ "orgId": "...", "to": "5511...", "message": "..." }`

### ⚙️ Configurações & Treinamento
*   `GET /api/training`: Retorna os templates globais de `AGENT.md` e `SHOP.md`.
*   `GET /api/config`: Retorna a configuração atual do Firebase.
*   `POST /api/config`: Salva novas credenciais do Firebase e atualiza o admin principal.

---

## 🛠️ Instalação e Configuração

O sistema possui um **Assistente de Instalação Automático** para facilitar o deploy em novos clientes.

### Passo 1: Configuração do Firebase
1. Crie um projeto no [Firebase Console](https://console.firebase.google.com/).
2. Ative o **Google Authentication**.
3. Crie um banco de dados **Firestore** em modo de produção.
4. Obtenha as chaves de configuração do seu App Web.

### Passo 2: Primeira Inicialização
1. Ao abrir o sistema pela primeira vez, você será redirecionado para a tela de **Setup Inicial**.
2. Insira as chaves do Firebase obtidas no passo anterior.
3. O sistema irá salvar as configurações e realizar o "Seeding" automático dos dados iniciais (AGENT.md e SHOP.md).

### Passo 3: Conexão WhatsApp
1. Vá até a aba **WhatsApp**.
2. Escaneie o QR Code com o seu celular.
3. Pronto! O agente começará a responder automaticamente.

---

## 🛡️ Segurança (Firestore Rules)

O sistema já vem com regras de segurança configuradas para:
*   Impedir acesso não autorizado a dados de outros usuários.
*   Permitir que apenas administradores editem regras globais.
*   Garantir a integridade dos logs de mensagens.

---

## 📝 Licença

Desenvolvido para alta performance em vendas consultivas. 🚀
