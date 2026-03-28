'use client';

import React, { useState, useEffect } from 'react';
import styled from 'styled-components';
import { motion } from 'framer-motion';
import { 
  FiTruck, 
  FiMap, 
  FiUser, 
  FiClock, 
  FiZap, 
  FiTarget,
  FiPhone,
  FiStar,
  FiNavigation
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

const MainGrid = styled.div`
  display: grid;
  grid-template-columns: 1fr 380px;
  gap: 24px;
  height: calc(100vh - 200px);
`;

const MapPlaceholder = styled.div`
  background: #e5e7eb;
  border-radius: 24px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  color: #9ca3af;
  position: relative;
  overflow: hidden;
  border: 1px solid #d1d5db;

  &::after {
    content: '';
    position: absolute;
    inset: 0;
    background: url('https://api.mapbox.com/styles/v1/mapbox/light-v10/static/77.2090,28.6139,11/800x600?access_token=UNUSED') no-repeat center/cover;
    opacity: 0.4;
  }
`;

const Sidebar = styled.div`
  display: flex;
  flex-direction: column;
  gap: 20px;
  overflow-y: auto;
`;

const ArmyCard = styled(motion.div)`
  background: white;
  border-radius: 20px;
  padding: 20px;
  border: 1px solid #f3f4f6;
  box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05);
`;

const StatusDot = styled.span<{ status: string }>`
  width: 10px;
  height: 10px;
  border-radius: 50%;
  display: inline-block;
  background: ${props => {
    switch (props.status) {
      case 'online': return '#10b981';
      case 'on-delivery': return '#4a00e0';
      default: return '#9ca3af';
    }
  }};
  box-shadow: 0 0 10px ${props => props.status === 'online' ? 'rgba(16, 185, 129, 0.4)' : 'transparent'};
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

  if (loading) return <div className="p-10 text-center font-bold">Loading Fleet Data...</div>;

  return (
    <PageContainer>
      <Header>
        <Title><FiTruck /> Fleet Operational View</Title>
        <div className="flex gap-4">
          <div className="flex items-center gap-2 px-4 py-2 bg-white rounded-xl border text-sm font-bold text-gray-600">
            <FiUser /> {armyMembers.filter(m => m.status === 'online').length} Online
          </div>
          <button className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-xl text-sm font-bold shadow-lg shadow-indigo-100">
            <FiZap /> Optimize Routes
          </button>
        </div>
      </Header>

      <MainGrid>
        <MapPlaceholder>
          <div className="z-10 bg-white/90 backdrop-blur shadow-2xl p-6 rounded-3xl text-center border border-white">
            <FiNavigation size={48} className="text-indigo-600 mb-4 mx-auto animate-pulse" />
            <h3 className="text-xl font-extrabold text-gray-800 mb-2">Live Map Interface</h3>
            <p className="text-sm text-gray-500 max-w-[240px]">Mapbox access pending configuration. Live location tracking for {armyMembers.length} active units will appear here.</p>
          </div>
        </MapPlaceholder>

        <Sidebar>
          <h2 className="text-xs font-black text-indigo-400 uppercase tracking-[0.2em] mb-2 px-2">Active Personnel</h2>
          {armyMembers.map(member => (
            <ArmyCard key={member.id} whileHover={{ x: 4 }}>
              <div className="flex justify-between items-start mb-4">
                <div className="flex gap-3">
                  <div className="w-12 h-12 rounded-2xl bg-gray-100 flex items-center justify-center text-xl font-bold text-indigo-600">
                    {member.name?.[0] || 'A'}
                  </div>
                  <div>
                    <h4 className="font-bold text-gray-800">{member.name || 'Army Member'}</h4>
                    <p className="text-xs text-gray-500 font-medium">#{member.id.slice(-6)}</p>
                  </div>
                </div>
                <StatusDot status={member.status} />
              </div>

              <div className="grid grid-cols-2 gap-3 mb-4">
                 <div className="bg-gray-50 p-2 rounded-xl text-center">
                    <p className="text-[10px] font-bold text-gray-400 uppercase">Orders</p>
                    <p className="text-sm font-black text-gray-700">{member.ordersToday || 0}</p>
                 </div>
                 <div className="bg-gray-50 p-2 rounded-xl text-center">
                    <p className="text-[10px] font-bold text-gray-400 uppercase">Rating</p>
                    <p className="text-sm font-black text-gray-700 flex items-center justify-center gap-1">
                      {member.rating || '4.8'} <FiStar size={10} className="fill-amber-400 text-amber-400" />
                    </p>
                 </div>
              </div>

              <div className="flex gap-2">
                <button className="flex-1 py-2 bg-indigo-50 text-indigo-600 text-[11px] font-bold rounded-lg hover:bg-indigo-600 hover:text-white transition-all">
                  Assign Shift
                </button>
                <button className="w-10 h-10 bg-gray-50 text-gray-400 flex items-center justify-center rounded-lg">
                  <FiPhone size={14} />
                </button>
              </div>
            </ArmyCard>
          ))}

          {armyMembers.length === 0 && (
             <div className="p-10 text-center border-2 border-dashed border-gray-100 rounded-2xl text-gray-400">
                <FiUser className="mx-auto mb-2 opacity-20" size={32} />
                <p className="text-xs font-bold">No registered army members found.</p>
             </div>
          )}
        </Sidebar>
      </MainGrid>
    </PageContainer>
  );
}
