'use client';

import React, { useState, useEffect, useMemo } from 'react';
import styled from 'styled-components';
import { motion } from 'framer-motion';
import { subscribeToCollection } from '@/lib/firebase';
import { FiCalendar, FiCheckCircle, FiClock, FiAlertCircle, FiSearch, FiEye } from 'react-icons/fi';

interface Subscription {
  id: string;
  userId: string;
  userName?: string;
  userPhone?: string;
  planType?: string; // 'weekly', 'monthly'
  totalJars?: number;
  pricePerJar?: number;
  totalAmount?: number;
  status: string; // 'active', 'paused', 'cancelled', 'completed'
  paymentStatus: string; // 'paid', 'pending', 'failed'
  deliveries?: any[];
  startDate?: any;
  createdAt?: any;
}

const PageContainer = styled.div`
  padding: 24px;
  max-width: 1200px;
  margin: 0 auto;
`;

const Header = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 24px;
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

const ControlsContainer = styled.div`
  display: flex;
  gap: 16px;
  align-items: center;
  flex-wrap: wrap;
  margin-bottom: 24px;
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
    border-color: #8b5cf6;
    box-shadow: 0 0 0 2px rgba(139, 92, 246, 0.1);
  }
`;

const FilterTabs = styled.div`
  display: flex;
  background: white;
  padding: 4px;
  border-radius: 8px;
  border: 1px solid #e5e7eb;
`;

const Tab = styled.button<{ $active: boolean }>`
  padding: 8px 16px;
  border: none;
  background: ${props => props.$active ? '#f3f4f6' : 'transparent'};
  color: ${props => props.$active ? '#111827' : '#6b7280'};
  font-weight: ${props => props.$active ? '600' : '400'};
  border-radius: 6px;
  font-size: 14px;
  cursor: pointer;
  transition: all 0.2s;

  &:hover {
    color: #111827;
  }
`;

const TableCard = styled.div`
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

const Badge = styled.span<{ $type: string }>`
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 4px 10px;
  border-radius: 999px;
  font-size: 12px;
  font-weight: 600;
  
  ${props => {
    switch (props.$type) {
      case 'active':
      case 'paid':
        return 'background: #d1fae5; color: #065f46;';
      case 'pending':
      case 'paused':
        return 'background: #fef3c7; color: #92400e;';
      case 'failed':
      case 'cancelled':
        return 'background: #fee2e2; color: #991b1b;';
      case 'completed':
        return 'background: #f3f4f6; color: #374151;';
      default:
        return 'background: #f3f4f6; color: #374151;';
    }
  }}
`;

const ActionButton = styled.button`
  padding: 6px 12px;
  background: #f3f4f6;
  border: none;
  border-radius: 6px;
  color: #374151;
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 6px;
  transition: all 0.2s;

  &:hover {
    background: #e5e7eb;
  }
`;

const EmptyState = styled.div`
  padding: 48px;
  text-align: center;
  color: #6b7280;
`;

export default function SubscriptionsPage() {
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'active' | 'pending' | 'completed'>('all');
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    const unsub = subscribeToCollection('subscriptions', (snapshot) => {
      const formatted = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setSubscriptions(formatted as Subscription[]);
      setLoading(false);
    });
    return () => unsub();
  }, []);

  const filteredSubs = useMemo(() => {
    return subscriptions.filter(sub => {
      // Step 1: Filter logic
      let matchesFilter = true;
      if (filter === 'pending') matchesFilter = sub.paymentStatus === 'pending';
      if (filter === 'active') matchesFilter = sub.status === 'active' && sub.paymentStatus === 'paid';
      if (filter === 'completed') matchesFilter = sub.status === 'completed';

      // Step 2: Search logic
      const searchStr = searchTerm.toLowerCase();
      const matchesSearch = !searchTerm || 
        (sub.userName?.toLowerCase().includes(searchStr)) ||
        (sub.userPhone?.includes(searchStr)) ||
        (sub.id.toLowerCase().includes(searchStr));

      return matchesFilter && matchesSearch;
    }).sort((a, b) => {
      const tsA = a.createdAt?.seconds || 0;
      const tsB = b.createdAt?.seconds || 0;
      return tsB - tsA;
    });
  }, [subscriptions, filter, searchTerm]);

  return (
    <PageContainer>
      <Header>
        <TitleBox>
          <Title>Subscriptions</Title>
          <Subtitle>Manage user water jar subscriptions</Subtitle>
        </TitleBox>
      </Header>

      <ControlsContainer>
        <SearchBox>
          <FiSearch />
          <SearchInput 
            placeholder="Search by name, phone or ID..." 
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </SearchBox>

        <FilterTabs>
          {['all', 'active', 'pending', 'completed'].map(f => (
            <Tab 
              key={f} 
              $active={filter === f}
              onClick={() => setFilter(f as any)}
            >
              {f.charAt(0).toUpperCase() + f.slice(1)}
            </Tab>
          ))}
        </FilterTabs>
      </ControlsContainer>

      <TableCard>
        {loading ? (
          <EmptyState>Loading subscriptions...</EmptyState>
        ) : filteredSubs.length === 0 ? (
          <EmptyState>No subscriptions found matching the criteria.</EmptyState>
        ) : (
          <Table>
            <thead>
              <Tr>
                <Th>Customer</Th>
                <Th>Plan Details</Th>
                <Th>Deliveries</Th>
                <Th>Amount</Th>
                <Th>Status</Th>
                <Th>Payment</Th>
                <Th>Actions</Th>
              </Tr>
            </thead>
            <tbody>
              {filteredSubs.map(sub => {
                const upcomingDeliveries = (sub.deliveries || []).filter((d: any) => d.status === 'pending').length;
                
                return (
                  <Tr key={sub.id}>
                    <Td>
                      <div style={{ fontWeight: 600, color: '#111827' }}>{sub.userName || 'Unknown'}</div>
                      <div style={{ fontSize: 12, color: '#6b7280', marginTop: 2 }}>{sub.userPhone || 'N/A'}</div>
                    </Td>
                    <Td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <FiCalendar color="#8b5cf6" />
                        <span style={{ fontWeight: 500, textTransform: 'capitalize' }}>{sub.planType || 'Unknown'}</span>
                      </div>
                      <div style={{ fontSize: 12, color: '#6b7280', marginTop: 4 }}>
                        {sub.totalJars || 0} jars @ ₹{sub.pricePerJar || 0}
                      </div>
                    </Td>
                    <Td>
                      <div style={{ fontSize: 14 }}>
                        {upcomingDeliveries} upcoming
                      </div>
                      <div style={{ fontSize: 12, color: '#6b7280' }}>
                        out of {sub.totalJars || (sub.deliveries?.length || 0)} total
                      </div>
                    </Td>
                    <Td>
                      <div style={{ fontWeight: 600 }}>₹{(sub.totalAmount || 0).toLocaleString()}</div>
                    </Td>
                    <Td>
                      <Badge $type={sub.status || 'unknown'}>
                        {sub.status?.toUpperCase() || 'UNKNOWN'}
                      </Badge>
                    </Td>
                    <Td>
                      <Badge $type={sub.paymentStatus || 'unknown'}>
                        {sub.paymentStatus === 'paid' ? <FiCheckCircle /> : 
                         sub.paymentStatus === 'failed' ? <FiAlertCircle /> : <FiClock />}
                        {sub.paymentStatus?.toUpperCase() || 'UNKNOWN'}
                      </Badge>
                    </Td>
                    <Td>
                      <ActionButton onClick={() => alert('View Details functionality coming soon')}>
                        <FiEye /> View
                      </ActionButton>
                    </Td>
                  </Tr>
                );
              })}
            </tbody>
          </Table>
        )}
      </TableCard>
    </PageContainer>
  );
}
