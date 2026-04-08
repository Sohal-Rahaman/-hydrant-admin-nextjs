'use client';

import React, { useState, useEffect, useMemo } from 'react';
import styled from 'styled-components';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  FiSearch, 
  FiPhone, 
  FiMessageCircle, 
  FiTrendingUp, 
  FiTrendingDown, 
  FiEye,
  FiCheckCircle,
  FiXCircle,
  FiAlertTriangle,
  FiCheck,
  FiDollarSign,
  FiUsers,
  FiActivity,
  FiArrowRight,
  FiUser,
  FiPackage,
  FiClock,
  FiPlus,
  FiMinus
} from 'react-icons/fi';
import { 
  PieChart, 
  Pie, 
  Cell, 
  ResponsiveContainer, 
  Tooltip as RechartsTooltip,
  BarChart,
  Bar,
  XAxis,
  YAxis
} from 'recharts';
import { 
  collection, 
  query, 
  where, 
  orderBy, 
  limit, 
  onSnapshot,
  doc,
  runTransaction,
  Timestamp
} from 'firebase/firestore';
import { db } from '@/lib/firebase';

interface UserWallet {
  id: string;
  name: string;
  phone: string;
  customerId: string;
  wallet_balance: number;
  jars_occupied?: number;
  jarHold?: number;
}

interface WalletTransaction {
  id: string;
  userId: string;
  amount: number;
  type: string;
  description: string;
  createdAt: any;
  status: string;
  userPhone?: string;
  userName?: string;
}

const PageContainer = styled.div`
  background: #0f0f0f;
  min-height: 100vh;
  padding: 24px;
  color: #f0f0f0;
`;

const Container = styled.div`
  max-width: 1400px;
  margin: 0 auto;
`;

const Title = styled.h1`
  font-size: 28px;
  font-weight: 800;
  margin-bottom: 32px;
  display: flex;
  align-items: center;
  gap: 12px;
  color: #f0f0f0;
`;

const StatsGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 20px;
  margin-bottom: 32px;
`;

const StatCard = styled.div`
  background: #181818;
  border: 1px solid #2e2e2e;
  border-radius: 20px;
  padding: 24px;
  
  .label {
    font-size: 11px;
    font-weight: 700;
    color: #666;
    text-transform: uppercase;
    letter-spacing: 0.1em;
    margin-bottom: 8px;
  }
  .value {
    font-size: 32px;
    font-weight: 800;
    color: #f0f0f0;
  }
  .delta {
    font-size: 12px;
    margin-top: 8px;
    display: flex;
    align-items: center;
    gap: 4px;
    color: #10B981;
  }
`;

const Shelf = styled.div`
  margin-bottom: 40px;
`;

const ShelfTitle = styled.h2`
  font-size: 14px;
  font-weight: 700;
  color: #666;
  text-transform: uppercase;
  letter-spacing: 0.1em;
  margin-bottom: 16px;
  display: flex;
  align-items: center;
  gap: 8px;
`;

const ApprovalGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
  gap: 16px;
`;

const ApprovalCard = styled(motion.div)`
  background: #181818;
  border: 1px solid #2e2e2e;
  border-left: 4px solid #F59E0B;
  border-radius: 16px;
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 12px;
`;

const MainLayout = styled.div`
  display: grid;
  grid-template-columns: 2fr 1fr;
  gap: 24px;
  
  @media (max-width: 1024px) {
    grid-template-columns: 1fr;
  }
`;

const ListCard = styled.div`
  background: #181818;
  border: 1px solid #2e2e2e;
  border-radius: 24px;
  overflow: hidden;
`;

const SearchBar = styled.div`
  padding: 20px;
  border-bottom: 1px solid #2e2e2e;
  display: flex;
  gap: 16px;
  align-items: center;
  
  input {
    flex: 1;
    background: #0f0f0f;
    border: 1px solid #2e2e2e;
    padding: 12px 16px;
    border-radius: 12px;
    color: white;
    font-size: 14px;
    outline: none;
    &:focus { border-color: #10B981; }
  }
  
  select {
    background: #0f0f0f;
    border: 1px solid #2e2e2e;
    padding: 12px 16px;
    border-radius: 12px;
    color: #666;
    font-size: 14px;
    outline: none;
    cursor: pointer;
  }
`;

const RiskBadge = styled.span<{ $risk: 'high' | 'risk' | 'normal' | 'stable' }>`
  padding: 4px 10px;
  border-radius: 6px;
  font-size: 11px;
  font-weight: 700;
  text-transform: uppercase;
  background: ${props => {
    if (props.$risk === 'high') return 'rgba(239, 68, 68, 0.1)';
    if (props.$risk === 'risk') return 'rgba(245, 158, 11, 0.1)';
    if (props.$risk === 'normal') return 'rgba(16, 185, 129, 0.1)';
    return 'rgba(59, 130, 246, 0.1)';
  }};
  color: ${props => {
    if (props.$risk === 'high') return '#EF4444';
    if (props.$risk === 'risk') return '#F59E0B';
    if (props.$risk === 'normal') return '#10B981';
    return '#3B82F6';
  }};
  border: 1px solid ${props => {
    if (props.$risk === 'high') return 'rgba(239, 68, 68, 0.2)';
    if (props.$risk === 'risk') return 'rgba(245, 158, 11, 0.2)';
    if (props.$risk === 'normal') return 'rgba(16, 185, 129, 0.2)';
    return 'rgba(59, 130, 246, 0.2)';
  }};
`;

const PulseFeed = styled.div`
  background: #181818;
  border: 1px solid #2e2e2e;
  border-radius: 24px;
  padding: 24px;
  height: fit-content;
`;

const UserRow = styled(motion.div)`
  padding: 16px 20px;
  display: grid;
  grid-template-columns: 2fr 1fr 1fr 40px;
  align-items: center;
  border-bottom: 1px solid #222;
  transition: all 0.2s;
  cursor: pointer;
  &:hover { background: #1e1e1e; }
  &:last-child { border-bottom: none; }
`;

const SidePanel = styled(motion.div)`
  position: fixed;
  top: 0;
  right: 0;
  width: 450px;
  height: 100vh;
  background: #121212;
  border-left: 1px solid #333;
  box-shadow: -10px 0 30px rgba(0,0,0,0.5);
  z-index: 1000;
  display: flex;
  flex-direction: column;
  color: white;
  
  @media (max-width: 768px) {
    width: 100%;
  }
`;

const Overlay = styled(motion.div)`
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background: rgba(0,0,0,0.7);
  backdrop-filter: blur(4px);
  z-index: 999;
`;

const PanelHeader = styled.div`
  padding: 24px;
  border-bottom: 1px solid #222;
  background: #181818;
  
  .user-meta {
    margin-top: 12px;
    display: flex;
    align-items: center;
    gap: 8px;
    color: #666;
    font-size: 12px;
    font-weight: 600;
  }
`;

const PanelContent = styled.div`
  flex: 1;
  overflow-y: auto;
  padding: 24px;
  
  &::-webkit-scrollbar { width: 4px; }
  &::-webkit-scrollbar-thumb { background: #333; border-radius: 2px; }
`;

const ActionSection = styled.div`
  background: #181818;
  border: 1px solid #2e2e2e;
  border-radius: 16px;
  padding: 16px;
  margin-bottom: 24px;
  
  h3 {
    font-size: 11px;
    font-weight: 700;
    color: #666;
    text-transform: uppercase;
    letter-spacing: 0.1em;
    margin-bottom: 16px;
    display: flex;
    align-items: center;
    gap: 8px;
  }
`;

const HistoryItem = styled.div`
  padding: 12px 0;
  border-bottom: 1px solid #222;
  display: flex;
  justify-content: space-between;
  align-items: center;
  
  .desc { font-size: 13px; font-weight: 600; }
  .date { font-size: 10px; color: #444; margin-top: 2px; }
  .amount { font-weight: 800; font-size: 14px; }
`;

const ChartSection = styled.div`
  background: #181818;
  border: 1px solid #2e2e2e;
  border-radius: 24px;
  padding: 24px;
  margin-bottom: 32px;
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 24px;
  
  @media (max-width: 768px) {
    grid-template-columns: 1fr;
  }
`;

const ChartCard = styled.div`
  height: 200px;
  display: flex;
  flex-direction: column;
  
  h3 {
    font-size: 12px;
    font-weight: 700;
    color: #666;
    text-transform: uppercase;
    margin-bottom: 16px;
  }
`;

const FormInput = styled.input`
  background: #252525;
  border: 1px solid #333;
  border-radius: 12px;
  padding: 12px 16px;
  color: white;
  font-size: 14px;
  width: 100%;
  margin-bottom: 12px;
  outline: none;
  &:focus { border-color: #10B981; }
  &::placeholder { color: #555; }
`;

const FormTextarea = styled.textarea`
  background: #252525;
  border: 1px solid #333;
  border-radius: 12px;
  padding: 12px 16px;
  color: white;
  font-size: 14px;
  width: 100%;
  margin-bottom: 16px;
  outline: none;
  min-height: 80px;
  resize: none;
  &:focus { border-color: #10B981; }
  &::placeholder { color: #555; }
`;

const ActionBtn = styled.button<{ variant?: 'approve' | 'reject' }>`
  padding: 8px 16px;
  border-radius: 10px;
  font-size: 12px;
  font-weight: 700;
  display: flex;
  align-items: center;
  gap: 6px;
  cursor: pointer;
  transition: all 0.2s;
  
  background: ${props => props.variant === 'approve' ? '#10B981' : props.variant === 'reject' ? '#EF4444' : '#2e2e2e'};
  color: white;
  border: none;
  
  &:hover { opacity: 0.9; }
`;

export default function WalletPage() {
  const [users, setUsers] = useState<UserWallet[]>([]);
  const [pendingTxns, setPendingTxns] = useState<WalletTransaction[]>([]);
  const [pulse, setPulse] = useState<WalletTransaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [sortBy, setSortBy] = useState('risk');
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [userHistory, setUserHistory] = useState<WalletTransaction[]>([]);
  const [adjusting, setAdjusting] = useState(false);
  const [adjustAmount, setAdjustAmount] = useState<string>('');
  const [adjustReason, setAdjustReason] = useState<string>('');

  const selectedUser = useMemo(() => 
    users.find(u => u.id === selectedUserId), 
    [users, selectedUserId]
  );

  // Risk Logic
  const getRiskStatus = (balance: number) => {
    if (balance <= -200) return 'high';
    if (balance <= -140) return 'risk';
    if (balance <= 100) return 'normal';
    return 'stable';
  };

  useEffect(() => {
    // 1. Listen to Users
    const unsubUsers = onSnapshot(collection(db, 'users'), (snapshot) => {
      const formatted = snapshot.docs.map(doc => {
        const data = doc.data();
        const name = data.full_name || data.name || data.displayName || 
                    `${data.firstName || ''} ${data.lastName || ''}`.trim() || 'Anonymous';
        return {
          id: doc.id,
          name: name,
          phone: data.phone || data.phoneNumber || '',
          customerId: data.customerId || doc.id,
          wallet_balance: data.wallet_balance ?? data.walletBalance ?? 0,
          jars_occupied: data.jars_occupied ?? data.jarHold ?? 0
        };
      }) as UserWallet[];
      setUsers(formatted);
      setLoading(false);
    });

    // 2. Listen to Pending Approvals (> 1000)
    const qPending = query(
      collection(db, 'wallet_transactions'),
      where('status', '==', 'pending_approval'),
      orderBy('createdAt', 'desc')
    );
    const unsubPending = onSnapshot(qPending, (snap) => {
      setPendingTxns(snap.docs.map(d => ({ id: d.id, ...d.data() })) as WalletTransaction[]);
    });

    // 3. Listen to Pulse Feed (Completed Txns)
    const qPulse = query(
      collection(db, 'wallet_transactions'),
      where('status', '==', 'completed'),
      orderBy('createdAt', 'desc'),
      limit(15)
    );
    const unsubPulse = onSnapshot(qPulse, (snap) => {
      setPulse(snap.docs.map(d => ({ id: d.id, ...d.data() })) as WalletTransaction[]);
    });

    return () => { unsubUsers(); unsubPending(); unsubPulse(); };
  }, []);

  // Fetch User History on Selection
  useEffect(() => {
    if (!selectedUserId) return;
    const q = query(
      collection(db, 'wallet_transactions'),
      where('userId', '==', selectedUserId),
      orderBy('createdAt', 'desc'),
      limit(10)
    );
    return onSnapshot(q, (snap) => {
      setUserHistory(snap.docs.map(d => ({ id: d.id, ...d.data() })) as WalletTransaction[]);
    });
  }, [selectedUserId]);

  const stats = useMemo(() => {
    const liability = users.filter(u => u.wallet_balance > 0).reduce((acc, u) => acc + u.wallet_balance, 0);
    const trustCredit = users.filter(u => u.wallet_balance < 0).reduce((acc, u) => acc + Math.abs(u.wallet_balance), 0);
    return { liability, trustCredit, total: users.length };
  }, [users]);

  const handleAction = async (txn: WalletTransaction, action: 'approve' | 'reject') => {
    try {
      await runTransaction(db, async (transaction) => {
        const txnRef = doc(db, 'wallet_transactions', txn.id);
        const userRef = doc(db, 'users', txn.userId);
        
        if (action === 'approve') {
          const userSnap = await transaction.get(userRef);
          if (!userSnap.exists()) throw new Error("User not found");
          
          const currentBal = userSnap.data().wallet_balance ?? userSnap.data().walletBalance ?? 0;
          const nextBal = currentBal + txn.amount;
          
          transaction.update(userRef, { 
            wallet_balance: nextBal,
            walletBalance: nextBal,
            updatedAt: Timestamp.now()
          });
          transaction.update(txnRef, { status: 'completed' });
        } else {
          transaction.update(txnRef, { status: 'rejected' });
        }
      });
      alert(`Top-up ${action} successfully.`);
    } catch (err) {
      console.error(err);
      alert("Action failed.");
    }
  };

  const filteredUsers = useMemo(() => {
    return users.filter(u => 
      u.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
      u.phone.includes(searchTerm) ||
      u.customerId.toLowerCase().includes(searchTerm.toLowerCase())
    ).sort((a, b) => {
      if (sortBy === 'balance_low') return a.wallet_balance - b.wallet_balance;
      if (sortBy === 'balance_high') return b.wallet_balance - a.wallet_balance;
      if (sortBy === 'risk') {
        const riskOrder = { high: 0, risk: 1, normal: 2, stable: 3 };
        return riskOrder[getRiskStatus(a.wallet_balance)] - riskOrder[getRiskStatus(b.wallet_balance)];
      }
      return a.name.localeCompare(b.name);
    });
  }, [users, searchTerm, sortBy]);

  const handleManualAdjust = async (type: 'balance' | 'jars', rawDelta: number) => {
    if (!selectedUser || adjusting) return;
    
    let delta = rawDelta;
    let reason = '';

    if (type === 'balance') {
      const parsed = parseFloat(adjustAmount);
      if (isNaN(parsed) || parsed <= 0) {
        alert("Please enter a valid amount");
        return;
      }
      delta = rawDelta > 0 ? parsed : -parsed;
      reason = adjustReason.trim() || 'Manual Adjustment';
    } else {
      // For jars, we still use the button delta but we could expand this later
      reason = prompt(`Enter reason for jar adjustment:`) || 'Manual Jar Adjustment';
    }

    setAdjusting(true);
    try {
      await runTransaction(db, async (transaction) => {
        const userRef = doc(db, 'users', selectedUser.id);
        const userSnap = await transaction.get(userRef);
        if (!userSnap.exists()) throw new Error("User dead");

        if (type === 'balance') {
          const current = userSnap.data().wallet_balance ?? 0;
          const next = current + delta;
          transaction.update(userRef, { 
            wallet_balance: next, 
            walletBalance: next,
            updatedAt: Timestamp.now() 
          });
          
          const txnRef = doc(collection(db, 'wallet_transactions'));
          transaction.set(txnRef, {
            userId: selectedUser.id,
            amount: delta,
            type: 'ADMIN_ADJUSTMENT',
            description: `Manual adjustment: ${reason}`,
            createdAt: Timestamp.now(),
            status: 'completed'
          });
        } else {
          const current = userSnap.data().jars_occupied ?? userSnap.data().jarHold ?? 0;
          const next = Math.max(0, current + delta);
          transaction.update(userRef, { 
            jars_occupied: next,
            jarHold: next,
            updatedAt: Timestamp.now() 
          });
        }
      });
      // Reset inputs only on success
      if (type === 'balance') {
        setAdjustAmount('');
        setAdjustReason('');
      }
    } catch (err) {
      console.error(err);
      alert("Adjustment failed");
    } finally {
      setAdjusting(false);
    }
  };

  const chartData = useMemo(() => [
    { name: 'Liability', value: stats.liability, color: '#10B981' },
    { name: 'Extended Credit', value: stats.trustCredit, color: '#F59E0B' }
  ], [stats]);

  const riskData = useMemo(() => {
    const counts = { high: 0, risk: 0, normal: 0, stable: 0 };
    users.forEach(u => counts[getRiskStatus(u.wallet_balance)]++);
    return Object.entries(counts).map(([name, value]) => ({ name, value }));
  }, [users]);

  if (loading) return <PageContainer>Loading Capital Command...</PageContainer>;

  return (
    <PageContainer>
      <Container>
        <Title><FiDollarSign color="#10B981" /> Financial Pulse</Title>

        <StatsGrid>
          <StatCard>
            <div className="label">Wallet Liability</div>
            <div className="value">₹{stats.liability.toLocaleString()}</div>
            <div className="delta">Owed to customers</div>
          </StatCard>
          <StatCard>
            <div className="label">Trust Credit Extended</div>
            <div className="value" style={{ color: '#F59E0B' }}>₹{stats.trustCredit.toLocaleString()}</div>
            <div className="delta" style={{ color: '#666' }}>Owed by customers</div>
          </StatCard>
          <StatCard>
            <div className="label">Operating Delta</div>
            <div className="value">₹{(stats.liability - stats.trustCredit).toLocaleString()}</div>
            <div className="delta"><FiActivity /> Net Liquidity</div>
          </StatCard>
        </StatsGrid>

        <ChartSection>
          <ChartCard>
            <h3>Capital Composition</h3>
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={chartData}
                  innerRadius={60}
                  outerRadius={80}
                  paddingAngle={5}
                  dataKey="value"
                >
                  {chartData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <RechartsTooltip 
                  contentStyle={{ background: '#181818', border: '1px solid #333', borderRadius: '8px' }}
                  itemStyle={{ color: '#fff' }}
                />
              </PieChart>
            </ResponsiveContainer>
          </ChartCard>
          <ChartCard>
            <h3>Risk Distribution</h3>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={riskData}>
                <XAxis dataKey="name" hide />
                <YAxis hide />
                <RechartsTooltip 
                  contentStyle={{ background: '#181818', border: '1px solid #333', borderRadius: '8px' }}
                />
                <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                  {riskData.map((entry, index) => (
                    <Cell 
                      key={`cell-${index}`} 
                      fill={entry.name === 'high' ? '#EF4444' : entry.name === 'risk' ? '#F59E0B' : '#10B981'} 
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </ChartCard>
        </ChartSection>

        <AnimatePresence>
          {pendingTxns.length > 0 && (
            <Shelf>
              <ShelfTitle><FiAlertTriangle color="#F59E0B" /> High Value Approvals (&#62;1000)</ShelfTitle>
              <ApprovalGrid>
                {pendingTxns.map(txn => (
                  <ApprovalCard key={txn.id} initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <div style={{ fontWeight: 700, fontSize: '18px' }}>₹{txn.amount}</div>
                      <div style={{ fontSize: '11px', color: '#666' }}>Pending Verification</div>
                    </div>
                    <div style={{ fontSize: '13px', color: '#888' }}>
                      User: {users.find(u => u.id === txn.userId)?.name || txn.userId.slice(0,8)}
                    </div>
                    <div style={{ display: 'flex', gap: '8px', marginTop: '4px' }}>
                      <ActionBtn variant="approve" onClick={() => handleAction(txn, 'approve')}><FiCheck /> Approve</ActionBtn>
                      <ActionBtn variant="reject" onClick={() => handleAction(txn, 'reject')}><FiXCircle /> Reject</ActionBtn>
                    </div>
                  </ApprovalCard>
                ))}
              </ApprovalGrid>
            </Shelf>
          )}
        </AnimatePresence>

        <MainLayout>
          <ListCard>
            <SearchBar>
              <FiSearch color="#444" />
              <input 
                placeholder="Search name or phone..." 
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
              />
              <select value={sortBy} onChange={e => setSortBy(e.target.value)}>
                <option value="risk">Sort: Risk Level</option>
                <option value="name">Sort: A-Z</option>
                <option value="balance_low">Sort: Highest Debt</option>
                <option value="balance_high">Sort: Highest Balance</option>
              </select>
            </SearchBar>

            <div style={{ padding: '10px 20px', color: '#666', fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 40px' }}>
              <div>Customer</div>
              <div>Standing</div>
              <div>Wallet</div>
              <div></div>
            </div>

            {filteredUsers.map(u => (
              <UserRow 
                key={u.id} 
                onClick={() => setSelectedUserId(u.id)}
                whileHover={{ x: 4 }}
              >
                <div>
                  <div style={{ fontWeight: 700 }}>{u.name}</div>
                  <div style={{ fontSize: '12px', color: '#666' }}>
                    <span style={{ color: '#10B981', fontWeight: 700 }}>[ {u.customerId} ]</span> • {u.phone}
                  </div>
                </div>
                <div>
                  <RiskBadge $risk={getRiskStatus(u.wallet_balance)}>
                    {getRiskStatus(u.wallet_balance)}
                  </RiskBadge>
                </div>
                <div style={{ fontWeight: 800, color: u.wallet_balance < 0 ? '#EF4444' : '#10B981' }}>
                  ₹{u.wallet_balance.toFixed(2)}
                </div>
                <div style={{ color: '#444' }}><FiArrowRight /></div>
              </UserRow>
            ))}
          </ListCard>

          <PulseFeed>
            <ShelfTitle><FiActivity color="#10B981" /> Global Pulse</ShelfTitle>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {pulse.map(txn => {
                const txnUser = users.find(u => u.id === txn.userId);
                return (
                  <div key={txn.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '13px' }}>
                    <div>
                      <div style={{ fontWeight: 600 }}>{txnUser?.name || 'Anonymous'}</div>
                      <div style={{ fontSize: '10px', color: '#444' }}>{txn.description} • {txn.createdAt?.toDate?.() ? txn.createdAt.toDate().toLocaleTimeString() : 'Just now'}</div>
                    </div>
                    <div style={{ fontWeight: 700, color: txn.amount > 0 ? '#10B981' : '#EF4444' }}>
                      {txn.amount > 0 ? '+' : ''}₹{txn.amount}
                    </div>
                  </div>
                );
              })}
            </div>
          </PulseFeed>
        </MainLayout>
      </Container>

      <AnimatePresence>
        {selectedUserId && selectedUser && (
          <>
            <Overlay 
              initial={{ opacity: 0 }} 
              animate={{ opacity: 1 }} 
              exit={{ opacity: 0 }} 
              onClick={() => setSelectedUserId(null)} 
            />
            <SidePanel
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
            >
              <PanelHeader>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div>
                    <h2 style={{ fontSize: '24px', fontWeight: 800 }}>{selectedUser.name}</h2>
                    <div className="user-meta">
                      <FiUser /> <span style={{ color: '#10B981' }}>[ {selectedUser.customerId} ]</span>
                    </div>
                  </div>
                  <ActionBtn onClick={() => setSelectedUserId(null)}><FiXCircle size={18} /></ActionBtn>
                </div>
              </PanelHeader>

              <PanelContent>
                <ActionSection>
                  <h3><FiDollarSign /> Wallet Command</h3>
                  <div style={{ marginBottom: '20px' }}>
                    <div style={{ fontSize: '28px', fontWeight: 800, color: selectedUser.wallet_balance < 0 ? '#EF4444' : '#10B981' }}>
                      ₹{selectedUser.wallet_balance.toFixed(2)}
                    </div>
                    <div style={{ fontSize: '10px', color: '#666', fontWeight: 700, textTransform: 'uppercase' }}>Current Liquidity</div>
                  </div>

                  <div style={{ background: '#222', padding: '16px', borderRadius: '12px' }}>
                    <div style={{ display: 'flex', gap: '8px', marginBottom: '12px' }}>
                      <div style={{ position: 'relative', flex: 1 }}>
                        <span style={{ position: 'absolute', left: '12px', top: '12px', color: '#666' }}>₹</span>
                        <FormInput 
                          style={{ paddingLeft: '28px', marginBottom: 0 }}
                          placeholder="Amount" 
                          type="number"
                          value={adjustAmount}
                          onChange={(e) => setAdjustAmount(e.target.value)}
                        />
                      </div>
                    </div>
                    
                    <FormTextarea 
                      placeholder="Reason for adjustment..." 
                      value={adjustReason}
                      onChange={(e) => setAdjustReason(e.target.value)}
                    />

                    <div style={{ display: 'flex', gap: '8px' }}>
                      <ActionBtn 
                        variant="approve" 
                        style={{ flex: 1 }}
                        disabled={adjusting || !adjustAmount}
                        onClick={() => handleManualAdjust('balance', 1)}
                      >
                        <FiPlus /> Add
                      </ActionBtn>
                      <ActionBtn 
                        variant="reject" 
                        style={{ flex: 1 }}
                        disabled={adjusting || !adjustAmount}
                        onClick={() => handleManualAdjust('balance', -1)}
                      >
                        <FiMinus /> Deduct
                      </ActionBtn>
                    </div>
                  </div>
                </ActionSection>

                <ActionSection>
                  <h3><FiPackage /> Inventory Control</h3>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <div style={{ fontSize: '28px', fontWeight: 800, color: '#3B82F6' }}>
                        {selectedUser.jars_occupied || 0}
                      </div>
                      <div style={{ fontSize: '10px', color: '#666', fontWeight: 700, textTransform: 'uppercase' }}>Empty Jars Held</div>
                    </div>
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <ActionBtn onClick={() => handleManualAdjust('jars', 1)}><FiPlus /></ActionBtn>
                      <ActionBtn onClick={() => handleManualAdjust('jars', -1)}><FiMinus /></ActionBtn>
                    </div>
                  </div>
                </ActionSection>

                <div style={{ marginTop: '32px' }}>
                  <h3 style={{ fontSize: '11px', fontWeight: 700, color: '#666', textTransform: 'uppercase', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <FiClock /> Audit Trail
                  </h3>
                  {userHistory.length === 0 && <div style={{ color: '#444', fontSize: '13px' }}>No recent transactions</div>}
                  {userHistory.map(txn => (
                    <HistoryItem key={txn.id}>
                      <div>
                        <div className="desc">{txn.description}</div>
                        <div className="date">{txn.createdAt?.toDate?.() ? txn.createdAt.toDate().toLocaleString() : 'Just now'}</div>
                      </div>
                      <div className="amount" style={{ color: txn.amount > 0 ? '#10B981' : '#EF4444' }}>
                        {txn.amount > 0 ? '+' : ''}₹{txn.amount}
                      </div>
                    </HistoryItem>
                  ))}
                </div>
              </PanelContent>
            </SidePanel>
          </>
        )}
      </AnimatePresence>
    </PageContainer>
  );
}
