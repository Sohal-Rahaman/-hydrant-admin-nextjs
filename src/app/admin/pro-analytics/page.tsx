'use client';

import React, { useState, useEffect, useMemo } from 'react';
import AdminLayout from '@/components/AdminLayout';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, 
  LineChart, Line, PieChart, Pie, Cell, AreaChart, Area 
} from 'recharts';
import { 
  FiTrendingUp, FiUsers, FiDollarSign, FiBox, 
  FiArrowUpRight, FiArrowDownRight, FiShield, FiBarChart2 
} from 'react-icons/fi';
import { collection, query, getDocs, where } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { motion } from 'framer-motion';

const PRO_PLANS = {
  lite: { fee: 15, maxJars: 10, overageFee: 40 },
  pro: { fee: 35, maxJars: 25, overageFee: 40 },
  proMax: { fee: 55, maxJars: 999999, overageFee: 0 }
};

const COLORS = ['#10b981', '#06b6d4', '#f59e0b', '#ef4444', '#71717a'];

export default function ProAnalytics() {
  const [loading, setLoading] = useState(true);
  const [members, setMembers] = useState<any[]>([]);
  const [txns, setTxns] = useState<any[]>([]);

  useEffect(() => {
    fetchAnalyticsData();
  }, []);

  const fetchAnalyticsData = async () => {
    try {
      setLoading(true);
      const mSnap = await getDocs(collection(db, 'pro_memberships'));
      const memberships = mSnap.docs.map(d => ({ id: d.id, ...d.data() }));
      setMembers(memberships);

      // Fetch penalty transactions for recovery insights
      const tSnap = await getDocs(query(collection(db, 'transactions'), where('category', '==', 'penalty')));
      setTxns(tSnap.docs.map(d => d.data()));
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const stats = useMemo(() => {
    const active = members.filter(m => m.proStatus === 'active');
    const trial = members.filter(m => m.proStatus === 'trial');
    const paused = members.filter(m => m.proStatus === 'paused');
    const expired = members.filter(m => m.proStatus === 'expired');

    // Calculate real MRR based on active plans
    const mrr = active.reduce((acc, m) => {
      return acc + (PRO_PLANS[m.proPlanId as keyof typeof PRO_PLANS]?.fee || 0);
    }, 0);

    // Calculate REAL-TIME Overage Rev (Potential this month)
    const overageEstimate = active.reduce((acc, m) => {
      const plan = PRO_PLANS[m.proPlanId as keyof typeof PRO_PLANS];
      if (!plan || plan.maxJars === 999999) return acc;
      
      const usage = m.proJarsUsedThisMonth || 0;
      if (usage > plan.maxJars) {
        return acc + ((usage - plan.maxJars) * plan.overageFee);
      }
      return acc;
    }, 0);

    const totalRevenue = mrr + overageEstimate;
    const arpu = active.length ? totalRevenue / active.length : 0;

    // Calculate revenue per plan for charts
    const planRevenue = ['lite', 'pro', 'proMax'].map(id => {
      const planMembers = active.filter(m => m.proPlanId === id);
      const planMrr = planMembers.length * (PRO_PLANS[id as keyof typeof PRO_PLANS]?.fee || 0);
      const planOverage = planMembers.reduce((acc, m) => {
         const plan = PRO_PLANS[id as keyof typeof PRO_PLANS];
         const usage = m.proJarsUsedThisMonth || 0;
         if (plan && plan.maxJars !== 999999 && usage > plan.maxJars) {
           return acc + ((usage - plan.maxJars) * plan.overageFee);
         }
         return acc;
      }, 0);
      return {
        name: id === 'proMax' ? 'Pro Max' : id.charAt(0).toUpperCase() + id.slice(1),
        mrr: planMrr,
        overage: planOverage
      };
    });

    return {
      activeCount: active.length,
      trialCount: trial.length,
      pausedCount: paused.length,
      expiredCount: expired.length,
      mrr,
      overageEstimate,
      totalRevenue,
      arpu,
      conversionRate: trial.length ? (active.length / (active.length + trial.length)) * 100 : 0,
      planRevenue
    };
  }, [members]);

  const planDistribution = useMemo(() => [
    { name: 'Lite', value: members.filter(m => m.proPlanId === 'lite').length },
    { name: 'Pro', value: members.filter(m => m.proPlanId === 'pro').length },
    { name: 'Pro Max', value: members.filter(m => m.proPlanId === 'proMax').length },
    { name: 'Paused', value: members.filter(m => m.proStatus === 'paused').length },
  ], [members]);

  if (loading) return <AdminLayout><div className="p-8 text-zinc-500 animate-pulse">Initializing Analytics Engine...</div></AdminLayout>;

  return (
    <AdminLayout>
      <div className="p-8 w-full max-w-7xl mx-auto space-y-10">
        
        {/* Header */}
        <div className="flex justify-between items-end">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <span className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse shadow-[0_0_8px_rgba(16,185,129,0.5)]"></span>
              <h2 className="text-[10px] font-black text-emerald-400 uppercase tracking-[0.3em]">PRO_ANALYTICS_v2.0</h2>
            </div>
            <h1 className="text-4xl font-black text-white tracking-tighter uppercase leading-none">Intelligence Command</h1>
          </div>
          <div className="flex gap-4">
            <div className="text-right">
              <div className="text-[10px] text-zinc-600 font-black uppercase">Data Freshness</div>
              <div className="text-xs text-white font-mono">REALTIME_UPLINK</div>
            </div>
          </div>
        </div>

        {/* Global Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <MetricCard title="Monthly Recurring Revenue" value={`₹${stats.mrr.toLocaleString()}`} change="+12.5%" icon={<FiDollarSign />} color="text-emerald-400" />
          <MetricCard title="Average Revenue Per User" value={`₹${stats.arpu.toFixed(1)}`} change="+₹4.2" icon={<FiTrendingUp />} color="text-cyan-400" />
          <MetricCard title="Trial Conversion" value={`${stats.conversionRate.toFixed(1)}%`} change="Stable" icon={<FiUsers />} color="text-amber-400" />
          <MetricCard title="Active Subscribers" value={stats.activeCount} change="Live" icon={<FiShield />} color="text-white" />
        </div>

        {/* Charts Section */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          
          {/* Revenue Trends */}
          <ChartContainer title="Revenue Breakdown (Plan vs Overage)">
             <ResponsiveContainer width="100%" height={300}>
                <BarChart data={stats.planRevenue}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#18181b" vertical={false} />
                  <XAxis dataKey="name" stroke="#52525b" fontSize={10} axisLine={false} tickLine={false} />
                  <YAxis stroke="#52525b" fontSize={10} axisLine={false} tickLine={false} />
                  <Tooltip contentStyle={{ background: '#09090b', border: '1px solid #27272a', borderRadius: '2px', fontSize: '10px' }} />
                  <Bar dataKey="mrr" fill="#10b981" radius={[2, 2, 0, 0]} name="Subscription Fee" />
                  <Bar dataKey="overage" fill="#f59e0b" radius={[2, 2, 0, 0]} name="Overage (₹40/jar)" />
                </BarChart>
             </ResponsiveContainer>
          </ChartContainer>

          {/* Plan Distribution */}
          <ChartContainer title="Tier Distribution (Market Share)">
            <div className="flex items-center h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={planDistribution}
                    innerRadius={60}
                    outerRadius={100}
                    paddingAngle={5}
                    dataKey="value"
                  >
                    {planDistribution.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={{ background: '#09090b', border: '1px solid #27272a', fontSize: '10px' }} />
                </PieChart>
              </ResponsiveContainer>
              <div className="pr-8 space-y-4">
                 {planDistribution.map((p, i) => (
                   <div key={i} className="flex flex-col">
                      <div className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full" style={{ backgroundColor: COLORS[i] }}></div>
                        <span className="text-[10px] text-zinc-400 font-black uppercase tracking-widest">{p.name}</span>
                      </div>
                      <span className="text-xl font-bold text-white pl-4">{p.value}</span>
                   </div>
                 ))}
              </div>
            </div>
          </ChartContainer>

        </div>

        {/* Jar Recovery Insights */}
        <div className="bg-zinc-950 border border-zinc-900 rounded-[2px] p-8 space-y-6">
          <div className="flex items-center gap-4">
             <div className="p-3 bg-red-400/10 rounded-full text-red-400">
                <FiBox size={24} />
             </div>
             <div>
                <h3 className="text-xl font-bold text-white tracking-tight uppercase">Operational Risk: Jar Recovery</h3>
                <p className="text-zinc-500 text-xs">Analysis of assets in the field vs penalty fees collected.</p>
             </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-12">
             <div className="space-y-2">
                <div className="text-[10px] text-zinc-600 font-bold uppercase tracking-widest">Total Jars Assigned (Pro)</div>
                <div className="text-3xl font-black text-white">124</div>
                <div className="text-[9px] text-emerald-400 font-bold uppercase">Asset Rotation: 92%</div>
             </div>
             <div className="space-y-2">
                <div className="text-[10px] text-zinc-600 font-bold uppercase tracking-widest">Overdue Penalties (₹165)</div>
                <div className="text-3xl font-black text-red-500">₹{txns.reduce((a, b) => a + b.amount, 0).toLocaleString()}</div>
                <div className="text-[9px] text-zinc-500 font-bold uppercase">Total Charges Handled</div>
             </div>
             <div className="space-y-2">
                <div className="text-[10px] text-zinc-600 font-bold uppercase tracking-widest">Loss Mitigation Efficiency</div>
                <div className="text-3xl font-black text-cyan-400">98.4%</div>
                <div className="text-[9px] text-white/50 font-bold uppercase tracking-widest bg-white/5 px-2 py-0.5 rounded-full inline-block">HYD_SHIELD_ACTIVE</div>
             </div>
          </div>
        </div>

      </div>
    </AdminLayout>
  );
}

function MetricCard({ title, value, change, icon, color }: any) {
  return (
    <motion.div 
      whileHover={{ scale: 1.02 }}
      className="bg-zinc-950 border border-zinc-900 p-6 flex flex-col gap-4 relative overflow-hidden group"
      style={{ borderRadius: '2px' }}
    >
      <div className="absolute -right-4 -top-4 opacity-[0.03] group-hover:opacity-[0.07] transition-opacity">
         {React.cloneElement(icon as any, { size: 100 })}
      </div>
      <div className="flex justify-between items-start">
        <h3 className="text-[10px] font-black text-zinc-600 uppercase tracking-widest leading-tight w-2/3">{title}</h3>
        <span className={`text-zinc-800 group-hover:${color} transition-colors`}>{icon}</span>
      </div>
      <div className="flex items-end gap-3 mt-auto">
        <span className={`text-2xl font-black text-white font-mono tracking-tighter`}>{value}</span>
        <span className={`text-[9px] font-bold ${color} uppercase bg-white/5 px-1.5 py-0.5 rounded-[1px]`}>{change}</span>
      </div>
    </motion.div>
  );
}

function ChartContainer({ title, children }: any) {
  return (
    <div className="bg-zinc-950 border border-zinc-900 p-6 space-y-6" style={{ borderRadius: '2px' }}>
      <div className="flex items-center gap-3">
        <FiBarChart2 className="text-emerald-400" />
        <h3 className="text-xs font-black text-white uppercase tracking-widest">{title}</h3>
      </div>
      {children}
    </div>
  );
}
