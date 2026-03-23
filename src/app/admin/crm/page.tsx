'use client';

import React, { useState, useEffect, useMemo } from 'react';
import styled from 'styled-components';
import { motion, AnimatePresence } from 'framer-motion';
import { FiPhone, FiMessageCircle, FiBell, FiDollarSign, FiClock, FiBox, FiUsers, FiSearch } from 'react-icons/fi';
import { subscribeToCollection } from '@/lib/firebase';

// Interfaces
interface User {
  id: string;
  name?: string;
  full_name?: string;
  firstName?: string;
  lastName?: string;
  phone?: string;
  phoneNumber?: string;
  email?: string;
  jars_occupied?: number;
  jarHold?: number;
  lastOrderDate?: any;
  createdAt?: any;
}

interface Order {
  id: string;
  total?: number;
  status?: string;
  createdAt?: any;
  deliveryDate?: any;
}

// Styled Components
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
  margin: 0 0 8px 0;
`;

const Subtitle = styled.p`
  color: #6b7280;
  font-size: 14px;
  margin: 0;
`;

const MetricsGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
  gap: 20px;
  margin-bottom: 32px;
`;

const MetricCard = styled(motion.div)`
  background: white;
  padding: 24px;
  border-radius: 16px;
  box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05), 0 2px 4px -1px rgba(0, 0, 0, 0.03);
  display: flex;
  align-items: center;
  gap: 16px;
  border: 1px solid #f3f4f6;
  transition: transform 0.2s;

  &:hover {
    transform: translateY(-2px);
  }
`;

const IconWrapper = styled.div<{ $color: string; $bg: string }>`
  width: 56px;
  height: 56px;
  border-radius: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 24px;
  color: ${props => props.$color};
  background: ${props => props.$bg};
`;

const MetricInfo = styled.div`
  flex: 1;
`;

const MetricValue = styled.div`
  font-size: 24px;
  font-weight: 700;
  color: #111827;
  margin-bottom: 4px;
`;

const MetricLabel = styled.div`
  font-size: 13px;
  color: #6b7280;
  font-weight: 500;
`;

const TabsContainer = styled.div`
  display: flex;
  gap: 12px;
  margin-bottom: 24px;
  background: white;
  padding: 8px;
  border-radius: 12px;
  box-shadow: 0 2px 4px rgba(0,0,0,0.02);
`;

const Tab = styled.button<{ $active: boolean; $color: string }>`
  flex: 1;
  padding: 12px 24px;
  border-radius: 8px;
  border: none;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
  background: ${props => props.$active ? props.$color : 'transparent'};
  color: ${props => props.$active ? 'white' : '#6b7280'};

  &:hover {
    background: ${props => props.$active ? props.$color : '#f3f4f6'};
  }
`;

const ListCard = styled.div`
  background: white;
  border-radius: 16px;
  box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05);
  overflow: hidden;
`;

const UserRow = styled.div`
  display: flex;
  align-items: center;
  padding: 16px 24px;
  border-bottom: 1px solid #f3f4f6;

  &:last-child {
    border-bottom: none;
  }
`;

const Avatar = styled.div`
  width: 48px;
  height: 48px;
  border-radius: 24px;
  background: linear-gradient(135deg, #8b5cf6 0%, #3b82f6 100%);
  color: white;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 18px;
  font-weight: 600;
  margin-right: 16px;
`;

const UserDetails = styled.div`
  flex: 1;
`;

const UserName = styled.div`
  font-weight: 600;
  color: #111827;
  font-size: 15px;
  margin-bottom: 4px;
`;

const UserSub = styled.div`
  font-size: 13px;
  color: #6b7280;
  display: flex;
  align-items: center;
  gap: 8px;
`;

const ActionButtons = styled.div`
  display: flex;
  gap: 8px;
`;

const ActionBtn = styled.button<{ $color: string }>`
  width: 40px;
  height: 40px;
  border-radius: 8px;
  border: none;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  background: ${props => props.$color}15;
  color: ${props => props.$color};
  transition: all 0.2s;
  font-size: 18px;

  &:hover {
    background: ${props => props.$color}30;
    transform: translateY(-1px);
  }
`;

const EmptyState = styled.div`
  padding: 48px;
  text-align: center;
  color: #6b7280;
  font-size: 15px;
`;

// Helper
const getTimestamp = (dateVal: any) => {
  if (!dateVal) return 0;
  if (typeof dateVal === 'number') return dateVal;
  if (typeof dateVal === 'string') return new Date(dateVal).getTime();
  if (dateVal.toDate) return dateVal.toDate().getTime();
  if (dateVal instanceof Date) return dateVal.getTime();
  return 0;
};

const formatDateSafe = (dateVal: any) => {
  const ts = getTimestamp(dateVal);
  if (!ts) return 'Never';
  const d = new Date(ts);
  return d.toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric'
  });
};

const formatPhone = (phone?: string) => {
  if (!phone) return '';
  return phone.replace(/[^\d+]/g, '');
};

const getPhoneForWa = (phone?: string) => {
    if (!phone) return '';
    const cleanPhone = phone.replace(/[^\d]/g, '');
    return cleanPhone.startsWith('91') ? cleanPhone : '91' + cleanPhone;
};

export default function CRMScreen() {
  const [users, setUsers] = useState<User[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'HEALTHY' | 'AT_RISK' | 'INACTIVE'>('AT_RISK');

  useEffect(() => {
    const unsubUsers = subscribeToCollection('users', (snapshot) => {
      const formatted = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setUsers(formatted as User[]);
      if (orders.length > 0 || formatted.length > 0) setLoading(false);
    });

    const unsubOrders = subscribeToCollection('orders', (snapshot) => {
      const formatted = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setOrders(formatted as Order[]);
      if (users.length > 0 || formatted.length > 0) setLoading(false);
    });

    return () => {
      unsubUsers();
      unsubOrders();
    };
  }, []);

  const segmentation = useMemo(() => {
    const now = Date.now();
    const oneWeek = 7 * 24 * 60 * 60 * 1000;
    const oneMonth = 30 * 24 * 60 * 60 * 1000;

    const healthy: User[] = [];
    const atRisk: User[] = [];
    const inactive: User[] = [];

    users.forEach(user => {
      const lastOrderTs = getTimestamp(user.lastOrderDate) || getTimestamp(user.createdAt);
      const diff = now - lastOrderTs;

      if (!lastOrderTs || diff > oneMonth) {
        inactive.push(user);
      } else if (diff > oneWeek) {
        atRisk.push(user);
      } else {
        healthy.push(user);
      }
    });

    return { HEALTHY: healthy, AT_RISK: atRisk, INACTIVE: inactive };
  }, [users]);

  const metrics = useMemo(() => {
    const today = new Date().toISOString().split('T')[0];

    const collectionToday = orders
      .filter(o => 
        (o.status === 'delivered' || o.status === 'completed') && 
        (getTimestamp(o.deliveryDate) > new Date(today).getTime() || getTimestamp(o.createdAt) > new Date(today).getTime())
      )
      .reduce((sum, o) => sum + (o.total || 0), 0);

    const deliveredOrders = orders.filter(o => (o.status === 'delivered' || o.status === 'completed') && o.createdAt && o.deliveryDate);
    const avgDeliveryTime = deliveredOrders.length > 0
      ? deliveredOrders.reduce((sum, o) => {
          const created = getTimestamp(o.createdAt);
          const delivered = getTimestamp(o.deliveryDate);
          return sum + ((delivered - created) / (1000 * 60));
        }, 0) / deliveredOrders.length
      : 0;

    const totalJarsOut = users.reduce((sum, u) => sum + (Number(u.jars_occupied) || Number(u.jarHold) || 0), 0);

    return {
      collectionToday,
      avgDeliveryTime: Math.round(avgDeliveryTime),
      totalJarsOut,
      activeCount: segmentation.HEALTHY.length,
      inactiveCount: segmentation.INACTIVE.length,
    };
  }, [orders, users, segmentation]);

  const handleWhatsApp = (user: User) => {
    const phone = user.phone || user.phoneNumber;
    if (!phone) return;
    const p = getPhoneForWa(phone);
    const message = encodeURIComponent(`Hi ${user.full_name || user.name || user.firstName}, we missed you at Hydrant! Need a water refill today? 💧`);
    window.open(`https://wa.me/${p}?text=${message}`, '_blank');
  };

  const handleCall = (user: User) => {
    const phone = user.phone || user.phoneNumber;
    if (!phone) return;
    window.open(`tel:${formatPhone(phone)}`);
  };

  const currentSegment = segmentation[activeTab] || [];

  return (
    <PageContainer>
      <Header>
        <Title>CRM & Leads</Title>
        <Subtitle>Retention radar and operational metrics</Subtitle>
      </Header>

      <MetricsGrid>
        <MetricCard>
          <IconWrapper $color="#10b981" $bg="#10b98120">
            <FiDollarSign />
          </IconWrapper>
          <MetricInfo>
            <MetricValue>₹{metrics.collectionToday.toLocaleString()}</MetricValue>
            <MetricLabel>Collection Today</MetricLabel>
          </MetricInfo>
        </MetricCard>

        <MetricCard>
          <IconWrapper $color="#f59e0b" $bg="#f59e0b20">
            <FiClock />
          </IconWrapper>
          <MetricInfo>
            <MetricValue>{metrics.avgDeliveryTime}m</MetricValue>
            <MetricLabel>Avg Delivery Time</MetricLabel>
          </MetricInfo>
        </MetricCard>

        <MetricCard>
          <IconWrapper $color="#3b82f6" $bg="#3b82f620">
            <FiBox />
          </IconWrapper>
          <MetricInfo>
            <MetricValue>{metrics.totalJarsOut}</MetricValue>
            <MetricLabel>Jars at User</MetricLabel>
          </MetricInfo>
        </MetricCard>

        <MetricCard>
          <IconWrapper $color="#8b5cf6" $bg="#8b5cf620">
            <FiUsers />
          </IconWrapper>
          <MetricInfo>
            <MetricValue>{metrics.activeCount}</MetricValue>
            <MetricLabel>Active Users</MetricLabel>
          </MetricInfo>
        </MetricCard>
      </MetricsGrid>

      <Header>
        <Title>Retention Radar</Title>
        <Subtitle>Identify and recover users based on order history</Subtitle>
      </Header>

      <TabsContainer>
        <Tab 
          $active={activeTab === 'HEALTHY'} 
          $color="#10b981"
          onClick={() => setActiveTab('HEALTHY')}
        >
          Healthy ({segmentation.HEALTHY.length})
        </Tab>
        <Tab 
          $active={activeTab === 'AT_RISK'} 
          $color="#f59e0b"
          onClick={() => setActiveTab('AT_RISK')}
        >
          At Risk ({segmentation.AT_RISK.length})
        </Tab>
        <Tab 
          $active={activeTab === 'INACTIVE'} 
          $color="#ef4444"
          onClick={() => setActiveTab('INACTIVE')}
        >
          Inactive ({segmentation.INACTIVE.length})
        </Tab>
      </TabsContainer>

      <ListCard>
        {currentSegment.length === 0 ? (
          <EmptyState>No users in this segment</EmptyState>
        ) : (
          currentSegment.map(user => {
            const name = user.full_name || user.name || `${user.firstName || ''} ${user.lastName || ''}`.trim() || 'Unknown';
            return (
              <UserRow key={user.id}>
                <Avatar>{name.charAt(0).toUpperCase()}</Avatar>
                <UserDetails>
                  <UserName>{name}</UserName>
                  <UserSub>Last order: {formatDateSafe(user.lastOrderDate)}</UserSub>
                </UserDetails>
                <ActionButtons>
                  <ActionBtn $color="#8b5cf6" title="Send Notification">
                    <FiBell />
                  </ActionBtn>
                  <ActionBtn $color="#10b981" onClick={() => handleWhatsApp(user)} title="WhatsApp">
                    <FiMessageCircle />
                  </ActionBtn>
                  <ActionBtn $color="#3b82f6" onClick={() => handleCall(user)} title="Call">
                    <FiPhone />
                  </ActionBtn>
                </ActionButtons>
              </UserRow>
            )
          })
        )}
      </ListCard>
    </PageContainer>
  );
}
