'use client';

import { useState, useEffect, useMemo } from 'react';
import AdminLayout from '@/components/AdminLayout';
import ProPlans from '@/components/ProPlans';
import MemberDetailsDrawer from '@/components/MemberDetailsDrawer';
import { collection, query, onSnapshot, where, doc, serverTimestamp, increment, orderBy, limit } from 'firebase/firestore';
import { db, updateDocument, addDocument } from '@/lib/firebase';
import { 
  FiUsers, FiClock, FiActivity, FiShield, FiSearch, 
  FiFilter, FiRefreshCw, FiAlertTriangle, FiCheckCircle,
  FiMoreVertical, FiArrowUpRight, FiDollarSign, FiInfo,
  FiBarChart2, FiZap, FiLogOut, FiShoppingCart, FiCreditCard
} from 'react-icons/fi';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';

// --- Types ---
interface ProMembership {
  id: string;
  userId: string;
  proStatus: 'active' | 'trial' | 'expired' | 'paused';
  proPlanId: string | null;
  proId?: string;
  proJarsUsedThisMonth: number;
  proPeriodEnd?: { toDate(): Date } | any;
  proTrialEnd?: { toDate(): Date } | any;
}

interface UserProfile {
  id: string;
  customerId: string;
  name?: string;
  full_name?: string;
  phone?: string;
  walletBalance?: number;
  isLegacy?: boolean;
  isOnboardingFeePaid?: boolean;
}

interface MergedMember extends ProMembership {
  user?: UserProfile;
}

const PRO_PLANS = {
  lite:   { id: 'lite',   name: 'Standard Refill',          fee: 15, maxJars: 7,      pricePerJar: 37, overageFee: 40 },
  pro:    { id: 'pro',    name: 'Smart Refill Family Plan',  fee: 35, maxJars: 30,     pricePerJar: 37, overageFee: 40 },
  proMax: { id: 'proMax', name: 'Unlimited Refill',          fee: 55, maxJars: 999999, pricePerJar: 37, overageFee: 0  },
};


export default function ProControlCenter() {
  const [members, setMembers] = useState<MergedMember[]>([]);
  const [recentActivity, setRecentActivity] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [filterPlan, setFilterPlan] = useState('all');
  const [showSimulator, setShowSimulator] = useState(false);
  const [selectedMember, setSelectedMember] = useState<MergedMember | null>(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);

  useEffect(() => {
    // 1. Live Users Listener (for identity mapping)
    const unsubUsers = onSnapshot(collection(db, 'users'), (userSnap) => {
      const userMap = userSnap.docs.reduce((acc, d) => {
        acc[d.id] = { id: d.id, ...d.data() } as UserProfile;
        return acc;
      }, {} as Record<string, UserProfile>);

      // 2. Live Pro Memberships Listener (Nested to ensure userMap is available)
      const unsubPro = onSnapshot(collection(db, 'pro_memberships'), (proSnap) => {
        const proData = proSnap.docs.map(d => ({ id: d.id, ...d.data() } as ProMembership));
        const merged = proData.map(m => ({
          ...m,
          user: userMap[m.userId]
        }));
        setMembers(merged);
        setLoading(false);
      });

      return () => unsubPro();
    });

    // 3. Live Activity Feed (from dev_subscription_logs or similar)
    // We'll simulate from pro_memberships updates if no log collection exists, 
    // but better to listen to a dedicated log collection if we have one.
    // For now, let's listen to pro_memberships ordered by updatedAt if available.
    const unsubActivity = onSnapshot(
      query(collection(db, 'pro_memberships'), orderBy('updatedAt', 'desc'), limit(10)),
      (snap) => {
        const activities = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        setRecentActivity(activities);
      }
    );

    return () => { unsubUsers(); unsubActivity(); };
  }, []);

  const filteredMembers = useMemo(() => {
    return members.filter(m => {
      const u = m.user;
      const searchStr = search.toLowerCase();
      const matchesSearch = !search || 
        u?.name?.toLowerCase().includes(searchStr) || 
        u?.full_name?.toLowerCase().includes(searchStr) || 
        u?.phone?.includes(searchStr) || 
        u?.customerId?.toLowerCase().includes(searchStr) ||
        m.proId?.toLowerCase().includes(searchStr);
      
      const matchesStatus = filterStatus === 'all' || m.proStatus === filterStatus;
      const matchesPlan = filterPlan === 'all' || m.proPlanId === filterPlan;

      return matchesSearch && matchesStatus && matchesPlan;
    });
  }, [members, search, filterStatus, filterPlan]);

  const stats = useMemo(() => {
    let active = 0, trial = 0, paused = 0, expired = 0;
    let liteCount = 0, proCount = 0, proMaxCount = 0;
    let onboardingPaidCount = 0;

    members.forEach(m => {
      if (m.proStatus === 'active') active++;
      if (m.proStatus === 'trial') trial++;
      if (m.proStatus === 'paused') paused++;
      if (m.proStatus === 'expired') expired++;

      if (m.proPlanId === 'lite' && m.proStatus !== 'expired') liteCount++;
      if (m.proPlanId === 'pro' && m.proStatus !== 'expired') proCount++;
      if (m.proPlanId === 'proMax' && m.proStatus !== 'expired') proMaxCount++;

      if (m.user?.isOnboardingFeePaid) onboardingPaidCount++;
    });

    return { active, trial, paused, expired, liteCount, proCount, proMaxCount, onboardingPaidCount };
  }, [members]);

  // Helper for countdown
  const getDaysDiff = (dateStrOrObj: any) => {
    if (!dateStrOrObj) return null;
    const targetDate = dateStrOrObj.toDate ? dateStrOrObj.toDate() : new Date(dateStrOrObj);
    const diffTime = targetDate.getTime() - new Date().getTime();
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24)); 
  };

  // --- Admin Actions ---
  const handleResetUsage = async (userId: string) => {
    if (!confirm('Reset monthly jar usage to 0 for this user?')) return;
    try {
      await updateDocument('pro_memberships', userId, {
        proJarsUsedThisMonth: 0,
        updatedAt: serverTimestamp()
      });
      alert('Usage reset successfully');
    } catch (e) { alert('Failed to reset'); }
  };

  const handleApplyPenalty = async (userId: string, currentWallet: number) => {
    if (!confirm('Apply ₹165 overdue jar penalty to this user\'s wallet?')) return;
    try {
      // Deduct from wallet
      await updateDocument('users', userId, {
        walletBalance: increment(-165)
      });
      // Log as transaction
      await addDocument('transactions', {
        userId,
        type: 'debit',
        amount: 165,
        category: 'penalty',
        note: 'Manual Unreturned Jar Penalty (7+ days)',
        createdAt: serverTimestamp()
      });
      alert('Penalty applied and logged.');
    } catch (e) { alert('Failed to apply penalty'); }
  };

  return (
    <div className="p-4 md:p-8 w-full space-y-8" style={{ fontFamily: '"Fira Sans", sans-serif' }}>
        <style dangerouslySetInnerHTML={{ __html: `
          @import url('https://fonts.googleapis.com/css2?family=Fira+Code:wght@400;700&family=Fira+Sans:wght@300;400;700;900&display=swap');
          .font-fira-code { font-family: 'Fira Code', monospace; }
        `}} />
        
        {/* Header Section */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-emerald-500/20 rounded-lg border border-emerald-500/30">
              <FiShield className="text-emerald-400 w-8 h-8" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-white mb-1">PRO Control Center</h1>
              <p className="text-zinc-400 text-sm">Hydrant 2.O Core Membership & Overage Engine</p>
            </div>
          </div>
          <div className="flex gap-2">
            <Link 
              href="/admin/pro-analytics"
              className="flex items-center gap-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 px-4 py-2 text-sm font-bold transition-all uppercase tracking-wider border border-zinc-700"
              style={{ borderRadius: '2px' }}
            >
              <FiBarChart2 className="text-emerald-400" />
              View Analytics
            </Link>
            <button 
              onClick={() => setShowSimulator(!showSimulator)}
              className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-500 text-white px-4 py-2 text-sm font-bold transition-all uppercase tracking-wider"
              style={{ borderRadius: '2px' }}
            >
              <FiRefreshCw className={showSimulator ? 'animate-spin' : ''} />
              {showSimulator ? 'Close Simulator' : 'Test Plan Enrollment'}
            </button>
          </div>
        </div>

        <div className="flex flex-col lg:flex-row gap-8 items-start w-full">
          <div className="flex-1 space-y-8 min-w-0">
            {/* Global Stats Row */}
        <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-4 w-full">
          <StatCard title="Total Active Subscriptions" value={stats.active} icon={<FiActivity />} color="text-emerald-400" bg="bg-emerald-400/10" loading={loading} />
          <StatCard title="Onboarding Deposits Paid" value={stats.onboardingPaidCount} icon={<FiDollarSign />} color="text-cyan-400" bg="bg-cyan-400/10" loading={loading} />
          <StatCard title="Standard Plans (Lite)" value={stats.liteCount} icon={<FiCheckCircle />} color="text-blue-400" bg="bg-blue-400/10" loading={loading} />
          <StatCard title="Smart Plans (Pro)" value={stats.proCount} icon={<FiZap />} color="text-fuchsia-400" bg="bg-fuchsia-400/10" loading={loading} />
          <StatCard title="Unlimited Plans (Max)" value={stats.proMaxCount} icon={<FiRefreshCw />} color="text-purple-400" bg="bg-purple-400/10" loading={loading} />
        </div>

        {/* Risk / Expiry Warning Row */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4 mb-4">
          <StatCard title="Paused / Retention Risk" value={stats.paused} icon={<FiAlertTriangle />} color="text-amber-400" bg="bg-amber-400/10" loading={loading} />
          <StatCard title="Failed Renewal (Action Required)" value={stats.expired} icon={<FiAlertTriangle />} color="text-red-400" bg="bg-red-400/10" loading={loading} />
        </div>

        {/* Simulator Toggle Section */}
        <AnimatePresence>
          {showSimulator && (
            <motion.div 
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="overflow-hidden"
            >
              <div className="bg-zinc-900 border border-zinc-800 p-6 rounded-lg mb-8" style={{ borderRadius: '2px' }}>
                <h2 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                  <FiArrowUpRight className="text-emerald-400" /> Plan Enrollment Simulator
                </h2>
                <ProPlans isAdminMode={true} onEnrolled={() => {}} />
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Members Management Table */}
        <div className="bg-zinc-900 border border-zinc-800 overflow-hidden" style={{ borderRadius: '2px' }}>
          {/* At-Risk / Action Required Feed */}
          {filteredMembers.filter(m => {
            const diff = getDaysDiff(m.proPeriodEnd);
            return m.proStatus === 'expired' || (diff !== null && diff <= 5 && diff >= 0);
          }).length > 0 && (
            <div className="bg-red-500/5 border-b border-red-500/20 p-4">
              <h3 className="text-red-400 font-bold text-xs uppercase tracking-widest mb-3 flex items-center gap-2">
                <FiAlertTriangle /> Action Required / Renewal Risk
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {filteredMembers.filter(m => {
                  const diff = getDaysDiff(m.proPeriodEnd);
                  return m.proStatus === 'expired' || (diff !== null && diff <= 5 && diff >= 0);
                }).slice(0, 4).map(m => {
                  const diff = getDaysDiff(m.proPeriodEnd);
                  return (
                    <div key={m.id} className="bg-red-500/10 border border-red-500/20 p-3 rounded flex justify-between items-center">
                      <div>
                        <div className="text-white font-bold text-sm">{m.user?.full_name || m.user?.name || 'Unknown'}</div>
                        <div className="text-red-300 text-xs">{m.user?.phone || 'No Phone'}</div>
                      </div>
                      <div className="text-right">
                        <div className="text-red-400 font-bold text-xs uppercase">
                          {m.proStatus === 'expired' ? 'Expired' : `${diff} Days Left`}
                        </div>
                        <button className="text-xs bg-red-500 hover:bg-red-600 text-white px-2 py-1 mt-1 rounded transition-colors font-bold">
                          View Details
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          <div className="p-4 border-b border-zinc-800 flex flex-col md:flex-row justify-between gap-4 bg-zinc-900/50">
            <div className="relative flex-1 max-w-md">
              <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
              <input 
                type="text" 
                placeholder="Search by name, phone, or customer ID..." 
                className="w-full bg-zinc-950 border border-zinc-800 text-white text-sm py-2 pl-10 pr-4 outline-none focus:border-emerald-500 transition-all font-mono-technical"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                style={{ borderRadius: '2px' }}
              />
            </div>
            <div className="flex gap-2">
              <select 
                className="bg-zinc-950 border border-zinc-800 text-zinc-400 text-xs font-bold px-3 py-2 outline-none uppercase"
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
              >
                <option value="all">Every Status</option>
                <option value="active">Active Members</option>
                <option value="trial">Free Trials</option>
                <option value="paused">Paused</option>
                <option value="expired">Expired</option>
              </select>
              <select 
                className="bg-zinc-950 border border-zinc-800 text-zinc-400 text-xs font-bold px-3 py-2 outline-none uppercase"
                value={filterPlan}
                onChange={(e) => setFilterPlan(e.target.value)}
              >
                <option value="all">All Plans</option>
                <option value="lite">Lite</option>
                <option value="pro">Pro</option>
                <option value="proMax">Pro Max</option>
              </select>
            </div>
          </div>

          <div className="overflow-x-auto custom-scrollbar">
            <table className="w-full text-left min-w-[1000px]">
              <thead>
                <tr className="bg-zinc-950/50 border-b border-zinc-800">
                  <th className="px-6 py-4 text-xs font-black text-zinc-500 uppercase tracking-widest">Subscriber (User ID)</th>
                  <th className="px-6 py-4 text-xs font-black text-zinc-500 uppercase tracking-widest">Status & Deposit</th>
                  <th className="px-6 py-4 text-xs font-black text-zinc-500 uppercase tracking-widest">Plan & Usage</th>
                  <th className="px-6 py-4 text-xs font-black text-zinc-500 uppercase tracking-widest">Billing Info & Days Left</th>
                  <th className="px-6 py-4 text-xs font-black text-zinc-500 uppercase tracking-widest">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800">
                {loading ? (
                  [...Array(5)].map((_, i) => (
                    <tr key={i} className="animate-pulse">
                      <td colSpan={5} className="px-6 py-8"><div className="h-4 bg-zinc-800 rounded w-full"></div></td>
                    </tr>
                  ))
                ) : filteredMembers.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-6 py-12 text-center text-zinc-500 italic">No members found matching your filters.</td>
                  </tr>
                ) : filteredMembers.map((member) => {
                  const diff = getDaysDiff(member.proPeriodEnd);
                  let timeText = 'N/A';
                  let timeColor = 'text-zinc-500';
                  if (member.proStatus === 'expired') {
                    timeText = 'Expired';
                    timeColor = 'text-red-400 font-bold';
                  } else if (diff !== null) {
                    if (diff < 0) {
                      timeText = `${Math.abs(diff)} days overdue`;
                      timeColor = 'text-red-400 font-bold';
                    } else if (diff <= 5) {
                      timeText = `Renews in ${diff} days ⚠️`;
                      timeColor = 'text-amber-400 font-bold';
                    } else {
                      timeText = `Renews in ${diff} days`;
                      timeColor = 'text-emerald-400';
                    }
                  }

                  return (
                    <tr key={member.id} className="hover:bg-zinc-800/30 transition-colors">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 bg-zinc-900 border border-zinc-700 flex items-center justify-center font-bold text-emerald-400" style={{ borderRadius: '2px' }}>
                            {(member.user?.full_name || member.user?.name || 'U').slice(0, 1)}
                          </div>
                          <div>
                            <div className="text-white font-bold text-sm tracking-tight">{member.user?.full_name || member.user?.name || 'Anonymous User'}</div>
                            <div className="text-zinc-500 text-xs font-mono-technical">#{member.user?.customerId || 'ID_PENDING'} • {member.user?.phone}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex flex-col gap-2">
                          <StatusBadge status={member.proStatus} />
                          {member.user?.isOnboardingFeePaid ? (
                            <span className="text-[10px] font-bold text-cyan-400 uppercase tracking-wider flex items-center gap-1">
                              <FiCheckCircle className="w-3 h-3" /> Deposit Paid
                            </span>
                          ) : (
                            <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider flex items-center gap-1">
                              <FiAlertTriangle className="w-3 h-3" /> No Deposit
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        {member.proPlanId ? (
                          <div className="space-y-2">
                            <div className="flex justify-between text-xs font-bold uppercase">
                              <span className="text-white">{PRO_PLANS[member.proPlanId as keyof typeof PRO_PLANS]?.name}</span>
                              <span className="text-zinc-400">{member.proJarsUsedThisMonth} / {PRO_PLANS[member.proPlanId as keyof typeof PRO_PLANS]?.maxJars === 999999 ? '∞' : PRO_PLANS[member.proPlanId as keyof typeof PRO_PLANS]?.maxJars}</span>
                            </div>
                            <div className="w-32 h-1.5 bg-zinc-950 rounded-full overflow-hidden">
                              <div 
                                className="h-full bg-emerald-500" 
                                style={{ width: `${Math.min(100, (member.proJarsUsedThisMonth / (PRO_PLANS[member.proPlanId as keyof typeof PRO_PLANS]?.maxJars || 1)) * 100)}%` }}
                              ></div>
                            </div>
                          </div>
                        ) : (
                          <span className="text-zinc-600 text-xs italic">No active plan</span>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        <div className="text-xs space-y-1">
                          <div className="text-zinc-400 flex items-center gap-1"><FiDollarSign className="w-3 h-3" /> Wallet: <span className="text-white font-bold">₹{member.user?.walletBalance || 0}</span></div>
                          <div className="text-zinc-500">End Date: {member.proPeriodEnd?.toDate ? member.proPeriodEnd.toDate().toLocaleDateString() : (member.proTrialEnd?.toDate ? member.proTrialEnd.toDate().toLocaleDateString() : 'N/A')}</div>
                          <div className={`text-[11px] ${timeColor}`}>{timeText}</div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          <ActionButton 
                            icon={<FiInfo className="w-3.5 h-3.5" />} 
                            title="View Details" 
                            onClick={() => {
                              setSelectedMember(member);
                              setIsDrawerOpen(true);
                            }} 
                          />
                          {member.proStatus !== 'active' && (
                            <ActionButton 
                              icon={<FiShield className="w-3.5 h-3.5 text-emerald-400" />} 
                              title="Quick Manual Activate" 
                              onClick={() => {
                                setSelectedMember(member);
                                setIsDrawerOpen(true);
                              }} 
                            />
                          )}
                          <div className="p-1.5 hover:bg-zinc-700 cursor-pointer text-zinc-400 rounded transition-colors border border-transparent hover:border-zinc-600">
                            <FiMoreVertical />
                          </div>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Right Column: Live Activity Feed */}
      <div className="w-full lg:w-80 space-y-6 shrink-0">
        <div className="bg-zinc-900 border border-zinc-800 p-5 rounded-lg sticky top-24 w-full" style={{ borderRadius: '2px' }}>
          <h3 className="text-zinc-500 text-[10px] font-black uppercase tracking-widest mb-4 flex items-center gap-2">
            <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse shadow-[0_0_8px_#10b981]" />
            Live Subscription Feed
          </h3>
          <div className="space-y-4 max-h-[600px] overflow-y-auto pr-2 custom-scrollbar">
            {recentActivity.length === 0 ? (
              <div className="text-zinc-600 text-xs italic py-4">No recent activity detected...</div>
            ) : (
              recentActivity.map((act, i) => (
                <div key={i} className="flex gap-3 border-l-2 border-zinc-800 pl-4 py-1 hover:border-emerald-500 transition-colors cursor-default">
                  <div className="flex-1">
                    <div className="text-white text-xs font-bold leading-tight">
                      Subscriber Update
                    </div>
                    <div className="text-zinc-500 text-[10px] mt-1 font-fira-code">
                      ID: {act.proId || act.id.slice(0,8)}
                    </div>
                    <div className="text-zinc-400 text-[11px] mt-1 line-clamp-1">
                      Status changed to <span className="text-emerald-400 uppercase font-black">{act.proStatus}</span>
                    </div>
                    <div className="text-zinc-600 text-[9px] mt-2 flex items-center gap-1">
                      <FiClock size={10} /> Just now
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
          <div className="mt-6 pt-4 border-t border-zinc-800">
            <div className="flex items-center justify-between text-[10px] font-bold uppercase tracking-widest text-zinc-500">
              <span>Sync Status</span>
              <span className="text-emerald-500 flex items-center gap-1">
                <FiRefreshCw className="animate-spin" size={10} /> Live
              </span>
            </div>
          </div>
        </div>
        
        {/* Retention Health Card */}
        <div className="bg-emerald-500/5 border border-emerald-500/20 p-5 rounded-lg" style={{ borderRadius: '2px' }}>
          <h3 className="text-emerald-500 text-[10px] font-black uppercase tracking-widest mb-2">Retention Health</h3>
          <div className="text-2xl font-bold text-white font-fira-code">94.2%</div>
          <div className="text-[10px] text-zinc-500 mt-1 uppercase">Satisfactory performance</div>
          <div className="mt-3 w-full h-1 bg-zinc-800 rounded-full overflow-hidden">
            <div className="h-full bg-emerald-500 w-[94.2%] shadow-[0_0_8px_#10b981]" />
          </div>
        </div>
      </div>
    </div>

    <MemberDetailsDrawer 
      isOpen={isDrawerOpen} 
      onClose={() => setIsDrawerOpen(false)} 
      member={selectedMember} 
    />
  </div>

);
}

function StatCard({ title, value, icon, color, bg, loading }: any) {
  return (
    <div className="bg-zinc-900 border border-zinc-800 p-4 flex flex-col gap-2 hover:border-zinc-700 transition-colors group cursor-default" style={{ borderRadius: '2px' }}>
      <div className="flex justify-between items-center">
        <h3 className="text-zinc-500 text-[9px] font-black uppercase tracking-widest">{title}</h3>
        <div className={`p-1.5 rounded ${bg} ${color} group-hover:scale-110 transition-transform`}>
          {icon}
        </div>
      </div>
      <div>
        {loading ? (
          <div className="h-8 w-16 bg-zinc-800 animate-pulse rounded"></div>
        ) : (
          <span className="text-2xl font-bold text-white tracking-tighter font-fira-code">{value}</span>
        )}
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const styles = {
    active: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30',
    trial: 'bg-cyan-500/10 text-cyan-400 border-cyan-500/30',
    paused: 'bg-amber-500/10 text-amber-400 border-amber-500/30',
    expired: 'bg-red-500/10 text-red-400 border-red-500/30'
  };
  
  return (
    <span className={`px-2.5 py-1 text-[10px] font-black uppercase tracking-widest border ${styles[status as keyof typeof styles]}`} style={{ borderRadius: '2px' }}>
      {status}
    </span>
  );
}

function ActionButton({ icon, title, onClick, variant = 'normal' }: { icon: any, title: string, onClick: () => void, variant?: 'normal' | 'danger' }) {
  const colors = variant === 'danger' ? 'hover:bg-red-500/20 hover:text-red-400 hover:border-red-500' : 'hover:bg-cyan-500/20 hover:text-cyan-400 hover:border-cyan-500';
  
  return (
    <div 
      title={title}
      onClick={onClick}
      className={`p-1.5 bg-zinc-950 border border-zinc-800 text-zinc-500 cursor-pointer rounded transition-all ${colors}`}
      style={{ borderRadius: '2px' }}
    >
      {icon}
    </div>
  );
}
