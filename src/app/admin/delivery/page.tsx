'use client';

import React, { useState, useEffect, useMemo } from 'react';
import styled from 'styled-components';
import { FiArrowLeft, FiMap, FiTruck, FiActivity } from 'react-icons/fi';
import { useRouter } from 'next/navigation';
import { subscribeToCollection } from '@/lib/firebase';
import { DeliveryMap } from '@/components/DeliveryMap';
import { normalizeOrderStatus } from '@/lib/orderStatus';

const WAREHOUSE = { lat: 22.6362, lng: 88.4299 };

export default function DeliveryPage() {
  const router = useRouter();
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsub = subscribeToCollection('orders', (snap) => {
      try {
        const data = snap.docs.map(doc => {
          const d = doc.data();
          return {
            id: doc.id,
            ...d,
            status: normalizeOrderStatus(String(d.status || 'pending')),
            raw: d
          };
        });
        setOrders(data);
        setLoading(false);
      } catch (e) {
        console.error(e);
      }
    }, [], (e) => console.error(e));

    return () => unsub();
  }, []);

  return (
    <Container>
      <Header>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <BackBtn onClick={() => router.back()}>
            <FiArrowLeft size={20} />
          </BackBtn>
          <div>
            <Title>Logistics Console</Title>
            <SubTitle>Real-time Fleet & Delivery Monitoring</SubTitle>
          </div>
        </div>
        <HeaderStats>
          <StatPill>
            <FiTruck /> {orders.filter(o => ['processing', 'in_progress', 'out_for_delivery'].includes(o.status)).length} Active
          </StatPill>
          <StatPill $type="success">
            <FiActivity /> {orders.filter(o => o.status === 'delivered').length} Delivered Today
          </StatPill>
        </HeaderStats>
      </Header>

      <MapWrapper>
        {loading ? (
          <Loading>Initializing Logistics Layer...</Loading>
        ) : (
          <DeliveryMap orders={orders} warehouse={WAREHOUSE} />
        )}
      </MapWrapper>
    </Container>
  );
}

const Container = styled.div`
  padding: 24px;
  background: var(--color-background-primary);
  min-height: 100vh;
`;

const Header = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 24px;
  @media (max-width: 768px) {
    flex-direction: column;
    align-items: flex-start;
    gap: 16px;
  }
`;

const BackBtn = styled.button`
  width: 40px;
  height: 40px;
  border-radius: 12px;
  border: 1px solid var(--color-border-primary);
  background: var(--color-background-secondary);
  color: var(--color-text-primary);
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  &:hover { background: var(--color-background-tertiary); }
`;

const Title = styled.h1`
  font-size: 24px;
  font-weight: 800;
  color: var(--color-text-primary);
  margin: 0;
`;

const SubTitle = styled.p`
  font-size: 14px;
  color: var(--color-text-secondary);
  margin: 4px 0 0;
`;

const HeaderStats = styled.div`
  display: flex;
  gap: 12px;
`;

const StatPill = styled.div<{ $type?: 'success' }>`
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 16px;
  border-radius: 12px;
  font-size: 13px;
  font-weight: 700;
  background: ${p => p.$type === 'success' ? 'rgba(16, 185, 129, 0.1)' : 'rgba(15, 110, 86, 0.1)'};
  color: ${p => p.$type === 'success' ? '#10B981' : '#0F6E56'};
  border: 1px solid ${p => p.$type === 'success' ? 'rgba(16, 185, 129, 0.2)' : 'rgba(15, 110, 86, 0.2)'};
`;

const MapWrapper = styled.div`
  background: var(--color-background-secondary);
  border: 1px solid var(--color-border-primary);
  border-radius: 24px;
  overflow: hidden;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.05);
`;

const Loading = styled.div`
  height: 500px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 16px;
  font-weight: 700;
  color: var(--color-text-tertiary);
`;
