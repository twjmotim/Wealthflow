export enum AssetType {
  PRIVATE_EQUITY = '私募股票 (Private Equity)',
  US_BOND = '美債 (US Bond)',
  DEPOSIT_INSURANCE = '存款保險 (Deposit Insurance)',
  MUTUAL_FUND = '基金 (Mutual Fund)',
  REAL_ESTATE = '房地產 (Real Estate)',
  CASH = '現金/存款 (Cash)',
  STOCK = '上市股票 (Stock)',
  OTHER = '其他 (Other)'
}

export enum LiabilityType {
  MORTGAGE = '房貸 (Mortgage)',
  PERSONAL_LOAN = '信貸 (Personal Loan)',
  CREDIT_CARD = '信用卡 (Credit Card)',
  CAR_LOAN = '車貸 (Car Loan)',
  OTHER = '其他 (Other)'
}

export interface AssetItem {
  id: string;
  name: string;
  type: AssetType;
  value: number;
  returnRate?: number;
  liquidity: 'High' | 'Medium' | 'Low';
}

export interface LiabilityItem {
  id: string;
  name: string;
  type: LiabilityType;
  amount: number;
  interestRate: number;
  monthlyPayment: number;
}

export interface CashFlowItem {
  id: string;
  name: string;
  amount: number;
  type: 'Income' | 'Expense';
}

export interface FinancialState {
  assets: AssetItem[];
  liabilities: LiabilityItem[];
  incomes: CashFlowItem[];
  expenses: CashFlowItem[];
}

export interface Scenario {
  id: string;
  name: string;
  data: FinancialState;
  aiSummary: string;
  createdAt: number;
}

export interface ChatMessage {
  role: 'user' | 'model';
  parts: { text: string }[];
}

export interface SavedAdvice {
  id: string;
  title: string;
  content: string;
  score: number;
  createdAt: number;
}
