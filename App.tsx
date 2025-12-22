import React, { useState, useEffect, useRef } from 'react';
import { AssetType, LiabilityType, AssetItem, LiabilityItem, CashFlowItem, FinancialState, Scenario, ChatMessage, SavedAdvice } from './types';
import { analyzeFinances, parseFinancialScreenshot, generateScenarioSummary } from './services/geminiService';
import { loginWithGoogle, logout, subscribeAuth, saveUserData, loadUserData } from './services/firebase';
import { AssetAllocationChart, NetWorthBarChart } from './components/Charts';
import { GoogleGenAI } from "@google/genai";
import { Plus, Trash2, DollarSign, TrendingUp, TrendingDown, Activity, AlertTriangle, CheckCircle, BrainCircuit, ScanLine, X, Loader2, PlayCircle, Save, LogOut, User as UserIcon, Pencil, ChevronRight, Calculator, Wallet, PiggyBank, Send, MessageSquare, History, Sparkles } from 'lucide-react';
import { User } from 'firebase/auth';

const initialAssets: AssetItem[] = [
  { id: '1', name: '台灣某科技私募', type: AssetType.PRIVATE_EQUITY, value: 2000000, liquidity: 'Low', returnRate: 15 },
  { id: '2', name: 'US Treasury 20Y', type: AssetType.US_BOND, value: 1500000, liquidity: 'High', returnRate: 4.5 },
  { id: '3', name: '存款保險', type: AssetType.DEPOSIT_INSURANCE, value: 500000, liquidity: 'Medium', returnRate: 2 },
  { id: '4', name: 'Global Tech Fund', type: AssetType.MUTUAL_FUND, value: 800000, liquidity: 'High', returnRate: 8 },
  { id: '5', name: '自住房屋', type: AssetType.REAL_ESTATE, value: 15000000, liquidity: 'Low', returnRate: 3 },
];

const initialLiabilities: LiabilityItem[] = [
  { id: '1', name: '房屋貸款', type: LiabilityType.MORTGAGE, amount: 12000000, interestRate: 2.1, monthlyPayment: 45000 },
];

const initialIncomes: CashFlowItem[] = [
  { id: '1', name: '薪資收入', amount: 80000, type: 'Income' },
  { id: '2', name: '債息收入', amount: 5000, type: 'Income' },
];

const initialExpenses: CashFlowItem[] = [
  { id: '1', name: '房貸支出', amount: 45000, type: 'Expense' },
  { id: '2', name: '生活費', amount: 30000, type: 'Expense' },
  { id: '3', name: '保險費', amount: 5000, type: 'Expense' },
  { id: '4', name: '孝親費', amount: 10000, type: 'Expense' },
];

export default function App() {
  const [activeTab, setActiveTab] = useState<'dashboard' | 'assets' | 'liabilities' | 'cashflow' | 'advisor' | 'import' | 'scenario'>('dashboard');
  const [financials, setFinancials] = useState<FinancialState>({
    assets: initialAssets,
    liabilities: initialLiabilities,
    incomes: initialIncomes,
    expenses: initialExpenses
  });

  const [user, setUser] = useState<User | null>(null);
  const [isGuest, setIsGuest] = useState(false);
  const [isAuthChecking, setIsAuthChecking] = useState(true);
  const [syncStatus, setSyncStatus] = useState<'synced' | 'saving' | 'offline'>('offline');
  const [dataLoaded, setDataLoaded] = useState(false);

  const [aiAnalysis, setAiAnalysis] = useState<any>(null);
  const [loadingAi, setLoadingAi] = useState(false);
  const [chatHistory, setChatHistory] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [isChatting, setIsChatting] = useState(false);
  const [savedAdvices, setSavedAdvices] = useState<SavedAdvice[]>([]);
  const chatEndRef = useRef<HTMLDivElement>(null);

  const [scenarios, setScenarios] = useState<Scenario[]>([]);
  const [editingScenario, setEditingScenario] = useState<{
    name: string;
    data: FinancialState;
    originalData: FinancialState;
  } | null>(null);
  const [generatingSummary, setGeneratingSummary] = useState(false);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalConfig, setModalConfig] = useState<any>(null);
  const [formData, setFormData] = useState<any>({});
  const [editingId, setEditingId] = useState<string | null>(null);

  useEffect(() => {
    const unsub = subscribeAuth((u) => {
      if (!isGuest) {
        setUser(u);
        setIsAuthChecking(false);
        if (u) {
          loadUserData(u.uid).then(data => {
            if (data) {
              setFinancials(data.financials);
              setScenarios(data.scenarios || []);
              setSavedAdvices(data.savedAdvices || []);
            }
            setDataLoaded(true);
            setSyncStatus('synced');
          });
        }
      }
    });
    return () => unsub();
  }, [isGuest]);

  useEffect(() => {
    if (user && dataLoaded && !isGuest) {
      setSyncStatus('saving');
      const timer = setTimeout(() => {
        saveUserData(user.uid, { financials, scenarios, savedAdvices })
          .then(() => setSyncStatus('synced'))
          .catch(() => setSyncStatus('offline'));
      }, 2000);
      return () => clearTimeout(timer);
    }
  }, [financials, scenarios, savedAdvices, user, dataLoaded, isGuest]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatHistory]);

  const calcMetrics = (data: FinancialState) => {
    const totalAssets = data.assets.reduce((sum, item) => sum + item.value, 0);
    const totalLiabilities = data.liabilities.reduce((sum, item) => sum + item.amount, 0);
    const totalIncome = data.incomes.reduce((sum, item) => sum + item.amount, 0);
    const totalExpenses = data.expenses.reduce((sum, item) => sum + item.amount, 0);
    return { 
      totalAssets, 
      totalLiabilities, 
      netWorth: totalAssets - totalLiabilities, 
      totalIncome, 
      totalExpenses, 
      monthlyCashFlow: totalIncome - totalExpenses 
    };
  };

  const currentMetrics = calcMetrics(financials);

  const normalize = (s: string) => s.replace(/[\s\-_支出費用貸款房貸信貸車貸]/g, '').toLowerCase();

  const toggleScenarioItem = (category: keyof FinancialState, item: any) => {
    if (!editingScenario) return;
    let newData = { ...editingScenario.data };
    const currentList = newData[category] as any[];
    const exists = currentList.find(x => x.id === item.id);
    
    if (exists) {
      newData[category] = currentList.filter(x => x.id !== item.id);
      // Smart Linkage: Unchecking liability removes similar named expense
      if (category === 'liabilities') {
        const liabilityName = normalize(item.name);
        newData.expenses = newData.expenses.filter(exp => !normalize(exp.name).includes(liabilityName) && !liabilityName.includes(normalize(exp.name)));
      }
    } else {
      newData[category] = [...currentList, item];
      // Smart Linkage: Re-checking liability re-adds similar named expense if it was original
      if (category === 'liabilities') {
        const liabilityName = normalize(item.name);
        const originalExpense = editingScenario.originalData.expenses.find(exp => normalize(exp.name).includes(liabilityName) || liabilityName.includes(normalize(exp.name)));
        if (originalExpense && !newData.expenses.find(e => e.id === originalExpense.id)) {
          newData.expenses = [...newData.expenses, originalExpense];
        }
      }
    }
    setEditingScenario({ ...editingScenario, data: newData });
  };

  const handleLogout = async () => {
    try {
      await logout();
      setUser(null);
      setIsGuest(false);
    } catch (e) {
      console.error("Logout failed", e);
    }
  };

  const handleRunAnalysis = async () => {
    setLoadingAi(true);
    try {
      const resultJson = await analyzeFinances(financials);
      setAiAnalysis(JSON.parse(resultJson));
    } catch (e: any) {
      alert(`AI 分析失敗: ${e.message}`);
    } finally {
      setLoadingAi(false);
    }
  };

  const handleSaveAdvice = () => {
    if (!aiAnalysis) return;
    const newAdvice: SavedAdvice = {
      id: crypto.randomUUID(),
      title: `財務分析 - ${new Date().toLocaleString()}`,
      content: aiAnalysis.strategicAdvice,
      score: aiAnalysis.healthScore,
      createdAt: Date.now()
    };
    setSavedAdvices([newAdvice, ...savedAdvices]);
    alert("分析結果已成功儲存至您的雲端紀錄中。");
  };

  const handleChatSubmit = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!chatInput.trim() || isChatting) return;

    const userMsg: ChatMessage = { role: 'user', parts: [{ text: chatInput }] };
    setChatHistory(prev => [...prev, userMsg]);
    setChatInput('');
    setIsChatting(true);

    try {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      const context = `
      [財務快照]
      資產: $${currentMetrics.totalAssets.toLocaleString()}
      負債: $${currentMetrics.totalLiabilities.toLocaleString()}
      淨值: $${currentMetrics.netWorth.toLocaleString()}
      月收入: $${currentMetrics.totalIncome.toLocaleString()}
      月支出: $${currentMetrics.totalExpenses.toLocaleString()}
      月盈餘: $${currentMetrics.monthlyCashFlow.toLocaleString()}
      
      請作為資深財務顧問回答使用者的情境模擬問題，並根據上述數據進行即時運算分析。
      `;
      
      const response = await ai.models.generateContent({
        model: 'gemini-3-pro-preview',
        contents: [...chatHistory, userMsg],
        config: { systemInstruction: context }
      });

      const modelMsg: ChatMessage = { role: 'model', parts: [{ text: response.text || "抱歉，我現在無法生成回應。" }] };
      setChatHistory(prev => [...prev, modelMsg]);
    } catch (e) {
      console.error(e);
      setChatHistory(prev => [...prev, { role: 'model', parts: [{ text: "對話發生錯誤，請稍後再試。" }] }]);
    } finally {
      setIsChatting(false);
    }
  };

  const renderAdvisor = () => (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 pb-12 animate-fade-in">
      <div className="lg:col-span-2 space-y-6">
        <div className="bg-gradient-to-br from-indigo-700 via-purple-700 to-pink-600 rounded-[40px] p-10 text-white shadow-2xl relative overflow-hidden">
          <div className="relative z-10">
            <h2 className="text-4xl font-black mb-4 flex items-center gap-4">
               <BrainCircuit size={48} className="text-yellow-400 drop-shadow-lg" /> AI 智能財務顧問
            </h2>
            <p className="text-indigo-50 mb-10 max-w-xl text-lg opacity-90 leading-relaxed font-medium">
              透過 Gemini 3 全球領先的運算能力，為您的財務組合進行深度穿透分析。
            </p>
            <button 
              onClick={handleRunAnalysis} 
              disabled={loadingAi}
              className="bg-white text-indigo-700 font-black py-5 px-12 rounded-2xl shadow-2xl hover:bg-indigo-50 transition transform hover:-translate-y-1 active:scale-95 flex items-center gap-3 text-lg"
            >
              {loadingAi ? <Loader2 className="animate-spin" /> : <Sparkles className="text-yellow-500" />}
              {loadingAi ? 'AI 正在分析大數據...' : '生成全域診斷報告'}
            </button>
          </div>
          <div className="absolute -right-32 -bottom-32 opacity-10 group-hover:rotate-12 transition duration-1000">
              <Activity size={500} />
          </div>
        </div>

        {aiAnalysis && (
          <div className="space-y-6 animate-fade-in-up">
             <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                <div className="bg-white p-8 rounded-[32px] shadow-sm border border-slate-100 md:col-span-3">
                   <h3 className="text-xs font-black text-slate-400 uppercase tracking-[0.2em] mb-4">診斷摘要 Diagnosis</h3>
                   <p className="text-slate-800 leading-relaxed text-xl font-bold">{aiAnalysis.summary}</p>
                </div>
                <div className="bg-white p-8 rounded-[32px] shadow-sm border border-slate-100 flex flex-col items-center justify-center relative overflow-hidden group">
                   <div className="absolute inset-0 bg-emerald-500/5 group-hover:bg-emerald-500/10 transition"></div>
                   <span className="text-xs font-black text-slate-400 uppercase z-10 mb-2 tracking-widest">健康評分</span>
                   <span className={`text-7xl font-black z-10 ${aiAnalysis.healthScore >= 70 ? 'text-emerald-500' : 'text-rose-500'}`}>
                      {aiAnalysis.healthScore}
                   </span>
                </div>
             </div>

             <div className="bg-white p-10 rounded-[40px] shadow-sm border border-indigo-100 relative group">
                <div className="absolute top-8 right-10">
                  <button onClick={handleSaveAdvice} className="flex items-center gap-2 bg-slate-50 border border-slate-200 px-5 py-2.5 rounded-xl text-slate-600 font-bold text-sm hover:bg-indigo-600 hover:text-white transition shadow-sm">
                    <Save size={18}/> 儲存建議紀錄
                  </button>
                </div>
                <h3 className="text-2xl font-black text-slate-800 mb-8 flex items-center gap-4">
                   <CheckCircle size={32} className="text-emerald-500"/> 專家級戰略策略 Strategic Advice
                </h3>
                <div className="text-slate-700 text-xl leading-relaxed whitespace-pre-wrap font-medium">
                   {aiAnalysis.strategicAdvice}
                </div>
             </div>
          </div>
        )}

        <div className="bg-white p-10 rounded-[40px] shadow-sm border border-slate-100">
          <h3 className="text-xl font-black text-slate-800 mb-8 flex items-center gap-4">
             <History size={28} className="text-slate-400"/> 歷史儲存紀錄 Saved Advices
          </h3>
          {savedAdvices.length === 0 ? (
            <div className="text-center py-20 text-slate-300 font-bold uppercase tracking-widest">No history recorded</div>
          ) : (
            <div className="space-y-6">
              {savedAdvices.map(advice => (
                <div key={advice.id} className="p-8 border border-slate-50 bg-slate-50/30 rounded-[32px] hover:border-indigo-200 hover:bg-white transition-all cursor-pointer group shadow-sm hover:shadow-xl">
                  <div className="flex justify-between items-center mb-4">
                    <span className="font-black text-slate-900 text-lg">{advice.title}</span>
                    <span className="text-xs font-black px-4 py-1.5 rounded-full bg-indigo-600 text-white shadow-lg shadow-indigo-100">Score: {advice.score}</span>
                  </div>
                  <p className="text-slate-600 line-clamp-2 text-lg leading-relaxed">{advice.content}</p>
                  <div className="mt-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">{new Date(advice.createdAt).toLocaleString()}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="lg:col-span-1 h-[850px] flex flex-col bg-slate-950 rounded-[40px] shadow-2xl overflow-hidden border border-slate-800 sticky top-10">
        <div className="p-8 bg-slate-900 border-b border-slate-800 flex items-center gap-4">
          <div className="w-12 h-12 bg-indigo-600 rounded-2xl flex items-center justify-center text-white shadow-2xl animate-pulse">
            <MessageSquare size={24} />
          </div>
          <div>
            <h3 className="text-white font-black text-lg">專家對話 Chat</h3>
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 bg-emerald-500 rounded-full animate-ping"></span>
              <p className="text-slate-400 text-[10px] font-black uppercase tracking-widest">Real-time Simulation Active</p>
            </div>
          </div>
        </div>
        
        <div className="flex-1 overflow-y-auto p-8 space-y-6 scrollbar-hide">
          {chatHistory.length === 0 && (
            <div className="h-full flex flex-col items-center justify-center text-center px-6 space-y-6">
               <div className="w-20 h-20 bg-slate-800/50 rounded-full flex items-center justify-center border border-slate-700/50">
                  <Sparkles className="text-indigo-400" size={32} />
               </div>
               <p className="text-slate-500 text-sm leading-relaxed font-bold">
                 您可以詢問具體的操作情境，例如：<br/>
                 「如果我把房地產賣掉，清償房貸後剩下的資金拿去買 5% 殖利率的標的，我每個月的淨現金流會變成多少？」
               </p>
            </div>
          )}
          {chatHistory.map((msg, i) => (
            <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[90%] p-5 rounded-3xl text-sm leading-relaxed font-medium ${
                msg.role === 'user' 
                  ? 'bg-indigo-600 text-white shadow-xl rounded-tr-none' 
                  : 'bg-slate-800/80 text-slate-200 shadow-lg rounded-tl-none border border-slate-700 backdrop-blur-md'
              }`}>
                {msg.parts[0].text}
              </div>
            </div>
          ))}
          {isChatting && (
            <div className="flex justify-start">
              <div className="bg-slate-800 p-5 rounded-3xl rounded-tl-none border border-slate-700 flex gap-1.5 shadow-lg">
                <div className="w-2 h-2 bg-indigo-500 rounded-full animate-bounce"></div>
                <div className="w-2 h-2 bg-indigo-500 rounded-full animate-bounce delay-150"></div>
                <div className="w-2 h-2 bg-indigo-500 rounded-full animate-bounce delay-300"></div>
              </div>
            </div>
          )}
          <div ref={chatEndRef} />
        </div>

        <form onSubmit={handleChatSubmit} className="p-6 bg-slate-900 border-t border-slate-800">
          <div className="relative group">
            <input 
              value={chatInput}
              onChange={(e) => setChatInput(e.target.value)}
              placeholder="與 AI 對話以模擬各種財務情境..."
              className="w-full bg-slate-950 text-white text-sm border border-slate-800 rounded-2xl px-5 py-5 pr-14 focus:outline-none focus:ring-2 focus:ring-indigo-600 transition shadow-inner"
            />
            <button 
              type="submit"
              disabled={!chatInput.trim() || isChatting}
              className="absolute right-3 top-3 p-3 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 transition disabled:opacity-50 shadow-lg shadow-indigo-900/50 active:scale-90"
            >
              <Send size={20} />
            </button>
          </div>
        </form>
      </div>
    </div>
  );

  // Reusing existing dashboard and list logic with updated aesthetics
  function renderDashboard() {
    return (
      <div className="space-y-10 pb-10">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
          {[
            { title: '淨資產額 Net Worth', value: currentMetrics.netWorth, color: 'text-slate-950' },
            { title: '月現金流 Surplus', value: currentMetrics.monthlyCashFlow, color: currentMetrics.monthlyCashFlow >= 0 ? 'text-emerald-500' : 'text-rose-500' },
            { title: '資產總計 Assets', value: currentMetrics.totalAssets, color: 'text-indigo-600' },
            { title: '負債總計 Liabilities', value: currentMetrics.totalLiabilities, color: 'text-slate-400' },
          ].map((kpi, idx) => (
            <div key={idx} className="bg-white p-10 rounded-[40px] shadow-sm border border-slate-100 group hover:shadow-2xl hover:shadow-indigo-50/50 transition duration-700">
               <div className="text-[10px] font-black text-slate-400 mb-3 uppercase tracking-[0.3em]">{kpi.title}</div>
               <div className={`text-3xl font-black tracking-tighter ${kpi.color}`}>${kpi.value.toLocaleString()}</div>
            </div>
          ))}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
          <div className="bg-white p-10 rounded-[50px] shadow-sm border border-slate-100">
            <h3 className="text-xl font-black text-slate-800 mb-10 flex items-center gap-4"><Activity size={24} className="text-indigo-500"/> 資產負債分佈 Ratio Analysis</h3>
            <NetWorthBarChart assets={financials.assets} liabilities={financials.liabilities} />
          </div>
          <div className="bg-white p-10 rounded-[50px] shadow-sm border border-slate-100">
            <h3 className="text-xl font-black text-slate-800 mb-10 flex items-center gap-4"><PiggyBank size={24} className="text-emerald-500"/> 資產配置類別 Asset Allocation</h3>
            <AssetAllocationChart assets={financials.assets} />
          </div>
        </div>
      </div>
    );
  }

  const renderScenarioMode = () => {
    const soldAssets = editingScenario ? editingScenario.originalData.assets.filter(orig => !editingScenario.data.assets.find(curr => curr.id === orig.id)) : [];
    const paidLiabilities = editingScenario ? editingScenario.originalData.liabilities.filter(orig => !editingScenario.data.liabilities.find(curr => curr.id === orig.id)) : [];
    
    const cashGenerated = soldAssets.reduce((sum, a) => sum + a.value, 0);
    const cashRequired = paidLiabilities.reduce((sum, l) => sum + l.amount, 0);
    const remainingCash = cashGenerated - cashRequired;

    const metrics = calcMetrics(editingScenario?.data || financials);
    const netCashFlowChange = metrics.monthlyCashFlow - currentMetrics.monthlyCashFlow;

    const renderInteractiveList = (title: string, items: any[], category: keyof FinancialState, icon: React.ElementType, isNegative: boolean) => (
      <div className="bg-white border border-slate-100 rounded-[40px] overflow-hidden flex flex-col h-full shadow-sm">
        <div className={`px-8 py-7 border-b border-slate-50 flex items-center justify-between ${isNegative ? 'bg-rose-50/50' : 'bg-emerald-50/50'}`}>
           <div className="flex items-center gap-4">
             {React.createElement(icon, { size: 24, className: isNegative ? "text-rose-600" : "text-emerald-600" })}
             <span className={`font-black tracking-tight text-lg ${isNegative ? "text-rose-900" : "text-emerald-900"}`}>{title}</span>
           </div>
           <span className="text-[10px] font-black uppercase text-slate-400 bg-white/90 px-3 py-1.5 rounded-full border border-slate-200">
             {editingScenario?.data[category].length} / {editingScenario?.originalData[category].length} Kept
           </span>
        </div>
        <div className="p-4 space-y-3 flex-1 overflow-y-auto">
          {editingScenario?.originalData[category].map((item: any) => {
             const isKept = (editingScenario.data[category] as any[]).find(x => x.id === item.id);
             return (
               <div 
                 key={item.id} 
                 onClick={() => toggleScenarioItem(category, item)}
                 className={`group flex items-center gap-4 p-5 rounded-3xl cursor-pointer border transition-all duration-500 ${
                   isKept 
                     ? 'bg-white border-slate-100 hover:border-indigo-300 shadow-sm' 
                     : 'bg-slate-50 border-transparent opacity-30 grayscale scale-[0.98]'
                 }`}
               >
                 <div className={`w-7 h-7 rounded-xl border flex items-center justify-center transition-all ${isKept ? 'bg-indigo-600 border-indigo-600 shadow-xl shadow-indigo-100' : 'bg-white border-slate-300'}`}>
                    {isKept && <CheckCircle size={16} className="text-white" />}
                 </div>
                 <div className="flex-1 min-w-0">
                   <div className={`text-md font-black truncate transition-all ${isKept ? 'text-slate-800' : 'text-slate-400 line-through'}`}>{item.name}</div>
                   <div className="flex justify-between items-center mt-1">
                      <span className="text-xs font-bold text-slate-500">
                        {category === 'assets' && `$${item.value.toLocaleString()}`}
                        {category === 'liabilities' && `$${item.amount.toLocaleString()}`}
                        {(category === 'incomes' || category === 'expenses') && `$${item.amount.toLocaleString()}`}
                      </span>
                   </div>
                 </div>
               </div>
             )
          })}
        </div>
      </div>
    );

    return (
      <div className="flex flex-col h-full bg-slate-50 -m-10 p-10 overflow-y-auto min-h-screen">
        <div className="flex justify-between items-end mb-10">
            <div>
               <h1 className="text-4xl font-black text-slate-900 flex items-center gap-4 tracking-tighter">
                 <Calculator className="text-indigo-600" size={40}/> 戰略重組與現金流模擬
               </h1>
               <p className="text-slate-500 font-bold mt-2 text-lg">透過「變現」或「償債」觀察資產負債結構優化後的真實盈餘。</p>
            </div>
            <div className="flex gap-4 bg-white p-3 rounded-[32px] shadow-sm border border-slate-100">
               {!editingScenario ? (
                  <>
                    {scenarios.map(s => <button key={s.id} onClick={() => loadScenario(s)} className="px-6 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-black hover:border-indigo-500 transition">{s.name}</button>)}
                    <button onClick={startNewScenario} className="px-8 py-3 bg-indigo-600 text-white rounded-2xl font-black shadow-xl shadow-indigo-100 hover:bg-indigo-700 flex items-center gap-3 transition"><Plus size={20}/> 啟動戰略模擬</button>
                  </>
               ) : (
                  <>
                    <input value={editingScenario.name} onChange={(e) => setEditingScenario({...editingScenario, name: e.target.value})} className="bg-slate-50 border border-slate-200 rounded-2xl px-6 py-3 font-black text-slate-700 w-56 focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                    <button onClick={saveScenario} disabled={generatingSummary} className="px-8 py-3 bg-emerald-600 text-white rounded-2xl font-black shadow-xl shadow-emerald-100 hover:bg-emerald-700 flex items-center gap-3 transition">
                       {generatingSummary ? <Loader2 className="animate-spin" size={20}/> : <Save size={20}/>} 儲存模擬結果
                    </button>
                    <button onClick={() => setEditingScenario(null)} className="px-8 py-3 bg-white border border-slate-300 text-slate-600 rounded-2xl font-black hover:bg-slate-50 transition">退出模擬</button>
                  </>
               )}
            </div>
        </div>

        {!editingScenario ? (
           <div className="flex-1 flex flex-col items-center justify-center text-slate-400 border-[6px] border-dashed border-slate-200 rounded-[60px] bg-slate-50/50 min-h-[600px]">
               <PlayCircle size={100} className="opacity-10 mb-8" />
               <p className="text-2xl font-black uppercase tracking-[0.4em] opacity-30">Strategic Sandbox Mode</p>
           </div>
        ) : (
           <div className="flex flex-col gap-10">
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                 <div className="bg-white rounded-[45px] p-10 shadow-sm border border-slate-100 relative overflow-hidden flex flex-col justify-between group hover:shadow-2xl transition duration-500">
                    <h3 className="text-slate-400 text-xs font-black uppercase tracking-[0.3em] mb-8">Liquidity 分析</h3>
                    <div className="space-y-6">
                       <div className="flex justify-between items-center"><span className="text-slate-600 font-bold text-lg">解鎖資金</span><span className="font-black text-emerald-500 text-xl">+{cashGenerated.toLocaleString()}</span></div>
                       <div className="flex justify-between items-center"><span className="text-slate-600 font-bold text-lg">負債清償</span><span className="font-black text-rose-500 text-xl">-{cashRequired.toLocaleString()}</span></div>
                       <div className="pt-8 border-t border-slate-50 flex justify-between items-center">
                          <span className="font-black text-slate-950 text-xl">可用餘額</span>
                          <span className={`text-3xl font-black ${remainingCash >= 0 ? 'text-indigo-600' : 'text-rose-600'}`}>${remainingCash.toLocaleString()}</span>
                       </div>
                    </div>
                 </div>

                 <div className="bg-white rounded-[45px] p-10 shadow-sm border border-slate-100 relative overflow-hidden flex flex-col justify-between group hover:shadow-2xl transition duration-500">
                    <h3 className="text-slate-400 text-xs font-black uppercase tracking-[0.3em] mb-8">Cash Flow 影響</h3>
                    <div className="space-y-6">
                       <div className="flex justify-between items-center"><span className="text-slate-600 font-bold text-lg">月支出優化</span><span className="font-black text-emerald-500 text-xl">+{Math.max(0, netCashFlowChange).toLocaleString()}</span></div>
                       <div className="flex justify-between items-center"><span className="text-slate-600 font-bold text-lg">月收益減項</span><span className="font-black text-rose-500 text-xl">{Math.min(0, netCashFlowChange).toLocaleString()}</span></div>
                       <div className="pt-8 border-t border-slate-50 flex justify-between items-center">
                          <span className="font-black text-slate-950 text-xl">月變動額</span>
                          <span className={`text-3xl font-black ${netCashFlowChange >= 0 ? 'text-emerald-500' : 'text-rose-500'}`}>${netCashFlowChange.toLocaleString()}</span>
                       </div>
                    </div>
                 </div>

                 <div className={`rounded-[45px] p-10 shadow-2xl flex flex-col justify-center items-center text-center border-8 transition-all duration-500 ${metrics.monthlyCashFlow >= 0 ? 'bg-emerald-600 border-emerald-500 shadow-emerald-100' : 'bg-rose-600 border-rose-500 shadow-rose-100'}`}>
                    <div className="text-white/70 text-xs font-black uppercase tracking-[0.3em] mb-4">預期每月盈餘</div>
                    <div className="text-6xl font-black text-white tracking-tighter mb-6">${metrics.monthlyCashFlow.toLocaleString()}</div>
                    <div className="bg-black/10 text-white text-[12px] font-black px-6 py-2 rounded-full backdrop-blur-xl uppercase tracking-[0.2em]">
                       {metrics.monthlyCashFlow >= 0 ? 'Monthly Surplus Optimized' : 'Monthly Deficit Warning'}
                    </div>
                 </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8 h-[600px]">
                  {renderInteractiveList('資產保留 (變現)', editingScenario.data.assets, 'assets', DollarSign, false)}
                  {renderInteractiveList('債務保留 (償還)', editingScenario.data.liabilities, 'liabilities', TrendingDown, true)}
                  {renderInteractiveList('支出保留 (削減)', editingScenario.data.expenses, 'expenses', TrendingDown, true)}
                  {renderInteractiveList('收入來源', editingScenario.data.incomes, 'incomes', TrendingUp, false)}
              </div>
           </div>
        )}
      </div>
    );
  };

  const handleOpenModal = (type: string, existingItem?: any) => {
    let title = '';
    if (existingItem) {
        setEditingId(existingItem.id);
        setFormData({ ...existingItem });
        title = `編輯財務項`;
    } else {
        setEditingId(null);
        title = `新增財務項`;
        setFormData({ name: '', amount: '', value: '', type: (type === 'asset' ? AssetType.CASH : LiabilityType.OTHER), liquidity: 'High', returnRate: 0, interestRate: 0, monthlyPayment: 0 });
    }
    setModalConfig({ type, title });
    setIsModalOpen(true);
  };

  const handleSaveItem = () => {
    const categoryMap: any = { asset: 'assets', liability: 'liabilities', income: 'incomes', expense: 'expenses' };
    const category = categoryMap[modalConfig.type];
    
    setFinancials(prev => {
      const list = prev[category as keyof FinancialState] as any[];
      const newItem = { 
        ...formData, 
        id: editingId || crypto.randomUUID(), 
        amount: Number(formData.amount || 0), 
        value: Number(formData.value || 0),
        returnRate: Number(formData.returnRate || 0),
        interestRate: Number(formData.interestRate || 0),
        monthlyPayment: Number(formData.monthlyPayment || 0)
      };
      return { 
        ...prev, 
        [category]: editingId ? list.map(it => it.id === editingId ? newItem : it) : [...list, newItem] 
      };
    });
    setIsModalOpen(false);
  };

  const saveScenario = async () => {
    if (!editingScenario) return;
    setGeneratingSummary(true);
    try {
      const summary = await generateScenarioSummary(editingScenario.originalData, editingScenario.data);
      const newScenario: Scenario = { ...editingScenario, id: crypto.randomUUID(), aiSummary: summary, createdAt: Date.now() };
      setScenarios([...scenarios, newScenario]);
      setEditingScenario(null);
    } catch (e) {
      alert("儲存失敗");
    } finally {
      setGeneratingSummary(false);
    }
  };

  const startNewScenario = () => {
    if (scenarios.length >= 5) return alert("最多儲存 5 個情境模擬");
    setEditingScenario({
      name: `情境模擬 ${scenarios.length + 1}`,
      data: JSON.parse(JSON.stringify(financials)),
      originalData: JSON.parse(JSON.stringify(financials)),
    });
  };

  const loadScenario = (scenario: Scenario) => {
    setEditingScenario({
      name: scenario.name,
      data: JSON.parse(JSON.stringify(scenario.data)),
      originalData: JSON.parse(JSON.stringify(financials)) 
    });
  };

  const renderModal = () => {
    if (!isModalOpen || !modalConfig) return null;
    return (
      <div className="fixed inset-0 bg-slate-950/80 z-[60] flex items-center justify-center p-4 backdrop-blur-xl animate-fade-in">
        <div className="bg-white rounded-[40px] shadow-2xl w-full max-w-lg overflow-hidden animate-fade-in-up">
          <div className="p-8 border-b border-slate-50 flex justify-between items-center">
            <h3 className="font-black text-2xl text-slate-950">{modalConfig.title}</h3>
            <button onClick={() => setIsModalOpen(false)} className="p-2 hover:bg-slate-100 rounded-full transition"><X size={24}/></button>
          </div>
          <div className="p-10 space-y-8">
            <div className="space-y-2">
              <label className="text-[11px] font-black text-slate-400 uppercase tracking-widest">項目名稱 Name</label>
              <input value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} className="w-full p-5 bg-slate-50 border border-slate-100 rounded-3xl focus:ring-2 focus:ring-indigo-600 outline-none font-bold text-lg" placeholder="例如：房屋貸款、薪資..." />
            </div>
            <div className="space-y-2">
              <label className="text-[11px] font-black text-slate-400 uppercase tracking-widest">{modalConfig.type === 'asset' ? '預估價值 Value' : '剩餘金額 Amount'}</label>
              <input type="number" value={modalConfig.type === 'asset' ? formData.value : formData.amount} onChange={e => setFormData({...formData, [modalConfig.type === 'asset' ? 'value' : 'amount']: e.target.value})} className="w-full p-5 bg-slate-50 border border-slate-100 rounded-3xl focus:ring-2 focus:ring-indigo-600 outline-none font-black text-2xl text-indigo-600" />
            </div>
            {modalConfig.type === 'liability' && (
              <div className="space-y-2">
                <label className="text-[11px] font-black text-slate-400 uppercase tracking-widest">每月付金 Monthly Payment</label>
                <input type="number" value={formData.monthlyPayment} onChange={e => setFormData({...formData, monthlyPayment: e.target.value})} className="w-full p-5 bg-slate-50 border border-slate-100 rounded-3xl focus:ring-2 focus:ring-indigo-600 outline-none font-black text-2xl" />
              </div>
            )}
          </div>
          <div className="p-8 bg-slate-50 flex gap-6">
             <button onClick={() => setIsModalOpen(false)} className="flex-1 py-5 text-slate-500 font-black text-lg">取消</button>
             <button onClick={handleSaveItem} className="flex-1 py-5 bg-indigo-600 text-white font-black rounded-3xl shadow-2xl shadow-indigo-200 text-lg active:scale-95 transition">確認儲存</button>
          </div>
        </div>
      </div>
    );
  };

  const renderList = (title: string, items: any[], type: string, color: string) => (
    <div className="bg-white rounded-[50px] shadow-sm border border-slate-100 overflow-hidden pb-10 mb-8">
        <div className="p-10 border-b border-slate-50 flex justify-between items-center">
            <h2 className="text-2xl font-black text-slate-950 tracking-tighter">{title}</h2>
            <button onClick={() => handleOpenModal(type)} className={`bg-${color}-600 text-white px-8 py-4 rounded-2xl text-sm font-black flex items-center gap-3 shadow-2xl shadow-${color}-100 transition hover:-translate-y-1`}>
                <Plus size={20} /> 新增項目
            </button>
        </div>
        <div className="overflow-x-auto">
            <table className="w-full text-left">
                <thead className="bg-slate-50/50 text-slate-400 text-[11px] font-black uppercase tracking-[0.2em]">
                    <tr><th className="p-8">財務項目 Name</th><th className="p-8">金額 Amount</th><th className="p-8 text-center">操作</th></tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                    {items.map(item => (
                        <tr key={item.id} className="hover:bg-slate-50/30 transition duration-300 group">
                            <td className="p-8 font-black text-slate-800 text-lg">{item.name} <div className="text-[10px] text-slate-400 font-bold mt-1 uppercase tracking-widest">{item.type}</div></td>
                            <td className={`p-8 font-black text-2xl text-${color}-600`}>${(item.value || item.amount).toLocaleString()}</td>
                            <td className="p-8 flex justify-center gap-4">
                                <button onClick={() => handleOpenModal(type, item)} className="p-3.5 text-slate-300 hover:text-indigo-600 hover:bg-indigo-50 rounded-2xl transition shadow-sm hover:shadow-md"><Pencil size={20}/></button>
                                <button onClick={() => handleDelete(type === 'asset' ? 'assets' : type === 'liability' ? 'liabilities' : type === 'income' ? 'incomes' : 'expenses', item.id)} className="p-3.5 text-slate-300 hover:text-rose-600 hover:bg-rose-50 rounded-2xl transition shadow-sm hover:shadow-md"><Trash2 size={20}/></button>
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    </div>
  );

  const handleDelete = (cat: keyof FinancialState, id: string) => {
    if (!window.confirm("確定從資產負債表中永久移除此項？")) return;
    setFinancials(prev => ({ ...prev, [cat]: (prev[cat] as any[]).filter(it => it.id !== id) }));
  };

  if (isAuthChecking) return <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50 space-y-6 text-indigo-600"><Loader2 className="w-16 h-16 animate-spin" /><span className="font-black text-sm uppercase tracking-[0.3em]">WealthFlow Initializing...</span></div>;
  if (!user && !isGuest) return <div className="min-h-screen flex items-center justify-center bg-slate-100 p-8"><div className="bg-white p-14 rounded-[60px] shadow-[0_50px_100px_-20px_rgba(0,0,0,0.1)] text-center max-w-md w-full"><div className="w-24 h-24 bg-indigo-600 rounded-[35px] mx-auto mb-10 flex items-center justify-center text-white shadow-2xl shadow-indigo-200 rotate-3"><DollarSign size={48}/></div><h1 className="text-3xl font-black mb-3 tracking-tighter">WealthFlow AI</h1><p className="text-slate-500 text-lg mb-10 font-bold leading-relaxed">專家級智能財務顧問系統</p><div className="space-y-4"><button onClick={loginWithGoogle} className="w-full bg-slate-950 text-white py-5 rounded-[25px] font-black text-lg flex items-center justify-center gap-4 hover:bg-black transition shadow-2xl active:scale-95"><img src="https://www.google.com/favicon.ico" className="w-6 h-6" alt="google icon"/> 使用 Google 安全登入</button><button onClick={() => setIsGuest(true)} className="w-full bg-white text-slate-600 border border-slate-200 py-5 rounded-[25px] font-black text-lg hover:bg-slate-50 transition active:scale-95">訪客瀏覽模式 (Guest)</button></div></div></div>;

  return (
    <div className="min-h-screen bg-slate-50 flex font-sans selection:bg-indigo-200 selection:text-indigo-900">
      <aside className="w-80 bg-white border-r border-slate-100 fixed h-full hidden lg:flex flex-col z-20 shadow-xl">
        <div className="p-10">
          <div className="flex items-center gap-5 text-indigo-600 mb-16">
            <div className="w-14 h-14 bg-indigo-600 rounded-[22px] flex items-center justify-center shadow-2xl shadow-indigo-100 rotate-2">
              <DollarSign className="text-white w-8 h-8" />
            </div>
            <span className="font-black text-3xl tracking-tighter text-slate-950">WealthFlow</span>
          </div>
          <nav className="space-y-2.5">
            {[
              { id: 'dashboard', icon: Activity, label: '財務大數據' },
              { id: 'assets', icon: DollarSign, label: '資產配置' },
              { id: 'liabilities', icon: TrendingDown, label: '負債結構' },
              { id: 'cashflow', icon: TrendingUp, label: '現金流量' },
              { id: 'scenario', icon: Calculator, label: '戰略模擬' },
              { id: 'advisor', icon: BrainCircuit, label: 'AI 戰略顧問' },
            ].map(item => (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id as any)}
                className={`w-full flex items-center gap-5 px-6 py-5 text-md font-black rounded-3xl transition-all duration-500 ${
                  activeTab === item.id ? 'bg-indigo-600 text-white shadow-2xl shadow-indigo-200 translate-x-2' : 'text-slate-500 hover:bg-slate-50 hover:text-slate-900'
                }`}
              >
                <item.icon size={22} />
                {item.label}
              </button>
            ))}
          </nav>
        </div>
        <div className="mt-auto border-t border-slate-50 p-8">
           <div className="bg-slate-50/50 rounded-[35px] p-5 border border-slate-100 flex items-center gap-5">
              <div className="w-12 h-12 bg-white rounded-2xl flex items-center justify-center text-slate-400 font-bold border border-slate-200 shadow-sm overflow-hidden">{user?.photoURL ? <img src={user.photoURL} className="w-full h-full object-cover" alt="user profile"/> : <UserIcon size={22}/>}</div>
              <div className="flex-1 min-w-0">
                <div className="text-xs font-black text-slate-950 truncate uppercase tracking-tight">{user?.displayName || 'Guest User'}</div>
                <div className={`text-[10px] font-black uppercase tracking-widest ${syncStatus === 'synced' ? 'text-emerald-500' : 'text-amber-500'}`}>{syncStatus}</div>
              </div>
              <button onClick={handleLogout} className="p-3 text-slate-300 hover:text-rose-500 hover:bg-rose-50 rounded-xl transition"><LogOut size={20}/></button>
           </div>
        </div>
      </aside>

      <main className="flex-1 lg:ml-80 p-12 min-h-screen">
        <div className="max-w-7xl mx-auto h-full">
          {activeTab === 'scenario' ? renderScenarioMode() : (
            <div className="animate-fade-in">
                <header className="mb-14 flex justify-between items-center">
                  <h1 className="text-4xl font-black text-slate-950 tracking-tighter">
                    {activeTab === 'dashboard' && '數據視覺化 Dashboard'}
                    {activeTab === 'assets' && '資產組合優化 Assets'}
                    {activeTab === 'liabilities' && '負債權重分析 Liabilities'}
                    {activeTab === 'cashflow' && '月度現金流量明細 Cash Flow'}
                    {activeTab === 'advisor' && 'AI 智能專家決策中心'}
                  </h1>
                </header>
                {activeTab === 'dashboard' && renderDashboard()}
                {activeTab === 'assets' && renderList('資產明細清單 Assets', financials.assets, 'asset', 'emerald')}
                {activeTab === 'liabilities' && renderList('負債結構明細 Liabilities', financials.liabilities, 'liability', 'rose')}
                {activeTab === 'cashflow' && (
                   <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
                      {renderList('主動與被動收入 Income', financials.incomes, 'income', 'emerald')}
                      {renderList('每月固定與變動支出 Expenses', financials.expenses, 'expense', 'rose')}
                   </div>
                )}
                {activeTab === 'advisor' && renderAdvisor()}
            </div>
          )}
        </div>
      </main>
      {renderModal()}
    </div>
  );
}