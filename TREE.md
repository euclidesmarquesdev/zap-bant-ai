# 📂 Estrutura do Projeto

Abaixo está a descrição detalhada da árvore de diretórios e arquivos do sistema.

### 📁 Raiz do Projeto
*   `📄 server.ts` — 🧠 O coração do sistema. Servidor Express que gerencia Socket.io, conexão WhatsApp (Baileys) e rotas de API.
*   `📄 firebase.ts` — 🔥 Configuração e inicialização do Firebase (Auth e Firestore) com suporte a setup dinâmico.
*   `📄 firestore.rules` — 🛡️ Regras de segurança do banco de dados para proteção de dados e PII.
*   `📄 firebase-blueprint.json` — 📐 Blueprint da estrutura de dados do Firestore (Entidades e Caminhos).
*   `📄 firebase-applet-config.json` — 🔑 Armazena as credenciais do Firebase do cliente (gerado no setup).
*   `📄 AGENT.md` — 🤖 Template inicial da personalidade e comportamento do agente.
*   `📄 SHOP.md` — 🛍️ Template inicial do catálogo de produtos e regras de negócio.
*   `📄 .env.example` — 📝 Exemplo de variáveis de ambiente necessárias.
*   `📄 package.json` — 📦 Dependências do projeto e scripts de execução.
*   `📄 metadata.json` — ℹ️ Metadados do aplicativo (nome, descrição, permissões).

### 📁 src/ (Frontend React)
*   `📄 App.tsx` — 🏠 Componente principal. Gerencia rotas, estado global de autenticação e processamento de mensagens.
*   `📄 main.tsx` — 🚀 Ponto de entrada do React.

#### 📁 src/components/ (Interface do Usuário)
*   `📄 Sidebar.tsx` — 🧭 Menu lateral de navegação.
*   `📄 Header.tsx` — 👤 Barra superior com informações do usuário e status da conexão.
*   `📄 Dashboard.tsx` — 📊 Painel principal com KPIs e lista de leads recentes.
*   `📄 Kanban.tsx` — 📋 Visualização do funil de vendas em colunas.
*   `📄 Chat.tsx` — 💬 Interface de conversa em tempo real com histórico do Firestore.
*   `📄 AgentManager.tsx` — 🛠️ Editor avançado para AGENT.md e SHOP.md.
*   `📄 WhatsAppConnector.tsx` — 📱 Interface para leitura de QR Code e status da conexão.
*   `📄 Settings.tsx` — ⚙️ Configurações de perfil, API Gemini e Infraestrutura Firebase.
*   `📄 SetupScreen.tsx` — 🪄 Assistente de instalação para novos clientes.
*   `📄 HumanAgents.tsx` — 👥 Gestão de atendentes humanos e distribuição Round-Robin.
*   `📄 LeadRanking.tsx` — 🏆 Lista de leads qualificados por score.

#### 📁 src/services/ (Lógica de Negócio)
*   `📄 geminiService.ts` — 🧠 Integração com a API do Google Gemini, construção de prompts e validação de JSON.

#### 📁 src/hooks/ (Hooks Customizados)
*   `📄 useWhatsApp.ts` — 📡 Gerencia a comunicação via Socket.io com o servidor de WhatsApp.

#### 📁 src/lib/ (Utilitários)
*   `📄 utils.ts` — 🛠️ Funções auxiliares como formatação de telefone e classes Tailwind.

---
✨ *Estrutura desenhada para máxima escalabilidade e facilidade de manutenção.*
