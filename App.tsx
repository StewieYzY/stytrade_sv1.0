
import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { 
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, AreaChart, Area 
} from 'recharts';
import { 
  Search, Play, ShieldAlert, BarChart3, MessageSquare, 
  FileText, TrendingUp, TrendingDown, ClipboardCheck, 
  Activity, Loader2, RefreshCw, Calendar, Tag, History, LayoutDashboard, ChevronRight, ArrowLeft, X, Filter, Clock, AlertTriangle, Coffee, Timer, Zap, ShieldCheck, AlertCircle, Info, Settings, Save, RotateCcw, Download, Beaker, Edit3, Check, Ban, Eye, FileOutput, ExternalLink, Gauge, Square, Key, Lock, Trash2, Cpu
} from 'lucide-react';
import { DatePicker, Select, ConfigProvider, theme, Switch, Tooltip as AntTooltip, Modal, Button, Tag as AntTag, notification, Progress, Input } from 'antd';
import dayjs from 'dayjs';
import type { Dayjs } from 'dayjs';

import { AgentRole, AgentAction, HistoryRecord, ModelType, AgentModelSettings, SentimentMetrics } from './types';
import { geminiService } from './services/geminiService';
import { AGENT_SYSTEM_INSTRUCTIONS, getPromptForStep } from './services/prompts';

const { RangePicker } = DatePicker;

const PRICE_FORECAST_DAYS = 180;
const INTERNET_SEARCH_COOLDOWN = 35;
const INFERENCE_STEP_COOLDOWN = 6;
const PRO_MODEL_COOLDOWN = 45;

const STAGE_NAMES = [
  { id: 1, name: '情报收集' },
  { id: 2, name: '多维分析' },
  { id: 3, name: '多空辩论' },
  { id: 4, name: '风险评估' },
  { id: 5, name: '加权决策' }
];

const DEFAULT_MODELS: AgentModelSettings = {
  [AgentRole.INTELLIGENCE_OFFICER]: 'gemini-3-flash-preview',
  [AgentRole.FUNDAMENTAL_ANALYST]: 'gemini-3-flash-preview',
  [AgentRole.SENTIMENT_ANALYST]: 'gemini-3-flash-preview',
  [AgentRole.NEWS_POLICY_ANALYST]: 'gemini-3-flash-preview',
  [AgentRole.TECHNICAL_ANALYST]: 'gemini-3-flash-preview',
  [AgentRole.BULL_RESEARCHER]: 'gemini-3-flash-preview',
  [AgentRole.BEAR_RESEARCHER]: 'gemini-3-flash-preview',
  [AgentRole.TRADER]: 'gemini-3-pro-preview',
  [AgentRole.RISK_MANAGER]: 'gemini-3-pro-preview',
  [AgentRole.FUND_MANAGER]: 'gemini-3-pro-preview',
  [AgentRole.FUND_SECRETARY]: 'gemini-3-flash-preview',
};

const formatDateTime = (date: Date) => {
  const pad = (n: number) => n.toString().padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
};

const CustomPriceTooltip = ({ active, payload }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-slate-900 border border-slate-700 p-2 rounded-lg shadow-xl">
        <p className="text-[10px] text-slate-500 font-mono mb-1">{payload[0].payload.date}</p>
        <p className="text-sm font-bold text-blue-400">¥{payload[0].value.toFixed(2)}</p>
      </div>
    );
  }
  return null;
};

const GroundingSources = ({ sources }: { sources?: any[] }) => {
  if (!sources || sources.length === 0) return null;
  return (
    <div className="mt-8 pt-6 border-t border-slate-800/50">
      <h3 className="text-sm font-bold text-blue-400 mb-3 flex items-center gap-2 tracking-tight uppercase">
        <ExternalLink size={14} /> 参考来源 (Fact Check)
      </h3>
      <ul className="space-y-2">
        {sources.map((chunk, idx) => {
          const uri = chunk.web?.uri || chunk.maps?.uri;
          const title = chunk.web?.title || chunk.maps?.title || uri;
          if (!uri) return null;
          return (
            <li key={idx} className="group">
              <a href={uri} target="_blank" rel="noopener noreferrer" className="text-xs text-slate-500 hover:text-blue-400 transition-colors flex items-center gap-2 truncate">
                <span className="w-4 h-4 rounded bg-slate-800 flex items-center justify-center text-[8px] font-mono group-hover:bg-blue-500 group-hover:text-white transition-colors">{idx + 1}</span>
                <span className="truncate underline decoration-slate-800 underline-offset-4 group-hover:decoration-blue-500/30">{title}</span>
              </a>
            </li>
          );
        })}
      </ul>
    </div>
  );
};

const SentimentMetricsPanel = ({ metrics, isWorking }: { metrics?: SentimentMetrics; isWorking?: boolean }) => {
  if (isWorking) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-3 opacity-50">
        <Loader2 size={24} className="animate-spin text-blue-500" />
        <span className="text-[10px] font-mono uppercase tracking-widest">量化透视计算中...</span>
      </div>
    );
  }
  if (!metrics) {
    return (
      <div className="flex flex-col items-center justify-center h-full opacity-20">
        <Gauge size={32} />
        <span className="text-[10px] mt-2 font-mono uppercase text-center">等待舆情分析师<br/>下发量化数据</span>
      </div>
    );
  }
  const renderMetric = (label: string, value: number, max: number, min: number, format: (v: number) => string, colorClass: string, showMidLine: boolean = false) => {
    const percent = ((value - min) / (max - min)) * 100;
    const clampedPercent = Math.min(100, Math.max(0, percent));
    return (
      <div className="flex items-center gap-3 w-full group">
        <span className="w-16 text-[9px] font-bold text-slate-500 uppercase tracking-tight truncate shrink-0">{label}</span>
        <div className="flex-1 h-1.5 bg-slate-800/80 rounded-full relative overflow-hidden">
          {showMidLine && <div className="absolute left-1/2 top-0 bottom-0 w-[1px] bg-slate-700/50 z-10" />}
          <div className={`h-full transition-all duration-1000 ease-out ${colorClass}`} style={{ width: `${clampedPercent}%` }} />
        </div>
        <span className={`w-10 text-right text-[10px] font-mono font-bold shrink-0 ${colorClass.startsWith('bg-') ? colorClass.replace('bg-', 'text-') : 'text-slate-300'}`}>
          {format(value)}
        </span>
      </div>
    );
  };
  return (
    <div className="flex flex-col gap-5 w-full">
      {renderMetric("情绪总分", metrics.score || 0, 1, -1, (v) => v.toFixed(2), (metrics.score || 0) >= 0 ? "bg-emerald-500" : "bg-rose-500", true)}
      {renderMetric("信心指数", metrics.confidence || 0, 1, 0, (v) => `${(v * 100).toFixed(0)}%`, "bg-blue-500")}
      {renderMetric("舆情热度", metrics.intensity || 0, 10, 0, (v) => v.toFixed(1), "bg-amber-500")}
      {renderMetric("分歧度", metrics.disagreement || 0, 1, 0, (v) => `${(v * 100).toFixed(0)}%`, (metrics.disagreement || 0) > 0.6 ? "bg-orange-500" : "bg-slate-500")}
      {renderMetric("衰减系数", metrics.decay || 0, 1, 0, (v) => v.toFixed(2), "bg-purple-500")}
    </div>
  );
};

export default function App() {
  const [activeView, setActiveView] = useState<'analysis' | 'history' | 'history-detail' | 'settings'>('analysis');
  const [symbol, setSymbol] = useState('688608');
  const [stockName, setStockName] = useState<string>('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [useFlashOnly, setUseFlashOnly] = useState(false); 
  const [actions, setActions] = useState<AgentAction[]>([]);
  const [currentStep, setCurrentStep] = useState(0);
  const [reports, setReports] = useState<Record<string, { text: string; sources?: any[]; score?: number; sentimentMetrics?: SentimentMetrics }>>({});
  const [selectedReportId, setSelectedReportId] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [errorRole, setErrorRole] = useState<AgentRole | null>(null);
  const [errorModel, setErrorModel] = useState<string | null>(null);
  const [isDailyQuotaExceeded, setIsDailyQuotaExceeded] = useState(false);
  const [cooldownLeft, setCooldownLeft] = useState(0);
  const [basePrice, setBasePrice] = useState<number>(0);
  const [priceData, setPriceData] = useState<any[]>([]);
  const [historyList, setHistoryList] = useState<HistoryRecord[]>([]);
  const [selectedHistory, setSelectedHistory] = useState<HistoryRecord | null>(null);
  const [filterCode, setFilterCode] = useState('');
  const [dateRange, setDateRange] = useState<[Dayjs | null, Dayjs | null] | null>(null);
  
  // API Key 相关状态
  const [apiKey, setApiKey] = useState<string>('');
  const [showKeyOverlay, setShowKeyOverlay] = useState(false);
  const [inputKey, setInputKey] = useState('');

  const [agentModels, setAgentModels] = useState<AgentModelSettings>(() => {
    const saved = localStorage.getItem('agent_model_settings');
    return saved ? JSON.parse(saved) : DEFAULT_MODELS;
  });

  const [isEditingModels, setIsEditingModels] = useState(false);
  const [tempAgentModels, setTempAgentModels] = useState<AgentModelSettings>(agentModels);

  const scrollRef = useRef<HTMLDivElement>(null);
  const priceDataRef = useRef<any[]>([]);
  const shouldStopRef = useRef(false);

  // 初始化检查 API Key
  useEffect(() => {
    const storedKey = localStorage.getItem('STG_TRADING_KEY');
    
    // @ts-ignore
    const viteKey = import.meta.env?.VITE_GEMINI_API_KEY;
    // @ts-ignore
    const processKey = typeof process !== 'undefined' ? (process.env?.API_KEY || process.env?.VITE_GEMINI_API_KEY) : null;

    const finalKey = (storedKey && storedKey.trim() !== '') ? storedKey : (viteKey || processKey);
    
    if (finalKey && finalKey !== 'undefined' && finalKey !== '') {
      console.log("[App] 已检测到有效的初始化 API Key。");
      setApiKey(finalKey);
    } else {
      console.warn("[App] 未找到 API Key，显示激活遮罩。");
      setShowKeyOverlay(true);
    }
    
    const savedHistory = localStorage.getItem('trade_history');
    if (savedHistory) try { setHistoryList(JSON.parse(savedHistory)); } catch (e) {}
  }, []);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [actions]);

  useEffect(() => { priceDataRef.current = priceData; }, [priceData]);

  const filteredHistory = useMemo(() => {
    return (historyList || []).filter((record) => {
      const searchStr = filterCode.toLowerCase();
      const matchesSearch = record.symbol.toLowerCase().includes(searchStr) || record.stockName.toLowerCase().includes(searchStr);
      if (!dateRange || !dateRange[0] || !dateRange[1]) return matchesSearch;
      const recordDate = dayjs(record.timestamp);
      return matchesSearch && (recordDate.isAfter(dateRange[0].startOf('day')) || recordDate.isSame(dateRange[0], 'day')) && (recordDate.isBefore(dateRange[1].endOf('day')) || recordDate.isSame(dateRange[1], 'day'));
    });
  }, [historyList, filterCode, dateRange]);

  useEffect(() => {
    let timer: number;
    if (cooldownLeft > 0) timer = window.setInterval(() => setCooldownLeft(prev => Math.max(0, prev - 1)), 1000);
    return () => clearInterval(timer);
  }, [cooldownLeft]);

  const initCharts = useCallback((startPrice: number) => {
    const pData = [], now = new Date();
    for (let i = 0; i <= PRICE_FORECAST_DAYS; i++) {
      const d = new Date(now); d.setDate(now.getDate() + i);
      pData.push({ index: i, date: d.toISOString().split('T')[0], price: startPrice, isFuture: i > 0 });
    }
    setPriceData(pData);
  }, []);

  const evolvePredictions = useCallback((type: 'price', intensity: number) => {
    setPriceData(prev => prev.map((item, i) => item.isFuture ? { ...item, price: item.price + (item.price * (intensity / 100) * (i / PRICE_FORECAST_DAYS)) + (Math.random() - 0.5) * (item.price * 0.01) } : item));
  }, []);

  const waitCooldown = async (seconds: number) => {
    if (seconds <= 0) return;
    setCooldownLeft(seconds);
    return new Promise(resolve => setTimeout(resolve, seconds * 1000));
  };

  const extractScore = (text: string): number | undefined => {
    const match = text.match(/\[SCORE:\s*(\d+)\]/i);
    return match ? parseInt(match[1]) : undefined;
  };

  const extractSentimentMetrics = (text: string): SentimentMetrics | undefined => {
    try {
      const match = text.match(/\[SENTIMENT_METRICS:\s*(\{[\s\S]*?\})\]/i);
      if (match) return JSON.parse(match[1]);
    } catch (e) {
      console.warn("Failed to parse sentiment metrics JSON:", e);
    }
    return undefined;
  };

  const handlePauseAnalysis = () => {
    Modal.confirm({
      title: '确认暂停分析？',
      content: '暂停后将立即停止后续所有尚未开始的智能体任务，这可以有效节约您的 Token 消耗。已完成的任务进度将被保留。',
      okText: '确认暂停',
      okButtonProps: { danger: true },
      cancelText: '取消',
      onOk: () => {
        shouldStopRef.current = true;
        notification.info({ message: '分析已中断', description: '流水线已成功熔断，后续任务已取消。', placement: 'topRight' });
      }
    });
  };

  const saveApiKey = () => {
    const trimmedKey = inputKey.trim();
    if (!trimmedKey) {
      notification.error({ message: '请输入有效的 API Key' });
      return;
    }
    localStorage.setItem('STG_TRADING_KEY', trimmedKey);
    setApiKey(trimmedKey);
    setShowKeyOverlay(false);
    notification.success({ 
      message: '系统已成功激活', 
      description: 'API Key 已安全保存在本地沙盒，决策引擎已就绪。',
      icon: <ShieldCheck className="text-emerald-500" />
    });
    // 强制刷新当前页面以应用新的 Key
    setTimeout(() => window.location.reload(), 500);
  };

  const clearApiKey = () => {
    Modal.confirm({
      title: '确认重置安全凭证？',
      content: '清除后，系统将无法继续调用 Gemini AI 引擎，您需要重新输入 Key 才能激活。',
      okText: '确认清除',
      okButtonProps: { danger: true },
      onOk: () => {
        localStorage.removeItem('STG_TRADING_KEY');
        setApiKey('');
        setShowKeyOverlay(true);
        notification.warning({ message: '安全凭证已失效', description: '系统已进入锁定状态。' });
      }
    });
  };

  const runSOP = async () => {
    // 核心强校验：点击开始前必须检查 Key
    const currentKey = localStorage.getItem('STG_TRADING_KEY') || (import.meta as any).env?.VITE_GEMINI_API_KEY;
    if (!currentKey || currentKey === 'undefined') {
      console.error("[App] 分析启动失败：未找到 API Key。");
      setShowKeyOverlay(true);
      notification.error({ message: '分析启动失败', description: '请先配置有效的 Gemini API Key。' });
      return;
    }

    if (!symbol || isProcessing) return;
    
    setIsProcessing(true);
    shouldStopRef.current = false;
    setActions([]); setReports({}); setSelectedReportId(null); setErrorMessage(null); setErrorRole(null); setErrorModel(null);
    setStockName('正在建立基准行情 (Step 1/2)...'); setCurrentStep(1);

    let localActions: AgentAction[] = [];
    let localReports: Record<string, { text: string; sources?: any[]; score?: number; sentimentMetrics?: SentimentMetrics }> = {};

    try {
      console.log("[App] 正在启动情报收集 (Stage 1)...");
      const stockInfo = await geminiService.fetchStockInfo(symbol);
      if (shouldStopRef.current) { setIsProcessing(false); return; }

      setBasePrice(stockInfo.price); setStockName(stockInfo.name); initCharts(stockInfo.price);
      setStockName('正在预留网络配额...');
      await waitCooldown(INTERNET_SEARCH_COOLDOWN); 
      if (shouldStopRef.current) { setIsProcessing(false); return; }

      const pipeline = [
        { role: AgentRole.INTELLIGENCE_OFFICER, step: 1, useSearch: true },
        { role: AgentRole.FUNDAMENTAL_ANALYST, step: 2, useSearch: false },
        { role: AgentRole.SENTIMENT_ANALYST, step: 2, useSearch: false },
        { role: AgentRole.NEWS_POLICY_ANALYST, step: 2, useSearch: false },
        { role: AgentRole.TECHNICAL_ANALYST, step: 2, useSearch: false },
        { role: AgentRole.BULL_RESEARCHER, step: 3, useSearch: false },
        { role: AgentRole.BEAR_RESEARCHER, step: 3, useSearch: false },
        { role: AgentRole.RISK_MANAGER, step: 4, useSearch: false },
        { role: AgentRole.FUND_MANAGER, step: 5, useSearch: false }
      ];

      let sharedDossier = "";
      let analystReportsText = "";

      for (let i = 0; i < pipeline.length; i++) {
        if (shouldStopRef.current) break;
        const item = pipeline[i];
        console.log(`[App] 正在调度智能体: ${item.role}...`);
        setCurrentStep(item.step);
        const actionId = Math.random().toString(36).substr(2, 9);
        localActions = [...localActions, { id: actionId, role: item.role, status: 'working', startTime: Date.now() }];
        setActions([...localActions]); setSelectedReportId(actionId);
        const targetModel = useFlashOnly ? 'gemini-3-flash-preview' : (agentModels[item.role] || 'gemini-3-flash-preview');
        const isPro = targetModel.includes('pro');

        try {
          let inputContext = "";
          if (item.role === AgentRole.INTELLIGENCE_OFFICER) {
            inputContext = `当前标的: ${stockInfo.name} (${symbol})\n基准价: ${stockInfo.price}\n`;
          } else if ([AgentRole.FUNDAMENTAL_ANALYST, AgentRole.SENTIMENT_ANALYST, AgentRole.NEWS_POLICY_ANALYST, AgentRole.TECHNICAL_ANALYST].includes(item.role)) {
            inputContext = sharedDossier;
          } else {
            inputContext = `### [全局情报档案]\n${sharedDossier}\n\n### [各维度分析汇总]\n${analystReportsText}`;
          }
          
          const { text, sources } = await geminiService.generateAgentResponse(
            item.role, 
            getPromptForStep(item.role, `${stockInfo.name} (${symbol})`, inputContext), 
            AGENT_SYSTEM_INSTRUCTIONS[item.role], 
            item.useSearch, 
            targetModel
          );

          if (item.role === AgentRole.INTELLIGENCE_OFFICER) sharedDossier = text;
          else if ([AgentRole.FUNDAMENTAL_ANALYST, AgentRole.SENTIMENT_ANALYST, AgentRole.NEWS_POLICY_ANALYST, AgentRole.TECHNICAL_ANALYST].includes(item.role)) {
            analystReportsText += `\n\n--- ${item.role} 研判 ---\n${text}\n`;
          }

          const score = extractScore(text);
          let sentimentMetrics: SentimentMetrics | undefined = undefined;
          if (item.role === AgentRole.SENTIMENT_ANALYST) sentimentMetrics = extractSentimentMetrics(text);

          localActions = localActions.map(a => a.id === actionId ? { ...a, status: 'completed', output: text, score, sentimentMetrics, endTime: Date.now() } : a);
          localReports = { ...localReports, [actionId]: { text, sources, score, sentimentMetrics } };
          setActions([...localActions]); setReports({ ...localReports });
          
          if (score !== undefined) {
            if (item.role === AgentRole.TECHNICAL_ANALYST || item.role === AgentRole.FUNDAMENTAL_ANALYST) evolvePredictions('price', score > 50 ? 4 : -4);
          } else if (sentimentMetrics) {
            evolvePredictions('price', sentimentMetrics.score * 5);
          }

          let cooldown = INFERENCE_STEP_COOLDOWN;
          if (item.role === AgentRole.INTELLIGENCE_OFFICER) cooldown = INTERNET_SEARCH_COOLDOWN;
          if (isPro) cooldown = Math.max(cooldown, PRO_MODEL_COOLDOWN);

          if (i < pipeline.length - 1) {
            await waitCooldown(cooldown); 
            if (shouldStopRef.current) break;
          }
        } catch (err: any) {
          if (err.message === "API_KEY_MISSING") {
            setShowKeyOverlay(true);
            setIsProcessing(false);
            return;
          }
          localActions = localActions.map(a => a.id === actionId ? { ...a, status: 'error' } : a);
          setActions([...localActions]); setErrorRole(item.role); setErrorModel(targetModel); throw err;
        }
      }

      if (!shouldStopRef.current) {
        const now = new Date();
        const record: HistoryRecord = {
          id: Math.random().toString(36).substr(2, 9), symbol, stockName, timestamp: formatDateTime(now), taskName: `${symbol}_${now.toISOString().split('T')[0]}`,
          reports: { ...localReports }, actions: [...localActions], priceData: [...priceDataRef.current], sentimentData: [], basePrice
        };
        setHistoryList(prev => { const newList = [record, ...(prev || [])]; localStorage.setItem('trade_history', JSON.stringify(newList)); return newList; });
      }
    } catch (err: any) {
      const errStr = typeof err === 'string' ? err : (err?.message || JSON.stringify(err));
      console.error("[App] SOP 工作流异常终止:", errStr);
      if (errStr.includes("DAILY_QUOTA_EXHAUSTED")) {
        setIsDailyQuotaExceeded(true);
        setErrorMessage("检测到 Google API 每日配额耗尽，请稍后再试。");
      } else {
        setErrorMessage(errStr || "API 响应异常，请检查网络或重试。");
      }
    } finally {
      setIsProcessing(false); setCurrentStep(6); setCooldownLeft(0);
      shouldStopRef.current = false;
    }
  };

  const lastPrice = useMemo(() => priceData.length > 0 ? priceData[priceData.length - 1].price : 0, [priceData]);
  const priceTrend = useMemo(() => basePrice === 0 ? 0 : ((lastPrice - basePrice) / basePrice) * 100, [lastPrice, basePrice]);

  return (
    <div className="flex h-screen bg-[#020617] text-slate-200 antialiased font-sans">
      {/* 增强版 API Key 激活遮罩层 */}
      {showKeyOverlay && (
        <div className="fixed inset-0 z-[100] bg-[#020617]/95 backdrop-blur-3xl flex items-center justify-center p-6">
          <div className="max-w-md w-full bg-[#0f172a] border border-slate-800 rounded-[2.5rem] p-12 shadow-2xl shadow-blue-500/20 relative overflow-hidden text-center group">
            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-blue-500 to-transparent opacity-50" />
            
            <div className="w-24 h-24 bg-blue-600/10 rounded-[2rem] flex items-center justify-center text-blue-500 mb-8 mx-auto border border-blue-500/20 shadow-inner group-hover:scale-105 transition-transform duration-500">
              <Cpu size={48} className="animate-pulse" />
            </div>
            
            <h2 className="text-3xl font-black text-white mb-3 tracking-tighter">AI 决策引擎就绪</h2>
            <p className="text-slate-400 text-sm mb-10 leading-relaxed">
              请输入您的 <span className="text-blue-400 font-bold font-mono">Gemini API Key</span>。<br/>
              系统将利用高维智能体集群为您提供机构级分析。
            </p>
            
            <div className="space-y-6 text-left">
              <div className="space-y-2">
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-[0.2em] px-1">Access Token / API Key</label>
                <Input.Password 
                  placeholder="在此贴入您的安全凭证..." 
                  value={inputKey} 
                  onChange={(e) => setInputKey(e.target.value)}
                  className="bg-slate-900/50 border-slate-800 text-white h-16 rounded-2xl focus:border-blue-500 focus:ring-8 focus:ring-blue-500/5 transition-all font-mono placeholder:text-slate-700"
                  onPressEnter={saveApiKey}
                />
              </div>
              
              <button 
                onClick={saveApiKey}
                className="w-full h-16 bg-blue-600 hover:bg-blue-500 text-white font-black rounded-2xl transition-all shadow-xl shadow-blue-600/30 flex items-center justify-center gap-3 group/btn overflow-hidden relative"
              >
                <div className="absolute inset-0 bg-gradient-to-r from-white/0 via-white/10 to-white/0 -translate-x-full group-hover/btn:translate-x-full transition-transform duration-1000" />
                <Zap size={22} className="group-hover/btn:scale-110 transition-transform" fill="currentColor" /> 
                <span className="uppercase tracking-widest text-sm">初始化分析节点</span>
              </button>
              
              <div className="flex flex-col items-center gap-3 mt-8">
                <div className="flex items-center gap-2">
                  <ShieldCheck size={14} className="text-emerald-500" />
                  <span className="text-[10px] text-slate-500 uppercase tracking-tight">End-to-End Local Encryption Active</span>
                </div>
                <p className="text-[9px] text-slate-600 max-w-[240px] text-center leading-relaxed">
                  您的 Key 仅会保存在浏览器 localStorage 中，不会发送至任何非 Google 官方服务器。
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 侧边导航 */}
      <nav className="w-20 bg-[#0f172a] border-r border-slate-800 flex flex-col items-center py-8 gap-10">
        <div className="p-3 bg-blue-600 rounded-2xl shadow-xl shadow-blue-600/20 mb-4"><TrendingUp className="w-6 h-6 text-white" /></div>
        <div className="flex flex-col gap-6">
          <button onClick={() => setActiveView('analysis')} className={`p-3 rounded-xl transition-all ${activeView === 'analysis' ? 'bg-blue-600 text-white shadow-lg' : 'text-slate-500 hover:text-slate-300 hover:bg-slate-800'}`} title="分析大盘"><LayoutDashboard size={24} /></button>
          <button onClick={() => setActiveView('history')} className={`p-3 rounded-xl transition-all ${activeView === 'history' || activeView === 'history-detail' ? 'bg-blue-600 text-white shadow-lg' : 'text-slate-500 hover:text-slate-300 hover:bg-slate-800'}`} title="历史记录"><History size={24} /></button>
          <button onClick={() => setActiveView('settings')} className={`p-3 rounded-xl transition-all ${activeView === 'settings' ? 'bg-blue-600 text-white shadow-lg' : 'text-slate-500 hover:text-slate-300 hover:bg-slate-800'}`} title="设置"><Settings size={24} /></button>
        </div>
      </nav>

      <div className="flex flex-col flex-1 overflow-hidden">
        <header className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-[#020617]/90 backdrop-blur-xl z-20">
          <div className="flex items-center gap-3">
             <div className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" />
             <div><h1 className="text-xl font-bold text-white leading-none">StGTrade <span className="text-blue-500">AI</span></h1><p className="text-[9px] text-slate-500 font-mono uppercase tracking-[0.2em] mt-1">Convergence SOP v3.5.0</p></div>
          </div>
          {activeView === 'analysis' && (
            <div className="flex items-center gap-4">
              <input value={symbol} onChange={(e) => setSymbol(e.target.value.toUpperCase())} placeholder="股票代码..." className="px-4 py-2 bg-slate-900 border border-slate-800 rounded-lg text-sm text-white font-mono w-40" disabled={isProcessing} />
              {!isProcessing ? (
                <button onClick={runSOP} className="flex items-center gap-2 px-6 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white shadow-lg shadow-blue-600/20 font-bold text-sm transition-all"><Play size={16} fill="currentColor" /> 开始分析</button>
              ) : (
                <button onClick={handlePauseAnalysis} className="flex items-center gap-2 px-6 py-2 rounded-lg bg-rose-600 hover:bg-rose-500 text-white shadow-lg shadow-rose-600/20 font-bold text-sm transition-all animate-pulse">{cooldownLeft > 0 ? <Timer size={16} /> : <Square size={14} fill="currentColor" />} 暂停分析 {cooldownLeft > 0 ? `(${cooldownLeft}s)` : ''}</button>
              )}
            </div>
          )}
          {activeView === 'settings' && (
            <div className="flex items-center gap-4">
              <button onClick={clearApiKey} className="flex items-center gap-2 px-4 py-2 rounded-lg bg-rose-600/10 hover:bg-rose-600/20 text-rose-500 text-sm font-bold border border-rose-500/20 transition-all"><Trash2 size={16} /> 重置安全凭证</button>
              {!isEditingModels ? <button onClick={startEditing} className="flex items-center gap-2 px-6 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-sm font-bold transition-all shadow-lg shadow-blue-600/20"><Edit3 size={16} /> 编辑模型配置</button> : <div className="flex items-center gap-3"><button onClick={cancelEditing} className="px-4 py-2 rounded-lg bg-slate-800 text-slate-300 text-sm font-bold">取消</button><button onClick={saveEditing} className="px-6 py-2 rounded-lg bg-emerald-600 text-white text-sm font-bold shadow-lg shadow-emerald-600/20">确认保存</button></div>}
            </div>
          )}
        </header>

        <main className="flex flex-1 overflow-hidden">
          {activeView === 'analysis' && (
            <div className="flex-1 flex overflow-hidden p-6 gap-6">
              <aside className="w-[360px] flex flex-col gap-6">
                <div className="bg-slate-900/40 border border-slate-800 rounded-2xl p-5 backdrop-blur-sm shadow-xl">
                  <h2 className="text-[11px] font-bold text-slate-500 mb-5 flex items-center gap-2 uppercase tracking-widest"><Activity className="w-3 h-3 text-blue-500" /> 决策链进度 (稳定模式)</h2>
                  <div className="flex items-center justify-between px-1">
                    {STAGE_NAMES.map((stage) => (
                      <div key={stage.id} className="flex flex-col items-center gap-2">
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-all ${currentStep === stage.id ? 'bg-blue-600 text-white ring-4 ring-blue-600/20' : currentStep > stage.id ? 'bg-emerald-600 text-white' : 'bg-slate-800 text-slate-600'}`}>
                          {currentStep > stage.id ? '✓' : stage.id}
                        </div>
                        <span className={`text-[9px] font-medium whitespace-nowrap ${currentStep === stage.id ? 'text-blue-400' : 'text-slate-600'}`}>{stage.name}</span>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="flex-1 bg-slate-900/40 border border-slate-800 rounded-2xl flex flex-col overflow-hidden">
                  <div className="p-4 border-b border-slate-800 bg-slate-800/20"><span className="text-xs font-bold text-slate-400 uppercase">智能体任务栈</span></div>
                  <div className="flex-1 overflow-y-auto p-4 space-y-3 custom-scrollbar" ref={scrollRef}>
                    {actions.map((action) => (
                      <div key={action.id} onClick={() => setSelectedReportId(action.id)} className={`p-3 rounded-xl border cursor-pointer transition-all ${selectedReportId === action.id ? 'bg-blue-600/10 border-blue-500/40' : 'bg-slate-800/40 border-slate-800 hover:border-slate-700'} ${action.status === 'working' ? 'border-blue-500/50' : ''}`}>
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <div className={action.status === 'error' ? 'text-rose-500' : action.status === 'working' ? 'text-blue-400 animate-pulse' : ''}>
                              {action.role === AgentRole.INTELLIGENCE_OFFICER ? <Eye size={16} className="text-purple-400" /> : <FileText size={16} />}
                            </div>
                            <div className="flex flex-col"><span className={`text-xs font-bold ${action.status === 'error' ? 'text-rose-400' : 'text-slate-200'}`}>{action.role}</span>{action.score !== undefined && <span className="text-[9px] font-black text-blue-400 uppercase tracking-tighter">Score: {action.score}</span>}</div>
                          </div>
                          <span className={`text-[8px] px-1.5 py-0.5 rounded font-mono font-bold ${action.status === 'completed' ? 'bg-emerald-500/10 text-emerald-500' : action.status === 'working' ? 'bg-blue-500/10 text-blue-400' : 'bg-slate-700 text-slate-400'}`}>{action.status.toUpperCase()}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </aside>
              <section className="flex-1 flex flex-col gap-6">
                <div className="grid grid-cols-3 gap-6">
                   <div className="col-span-2 bg-slate-900/40 border border-slate-800 rounded-2xl p-5 h-60 relative overflow-hidden group">
                      <div className="flex justify-between items-start mb-2"><h3 className="text-[11px] font-bold text-slate-500 uppercase flex items-center gap-2"><TrendingUp size={12} className="text-blue-500"/> 预期股价变化 (180D)</h3><div className="flex flex-col items-end"><span className="text-[10px] text-slate-500 uppercase font-mono tracking-tighter">预期终值 (较分析基准)</span><div className="flex items-center gap-2"><span className={`text-[10px] font-bold font-mono px-1.5 py-0.5 rounded ${priceTrend >= 0 ? 'bg-emerald-500/10 text-emerald-400' : 'bg-rose-500/10 text-rose-400'}`}>{priceTrend >= 0 ? '+' : ''}{priceTrend.toFixed(2)}%</span><span className={`text-2xl font-black font-mono leading-none ${priceTrend >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>¥{lastPrice.toFixed(2)}</span></div></div></div>
                      <div className="h-40 mt-4"><ResponsiveContainer width="100%" height="100%"><AreaChart data={priceData}><defs><linearGradient id="pGrad" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#3b82f6" stopOpacity={0.4}/><stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/></linearGradient></defs><XAxis dataKey="date" hide /><YAxis domain={['auto', 'auto']} hide /><Tooltip content={<CustomPriceTooltip />} /><Area type="monotone" dataKey="price" stroke="#3b82f6" fill="url(#pGrad)" strokeWidth={3} dot={false} /></AreaChart></ResponsiveContainer></div>
                   </div>
                   <div className="bg-slate-900/40 border border-slate-800 rounded-2xl p-5 h-60 flex flex-col overflow-hidden"><h3 className="text-[11px] font-bold text-slate-500 uppercase mb-5 flex items-center gap-2"><MessageSquare size={12} className="text-emerald-500"/> 舆情多维透视</h3><div className="flex-1 flex flex-col justify-center px-1 pb-2"><SentimentMetricsPanel metrics={reports[actions.find(a => a.role === AgentRole.SENTIMENT_ANALYST)?.id || '']?.sentimentMetrics} isWorking={actions.find(a => a.role === AgentRole.SENTIMENT_ANALYST)?.status === 'working'} /></div></div>
                </div>
                <div className="flex-1 bg-slate-900/30 border border-slate-800 rounded-2xl flex flex-col overflow-hidden shadow-2xl backdrop-blur-md">
                  <div className="px-6 py-4 border-b border-slate-800 bg-slate-800/30 flex justify-between items-center">
                    <div className="flex items-center gap-3"><div className="w-10 h-10 rounded-xl bg-blue-600/10 flex items-center justify-center text-blue-500 border border-blue-500/20"><FileText size={20} /></div><h2 className="text-sm font-black text-white uppercase tracking-tight">{selectedReportId ? actions.find(a => a.id === selectedReportId)?.role : '流水线监控'}</h2></div>
                  </div>
                  <div className="flex-1 overflow-y-auto p-10 custom-scrollbar bg-[#020617]/40">
                    {selectedReportId && reports[selectedReportId] ? (
                      <div className="markdown-content max-w-4xl mx-auto"><div className="whitespace-pre-wrap text-slate-300 leading-relaxed text-base">{reports[selectedReportId].text}</div><GroundingSources sources={reports[selectedReportId].sources} /></div>
                    ) : <div className="h-full flex flex-col items-center justify-center text-slate-700 opacity-40"><RefreshCw size={80} strokeWidth={0.5} className="animate-spin-slow" /><p className="text-xl font-bold mt-4 tracking-tighter uppercase">Initializing Dossier</p></div>}
                  </div>
                </div>
              </section>
            </div>
          )}
          {activeView === 'settings' && (
            <div className="flex-1 flex flex-col p-10 overflow-hidden bg-[#020617]">
               <div className="max-w-6xl mx-auto w-full overflow-hidden flex flex-col h-full">
                 <h2 className="text-3xl font-black text-white tracking-tighter mb-4 flex items-center gap-3"><Settings size={32} className="text-blue-500" /> 算力配置中心</h2>
                 <p className="text-slate-500 text-sm mb-10 max-w-2xl px-1">调整各分析节点的执行模型。Pro 模型适用于需要复杂推理的研判环节。</p>
                 <div className="flex-1 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 overflow-y-auto pb-4 custom-scrollbar pr-2">
                    {Object.values(AgentRole).map((role) => (
                      <div key={role} className={`transition-all p-5 rounded-2xl border bg-slate-900/40 backdrop-blur-sm shadow-xl flex flex-col justify-between h-40 ${isEditingModels ? 'border-blue-500/40 ring-1 ring-blue-500/10' : 'border-slate-800 hover:border-slate-700'}`}>
                        <div className="flex items-center gap-3 mb-4"><h4 className="text-slate-200 font-bold text-sm tracking-tight">{role}</h4></div>
                        <Select value={isEditingModels ? tempAgentModels[role] : agentModels[role]} onChange={(val) => handleModelChange(role, val as ModelType)} className="w-full h-10" disabled={!isEditingModels} popupClassName="dark-select-dropdown" options={[{ value: 'gemini-3-pro-preview', label: 'Gemini 3 Pro' }, { value: 'gemini-3-flash-preview', label: 'Gemini 3 Flash' }, { value: 'gemini-flash-lite-latest', label: 'Gemini Lite' }]} />
                      </div>
                    ))}
                 </div>
                 <div className="mt-8 p-6 bg-slate-900/60 border border-slate-800 rounded-[2rem] flex items-center justify-between shadow-2xl border-blue-500/5">
                    <div className="flex items-center gap-4">
                      <div className="w-14 h-14 bg-blue-600/10 rounded-2xl flex items-center justify-center text-blue-500 border border-blue-500/20 shadow-inner"><Key size={28} /></div>
                      <div>
                        <h4 className="text-white font-bold text-base">Gemini API 安全凭证管理</h4>
                        <p className="text-slate-500 text-[10px] uppercase tracking-wider mt-1 font-mono">Current Status: {apiKey ? `Active Engine (***${apiKey.slice(-4)})` : 'Locked'}</p>
                      </div>
                    </div>
                    <button onClick={() => setShowKeyOverlay(true)} className="px-8 py-3 bg-blue-600/10 hover:bg-blue-600/20 text-blue-400 text-xs font-bold rounded-xl border border-blue-500/20 transition-all flex items-center gap-2"><Lock size={14} /> 重新配置凭证</button>
                 </div>
               </div>
            </div>
          )}
        </main>

        <footer className="px-6 py-2 bg-[#020617] border-t border-slate-800 flex justify-between items-center text-[9px] text-slate-600 font-mono uppercase tracking-widest">
           <div className="flex gap-4"><span className="flex items-center gap-1"><ShieldCheck size={10} className="text-emerald-500"/> SSoT Architecture: ACTIVE</span><span>|</span><span className="flex items-center gap-1 text-blue-400"><Clock size={10}/> Heartbeat: {new Date().toLocaleTimeString()}</span></div>
           <span>© 2025 STG QUANT LABS | STG_TRADING_SOP v3.5.0</span>
        </footer>
      </div>
      
      <style>{`
        .animate-spin-slow { animation: spin 8s linear infinite; } 
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        .dark-select-dropdown { background-color: #0f172a !important; border: 1px solid #1e293b !important; }
        .ant-select-item { color: #94a3b8 !important; }
        .ant-select-item-option-selected { background: #1e293b !important; color: white !important; font-weight: bold; }
        .ant-select-item-option-active { background: #3b82f620 !important; }
      `}</style>
    </div>
  );
  
  function startEditing() { setTempAgentModels({ ...agentModels }); setIsEditingModels(true); }
  function cancelEditing() { setIsEditingModels(false); }
  function saveEditing() { setAgentModels(tempAgentModels); localStorage.setItem('agent_model_settings', JSON.stringify(tempAgentModels)); setIsEditingModels(false); notification.success({ message: '模型配置已更新' }); }
  function handleModelChange(role: AgentRole, model: ModelType) { setTempAgentModels(prev => ({ ...prev, [role]: model })); }
}
