'use client';

import React, { useState, useEffect, useMemo } from 'react';
import styled from 'styled-components';
import { subscribeToCollection } from '@/lib/firebase';
import { FiSearch, FiPhone, FiMessageCircle, FiAlertCircle, FiArrowRight } from 'react-icons/fi';
import { useRouter } from 'next/navigation';

interface User {
  id: string;
  name: string;
  phone: string;
  customerId: string;
  address: string;
  wallet_balance: number;
}

const PageContainer = styled.div`
  padding: 24px;
  max-width: 1200px;
  margin: 0 auto;
`;

const Header = styled.div`
  margin-bottom: 24px;
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  flex-wrap: wrap;
  gap: 16px;
`;

const TitleBox = styled.div``;

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

const SummaryCard = styled.div`
  background: white;
  padding: 16px 24px;
  border-radius: 12px;
  box-shadow: 0 1px 3px rgba(0,0,0,0.1);
  display: flex;
  align-items: center;
  gap: 16px;
  border: 1px solid #e5e7eb;
`;

const SummaryIcon = styled.div`
  width: 48px;
  height: 48px;
  border-radius: 12px;
  background: #fef2f2;
  color: #ef4444;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 24px;
`;

const SummaryInfo = styled.div``;

const SummaryValue = styled.div`
  font-size: 20px;
  font-weight: 700;
  color: #111827;
`;

const SummaryLabel = styled.div`
  font-size: 13px;
  color: #6b7280;
  font-weight: 500;
`;

const ControlsContainer = styled.div`
  margin-bottom: 24px;
`;

const SearchBox = styled.div`
  position: relative;
  max-width: 400px;

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
  background: linear-gradient(135deg, #f43f5e 0%, #e11d48 100%);
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

const DueAmountLabel = styled.div`
  font-size: 18px;
  font-weight: 700;
  color: #ef4444;
  display: flex;
  align-items: center;
  gap: 6px;
`;

const ActionButtons = styled.div`
  display: flex;
  gap: 8px;
`;

const IconBtn = styled.button<{ $color: string; $bg?: string }>`
  width: 32px;
  height: 32px;
  border-radius: 6px;
  border: 1px solid ${props => props.$bg ? 'transparent' : '#e5e7eb'};
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  background: ${props => props.$bg || 'white'};
  color: ${props => props.$color};
  transition: all 0.2s;

  &:hover {
    background: ${props => props.$bg ? props.$bg + 'CC' : '#f9fafb'};
    border-color: ${props => props.$bg ? 'transparent' : '#d1d5db'};
  }
`;

const EmptyState = styled.div`
  padding: 48px;
  text-align: center;
  color: #6b7280;
`;

export default function DueAmountsPage() {
  const router = useRouter();
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    const unsub = subscribeToCollection('users', (snapshot) => {
      const formatted: User[] = snapshot.docs.map((d: any) => ({
        id: d.id,
        name: d.full_name || d.name || d.firstName + ' ' + (d.lastName || '') || 'Unknown',
        phone: d.phone || d.phoneNumber || '',
        customerId: d.customerId || '',
        address: d.buildingName || d.address || '',
        wallet_balance: Number(d.wallet_balance) || 0
      }));
      setUsers(formatted);
      setLoading(false);
    });
    return () => unsub();
  }, []);

  const filteredUsers = useMemo(() => {
    // Only show users with negative wallet balance
    let result = users.filter(u => u.wallet_balance < 0);

    if (searchTerm) {
      const q = searchTerm.toLowerCase();
      result = result.filter(u => 
        u.name.toLowerCase().includes(q) ||
        u.phone.includes(q) ||
        u.customerId.toLowerCase().includes(q)
      );
    }

    // Sort by most negative first (highest due amount)
    result.sort((a, b) => a.wallet_balance - b.wallet_balance);

    return result;
  }, [users, searchTerm]);

  const totalDueAmount = useMemo(() => {
    return filteredUsers.reduce((sum, u) => sum + Math.abs(u.wallet_balance), 0);
  }, [filteredUsers]);

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

  const handleViewWallet = (userId: string) => {
    router.push('/admin/wallet');
    // Note: If wallet page supports "?search=customerId", could append it. 
    // Example: router.push(`/admin/wallet?search=${userId}`);
  };

  return (
    <PageContainer>
      <Header>
        <TitleBox>
          <Title>Due Amounts</Title>
          <Subtitle>Customers with negative wallet balances</Subtitle>
        </TitleBox>

        {!loading && (
          <SummaryCard>
            <SummaryIcon>
              <FiAlertCircle />
            </SummaryIcon>
            <SummaryInfo>
              <SummaryValue>₹{totalDueAmount.toFixed(2)}</SummaryValue>
              <SummaryLabel>Total Pending Dues</SummaryLabel>
            </SummaryInfo>
            <div style={{ width: 1, height: 32, background: '#e5e7eb', margin: '0 8px' }} />
            <SummaryInfo>
              <SummaryValue>{filteredUsers.length}</SummaryValue>
              <SummaryLabel>Customers</SummaryLabel>
            </SummaryInfo>
          </SummaryCard>
        )}
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
      </ControlsContainer>

      <ListCard>
        {loading ? (
          <EmptyState>Loading due amounts...</EmptyState>
        ) : filteredUsers.length === 0 ? (
          <EmptyState>
            <FiCheckCircle style={{ fontSize: '48px', color: '#10b981', marginBottom: '16px' }} />
            <h3 style={{ margin: '0 0 8px', color: '#111827' }}>All Clear! 🎉</h3>
            <p style={{ margin: 0 }}>No users currently have negative wallet balances.</p>
          </EmptyState>
        ) : (
          <Table>
            <thead>
              <Tr>
                <Th>Customer</Th>
                <Th>Contact</Th>
                <Th>Due Amount</Th>
                <Th>Actions</Th>
              </Tr>
            </thead>
            <tbody>
              {filteredUsers.map(user => {
                const dueAmount = Math.abs(user.wallet_balance);

                return (
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
                      <div style={{ color: '#4b5563', fontSize: '14px', marginBottom: '2px' }}>{user.phone || 'N/A'}</div>
                      <div style={{ color: '#9ca3af', fontSize: '12px', maxWidth: '200px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {user.address}
                      </div>
                    </Td>
                    <Td>
                      <DueAmountLabel>
                        ₹{dueAmount.toFixed(2)}
                      </DueAmountLabel>
                    </Td>
                    <Td>
                      <ActionButtons>
                        <IconBtn $color="#10b981" title="WhatsApp" onClick={() => handleWhatsApp(user.phone)}>
                          <FiMessageCircle />
                        </IconBtn>
                        <IconBtn $color="#3b82f6" title="Call" onClick={() => handleCall(user.phone)}>
                          <FiPhone />
                        </IconBtn>
                        <div style={{ width: 1, background: '#e5e7eb', margin: '0 4px' }} />
                        <IconBtn $color="white" $bg="#4f46e5" title="Manage Wallet" onClick={() => handleViewWallet(user.id)}>
                          <FiArrowRight />
                        </IconBtn>
                      </ActionButtons>
                    </Td>
                  </Tr>
                );
              })}
            </tbody>
          </Table>
        )}
      </ListCard>
    </PageContainer>
  );
}

// Ensure FiCheckCircle is imported here to avoid error
import { FiCheckCircle } from 'react-icons/fi';
