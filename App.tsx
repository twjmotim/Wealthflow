import React, { useState, useEffect, useRef } from 'react';
import { AssetType, LiabilityType, AssetItem, LiabilityItem, CashFlowItem, FinancialState, Scenario, ChatMessage, SavedAdvice } from './types';
import { analyzeFinances, parseFinancialScreenshot, generateScenarioSummary } from './services/geminiService';
import { loginWithGoogle, logout, subscribeAuth, saveUserData, loadUserData } from './services/firebase';
import { AssetAllocationChart, NetWorthBarChart } from './components/Charts';
import { GoogleGenAI } from "@google/genai";
import { Plus, Trash2, DollarSign, TrendingUp, TrendingDown, Activity, AlertTriangle, CheckCircle, BrainCircuit, ScanLine, X, Loader2, PlayCircle, Save, LogOut, User as UserIcon, Pencil, ChevronRight, Calculator, Wallet, PiggyBank, Send, MessageSquare, History, Sparkles, Menu, Home } from 'lucide-react';
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
  const [selectedAdvice, setSelectedAdvice] = useState<SavedAdvice | null>(null);
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
      alert(`AI 分析失敗 Analysis Failed: ${e.message}`);
    } finally {
      setLoadingAi(false);
    }
  };

  const handleSaveAdvice = () => {
    if (!aiAnalysis) return;
    const newAdvice: SavedAdvice = {
      id: crypto.randomUUID(),
      title: `財務診斷報告 Financial Report - ${new Date().toLocaleString()}`,
      content: aiAnalysis.strategicAdvice,
      score: aiAnalysis.healthScore,
      createdAt: Date.now()
    };
    setSavedAdvices([newAdvice, ...savedAdvices]);
    alert("分析結果已成功儲存至歷史紀錄中。 Saved successfully.");
  };

  const handleDeleteScenario = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    if (window.confirm("確定要刪除此情境模擬嗎？ Delete this scenario?")) {
      setScenarios(prev => prev.filter(s => s.id !== id));
      if (editingScenario?.id === id) {
         setEditingScenario(null);
      }
    }
  };

  const handleOpenModal = (type: string, item?: any) => {
    setEditingId(item?.id || null);
    if (item) {
      setFormData(item);
    } else {
      const defaultData: any = { name: '' };
      if (type === 'asset') {
        defaultData.value = 0;
        defaultData.type = AssetType.CASH;
        defaultData.liquidity = 'High';
      } else if (type === 'liability') {
        defaultData.amount = 0;
        defaultData.type = LiabilityType.OTHER;
        defaultData.monthlyPayment = 0;
        defaultData.interestRate = 0;
      } else {
        defaultData.amount = 0;
        defaultData.type = type === 'income' ? 'Income' : 'Expense';
      }
      setFormData(defaultData);
    }

    const titles: Record<string, string> = {
      asset: item ? '編輯資產 Edit Asset' : '新增資產 Add Asset',
      liability: item ? '編輯負債 Edit Liability' : '新增負債 Add Liability',
      income: item ? '編輯收入 Edit Income' : '新增收入 Add Income',
      expense: item ? '編輯支出 Edit Expense' : '新增支出 Add Expense'
    };

    setModalConfig({ type, title: titles[type] });
    setIsModalOpen(true);
  };

  const handleSaveItem = () => {
    if (!modalConfig) return;
    const { type } = modalConfig;
    const category = type === 'asset' ? 'assets' : type === 'liability' ? 'liabilities' : type === 'income' ? 'incomes' : 'expenses';
    
    const newItem = {
      ...formData,
      id: editingId || crypto.randomUUID(),
      value: formData.value !== undefined ? Number(formData.value) : undefined,
      amount: formData.amount !== undefined ? Number(formData.amount) : undefined,
      monthlyPayment: formData.monthlyPayment !== undefined ? Number(formData.monthlyPayment) : undefined,
      interestRate: formData.interestRate !== undefined ? Number(formData.interestRate) : undefined,
    };

    setFinancials(prev => ({
      ...prev,
      [category]: editingId 
        ? (prev[category] as any[]).map((it: any) => it.id === editingId ? newItem : it)
        : [...(prev[category] as any[]), newItem]
    }));

    setIsModalOpen(false);
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
      [財務快照 Financial Snapshot]
      資產 Assets: $${currentMetrics.totalAssets.toLocaleString()}
      負債 Liabilities: $${currentMetrics.totalLiabilities.toLocaleString()}
      淨值 Net Worth: $${currentMetrics.netWorth.toLocaleString()}
      月收入 Income: $${currentMetrics.totalIncome.toLocaleString()}
      月支出 Expenses: $${currentMetrics.totalExpenses.toLocaleString()}
      月盈餘 Surplus: $${currentMetrics.monthlyCashFlow.toLocaleString()}
      
      Respond as a senior financial advisor in Traditional Chinese and English.
      `;
      
      const response = await ai.models.generateContent({
        model: 'gemini-3-pro-preview',
        contents: [...chatHistory, userMsg],
        config: { systemInstruction: context }
      });

      const modelMsg: ChatMessage = { role: 'model', parts: [{ text: response.text || "Sorry, I cannot generate a response." }] };
      setChatHistory(prev => [...prev, modelMsg]);
    } catch (e) {
      console.error(e);
      setChatHistory(prev => [...prev, { role: 'model', parts: [{ text: "Error occurred, please try again later." }] }]);
    } finally {
      setIsChatting(false);
    }
  };

  const renderDashboard = () => {
    const { totalAssets, totalLiabilities, netWorth, totalIncome, totalExpenses, monthlyCashFlow } = currentMetrics;
    return (
      <div className="space-y-8 md:space-y-12">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 md:gap-8">
          <div className="bg-white p-8 md:p-10 rounded-[35px] md:rounded-[45px] shadow-sm border border-slate-100 transition-all">
            <div className="flex items-center gap-4 text-indigo-600 mb-6">
              <div className="p-3 bg-indigo-50 rounded-2xl"><Wallet size={24}/></div>
              <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">淨資產額 Net Worth</span>
            </div>
            <div className="text-3xl md:text-4xl font-black text-slate-950">${netWorth.toLocaleString()}</div>
            <div className="mt-4 text-[10px] font-bold text-slate-400">總資產減負債 Total net balance</div>
          </div>
          
          <div 
            onClick={() => setActiveTab('assets')}
            className="bg-white p-8 md:p-10 rounded-[35px] md:rounded-[45px] shadow-sm border border-slate-100 cursor-pointer hover:border-emerald-300 hover:shadow-xl hover:-translate-y-1 transition-all group"
          >
            <div className="flex items-center gap-4 text-emerald-600 mb-6">
              <div className="p-3 bg-emerald-50 rounded-2xl group-hover:bg-emerald-100 transition"><PiggyBank size={24}/></div>
              <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">資產總計 Total Assets</span>
            </div>
            <div className="text-3xl md:text-4xl font-black text-slate-950 group-hover:text-emerald-600 transition">${totalAssets.toLocaleString()}</div>
            <div className="mt-4 text-[10px] font-bold text-emerald-500 flex items-center gap-1">
               點擊進入編輯頁面 (Edit Assets) <ChevronRight size={12}/>
            </div>
          </div>

          <div 
            onClick={() => setActiveTab('liabilities')}
            className="bg-white p-8 md:p-10 rounded-[35px] md:rounded-[45px] shadow-sm border border-slate-100 cursor-pointer hover:border-rose-300 hover:shadow-xl hover:-translate-y-1 transition-all group"
          >
            <div className="flex items-center gap-4 text-rose-600 mb-6">
              <div className="p-3 bg-rose-50 rounded-2xl group-hover:bg-rose-100 transition"><TrendingDown size={24}/></div>
              <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">負債總計 Total Liabilities</span>
            </div>
            <div className="text-3xl md:text-4xl font-black text-slate-950 group-hover:text-rose-600 transition">${totalLiabilities.toLocaleString()}</div>
            <div className="mt-4 text-[10px] font-bold text-rose-500 flex items-center gap-1">
               點擊進入編輯頁面 (Edit Liabilities) <ChevronRight size={12}/>
            </div>
          </div>

          <div 
            onClick={() => setActiveTab('cashflow')}
            className={`p-8 md:p-10 rounded-[35px] md:rounded-[45px] shadow-xl border-4 cursor-pointer hover:scale-105 transition-all ${monthlyCashFlow >= 0 ? 'bg-emerald-600 border-emerald-500 text-white' : 'bg-rose-600 border-rose-500 text-white'}`}
          >
            <div className="flex items-center gap-4 mb-6">
              <div className="p-3 bg-white/20 rounded-2xl"><Activity size={24}/></div>
              <span className="text-[10px] font-black uppercase tracking-widest opacity-70">每月現金流 Monthly Surplus</span>
            </div>
            <div className="text-3xl md:text-4xl font-black">${monthlyCashFlow.toLocaleString()}</div>
            <div className="mt-4 text-[10px] font-bold flex items-center gap-1 opacity-80">
               查看明細與編輯 (Check Cash Flow) <ChevronRight size={12}/>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 md:gap-12">
          <div className="bg-white p-8 md:p-12 rounded-[40px] md:rounded-[55px] shadow-sm border border-slate-100">
             <h3 className="text-lg md:text-xl font-black mb-8 text-slate-950">資產配置比例 (Asset Allocation)</h3>
             <AssetAllocationChart assets={financials.assets} />
          </div>
          <div className="bg-white p-8 md:p-12 rounded-[40px] md:rounded-[55px] shadow-sm border border-slate-100">
             <h3 className="text-lg md:text-xl font-black mb-8 text-slate-950">淨值與負債對比 (Net Worth Comparison)</h3>
             <NetWorthBarChart assets={financials.assets} liabilities={financials.liabilities} />
          </div>
        </div>
      </div>
    );
  };

  const renderScenarioMode = () => {
    const soldAssets = editingScenario ? editingScenario.originalData.assets.filter(orig => !editingScenario.data.assets.find(curr => curr.id === orig.id)) : [];
    const paidLiabilities = editingScenario ? editingScenario.originalData.liabilities.filter(orig => !editingScenario.data.liabilities.find(curr => curr.id === orig.id)) : [];
    const metrics = calcMetrics(editingScenario?.data || financials);
    const netCashFlowChange = metrics.monthlyCashFlow - currentMetrics.monthlyCashFlow;

    return (
      <div className="flex flex-col h-full bg-slate-50 -m-6 md:-m-10 p-6 md:p-10 overflow-y-auto min-h-screen">
        <div className="flex flex-col mb-10 gap-6">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
              <div>
                 <h1 className="text-2xl md:text-4xl font-black text-slate-900 flex items-center gap-4 tracking-tighter">
                   <Calculator className="text-indigo-600" size={32} md:size={40}/> 戰略重組與模擬 (Scenario Simulation)
                 </h1>
                 <p className="text-slate-500 font-bold mt-2 text-md">點選藍勾勾模擬賣掉資產或清償負債後的真實結餘影響。</p>
              </div>
              
              <div className="w-full md:w-auto flex gap-4">
                 {editingScenario ? (
                    <div className="flex w-full md:w-auto gap-3 items-center bg-white p-2 rounded-2xl shadow-sm border border-slate-100">
                       <input value={editingScenario.name} onChange={(e) => setEditingScenario({...editingScenario, name: e.target.value})} className="flex-1 md:flex-none bg-slate-50 border border-slate-200 rounded-xl px-4 py-2 font-black text-slate-700 md:w-48 outline-none" />
                       <button onClick={saveScenario} disabled={generatingSummary} className="flex-1 md:flex-none px-4 py-2 bg-emerald-600 text-white rounded-xl font-black shadow-lg hover:bg-emerald-700 flex items-center justify-center gap-2 transition disabled:opacity-50">
                          {generatingSummary ? <Loader2 className="animate-spin" size={16}/> : <Save size={16}/>} 儲存 (Save)
                       </button>
                       <button onClick={() => setEditingScenario(null)} className="flex-1 md:flex-none px-4 py-2 bg-white border border-slate-300 text-slate-600 rounded-xl font-black hover:bg-slate-50 transition">退出 (Exit)</button>
                    </div>
                 ) : (
                    <button onClick={startNewScenario} className="w-full md:w-auto px-8 py-3 bg-indigo-600 text-white rounded-2xl font-black shadow-xl hover:bg-indigo-700 flex items-center justify-center gap-3 transition">
                       <Plus size={20}/> 啟動模擬環境 (Start New)
                    </button>
                 )}
              </div>
            </div>

            {scenarios.length > 0 && (
              <div className="flex flex-wrap items-center gap-3 p-4 bg-white/60 backdrop-blur-md rounded-3xl border border-white/40 shadow-sm">
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest mr-2">歷史模擬清單 (History List) :</span>
                {scenarios.map(s => (
                  <div key={s.id} className="relative group">
                    <button 
                      onClick={() => loadScenario(s)} 
                      className={`px-5 py-2.5 rounded-xl text-xs md:text-sm font-black transition whitespace-nowrap pr-10 border ${
                        editingScenario?.id === s.id 
                          ? 'bg-indigo-600 text-white border-indigo-600 shadow-lg' 
                          : 'bg-white text-slate-600 border-slate-200 hover:border-indigo-500'
                      }`}
                    >
                      {s.name}
                    </button>
                    <button 
                      onClick={(e) => handleDeleteScenario(e, s.id)}
                      className={`absolute right-2 top-1/2 -translate-y-1/2 p-1.5 transition rounded-lg ${
                        editingScenario?.id === s.id ? 'text-white hover:bg-indigo-500' : 'text-slate-300 hover:text-rose-500'
                      }`}
                    >
                      <Trash2 size={14}/>
                    </button>
                  </div>
                ))}
              </div>
            )}
        </div>

        {!editingScenario ? (
           <div className="flex-1 flex flex-col items-center justify-center text-slate-400 border-[4px] border-dashed border-slate-200 rounded-[40px] bg-slate-50/50 min-h-[400px] p-10 text-center">
               <PlayCircle size={60} className="opacity-10 mb-6" />
               <p className="text-xl font-black uppercase tracking-[0.3em] opacity-30">Sandbox Environment</p>
               <button onClick={startNewScenario} className="mt-8 px-10 py-4 bg-indigo-600 text-white rounded-2xl font-black shadow-2xl hover:bg-indigo-700 transition active:scale-95">
                 立即進入戰略實驗室 (Enter Sandbox)
               </button>
           </div>
        ) : (
           <div className="flex flex-col gap-8">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                 <div className="bg-white rounded-[35px] p-8 shadow-sm border border-slate-100 flex flex-col justify-between">
                    <h3 className="text-slate-400 text-[10px] font-black uppercase tracking-[0.2em] mb-6">流動資金分析 (Liquidity)</h3>
                    <div className="space-y-4">
                       <div className="flex justify-between items-center"><span className="text-slate-600 font-bold">資產變現解鎖</span><span className="font-black text-emerald-500 text-lg">+$...</span></div>
                       <div className="flex justify-between items-center"><span className="text-slate-600 font-bold">預計負債清償</span><span className="font-black text-rose-500 text-lg">-$...</span></div>
                       <div className="pt-6 border-t border-slate-50 flex justify-between items-center">
                          <span className="font-black text-slate-950 text-lg">模擬可用餘額</span>
                          <span className="text-2xl font-black text-indigo-600">$...</span>
                       </div>
                    </div>
                 </div>

                 <div className="bg-white rounded-[35px] p-8 shadow-sm border border-slate-100 flex flex-col justify-between">
                    <h3 className="text-slate-400 text-[10px] font-black uppercase tracking-[0.2em] mb-6">現金流連動 (Cash Flow)</h3>
                    <div className="space-y-4">
                       <div className="flex justify-between items-center"><span className="text-slate-600 font-bold">月支出減少項</span><span className="font-black text-emerald-500 text-lg">+$...</span></div>
                       <div className="flex justify-between items-center"><span className="text-slate-600 font-bold">月被動收益損</span><span className="font-black text-rose-500 text-lg">-$...</span></div>
                       <div className="pt-6 border-t border-slate-50 flex justify-between items-center">
                          <span className="font-black text-slate-950 text-lg">月現金流淨變</span>
                          <span className={`text-2xl font-black ${netCashFlowChange >= 0 ? 'text-emerald-500' : 'text-rose-500'}`}>${netCashFlowChange.toLocaleString()}</span>
                       </div>
                    </div>
                 </div>

                 <div className={`md:col-span-2 lg:col-span-1 rounded-[35px] p-8 shadow-2xl flex flex-col justify-center items-center text-center border-4 ${metrics.monthlyCashFlow >= 0 ? 'bg-emerald-600 border-emerald-500' : 'bg-rose-600 border-rose-500'}`}>
                    <div className="text-white/70 text-[10px] font-black uppercase tracking-[0.2em] mb-3">預期每月淨餘盈餘</div>
                    <div className="text-4xl font-black text-white tracking-tighter mb-4">${metrics.monthlyCashFlow.toLocaleString()}</div>
                    <div className="bg-black/10 text-white text-[10px] font-black px-4 py-1.5 rounded-full uppercase tracking-widest">
                       {metrics.monthlyCashFlow >= 0 ? 'Monthly Surplus' : 'Deficit Warning'}
                    </div>
                 </div>
              </div>
              <p className="text-center text-slate-400 font-bold text-sm">請點擊資產/負債項目的勾選框來進行情境加減</p>
           </div>
        )}
      </div>
    );
  };

  const renderAdvisor = () => (
    <div className="grid grid-cols-1 xl:grid-cols-3 gap-8 md:gap-12 animate-fade-in">
        <div className="xl:col-span-2 space-y-8">
          <div className="bg-white rounded-[40px] shadow-sm border border-slate-100 overflow-hidden">
             <div className="p-8 md:p-12 border-b border-slate-50 flex flex-col md:flex-row justify-between items-center gap-6">
                <div className="flex items-center gap-6">
                   <div className="w-16 h-16 bg-indigo-600 rounded-[25px] flex items-center justify-center text-white shadow-2xl">
                      <BrainCircuit size={32} />
                   </div>
                   <div>
                      <h3 className="text-xl md:text-2xl font-black text-slate-950">AI 全域財務戰略診斷 (Analysis)</h3>
                      <p className="text-slate-400 font-bold text-sm">運用 Gemini 深度優化資產負債配比</p>
                   </div>
                </div>
                <button 
                  onClick={handleRunAnalysis} 
                  disabled={loadingAi}
                  className="w-full md:w-auto px-8 py-4 bg-indigo-600 text-white rounded-2xl font-black shadow-xl hover:bg-indigo-700 flex items-center justify-center gap-3 transition disabled:opacity-50"
                >
                   {loadingAi ? <Loader2 className="animate-spin" size={20}/> : <Sparkles size={20}/>}
                   {loadingAi ? 'AI 計算中...' : '生成報告 (Generate)'}
                </button>
             </div>

             <div className="p-8 md:p-12 min-h-[300px] flex items-center justify-center">
                {aiAnalysis ? (
                  <div className="w-full space-y-8 animate-fade-in">
                    <div className="flex flex-col md:flex-row gap-8">
                       <div className="flex-1 p-8 bg-slate-50 rounded-[35px] border border-slate-100 text-center">
                          <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4">財務健康得分 (Score)</div>
                          <div className={`text-6xl font-black ${aiAnalysis.healthScore >= 70 ? 'text-emerald-500' : 'text-rose-500'}`}>{aiAnalysis.healthScore}</div>
                       </div>
                       <div className="flex-[2] p-8 bg-indigo-50/50 rounded-[35px] border border-indigo-100/50">
                          <div className="text-[10px] font-black text-indigo-400 uppercase tracking-widest mb-4">分析重點 (Summary)</div>
                          <p className="text-slate-700 font-bold leading-relaxed">{aiAnalysis.summary}</p>
                       </div>
                    </div>
                    <div className="p-8 bg-white border border-slate-100 rounded-[35px] shadow-sm">
                       <h4 className="font-black text-slate-950 text-lg mb-4 flex items-center gap-2"><TrendingUp className="text-indigo-600"/> 具體優化建議 (Strategy)</h4>
                       <p className="text-slate-600 font-bold leading-relaxed whitespace-pre-wrap">{aiAnalysis.strategicAdvice}</p>
                    </div>
                    <button onClick={handleSaveAdvice} className="flex items-center gap-2 text-slate-400 hover:text-indigo-600 font-black transition text-sm">
                      <Save size={18}/> 儲存診斷紀錄 (Save Report)
                    </button>
                  </div>
                ) : (
                  <div className="text-center opacity-30 font-black uppercase tracking-widest">
                     等待啟動診斷 (Waiting to Start)
                  </div>
                )}
             </div>
          </div>

          <div className="space-y-6">
             <h3 className="text-xl font-black text-slate-950 flex items-center gap-3"><History size={24}/> 歷史診斷紀錄 (Saved Reports)</h3>
             <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {savedAdvices.map(advice => (
                  <div key={advice.id} className="bg-white p-8 rounded-[35px] border border-slate-100 shadow-sm group hover:border-indigo-200 transition-all">
                     <div className="flex justify-between mb-4">
                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{new Date(advice.createdAt).toLocaleDateString()}</span>
                        <div className="bg-indigo-50 text-indigo-600 px-3 py-1 rounded-full text-[10px] font-black">Score: {advice.score}</div>
                     </div>
                     <h4 className="font-black text-slate-800 mb-2 truncate">{advice.title}</h4>
                     <p className="text-slate-500 text-xs font-bold line-clamp-2 leading-relaxed mb-6">{advice.content}</p>
                     <button 
                       onClick={() => setSelectedAdvice(advice)}
                       className="text-indigo-600 font-black text-xs flex items-center gap-2 hover:gap-3 transition-all"
                     >
                       詳情內容 View Detail <ChevronRight size={14}/>
                     </button>
                  </div>
                ))}
                {savedAdvices.length === 0 && (
                  <div className="col-span-full py-12 text-center text-slate-300 font-black uppercase tracking-widest border-2 border-dashed border-slate-200 rounded-[35px]">尚無紀錄 (Empty)</div>
                )}
             </div>
          </div>
        </div>

        <div className="xl:col-span-1">
          <div className="bg-white rounded-[40px] shadow-2xl border border-slate-100 flex flex-col h-[700px] sticky top-12">
             <div className="p-8 border-b border-slate-50 flex items-center gap-4">
                <div className="w-12 h-12 bg-emerald-500 rounded-2xl flex items-center justify-center text-white shadow-xl shadow-emerald-100">
                   <MessageSquare size={24} />
                </div>
                <div>
                   <h3 className="font-black text-slate-950">智能財務助理 (AI Chat)</h3>
                   <span className="text-[10px] font-black text-emerald-500 uppercase tracking-widest">Online Assistant</span>
                </div>
             </div>
             <div className="flex-1 overflow-y-auto p-8 space-y-6">
                {chatHistory.map((msg, i) => (
                  <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                    <div className={`max-w-[85%] p-5 rounded-[25px] font-bold text-sm ${msg.role === 'user' ? 'bg-indigo-600 text-white rounded-br-none shadow-xl' : 'bg-slate-50 text-slate-700 border border-slate-100 rounded-bl-none'}`}>
                      {msg.parts[0].text}
                    </div>
                  </div>
                ))}
                {isChatting && <div className="flex justify-start"><div className="bg-slate-50 p-4 rounded-2xl animate-pulse text-slate-400 font-bold">AI thinking...</div></div>}
                <div ref={chatEndRef} />
             </div>
             <form onSubmit={handleChatSubmit} className="p-8 border-t border-slate-50">
                <div className="relative">
                   <input value={chatInput} onChange={e => setChatInput(e.target.value)} placeholder="詢問顧問或提出模擬假設... (Ask AI)" className="w-full bg-slate-50 border border-slate-100 rounded-2xl py-4 pl-5 pr-14 font-bold text-sm outline-none focus:border-indigo-300" />
                   <button type="submit" disabled={!chatInput.trim() || isChatting} className="absolute right-2 top-1/2 -translate-y-1/2 w-10 h-10 bg-indigo-600 text-white rounded-xl flex items-center justify-center shadow-lg disabled:opacity-30">
                      <Send size={18} />
                   </button>
                </div>
             </form>
          </div>
        </div>
        {renderAdviceDetailModal()}
    </div>
  );

  const renderAdviceDetailModal = () => {
    if (!selectedAdvice) return null;
    return (
      <div className="fixed inset-0 bg-slate-950/80 z-[70] flex items-center justify-center p-4 backdrop-blur-xl animate-fade-in">
        <div className="bg-white rounded-[40px] shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
          <div className="p-8 border-b border-slate-50 flex justify-between items-center">
            <div>
              <h3 className="font-black text-xl md:text-2xl text-slate-950">報告詳情 Report Detail</h3>
              <p className="text-slate-400 font-bold text-xs uppercase tracking-widest mt-1">Saved Financial Diagnosis</p>
            </div>
            <button onClick={() => setSelectedAdvice(null)} className="p-3 hover:bg-slate-100 rounded-full transition"><X size={24}/></button>
          </div>
          <div className="flex-1 overflow-y-auto p-8 md:p-12 space-y-8">
             <div className="flex items-center justify-between">
                <span className="text-xs font-black text-slate-400 bg-slate-50 px-4 py-2 rounded-full border border-slate-100">存檔日期: {new Date(selectedAdvice.createdAt).toLocaleString()}</span>
                <div className={`px-5 py-2 rounded-2xl font-black text-sm flex items-center gap-2 ${selectedAdvice.score >= 70 ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600'}`}>
                   健康得分: {selectedAdvice.score}
                </div>
             </div>
             <div>
                <h4 className="font-black text-slate-800 text-lg mb-4">{selectedAdvice.title}</h4>
                <div className="p-8 bg-slate-50 border border-slate-100 rounded-[35px] text-slate-600 font-bold leading-relaxed whitespace-pre-wrap text-md">
                   {selectedAdvice.content}
                </div>
             </div>
          </div>
          <div className="p-8 bg-slate-50 border-t border-slate-100">
             <button 
               onClick={() => setSelectedAdvice(null)}
               className="w-full py-4 bg-indigo-600 text-white font-black rounded-3xl shadow-xl active:scale-95 transition"
             >
               關閉報告 Close
             </button>
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
                <Plus size={18} /> 新增項目 (Add Item)
            </button>
        </div>
        <div className="overflow-x-auto">
            <table className="w-full text-left min-w-[500px]">
                <thead className="bg-slate-50/50 text-slate-400 text-[9px] md:text-[11px] font-black uppercase tracking-[0.2em]">
                    <tr><th className="p-6 md:p-8">財務項目 Name</th><th className="p-6 md:p-8">金額/價值 Amount/Value</th><th className="p-6 md:p-8 text-center">操作 Actions</th></tr>
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
                    {items.length === 0 && (
                        <tr><td colSpan={3} className="p-20 text-center font-black text-slate-300 uppercase tracking-widest">目前無資料 (No Data)</td></tr>
                    )}
                </tbody>
            </table>
        </div>
    </div>
  );

  const handleDelete = (cat: keyof FinancialState, id: string) => {
    if (!window.confirm("確定永久刪除此項？ Are you sure you want to delete?")) return;
    setFinancials(prev => ({ ...prev, [cat]: (prev[cat] as any[]).filter(it => it.id !== id) }));
  };

  const navItems = [
    { id: 'dashboard', icon: Activity, label: '數據總覽 (Dashboard)' },
    { id: 'assets', icon: DollarSign, label: '資產配置 (Assets)' },
    { id: 'liabilities', icon: TrendingDown, label: '負債結構 (Liabilities)' },
    { id: 'cashflow', icon: TrendingUp, label: '現金流量 (Cash Flow)' },
    { id: 'scenario', icon: Calculator, label: '戰略模擬 (Scenario)' },
    { id: 'advisor', icon: BrainCircuit, label: 'AI 戰略顧問 (Advisor)' },
  ];

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
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">項目名稱 (Item Name)</label>
              <input value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} className="w-full p-4 md:p-5 bg-slate-50 border border-slate-100 rounded-3xl outline-none font-bold text-lg" placeholder="輸入名稱..." />
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{modalConfig.type === 'asset' ? '預估價值 (Value)' : '剩餘數額 (Amount)'}</label>
              <input type="number" value={modalConfig.type === 'asset' ? formData.value : formData.amount} onChange={e => setFormData({...formData, [modalConfig.type === 'asset' ? 'value' : 'amount']: e.target.value})} className="w-full p-4 md:p-5 bg-slate-50 border border-slate-100 rounded-3xl outline-none font-black text-2xl text-indigo-600" />
            </div>
            {modalConfig.type === 'liability' && (
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">每月付金 (Monthly Payment)</label>
                <input type="number" value={formData.monthlyPayment} onChange={e => setFormData({...formData, monthlyPayment: e.target.value})} className="w-full p-4 bg-slate-50 border border-slate-100 rounded-3xl outline-none font-black text-xl" />
              </div>
            )}
          </div>
          <div className="p-6 md:p-8 bg-slate-50 flex gap-4 md:gap-6">
             <button onClick={() => setIsModalOpen(false)} className="flex-1 py-4 text-slate-500 font-black">取消 (Cancel)</button>
             <button onClick={handleSaveItem} className="flex-1 py-4 bg-indigo-600 text-white font-black rounded-3xl shadow-xl active:scale-95 transition">確認儲存 (Confirm)</button>
          </div>
        </div>
      </div>
    );
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
      alert("儲存成功！");
    } catch (e) {
      alert("儲存失敗");
    } finally {
      setGeneratingSummary(false);
    }
  };

  const startNewScenario = () => {
    if (scenarios.length >= 8) return alert("最多 8 個 (Max 8)");
    setEditingScenario({
      name: `情境模擬 ${scenarios.length + 1}`,
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

  if (isAuthChecking) return <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50 space-y-6 text-indigo-600"><Loader2 className="w-16 h-16 animate-spin" /><span className="font-black text-sm uppercase tracking-[0.3em]">WealthFlow Loading...</span></div>;
  if (!user && !isGuest) return <div className="min-h-screen flex items-center justify-center bg-slate-100 p-8"><div className="bg-white p-14 rounded-[40px] shadow-2xl text-center max-w-md w-full"><div className="w-20 h-20 bg-indigo-600 rounded-[35px] mx-auto mb-10 flex items-center justify-center text-white shadow-2xl rotate-3"><DollarSign size={40}/></div><h1 className="text-2xl font-black mb-3 tracking-tighter">WealthFlow AI</h1><p className="text-slate-500 text-lg mb-10 font-bold leading-relaxed">專業智能財務管理系統</p><div className="space-y-4"><button onClick={loginWithGoogle} className="w-full bg-slate-950 text-white py-5 rounded-[25px] font-black text-lg flex items-center justify-center gap-4 transition hover:scale-105">Google 帳號登入 (Login)</button><button onClick={() => setIsGuest(true)} className="w-full bg-white text-slate-600 border border-slate-200 py-5 rounded-[25px] font-black text-lg hover:bg-slate-50 transition">訪客試用模式 (Guest Mode)</button></div></div></div>;

  return (
    <div className="min-h-screen bg-slate-50 flex font-sans selection:bg-indigo-200 selection:text-indigo-900 overflow-x-hidden">
      {/* Sidebar / Sidebar Drawer */}
      {isSidebarOpen && <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-40 lg:hidden" onClick={() => setIsSidebarOpen(false)} />}

      <aside className={`fixed top-0 left-0 h-full bg-white border-r border-slate-100 z-50 w-80 transition-transform duration-300 ease-in-out lg:translate-x-0 lg:static flex flex-col ${isSidebarOpen ? 'translate-x-0 shadow-2xl' : '-translate-x-full'}`}>
        <div className="p-8 md:p-10">
          <div className="flex items-center justify-between mb-12">
            <button onClick={() => { setActiveTab('dashboard'); setIsSidebarOpen(false); }} className="flex items-center gap-4 text-indigo-600 active:scale-95 transition">
              <div className="w-12 h-12 bg-indigo-600 rounded-[22px] flex items-center justify-center shadow-xl rotate-2">
                <DollarSign className="text-white w-7 h-7" />
              </div>
              <span className="font-black text-2xl tracking-tighter text-slate-950">WealthFlow</span>
            </button>
            <button onClick={() => setIsSidebarOpen(false)} className="lg:hidden p-2 text-slate-400 hover:bg-slate-50 rounded-full">
              <X size={24} />
            </button>
          </div>
          <nav className="space-y-2.5">
            {navItems.map(item => (
              <button
                key={item.id}
                onClick={() => { setActiveTab(item.id as any); setIsSidebarOpen(false); }}
                className={`w-full flex items-center gap-5 px-6 py-5 text-md font-black rounded-3xl transition-all ${
                  activeTab === item.id ? 'bg-indigo-600 text-white shadow-2xl translate-x-2' : 'text-slate-500 hover:bg-slate-50'
                }`}
              >
                <item.icon size={20} />
                {item.label}
              </button>
            ))}
          </nav>
        </div>
        <div className="mt-auto border-t border-slate-50 p-8">
           <div className="bg-slate-50/50 rounded-[35px] p-5 border border-slate-100 flex items-center gap-5">
              <div className="w-12 h-12 bg-white rounded-2xl flex items-center justify-center text-slate-400 font-bold border border-slate-200 overflow-hidden">{user?.photoURL ? <img src={user.photoURL} className="w-full h-full object-cover" /> : <UserIcon size={22}/>}</div>
              <div className="flex-1 min-w-0">
                <div className="text-xs font-black text-slate-950 truncate uppercase">{user?.displayName || 'Guest User'}</div>
                <div className={`text-[10px] font-black uppercase tracking-widest ${syncStatus === 'synced' ? 'text-emerald-500' : 'text-amber-500'}`}>{syncStatus}</div>
              </div>
              <button onClick={handleLogout} className="p-3 text-slate-300 hover:text-rose-500"><LogOut size={20}/></button>
           </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 min-h-screen relative">
        <div className="lg:hidden sticky top-0 bg-white/80 backdrop-blur-md border-b border-slate-100 z-30 flex items-center justify-between px-6 py-4">
           <button onClick={() => setActiveTab('dashboard')} className="flex items-center gap-3">
              <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center text-white"><DollarSign size={18} /></div>
              <span className="font-black tracking-tighter text-slate-950">WealthFlow AI</span>
           </button>
           <div className="flex gap-2">
             <button onClick={() => setActiveTab('dashboard')} className="p-2.5 bg-white border border-slate-200 rounded-xl text-slate-600 shadow-sm" title="Dashboard">
               <Home size={20} />
             </button>
             <button onClick={() => setIsSidebarOpen(true)} className="p-2.5 bg-slate-950 rounded-xl text-white shadow-sm">
                <Menu size={20} />
             </button>
           </div>
        </div>

        <div className="p-6 md:p-12 max-w-7xl mx-auto h-full">
          {activeTab === 'scenario' ? renderScenarioMode() : (
            <div className="animate-fade-in">
                <header className="mb-10 md:mb-14 flex flex-col md:flex-row justify-between items-start md:items-center px-2 md:px-0 gap-4">
                  <div>
                    <h1 className="text-2xl md:text-4xl font-black text-slate-950 tracking-tighter uppercase">
                      {activeTab === 'dashboard' && '數據大盤 (Dashboard)'}
                      {activeTab === 'assets' && '資產配置 (Assets)'}
                      {activeTab === 'liabilities' && '負債結構 (Liabilities)'}
                      {activeTab === 'cashflow' && '收支流量 (Cash Flow)'}
                      {activeTab === 'advisor' && 'AI 戰略顧問 (Advisor)'}
                    </h1>
                    <p className="text-slate-400 font-bold text-xs mt-1 uppercase tracking-widest">Professional Financial Tracking Suite</p>
                  </div>
                  {activeTab !== 'dashboard' && (
                    <button 
                      onClick={() => setActiveTab('dashboard')}
                      className="hidden md:flex items-center gap-2 px-6 py-3 bg-white border border-slate-200 rounded-2xl text-slate-600 font-black text-sm hover:bg-slate-50 transition"
                    >
                      <Home size={18} /> 返回儀表板 (Dashboard)
                    </button>
                  )}
                </header>

                {activeTab === 'dashboard' && renderDashboard()}
                {activeTab === 'assets' && renderList('資產詳細清單 Asset Inventory', financials.assets, 'asset', 'emerald')}
                {activeTab === 'liabilities' && renderList('負債結構明細 Debt Structure', financials.liabilities, 'liability', 'rose')}
                {activeTab === 'cashflow' && (
                   <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 md:gap-10">
                      {renderList('主被動收入 Income', financials.incomes, 'income', 'emerald')}
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