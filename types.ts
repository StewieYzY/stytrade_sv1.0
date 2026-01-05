
export enum AgentRole {
  INTELLIGENCE_OFFICER = '情报官',
  FUND_SECRETARY = '基金秘书',
  FUND_MANAGER = '基金经理',
  FUNDAMENTAL_ANALYST = '基本面分析师',
  SENTIMENT_ANALYST = '舆情分析师',
  NEWS_POLICY_ANALYST = '新闻&政策分析师',
  TECHNICAL_ANALYST = '技术分析师',
  BULL_RESEARCHER = '看多研究员',
  BEAR_RESEARCHER = '看空研究员',
  TRADER = '交易员',
  RISK_MANAGER = '风险管理专家'
}

export enum ReportType {
  INTELLIGENCE_DOSSIER = '情报档案',
  ANALYSIS_REPORT = '分析报告',
  BULL_BEAR_DEBATE = '多空辩论报告',
  TRADE_DECISION = '交易决策报告',
  RISK_ASSESSMENT = '风险评估报告',
  FINAL_RECOMMENDATION = '最终交易建议'
}

export interface SentimentMetrics {
  score: number;        // -1 到 1
  confidence: number;   // 0 到 1
  intensity: number;    // 0 到 10
  decay: number;        // 0 到 1
  disagreement: number; // 0 到 1
}

export interface AgentAction {
  id: string;
  role: AgentRole;
  status: 'idle' | 'working' | 'completed' | 'error';
  output?: string;
  score?: number; 
  sentimentMetrics?: SentimentMetrics; // 舆情专用结构化数据
  startTime?: number;
  endTime?: number;
}

export interface HistoryRecord {
  id: string;
  symbol: string;
  stockName: string;
  timestamp: string;
  taskName: string;
  reports: Record<string, { text: string; sources?: any[]; score?: number; sentimentMetrics?: SentimentMetrics }>;
  actions: AgentAction[];
  priceData: any[];
  sentimentData: any[];
  basePrice: number;
}

export type ModelType = 'gemini-3-pro-preview' | 'gemini-3-flash-preview' | 'gemini-flash-lite-latest';

export interface AgentModelSettings {
  [key: string]: ModelType;
}
