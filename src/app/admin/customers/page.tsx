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
  FiAlertCircle
} from 'react-icons/fi';
import { 
  collection, 
  query, 
  orderBy, 
  onSnapshot,
  doc,
  updateDoc,
  increment,
  arrayUnion
} from 'firebase/firestore';
import { db } from '@/lib/firebase';

interface UserData {
  id: string;
  name?: string;
  email?: string;
  phone?: string;
  walletBalance?: number;
  deliveryAddresses?: any[];
  isPremium?: boolean;
  createdAt: any;
  walletHistory?: any[];
}

interface LeadData {
  id: string;
  phone: string;
  converted: boolean;
  createdAt: any;
}

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
  grid-template-columns: repeat(3, 1fr);
  gap: 24px;
  margin-bottom: 32px;
`;

const StatCard = styled.div<{ variant?: 'primary' | 'success' | 'warning' }>`
  background: white;
  border-radius: 20px;
  padding: 24px;
  border: 1px solid #f3f4f6;
  box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05);

  .label {
    font-size: 12px;
    font-weight: 700;
    color: #9ca3af;
    text-transform: uppercase;
    letter-spacing: 0.1em;
    margin-bottom: 8px;
  }
  .value {
    font-size: 28px;
    font-weight: 800;
    color: #1f2937;
  }
`;

const MainContent = styled.div`
  display: grid;
  grid-template-columns: 2fr 1fr;
  gap: 24px;
`;

const ListCard = styled.div`
  background: white;
  border-radius: 20px;
  border: 1px solid #f3f4f6;
  box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05);
  overflow: hidden;
`;

const SearchBox = styled.div`
  padding: 20px;
  border-bottom: 1px solid #f3f4f6;
  position: relative;

  input {
    width: 100%;
    padding: 12px 16px 12px 44px;
    background: #f9fafb;
    border: 1px solid #e5e7eb;
    border-radius: 12px;
    outline: none;
    font-size: 14px;
    
    &:focus {
      border-color: #4a00e0;
      background: white;
    }
  }

  svg {
    position: absolute;
    left: 36px;
    top: 50%;
    transform: translateY(-50%);
    color: #9ca3af;
  }
`;

const UserItem = styled.div`
  padding: 16px 20px;
  border-bottom: 1px solid #f3f4f6;
  display: flex;
  justify-content: space-between;
  align-items: center;
  cursor: pointer;
  transition: all 0.2s;

  &:hover {
    background: #f9fafb;
  }

  &.active {
    background: #f3e8ff;
    border-left: 4px solid #4a00e0;
  }
`;

const DetailCard = styled.div`
  background: white;
  border-radius: 20px;
  border: 1px solid #f3f4f6;
  padding: 24px;
  position: sticky;
  top: 24px;
`;

export default function CustomersPage() {
  const [users, setUsers] = useState<UserData[]>([]);
  const [leads, setLeads] = useState<LeadData[]>([]);
  const [selectedUser, setSelectedUser] = useState<UserData | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [adjustmentAmount, setAdjustmentAmount] = useState('');

  useEffect(() => {
    setLoading(true);
    const qUsers = query(collection(db, 'users'), orderBy('createdAt', 'desc'));
    const qLeads = query(collection(db, 'leads'));

    const unsubUsers = onSnapshot(qUsers, (snapshot) => {
      const usersData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as UserData[];
      setUsers(usersData);
      setLoading(false);
    });

    const unsubLeads = onSnapshot(qLeads, (snapshot) => {
      const leadsData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as LeadData[];
      setLeads(leadsData);
    });

    return () => { unsubUsers(); unsubLeads(); };
  }, []);

  const filteredUsers = users.filter(u => 
    u.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    u.phone?.includes(searchQuery) ||
    u.id.includes(searchQuery)
  );

  const handleAdjustWallet = async (type: 'add' | 'remove') => {
    if (!selectedUser || !adjustmentAmount) return;
    const amount = parseFloat(adjustmentAmount);
    if (isNaN(amount)) return;

    const userRef = doc(db, 'users', selectedUser.id);
    const change = type === 'add' ? amount : -amount;

    await updateDoc(userRef, {
      walletBalance: increment(change),
      walletHistory: arrayUnion({
        type: 'admin_adjustment',
        amount: change,
        timestamp: new Date(),
        reason: 'Manual adjustment by Admin'
      })
    });

    setAdjustmentAmount('');
    alert(`Wallet adjusted successfully!`);
  };

  const conversionRate = leads.length > 0 
    ? ((leads.filter(l => l.converted).length / leads.length) * 100).toFixed(1)
    : 0;

  if (loading) return <div className="p-10 text-center font-bold">Loading CRM...</div>;

  return (
    <PageContainer>
      <Header>
        <Title><FiUsers /> Customer Management</Title>
      </Header>

      <StatsGrid>
        <StatCard>
          <div className="label">Total Registered</div>
          <div className="value">{users.length}</div>
        </StatCard>
        <StatCard>
          <div className="label">Total Leads</div>
          <div className="value">{leads.length}</div>
        </StatCard>
        <StatCard>
          <div className="label">Conversion Rate</div>
          <div className="value">{conversionRate}%</div>
        </StatCard>
      </StatsGrid>

      <MainContent>
        <ListCard>
          <SearchBox>
            <FiSearch />
            <input 
              placeholder="Search by name, phone or ID..." 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </SearchBox>
          <div className="overflow-y-auto max-h-[600px]">
            {filteredUsers.map(user => (
              <UserItem 
                key={user.id} 
                className={selectedUser?.id === user.id ? 'active' : ''}
                onClick={() => setSelectedUser(user)}
              >
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-full bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold">
                    {user.name?.[0]?.toUpperCase() || 'U'}
                  </div>
                  <div>
                    <div className="font-bold text-gray-800">{user.name || 'Anonymous'}</div>
                    <div className="text-xs text-gray-500">{user.phone}</div>
                  </div>
                </div>
                <div className="text-right">
                  <div className="font-mono font-bold text-indigo-600">₹{user.walletBalance || 0}</div>
                  <div className={user.isPremium ? "text-[10px] font-bold text-amber-500 uppercase" : "hidden"}>Premium</div>
                </div>
              </UserItem>
            ))}
          </div>
        </ListCard>

        <div>
          {selectedUser ? (
            <DetailCard>
              <div className="flex justify-between items-start mb-6">
                <div className="w-16 h-16 rounded-2xl bg-indigo-600 text-white flex items-center justify-center text-3xl font-extrabold shadow-lg shadow-indigo-100">
                  {selectedUser.name?.[0]?.toUpperCase() || 'U'}
                </div>
                <div className="p-2 hover:bg-gray-100 rounded-xl cursor-not-allowed text-gray-400">
                  <FiMoreVertical />
                </div>
              </div>

              <h2 className="text-xl font-extrabold text-gray-800 mb-1">{selectedUser.name || 'User Profile'}</h2>
              <p className="text-sm text-gray-500 mb-6">User ID: <span className="font-mono">#{selectedUser.id.slice(0,10)}</span></p>

              <div className="space-y-4 mb-8">
                <div className="p-4 bg-gray-50 rounded-2xl flex items-center gap-4">
                  <FiCreditCard className="text-indigo-600" />
                  <div>
                    <div className="text-xs font-bold text-gray-400 uppercase">Current Balance</div>
                    <div className="text-lg font-extrabold text-gray-800">₹{selectedUser.walletBalance || 0}</div>
                  </div>
                </div>
                <div className="p-4 bg-gray-50 rounded-2xl flex items-center gap-4">
                  <FiMapPin className="text-indigo-600" />
                  <div className="flex-1">
                    <div className="text-xs font-bold text-gray-400 uppercase">Primary Address</div>
                    <div className="text-xs font-medium text-gray-600 truncate">{selectedUser.deliveryAddresses?.[0]?.address || 'No address set'}</div>
                  </div>
                </div>
              </div>

              <div className="border-t pt-6">
                <h4 className="text-sm font-bold text-gray-800 mb-4">Wallet Adjustment</h4>
                <div className="flex gap-2 mb-4">
                  <input 
                    type="number" 
                    placeholder="Amount..." 
                    className="flex-1 px-4 py-2 border rounded-xl outline-none focus:ring-2 focus:ring-indigo-100"
                    value={adjustmentAmount}
                    onChange={(e) => setAdjustmentAmount(e.target.value)}
                  />
                </div>
                <div className="flex gap-2">
                  <button 
                    onClick={() => handleAdjustWallet('add')}
                    className="flex-1 bg-indigo-600 text-white py-3 rounded-xl font-bold text-sm flex items-center justify-center gap-2 hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-100"
                  >
                    <FiArrowUpRight /> Add
                  </button>
                  <button 
                    onClick={() => handleAdjustWallet('remove')}
                    className="flex-1 bg-white border border-gray-200 text-gray-700 py-3 rounded-xl font-bold text-sm flex items-center justify-center gap-2 hover:bg-gray-50 transition-all"
                  >
                    <FiArrowDownLeft /> Remove
                  </button>
                </div>
              </div>
            </DetailCard>
          ) : (
            <div className="h-full flex flex-col items-center justify-center border-2 border-dashed border-gray-100 rounded-3xl text-gray-400 p-8 text-center">
              <FiUsers size={48} className="mb-4 opacity-20" />
              <p className="font-medium">Select a customer from the list to view and manage their profile details.</p>
            </div>
          )}
        </div>
      </MainContent>
    </PageContainer>
  );
}
