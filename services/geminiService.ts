
import { GoogleGenAI, GenerateContentResponse, Type } from "@google/genai";
import { AgentRole, ModelType } from "../types";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

const MAX_RETRIES = 3; 
const BASE_DELAY = 10000; 

export class GeminiTradingService {
  private async callWithRetry<T>(fn: () => Promise<T>, retries = MAX_RETRIES): Promise<T> {
    try {
      return await fn();
    } catch (error: any) {
      const errorMsg = error?.message || String(error);
      
      // 捕获限流与配额耗尽错误
      const isRateLimit = errorMsg.includes("429") || errorMsg.includes("RESOURCE_EXHAUSTED") || errorMsg.includes("Too Many Requests");
      const isQuotaExhausted = errorMsg.includes("current quota") || errorMsg.includes("daily limit") || errorMsg.includes("DAILY_QUOTA_EXHAUSTED");

      if (isQuotaExhausted) {
        throw new Error("DAILY_QUOTA_EXHAUSTED");
      }

      if (retries > 0) {
        // 如果是限流错误，使用更长的退避时间
        const multiplier = isRateLimit ? 2 : 1.5;
        const delay = Math.pow(multiplier, MAX_RETRIES - retries + 1) * BASE_DELAY;
        console.warn(`API 压力检测 (重试剩余 ${retries}): 正在等待 ${delay/1000}s...`);
        await new Promise(resolve => setTimeout(resolve, delay));
        return this.callWithRetry(fn, retries - 1);
      }
      throw error;
    }
  }

  private cleanAndParseJSON(text: string) {
    try {
      const match = text.match(/\{[\s\S]*\}/);
      if (match) return JSON.parse(match[0]);
      throw new Error("JSON 解析失败");
    } catch (e) {
      throw new Error("无法从响应中提取合法的 JSON 数据");
    }
  }

  async fetchStockInfo(symbol: string): Promise<{ name: string; price: number }> {
    return this.callWithRetry(async () => {
      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview', 
        contents: `检索证券代码 "${symbol}" 的确切公司全称和【前一交易日的收盘价格】。返回格式: {"name": "...", "price": 0.0}`,
        config: {
          tools: [{ googleSearch: {} }],
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              name: { type: Type.STRING },
              price: { type: Type.NUMBER }
            },
            required: ["name", "price"]
          }
        },
      });
      return this.cleanAndParseJSON(response.text || '{"name": "Unknown", "price": 100}');
    });
  }

  async generateAgentResponse(
    role: AgentRole,
    prompt: string,
    systemInstruction: string,
    useSearch: boolean = false,
    modelName: string = 'gemini-3-flash-preview'
  ): Promise<{ text: string; sources?: any[] }> {
    return this.callWithRetry(async () => {
      // 分析类智能体使用极低 Temperature (0.01) 确保最大程度的一致性
      const isAnalysisRole = [
        AgentRole.FUNDAMENTAL_ANALYST, 
        AgentRole.SENTIMENT_ANALYST, 
        AgentRole.NEWS_POLICY_ANALYST, 
        AgentRole.TECHNICAL_ANALYST
      ].includes(role);
      
      const response = await ai.models.generateContent({
        model: modelName,
        contents: prompt,
        config: {
          systemInstruction: systemInstruction,
          tools: useSearch ? [{ googleSearch: {} }] : undefined,
          temperature: isAnalysisRole ? 0.01 : 0.2, // 进一步降低分析温度
        },
      });

      const text = response.text || "Agent 响应为空。";
      const sources = response.candidates?.[0]?.groundingMetadata?.groundingChunks || [];
      return { text, sources };
    });
  }
}

export const geminiService = new GeminiTradingService();
