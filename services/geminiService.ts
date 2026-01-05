
import { GoogleGenAI, GenerateContentResponse, Type } from "@google/genai";
import { AgentRole, ModelType } from "../types";

const MAX_RETRIES = 3; 
const BASE_DELAY = 10000; 

export class GeminiTradingService {
  /**
   * 核心修改：强制实时读取逻辑
   * 每次调用 AI 功能前都会重新执行此方法，确保 localStorage 变更能立即生效
   */
  private getAI() {
    console.log("[GeminiService] 正在尝试动态获取 API Key...");

    // 1. 优先检查浏览器本地存储 (用户手动输入的 Key)
    const storedKey = typeof localStorage !== 'undefined' ? localStorage.getItem('STG_TRADING_KEY') : null;
    if (storedKey && storedKey.trim() !== '') {
      console.log("[GeminiService] 成功从 localStorage (STG_TRADING_KEY) 读取到 Key。");
      return new GoogleGenAI({ apiKey: storedKey.trim() });
    }
    
    // 2. 兜底检查 Vite/Vercel 环境变量
    // @ts-ignore
    const viteEnvKey = import.meta.env?.VITE_GEMINI_API_KEY;
    if (viteEnvKey && viteEnvKey !== '' && viteEnvKey !== 'undefined') {
      console.log("[GeminiService] 成功从环境变量 (VITE_GEMINI_API_KEY) 读取到 Key。");
      return new GoogleGenAI({ apiKey: viteEnvKey });
    }
    
    // 3. 检查全局 process 兼容层
    // @ts-ignore
    const processEnvKey = typeof process !== 'undefined' ? (process.env?.API_KEY || process.env?.VITE_GEMINI_API_KEY) : null;
    if (processEnvKey && processEnvKey !== '' && processEnvKey !== 'undefined') {
      console.log("[GeminiService] 成功从 process.env 读取到 Key。");
      return new GoogleGenAI({ apiKey: processEnvKey });
    }

    console.error("[GeminiService] 逻辑终止：未找到任何有效的 API Key 配置。请在 UI 界面设置 Key。");
    return null;
  }

  private async callWithRetry<T>(fn: (ai: any) => Promise<T>, retries = MAX_RETRIES): Promise<T> {
    const ai = this.getAI();
    if (!ai) {
      // 这里的错误会被 App.tsx 的 runSOP 捕获并弹出 Key 输入遮罩
      throw new Error("API_KEY_MISSING");
    }

    try {
      return await fn(ai);
    } catch (error: any) {
      const errorMsg = error?.message || String(error);
      console.error(`[GeminiService] API 调用失败: ${errorMsg}`);
      
      const isRateLimit = errorMsg.includes("429") || errorMsg.includes("RESOURCE_EXHAUSTED") || errorMsg.includes("Too Many Requests");
      const isQuotaExhausted = errorMsg.includes("current quota") || errorMsg.includes("daily limit") || errorMsg.includes("DAILY_QUOTA_EXHAUSTED");

      if (isQuotaExhausted) {
        throw new Error("DAILY_QUOTA_EXHAUSTED");
      }

      if (retries > 0) {
        const multiplier = isRateLimit ? 2 : 1.5;
        const delay = Math.pow(multiplier, MAX_RETRIES - retries + 1) * BASE_DELAY;
        console.warn(`[GeminiService] 自动重试中 (剩余 ${retries}): 预计等待 ${delay/1000}s...`);
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

// 导出单例，确保全局统一
export const geminiService = new GeminiTradingService();
