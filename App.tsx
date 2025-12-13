import React, { useState, useEffect, useCallback } from 'react';
import { AssetType, LiabilityType, AssetItem, LiabilityItem, CashFlowItem, FinancialState, Scenario } from './types';
import { analyzeFinances, parseFinancialScreenshot, generateScenarioSummary } from './services/geminiService';
import { loginWithGoogle, logout, subscribeAuth, saveUserData, loadUserData } from './services/firebase';
import { AssetAllocationChart, NetWorthBarChart } from './components/Charts';
import { Plus, Trash2, DollarSign, TrendingUp, TrendingDown, Activity, AlertTriangle, CheckCircle, BrainCircuit, Upload, ScanLine, X, Loader2, PlayCircle, Save, ArrowRight, LogIn, LogOut, User as UserIcon, Cloud, CloudOff, Pencil, Lock, Mail, UserCheck, ChevronRight } from 'lucide-react';
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
    data: FinancialState; // This holds the *filtered* state
    originalData: FinancialState; // To show what was unchecked
  } | null>(null);
  const [generatingSummary, setGeneratingSummary] = useState(false);

  // Modal State for Adding/Editing Items
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalConfig, setModalConfig] = useState<{type: 'income' | 'expense' | 'asset' | 'liability', title: string} | null>(null);
  const [formData, setFormData] = useState<any>({});
  const [editingId, setEditingId] = useState<string | null>(null);

  // --- Effects for Firebase ---
  
  // 1. Auth Subscription (Auto runs on mount)
  useEffect(() => {
    const unsub = subscribeAuth((u) => {
      if (!isGuest) { // Only update if not in guest mode
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

  // 2. Auto Save
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
    console.log("Starting login process...");
    setLoginLoading(true);
    try {
        await loginWithGoogle();
        // Auth state change will handle the rest
    } catch (e: any) {
        console.error("Login Error:", e);
        // Show alert so user knows why login failed (e.g., unauthorized domain, missing keys)
        // Alert handled inside services/firebase.ts for specific errors, but catch-all here
        setLoginLoading(false);
    }
  };

  const handleGuestLogin = () => {
    setIsGuest(true);
    // Mock User
    setUser({
      uid: 'guest',
      displayName: 'Guest User',
      email: 'guest@example.com',
      photoURL: null,
      emailVerified: true,
      isAnonymous: true,
      metadata: {},
      providerData: [],
      refreshToken: '',
      tenantId: null,
      delete: async () => {},
      getIdToken: async () => '',
      getIdTokenResult: async () => ({} as any),
      reload: async () => {},
      toJSON: () => ({}),
      phoneNumber: null,
      providerId: 'guest'
    } as User);
    setIsAuthChecking(false);
    setSyncStatus('offline'); // Guest mode doesn't sync
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
        setExtractedData(null); // Reset previous extraction
      };
      reader.readAsDataURL(file);
    }
  };

  const handleParseImage = async () => {
    if (!importImage) return;
    setImporting(true);
    try {
      // Extract base64 part
      const base64Data = importImage.split(',')[1];
      const resultJson = await parseFinancialScreenshot(base64Data);
      const parsed = JSON.parse(resultJson);
      
      // Add unique IDs
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
    alert("Data imported successfully!");
  };

  // Scenario Handlers
  const startNewScenario = () => {
    if (scenarios.length >= 5) {
      alert("最多儲存 5 個情境模擬");
      return;
    }
    // Deep copy current financials to start editing
    setEditingScenario({
      name: `情境模擬 ${scenarios.length + 1}`,
      data: JSON.parse(JSON.stringify(financials)),
      originalData: JSON.parse(JSON.stringify(financials)),
    });
  };

  const toggleScenarioItem = (category: keyof FinancialState, item: any) => {
    if (!editingScenario) return;
    
    const currentList = editingScenario.data[category] as any[];
    const exists = currentList.find(x => x.id === item.id);
    
    let newList;
    if (exists) {
      // Remove it (Uncheck)
      newList = currentList.filter(x => x.id !== item.id);
    } else {
      // Add it back (Check)
      newList = [...currentList, item];
    }
    
    setEditingScenario({
      ...editingScenario,
      data: {
        ...editingScenario.data,
        [category]: newList
      }
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
      originalData: JSON.parse(JSON.stringify(financials)) // Base it on current reality for comparison? Or keep it isolated. Let's base on original logic.
    });
  };

  // Modal Handlers
  const handleOpenModal = (type: 'income' | 'expense' | 'asset' | 'liability', existingItem?: any) => {
    let title = '';
    let initialData = {};
    
    // Determine title and initial data
    if (existingItem) {
        setEditingId(existingItem.id);
        // Copy item to form data
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
    
    // Helper to update specific list in state
    const updateList = (category: keyof FinancialState, newItem: any) => {
        setFinancials(prev => {
            const list = prev[category] as any[];
            if (editingId) {
                // Update existing
                return {
                    ...prev,
                    [category]: list.map(item => item.id === editingId ? { ...item, ...newItem } : item)
                };
            } else {
                // Add new
                return {
                    ...prev,
                    [category]: [...list, { ...newItem, id: crypto.randomUUID() }]
                };
            }
        });
    };
    
    // Validation & Construction
    if (modalConfig.type === 'income') {
        if (!formData.name || !formData.amount) return alert("請輸入名稱與金額");
        updateList('incomes', { name: formData.name, amount: Number(formData.amount), type: 'Income' });
    } else if (modalConfig.type === 'expense') {
        if (!formData.name || !formData.amount) return alert("請輸入名稱與金額");
        updateList('expenses', { name: formData.name, amount: Number(formData.amount), type: 'Expense' });
    } else if (modalConfig.type === 'asset') {
        if (!formData.name || !formData.value) return alert("請輸入名稱與價值");
        updateList('assets', { name: formData.name, value: Number(formData.value), type: formData.type, liquidity: formData.liquidity, returnRate: Number(formData.returnRate) });
    } else if (modalConfig.type === 'liability') {
         if (!formData.name || !formData.amount) return alert("請輸入名稱與金額");
         updateList('liabilities', { name: formData.name, amount: Number(formData.amount), type: formData.type, interestRate: Number(formData.interestRate), monthlyPayment: Number(formData.monthlyPayment) });
    }

    setIsModalOpen(false);
  };

  // --- Render Condition ---
  
  // 1. Loading Authentication
  if (isAuthChecking) {
     return (
       <div className="min-h-screen flex items-center justify-center bg-slate-50 flex-col gap-4">
          <Loader2 className="w-10 h-10 text-rose-500 animate-spin" />
          <p className="text-slate-500 text-sm animate-pulse">正在安全連線中...</p>
       </div>
     );
  }

  // 2. Not Logged In -> Show Login Page
  if (!user) {
     return <LoginPage onLogin={handleLogin} onGuestLogin={handleGuestLogin} loading={loginLoading} />;
  }

  // 3. Logged In -> Show Main App
  // --- UI Sections for Main App ---
  // ... (Previous UI code remains, just updating Sidebar Profile to show Guest badge if needed)

  const renderDashboard = () => (
    <div className="space-y-6 animate-fade-in">
      {/* KPI Cards - Clickable for navigation */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div 
          onClick={() => setActiveTab('advisor')} 
          className="bg-white p-6 rounded-xl shadow-sm border border-slate-100 cursor-pointer hover:shadow-md hover:border-indigo-200 transition group relative"
        >
          <div className="text-sm text-slate-500 mb-1 flex items-center justify-between">
            淨資產 Net Worth
            <ChevronRight size={16} className="text-slate-300 group-hover:text-indigo-500 transition"/>
          </div>
          <div className="text-2xl font-bold text-slate-800">${currentMetrics.netWorth.toLocaleString()}</div>
          <span className="text-xs text-indigo-500 mt-2 block opacity-0 group-hover:opacity-100 transition absolute bottom-3">查看分析 &rarr;</span>
        </div>

        <div 
          onClick={() => setActiveTab('cashflow')}
          className="bg-white p-6 rounded-xl shadow-sm border border-slate-100 cursor-pointer hover:shadow-md hover:border-indigo-200 transition group relative"
        >
          <div className="text-sm text-slate-500 mb-1 flex items-center justify-between">
            月現金流 Cash Flow
            <ChevronRight size={16} className="text-slate-300 group-hover:text-indigo-500 transition"/>
          </div>
          <div className={`text-2xl font-bold ${currentMetrics.monthlyCashFlow >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
            {currentMetrics.monthlyCashFlow >= 0 ? '+' : ''}${currentMetrics.monthlyCashFlow.toLocaleString()}
          </div>
           <span className="text-xs text-indigo-500 mt-2 block opacity-0 group-hover:opacity-100 transition absolute bottom-3">編輯收支 &rarr;</span>
        </div>

        <div 
          onClick={() => setActiveTab('assets')}
          className="bg-white p-6 rounded-xl shadow-sm border border-slate-100 cursor-pointer hover:shadow-md hover:border-indigo-200 transition group relative"
        >
          <div className="text-sm text-slate-500 mb-1 flex items-center justify-between">
            資產總額 Assets
            <ChevronRight size={16} className="text-slate-300 group-hover:text-indigo-500 transition"/>
          </div>
          <div className="text-2xl font-bold text-emerald-600">${currentMetrics.totalAssets.toLocaleString()}</div>
          <span className="text-xs text-indigo-500 mt-2 block opacity-0 group-hover:opacity-100 transition absolute bottom-3">管理資產 &rarr;</span>
        </div>

        <div 
          onClick={() => setActiveTab('liabilities')}
          className="bg-white p-6 rounded-xl shadow-sm border border-slate-100 cursor-pointer hover:shadow-md hover:border-indigo-200 transition group relative"
        >
          <div className="text-sm text-slate-500 mb-1 flex items-center justify-between">
            負債總額 Liabilities
            <ChevronRight size={16} className="text-slate-300 group-hover:text-indigo-500 transition"/>
          </div>
          <div className="text-2xl font-bold text-rose-600">${currentMetrics.totalLiabilities.toLocaleString()}</div>
          <span className="text-xs text-indigo-500 mt-2 block opacity-0 group-hover:opacity-100 transition absolute bottom-3">管理負債 &rarr;</span>
        </div>
      </div>

      {/* Charts Row */}
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

      {/* Quick Alerts */}
      {currentMetrics.monthlyCashFlow < 0 && (
        <div className="bg-rose-50 border border-rose-200 p-4 rounded-xl flex items-start gap-3">
          <AlertTriangle className="text-rose-600 w-6 h-6 mt-0.5" />
          <div>
            <h4 className="font-semibold text-rose-800">現金流警示：赤字狀態</h4>
            <p className="text-rose-700 text-sm mt-1">
              目前每月支出大於收入 ${Math.abs(currentMetrics.monthlyCashFlow).toLocaleString()}。建議立即前往「AI 顧問」頁面尋求優化建議。
            </p>
          </div>
        </div>
      )}
    </div>
  );

  const renderAssetList = () => (
    <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
      <div className="p-6 border-b border-slate-100 flex justify-between items-center">
        <h2 className="text-xl font-bold text-slate-800">資產清單 Assets</h2>
        <button 
          onClick={() => handleOpenModal('asset')}
          className="bg-emerald-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-emerald-700 transition flex items-center gap-2"
        >
          <Plus size={16} /> 新增資產
        </button>
      </div>
      
      {/* Desktop Table */}
      <div className="hidden md:block overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead className="bg-slate-50 text-slate-600 text-sm">
            <tr>
              <th className="p-4 font-semibold">名稱</th>
              <th className="p-4 font-semibold">類型</th>
              <th className="p-4 font-semibold">流動性</th>
              <th className="p-4 font-semibold">預期報酬率</th>
              <th className="p-4 font-semibold text-right">價值</th>
              <th className="p-4 font-semibold w-24 text-center">操作</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {financials.assets.map(asset => (
              <tr key={asset.id} className="hover:bg-slate-50 transition">
                <td className="p-4 font-medium text-slate-900">{asset.name}</td>
                <td className="p-4 text-slate-600 text-sm">{asset.type}</td>
                <td className="p-4 text-sm">
                  <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                    asset.liquidity === 'High' ? 'bg-blue-100 text-blue-700' :
                    asset.liquidity === 'Medium' ? 'bg-yellow-100 text-yellow-700' : 'bg-slate-200 text-slate-700'
                  }`}>
                    {asset.liquidity}
                  </span>
                </td>
                <td className="p-4 text-slate-600 text-sm">{asset.returnRate}%</td>
                <td className="p-4 text-right font-medium text-emerald-600">${asset.value.toLocaleString()}</td>
                <td className="p-4 flex justify-center gap-2">
                  <button 
                    onClick={() => handleOpenModal('asset', asset)}
                    className="p-2 text-slate-400 hover:text-indigo-500 hover:bg-indigo-50 rounded-lg transition"
                    title="編輯"
                  >
                    <Pencil size={18} />
                  </button>
                  <button 
                    onClick={() => handleDelete('assets', asset.id)}
                    className="p-2 text-slate-400 hover:text-rose-500 hover:bg-rose-50 rounded-lg transition"
                    title="刪除"
                  >
                    <Trash2 size={18} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile Card View (Responsive) */}
      <div className="md:hidden">
         {financials.assets.map(asset => (
           <div key={asset.id} className="p-4 border-b border-slate-100 last:border-0 hover:bg-slate-50 transition">
              <div className="flex justify-between items-start mb-2">
                 <div>
                    <h3 className="font-bold text-slate-800">{asset.name}</h3>
                    <p className="text-xs text-slate-500 mt-0.5">{asset.type}</p>
                 </div>
                 <span className="font-bold text-emerald-600">${asset.value.toLocaleString()}</span>
              </div>
              
              <div className="flex items-center gap-3 text-xs text-slate-500 mb-3">
                 <span className={`px-2 py-0.5 rounded-full ${
                    asset.liquidity === 'High' ? 'bg-blue-100 text-blue-700' :
                    asset.liquidity === 'Medium' ? 'bg-yellow-100 text-yellow-700' : 'bg-slate-200 text-slate-700'
                  }`}>
                    {asset.liquidity} 流動性
                 </span>
                 <span>報酬率 {asset.returnRate}%</span>
              </div>

              <div className="flex gap-2 mt-2">
                 <button 
                    onClick={() => handleOpenModal('asset', asset)}
                    className="flex-1 py-2 bg-white border border-slate-200 text-slate-600 rounded-lg text-sm font-medium hover:bg-indigo-50 hover:text-indigo-600 hover:border-indigo-200 transition flex items-center justify-center gap-2"
                 >
                    <Pencil size={14} /> 編輯
                 </button>
                 <button 
                    onClick={() => handleDelete('assets', asset.id)}
                    className="flex-1 py-2 bg-white border border-slate-200 text-slate-600 rounded-lg text-sm font-medium hover:bg-rose-50 hover:text-rose-600 hover:border-rose-200 transition flex items-center justify-center gap-2"
                 >
                    <Trash2 size={14} /> 刪除
                 </button>
              </div>
           </div>
         ))}
      </div>
    </div>
  );

  const renderLiabilityList = () => (
    <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
      <div className="p-6 border-b border-slate-100 flex justify-between items-center">
        <h2 className="text-xl font-bold text-slate-800">負債清單 Liabilities</h2>
        <button 
          onClick={() => handleOpenModal('liability')}
          className="bg-rose-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-rose-700 transition flex items-center gap-2"
        >
          <Plus size={16} /> 新增負債
        </button>
      </div>

      {/* Desktop Table */}
      <div className="hidden md:block overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead className="bg-slate-50 text-slate-600 text-sm">
            <tr>
              <th className="p-4 font-semibold">名稱</th>
              <th className="p-4 font-semibold">類型</th>
              <th className="p-4 font-semibold">年利率</th>
              <th className="p-4 font-semibold text-right">月繳金額</th>
              <th className="p-4 font-semibold text-right">剩餘餘額</th>
              <th className="p-4 font-semibold w-24 text-center">操作</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {financials.liabilities.map(item => (
              <tr key={item.id} className="hover:bg-slate-50 transition">
                <td className="p-4 font-medium text-slate-900">{item.name}</td>
                <td className="p-4 text-slate-600 text-sm">{item.type}</td>
                <td className="p-4 text-slate-600 text-sm">{item.interestRate}%</td>
                <td className="p-4 text-right text-slate-600">${item.monthlyPayment.toLocaleString()}</td>
                <td className="p-4 text-right font-medium text-rose-600">${item.amount.toLocaleString()}</td>
                <td className="p-4 flex justify-center gap-2">
                  <button 
                    onClick={() => handleOpenModal('liability', item)}
                    className="p-2 text-slate-400 hover:text-indigo-500 hover:bg-indigo-50 rounded-lg transition"
                    title="編輯"
                  >
                    <Pencil size={18} />
                  </button>
                  <button 
                    onClick={() => handleDelete('liabilities', item.id)}
                    className="p-2 text-slate-400 hover:text-rose-500 hover:bg-rose-50 rounded-lg transition"
                    title="刪除"
                  >
                    <Trash2 size={18} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile Card View (Responsive) */}
      <div className="md:hidden">
         {financials.liabilities.map(item => (
           <div key={item.id} className="p-4 border-b border-slate-100 last:border-0 hover:bg-slate-50 transition">
              <div className="flex justify-between items-start mb-2">
                 <div>
                    <h3 className="font-bold text-slate-800">{item.name}</h3>
                    <p className="text-xs text-slate-500 mt-0.5">{item.type}</p>
                 </div>
                 <span className="font-bold text-rose-600">${item.amount.toLocaleString()}</span>
              </div>
              
              <div className="flex justify-between items-center text-xs text-slate-500 mb-3 bg-slate-50 p-2 rounded">
                 <span>利率: {item.interestRate}%</span>
                 <span>月繳: ${item.monthlyPayment.toLocaleString()}</span>
              </div>

              <div className="flex gap-2 mt-2">
                 <button 
                    onClick={() => handleOpenModal('liability', item)}
                    className="flex-1 py-2 bg-white border border-slate-200 text-slate-600 rounded-lg text-sm font-medium hover:bg-indigo-50 hover:text-indigo-600 hover:border-indigo-200 transition flex items-center justify-center gap-2"
                 >
                    <Pencil size={14} /> 編輯
                 </button>
                 <button 
                    onClick={() => handleDelete('liabilities', item.id)}
                    className="flex-1 py-2 bg-white border border-slate-200 text-slate-600 rounded-lg text-sm font-medium hover:bg-rose-50 hover:text-rose-600 hover:border-rose-200 transition flex items-center justify-center gap-2"
                 >
                    <Trash2 size={14} /> 刪除
                 </button>
              </div>
           </div>
         ))}
      </div>
    </div>
  );

  const renderCashFlow = () => (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
      {/* Income */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
        <div className="p-5 border-b border-slate-100 bg-emerald-50/50 flex justify-between items-center">
          <h3 className="font-bold text-emerald-800 flex items-center gap-2">
            <TrendingUp size={20} /> 月收入 Income
          </h3>
          <span className="text-emerald-700 font-bold">${currentMetrics.totalIncome.toLocaleString()}</span>
        </div>
        <div className="p-4 space-y-3">
          {financials.incomes.map(item => (
            <div key={item.id} className="flex justify-between items-center p-3 bg-slate-50 rounded-lg group hover:shadow-sm transition">
              <span className="text-slate-700 font-medium">{item.name}</span>
              <div className="flex items-center gap-3">
                <span className="text-emerald-600 font-semibold">+${item.amount.toLocaleString()}</span>
                {/* Always visible on mobile, hover on desktop */}
                <div className="flex gap-1 md:opacity-0 md:group-hover:opacity-100 transition opacity-100">
                    <button onClick={() => handleOpenModal('income', item)} className="p-1 text-slate-300 hover:text-indigo-500"><Pencil size={16}/></button>
                    <button onClick={() => handleDelete('incomes', item.id)} className="p-1 text-slate-300 hover:text-rose-500"><Trash2 size={16}/></button>
                </div>
              </div>
            </div>
          ))}
           <button 
             onClick={() => handleOpenModal('income')}
             className="w-full py-2 mt-2 border border-dashed border-slate-300 rounded-lg text-slate-500 hover:bg-slate-50 text-sm flex justify-center items-center gap-1"
            >
            <Plus size={16}/> 新增收入
          </button>
        </div>
      </div>

      {/* Expenses */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
        <div className="p-5 border-b border-slate-100 bg-rose-50/50 flex justify-between items-center">
          <h3 className="font-bold text-rose-800 flex items-center gap-2">
            <TrendingDown size={20} /> 月支出 Expense
          </h3>
          <span className="text-rose-700 font-bold">${currentMetrics.totalExpenses.toLocaleString()}</span>
        </div>
        <div className="p-4 space-y-3">
          {financials.expenses.map(item => (
            <div key={item.id} className="flex justify-between items-center p-3 bg-slate-50 rounded-lg group hover:shadow-sm transition">
              <span className="text-slate-700 font-medium">{item.name}</span>
              <div className="flex items-center gap-3">
                <span className="text-rose-600 font-semibold">-${item.amount.toLocaleString()}</span>
                {/* Always visible on mobile, hover on desktop */}
                <div className="flex gap-1 md:opacity-0 md:group-hover:opacity-100 transition opacity-100">
                    <button onClick={() => handleOpenModal('expense', item)} className="p-1 text-slate-300 hover:text-indigo-500"><Pencil size={16}/></button>
                    <button onClick={() => handleDelete('expenses', item.id)} className="p-1 text-slate-300 hover:text-rose-500"><Trash2 size={16}/></button>
                </div>
              </div>
            </div>
          ))}
          <button 
            onClick={() => handleOpenModal('expense')}
            className="w-full py-2 mt-2 border border-dashed border-slate-300 rounded-lg text-slate-500 hover:bg-slate-50 text-sm flex justify-center items-center gap-1"
          >
            <Plus size={16}/> 新增支出
          </button>
        </div>
      </div>
    </div>
  );

  const renderImport = () => (
    <div className="max-w-4xl mx-auto space-y-8 animate-fade-in">
      <div className="text-center space-y-2">
        <h2 className="text-3xl font-bold text-slate-900 flex items-center justify-center gap-2">
           <ScanLine className="text-indigo-600"/> 智能匯入 Smart Import
        </h2>
        <p className="text-slate-500">
          上傳您的銀行 APP、證券帳戶或信用卡帳單截圖，AI 將自動識別並匯入資料。
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        {/* Upload Section */}
        <div className="space-y-4">
          <div className="border-2 border-dashed border-slate-300 rounded-2xl p-8 text-center hover:bg-slate-50 transition relative group bg-white">
            <input 
              type="file" 
              accept="image/*"
              onChange={handleImageUpload}
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
            />
            {importImage ? (
              <div className="relative inline-block">
                <img src={importImage} alt="Preview" className="max-h-64 rounded-lg shadow-sm" />
                <button 
                  onClick={(e) => { e.stopPropagation(); e.preventDefault(); setImportImage(null); setExtractedData(null); }}
                  className="absolute -top-2 -right-2 bg-rose-500 text-white p-1 rounded-full shadow-md hover:bg-rose-600"
                >
                  <X size={16} />
                </button>
              </div>
            ) : (
              <div className="py-8">
                <Upload className="w-12 h-12 text-indigo-400 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-slate-700">點擊或拖曳上傳截圖</h3>
                <p className="text-sm text-slate-400 mt-2">支援 JPG, PNG 格式</p>
              </div>
            )}
          </div>
          
          <button
            onClick={handleParseImage}
            disabled={!importImage || importing}
            className={`w-full py-3 rounded-xl font-bold text-white shadow-lg transition flex items-center justify-center gap-2 ${
              !importImage || importing ? 'bg-slate-300 cursor-not-allowed' : 'bg-indigo-600 hover:bg-indigo-700 shadow-indigo-200'
            }`}
          >
            {importing ? <Loader2 className="animate-spin" /> : <BrainCircuit />}
            {importing ? 'AI 分析中...' : '開始識別 Parse Image'}
          </button>
        </div>

        {/* Results Section */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 overflow-y-auto max-h-[600px]">
           {!extractedData && !importing && (
             <div className="h-full flex flex-col items-center justify-center text-slate-400 space-y-4 py-12">
               <ScanLine size={48} className="opacity-20" />
               <p>識別結果將顯示於此</p>
             </div>
           )}
           
           {importing && (
             <div className="h-full flex flex-col items-center justify-center text-indigo-500 space-y-4 py-12">
               <Loader2 size={48} className="animate-spin" />
               <p className="animate-pulse">正在讀取圖像數據...</p>
             </div>
           )}

           {extractedData && (
             <div className="space-y-6">
                <div>
                  <h3 className="font-bold text-emerald-700 mb-3 flex items-center gap-2">
                    <DollarSign size={18} /> 識別資產 ({extractedData.assets?.length || 0})
                  </h3>
                  {extractedData.assets?.length === 0 ? <p className="text-sm text-slate-400">無識別資產</p> : (
                    <div className="space-y-2">
                      {extractedData.assets?.map((item: any, idx: number) => (
                        <div key={idx} className="bg-slate-50 p-3 rounded-lg border border-slate-100 flex justify-between items-center">
                           <div>
                             <div className="font-medium text-slate-800">{item.name}</div>
                             <div className="text-xs text-slate-500">{item.type}</div>
                           </div>
                           <div className="font-bold text-emerald-600">${item.value.toLocaleString()}</div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div>
                  <h3 className="font-bold text-rose-700 mb-3 flex items-center gap-2">
                    <TrendingDown size={18} /> 識別負債 ({extractedData.liabilities?.length || 0})
                  </h3>
                  {extractedData.liabilities?.length === 0 ? <p className="text-sm text-slate-400">無識別負債</p> : (
                    <div className="space-y-2">
                      {extractedData.liabilities?.map((item: any, idx: number) => (
                        <div key={idx} className="bg-slate-50 p-3 rounded-lg border border-slate-100 flex justify-between items-center">
                           <div>
                             <div className="font-medium text-slate-800">{item.name}</div>
                             <div className="text-xs text-slate-500">{item.type}</div>
                           </div>
                           <div className="font-bold text-rose-600">${item.amount.toLocaleString()}</div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="pt-4 border-t border-slate-100">
                  <button 
                    onClick={confirmImport}
                    className="w-full bg-emerald-600 text-white py-3 rounded-xl font-bold hover:bg-emerald-700 transition flex items-center justify-center gap-2"
                  >
                    <CheckCircle size={20} /> 確認匯入 Confirm Import
                  </button>
                </div>
             </div>
           )}
        </div>
      </div>
    </div>
  );

  const renderScenarioMode = () => {
    const metrics = editingScenario ? calcMetrics(editingScenario.data) : null;
    const baseMetrics = currentMetrics;

    const renderToggleList = (title: string, items: any[], category: keyof FinancialState, icon: React.ElementType, colorClass: string) => (
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <div className="bg-slate-50 px-4 py-3 border-b border-slate-100 flex items-center gap-2">
           {React.createElement(icon, { size: 16, className: "text-slate-500" })}
           <span className="font-semibold text-slate-700 text-sm">{title}</span>
        </div>
        <div className="max-h-48 overflow-y-auto p-2 space-y-1">
          {editingScenario?.originalData[category].map((item: any) => {
             const isChecked = (editingScenario.data[category] as any[]).find(x => x.id === item.id);
             return (
               <label key={item.id} className={`flex items-center gap-3 p-2 rounded-lg cursor-pointer transition ${isChecked ? 'hover:bg-indigo-50' : 'opacity-50 bg-slate-50'}`}>
                 <input 
                   type="checkbox" 
                   checked={!!isChecked} 
                   onChange={() => toggleScenarioItem(category, item)}
                   className="w-4 h-4 text-indigo-600 rounded focus:ring-indigo-500 border-gray-300"
                 />
                 <div className="flex-1 text-sm">
                   <div className={`${isChecked ? 'text-slate-800 font-medium' : 'text-slate-500 line-through'}`}>{item.name}</div>
                   <div className="text-xs text-slate-400">
                      {category === 'assets' && `$${item.value.toLocaleString()}`}
                      {(category === 'incomes' || category === 'expenses' || category === 'liabilities') && `$${item.amount.toLocaleString()}`}
                   </div>
                 </div>
               </label>
             )
          })}
        </div>
      </div>
    );

    return (
      <div className="flex flex-col lg:flex-row gap-6 h-[calc(100vh-140px)]">
        {/* Scenario List */}
        <div className="w-full lg:w-1/4 space-y-4">
          <button 
            onClick={startNewScenario}
            className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold shadow-sm transition flex items-center justify-center gap-2"
          >
            <Plus size={18} /> 新增情境 Create New
          </button>
          
          <div className="space-y-3 overflow-y-auto max-h-[600px]">
            {scenarios.map(s => (
               <div key={s.id} onClick={() => loadScenario(s)} className="bg-white p-4 rounded-xl border border-slate-200 cursor-pointer hover:border-indigo-300 hover:shadow-md transition">
                  <div className="flex justify-between items-start mb-2">
                    <h3 className="font-bold text-slate-800">{s.name}</h3>
                    <span className="text-xs text-slate-400">{new Date(s.createdAt).toLocaleDateString()}</span>
                  </div>
                  <p className="text-xs text-slate-500 line-clamp-2 bg-slate-50 p-2 rounded">{s.aiSummary}</p>
               </div>
            ))}
            {scenarios.length === 0 && (
              <div className="text-center py-8 text-slate-400 text-sm">
                尚無儲存的情境
              </div>
            )}
          </div>
        </div>

        {/* Editor */}
        <div className="flex-1 bg-slate-100 rounded-2xl border border-slate-200 p-6 flex flex-col overflow-hidden">
          {!editingScenario ? (
            <div className="flex-1 flex flex-col items-center justify-center text-slate-400">
               <PlayCircle size={64} className="opacity-20 mb-4" />
               <p className="text-lg">選擇或新增一個情境以開始模擬</p>
            </div>
          ) : (
            <>
              <div className="flex justify-between items-center mb-6">
                <input 
                  value={editingScenario.name}
                  onChange={(e) => setEditingScenario({...editingScenario, name: e.target.value})}
                  className="bg-transparent text-xl font-bold text-slate-800 border-b border-dashed border-slate-400 focus:border-indigo-500 outline-none pb-1"
                />
                <button 
                  onClick={saveScenario} 
                  disabled={generatingSummary}
                  className="bg-emerald-600 text-white px-6 py-2 rounded-lg font-bold hover:bg-emerald-700 transition flex items-center gap-2 disabled:bg-slate-400"
                >
                  {generatingSummary ? <Loader2 className="animate-spin" size={18} /> : <Save size={18} />}
                  儲存情境 Save
                </button>
              </div>

              {/* Metrics Preview */}
              <div className="grid grid-cols-2 gap-4 mb-6">
                 <div className="bg-white p-4 rounded-xl border border-slate-200">
                    <div className="text-xs text-slate-500 mb-1">模擬後淨資產 Projected Net Worth</div>
                    <div className="flex items-center gap-2">
                       <span className="text-2xl font-bold text-slate-800">${metrics?.netWorth.toLocaleString()}</span>
                       {metrics && metrics.netWorth !== baseMetrics.netWorth && (
                         <span className={`text-xs px-2 py-0.5 rounded-full ${metrics.netWorth > baseMetrics.netWorth ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'}`}>
                            {metrics.netWorth > baseMetrics.netWorth ? '+' : ''}${(metrics.netWorth - baseMetrics.netWorth).toLocaleString()}
                         </span>
                       )}
                    </div>
                 </div>
                 <div className="bg-white p-4 rounded-xl border border-slate-200">
                    <div className="text-xs text-slate-500 mb-1">模擬後現金流 Projected Cash Flow</div>
                    <div className="flex items-center gap-2">
                       <span className={`text-2xl font-bold ${metrics!.monthlyCashFlow >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                         ${metrics?.monthlyCashFlow.toLocaleString()}
                       </span>
                       {metrics && metrics.monthlyCashFlow !== baseMetrics.monthlyCashFlow && (
                         <span className={`text-xs px-2 py-0.5 rounded-full flex items-center ${metrics.monthlyCashFlow > baseMetrics.monthlyCashFlow ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'}`}>
                            <ArrowRight size={10} className="mr-1"/>
                            {metrics.monthlyCashFlow > baseMetrics.monthlyCashFlow ? '+' : ''}${(metrics.monthlyCashFlow - baseMetrics.monthlyCashFlow).toLocaleString()}
                         </span>
                       )}
                    </div>
                 </div>
              </div>

              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 overflow-y-auto flex-1 pb-4">
                 {renderToggleList('資產 Assets', editingScenario.data.assets, 'assets', DollarSign, 'emerald')}
                 {renderToggleList('負債 Liabilities', editingScenario.data.liabilities, 'liabilities', TrendingDown, 'rose')}
                 {renderToggleList('收入 Income', editingScenario.data.incomes, 'incomes', TrendingUp, 'emerald')}
                 {renderToggleList('支出 Expenses', editingScenario.data.expenses, 'expenses', TrendingDown, 'rose')}
              </div>
            </>
          )}
        </div>
      </div>
    );
  };

  const renderAdvisor = () => (
    <div className="max-w-4xl mx-auto space-y-8">
      <div className="text-center space-y-4">
        <h2 className="text-3xl font-bold text-slate-900">AI 財務優化顧問</h2>
        <p className="text-slate-500">
          基於您的資產負債表與現金流，AI 將分析並提供具體優化建議。
          特別針對<span className="font-semibold text-slate-700">支出大於收入</span>的情況進行資產重組與減債規劃。
        </p>
        <button 
          onClick={handleRunAnalysis}
          disabled={loadingAi}
          className={`px-8 py-3 rounded-full font-bold text-white shadow-lg shadow-indigo-200 transition transform hover:-translate-y-1 ${loadingAi ? 'bg-indigo-400 cursor-not-allowed' : 'bg-indigo-600 hover:bg-indigo-700'}`}
        >
          {loadingAi ? 'AI 正在思考中...' : '開始分析 Start Analysis'}
        </button>
      </div>

      {aiAnalysis && (
        <div className="bg-white rounded-2xl shadow-xl border border-indigo-100 overflow-hidden animate-fade-in-up">
          <div className="bg-indigo-600 p-6 text-white">
            <div className="flex justify-between items-center">
              <div>
                <h3 className="text-xl font-bold flex items-center gap-2">
                  <BrainCircuit /> 分析報告
                </h3>
                <p className="text-indigo-200 text-sm mt-1">{aiAnalysis.summary}</p>
              </div>
              <div className="text-center bg-white/10 p-3 rounded-lg backdrop-blur-sm">
                <div className="text-xs text-indigo-200 uppercase tracking-wider">Health Score</div>
                <div className="text-3xl font-bold">{aiAnalysis.healthScore}</div>
              </div>
            </div>
          </div>
          
          <div className="p-8 space-y-8">
            <div>
              <h4 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2">
                <Activity className="text-rose-500" /> 立即行動建議
              </h4>
              <ul className="space-y-3">
                {aiAnalysis.immediateActions.map((action: string, idx: number) => (
                  <li key={idx} className="flex items-start gap-3 bg-slate-50 p-3 rounded-lg">
                    <CheckCircle className="text-emerald-500 w-5 h-5 flex-shrink-0 mt-0.5" />
                    <span className="text-slate-700">{action}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="prose prose-slate max-w-none">
              <h4 className="text-lg font-bold text-slate-800 mb-2 flex items-center gap-2">
                <TrendingUp className="text-blue-500" /> 策略規劃
              </h4>
              <p className="text-slate-600 leading-relaxed whitespace-pre-wrap">
                {aiAnalysis.strategicAdvice}
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );

  const renderModal = () => {
    if (!isModalOpen || !modalConfig) return null;

    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 animate-fade-in">
        <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden animate-fade-in-up">
          <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
            <h3 className="font-bold text-slate-800">{modalConfig.title}</h3>
            <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-slate-600">
              <X size={20} />
            </button>
          </div>
          
          <div className="p-6 space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">名稱 Name</label>
              <input 
                type="text" 
                value={formData.name} 
                onChange={e => setFormData({...formData, name: e.target.value})}
                className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
                placeholder="Ex: 薪水, 房租..."
              />
            </div>

            {/* Common Amount/Value Field */}
            {(modalConfig.type === 'income' || modalConfig.type === 'expense' || modalConfig.type === 'liability') && (
               <div>
                 <label className="block text-sm font-medium text-slate-700 mb-1">
                    {modalConfig.type === 'income' ? '金額 Amount' : 
                     modalConfig.type === 'expense' ? '金額 Amount' : '總額 Total Amount'}
                 </label>
                 <input 
                   type="number" 
                   value={formData.amount} 
                   onChange={e => setFormData({...formData, amount: e.target.value})}
                   className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
                   placeholder="0"
                 />
               </div>
            )}
            
            {/* Asset Specific Value */}
            {modalConfig.type === 'asset' && (
                <div>
                 <label className="block text-sm font-medium text-slate-700 mb-1">市值 Value</label>
                 <input 
                   type="number" 
                   value={formData.value} 
                   onChange={e => setFormData({...formData, value: e.target.value})}
                   className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
                   placeholder="0"
                 />
               </div>
            )}

            {/* Asset Specific Fields */}
            {modalConfig.type === 'asset' && (
                <>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">類型 Type</label>
                    <select 
                      value={formData.type}
                      onChange={e => setFormData({...formData, type: e.target.value})}
                      className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
                    >
                        {Object.values(AssetType).map(t => (
                            <option key={t} value={t}>{t}</option>
                        ))}
                    </select>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">流動性</label>
                         <select 
                          value={formData.liquidity}
                          onChange={e => setFormData({...formData, liquidity: e.target.value})}
                          className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
                        >
                            <option value="High">High</option>
                            <option value="Medium">Medium</option>
                            <option value="Low">Low</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">報酬率 (%)</label>
                        <input 
                           type="number" 
                           value={formData.returnRate} 
                           onChange={e => setFormData({...formData, returnRate: e.target.value})}
                           className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
                           placeholder="Ex: 5"
                        />
                      </div>
                  </div>
                </>
            )}

            {/* Liability Specific Fields */}
            {modalConfig.type === 'liability' && (
                <>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">類型 Type</label>
                    <select 
                      value={formData.type}
                      onChange={e => setFormData({...formData, type: e.target.value})}
                      className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
                    >
                        {Object.values(LiabilityType).map(t => (
                            <option key={t} value={t}>{t}</option>
                        ))}
                    </select>
                  </div>
                   <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">月繳款</label>
                         <input 
                           type="number" 
                           value={formData.monthlyPayment} 
                           onChange={e => setFormData({...formData, monthlyPayment: e.target.value})}
                           className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
                           placeholder="0"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">利率 (%)</label>
                        <input 
                           type="number" 
                           value={formData.interestRate} 
                           onChange={e => setFormData({...formData, interestRate: e.target.value})}
                           className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
                           placeholder="Ex: 2.5"
                        />
                      </div>
                  </div>
                </>
            )}

            <button 
              onClick={handleSaveItem}
              className="w-full bg-indigo-600 text-white py-3 rounded-xl font-bold hover:bg-indigo-700 transition mt-4"
            >
              儲存 Save
            </button>
          </div>
        </div>
      </div>
    )
  };

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
              { id: 'scenario', icon: PlayCircle, label: '情境模擬 Scenario' },
              { id: 'advisor', icon: BrainCircuit, label: 'AI 顧問 Advisor' },
            ].map(item => (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id as any)}
                className={`w-full flex items-center gap-3 px-4 py-3 text-sm font-medium rounded-lg transition ${
                  activeTab === item.id 
                    ? 'bg-indigo-50 text-indigo-700' 
                    : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                }`}
              >
                <item.icon size={18} />
                {item.label}
              </button>
            ))}
          </nav>
        </div>
        
        <div className="mt-auto border-t border-slate-100">
          {/* User Profile Section */}
          <div className="p-4">
             {user && (
               <div className="bg-slate-50 rounded-lg p-3 border border-slate-200">
                  <div className="flex items-center gap-3 mb-2">
                     {user.photoURL ? (
                       <img src={user.photoURL} alt="User" className="w-8 h-8 rounded-full" />
                     ) : (
                       <div className="w-8 h-8 bg-indigo-100 rounded-full flex items-center justify-center text-indigo-600 font-bold">
                          {user.displayName?.[0] || <UserIcon size={14}/>}
                       </div>
                     )}
                     <div className="flex-1 min-w-0">
                       <div className="text-sm font-bold text-slate-800 truncate">
                          {user.displayName}
                          {isGuest && <span className="ml-2 text-xs text-indigo-500 bg-indigo-50 px-1 rounded border border-indigo-100">GUEST</span>}
                       </div>
                       <div className="text-xs text-slate-500 flex items-center gap-1">
                          {syncStatus === 'synced' && <Cloud size={10} className="text-emerald-500"/>}
                          {syncStatus === 'saving' && <Loader2 size={10} className="animate-spin text-indigo-500"/>}
                          {syncStatus === 'offline' && <CloudOff size={10} className="text-slate-400"/>}
                          {syncStatus === 'synced' ? '已同步' : syncStatus === 'saving' ? '儲存中...' : '離線 (不儲存)'}
                       </div>
                     </div>
                  </div>
                  <button 
                    onClick={handleLogout}
                    className="w-full text-xs bg-white border border-slate-200 py-1.5 rounded-md text-slate-600 hover:text-rose-600 hover:border-rose-200 transition flex items-center justify-center gap-1"
                  >
                    <LogOut size={12}/> 登出
                  </button>
               </div>
             )}
            <div className="text-xs text-slate-300 mt-2 text-center">
              v0.0.1 | {(import.meta as any).env?.PROD ? 'Production' : 'Development'}
            </div>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 lg:ml-64 p-8">
        <div className="max-w-6xl mx-auto">
          {/* Header Mobile Only */}
          <div className="lg:hidden mb-6 flex justify-between items-center">
             <span className="font-bold text-xl text-indigo-900">WealthFlow</span>
             <div className="flex gap-2">
               {['dashboard', 'advisor'].map(t => (
                 <button key={t} onClick={() => setActiveTab(t as any)} className="text-xs bg-white border p-2 rounded">{t}</button>
               ))}
             </div>
          </div>

          <header className="mb-8">
             <h1 className="text-2xl font-bold text-slate-900 capitalize flex items-center gap-3">
               {activeTab === 'dashboard' && '財務總覽 Dashboard'}
               {activeTab === 'assets' && '資產管理 Assets'}
               {activeTab === 'liabilities' && '負債管理 Liabilities'}
               {activeTab === 'cashflow' && '收支管理 Cash Flow'}
               {activeTab === 'advisor' && 'AI 智能顧問'}
               {activeTab === 'import' && '智能匯入 Smart Import'}
               {activeTab === 'scenario' && '情境模擬 Scenario Simulator'}
               {activeTab === 'dashboard' && user && (
                 <span className="text-sm font-normal text-slate-400 bg-slate-100 px-3 py-1 rounded-full ml-auto hidden md:inline-block">
                    Welcome back, {user.displayName}
                 </span>
               )}
             </h1>
          </header>

          <div className="animate-fade-in">
            {activeTab === 'dashboard' && renderDashboard()}
            {activeTab === 'assets' && renderAssetList()}
            {activeTab === 'liabilities' && renderLiabilityList()}
            {activeTab === 'cashflow' && renderCashFlow()}
            {activeTab === 'import' && renderImport()}
            {activeTab === 'scenario' && renderScenarioMode()}
            {activeTab === 'advisor' && renderAdvisor()}
          </div>
        </div>
      </main>
      
      {renderModal()}
    </div>
  );
}