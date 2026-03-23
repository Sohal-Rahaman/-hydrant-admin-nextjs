'use client';

import React, { useState, useEffect } from 'react';
import styled from 'styled-components';
import { motion, AnimatePresence } from 'framer-motion';
import {
  FiActivity, FiSearch, FiFilter, FiUser, FiPackage,
  FiCreditCard, FiTrash2, FiClock, FiRefreshCw
} from 'react-icons/fi';
import { collection, query, orderBy, limit, onSnapshot } from 'firebase/firestore';
import { db } from '@/lib/firebase';

interface ActivityLog {
  id: string;
  action: string;
  actor: 'ADMIN' | 'USER' | 'SYSTEM';
  actorName: string;
  actorId: string;
  details: string;
  targetId?: string;
  timestamp: any;
  metadata?: any;
}

const getActivityIcon = (action: string) => {
  const upperAction = action.toUpperCase();
  if (upperAction.includes('ORDER')) return <FiPackage />;
  if (upperAction.includes('WALLET') || upperAction.includes('PAYMENT')) return <FiCreditCard />;
  if (upperAction.includes('DELETE')) return <FiTrash2 />;
  if (upperAction.includes('JAR')) return <FiPackage />;
  return <FiActivity />;
};

const getActivityColor = (action: string) => {
  const upperAction = action.toUpperCase();
  if (upperAction.includes('PLACED') || upperAction.includes('SUCCESS')) return 'linear-gradient(135deg, #10b981 0%, #059669 100%)';
  if (upperAction.includes('CANCELLED') || upperAction.includes('DELETE') || upperAction.includes('FAIL')) return 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)';
  if (upperAction.includes('DELIVERED')) return 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)';
  if (upperAction.includes('WALLET') || upperAction.includes('PAYMENT')) return 'linear-gradient(135deg, #8b5cf6 0%, #6d28d9 100%)';
  if (upperAction.includes('JAR')) return 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)';
  return 'linear-gradient(135deg, #64748b 0%, #475569 100%)';
};

const Container = styled.div`
  padding: 30px;
  max-width: 1400px;
  margin: 0 auto;
  font-family: 'Inter', sans-serif;
`;

const Header = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 40px;
  flex-wrap: wrap;
  gap: 20px;
`;

const Title = styled.h1`
  font-size: 2.2rem;
  font-weight: 800;
  color: #1e293b;
  display: flex;
  align-items: center;
  gap: 12px;
  
  svg {
    color: #8e2de2;
  }
`;

const ControlBar = styled.div`
  display: flex;
  gap: 15px;
  align-items: center;
`;

const SearchBox = styled.div`
  position: relative;
  display: flex;
  align-items: center;
`;

const SearchIcon = styled(FiSearch)`
  position: absolute;
  left: 15px;
  color: #64748b;
  font-size: 1.1rem;
`;

const SearchInput = styled.input`
  padding: 14px 16px 14px 45px;
  border: 2px solid #e2e8f0;
  border-radius: 12px;
  font-size: 0.95rem;
  width: 350px;
  background: white;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  
  &:focus {
    outline: none;
    border-color: #8e2de2;
    box-shadow: 0 0 0 4px rgba(142, 45, 226, 0.1);
    width: 400px;
  }
`;

const FilterButton = styled.button`
  padding: 14px 20px;
  background: white;
  border: 2px solid #e2e8f0;
  border-radius: 12px;
  color: #475569;
  font-weight: 600;
  display: flex;
  align-items: center;
  gap: 8px;
  cursor: pointer;
  transition: all 0.2s ease;
  
  &:hover {
    background: #f8fafc;
    border-color: #cbd5e1;
  }
`;

const ActivityTimeline = styled.div`
  position: relative;
  
  &::before {
    content: '';
    position: absolute;
    top: 0;
    bottom: 0;
    left: 45px;
    width: 2px;
    background: #e2e8f0;
    border-radius: 2px;
  }
`;

const ActivityCard = styled(motion.div)`
  display: flex;
  gap: 25px;
  margin-bottom: 25px;
  position: relative;
`;

const IconWrapper = styled.div<{ $bg: string }>`
  width: 50px;
  height: 50px;
  border-radius: 14px;
  background: ${props => props.$bg};
  color: white;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 1.5rem;
  flex-shrink: 0;
  box-shadow: 0 4px 15px rgba(0,0,0,0.1);
  z-index: 1;
  border: 4px solid #f8f9fa;
`;

const ContentBox = styled.div`
  background: rgba(255, 255, 255, 0.7);
  backdrop-filter: blur(10px);
  -webkit-backdrop-filter: blur(10px);
  border: 1px solid rgba(255, 255, 255, 0.5);
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.03);
  padding: 24px;
  border-radius: 16px;
  flex: 1;
  transition: all 0.3s ease;
  
  &:hover {
    transform: translateY(-2px);
    box-shadow: 0 8px 30px rgba(0, 0, 0, 0.08);
    background: white;
  }
`;

const ActivityHeader = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
`;

const ActionType = styled.h3`
  margin: 0;
  font-size: 1.1rem;
  font-weight: 700;
  color: #1e293b;
`;

const TimeTag = styled.div`
  font-size: 0.85rem;
  color: #64748b;
  display: flex;
  align-items: center;
  gap: 6px;
  font-weight: 500;
  background: #f1f5f9;
  padding: 4px 10px;
  border-radius: 20px;
`;

const DetailsText = styled.p`
  margin: 0 0 16px 0;
  color: #475569;
  font-size: 0.95rem;
  line-height: 1.5;
`;

const MetaGrid = styled.div`
  display: flex;
  gap: 15px;
  background: #f8fafc;
  padding: 12px 16px;
  border-radius: 10px;
  font-size: 0.85rem;
  border: 1px solid #e2e8f0;
`;

const MetaItem = styled.div`
  display: flex;
  align-items: center;
  gap: 6px;
  color: #334155;
  font-weight: 500;
  
  strong {
    color: #0f172a;
  }
`;

const EmptyState = styled.div`
  text-align: center;
  padding: 60px 20px;
  color: #64748b;
  background: white;
  border-radius: 20px;
  border: 2px dashed #e2e8f0;
  
  svg {
    font-size: 3rem;
    color: #cbd5e1;
    margin-bottom: 15px;
  }
`;

export default function ActivityLogPage() {
  const [activities, setActivities] = useState<ActivityLog[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    console.log('🔍 Setting up Activity Log subscription...');
    const q = query(
      collection(db, 'admin_activities'),
      orderBy('timestamp', 'desc'),
      limit(100)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const logs = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        timestamp: doc.data().timestamp?.toDate() || new Date()
      })) as ActivityLog[];
      
      setActivities(logs);
      setLoading(false);
    }, (error) => {
      console.error('Error fetching activities:', error);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const formatDate = (date: Date) => {
    return date.toLocaleString('en-US', {
      month: 'short', day: 'numeric',
      hour: '2-digit', minute: '2-digit', second: '2-digit'
    });
  };

  const filteredActivities = activities.filter(activity => 
    activity.action.toLowerCase().includes(searchTerm.toLowerCase()) ||
    activity.details.toLowerCase().includes(searchTerm.toLowerCase()) ||
    activity.actorName.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <Container>
      <Header>
        <Title>
          <div style={{ background: '#f5f3ff', padding: '12px', borderRadius: '14px' }}>
            <FiActivity />
          </div>
          Global Activity Feed
        </Title>
        <ControlBar>
          <SearchBox>
            <SearchIcon />
            <SearchInput 
              placeholder="Search by user, action, or details..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </SearchBox>
          <FilterButton>
            <FiFilter /> Filters
          </FilterButton>
        </ControlBar>
      </Header>

      {loading ? (
        <EmptyState>
          <FiRefreshCw className="animate-spin" />
          <h3>Loading Activity Stream...</h3>
        </EmptyState>
      ) : filteredActivities.length === 0 ? (
        <EmptyState>
          <FiActivity />
          <h3>No Activities Found</h3>
          <p>We couldn't find any activities matching your search or none have been logged yet.</p>
        </EmptyState>
      ) : (
        <ActivityTimeline>
          <AnimatePresence>
            {filteredActivities.map((activity, index) => (
              <ActivityCard 
                key={activity.id}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, scale: 0.95 }}
                transition={{ duration: 0.3, delay: index * 0.05 }}
              >
                <IconWrapper $bg={getActivityColor(activity.action)}>
                  {getActivityIcon(activity.action)}
                </IconWrapper>
                <ContentBox>
                  <ActivityHeader>
                    <ActionType>{activity.action.replace(/_/g, ' ')}</ActionType>
                    <TimeTag>
                      <FiClock /> {formatDate(activity.timestamp)}
                    </TimeTag>
                  </ActivityHeader>
                  <DetailsText>{activity.details}</DetailsText>
                  <MetaGrid>
                    <MetaItem>
                      <FiUser /> 
                      Actor: <strong>{activity.actorName} ({activity.actor})</strong>
                    </MetaItem>
                    {activity.actorId && (
                      <MetaItem>ID: {activity.actorId.substring(0, 8)}...</MetaItem>
                    )}
                    {activity.targetId && (
                      <MetaItem>Target: {activity.targetId.substring(0, 8)}...</MetaItem>
                    )}
                  </MetaGrid>
                </ContentBox>
              </ActivityCard>
            ))}
          </AnimatePresence>
        </ActivityTimeline>
      )}
    </Container>
  );
}
