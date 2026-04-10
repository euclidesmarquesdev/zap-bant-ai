import { GoogleGenAI, Type } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

export interface BANTResult {
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
  shopMd: string
): Promise<BANTResult> {
  const systemInstruction = `
    ${agentMd}
    
    ${shopMd}
    
    Analise a mensagem do cliente e o histórico da conversa.
    Identifique quais pilares BANT foram confirmados.
    Defina o novo status do lead de acordo com o funil de vendas.
    Calcule o Lead Score (0-100).
    Gere uma resposta curta e persuasiva para o WhatsApp.
    
    Retorne SEMPRE um JSON no formato:
    {
      "budget": boolean,
      "authority": boolean,
      "need": boolean,
      "timeline": boolean,
      "status": "novo" | "atendido" | "negociacao" | "fechamento" | "pagamento" | "humano",
      "leadScore": number,
      "response": "string"
    }
  `;

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
          leadScore: { type: Type.NUMBER },
          response: { type: Type.STRING }
        },
        required: ["budget", "authority", "need", "timeline", "status", "leadScore", "response"]
      }
    }
  });

  return JSON.parse(response.text);
}
