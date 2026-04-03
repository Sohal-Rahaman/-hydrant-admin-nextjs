'use client';

import React, { useState, useEffect } from 'react';
import styled from 'styled-components';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  FiTruck, 
  FiMap, 
  FiUser, 
  FiClock, 
  FiZap, 
  FiTarget,
  FiPhone,
  FiStar,
  FiNavigation,
  FiMoreVertical
} from 'react-icons/fi';
import { 
  collection, 
  query, 
  where, 
  onSnapshot
} from 'firebase/firestore';
import { db } from '@/lib/firebase';

interface ArmyProfile {
  id: string;
  name: string;
  phone: string;
  status: 'online' | 'offline' | 'on-delivery';
  lastLocation?: { latitude: number; longitude: number };
  rating: number;
  ordersToday: number;
  shiftStartTime?: string;
}

const Container = styled.div`
  max-width: 1600px;
  margin: 0 auto;
  padding: 24px;
  height: calc(100vh - 64px);
  display: flex;
  flex-direction: column;
`;

const TopBar = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 24px;
`;

const Title = styled.h1`
  font-size: 24px;
  font-weight: 800;
  color: #f0f0f0;
  display: flex;
  align-items: center;
  gap: 12px;
`;

const MainGrid = styled.div`
  display: grid;
  grid-template-columns: 1fr 400px;
  gap: 24px;
  flex: 1;
  min-height: 0;

  @media (max-width: 1024px) {
    grid-template-columns: 1fr;
  }
`;

const MapView = styled.div`
  background: #181818;
  border: 1px solid #2e2e2e;
  border-radius: 32px;
  position: relative;
  overflow: hidden;
  display: flex;
  align-items: center;
  justify-content: center;
`;

const Sidebar = styled.div`
  background: #181818;
  border: 1px solid #2e2e2e;
  border-radius: 32px;
  display: flex;
  flex-direction: column;
  overflow: hidden;
`;

const SidebarHeader = styled.div`
  padding: 24px;
  border-bottom: 1px solid #2e2e2e;
  
  .label {
    font-size: 11px;
    font-weight: 700;
    color: #666;
    text-transform: uppercase;
    letter-spacing: 0.1em;
  }
`;

const SidebarList = styled.div`
  flex: 1;
  overflow-y: auto;
  padding: 12px;
`;

const ArmyCard = styled(motion.div)`
  background: #0f0f0f;
  border: 1px solid #2e2e2e;
  border-radius: 20px;
  padding: 20px;
  margin-bottom: 12px;
  transition: all 0.2s;

  &:hover {
    border-color: #444;
  }
`;

const StatusPill = styled.div<{ status: string }>`
  padding: 4px 10px;
  border-radius: 20px;
  font-size: 10px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  display: flex;
  align-items: center;
  gap: 6px;
  background: ${props => {
    switch (props.status) {
      case 'online': return 'rgba(16, 185, 129, 0.1)';
      case 'on-delivery': return 'rgba(59, 130, 246, 0.1)';
      default: return 'rgba(102, 102, 102, 0.1)';
    }
  }};
  color: ${props => {
    switch (props.status) {
      case 'online': return '#10B981';
      case 'on-delivery': return '#3B82F6';
      default: return '#666';
    }
  }};
  border: 1px solid ${props => {
    switch (props.status) {
      case 'online': return 'rgba(16, 185, 129, 0.2)';
      case 'on-delivery': return 'rgba(59, 130, 246, 0.2)';
      default: return 'rgba(102, 102, 102, 0.2)';
    }
  }};
`;

const ActionButton = styled.button<{ variant?: 'primary' | 'ghost' }>`
  background: ${props => props.variant === 'primary' ? '#10B981' : '#222'};
  color: ${props => props.variant === 'primary' ? 'white' : '#aaa'};
  border: 1px solid ${props => props.variant === 'primary' ? 'transparent' : '#2e2e2e'};
  padding: 8px 16px;
  border-radius: 12px;
  font-size: 13px;
  font-weight: 700;
  display: flex;
  align-items: center;
  gap: 8px;
  cursor: pointer;
  transition: all 0.2s;

  &:hover {
    background: ${props => props.variant === 'primary' ? '#059669' : '#2a2a2a'};
  }
`;

const StatGrid = styled.div`
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
  margin-top: 16px;
  padding-top: 16px;
  border-top: 1px solid #2e2e2e;

  .stat-item {
    .val { font-weight: 700; color: #f0f0f0; font-size: 14px; }
    .lab { font-size: 10px; color: #666; text-transform: uppercase; font-weight: 600; }
  }
`;

export default function FleetPage() {
  const [armyMembers, setArmyMembers] = useState<ArmyProfile[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    const q = query(collection(db, 'army_profiles'));

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const members = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as ArmyProfile[];
      
      setArmyMembers(members);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  if (loading) return (
    <div style={{ background: '#0f0f0f', minHeight: '100vh', padding: '100px', textAlign: 'center', color: '#666' }}>
      Calibrating Fleet Tracking...
    </div>
  );

  return (
    <div style={{ background: '#0f0f0f', minHeight: '100vh', color: '#f0f0f0' }}>
      <Container>
        <TopBar>
          <Title><FiTruck /> Fleet Operational View</Title>
          <div style={{ display: 'flex', gap: '12px' }}>
            <div style={{ background: '#181818', border: '1px solid #2e2e2e', padding: '8px 16px', borderRadius: '12px', fontSize: '13px', fontWeight: 700, color: '#10B981', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <FiUser /> {armyMembers.filter(m => m.status === 'online').length} Units Live
            </div>
            <ActionButton variant="primary">
              <FiZap /> Optimized Smart Route
            </ActionButton>
          </div>
        </TopBar>

        <MainGrid>
          <MapView>
            <div style={{ zIndex: 10, background: 'rgba(24, 24, 24, 0.9)', backdropFilter: 'blur(20px)', padding: '40px', borderRadius: '32px', textAlign: 'center', border: '1px solid #2e2e2e', maxWidth: '400px' }}>
              <FiNavigation size={48} style={{ color: '#10B981', marginBottom: '24px', animation: 'pulse 2s infinite' }} />
              <h3 style={{ fontSize: '20px', fontWeight: 800, marginBottom: '12px' }}>Hybrid Satellite Engine</h3>
              <p style={{ fontSize: '14px', color: '#666', lineHeight: 1.6 }}>Mapbox API initialization in progress. Strategic coordinates for {armyMembers.length} active delivery units will be visualized here.</p>
            </div>
            <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(circle at center, #111 0%, #000 100%)', opacity: 0.5 }} />
          </MapView>

          <Sidebar>
            <SidebarHeader>
              <div className="label">Active Personnel</div>
            </SidebarHeader>
            <SidebarList>
              {armyMembers.map(member => (
                <ArmyCard 
                  key={member.id}
                  whileHover={{ x: 4 }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div style={{ display: 'flex', gap: '16px' }}>
                      <div style={{ 
                        width: '48px', 
                        height: '48px', 
                        borderRadius: '12px', 
                        background: '#222', 
                        border: '1px solid #2e2e2e',
                        display: 'flex', 
                        alignItems: 'center', 
                        justifyContent: 'center',
                        fontSize: '18px',
                        fontWeight: 800,
                        color: '#10B981'
                      }}>
                        {member.name?.[0] || 'A'}
                      </div>
                      <div>
                        <div style={{ fontWeight: 700, fontSize: '15px' }}>{member.name || 'Anonymous Unit'}</div>
                        <div style={{ fontSize: '11px', color: '#666', fontFamily: 'DM Mono' }}>#{member.id.slice(-6).toUpperCase()}</div>
                      </div>
                    </div>
                    <StatusPill status={member.status}>
                      {member.status}
                    </StatusPill>
                  </div>

                  <StatGrid>
                    <div className="stat-item">
                      <div className="lab">Shift Progress</div>
                      <div className="val">{member.ordersToday || 0} Orders</div>
                    </div>
                    <div className="stat-item" style={{ textAlign: 'right' }}>
                      <div className="lab">Civic Rating</div>
                      <div className="val" style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '4px' }}>
                        {member.rating || '4.8'} <FiStar size={12} style={{ color: '#F59E0B', fill: '#F59E0B' }} />
                      </div>
                    </div>
                  </StatGrid>

                  <div style={{ display: 'flex', gap: '12px', marginTop: '16px' }}>
                    <ActionButton variant="ghost" style={{ flex: 1 }}>Assign Sector</ActionButton>
                    <ActionButton variant="ghost" style={{ padding: '8px 12px' }}>
                      <FiPhone size={14} />
                    </ActionButton>
                  </div>
                </ArmyCard>
              ))}

              {armyMembers.length === 0 && (
                <div style={{ padding: '60px 40px', textAlign: 'center', border: '2px dashed #2e2e2e', borderRadius: '24px', color: '#666' }}>
                  <FiUser size={32} style={{ marginBottom: '16px', opacity: 0.1 }} />
                  <p style={{ fontSize: '13px', fontWeight: 600 }}>No active army units detected.</p>
                </div>
              )}
            </SidebarList>
          </Sidebar>
        </MainGrid>
      </Container>
    </div>
  );
}
