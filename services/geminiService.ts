import { GoogleGenAI, GenerateContentResponse, Chat } from "@google/genai";
import { Device, Alert } from '../types';

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

// System Instruction for the Chat Assistant
const SYSTEM_INSTRUCTION = `
You are NetSentinel AI, an advanced Network Operations Assistant.
Your goal is to help network administrators monitor devices, troubleshoot errors, and analyze configurations.

Capabilities:
1. Analyze CSV/Excel import data for format errors, duplicate IPs, or illogical configurations.
2. Explain SNMP errors and suggest fixes (e.g., check community strings, firewall rules).
3. Analyze system health based on provided device stats.

Tone: Professional, Technical, yet Concise. Use Markdown for formatting.
`;

export const analyzeSystemHealth = async (devices: Device[], alerts: Alert[]): Promise<string> => {
  try {
    const systemSnapshot = {
      timestamp: new Date().toISOString(),
      deviceSummary: devices.map(d => ({
        name: d.name,
        type: d.type,
        status: d.status,
        cpu: d.cpuUsage,
        mem: d.memoryUsage,
        temp: d.temperature
      })),
      recentAlerts: alerts.slice(0, 10)
    };

    const prompt = `
      Analyze this system snapshot. Identify critical failures, suggest remediations, and give a health score (0-100).
      Data: ${JSON.stringify(systemSnapshot, null, 2)}
    `;

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
      config: { thinkingConfig: { thinkingBudget: 0 } }
    });

    return response.text || "Unable to generate analysis.";
  } catch (error) {
    console.error("Gemini analysis failed:", error);
    return "Error: Could not connect to AI service.";
  }
};

export const createChatSession = () => {
  return ai.chats.create({
    model: 'gemini-2.5-flash',
    config: {
      systemInstruction: SYSTEM_INSTRUCTION,
    },
  });
};

export const sendMessageStream = async (
  chat: Chat, 
  message: string, 
  contextData?: any
) => {
  const fullMessage = contextData 
    ? `Context Data: ${JSON.stringify(contextData)}\n\nUser Query: ${message}`
    : message;
    
  return chat.sendMessageStream({ message: fullMessage });
};