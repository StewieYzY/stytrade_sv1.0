
import { GoogleGenAI, GenerateContentResponse, Type } from "@google/genai";
import { AgentRole, ModelType } from "../types";

const MAX_RETRIES = 3; 
const BASE_DELAY = 10000; 

export class GeminiTradingService {
  /**
   * 动态获取 AI 实例
   * 优先级：
   * 1. localStorage.getItem('STG_TRADING_KEY') - 用户手动设置
   * 2. import.meta.env.VITE_GEMINI_API_KEY - Vercel/Vite 部署环境变量
   * 3. process.env.API_KEY - 系统注入或旧版兼容
   */
  private getAI() {
    // 1. 检查浏览器本地存储
    const storedKey = typeof localStorage !== 'undefined' ? localStorage.getItem('STG_TRADING_KEY') : null;
    
    // 2. 检查 Vite 环境变量 (import.meta.env 在现代 bundler 中会被替换)
    // @ts-ignore
    const viteEnvKey = import.meta.env?.VITE_GEMINI_API_KEY;
    
    // 3. 检查全局 process 对象 (Node 兼容或 shim)
    // @ts-ignore
    const processEnvKey = typeof process !== 'undefined' ? process.env?.API_KEY : null;

    const finalKey = (storedKey && storedKey.trim() !== '') 
      ? storedKey 
      : (viteEnvKey || processEnvKey);

    if (!finalKey || finalKey === 'undefined' || finalKey === '') {
      console.warn("Gemini API Key 未配置，系统进入待激活状态。");
      return null;
    }

    return new GoogleGenAI({ apiKey: finalKey });
  }

  private async callWithRetry<T>(fn: (ai: any) => Promise<T>, retries = MAX_RETRIES): Promise<T> {
    const ai = this.getAI();
    if (!ai) {
      // 抛出特定错误，由 UI 捕捉并显示激活弹窗
      throw new Error("API_KEY_MISSING");
    }

    try {
      return await fn(ai);
    } catch (error: any) {
      const errorMsg = error?.message || String(error);
      
      const isRateLimit = errorMsg.includes("429") || errorMsg.includes("RESOURCE_EXHAUSTED") || errorMsg.includes("Too Many Requests");
      const isQuotaExhausted = errorMsg.includes("current quota") || errorMsg.includes("daily limit") || errorMsg.includes("DAILY_QUOTA_EXHAUSTED");

      if (isQuotaExhausted) {
        throw new Error("DAILY_QUOTA_EXHAUSTED");
      }

      if (retries > 0) {
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
    return this.callWithRetry(async (ai) => {
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
    return this.callWithRetry(async (ai) => {
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
          temperature: isAnalysisRole ? 0.01 : 0.2,
        },
      });

      const text = response.text || "Agent 响应为空。";
      const sources = response.candidates?.[0]?.groundingMetadata?.groundingChunks || [];
      return { text, sources };
    });
  }
}

export const geminiService = new GeminiTradingService();
