'use client';

import React, { useState, useEffect, useMemo } from 'react';
import styled from 'styled-components';
import { subscribeToCollection } from '@/lib/firebase';
import { FiSearch, FiPhone, FiMessageCircle, FiTrendingUp, FiTrendingDown, FiEye } from 'react-icons/fi';

interface UserWallet {
  id: string;
  name: string;
  phone: string;
  customerId: string;
  wallet_balance: number;
}

const PageContainer = styled.div`
  padding: 24px;
  max-width: 1200px;
  margin: 0 auto;
`;

const Header = styled.div`
  margin-bottom: 24px;
`;

const Title = styled.h1`
  font-size: 24px;
  font-weight: 700;
  color: #1f2937;
  margin: 0 0 4px 0;
`;

const Subtitle = styled.p`
  color: #6b7280;
  font-size: 14px;
  margin: 0;
`;

const ControlsContainer = styled.div`
  display: flex;
  gap: 16px;
  margin-bottom: 24px;
  flex-wrap: wrap;
`;

const SearchBox = styled.div`
  position: relative;
  flex: 1;
  min-width: 250px;

  svg {
    position: absolute;
    left: 12px;
    top: 50%;
    transform: translateY(-50%);
    color: #9ca3af;
  }
`;

const SearchInput = styled.input`
  width: 100%;
  padding: 10px 12px 10px 36px;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  outline: none;
  font-size: 14px;
  transition: all 0.2s;

  &:focus {
    border-color: #3b82f6;
    box-shadow: 0 0 0 2px rgba(59, 130, 246, 0.1);
  }
`;

const SortSelect = styled.select`
  padding: 10px 16px;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  outline: none;
  font-size: 14px;
  background: white;
  cursor: pointer;

  &:focus {
    border-color: #3b82f6;
  }
`;

const ListCard = styled.div`
  background: white;
  border-radius: 12px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
  overflow: hidden;
`;

const Table = styled.table`
  width: 100%;
  border-collapse: collapse;
`;

const Th = styled.th`
  background: #f9fafb;
  padding: 12px 16px;
  text-align: left;
  font-size: 12px;
  font-weight: 600;
  color: #6b7280;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  border-bottom: 1px solid #e5e7eb;
`;

const Td = styled.td`
  padding: 16px;
  border-bottom: 1px solid #e5e7eb;
  vertical-align: middle;
`;

const Tr = styled.tr`
  &:last-child td {
    border-bottom: none;
  }
  &:hover {
    background: #f9fafb;
  }
`;

const UserInfo = styled.div`
  display: flex;
  align-items: center;
  gap: 12px;
`;

const Avatar = styled.div`
  width: 40px;
  height: 40px;
  border-radius: 20px;
  background: linear-gradient(135deg, #1e3a8a 0%, #3b82f6 100%);
  color: white;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 16px;
  font-weight: 600;
`;

const NameColumn = styled.div`
  display: flex;
  flex-direction: column;
`;

const NameText = styled.span`
  font-weight: 600;
  color: #111827;
`;

const IdText = styled.span`
  font-size: 12px;
  color: #6b7280;
  background: #f3f4f6;
  padding: 2px 6px;
  border-radius: 4px;
  margin-top: 4px;
  display: inline-block;
  width: fit-content;
`;

const BalanceBadge = styled.span<{ $amount: number }>`
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 6px 12px;
  border-radius: 999px;
  font-size: 14px;
  font-weight: 700;
  background: ${props => props.$amount < 0 ? '#fee2e2' : '#d1fae5'};
  color: ${props => props.$amount < 0 ? '#b91c1c' : '#047857'};
`;

const ActionButtons = styled.div`
  display: flex;
  gap: 8px;
`;

const IconBtn = styled.button<{ $color: string }>`
  width: 32px;
  height: 32px;
  border-radius: 6px;
  border: 1px solid #e5e7eb;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  background: white;
  color: ${props => props.$color};
  transition: all 0.2s;

  &:hover {
    background: #f9fafb;
    border-color: #d1d5db;
  }
`;

const EmptyState = styled.div`
  padding: 48px;
  text-align: center;
  color: #6b7280;
`;

export default function WalletPage() {
  const [users, setUsers] = useState<UserWallet[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [sortBy, setSortBy] = useState<'name' | 'id' | 'balance_low' | 'balance_high'>('name');

  useEffect(() => {
    const unsub = subscribeToCollection('users', (snapshot) => {
      const formatted: UserWallet[] = snapshot.docs.map((d: any) => ({
        id: d.id,
        name: d.full_name || d.name || d.firstName + ' ' + (d.lastName || '') || 'Unknown',
        phone: d.phone || d.phoneNumber || '',
        customerId: d.customerId || '',
        wallet_balance: d.wallet_balance || 0,
      }));
      setUsers(formatted);
      setLoading(false);
    });
    return () => unsub();
  }, []);

  const filteredUsers = useMemo(() => {
    let result = [...users];

    if (searchTerm) {
      const q = searchTerm.toLowerCase();
      result = result.filter(u => 
        u.name.toLowerCase().includes(q) ||
        u.phone.includes(q) ||
        u.customerId.toLowerCase().includes(q)
      );
    }

    result.sort((a, b) => {
      if (sortBy === 'name') return a.name.localeCompare(b.name);
      if (sortBy === 'balance_low') return a.wallet_balance - b.wallet_balance;
      if (sortBy === 'balance_high') return b.wallet_balance - a.wallet_balance;
      if (sortBy === 'id') {
        const numA = parseInt(a.customerId.replace(/\D/g, '') || '0', 10);
        const numB = parseInt(b.customerId.replace(/\D/g, '') || '0', 10);
        if (numA && numB) return numA - numB;
        return a.customerId.localeCompare(b.customerId);
      }
      return 0;
    });

    return result;
  }, [users, searchTerm, sortBy]);

  const handleWhatsApp = (phone: string) => {
    if (!phone) return;
    const cleanPhone = phone.replace(/[^\d]/g, '');
    const p = cleanPhone.startsWith('91') ? cleanPhone : '91' + cleanPhone;
    window.open(`https://wa.me/${p}`, '_blank');
  };

  const handleCall = (phone: string) => {
    if (!phone) return;
    window.open(`tel:${phone}`);
  };

  return (
    <PageContainer>
      <Header>
        <Title>Wallet Management</Title>
        <Subtitle>Manage customer wallet balances and transactions</Subtitle>
      </Header>

      <ControlsContainer>
        <SearchBox>
          <FiSearch />
          <SearchInput 
            placeholder="Search by name, phone, or ID..." 
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </SearchBox>

        <SortSelect value={sortBy} onChange={(e) => setSortBy(e.target.value as any)}>
          <option value="name">Sort by Name</option>
          <option value="id">Sort by User ID</option>
          <option value="balance_high">Balance (High to Low)</option>
          <option value="balance_low">Balance (Low to High)</option>
        </SortSelect>
      </ControlsContainer>

      <ListCard>
        {loading ? (
          <EmptyState>Loading wallets...</EmptyState>
        ) : filteredUsers.length === 0 ? (
          <EmptyState>No wallet records found.</EmptyState>
        ) : (
          <Table>
            <thead>
              <Tr>
                <Th>User</Th>
                <Th>Contact</Th>
                <Th>Wallet Balance</Th>
                <Th>Actions</Th>
              </Tr>
            </thead>
            <tbody>
              {filteredUsers.map(user => (
                <Tr key={user.id}>
                  <Td>
                    <UserInfo>
                      <Avatar>{user.name.charAt(0).toUpperCase()}</Avatar>
                      <NameColumn>
                        <NameText>{user.name}</NameText>
                        <IdText>{user.customerId || 'No ID'}</IdText>
                      </NameColumn>
                    </UserInfo>
                  </Td>
                  <Td>
                    <div style={{ color: '#4b5563', fontSize: '14px' }}>{user.phone || 'N/A'}</div>
                  </Td>
                  <Td>
                    <BalanceBadge $amount={user.wallet_balance}>
                      {user.wallet_balance >= 0 ? <FiTrendingUp /> : <FiTrendingDown />}
                      ₹{user.wallet_balance.toFixed(2)}
                    </BalanceBadge>
                  </Td>
                  <Td>
                    <ActionButtons>
                      <IconBtn $color="#10b981" title="WhatsApp" onClick={() => handleWhatsApp(user.phone)}>
                        <FiMessageCircle />
                      </IconBtn>
                      <IconBtn $color="#3b82f6" title="Call" onClick={() => handleCall(user.phone)}>
                        <FiPhone />
                      </IconBtn>
                      <IconBtn $color="#4b5563" title="View Details" onClick={() => alert('View details coming soon')}>
                        <FiEye />
                      </IconBtn>
                    </ActionButtons>
                  </Td>
                </Tr>
              ))}
            </tbody>
          </Table>
        )}
      </ListCard>
    </PageContainer>
  );
}
