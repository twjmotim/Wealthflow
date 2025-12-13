import { GoogleGenAI } from "@google/genai";
import { FinancialState, AssetType, LiabilityType } from "../types";

const getSystemInstruction = () => `
You are an expert Certified Financial Planner (CFP) specializing in debt management, asset allocation, and cash flow optimization. 
You are analyzing a user's financial portfolio in Taiwan/Global context.
The user holds specific assets like Taiwan Private Equity (illiquid), US Bonds, Deposit Insurance, Mutual Funds, and Real Estate.

Your Goal:
1. Analyze the Net Worth and Monthly Cash Flow.
2. If Expenses > Income (Negative Cash Flow), prioritize immediate survival strategies.
3. Suggest which assets to liquidate based on liquidity and market conditions (e.g., Private Equity is hard to sell, Bonds are liquid but consider yield).
4. Suggest which liabilities to pay off first (Avalanche vs Snowball method).
5. Provide specific, actionable steps in Traditional Chinese (繁體中文).

Output Format:
Return a JSON object with the following structure:
{
  "summary": "Short summary of the current situation",
  "healthScore": number (0-100),
  "immediateActions": ["Action 1", "Action 2"],
  "strategicAdvice": "Detailed paragraph explaining the strategy..."
}
`;

export const analyzeFinances = async (data: FinancialState): Promise<string> => {
  try {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    
    const userPrompt = `
      Please analyze my current financial situation based on the following data:

      Assets:
      ${JSON.stringify(data.assets)}

      Liabilities:
      ${JSON.stringify(data.liabilities)}

      Monthly Income:
      ${JSON.stringify(data.incomes)}

      Monthly Expenses:
      ${JSON.stringify(data.expenses)}

      Total Monthly Income: ${data.incomes.reduce((acc, curr) => acc + curr.amount, 0)}
      Total Monthly Expenses: ${data.expenses.reduce((acc, curr) => acc + curr.amount, 0)}

      Please provide advice on how to optimize my portfolio, especially if I have a cash flow deficit.
    `;

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: userPrompt,
      config: {
        systemInstruction: getSystemInstruction(),
        responseMimeType: "application/json",
      }
    });

    return response.text || "{}";
  } catch (error) {
    console.error("Gemini API Error:", error);
    throw new Error("Failed to generate financial advice. Please check your API_KEY.");
  }
};

export const parseFinancialScreenshot = async (base64Image: string): Promise<string> => {
  try {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

    const prompt = `
      Analyze this image which is a screenshot of a financial account (Bank App, Securities App, or Credit Card Statement) from Taiwan.
      
      Extract all visible Assets (e.g., Deposits, Stocks, Funds, Total Value) and Liabilities (e.g., Credit Card Due, Loans).
      
      Rules:
      1. Identify the Name of the item (e.g., "TSMC", "Cathay United Bank Deposit", "Credit Card Bill").
      2. Identify the numerical Amount/Value. Ignore currency symbols like '$', 'NT$', 'TWD'.
      3. Categorize them into one of the following Types:
         - Assets: '${Object.values(AssetType).join("', '")}'
         - Liabilities: '${Object.values(LiabilityType).join("', '")}'
         If unsure, use '其他 (Other)'.
      4. For Assets, estimate 'liquidity' (High/Medium/Low) based on the type (e.g., Stocks=High, Cash=High, Real Estate=Low).
      5. Determine the interest rate/return rate if visible, otherwise set to 0.

      Output JSON format:
      {
        "assets": [
          { "name": "Item Name", "type": "Mapped Type", "value": 10000, "liquidity": "High", "returnRate": 0 }
        ],
        "liabilities": [
          { "name": "Item Name", "type": "Mapped Type", "amount": 5000, "interestRate": 0, "monthlyPayment": 0 }
        ]
      }
    `;

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: {
        parts: [
          { inlineData: { mimeType: 'image/jpeg', data: base64Image } },
          { text: prompt }
        ]
      },
      config: {
        responseMimeType: "application/json"
      }
    });

    return response.text || '{"assets": [], "liabilities": []}';
  } catch (error) {
    console.error("Gemini Vision Error:", error);
    throw new Error("Failed to parse image.");
  }
};

export const generateScenarioSummary = async (baseline: FinancialState, scenario: FinancialState): Promise<string> => {
  try {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    
    // Calculate differences for prompt context
    const baselineAssets = baseline.assets.map(a => a.name);
    const scenarioAssets = scenario.assets.map(a => a.name);
    const removedAssets = baselineAssets.filter(x => !scenarioAssets.includes(x));

    const baselineExpenses = baseline.expenses.map(a => a.name);
    const scenarioExpenses = scenario.expenses.map(a => a.name);
    const removedExpenses = baselineExpenses.filter(x => !scenarioExpenses.includes(x));

    const prompt = `
      Compare the Baseline financial state with the Simulated Scenario state.
      
      Changes detected (Items removed/disposed):
      - Removed Assets: ${removedAssets.join(', ') || 'None'}
      - Removed Expenses: ${removedExpenses.join(', ') || 'None'}
      
      Please write a concise summary (in Traditional Chinese) explaining what this scenario represents. 
      Focus on what actions were taken (e.g., "Sold the property", "Cut insurance costs") and how it impacted the cash flow generally.
      Keep it under 50 words.
    `;

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
    });

    return response.text || "情境模擬摘要生成失敗";
  } catch (error) {
    console.error("Gemini Scenario Error:", error);
    return "無法生成摘要";
  }
};