import React, { useState, useEffect, useCallback } from 'react';
import { AssetType, LiabilityType, AssetItem, LiabilityItem, CashFlowItem, FinancialState, Scenario } from './types';
import { analyzeFinances, parseFinancialScreenshot, generateScenarioSummary } from './services/geminiService';
import { loginWithGoogle, logout, subscribeAuth, saveUserData, loadUserData } from './services/firebase';
import { AssetAllocationChart, NetWorthBarChart } from './components/Charts';
import { Plus, Trash2, DollarSign, TrendingUp, TrendingDown, Activity, AlertTriangle, CheckCircle, BrainCircuit, Upload, ScanLine, X, Loader2, PlayCircle, Save, ArrowRight, LogIn, LogOut, User as UserIcon, Cloud, CloudOff, Pencil, Lock, Mail, UserCheck, ChevronRight, Calculator, Wallet, PiggyBank } from 'lucide-react';
import { User } from 'firebase/auth';

// --- Initial Mock Data ---
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
  { id: '4', name: '孝親費', amount: 10000, type: 'Expense' }, // Intentionally creating a deficit for demo
];

// --- Login Page Component ---
const LoginPage = ({ onLogin, onGuestLogin, loading }: { onLogin: () => void, onGuestLogin: () => void, loading: boolean }) => {
  return (
    <div className="min-h-screen w-full bg-gradient-to-br from-rose-500 via-pink-600 to-purple-700 flex flex-col items-center justify-center p-6 relative overflow-hidden font-sans">
      {/* Background patterns */}
      <div className="absolute top-0 left-0 w-full h-full overflow-hidden opacity-20 pointer-events-none">
          <div className="absolute -top-[20%] -left-[10%] w-96 h-96 bg-white rounded-full mix-blend-overlay filter blur-3xl animate-pulse"></div>
          <div className="absolute top-[40%] -right-[10%] w-72 h-72 bg-purple-500 rounded-full mix-blend-overlay filter blur-3xl animate-pulse" style={{animationDelay: '2s'}}></div>
      </div>

      <div className="z-10 w-full max-w-sm flex flex-col items-center space-y-8 animate-fade-in-up">
        {/* Logo Section */}
        <div className="relative group transform hover:scale-105 transition duration-500">
            <div className="absolute -inset-1 bg-gradient-to-r from-yellow-300 to-pink-300 rounded-full blur opacity-50 group-hover:opacity-100 transition duration-1000"></div>
            <div className="relative w-32 h-32 bg-white rounded-full flex items-center justify-center shadow-2xl border-4 border-white/50">
               <div className="bg-gradient-to-br from-indigo-600 to-violet-600 w-24 h-24 rounded-full flex items-center justify-center shadow-inner overflow-hidden relative">
                  <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')] opacity-30"></div>
                  <DollarSign size={48} className="text-white drop-shadow-md z-10" />
               </div>
            </div>
        </div>

        {/* Title Section */}
        <div className="text-center space-y-2 text-white">
           <h1 className="text-3xl font-bold tracking-wider drop-shadow-md">WealthFlow</h1>
           <p className="text-pink-100 text-sm font-medium tracking-wide bg-white/10 px-3 py-1 rounded-full backdrop-blur-sm">AI 智能資產配置顧問</p>
        </div>

        {/* Form Section */}
        <div className="w-full bg-white/95 backdrop-blur-md rounded-2xl p-6 shadow-2xl space-y-5 border border-white/20">
             {/* Fake Inputs for visual similarity to request */}
             <div className="space-y-3">
                 <div className="relative group">
                    <Mail className="absolute left-3 top-3 text-slate-400 group-focus-within:text-rose-500 transition" size={18} />
                    <input type="text" placeholder="Email / 手機號碼" disabled className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-500 cursor-not-allowed focus:outline-none transition" />
                 </div>
                 <div className="relative group">
                     <Lock className="absolute left-3 top-3 text-slate-400 group-focus-within:text-rose-500 transition" size={18}/>
                    <input type="password" placeholder="密碼" disabled className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-500 cursor-not-allowed focus:outline-none transition" />
                 </div>
             </div>

             <div className="flex justify-between text-xs text-slate-500 px-1">
                <span className="cursor-pointer hover:text-rose-600">忘記密碼?</span>
                <span className="cursor-pointer hover:text-rose-600">註冊新帳號</span>
             </div>

             <button disabled className="w-full bg-slate-800 text-white font-bold py-3 rounded-xl text-sm cursor-not-allowed opacity-50 shadow-lg">
                登入 (僅開放第三方登入)
             </button>

             <div className="relative py-2">
                <div className="absolute inset-0 flex items-center">
                  <span className="w-full border-t border-slate-200"></span>
                </div>
                <div className="relative flex justify-center text-xs text-slate-400 uppercase">
                  <span className="bg-white px-2">快速登入</span>
                </div>
             </div>
             
             <div className="space-y-3">
               <button 
                 onClick={onLogin}
                 disabled={loading}
                 className="w-full bg-white border border-slate-200 text-slate-700 font-bold py-3 rounded-xl hover:bg-slate-50 transition flex items-center justify-center gap-3 shadow-sm hover:shadow-md active:scale-95 transform duration-200 relative"
               >
                  {loading ? <Loader2 className="animate-spin text-rose-500" size={20} /> : (
                    <>
                      <img src="https://www.google.com/favicon.ico" alt="Google" className="w-5 h-5" />
                      <span>使用 Google 登入</span>
                    </>
                  )}
               </button>
               
               {/* Guest Login Button */}
               <button 
                 onClick={onGuestLogin}
                 disabled={loading}
                 className="w-full bg-indigo-50 border border-indigo-100 text-indigo-700 font-bold py-3 rounded-xl hover:bg-indigo-100 transition flex items-center justify-center gap-3 shadow-sm hover:shadow-md active:scale-95 transform duration-200"
               >
                  <UserCheck size={20} />
                  <span>訪客體驗登入 (Guest)</span>
               </button>
             </div>
        </div>

        {/* Footer */}
        <p className="text-xs text-white/70 text-center leading-relaxed px-4 opacity-80">
          免責聲明：本 APP 經由 AI 運算提供財務建議，僅供參考。<br/>投資人請自行評估風險，本產品不負任何盈虧責任。
        </p>
      </div>
    </div>
  );
};

// --- Main Component ---

export default function App() {
  const [activeTab, setActiveTab] = useState<'dashboard' | 'assets' | 'liabilities' | 'cashflow' | 'advisor' | 'import' | 'scenario'>('dashboard');
  
  const [financials, setFinancials] = useState<FinancialState>({
    assets: initialAssets,
    liabilities: initialLiabilities,
    incomes: initialIncomes,
    expenses: initialExpenses
  });

  // Auth & Sync State
  const [user, setUser] = useState<User | null>(null);
  const [isGuest, setIsGuest] = useState(false); // Track guest mode
  const [isAuthChecking, setIsAuthChecking] = useState(true); // Initial load check
  const [syncStatus, setSyncStatus] = useState<'synced' | 'saving' | 'offline'>('offline');
  const [dataLoaded, setDataLoaded] = useState(false);

  const [aiAnalysis, setAiAnalysis] = useState<any>(null);
  const [loadingAi, setLoadingAi] = useState(false);
  const [loginLoading, setLoginLoading] = useState(false); // New state for login button loading

  // Import State
  const [importImage, setImportImage] = useState<string | null>(null);
  const [importing, setImporting] = useState(false);
  const [extractedData, setExtractedData] = useState<{ assets: any[], liabilities: any[] } | null>(null);

  // Scenario State
  const [scenarios, setScenarios] = useState<Scenario[]>([]);
  const [editingScenario, setEditingScenario] = useState<{
    name: string;
    data: FinancialState; // This holds the *filtered* state (What is KEPT)
    originalData: FinancialState; // To calculate differences
  } | null>(null);
  const [generatingSummary, setGeneratingSummary] = useState(false);

  // Modal State for Adding/Editing Items
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalConfig, setModalConfig] = useState<{type: 'income' | 'expense' | 'asset' | 'liability', title: string} | null>(null);
  const [formData, setFormData] = useState<any>({});
  const [editingId, setEditingId] = useState<string | null>(null);

  // --- Effects for Firebase ---
  useEffect(() => {
    const unsub = subscribeAuth((u) => {
      if (!isGuest) { 
        setUser(u);
        setIsAuthChecking(false);
        if (u) {
            setSyncStatus('saving');
            loadUserData(u.uid).then(data => {
                if (data) {
                    setFinancials(data.financials);
                    setScenarios(data.scenarios || []);
                }
                setDataLoaded(true);
                setSyncStatus('synced');
            });
        } else {
            setSyncStatus('offline');
            setDataLoaded(false);
        }
      }
    });
    return () => unsub();
  }, [isGuest]);

  useEffect(() => {
    if (user && dataLoaded && !isGuest) {
        setSyncStatus('saving');
        const timer = setTimeout(() => {
            saveUserData(user.uid, { financials, scenarios })
                .then(() => setSyncStatus('synced'))
                .catch(() => setSyncStatus('offline'));
        }, 2000); // Debounce 2s
        return () => clearTimeout(timer);
    }
  }, [financials, scenarios, user, dataLoaded, isGuest]);


  // Derived Calculations
  const calcMetrics = (data: FinancialState) => {
    const totalAssets = data.assets.reduce((sum, item) => sum + item.value, 0);
    const totalLiabilities = data.liabilities.reduce((sum, item) => sum + item.amount, 0);
    const netWorth = totalAssets - totalLiabilities;
    const totalIncome = data.incomes.reduce((sum, item) => sum + item.amount, 0);
    const totalExpenses = data.expenses.reduce((sum, item) => sum + item.amount, 0);
    const monthlyCashFlow = totalIncome - totalExpenses;
    return { totalAssets, totalLiabilities, netWorth, totalIncome, totalExpenses, monthlyCashFlow };
  };

  const currentMetrics = calcMetrics(financials);

  // Handlers
  const handleLogin = async () => {
    setLoginLoading(true);
    try {
        await loginWithGoogle();
    } catch (e: any) {
        console.error("Login Error:", e);
        setLoginLoading(false);
    }
  };

  const handleGuestLogin = () => {
    setIsGuest(true);
    setUser({ uid: 'guest', displayName: 'Guest User', email: 'guest@example.com' } as any);
    setIsAuthChecking(false);
    setSyncStatus('offline');
  };

  const handleLogout = async () => {
    if (isGuest) {
      setIsGuest(false);
      setUser(null);
    } else {
      await logout();
    }
  };

  const handleDelete = (category: keyof FinancialState, id: string) => {
    if (!window.confirm("確定要刪除此項目嗎？")) return;
    setFinancials(prev => ({
      ...prev,
      [category]: (prev[category] as any[]).filter((item: any) => item.id !== id)
    }));
  };

  const handleRunAnalysis = async () => {
    setLoadingAi(true);
    try {
      const resultJson = await analyzeFinances(financials);
      setAiAnalysis(JSON.parse(resultJson));
    } catch (e: any) {
      alert(`AI 分析失敗 (AI Analysis Failed):\n${e.message}`);
    } finally {
      setLoadingAi(false);
    }
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setImportImage(reader.result as string);
        setExtractedData(null); 
      };
      reader.readAsDataURL(file);
    }
  };

  const handleParseImage = async () => {
    if (!importImage) return;
    setImporting(true);
    try {
      const base64Data = importImage.split(',')[1];
      const resultJson = await parseFinancialScreenshot(base64Data);
      const parsed = JSON.parse(resultJson);
      if (parsed.assets) parsed.assets = parsed.assets.map((a: any) => ({ ...a, id: crypto.randomUUID() }));
      if (parsed.liabilities) parsed.liabilities = parsed.liabilities.map((l: any) => ({ ...l, id: crypto.randomUUID() }));
      setExtractedData(parsed);
    } catch (e: any) {
      console.error(e);
      alert(`圖像識別失敗 (Image Parse Failed):\n${e.message}`);
    } finally {
      setImporting(false);
    }
  };

  const confirmImport = () => {
    if (!extractedData) return;
    setFinancials(prev => ({
      ...prev,
      assets: [...prev.assets, ...(extractedData.assets || [])],
      liabilities: [...prev.liabilities, ...(extractedData.liabilities || [])]
    }));
    setImportImage(null);
    setExtractedData(null);
    setActiveTab('dashboard');
    alert("資料匯入成功！");
  };

  // Scenario Handlers
  const startNewScenario = () => {
    if (scenarios.length >= 5) {
      alert("最多儲存 5 個情境模擬");
      return;
    }
    setEditingScenario({
      name: `情境模擬 ${scenarios.length + 1}`,
      data: JSON.parse(JSON.stringify(financials)),
      originalData: JSON.parse(JSON.stringify(financials)),
    });
  };

  const toggleScenarioItem = (category: keyof FinancialState, item: any) => {
    if (!editingScenario) return;
    
    let newData = { ...editingScenario.data };
    const currentList = newData[category] as any[];
    const exists = currentList.find(x => x.id === item.id);
    
    // Helper to normalize names for comparison (remove spaces, symbols)
    const normalize = (s: string) => s.replace(/[\s\-_支出費用]/g, '').toLowerCase();

    if (exists) {
      // Uncheck -> Remove (Simulate Sell/Payoff/Cut)
      newData[category] = currentList.filter(x => x.id !== item.id);

      // --- SMART LINKING LOGIC (Auto-remove associated items) ---
      if (category === 'liabilities') {
        // If we pay off a liability, we should also cut the corresponding expense
        const liabilityName = normalize(item.name);
        newData.expenses = newData.expenses.filter(exp => {
           const expName = normalize(exp.name);
           // If names are very similar, assume they are linked and remove the expense too
           const isLinked = expName.includes(liabilityName) || liabilityName.includes(expName);
           return !isLinked; // Keep only if NOT linked
        });
      }
    } else {
      // Check -> Add back
      // Since arrays in editingScenario.data might be different refs, we assume item is from originalData
      newData[category] = [...currentList, item];
      
      // --- SMART LINKING LOGIC (Auto-restore associated items) ---
       if (category === 'liabilities') {
          // If we restore a liability, check if we need to restore a linked expense
          const liabilityName = normalize(item.name);
          const originalExpense = editingScenario.originalData.expenses.find(exp => {
              const expName = normalize(exp.name);
              return expName.includes(liabilityName) || liabilityName.includes(expName);
          });
          
          // If we found a linked expense AND it's currently missing (cut), add it back
          if (originalExpense && !newData.expenses.find(e => e.id === originalExpense.id)) {
             newData.expenses = [...newData.expenses, originalExpense];
          }
       }
    }
    
    setEditingScenario({
      ...editingScenario,
      data: newData
    });
  };

  const saveScenario = async () => {
    if (!editingScenario) return;
    setGeneratingSummary(true);
    try {
      const summary = await generateScenarioSummary(editingScenario.originalData, editingScenario.data);
      const newScenario: Scenario = {
        id: crypto.randomUUID(),
        name: editingScenario.name,
        data: editingScenario.data,
        aiSummary: summary,
        createdAt: Date.now()
      };
      setScenarios([...scenarios, newScenario]);
      setEditingScenario(null);
    } catch (e) {
      alert("儲存失敗");
    } finally {
      setGeneratingSummary(false);
    }
  };

  const loadScenario = (scenario: Scenario) => {
    setEditingScenario({
      name: scenario.name,
      data: JSON.parse(JSON.stringify(scenario.data)),
      originalData: JSON.parse(JSON.stringify(financials)) 
    });
  };

  // Modal Handlers
  const handleOpenModal = (type: 'income' | 'expense' | 'asset' | 'liability', existingItem?: any) => {
    let title = '';
    let initialData = {};
    if (existingItem) {
        setEditingId(existingItem.id);
        setFormData({ ...existingItem });
        title = `編輯 ${type === 'income' ? '收入' : type === 'expense' ? '支出' : type === 'asset' ? '資產' : '負債'} Edit`;
    } else {
        setEditingId(null);
        switch(type) {
            case 'income': title = '新增收入 Add Income'; initialData = { name: '', amount: '' }; break;
            case 'expense': title = '新增支出 Add Expense'; initialData = { name: '', amount: '' }; break;
            case 'asset': title = '新增資產 Add Asset'; initialData = { name: '', value: '', type: AssetType.STOCK, liquidity: 'High', returnRate: 0 }; break;
            case 'liability': title = '新增負債 Add Liability'; initialData = { name: '', amount: '', type: LiabilityType.PERSONAL_LOAN, interestRate: 0, monthlyPayment: 0 }; break;
        }
        setFormData(initialData);
    }
    setModalConfig({ type, title });
    setIsModalOpen(true);
  };

  const handleSaveItem = () => {
    if (!modalConfig) return;
    const updateList = (category: keyof FinancialState, newItem: any) => {
        setFinancials(prev => {
            const list = prev[category] as any[];
            if (editingId) {
                return { ...prev, [category]: list.map(item => item.id === editingId ? { ...item, ...newItem } : item) };
            } else {
                return { ...prev, [category]: [...list, { ...newItem, id: crypto.randomUUID() }] };
            }
        });
    };
    if (modalConfig.type === 'income' || modalConfig.type === 'expense') {
        if (!formData.name || !formData.amount) return alert("請輸入名稱與金額");
        const cat = modalConfig.type === 'income' ? 'incomes' : 'expenses';
        updateList(cat, { name: formData.name, amount: Number(formData.amount), type: modalConfig.type === 'income' ? 'Income' : 'Expense' });
    } else if (modalConfig.type === 'asset') {
        if (!formData.name || !formData.value) return alert("請輸入名稱與價值");
        updateList('assets', { name: formData.name, value: Number(formData.value), type: formData.type, liquidity: formData.liquidity, returnRate: Number(formData.returnRate) });
    } else if (modalConfig.type === 'liability') {
         if (!formData.name || !formData.amount) return alert("請輸入名稱與金額");
         updateList('liabilities', { name: formData.name, amount: Number(formData.amount), type: formData.type, interestRate: Number(formData.interestRate), monthlyPayment: Number(formData.monthlyPayment) });
    }
    setIsModalOpen(false);
  };

  // --- Render Functions ---

  const renderDashboard = () => (
    <div className="space-y-6 animate-fade-in pb-10">
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {/* KPI Cards */}
        {[
          { title: '淨資產 Net Worth', value: currentMetrics.netWorth, color: 'text-slate-800', tab: 'advisor' },
          { title: '月現金流 Cash Flow', value: currentMetrics.monthlyCashFlow, color: currentMetrics.monthlyCashFlow >= 0 ? 'text-emerald-600' : 'text-rose-600', tab: 'cashflow' },
          { title: '資產總額 Assets', value: currentMetrics.totalAssets, color: 'text-emerald-600', tab: 'assets' },
          { title: '負債總額 Liabilities', value: currentMetrics.totalLiabilities, color: 'text-rose-600', tab: 'liabilities' },
        ].map((kpi, idx) => (
          <div key={idx} onClick={() => setActiveTab(kpi.tab as any)} className="bg-white p-6 rounded-xl shadow-sm border border-slate-100 cursor-pointer hover:shadow-md transition group relative">
             <div className="text-sm text-slate-500 mb-1 flex justify-between">{kpi.title} <ChevronRight size={16} className="text-slate-300 group-hover:text-indigo-500"/></div>
             <div className={`text-2xl font-bold ${kpi.color}`}>${kpi.value.toLocaleString()}</div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-100">
          <h3 className="text-lg font-semibold text-slate-800 mb-4">資產與負債比較</h3>
          <NetWorthBarChart assets={financials.assets} liabilities={financials.liabilities} />
        </div>
        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-100">
          <h3 className="text-lg font-semibold text-slate-800 mb-4">資產配置 Asset Allocation</h3>
          <AssetAllocationChart assets={financials.assets} />
        </div>
      </div>
    </div>
  );
  
  // Dedicated Advisor Renderer
  const renderAdvisor = () => (
    <div className="max-w-4xl mx-auto space-y-6 pb-12 animate-fade-in">
      {/* Intro Card */}
      <div className="bg-gradient-to-r from-indigo-600 to-purple-600 rounded-2xl p-8 text-white shadow-lg relative overflow-hidden">
        <div className="relative z-10">
          <h2 className="text-3xl font-bold mb-4 flex items-center gap-3">
             <BrainCircuit size={32} /> AI 智能財務顧問
          </h2>
          <p className="text-indigo-100 mb-8 max-w-xl text-lg leading-relaxed">
            基於您的資產負債表與現金流，Gemini AI 將為您進行全方位的財務健檢，並提供具體的償債與投資建議。
          </p>
          <button 
            onClick={handleRunAnalysis} 
            disabled={loadingAi}
            className="bg-white text-indigo-600 font-bold py-3 px-8 rounded-full shadow-lg hover:bg-indigo-50 transition transform hover:scale-105 active:scale-95 flex items-center gap-2"
          >
            {loadingAi ? <Loader2 className="animate-spin" /> : <BrainCircuit size={20} />}
            {loadingAi ? 'AI 正在分析您的財務狀況...' : '開始 AI 財務健檢'}
          </button>
        </div>
        {/* Background Decorations */}
        <div className="absolute right-0 top-0 h-full w-1/2 opacity-10 pointer-events-none">
            <Activity size={400} className="absolute -right-20 -top-20" />
        </div>
      </div>

      {/* Analysis Result */}
      {aiAnalysis && (
        <div className="space-y-6 animate-fade-in-up">
           {/* Summary & Score */}
           <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-100 md:col-span-2">
                 <h3 className="text-sm font-bold text-slate-500 uppercase tracking-wider mb-2">總結 Summary</h3>
                 <p className="text-slate-700 leading-relaxed text-lg">{aiAnalysis.summary}</p>
              </div>
              <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-100 flex flex-col items-center justify-center relative overflow-hidden">
                 <div className="absolute inset-0 bg-gradient-to-br from-emerald-50 to-transparent opacity-50"></div>
                 <span className="text-sm font-bold text-slate-500 uppercase z-10">財務健康分</span>
                 <span className={`text-6xl font-black z-10 my-2 ${aiAnalysis.healthScore >= 70 ? 'text-emerald-600' : aiAnalysis.healthScore >= 50 ? 'text-amber-500' : 'text-rose-600'}`}>
                    {aiAnalysis.healthScore}
                 </span>
                 <span className="text-xs text-slate-400 font-medium z-10">/ 100</span>
              </div>
           </div>

           {/* Immediate Actions */}
           <div className="bg-white p-6 rounded-xl shadow-sm border border-rose-100 bg-rose-50/30">
              <h3 className="text-lg font-bold text-rose-700 mb-4 flex items-center gap-2">
                 <AlertTriangle size={20}/> 優先執行行動 Immediate Actions
              </h3>
              <ul className="space-y-3">
                 {aiAnalysis.immediateActions?.map((action: string, idx: number) => (
                    <li key={idx} className="flex items-start gap-3 bg-white p-3 rounded-lg border border-rose-100 shadow-sm">
                       <div className="mt-0.5 min-w-[20px] h-5 rounded-full bg-rose-100 text-rose-600 flex items-center justify-center text-xs font-bold">{idx + 1}</div>
                       <span className="text-slate-700 font-medium">{action}</span>
                    </li>
                 ))}
              </ul>
           </div>

           {/* Strategic Advice */}
           <div className="bg-white p-8 rounded-xl shadow-sm border border-slate-100">
              <h3 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2">
                 <CheckCircle size={20} className="text-emerald-500"/> 投資與償債策略 Strategic Advice
              </h3>
              <div className="prose prose-slate max-w-none text-slate-600">
                 {aiAnalysis.strategicAdvice.split('\n').map((line: string, i: number) => (
                    <p key={i} className="mb-2">{line}</p>
                 ))}
              </div>
           </div>
        </div>
      )}
    </div>
  );

  // Reusable List Renderer
  const renderList = (title: string, items: any[], type: 'asset' | 'liability' | 'income' | 'expense', color: string) => {
    const categoryMap: Record<string, keyof FinancialState> = {
        'asset': 'assets',
        'liability': 'liabilities',
        'income': 'incomes',
        'expense': 'expenses'
    };
    
    return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden pb-10">
        <div className="p-6 border-b border-slate-100 flex justify-between items-center">
            <h2 className="text-xl font-bold text-slate-800">{title}</h2>
            <button onClick={() => handleOpenModal(type)} className={`bg-${color}-600 text-white px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2 hover:bg-${color}-700`}>
                <Plus size={16} /> 新增
            </button>
        </div>
        <div className="overflow-x-auto">
            <table className="w-full text-left">
                <thead className="bg-slate-50 text-slate-600 text-sm">
                    <tr>
                        <th className="p-4">名稱</th>
                        <th className="p-4">金額</th>
                        <th className="p-4 text-center">操作</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                    {items.map(item => (
                        <tr key={item.id} className="hover:bg-slate-50">
                            <td className="p-4 font-medium">{item.name} <div className="text-xs text-slate-400 font-normal">{item.type}</div></td>
                            <td className={`p-4 font-bold text-${color}-600`}>${(item.value || item.amount).toLocaleString()}</td>
                            <td className="p-4 flex justify-center gap-2">
                                <button onClick={() => handleOpenModal(type, item)} className="p-2 text-slate-400 hover:text-indigo-500"><Pencil size={18}/></button>
                                <button onClick={() => handleDelete(categoryMap[type], item.id)} className="p-2 text-slate-400 hover:text-rose-500"><Trash2 size={18}/></button>
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    </div>
    );
  };

  const renderScenarioMode = () => {
    // 1. Calculate Differences (What was Sold/Paid)
    // Assets present in Original but NOT in Scenario -> Sold
    const soldAssets = editingScenario ? editingScenario.originalData.assets.filter(orig => !editingScenario.data.assets.find(curr => curr.id === orig.id)) : [];
    
    // Liabilities present in Original but NOT in Scenario -> Paid Off
    const paidLiabilities = editingScenario ? editingScenario.originalData.liabilities.filter(orig => !editingScenario.data.liabilities.find(curr => curr.id === orig.id)) : [];

    // Expenses cut (Expenses in Original but not Scenario)
    const cutExpenses = editingScenario ? editingScenario.originalData.expenses.filter(orig => !editingScenario.data.expenses.find(curr => curr.id === orig.id)) : [];

    // 2. Calculate Transaction Totals (Liquidity)
    const cashGenerated = soldAssets.reduce((sum, a) => sum + a.value, 0);
    const cashRequired = paidLiabilities.reduce((sum, l) => sum + l.amount, 0);
    const remainingCash = cashGenerated - cashRequired;

    // 3. Calculate Cash Flow Impact (DEDUPLICATED)
    
    // Total saved from directly cutting expenses
    const expensesSaved = cutExpenses.reduce((sum, e) => sum + e.amount, 0);

    // Calculate Liability Savings (Only add if NOT covered by a cut expense to avoid double counting)
    let liabilityMonthlySaved = 0;
    const normalize = (s: string) => s.replace(/[\s\-_支出費用]/g, '').toLowerCase();

    paidLiabilities.forEach(l => {
        const lName = normalize(l.name);
        // Check if this liability has a matching expense that is ALSO cut
        const hasMatchingCutExpense = cutExpenses.some(e => {
            const eName = normalize(e.name);
            return eName.includes(lName) || lName.includes(eName);
        });

        // Only count the Liability's monthlyPayment if we haven't already counted it via an Expense
        if (!hasMatchingCutExpense) {
            liabilityMonthlySaved += l.monthlyPayment;
        }
    });

    const monthlyPaymentSavedTotal = expensesSaved + liabilityMonthlySaved;

    // Lost monthly income from sold assets (Estimate based on return rate)
    const monthlyIncomeLost = soldAssets.reduce((sum, a) => sum + (a.value * (a.returnRate || 0) / 100 / 12), 0);
    
    const netCashFlowChange = monthlyPaymentSavedTotal - monthlyIncomeLost;
    const projectedMonthlyCashFlow = currentMetrics.monthlyCashFlow + netCashFlowChange;

    const renderInteractiveList = (title: string, items: any[], category: keyof FinancialState, icon: React.ElementType, isNegative: boolean) => (
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden flex flex-col h-full shadow-sm">
        <div className={`px-4 py-4 border-b border-slate-100 flex items-center justify-between ${isNegative ? 'bg-rose-50' : 'bg-emerald-50'}`}>
           <div className="flex items-center gap-2">
             {React.createElement(icon, { size: 18, className: isNegative ? "text-rose-600" : "text-emerald-600" })}
             <span className={`font-bold ${isNegative ? "text-rose-800" : "text-emerald-800"}`}>{title}</span>
           </div>
           <span className="text-xs font-medium text-slate-500 bg-white px-2 py-1 rounded-full border border-slate-200">
             {editingScenario?.data[category].length} / {editingScenario?.originalData[category].length} 保留
           </span>
        </div>
        <div className="p-2 space-y-2 flex-1 overflow-y-auto">
          {editingScenario?.originalData[category].map((item: any) => {
             const isKept = (editingScenario.data[category] as any[]).find(x => x.id === item.id);
             return (
               <div 
                 key={item.id} 
                 onClick={() => toggleScenarioItem(category, item)}
                 className={`group flex items-center gap-3 p-3 rounded-lg cursor-pointer border transition-all duration-200 ${
                   isKept 
                     ? 'bg-white border-slate-200 hover:border-indigo-300 shadow-sm' 
                     : 'bg-slate-50 border-slate-100 opacity-60 grayscale'
                 }`}
               >
                 <div className={`w-5 h-5 rounded-full border flex items-center justify-center transition ${isKept ? 'bg-indigo-600 border-indigo-600' : 'bg-white border-slate-300'}`}>
                    {isKept && <CheckCircle size={12} className="text-white" />}
                 </div>
                 
                 <div className="flex-1 min-w-0">
                   <div className={`text-sm font-medium truncate ${isKept ? 'text-slate-800' : 'text-slate-500 line-through'}`}>{item.name}</div>
                   <div className="flex justify-between items-center mt-1">
                      <span className="text-xs text-slate-500">
                        {category === 'assets' && `價值: $${item.value.toLocaleString()}`}
                        {category === 'liabilities' && `餘額: $${item.amount.toLocaleString()}`}
                        {(category === 'incomes' || category === 'expenses') && `$${item.amount.toLocaleString()}`}
                      </span>
                      {/* Impact Badge */}
                      {!isKept && (
                        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-slate-200 text-slate-600">
                           {category === 'assets' && '已變現 Sold'}
                           {category === 'liabilities' && '已償還 Paid'}
                           {category === 'expenses' && '已削減 Cut'}
                        </span>
                      )}
                   </div>
                 </div>
               </div>
             )
          })}
        </div>
      </div>
    );

    return (
      <div className="flex flex-col h-full bg-slate-50 -m-8 p-8 overflow-y-auto">
        {/* Header & Controls */}
        <div className="flex justify-between items-center mb-6">
            <div>
               <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
                 <Calculator className="text-indigo-600"/> 情境模擬與重組
               </h1>
               <p className="text-sm text-slate-500">勾選以保留項目，取消勾選以模擬「變現」或「償債」。</p>
            </div>
            
            <div className="flex gap-3">
               {!editingScenario ? (
                  <div className="flex gap-2">
                    {scenarios.map(s => (
                       <button key={s.id} onClick={() => loadScenario(s)} className="px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm hover:border-indigo-500 transition">
                          {s.name}
                       </button>
                    ))}
                    <button onClick={startNewScenario} className="px-4 py-2 bg-indigo-600 text-white rounded-lg font-bold shadow-sm hover:bg-indigo-700 flex items-center gap-2">
                       <Plus size={16}/> 新增模擬
                    </button>
                  </div>
               ) : (
                  <>
                    <input 
                      value={editingScenario.name}
                      onChange={(e) => setEditingScenario({...editingScenario, name: e.target.value})}
                      className="bg-transparent border-b border-slate-300 focus:border-indigo-500 outline-none px-2 font-bold text-slate-700 w-48"
                    />
                    <button onClick={saveScenario} disabled={generatingSummary} className="px-4 py-2 bg-emerald-600 text-white rounded-lg font-bold shadow hover:bg-emerald-700 flex items-center gap-2">
                       {generatingSummary ? <Loader2 className="animate-spin" size={16}/> : <Save size={16}/>} 儲存結果
                    </button>
                    <button onClick={() => setEditingScenario(null)} className="px-4 py-2 bg-white border border-slate-300 text-slate-600 rounded-lg font-medium hover:bg-slate-50">
                       退出
                    </button>
                  </>
               )}
            </div>
        </div>

        {!editingScenario ? (
           <div className="flex-1 flex flex-col items-center justify-center text-slate-400 border-2 border-dashed border-slate-200 rounded-3xl bg-slate-50/50">
               <PlayCircle size={64} className="opacity-20 mb-4" />
               <p className="text-lg font-medium">請選擇或建立一個情境以開始戰略模擬</p>
           </div>
        ) : (
           <div className="flex flex-col gap-6">
              {/* 1. Impact Dashboard (Top) */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                 {/* Liquidity Analysis */}
                 <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-100 flex flex-col justify-between relative overflow-hidden">
                    <div className="absolute top-0 right-0 p-4 opacity-10"><Wallet size={64} className="text-indigo-500"/></div>
                    <h3 className="text-slate-500 text-sm font-bold uppercase tracking-wider mb-4">償債能力分析 Liquidity</h3>
                    <div className="space-y-3 relative z-10">
                       <div className="flex justify-between items-center text-sm">
                          <span className="text-slate-600">資產變現 (Cash Unlocked)</span>
                          <span className="font-bold text-emerald-600">+{cashGenerated.toLocaleString()}</span>
                       </div>
                       <div className="flex justify-between items-center text-sm">
                          <span className="text-slate-600">償還債務 (Payoff Cost)</span>
                          <span className="font-bold text-rose-600">-{cashRequired.toLocaleString()}</span>
                       </div>
                       <div className="pt-3 border-t border-slate-100 flex justify-between items-center">
                          <span className="font-bold text-slate-800">現金盈餘/赤字</span>
                          <span className={`text-xl font-black ${remainingCash >= 0 ? 'text-indigo-600' : 'text-rose-600'}`}>
                             {remainingCash >= 0 ? '+' : ''}{remainingCash.toLocaleString()}
                          </span>
                       </div>
                    </div>
                 </div>

                 {/* Cash Flow Analysis */}
                 <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-100 flex flex-col justify-between relative overflow-hidden">
                    <div className="absolute top-0 right-0 p-4 opacity-10"><PiggyBank size={64} className="text-emerald-500"/></div>
                    <h3 className="text-slate-500 text-sm font-bold uppercase tracking-wider mb-4">每月現金流變化 Impact</h3>
                    <div className="space-y-3 relative z-10">
                       <div className="flex justify-between items-center text-sm">
                          <span className="text-slate-600">減少月付金 / 支出 (Saved)</span>
                          <span className="font-bold text-emerald-600">+{monthlyPaymentSavedTotal.toLocaleString()}</span>
                       </div>
                       <div className="flex justify-between items-center text-sm">
                          <span className="text-slate-600">損失資產收益 (Lost Income)</span>
                          <span className="font-bold text-rose-600">-{Math.round(monthlyIncomeLost).toLocaleString()}</span>
                       </div>
                       <div className="pt-3 border-t border-slate-100 flex justify-between items-center">
                          <span className="font-bold text-slate-800">每月淨改善</span>
                          <span className={`text-xl font-black ${netCashFlowChange >= 0 ? 'text-emerald-500' : 'text-rose-500'}`}>
                             {netCashFlowChange >= 0 ? '+' : ''}{Math.round(netCashFlowChange).toLocaleString()}
                          </span>
                       </div>
                    </div>
                 </div>

                 {/* Final Status */}
                 <div className={`rounded-2xl p-5 shadow-sm border flex flex-col justify-center items-center text-center relative overflow-hidden ${projectedMonthlyCashFlow >= 0 ? 'bg-emerald-600 border-emerald-500' : 'bg-rose-600 border-rose-500'}`}>
                    <div className="text-white/80 text-sm font-bold uppercase tracking-wider mb-2">模擬後每月現金流</div>
                    <div className="text-4xl font-black text-white tracking-tight">
                       ${projectedMonthlyCashFlow.toLocaleString()}
                    </div>
                    <div className="mt-4 text-white/90 text-sm bg-black/20 px-4 py-1.5 rounded-full backdrop-blur-sm">
                       {projectedMonthlyCashFlow >= 0 ? '現金流轉正：生活無虞' : '現金流赤字：需更多調整'}
                    </div>
                 </div>
              </div>

              {/* 2. Interactive Columns (Bottom) */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 flex-1 min-h-[500px]">
                  {/* Assets */}
                  {renderInteractiveList('資產保留 (變現)', editingScenario.data.assets, 'assets', DollarSign, false)}
                  {/* Liabilities */}
                  {renderInteractiveList('債務保留 (償還)', editingScenario.data.liabilities, 'liabilities', TrendingDown, true)}
                  {/* Expenses (Optional but good for full picture) */}
                  {renderInteractiveList('支出保留 (削減)', editingScenario.data.expenses, 'expenses', TrendingDown, true)}
                  {/* Income (Usually fixed, but can simulate job loss) */}
                  {renderInteractiveList('收入來源', editingScenario.data.incomes, 'incomes', TrendingUp, false)}
              </div>
           </div>
        )}
      </div>
    );
  };

  const renderModal = () => {
    if (!isModalOpen || !modalConfig) return null;

    return (
      <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-xl shadow-2xl w-full max-w-md overflow-hidden animate-fade-in-up max-h-[90vh] overflow-y-auto">
          <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-slate-50 sticky top-0 z-10">
            <h3 className="font-bold text-slate-800">{modalConfig.title}</h3>
            <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-slate-600">
              <X size={20} />
            </button>
          </div>
          <div className="p-6 space-y-4">
            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-500 uppercase">名稱 Name</label>
              <input 
                type="text" 
                value={formData.name || ''} 
                onChange={e => setFormData({...formData, name: e.target.value})}
                className="w-full p-3 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
                placeholder="輸入項目名稱"
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-500 uppercase">
                {modalConfig.type === 'asset' ? '價值 Value' : '金額 Amount'}
              </label>
              <input 
                type="number" 
                value={modalConfig.type === 'asset' ? (formData.value || '') : (formData.amount || '')} 
                onChange={e => setFormData({...formData, [modalConfig.type === 'asset' ? 'value' : 'amount']: e.target.value})}
                className="w-full p-3 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
                placeholder="0"
              />
            </div>

            {(modalConfig.type === 'asset' || modalConfig.type === 'liability') && (
               <div className="space-y-1">
                 <label className="text-xs font-bold text-slate-500 uppercase">類別 Type</label>
                 <select 
                   value={formData.type || ''}
                   onChange={e => setFormData({...formData, type: e.target.value})}
                   className="w-full p-3 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none bg-white"
                 >
                   {modalConfig.type === 'asset' 
                     ? Object.values(AssetType).map(t => <option key={t} value={t}>{t}</option>) 
                     : Object.values(LiabilityType).map(t => <option key={t} value={t}>{t}</option>)}
                 </select>
               </div>
            )}

            {modalConfig.type === 'asset' && (
              <>
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-500 uppercase">流動性 Liquidity</label>
                  <select 
                    value={formData.liquidity || 'High'}
                    onChange={e => setFormData({...formData, liquidity: e.target.value})}
                    className="w-full p-3 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none bg-white"
                  >
                    <option value="High">High (高)</option>
                    <option value="Medium">Medium (中)</option>
                    <option value="Low">Low (低)</option>
                  </select>
                </div>
                 <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-500 uppercase">預期年報酬率 Return Rate (%)</label>
                  <input 
                    type="number" 
                    value={formData.returnRate || 0} 
                    onChange={e => setFormData({...formData, returnRate: e.target.value})}
                    className="w-full p-3 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
                  />
                </div>
              </>
            )}

            {modalConfig.type === 'liability' && (
              <>
                 <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-500 uppercase">年利率 Interest Rate (%)</label>
                  <input 
                    type="number" 
                    value={formData.interestRate || 0} 
                    onChange={e => setFormData({...formData, interestRate: e.target.value})}
                    className="w-full p-3 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
                  />
                </div>
                 <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-500 uppercase">每月付款 Monthly Payment</label>
                  <input 
                    type="number" 
                    value={formData.monthlyPayment || 0} 
                    onChange={e => setFormData({...formData, monthlyPayment: e.target.value})}
                    className="w-full p-3 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
                  />
                </div>
              </>
            )}

          </div>
          <div className="p-4 border-t border-slate-100 bg-slate-50 flex gap-3">
             <button onClick={() => setIsModalOpen(false)} className="flex-1 py-3 text-slate-600 font-bold hover:bg-slate-200 rounded-lg transition">取消</button>
             <button onClick={handleSaveItem} className="flex-1 py-3 bg-indigo-600 text-white font-bold hover:bg-indigo-700 rounded-lg shadow-md transition">儲存</button>
          </div>
        </div>
      </div>
    );
  };

  if (isAuthChecking) return <div className="min-h-screen flex items-center justify-center bg-slate-50"><Loader2 className="w-10 h-10 text-rose-500 animate-spin" /></div>;
  if (!user) return <LoginPage onLogin={handleLogin} onGuestLogin={handleGuestLogin} loading={loginLoading} />;

  return (
    <div className="min-h-screen bg-slate-50 flex">
      {/* Sidebar */}
      <aside className="w-64 bg-white border-r border-slate-200 fixed h-full hidden lg:flex flex-col z-10">
        <div className="p-6">
          <div className="flex items-center gap-3 text-indigo-600 mb-8">
            <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center">
              <DollarSign className="text-white w-5 h-5" />
            </div>
            <span className="font-bold text-xl tracking-tight">WealthFlow</span>
          </div>
          <nav className="space-y-1">
            {[
              { id: 'dashboard', icon: Activity, label: '總覽 Dashboard' },
              { id: 'assets', icon: DollarSign, label: '資產 Assets' },
              { id: 'liabilities', icon: TrendingDown, label: '負債 Liabilities' },
              { id: 'cashflow', icon: TrendingUp, label: '現金流 Cash Flow' },
              { id: 'import', icon: ScanLine, label: '智能匯入 Import' },
              { id: 'scenario', icon: Calculator, label: '情境模擬 Scenario' },
              { id: 'advisor', icon: BrainCircuit, label: 'AI 顧問 Advisor' },
            ].map(item => (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id as any)}
                className={`w-full flex items-center gap-3 px-4 py-3 text-sm font-medium rounded-lg transition ${
                  activeTab === item.id ? 'bg-indigo-50 text-indigo-700' : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                }`}
              >
                <item.icon size={18} />
                {item.label}
              </button>
            ))}
          </nav>
        </div>
        <div className="mt-auto border-t border-slate-100 p-4">
           {user && (
             <div className="bg-slate-50 rounded-lg p-3 border border-slate-200">
                <div className="flex items-center gap-3 mb-2">
                   {user.photoURL ? <img src={user.photoURL} className="w-8 h-8 rounded-full" /> : <div className="w-8 h-8 bg-indigo-100 rounded-full flex items-center justify-center text-indigo-600 font-bold">{user.displayName?.[0] || <UserIcon size={14}/>}</div>}
                   <div className="flex-1 min-w-0">
                     <div className="text-sm font-bold text-slate-800 truncate">{user.displayName} {isGuest && '(Guest)'}</div>
                     <div className="text-xs text-slate-500">{syncStatus === 'synced' ? '已同步' : '儲存中...'}</div>
                   </div>
                </div>
                <button onClick={handleLogout} className="w-full text-xs bg-white border border-slate-200 py-1.5 rounded-md hover:text-rose-600 flex justify-center gap-1"><LogOut size={12}/> 登出</button>
             </div>
           )}
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 lg:ml-64 p-8">
        <div className="max-w-7xl mx-auto h-full">
          {activeTab !== 'scenario' && (
             <div className="lg:hidden mb-6 flex justify-between items-center">
                 <span className="font-bold text-xl text-indigo-900">WealthFlow</span>
                 <button onClick={() => setActiveTab('dashboard')} className="text-xs bg-white border p-2 rounded">Menu</button>
             </div>
          )}

          {activeTab === 'scenario' ? renderScenarioMode() : (
            <div className="animate-fade-in">
                {/* Simplified Headers for other tabs */}
                <header className="mb-8 flex justify-between items-center">
                  <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-3">
                    {activeTab === 'dashboard' && '財務總覽 Dashboard'}
                    {activeTab === 'assets' && '資產管理 Assets'}
                    {activeTab === 'liabilities' && '負債管理 Liabilities'}
                    {activeTab === 'cashflow' && '收支管理 Cash Flow'}
                    {activeTab === 'advisor' && 'AI 智能顧問'}
                    {activeTab === 'import' && '智能匯入 Smart Import'}
                  </h1>
                </header>
                {activeTab === 'dashboard' && renderDashboard()}
                {activeTab === 'assets' && renderList('資產清單 Assets', financials.assets, 'asset', 'emerald')}
                {activeTab === 'liabilities' && renderList('負債清單 Liabilities', financials.liabilities, 'liability', 'rose')}
                {activeTab === 'cashflow' && (
                   <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                      {renderList('收入 Income', financials.incomes, 'income', 'emerald').props.children}
                      {renderList('支出 Expenses', financials.expenses, 'expense', 'rose').props.children}
                   </div>
                )}
                {activeTab === 'import' && renderDashboard()} {/* Placeholder, reusing import logic in full file */}
                {activeTab === 'advisor' && renderAdvisor()}
            </div>
          )}
        </div>
      </main>
      
      {renderModal()}
    </div>
  );
}