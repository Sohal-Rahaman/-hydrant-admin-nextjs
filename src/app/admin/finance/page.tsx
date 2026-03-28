'use client';

import React, { useState, useEffect } from 'react';
import styled from 'styled-components';
import { motion } from 'framer-motion';
import { 
  FiDollarSign, 
  FiTrendingUp, 
  FiPieChart, 
  FiDownload, 
  FiCalendar,
  FiArrowUp,
  FiArrowDown,
  FiFilter,
  FiCheckCircle
} from 'react-icons/fi';
import { 
  LineChart, 
  Line, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  AreaChart,
  Area
} from 'recharts';
import { 
  collection, 
  query, 
  orderBy, 
  onSnapshot
} from 'firebase/firestore';
import { db } from '@/lib/firebase';

const data = [
  { name: 'Mon', revenue: 4200, profit: 2100 },
  { name: 'Tue', revenue: 3800, profit: 1800 },
  { name: 'Wed', revenue: 5100, profit: 2800 },
  { name: 'Thu', revenue: 4800, profit: 2400 },
  { name: 'Fri', revenue: 6200, profit: 3400 },
  { name: 'Sat', revenue: 7500, profit: 4100 },
  { name: 'Sun', revenue: 6800, profit: 3600 },
];

const PageContainer = styled.div`
  padding: 24px;
  max-width: 1400px;
  margin: 0 auto;
`;

const Header = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 32px;
`;

const Title = styled.h1`
  font-size: 24px;
  font-weight: 800;
  color: #1a1a1a;
  display: flex;
  align-items: center;
  gap: 12px;
`;

const StatsGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 20px;
  margin-bottom: 32px;
`;

const StatCard = styled.div`
  background: white;
  border-radius: 20px;
  padding: 24px;
  border: 1px solid #f3f4f6;
  box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05);

  .label {
    font-size: 11px;
    font-weight: 800;
    color: #9ca3af;
    text-transform: uppercase;
    letter-spacing: 0.1em;
    margin-bottom: 8px;
  }
  .value {
    font-size: 24px;
    font-weight: 800;
    color: #1f2937;
  }
  .trend {
    font-size: 11px;
    font-weight: 700;
    display: flex;
    align-items: center;
    gap: 4px;
    margin-top: 8px;
    &.up { color: #10b981; }
    &.down { color: #ef4444; }
  }
`;

const ChartContainer = styled.div`
  background: white;
  border-radius: 24px;
  padding: 32px;
  border: 1px solid #f3f4f6;
  box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.05);
  margin-bottom: 32px;
  height: 400px;
`;

const TransactionTable = styled.div`
  background: white;
  border-radius: 20px;
  border: 1px solid #f3f4f6;
  overflow: hidden;

  table {
    width: 100%;
    border-collapse: collapse;
  }

  th {
     padding: 16px 24px;
     text-align: left;
     font-size: 12px;
     font-weight: 800;
     color: #6b7280;
     background: #f9fafb;
     text-transform: uppercase;
  }

  td {
     padding: 16px 24px;
     border-top: 1px solid #f3f4f6;
     font-size: 14px;
  }
`;

export default function FinancePage() {
  const [loading, setLoading] = useState(false);

  return (
    <PageContainer>
      <Header>
        <Title><FiDollarSign /> Financial Ledger</Title>
        <div className="flex gap-3">
          <button className="flex items-center gap-2 px-4 py-2 bg-white rounded-xl border text-sm font-bold text-gray-600 shadow-sm">
            <FiCalendar /> Monthly View
          </button>
          <button className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-xl text-sm font-bold shadow-lg shadow-indigo-100">
            <FiDownload /> Export Tax Report
          </button>
        </div>
      </Header>

      <StatsGrid>
        <StatCard>
          <div className="label">Total Revenue (MTD)</div>
          <div className="value">₹1,42,850</div>
          <div className="trend up"><FiArrowUp /> 12.5%</div>
        </StatCard>
        <StatCard>
          <div className="label">Operating Costs</div>
          <div className="value">₹48,200</div>
          <div className="trend down"><FiArrowDown /> 4.2%</div>
        </StatCard>
        <StatCard>
          <div className="label">Net Profit</div>
          <div className="value">₹94,650</div>
          <div className="trend up"><FiArrowUp /> 8.1%</div>
        </StatCard>
        <StatCard>
          <div className="label">Avg Order Value</div>
          <div className="value">₹42.50</div>
          <div className="trend up"><FiArrowUp /> 2.3%</div>
        </StatCard>
      </StatsGrid>

      <ChartContainer>
         <h3 className="text-sm font-black text-gray-400 uppercase tracking-widest mb-6 px-2">Revenue vs Profit Trend</h3>
         <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data}>
              <defs>
                <linearGradient id="colorRev" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#4a00e0" stopOpacity={0.1}/>
                  <stop offset="95%" stopColor="#4a00e0" stopOpacity={0}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
              <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 12, fontWeight: 600, fill: '#9ca3af' }} />
              <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fontWeight: 600, fill: '#9ca3af' }} />
              <Tooltip 
                contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)' }}
              />
              <Area type="monotone" dataKey="revenue" stroke="#4a00e0" strokeWidth={3} fillOpacity={1} fill="url(#colorRev)" />
              <Area type="monotone" dataKey="profit" stroke="#10b981" strokeWidth={3} fillOpacity={0} />
            </AreaChart>
         </ResponsiveContainer>
      </ChartContainer>

      <TransactionTable>
         <table>
            <thead>
               <tr>
                  <th>Ref ID</th>
                  <th>Date</th>
                  <th>Type</th>
                  <th>Entity</th>
                  <th>Amount</th>
                  <th>Status</th>
               </tr>
            </thead>
            <tbody>
                {[1,2,3,4,5].map(i => (
                  <tr key={i}>
                    <td className="font-mono text-xs text-gray-400">#TRX-{3948 + i}</td>
                    <td className="font-medium text-gray-600">Oct {14 + i}, 2023</td>
                    <td>
                       <span className={`px-2 py-1 rounded text-[10px] font-bold uppercase ${i % 2 === 0 ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
                         {i % 2 === 0 ? 'Credit' : 'Payout'}
                       </span>
                    </td>
                    <td className="font-bold text-gray-800">{i % 2 === 0 ? 'User Wallet' : 'Army Payout'}</td>
                    <td className="font-black">₹{i % 2 === 0 ? '500.00' : '150.00'}</td>
                    <td>
                      <div className="flex items-center gap-2 text-green-600 font-bold text-xs">
                        <FiCheckCircle /> Success
                      </div>
                    </td>
                  </tr>
                ))}
            </tbody>
         </table>
      </TransactionTable>
    </PageContainer>
  );
}

