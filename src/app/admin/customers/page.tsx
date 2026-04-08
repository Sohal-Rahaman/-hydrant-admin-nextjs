'use client';

import React, { useState, useEffect } from 'react';
import styled from 'styled-components';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  FiUsers, 
  FiSearch, 
  FiCreditCard, 
  FiMapPin, 
  FiArrowUpRight, 
  FiArrowDownLeft,
  FiMoreVertical,
  FiUserPlus,
  FiCheckCircle,
  FiAlertCircle,
  FiTrash2
} from 'react-icons/fi';
import { 
  collection, 
  query, 
  orderBy, 
  onSnapshot,
  doc,
  updateDoc,
  increment,
  arrayUnion,
  where
} from 'firebase/firestore';
import { db, deleteDocument } from '@/lib/firebase';

interface UserData {
  id: string;
  name?: string;
  email?: string;
  phone?: string;
  walletBalance?: number;
  wallet_balance?: number;
  deliveryAddresses?: any[];
  isPremium?: boolean;
  createdAt: any;
}

interface WalletTransaction {
  id: string;
  amount: number;
  type: string;
  description: string;
  createdAt: any;
  status: string;
}

interface LeadData {
  id: string;
  phone: string;
  converted: boolean;
  createdAt: any;
}

const Container = styled.div`
  max-width: 1400px;
  margin: 0 auto;
  padding: 24px;
`;

const TopBar = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 32px;
`;

const Title = styled.h1`
  font-size: 24px;
  font-weight: 800;
  color: #f0f0f0;
  display: flex;
  align-items: center;
  gap: 12px;
`;

const StatsGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 20px;
  margin-bottom: 32px;

  @media (max-width: 768px) {
    grid-template-columns: 1fr;
  }
`;

const StatCard = styled.div`
  background: #181818;
  border: 1px solid #2e2e2e;
  border-radius: 20px;
  padding: 24px;
  
  .label {
    font-size: 11px;
    font-weight: 600;
    color: #666;
    text-transform: uppercase;
    letter-spacing: 0.1em;
    margin-bottom: 8px;
  }
  .value {
    font-size: 28px;
    font-weight: 700;
    color: #f0f0f0;
  }
`;

const MainContent = styled.div`
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
  border-radius: 20px;
  overflow: hidden;
`;

const SearchBox = styled.div`
  padding: 20px;
  border-bottom: 1px solid #2e2e2e;
  position: relative;

  input {
    width: 100%;
    padding: 14px 16px 14px 48px;
    background: #0f0f0f;
    border: 1px solid #2e2e2e;
    border-radius: 12px;
    color: #f0f0f0;
    font-size: 14px;
    outline: none;
    transition: all 0.2s;
    
    &:focus {
      border-color: #10B981;
      box-shadow: 0 0 0 4px rgba(16, 185, 129, 0.1);
    }
  }

  svg {
    position: absolute;
    left: 36px;
    top: 50%;
    transform: translateY(-50%);
    color: #666;
  }
`;

const UserItem = styled.div`
  padding: 16px 20px;
  border-bottom: 1px solid #2e2e2e;
  display: flex;
  justify-content: space-between;
  align-items: center;
  cursor: pointer;
  transition: all 0.2s;

  &:hover {
    background: #222;
  }

  &.active {
    background: #222;
    border-left: 4px solid #10B981;
  }
`;

const DetailCard = styled.div`
  background: #181818;
  border: 1px solid #2e2e2e;
  border-radius: 24px;
  padding: 32px;
  position: sticky;
  top: 24px;
`;

const Avatar = styled.div<{ size?: string; $bg?: string }>`
  width: ${props => props.size || '48px'};
  height: ${props => props.size || '48px'};
  border-radius: ${props => props.size ? '16px' : '12px'};
  background: ${props => props.$bg || '#10B981'};
  color: white;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 800;
  font-size: ${props => props.size ? '24px' : '18px'};
  box-shadow: 0 8px 16px rgba(16, 185, 129, 0.2);
`;

const WalletPill = styled.div`
  background: rgba(16, 185, 129, 0.1);
  border: 1px solid rgba(16, 185, 129, 0.2);
  color: #10B981;
  padding: 4px 12px;
  border-radius: 20px;
  font-family: 'DM Mono', monospace;
  font-weight: 700;
  font-size: 13px;
`;

const InfoRow = styled.div`
  padding: 16px;
  background: #222;
  border-radius: 16px;
  display: flex;
  align-items: center;
  gap: 16px;
  margin-bottom: 12px;

  svg {
    color: #10B981;
  }

  .label {
    font-size: 10px;
    font-weight: 700;
    color: #666;
    text-transform: uppercase;
    letter-spacing: 0.1em;
  }

  .value {
    font-size: 14px;
    color: #f0f0f0;
    font-weight: 500;
  }
`;

const ActionButton = styled.button<{ variant?: 'primary' | 'danger' | 'ghost' }>`
  width: 100%;
  padding: 14px;
  border-radius: 14px;
  font-weight: 700;
  font-size: 14px;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  cursor: pointer;
  transition: all 0.2s;
  border: none;

  ${props => {
    switch (props.variant) {
      case 'primary': return `background: #10B981; color: white; &:hover { background: #059669; }`;
      case 'danger': return `background: rgba(239, 68, 68, 0.1); color: #EF4444; border: 1px solid rgba(239, 68, 68, 0.2); &:hover { background: #EF4444; color: white; }`;
      default: return `background: transparent; color: #666; border: 1px solid #2e2e2e; &:hover { background: #222; }`;
    }
  }}
`;

const InputField = styled.input`
  width: 100%;
  padding: 14px;
  background: #222;
  border: 1px solid #2e2e2e;
  border-radius: 12px;
  color: #f0f0f0;
  font-size: 14px;
  outline: none;
  
  &:focus {
    border-color: #10B981;
  }
`;

export default function CustomersPage() {
  const [users, setUsers] = useState<UserData[]>([]);
  const [leads, setLeads] = useState<LeadData[]>([]);
  const [selectedUser, setSelectedUser] = useState<UserData | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [transactions, setTransactions] = useState<WalletTransaction[]>([]);
  const [transactionsLoading, setTransactionsLoading] = useState(false);
  const [adjustmentAmount, setAdjustmentAmount] = useState('');
  const [adjustmentReason, setAdjustmentReason] = useState('');

  useEffect(() => {
    setLoading(true);
    // Fixed: Ensure users are sorted by newest first
    const qUsers = query(collection(db, 'users'), orderBy('createdAt', 'desc'));
    const qLeads = query(collection(db, 'leads'));

    const unsubUsers = onSnapshot(qUsers, (snapshot) => {
      const usersData = snapshot.docs.map(doc => {
        const d = doc.data();
        return {
          id: doc.id,
          ...d,
          wallet_balance: d.wallet_balance ?? d.walletBalance ?? 0,
          jars_occupied: d.jars_occupied ?? d.jarHold ?? 0,
        };
      }) as unknown as UserData[];
      setUsers(usersData);
      setLoading(false);
    });

    const unsubLeads = onSnapshot(qLeads, (snapshot) => {
      const leadsData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as LeadData[];
      setLeads(leadsData);
    });

    return () => { unsubUsers(); unsubLeads(); };
  }, []);

  useEffect(() => {
    if (!selectedUser) {
      setTransactions([]);
      return;
    }

    setTransactionsLoading(true);
    const q = query(
      collection(db, 'wallet_transactions'),
      where('userId', '==', selectedUser.id),
      orderBy('createdAt', 'desc')
    );

    const unsubTxns = onSnapshot(q, (snapshot) => {
      const txns = snapshot.docs.map(doc => ({ 
        id: doc.id, 
        ...doc.data() 
      })) as WalletTransaction[];
      setTransactions(txns);
      setTransactionsLoading(false);
    });

    return () => unsubTxns();
  }, [selectedUser?.id]);

  const filteredUsers = users.filter(u => 
    u.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    u.phone?.includes(searchQuery) ||
    u.id.includes(searchQuery)
  );

  const handleAdjustWallet = async (type: 'add' | 'remove') => {
    if (!selectedUser || !adjustmentAmount) return;
    const amount = parseFloat(adjustmentAmount);
    if (isNaN(amount)) return;
    if (!adjustmentReason.trim()) {
      alert('Please provide a reason for this adjustment.');
      return;
    }

    const change = type === 'add' ? amount : -amount;

    try {
      const { runWalletTransaction } = await import('@/lib/wallet');
      await runWalletTransaction({
        userId: selectedUser.id,
        amount: change,
        type: 'ADMIN_ADJUSTMENT',
        description: adjustmentReason,
        createdBy: 'admin' 
      });

      setAdjustmentAmount('');
      setAdjustmentReason('');
      alert('Wallet adjustment recorded in ledger.');
    } catch (err) {
      console.error(err);
      alert('Failed to adjust wallet');
    }
  };

  const handleDeleteUser = async () => {
    if (!selectedUser) return;
    
    const confirm1 = window.confirm(`DANGER: Are you sure you want to PERMANENTLY delete ${selectedUser.name || 'this user'}? This cannot be undone.`);
    if (!confirm1) return;
    
    const confirm2 = window.prompt(`Type DELETE to confirm permanent removal of user ${selectedUser.id}:`);
    if (confirm2 !== 'DELETE') {
      alert('Delete cancelled. Confirmation text did not match.');
      return;
    }

    try {
      await deleteDocument('users', selectedUser.id);
      setSelectedUser(null);
      alert('User deleted permanently.');
    } catch (err) {
      console.error(err);
      alert('Error deleting user. Check permissions.');
    }
  };

  const conversionRate = leads.length > 0 
    ? ((leads.filter(l => l.converted).length / leads.length) * 100).toFixed(1)
    : 0;

  if (loading) return (
    <div style={{ background: '#0f0f0f', minHeight: '100vh', padding: '40px', color: '#666', textAlign: 'center' }}>
      Loading Emerald CRM...
    </div>
  );

  return (
    <div style={{ background: '#0f0f0f', minHeight: '100vh', color: '#f0f0f0' }}>
      <Container>
        <TopBar>
          <Title><FiUsers /> CRM Control Center</Title>
        </TopBar>

        <StatsGrid>
          <StatCard>
            <div className="label">Total Registered</div>
            <div className="value">{users.length}</div>
          </StatCard>
          <StatCard>
            <div className="label">Total Conversion</div>
            <div className="value">{conversionRate}%</div>
          </StatCard>
          <StatCard>
            <div className="label">Active Leads</div>
            <div className="value">{leads.length}</div>
          </StatCard>
        </StatsGrid>

        <MainContent>
          <ListCard>
            <SearchBox>
              <FiSearch />
              <input 
                placeholder="Search name, phone or ID..." 
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </SearchBox>
            <div style={{ overflowY: 'auto', maxHeight: '700px' }}>
              {filteredUsers.map(user => (
                <UserItem 
                  key={user.id} 
                  className={selectedUser?.id === user.id ? 'active' : ''}
                  onClick={() => setSelectedUser(user)}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                    <Avatar $bg={user.isPremium ? '#F59E0B' : '#10B981'}>
                      {user.name?.[0]?.toUpperCase() || 'U'}
                    </Avatar>
                    <div>
                      <div style={{ fontWeight: 700, fontSize: '15px' }}>{user.name || 'Guest User'}</div>
                      <div style={{ fontSize: '12px', color: '#666' }}>{user.phone || user.id.slice(0, 12)}</div>
                    </div>
                  </div>
                  <WalletPill>₹{user.walletBalance || 0}</WalletPill>
                </UserItem>
              ))}
            </div>
          </ListCard>

          <div>
            {selectedUser ? (
              <DetailCard>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '32px' }}>
                  <Avatar size="64px" $bg={selectedUser.isPremium ? '#F59E0B' : '#10B981'}>
                    {selectedUser.name?.[0]?.toUpperCase() || 'U'}
                  </Avatar>
                  <div style={{ color: '#666' }}>
                    <FiMoreVertical size={24} />
                  </div>
                </div>

                <h2 style={{ fontSize: '24px', fontWeight: 800, marginBottom: '4px' }}>{selectedUser.name || 'Anonymous User'}</h2>
                <p style={{ fontSize: '13px', color: '#666', marginBottom: '32px', fontFamily: 'DM Mono' }}>#{selectedUser.id}</p>

                <InfoRow>
                  <FiCreditCard size={20} />
                  <div>
                    <div className="label">Wallet Standing</div>
                    <div className="value">₹{selectedUser.walletBalance || 0}</div>
                  </div>
                </InfoRow>

                <InfoRow>
                  <FiMapPin size={20} />
                  <div style={{ flex: 1 }}>
                    <div className="label">Primary HQ</div>
                    <div className="value" style={{ fontSize: '12px' }}>{selectedUser.deliveryAddresses?.[0]?.address || 'No location saved'}</div>
                  </div>
                </InfoRow>

                <div style={{ marginTop: '32px', borderTop: '1px solid #2e2e2e', paddingTop: '32px' }}>
                  <div style={{ fontSize: '11px', fontWeight: 700, color: '#666', textTransform: 'uppercase', marginBottom: '20px' }}>Recent Transactions</div>
                  
                  {transactionsLoading ? (
                    <div style={{ padding: '20px', textAlign: 'center', color: '#444', fontSize: '12px' }}>Loading passbook...</div>
                  ) : transactions.length > 0 ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', maxHeight: '300px', overflowY: 'auto', marginBottom: '32px' }}>
                      {transactions.map(txn => (
                        <div key={txn.id} style={{ 
                          background: '#121212', 
                          padding: '12px', 
                          borderRadius: '12px', 
                          border: '1px solid #222',
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center'
                        }}>
                          <div>
                            <div style={{ fontSize: '12px', fontWeight: 600 }}>{txn.description}</div>
                            <div style={{ fontSize: '10px', color: '#555' }}>
                              {txn.createdAt?.toDate?.() ? txn.createdAt.toDate().toLocaleDateString() : 'Recent'} • {txn.type}
                            </div>
                          </div>
                          <div style={{ 
                            fontWeight: 700, 
                            color: txn.amount > 0 ? '#10B981' : '#EF4444',
                            fontSize: '14px'
                          }}>
                            {txn.amount > 0 ? '+' : ''}₹{txn.amount}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div style={{ padding: '20px', textAlign: 'center', color: '#444', fontSize: '12px', marginBottom: '32px' }}>No transaction history found.</div>
                  )}

                  <div style={{ borderTop: '1px solid #2e2e2e', paddingTop: '32px' }}>
                    <div style={{ fontSize: '11px', fontWeight: 700, color: '#666', textTransform: 'uppercase', marginBottom: '12px' }}>Manual Adjustment</div>
                    <InputField 
                      type="number" 
                      placeholder="Amount..." 
                      value={adjustmentAmount}
                      onChange={(e) => setAdjustmentAmount(e.target.value)}
                      style={{ marginBottom: '12px' }}
                    />
                    <InputField 
                      placeholder="Reason for adjustment..." 
                      value={adjustmentReason}
                      onChange={(e) => setAdjustmentReason(e.target.value)}
                    />
                  </div>
                  <div style={{ display: 'flex', gap: '12px', marginTop: '12px', marginBottom: '12px' }}>
                    <ActionButton variant="primary" onClick={() => handleAdjustWallet('add')}>
                      <FiArrowUpRight /> Deposit
                    </ActionButton>
                    <ActionButton variant="ghost" onClick={() => handleAdjustWallet('remove')}>
                      <FiArrowDownLeft /> Deduct
                    </ActionButton>
                  </div>
                  
                  <ActionButton variant="danger" onClick={handleDeleteUser} style={{ marginTop: '12px' }}>
                    <FiAlertCircle /> Permanent Delete
                  </ActionButton>
                </div>
              </DetailCard>
            ) : (
              <div style={{ 
                height: '500px', 
                display: 'flex', 
                flexDirection: 'column', 
                alignItems: 'center', 
                justifyContent: 'center', 
                border: '2px dashed #2e2e2e', 
                borderRadius: '32px',
                color: '#666',
                padding: '40px',
                textAlign: 'center'
              }}>
                <FiUsers size={48} style={{ marginBottom: '24px', opacity: 0.2 }} />
                <p style={{ fontWeight: 600 }}>Select a customer to view operational details and manage assets.</p>
              </div>
            )}
          </div>
        </MainContent>
      </Container>
    </div>
  );
}
