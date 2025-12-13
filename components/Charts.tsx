import React from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip as RechartsTooltip, Legend, BarChart, Bar, XAxis, YAxis, CartesianGrid } from 'recharts';
import { AssetItem, CashFlowItem, LiabilityItem } from '../types';

interface AssetAllocationChartProps {
  assets: AssetItem[];
}

interface CashFlowChartProps {
  incomes: CashFlowItem[];
  expenses: CashFlowItem[];
}

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8', '#82ca9d'];

export const AssetAllocationChart: React.FC<AssetAllocationChartProps> = ({ assets }) => {
  const data = assets.map(a => ({ name: a.type, value: a.value }));
  
  // Aggregate by type
  const aggregatedData = Object.values(data.reduce((acc, curr) => {
    if (!acc[curr.name]) acc[curr.name] = { name: curr.name, value: 0 };
    acc[curr.name].value += curr.value;
    return acc;
  }, {} as Record<string, {name: string, value: number}>));

  return (
    <div className="h-64 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={aggregatedData}
            cx="50%"
            cy="50%"
            labelLine={false}
            outerRadius={80}
            fill="#8884d8"
            dataKey="value"
          >
            {aggregatedData.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
            ))}
          </Pie>
          <RechartsTooltip formatter={(value: number) => `$${value.toLocaleString()}`} />
          <Legend />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
};

export const NetWorthBarChart: React.FC<{assets: AssetItem[], liabilities: LiabilityItem[]}> = ({ assets, liabilities }) => {
  const totalAssets = assets.reduce((acc, cur) => acc + cur.value, 0);
  const totalLiabilities = liabilities.reduce((acc, cur) => acc + cur.amount, 0);
  
  const data = [
    { name: '資產 Assets', value: totalAssets },
    { name: '負債 Liabilities', value: totalLiabilities },
  ];

  return (
    <div className="h-64 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="name" />
          <YAxis />
          <RechartsTooltip formatter={(value: number) => `$${value.toLocaleString()}`} />
          <Bar dataKey="value" fill="#6366f1" barSize={50}>
             {data.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={index === 0 ? '#10b981' : '#ef4444'} />
              ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
};