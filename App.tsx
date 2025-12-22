
import React, { useState, useEffect, useRef } from 'react';
import { AssetType, LiabilityType, AssetItem, LiabilityItem, CashFlowItem, FinancialState, Scenario, ChatMessage, SavedAdvice } from './types';
import { analyzeFinances, parseFinancialScreenshot, generateScenarioSummary } from './services/geminiService';
import { loginWithGoogle, logout, subscribeAuth, saveUserData, loadUserData } from './services/firebase';
import { AssetAllocationChart, NetWorthBarChart } from './components/Charts';
import { GoogleGenAI } from "@google/genai";
import { Plus, Trash2, DollarSign, TrendingUp, TrendingDown, Activity, AlertTriangle, CheckCircle, BrainCircuit, ScanLine, X, Loader2, PlayCircle, Save, LogOut, User as UserIcon, Pencil, ChevronRight, Calculator, Wallet, PiggyBank, Send, MessageSquare, History, Sparkles, Menu } from 'lucide-react';
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
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
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
    id?: string;
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
      if (category === 'liabilities') {
        const liabilityName = normalize(item.name);
        newData.expenses = newData.expenses.filter(exp => !normalize(exp.name).includes(liabilityName) && !liabilityName.includes(normalize(exp.name)));
      }
    } else {
      newData[category] = [...currentList, item];
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

  const handleDeleteScenario = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    if (window.confirm("確定要永久刪除此情境模擬嗎？")) {
      setScenarios(prev => prev.filter(s => s.id !== id));
      if (editingScenario?.id === id) {
         setEditingScenario(null);
      }
    }
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

  const renderScenarioMode = () => {
    const soldAssets = editingScenario ? editingScenario.originalData.assets.filter(orig => !editingScenario.data.assets.find(curr => curr.id === orig.id)) : [];
    const paidLiabilities = editingScenario ? editingScenario.originalData.liabilities.filter(orig => !editingScenario.data.liabilities.find(curr => curr.id === orig.id)) : [];
    
    const cashGenerated = soldAssets.reduce((sum, a) => sum + a.value, 0);
    const cashRequired = paidLiabilities.reduce((sum, l) => sum + l.amount, 0);
    const remainingCash = cashGenerated - cashRequired;

    const metrics = calcMetrics(editingScenario?.data || financials);
    const netCashFlowChange = metrics.monthlyCashFlow - currentMetrics.monthlyCashFlow;

    const renderInteractiveList = (title: string, items: any[], category: keyof FinancialState, icon: React.ElementType, isNegative: boolean) => (
      <div className="bg-white border border-slate-100 rounded-[30px] md:rounded-[40px] overflow-hidden flex flex-col h-full shadow-sm">
        <div className={`px-6 py-5 md:px-8 md:py-7 border-b border-slate-50 flex items-center justify-between ${isNegative ? 'bg-rose-50/50' : 'bg-emerald-50/50'}`}>
           <div className="flex items-center gap-3">
             {React.createElement(icon, { size: 20, className: isNegative ? "text-rose-600" : "text-emerald-600" })}
             <span className={`font-black tracking-tight text-md md:text-lg ${isNegative ? "text-rose-900" : "text-emerald-900"}`}>{title}</span>
           </div>
           <span className="text-[9px] font-black uppercase text-slate-400 bg-white/90 px-2 py-1 rounded-full border border-slate-200">
             {editingScenario?.data[category].length} Kept
           </span>
        </div>
        <div className="p-3 md:p-4 space-y-2 md:space-y-3 flex-1 overflow-y-auto">
          {editingScenario?.originalData[category].map((item: any) => {
             const isKept = (editingScenario.data[category] as any[]).find(x => x.id === item.id);
             return (
               <div 
                 key={item.id} 
                 onClick={() => toggleScenarioItem(category, item)}
                 className={`group flex items-center gap-3 md:gap-4 p-4 md:p-5 rounded-2xl md:rounded-3xl cursor-pointer border transition-all duration-300 ${
                   isKept 
                     ? 'bg-white border-slate-100 hover:border-indigo-300 shadow-sm' 
                     : 'bg-slate-50 border-transparent opacity-30 grayscale scale-[0.98]'
                 }`}
               >
                 <div className={`w-6 h-6 md:w-7 md:h-7 rounded-lg md:rounded-xl border flex items-center justify-center transition-all ${isKept ? 'bg-indigo-600 border-indigo-600 shadow-xl shadow-indigo-100' : 'bg-white border-slate-300'}`}>
                    {isKept && <CheckCircle size={14} className="text-white" />}
                 </div>
                 <div className="flex-1 min-w-0">
                   <div className={`text-sm md:text-md font-black truncate transition-all ${isKept ? 'text-slate-800' : 'text-slate-400 line-through'}`}>{item.name}</div>
                   <div className="flex justify-between items-center mt-1">
                      <span className="text-[10px] md:text-xs font-bold text-slate-500">
                        ${(item.value || item.amount).toLocaleString()}
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
      <div className="flex flex-col h-full bg-slate-50 -m-6 md:-m-10 p-6 md:p-10 overflow-y-auto min-h-screen">
        <div className="flex flex-col mb-10 gap-6">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
              <div>
                 <h1 className="text-2xl md:text-4xl font-black text-slate-900 flex items-center gap-4 tracking-tighter">
                   <Calculator className="text-indigo-600" size={32} md:size={40}/> 戰略重組與模擬
                 </h1>
                 <p className="text-slate-500 font-bold mt-2 text-md">點選下方項目的藍勾勾，模擬「賣掉資產」或「還清債務」後的現金流。</p>
              </div>
              
              <div className="w-full md:w-auto flex gap-4">
                 {editingScenario ? (
                    <div className="flex w-full md:w-auto gap-3 items-center bg-white p-2 rounded-2xl shadow-sm border border-slate-100">
                       <input 
                         value={editingScenario.name} 
                         onChange={(e) => setEditingScenario({...editingScenario, name: e.target.value})} 
                         className="flex-1 md:flex-none bg-slate-50 border border-slate-200 rounded-xl px-4 py-2 font-black text-slate-700 md:w-48 focus:outline-none" 
                       />
                       <button onClick={saveScenario} disabled={generatingSummary} className="flex-1 md:flex-none px-4 py-2 bg-emerald-600 text-white rounded-xl font-black shadow-lg hover:bg-emerald-700 flex items-center justify-center gap-2 transition">
                          {generatingSummary ? <Loader2 className="animate-spin" size={16}/> : <Save size={16}/>} 儲存模擬
                       </button>
                       <button onClick={() => setEditingScenario(null)} className="flex-1 md:flex-none px-4 py-2 bg-white border border-slate-300 text-slate-600 rounded-xl font-black hover:bg-slate-50 transition">退出</button>
                    </div>
                 ) : (
                    <button onClick={startNewScenario} className="w-full md:w-auto px-8 py-3 bg-indigo-600 text-white rounded-2xl font-black shadow-xl hover:bg-indigo-700 flex items-center justify-center gap-3 transition">
                       <Plus size={20}/> 啟動新模擬
                    </button>
                 )}
              </div>
            </div>

            {/* 常駐顯示的情境列表 Management Area */}
            {scenarios.length > 0 && (
              <div className="flex flex-wrap items-center gap-3 p-4 bg-white/60 backdrop-blur-md rounded-3xl border border-white/40 shadow-sm">
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest mr-2">已存情境 :</span>
                {scenarios.map(s => (
                  <div key={s.id} className="relative group">
                    <button 
                      onClick={() => loadScenario(s)} 
                      className={`px-5 py-2.5 rounded-xl text-xs md:text-sm font-black transition whitespace-nowrap pr-10 border ${
                        editingScenario?.id === s.id 
                          ? 'bg-indigo-600 text-white border-indigo-600 shadow-lg shadow-indigo-100' 
                          : 'bg-white text-slate-600 border-slate-200 hover:border-indigo-500'
                      }`}
                    >
                      {s.name}
                    </button>
                    <button 
                      onClick={(e) => handleDeleteScenario(e, s.id)}
                      className={`absolute right-2 top-1/2 -translate-y-1/2 p-1.5 transition rounded-lg ${
                        editingScenario?.id === s.id ? 'text-indigo-200 hover:text-white hover:bg-indigo-500' : 'text-slate-300 hover:text-rose-500 hover:bg-rose-50'
                      }`}
                      title="刪除此情境"
                    >
                      <Trash2 size={14}/>
                    </button>
                  </div>
                ))}
              </div>
            )}
        </div>

        {!editingScenario ? (
           <div className="flex-1 flex flex-col items-center justify-center text-slate-400 border-[4px] md:border-[6px] border-dashed border-slate-200 rounded-[40px] md:rounded-[60px] bg-slate-50/50 min-h-[400px] md:min-h-[600px] p-10 text-center">
               <PlayCircle size={60} md:size={100} className="opacity-10 mb-6 md:mb-8" />
               <p className="text-xl md:text-2xl font-black uppercase tracking-[0.3em] md:tracking-[0.4em] opacity-30">Strategic Sandbox Mode</p>
               <button onClick={startNewScenario} className="mt-8 px-10 py-4 bg-indigo-600 text-white rounded-2xl font-black shadow-2xl hover:bg-indigo-700 transition active:scale-95">
                 立即建立新模擬環境
               </button>
           </div>
        ) : (
           <div className="flex flex-col gap-8 md:gap-10">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 md:gap-8">
                 <div className="bg-white rounded-[35px] md:rounded-[45px] p-8 md:p-10 shadow-sm border border-slate-100 flex flex-col justify-between">
                    <h3 className="text-slate-400 text-[10px] font-black uppercase tracking-[0.2em] mb-6">Liquidity 分析</h3>
                    <div className="space-y-4 md:space-y-6">
                       <div className="flex justify-between items-center"><span className="text-slate-600 font-bold text-md md:text-lg">解鎖資金</span><span className="font-black text-emerald-500 text-lg md:text-xl">+{cashGenerated.toLocaleString()}</span></div>
                       <div className="flex justify-between items-center"><span className="text-slate-600 font-bold text-md md:text-lg">負債清償</span><span className="font-black text-rose-500 text-lg md:text-xl">-{cashRequired.toLocaleString()}</span></div>
                       <div className="pt-6 md:pt-8 border-t border-slate-50 flex justify-between items-center">
                          <span className="font-black text-slate-950 text-lg md:text-xl">可用餘額</span>
                          <span className={`text-2xl md:text-3xl font-black ${remainingCash >= 0 ? 'text-indigo-600' : 'text-rose-600'}`}>${remainingCash.toLocaleString()}</span>
                       </div>
                    </div>
                 </div>

                 <div className="bg-white rounded-[35px] md:rounded-[45px] p-8 md:p-10 shadow-sm border border-slate-100 flex flex-col justify-between">
                    <h3 className="text-slate-400 text-[10px] font-black uppercase tracking-[0.2em] mb-6">Cash Flow 影響</h3>
                    <div className="space-y-4 md:space-y-6">
                       <div className="flex justify-between items-center"><span className="text-slate-600 font-bold text-md md:text-lg">月支出優化</span><span className="font-black text-emerald-500 text-lg md:text-xl">+{Math.max(0, netCashFlowChange).toLocaleString()}</span></div>
                       <div className="flex justify-between items-center"><span className="text-slate-600 font-bold text-md md:text-lg">月收益減項</span><span className="font-black text-rose-500 text-lg md:text-xl">{Math.min(0, netCashFlowChange).toLocaleString()}</span></div>
                       <div className="pt-6 md:pt-8 border-t border-slate-50 flex justify-between items-center">
                          <span className="font-black text-slate-950 text-lg md:text-xl">月變動額</span>
                          <span className={`text-2xl md:text-3xl font-black ${netCashFlowChange >= 0 ? 'text-emerald-500' : 'text-rose-500'}`}>${netCashFlowChange.toLocaleString()}</span>
                       </div>
                    </div>
                 </div>

                 <div className={`md:col-span-2 lg:col-span-1 rounded-[35px] md:rounded-[45px] p-8 md:p-10 shadow-2xl flex flex-col justify-center items-center text-center border-4 md:border-8 ${metrics.monthlyCashFlow >= 0 ? 'bg-emerald-600 border-emerald-500' : 'bg-rose-600 border-rose-500'}`}>
                    <div className="text-white/70 text-[10px] font-black uppercase tracking-[0.2em] mb-3">預期每月盈餘</div>
                    <div className="text-4xl md:text-6xl font-black text-white tracking-tighter mb-4 md:mb-6">${metrics.monthlyCashFlow.toLocaleString()}</div>
                    <div className="bg-black/10 text-white text-[10px] font-black px-4 py-1.5 rounded-full uppercase tracking-widest">
                       {metrics.monthlyCashFlow >= 0 ? 'Monthly Surplus' : 'Monthly Deficit'}
                    </div>
                 </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 md:gap-8 min-h-[400px] md:min-h-[600px]">
                  {renderInteractiveList('資產保留 (變現)', editingScenario.data.assets, 'assets', DollarSign, false)}
                  {renderInteractiveList('債務保留 (償還)', editingScenario.data.liabilities, 'liabilities', TrendingDown, true)}
                  {renderInteractiveList('支出保留 (削減)', editingScenario.data.expenses, 'expenses', TrendingDown, true)}
                  {renderInteractiveList('固定收入', editingScenario.data.incomes, 'incomes', TrendingUp, false)}
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
      const scenarioId = editingScenario.id || crypto.randomUUID();
      const newScenario: Scenario = { 
        id: scenarioId,
        name: editingScenario.name,
        data: JSON.parse(JSON.stringify(editingScenario.data)),
        aiSummary: summary, 
        createdAt: Date.now() 
      };
      
      setScenarios(prev => {
        const index = prev.findIndex(s => s.id === scenarioId);
        if (index > -1) {
           const updated = [...prev];
           updated[index] = newScenario;
           return updated;
        }
        return [...prev, newScenario];
      });
      setEditingScenario(null);
      alert("情境已成功儲存！");
    } catch (e) {
      alert("儲存失敗");
    } finally {
      setGeneratingSummary(false);
    }
  };

  const startNewScenario = () => {
    if (scenarios.length >= 8) return alert("最多儲存 8 個情境模擬");
    setEditingScenario({
      name: `新模擬 ${scenarios.length + 1}`,
      data: JSON.parse(JSON.stringify(financials)),
      originalData: JSON.parse(JSON.stringify(financials)),
    });
  };

  const loadScenario = (scenario: Scenario) => {
    setEditingScenario({
      id: scenario.id,
      name: scenario.name,
      data: JSON.parse(JSON.stringify(scenario.data)),
      originalData: JSON.parse(JSON.stringify(financials)) 
    });
  };

  const renderModal = () => {
    if (!isModalOpen || !modalConfig) return null;
    return (
      <div className="fixed inset-0 bg-slate-950/80 z-[60] flex items-center justify-center p-4 backdrop-blur-xl">
        <div className="bg-white rounded-[30px] md:rounded-[40px] shadow-2xl w-full max-w-lg overflow-hidden animate-fade-in-up">
          <div className="p-6 md:p-8 border-b border-slate-50 flex justify-between items-center">
            <h3 className="font-black text-xl md:text-2xl text-slate-950">{modalConfig.title}</h3>
            <button onClick={() => setIsModalOpen(false)} className="p-2 hover:bg-slate-100 rounded-full transition"><X size={24}/></button>
          </div>
          <div className="p-6 md:p-10 space-y-6 md:space-y-8">
            <div className="space-y-2">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">項目名稱 Name</label>
              <input value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} className="w-full p-4 md:p-5 bg-slate-50 border border-slate-100 rounded-[15px] md:rounded-3xl outline-none font-bold text-lg" placeholder="例如：房屋貸款..." />
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{modalConfig.type === 'asset' ? '預估價值 Value' : '剩餘金額 Amount'}</label>
              <input type="number" value={modalConfig.type === 'asset' ? formData.value : formData.amount} onChange={e => setFormData({...formData, [modalConfig.type === 'asset' ? 'value' : 'amount']: e.target.value})} className="w-full p-4 md:p-5 bg-slate-50 border border-slate-100 rounded-[15px] md:rounded-3xl outline-none font-black text-xl md:text-2xl text-indigo-600" />
            </div>
            {modalConfig.type === 'liability' && (
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">每月付金 Monthly Payment</label>
                <input type="number" value={formData.monthlyPayment} onChange={e => setFormData({...formData, monthlyPayment: e.target.value})} className="w-full p-4 md:p-5 bg-slate-50 border border-slate-100 rounded-[15px] md:rounded-3xl outline-none font-black text-xl md:text-2xl" />
              </div>
            )}
          </div>
          <div className="p-6 md:p-8 bg-slate-50 flex gap-4 md:gap-6">
             <button onClick={() => setIsModalOpen(false)} className="flex-1 py-4 md:py-5 text-slate-500 font-black text-md md:text-lg">取消</button>
             <button onClick={handleSaveItem} className="flex-1 py-4 md:py-5 bg-indigo-600 text-white font-black rounded-[15px] md:rounded-3xl shadow-2xl text-md md:text-lg active:scale-95 transition">確認儲存</button>
          </div>
        </div>
      </div>
    );
  };

  const renderList = (title: string, items: any[], type: string, color: string) => (
    <div className="bg-white rounded-[35px] md:rounded-[50px] shadow-sm border border-slate-100 overflow-hidden pb-10 mb-8 px-4 md:px-0">
        <div className="p-6 md:p-10 border-b border-slate-50 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <h2 className="text-xl md:text-2xl font-black text-slate-950 tracking-tighter">{title}</h2>
            <button onClick={() => handleOpenModal(type)} className={`w-full md:w-auto bg-${color}-600 text-white px-6 py-3 md:px-8 md:py-4 rounded-xl md:rounded-2xl text-xs md:text-sm font-black flex items-center justify-center gap-3 shadow-2xl transition hover:-translate-y-1`}>
                <Plus size={18} /> 新增項目
            </button>
        </div>
        <div className="overflow-x-auto">
            <table className="w-full text-left min-w-[500px]">
                <thead className="bg-slate-50/50 text-slate-400 text-[9px] md:text-[11px] font-black uppercase tracking-[0.2em]">
                    <tr><th className="p-6 md:p-8">財務項目 Name</th><th className="p-6 md:p-8">金額 Amount</th><th className="p-6 md:p-8 text-center">操作</th></tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                    {items.map(item => (
                        <tr key={item.id} className="hover:bg-slate-50/30 transition duration-300 group">
                            <td className="p-6 md:p-8 font-black text-slate-800 text-md md:text-lg">{item.name} <div className="text-[10px] text-slate-400 font-bold mt-1 uppercase tracking-widest">{item.type}</div></td>
                            <td className={`p-6 md:p-8 font-black text-lg md:text-2xl text-${color}-600`}>${(item.value || item.amount).toLocaleString()}</td>
                            <td className="p-6 md:p-8 flex justify-center gap-3 md:gap-4">
                                <button onClick={() => handleOpenModal(type, item)} className="p-2.5 md:p-3.5 text-slate-300 hover:text-indigo-600 hover:bg-indigo-50 rounded-xl transition"><Pencil size={18}/></button>
                                <button onClick={() => handleDelete(type === 'asset' ? 'assets' : type === 'liability' ? 'liabilities' : type === 'income' ? 'incomes' : 'expenses', item.id)} className="p-2.5 md:p-3.5 text-slate-300 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition"><Trash2 size={18}/></button>
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

  // Fix: Added renderDashboard implementation
  const renderDashboard = () => {
    const { totalAssets, totalLiabilities, netWorth, totalIncome, totalExpenses, monthlyCashFlow } = currentMetrics;
    return (
      <div className="space-y-8 md:space-y-12">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 md:gap-8">
          <div className="bg-white p-8 md:p-10 rounded-[35px] md:rounded-[45px] shadow-sm border border-slate-100">
            <div className="flex items-center gap-4 text-indigo-600 mb-6">
              <div className="p-3 bg-indigo-50 rounded-2xl"><Wallet size={24}/></div>
              <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Net Worth</span>
            </div>
            <div className="text-3xl md:text-4xl font-black text-slate-950">${netWorth.toLocaleString()}</div>
            <div className="mt-4 text-[10px] font-bold text-slate-400">Total assets minus liabilities</div>
          </div>
          
          <div className="bg-white p-8 md:p-10 rounded-[35px] md:rounded-[45px] shadow-sm border border-slate-100">
            <div className="flex items-center gap-4 text-emerald-600 mb-6">
              <div className="p-3 bg-emerald-50 rounded-2xl"><PiggyBank size={24}/></div>
              <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Total Assets</span>
            </div>
            <div className="text-3xl md:text-4xl font-black text-slate-950">${totalAssets.toLocaleString()}</div>
          </div>

          <div className="bg-white p-8 md:p-10 rounded-[35px] md:rounded-[45px] shadow-sm border border-slate-100">
            <div className="flex items-center gap-4 text-rose-600 mb-6">
              <div className="p-3 bg-rose-50 rounded-2xl"><TrendingDown size={24}/></div>
              <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Total Liabilities</span>
            </div>
            <div className="text-3xl md:text-4xl font-black text-slate-950">${totalLiabilities.toLocaleString()}</div>
          </div>

          <div className={`p-8 md:p-10 rounded-[35px] md:rounded-[45px] shadow-xl border-4 ${monthlyCashFlow >= 0 ? 'bg-emerald-600 border-emerald-500 text-white' : 'bg-rose-600 border-rose-500 text-white'}`}>
            <div className="flex items-center gap-4 mb-6">
              <div className="p-3 bg-white/20 rounded-2xl"><Activity size={24}/></div>
              <span className="text-[10px] font-black uppercase tracking-widest opacity-70">Monthly Cash Flow</span>
            </div>
            <div className="text-3xl md:text-4xl font-black">${monthlyCashFlow.toLocaleString()}</div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 md:gap-12">
          <div className="bg-white p-8 md:p-12 rounded-[40px] md:rounded-[55px] shadow-sm border border-slate-100">
             <h3 className="text-lg md:text-xl font-black mb-8 text-slate-950">資產配置比例 Asset Allocation</h3>
             <AssetAllocationChart assets={financials.assets} />
          </div>
          <div className="bg-white p-8 md:p-12 rounded-[40px] md:rounded-[55px] shadow-sm border border-slate-100">
             <h3 className="text-lg md:text-xl font-black mb-8 text-slate-950">淨值對比 Net Worth Comparison</h3>
             <NetWorthBarChart assets={financials.assets} liabilities={financials.liabilities} />
          </div>
        </div>
      </div>
    );
  };

  // Fix: Added renderAdvisor implementation
  const renderAdvisor = () => {
    return (
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-8 md:gap-12">
        <div className="xl:col-span-2 space-y-8 md:space-y-12">
          {/* AI Analysis Section */}
          <div className="bg-white rounded-[40px] md:rounded-[55px] shadow-sm border border-slate-100 overflow-hidden">
             <div className="p-8 md:p-12 border-b border-slate-50 flex flex-col md:flex-row justify-between items-center gap-6">
                <div className="flex items-center gap-6">
                   <div className="w-16 h-16 bg-indigo-600 rounded-[25px] flex items-center justify-center text-white shadow-2xl shadow-indigo-100">
                      <BrainCircuit size={32} />
                   </div>
                   <div>
                      <h3 className="text-xl md:text-2xl font-black text-slate-950">AI 戰略分析報告</h3>
                      <p className="text-slate-400 font-bold text-sm">基於當前資產與負債的優化建議</p>
                   </div>
                </div>
                <button 
                  onClick={handleRunAnalysis} 
                  disabled={loadingAi}
                  className="w-full md:w-auto px-8 py-4 bg-indigo-600 text-white rounded-2xl font-black shadow-xl hover:bg-indigo-700 flex items-center justify-center gap-3 transition active:scale-95 disabled:opacity-50"
                >
                   {loadingAi ? <Loader2 className="animate-spin" size={20}/> : <Sparkles size={20}/>}
                   {loadingAi ? 'AI 正在分析中...' : '啟動 AI 診斷'}
                </button>
             </div>

             <div className="p-8 md:p-12">
                {aiAnalysis ? (
                  <div className="space-y-8 animate-fade-in">
                    <div className="flex flex-col md:flex-row gap-8">
                       <div className="flex-1 p-8 bg-slate-50 rounded-[35px] border border-slate-100">
                          <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4">財務健康評分</div>
                          <div className="flex items-baseline gap-3">
                             <span className={`text-5xl md:text-6xl font-black ${aiAnalysis.healthScore >= 70 ? 'text-emerald-500' : aiAnalysis.healthScore >= 40 ? 'text-amber-500' : 'text-rose-500'}`}>
                               {aiAnalysis.healthScore}
                             </span>
                             <span className="text-slate-400 font-black text-lg">/ 100</span>
                          </div>
                       </div>
                       <div className="flex-[2] p-8 bg-indigo-50/50 rounded-[35px] border border-indigo-100/50">
                          <div className="text-[10px] font-black text-indigo-400 uppercase tracking-widest mb-4">核心摘要</div>
                          <p className="text-slate-700 font-bold leading-relaxed">{aiAnalysis.summary}</p>
                       </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                       <div className="space-y-4">
                          <h4 className="flex items-center gap-2 text-rose-600 font-black uppercase text-xs tracking-widest">
                             <AlertTriangle size={16}/> 立即行動 Immediate Actions
                          </h4>
                          <div className="space-y-3">
                             {aiAnalysis.immediateActions.map((action: string, i: number) => (
                               <div key={i} className="flex gap-4 p-4 bg-rose-50 border border-rose-100 rounded-2xl">
                                  <div className="w-6 h-6 rounded-full bg-rose-600 text-white flex items-center justify-center text-[10px] font-black flex-shrink-0">{i+1}</div>
                                  <p className="text-rose-900 text-sm font-bold">{action}</p>
                               </div>
                             ))}
                          </div>
                       </div>
                       <div className="space-y-4">
                          <h4 className="flex items-center gap-2 text-indigo-600 font-black uppercase text-xs tracking-widest">
                             <TrendingUp size={16}/> 戰略建議 Strategic Advice
                          </h4>
                          <div className="p-6 bg-slate-50 rounded-[30px] border border-slate-100 text-slate-600 text-sm font-bold leading-relaxed">
                             {aiAnalysis.strategicAdvice}
                          </div>
                       </div>
                    </div>
                    
                    <div className="pt-8 border-t border-slate-50">
                       <button onClick={handleSaveAdvice} className="flex items-center gap-3 text-slate-400 hover:text-indigo-600 font-black transition text-sm">
                          <Save size={18}/> 儲存此份分析結果至歷史紀錄
                       </button>
                    </div>
                  </div>
                ) : (
                  <div className="py-20 flex flex-col items-center justify-center text-slate-300">
                     <BrainCircuit size={80} className="opacity-10 mb-6" />
                     <p className="font-black text-lg uppercase tracking-widest opacity-30">請點擊上方按鈕開始 AI 診斷</p>
                  </div>
                )}
             </div>
          </div>

          {/* History Section */}
          <div className="space-y-6">
             <h3 className="text-xl font-black text-slate-950 flex items-center gap-3"><History size={24}/> 歷史分析紀錄</h3>
             <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {savedAdvices.length > 0 ? savedAdvices.map(advice => (
                  <div key={advice.id} className="bg-white p-8 rounded-[35px] border border-slate-100 shadow-sm group hover:border-indigo-200 transition">
                     <div className="flex justify-between items-start mb-4">
                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{new Date(advice.createdAt).toLocaleDateString()}</span>
                        <div className={`px-3 py-1 rounded-full text-[10px] font-black ${advice.score >= 70 ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600'}`}>Score: {advice.score}</div>
                     </div>
                     <h4 className="font-black text-slate-800 mb-3 truncate">{advice.title}</h4>
                     <p className="text-slate-500 text-xs font-bold line-clamp-2 leading-relaxed mb-6">{advice.content}</p>
                     <button className="text-indigo-600 font-black text-xs flex items-center gap-2 group-hover:gap-4 transition-all">查看詳細報告 <ChevronRight size={14}/></button>
                  </div>
                )) : (
                  <div className="col-span-full py-12 bg-slate-50 border-2 border-dashed border-slate-200 rounded-[35px] flex flex-col items-center justify-center text-slate-400">
                     <p className="font-black text-sm uppercase tracking-widest">目前尚無歷史分析紀錄</p>
                  </div>
                )}
             </div>
          </div>
        </div>

        {/* Chat Section */}
        <div className="xl:col-span-1">
          <div className="bg-white rounded-[40px] md:rounded-[50px] shadow-2xl border border-slate-100 flex flex-col h-[700px] sticky top-12">
             <div className="p-8 border-b border-slate-50 flex items-center gap-4">
                <div className="w-12 h-12 bg-emerald-500 rounded-2xl flex items-center justify-center text-white shadow-xl shadow-emerald-100">
                   <MessageSquare size={24} />
                </div>
                <div>
                   <h3 className="font-black text-slate-950">財務顧問 Chat</h3>
                   <div className="flex items-center gap-1.5"><div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></div><span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">AI Consultant Online</span></div>
                </div>
             </div>
             
             <div className="flex-1 overflow-y-auto p-6 md:p-8 space-y-6">
                {chatHistory.length === 0 && (
                  <div className="h-full flex flex-col items-center justify-center text-center px-6">
                     <Sparkles size={40} className="text-indigo-200 mb-4" />
                     <p className="text-slate-400 text-xs font-bold leading-relaxed">您可以詢問任何關於財務配置的問題，例如：<br/>「如果我現在把私募賣掉還房貸划算嗎？」</p>
                  </div>
                )}
                {chatHistory.map((msg, i) => (
                  <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                    <div className={`max-w-[85%] p-5 rounded-[25px] font-bold text-sm leading-relaxed ${msg.role === 'user' ? 'bg-indigo-600 text-white shadow-xl shadow-indigo-100 rounded-br-none' : 'bg-slate-50 text-slate-700 border border-slate-100 rounded-bl-none'}`}>
                      {msg.parts[0].text}
                    </div>
                  </div>
                ))}
                {isChatting && (
                  <div className="flex justify-start">
                     <div className="bg-slate-50 p-5 rounded-[25px] border border-slate-100 rounded-bl-none flex gap-2">
                        <div className="w-1.5 h-1.5 bg-slate-300 rounded-full animate-bounce"></div>
                        <div className="w-1.5 h-1.5 bg-slate-300 rounded-full animate-bounce delay-75"></div>
                        <div className="w-1.5 h-1.5 bg-slate-300 rounded-full animate-bounce delay-150"></div>
                     </div>
                  </div>
                )}
                <div ref={chatEndRef} />
             </div>

             <form onSubmit={handleChatSubmit} className="p-6 md:p-8 border-t border-slate-50">
                <div className="relative">
                   <input 
                     value={chatInput} 
                     onChange={e => setChatInput(e.target.value)}
                     placeholder="輸入問題與 AI 討論..." 
                     className="w-full bg-slate-50 border border-slate-100 rounded-2xl py-4 pl-5 pr-14 font-bold text-sm outline-none focus:border-indigo-300 transition"
                   />
                   <button 
                     type="submit" 
                     disabled={!chatInput.trim() || isChatting}
                     className="absolute right-2 top-1/2 -translate-y-1/2 w-10 h-10 bg-indigo-600 text-white rounded-xl flex items-center justify-center shadow-lg active:scale-95 disabled:opacity-30 transition"
                   >
                      <Send size={18} />
                   </button>
                </div>
             </form>
          </div>
        </div>
      </div>
    );
  };

  const navItems = [
    { id: 'dashboard', icon: Activity, label: '財務大數據' },
    { id: 'assets', icon: DollarSign, label: '資產配置' },
    { id: 'liabilities', icon: TrendingDown, label: '負債結構' },
    { id: 'cashflow', icon: TrendingUp, label: '現金流量' },
    { id: 'scenario', icon: Calculator, label: '戰略模擬' },
    { id: 'advisor', icon: BrainCircuit, label: 'AI 戰略顧問' },
  ];

  if (isAuthChecking) return <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50 space-y-6 text-indigo-600"><Loader2 className="w-16 h-16 animate-spin" /><span className="font-black text-sm uppercase tracking-[0.3em]">WealthFlow Initializing...</span></div>;
  if (!user && !isGuest) return <div className="min-h-screen flex items-center justify-center bg-slate-100 p-8"><div className="bg-white p-14 rounded-[40px] md:rounded-[60px] shadow-2xl text-center max-w-md w-full"><div className="w-20 h-20 md:w-24 md:h-24 bg-indigo-600 rounded-[35px] mx-auto mb-10 flex items-center justify-center text-white shadow-2xl shadow-indigo-200 rotate-3"><DollarSign size={40} md:size={48}/></div><h1 className="text-2xl md:text-3xl font-black mb-3 tracking-tighter">WealthFlow AI</h1><p className="text-slate-500 text-md md:text-lg mb-10 font-bold leading-relaxed">專家級智能財務顧問系統</p><div className="space-y-4"><button onClick={loginWithGoogle} className="w-full bg-slate-950 text-white py-4 md:py-5 rounded-[20px] md:rounded-[25px] font-black text-md md:text-lg flex items-center justify-center gap-4 hover:bg-black transition"><img src="https://www.google.com/favicon.ico" className="w-5 h-5 md:w-6 md:h-6" alt="google icon"/> Google 帳號登入</button><button onClick={() => setIsGuest(true)} className="w-full bg-white text-slate-600 border border-slate-200 py-4 md:py-5 rounded-[20px] md:rounded-[25px] font-black text-md md:text-lg hover:bg-slate-50 transition">訪客瀏覽模式 (Guest)</button></div></div></div>;

  return (
    <div className="min-h-screen bg-slate-50 flex font-sans selection:bg-indigo-200 selection:text-indigo-900 overflow-x-hidden">
      {/* Mobile Drawer Overlay */}
      {isSidebarOpen && (
        <div 
          className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-40 lg:hidden transition-opacity"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}

      {/* Sidebar Drawer */}
      <aside className={`
        fixed top-0 left-0 h-full bg-white border-r border-slate-100 z-50 w-72 lg:w-80 transition-transform duration-300 ease-in-out
        lg:translate-x-0 lg:static flex flex-col shadow-xl lg:shadow-none
        ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'}
      `}>
        <div className="p-8 md:p-10">
          <div className="flex items-center justify-between mb-12">
            <div className="flex items-center gap-4 md:gap-5 text-indigo-600">
              <div className="w-12 h-12 md:w-14 md:h-14 bg-indigo-600 rounded-[22px] flex items-center justify-center shadow-2xl shadow-indigo-100 rotate-2">
                <DollarSign className="text-white w-7 h-7 md:w-8 md:h-8" />
              </div>
              <span className="font-black text-2xl md:text-3xl tracking-tighter text-slate-950">WealthFlow</span>
            </div>
            <button onClick={() => setIsSidebarOpen(false)} className="lg:hidden p-2 text-slate-400 hover:bg-slate-50 rounded-full">
              <X size={24} />
            </button>
          </div>
          <nav className="space-y-2 md:space-y-2.5">
            {navItems.map(item => (
              <button
                key={item.id}
                onClick={() => { setActiveTab(item.id as any); setIsSidebarOpen(false); }}
                className={`w-full flex items-center gap-4 md:gap-5 px-5 py-4 md:px-6 md:py-5 text-md font-black rounded-[20px] md:rounded-3xl transition-all duration-300 ${
                  activeTab === item.id ? 'bg-indigo-600 text-white shadow-2xl shadow-indigo-200 translate-x-2' : 'text-slate-500 hover:bg-slate-50 hover:text-slate-900'
                }`}
              >
                <item.icon size={20} md:size={22} />
                {item.label}
              </button>
            ))}
          </nav>
        </div>
        <div className="mt-auto border-t border-slate-50 p-6 md:p-8">
           <div className="bg-slate-50/50 rounded-[25px] md:rounded-[35px] p-4 md:p-5 border border-slate-100 flex items-center gap-4 md:gap-5">
              <div className="w-10 h-10 md:w-12 md:h-12 bg-white rounded-2xl flex items-center justify-center text-slate-400 font-bold border border-slate-200 shadow-sm overflow-hidden">{user?.photoURL ? <img src={user.photoURL} className="w-full h-full object-cover" alt="user profile"/> : <UserIcon size={18} md:size={22}/>}</div>
              <div className="flex-1 min-w-0">
                <div className="text-[10px] md:text-xs font-black text-slate-950 truncate uppercase tracking-tight">{user?.displayName || 'Guest User'}</div>
                <div className={`text-[8px] md:text-[10px] font-black uppercase tracking-widest ${syncStatus === 'synced' ? 'text-emerald-500' : 'text-amber-500'}`}>{syncStatus}</div>
              </div>
              <button onClick={handleLogout} className="p-2 md:p-3 text-slate-300 hover:text-rose-500 transition"><LogOut size={18} md:size={20}/></button>
           </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 min-h-screen lg:ml-0 relative">
        <div className="lg:hidden sticky top-0 bg-white/80 backdrop-blur-md border-b border-slate-100 z-30 flex items-center justify-between px-6 py-4">
           <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center text-white">
                 <DollarSign size={18} />
              </div>
              <span className="font-black tracking-tighter text-slate-950">WealthFlow</span>
           </div>
           <button 
             onClick={() => setIsSidebarOpen(true)}
             className="p-2.5 bg-slate-50 rounded-xl text-slate-600 border border-slate-200 shadow-sm active:scale-95 transition"
           >
              <Menu size={20} />
           </button>
        </div>

        <div className="p-6 md:p-12 max-w-7xl mx-auto h-full">
          {activeTab === 'scenario' ? renderScenarioMode() : (
            <div className="animate-fade-in">
                <header className="mb-8 md:mb-14 flex justify-between items-center px-2 md:px-0">
                  <h1 className="text-2xl md:text-4xl font-black text-slate-950 tracking-tighter">
                    {activeTab === 'dashboard' && '數據儀表板 Dashboard'}
                    {activeTab === 'assets' && '資產優化 Assets'}
                    {activeTab === 'liabilities' && '負債權重 Liabilities'}
                    {activeTab === 'cashflow' && '現金流量明細 Cash Flow'}
                    {activeTab === 'advisor' && 'AI 專家決策中心'}
                  </h1>
                </header>
                {activeTab === 'dashboard' && renderDashboard()}
                {activeTab === 'assets' && renderList('資產明細清單 Assets', financials.assets, 'asset', 'emerald')}
                {activeTab === 'liabilities' && renderList('負債結構明細 Liabilities', financials.liabilities, 'liability', 'rose')}
                {activeTab === 'cashflow' && (
                   <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 md:gap-10">
                      {renderList('主動與被動收入 Income', financials.incomes, 'income', 'emerald')}
                      {renderList('月度支出明細 Expenses', financials.expenses, 'expense', 'rose')}
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
