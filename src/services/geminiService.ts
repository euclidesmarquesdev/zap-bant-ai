import { GoogleGenAI, Type } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

export interface BANTResult {
  name?: string | null;
  budget: boolean;
  authority: boolean;
  need: boolean;
  timeline: boolean;
  score: number;
  status: string;
  response: string;
  leadScore: number;
}

export async function processMessage(
  message: string,
  history: { role: string; content: string }[],
  agentMd: string,
  shopMd: string,
  currentLead?: any
): Promise<BANTResult> {
  if (!process.env.GEMINI_API_KEY) {
    throw new Error("GEMINI_API_KEY não configurada. Por favor, adicione sua chave de API nas configurações.");
  }

  const currentState = currentLead ? `
    ESTADO ATUAL DO LEAD (JÁ COLETADO):
    - Nome: ${currentLead.name || 'Desconhecido'}
    - Budget (Orçamento): ${currentLead.bant?.budget ? 'SIM' : 'NÃO'}
    - Authority (Autoridade): ${currentLead.bant?.authority ? 'SIM' : 'NÃO'}
    - Need (Necessidade): ${currentLead.bant?.need ? 'SIM' : 'NÃO'}
    - Timeline (Urgência): ${currentLead.bant?.timeline ? 'SIM' : 'NÃO'}
    - Score Atual: ${currentLead.score || 0}
    - Status Atual: ${currentLead.status || 'novo'}
  ` : '';

  const systemInstruction = `
    ${agentMd}
    
    ${shopMd}
    
    ${currentState}
    
    OBJETIVO: Você é um vendedor de ALTA PERFORMANCE. Seu objetivo é fechar a venda o mais rápido possível usando o BANT.
    
    INSTRUÇÕES CRÍTICAS:
    1. Analise a mensagem do cliente e o histórico.
    2. MANTENHA A MEMÓRIA: Se o "ESTADO ATUAL DO LEAD" diz que um pilar BANT é "SIM", ele DEVE continuar sendo true no JSON de retorno, a menos que o cliente explicitamente mude de ideia.
    3. Se o nome já é conhecido, NÃO PERGUNTE NOVAMENTE. Use o nome do cliente.
    4. Foque APENAS nos pilares que ainda estão como "NÃO".
    5. Se o cliente demonstrar necessidade e urgência, envie o LINK DE PAGAMENTO.
    6. Se o Lead Score atingir 75 ou mais, tente o fechamento.
    7. Se o cliente perguntar o preço, informe o preço de SHOP.md.
    
    STATUS DO FUNIL:
    - "novo": Primeira interação.
    - "atendido": Conversa iniciada, qualificando BANT.
    - "negociacao": Cliente interessado, discutindo detalhes.
    - "fechamento": Você enviou o link de pagamento ou o cliente aceitou a oferta.
    - "pagamento": Cliente confirmou que vai pagar ou pediu o link.
    - "humano": Cliente pediu para falar com uma pessoa.
    
    Retorne SEMPRE um JSON no formato:
    {
      "name": "string" | null,
      "budget": boolean,
      "authority": boolean,
      "need": boolean,
      "timeline": boolean,
      "status": "novo" | "atendido" | "negociacao" | "fechamento" | "pagamento" | "humano",
      "leadScore": number,
      "response": "string"
    }
  `;

    try {
      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: [
          { role: "user", parts: [{ text: `Histórico: ${JSON.stringify(history)}\n\nNova mensagem: ${message}` }] }
        ],
        config: {
          systemInstruction,
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              budget: { type: Type.BOOLEAN },
              authority: { type: Type.BOOLEAN },
              need: { type: Type.BOOLEAN },
              timeline: { type: Type.BOOLEAN },
              status: { type: Type.STRING },
              name: { type: Type.STRING, nullable: true },
              leadScore: { type: Type.NUMBER },
              response: { type: Type.STRING }
            },
            required: ["budget", "authority", "need", "timeline", "status", "leadScore", "response"]
          }
        }
      });

      return JSON.parse(response.text);
    } catch (error: any) {
      console.error("Erro na API do Gemini:", error);
      if (error.message?.includes("401") || error.message?.includes("Unauthorized") || error.message?.includes("API_KEY_INVALID")) {
        throw new Error("Erro de Autenticação: Sua chave de API do Gemini parece ser inválida ou não tem permissão.");
      }
      throw error;
    }
}
