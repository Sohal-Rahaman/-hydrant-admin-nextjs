'use client';

import React, { useEffect, useState } from 'react';
import styled from 'styled-components';
import { collection, onSnapshot, query, orderBy } from 'firebase/firestore';
import { db, AdminSession, revokeAdminSession, revokeAllUserSessions, revokeAllActiveSessionsGlobally } from '@/lib/firebase';
import { useAuth } from '@/context/AuthContext';
import { FiMonitor, FiSmartphone, FiClock, FiShield, FiXCircle, FiRefreshCw } from 'react-icons/fi';

const Container = styled.div`
  padding: 24px;
  background-color: #020617; /* Very Dark Slate */
  color: #f8fafc;
  min-height: 100%;
  border-radius: 12px;
`;

const Header = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 32px;
  border-bottom: 1px solid #1e293b;
  padding-bottom: 16px;
`;

const Title = styled.h1`
  font-size: 1.8rem;
  font-weight: 800;
  color: #f8fafc;
  display: flex;
  align-items: center;
  gap: 12px;
  
  svg {
    color: #84cc16; /* Acid Green */
  }
`;

const Subtitle = styled.p`
  color: #94a3b8;
  margin-top: 8px;
  font-size: 0.95rem;
`;

const StatsGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 20px;
  margin-bottom: 32px;
`;

const StatCard = styled.div`
  background: #0f172a;
  border: 1px solid #1e293b;
  border-radius: 12px;
  padding: 20px;
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  position: relative;
  overflow: hidden;
  
  &::before {
    content: '';
    position: absolute;
    top: 0;
    left: 0;
    width: 4px;
    height: 100%;
    background: #84cc16;
  }
`;

const StatValue = styled.div`
  font-size: 2rem;
  font-weight: 800;
  color: #f8fafc;
  margin-top: 8px;
`;

const StatLabel = styled.div`
  font-size: 0.85rem;
  color: #94a3b8;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  font-weight: 600;
`;

const Grid = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(350px, 1fr));
  gap: 24px;
`;

const SessionCard = styled.div<{ $isCurrent: boolean }>`
  background: #0f172a;
  border: 1px solid ${props => props.$isCurrent ? '#84cc16' : '#1e293b'};
  border-radius: 12px;
  padding: 20px;
  position: relative;
  transition: all 0.2s ease;
  
  &:hover {
    border-color: #334155;
    transform: translateY(-2px);
    box-shadow: 0 10px 25px rgba(0,0,0,0.5);
  }
`;

const CardHeader = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 16px;
`;

const UserInfo = styled.div`
  display: flex;
  flex-direction: column;
`;

const UserName = styled.span`
  font-weight: 700;
  font-size: 1.1rem;
  color: #f8fafc;
  display: flex;
  align-items: center;
  gap: 8px;
`;

const CurrentBadge = styled.span`
  background: rgba(132, 204, 22, 0.1);
  color: #84cc16;
  padding: 2px 8px;
  border-radius: 12px;
  font-size: 0.7rem;
  font-weight: 800;
  text-transform: uppercase;
  letter-spacing: 0.05em;
`;

const UserPhone = styled.span`
  color: #94a3b8;
  font-size: 0.85rem;
  margin-top: 4px;
`;

const DeviceInfo = styled.div`
  display: flex;
  align-items: center;
  gap: 12px;
  background: #1e293b;
  padding: 12px;
  border-radius: 8px;
  margin-bottom: 16px;
`;

const DeviceIcon = styled.div`
  font-size: 1.5rem;
  color: #f8fafc;
`;

const DeviceText = styled.div`
  display: flex;
  flex-direction: column;
`;

const OSName = styled.span`
  font-weight: 600;
  font-size: 0.95rem;
`;

const BrowserName = styled.span`
  color: #94a3b8;
  font-size: 0.8rem;
`;

const MetaGrid = styled.div`
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
  margin-bottom: 20px;
  font-size: 0.85rem;
`;

const MetaItem = styled.div`
  display: flex;
  flex-direction: column;
  gap: 4px;
`;

const MetaLabel = styled.span`
  color: #64748b;
  font-weight: 600;
  text-transform: uppercase;
  font-size: 0.75rem;
`;

const MetaValue = styled.span<{ $isWarning?: boolean }>`
  color: ${props => props.$isWarning ? '#f97316' : '#cbd5e1'};
  display: flex;
  align-items: center;
  gap: 6px;
`;

const ActionArea = styled.div`
  display: flex;
  gap: 12px;
  border-top: 1px solid #1e293b;
  padding-top: 16px;
`;

const Button = styled.button<{ $variant?: 'danger' | 'warning' }>`
  background: ${props => props.$variant === 'danger' ? 'rgba(239, 68, 68, 0.1)' : props.$variant === 'warning' ? 'rgba(249, 115, 22, 0.1)' : '#1e293b'};
  color: ${props => props.$variant === 'danger' ? '#ef4444' : props.$variant === 'warning' ? '#f97316' : '#f8fafc'};
  border: 1px solid ${props => props.$variant === 'danger' ? 'rgba(239, 68, 68, 0.2)' : props.$variant === 'warning' ? 'rgba(249, 115, 22, 0.2)' : '#334155'};
  padding: 8px 16px;
  border-radius: 6px;
  font-weight: 600;
  font-size: 0.85rem;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  flex: 1;
  transition: all 0.2s ease;

  &:hover {
    background: ${props => props.$variant === 'danger' ? '#ef4444' : props.$variant === 'warning' ? '#f97316' : '#334155'};
    color: ${props => (props.$variant === 'danger' || props.$variant === 'warning') ? '#fff' : '#f8fafc'};
  }
`;

const formatTimeAgo = (date: Date) => {
  const seconds = Math.floor((new Date().getTime() - date.getTime()) / 1000);
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
};

const formatTimeLeft = (expiresAt: Date) => {
  const ms = expiresAt.getTime() - new Date().getTime();
  if (ms <= 0) return 'Expired';
  const hours = Math.floor(ms / (1000 * 60 * 60));
  const minutes = Math.floor((ms % (1000 * 60 * 60)) / (1000 * 60));
  return `${hours}h ${minutes}m`;
};

export default function SecurityCenter() {
  const { role } = useAuth();
  const [sessions, setSessions] = useState<AdminSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);

  useEffect(() => {
    setCurrentSessionId(localStorage.getItem('hydrant_admin_session_id'));

    const q = query(
      collection(db, 'admin_sessions'),
      orderBy('lastActive', 'desc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const activeSessions: AdminSession[] = [];
      snapshot.forEach((doc) => {
        const data = doc.data();
        if (data.status === 'active') {
          activeSessions.push({
            id: doc.id,
            ...data,
            createdAt: typeof data.createdAt?.toDate === 'function' ? data.createdAt.toDate() : new Date(data.createdAt),
            lastActive: typeof data.lastActive?.toDate === 'function' ? data.lastActive.toDate() : new Date(data.lastActive),
            expiresAt: typeof data.expiresAt?.toDate === 'function' ? data.expiresAt.toDate() : new Date(data.expiresAt),
          } as AdminSession);
        }
      });
      setSessions(activeSessions);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  if (role !== 'superadmin') {
    return (
      <Container>
        <Title><FiXCircle color="#ef4444" /> Access Denied</Title>
        <Subtitle>You must be a superadmin to access the Security Center.</Subtitle>
      </Container>
    );
  }

  const handleRevoke = async (sessionId: string) => {
    if (confirm('Are you sure you want to revoke this session? The device will be immediately logged out.')) {
      await revokeAdminSession(sessionId);
    }
  };

  const handleRevokeAllForUser = async (uid: string, name: string) => {
    if (confirm(`Are you sure you want to log out ${name} from ALL devices?`)) {
      await revokeAllUserSessions(uid);
    }
  };

  const handleGlobalLockdown = async () => {
    if (confirm('🚨 DANGER: Are you sure you want to log out ALL users from ALL devices globally?')) {
      await revokeAllActiveSessionsGlobally();
    }
  };

  const activeUsersCount = new Set(sessions.map(s => s.uid)).size;

  return (
    <Container>
      <Header>
        <div>
          <Title><FiShield /> Security Center</Title>
          <Subtitle>Monitor and manage active admin sessions across all devices.</Subtitle>
        </div>
        <Button $variant="danger" style={{ flex: 'none', padding: '12px 24px', fontSize: '1rem' }} onClick={handleGlobalLockdown}>
          <FiXCircle /> Global Lockdown (Logout All)
        </Button>
      </Header>

      <StatsGrid>
        <StatCard>
          <StatLabel>Active Sessions</StatLabel>
          <StatValue>{sessions.length}</StatValue>
        </StatCard>
        <StatCard>
          <StatLabel>Online Admins</StatLabel>
          <StatValue>{activeUsersCount}</StatValue>
        </StatCard>
      </StatsGrid>

      {loading ? (
        <div style={{ padding: '40px', textAlign: 'center', color: '#94a3b8' }}>
          <FiRefreshCw className="animate-spin" style={{ display: 'inline', marginRight: '8px' }} /> 
          Loading sessions...
        </div>
      ) : (
        <Grid>
          {sessions.map(session => {
            const isCurrent = session.id === currentSessionId;
            const isMobile = session.os === 'iOS' || session.os === 'Android';
            const timeLeft = formatTimeLeft(session.expiresAt);
            const isExpiringSoon = session.expiresAt.getTime() - new Date().getTime() < 4 * 60 * 60 * 1000; // less than 4 hours
            
            return (
              <SessionCard key={session.id} $isCurrent={isCurrent}>
                <CardHeader>
                  <UserInfo>
                    <UserName>
                      {session.name}
                      {isCurrent && <CurrentBadge>This Device</CurrentBadge>}
                    </UserName>
                    <UserPhone>{session.phone}</UserPhone>
                  </UserInfo>
                </CardHeader>

                <DeviceInfo>
                  <DeviceIcon>
                    {isMobile ? <FiSmartphone /> : <FiMonitor />}
                  </DeviceIcon>
                  <DeviceText>
                    <OSName>{session.os}</OSName>
                    <BrowserName>{session.browser}</BrowserName>
                  </DeviceText>
                </DeviceInfo>

                <MetaGrid>
                  <MetaItem>
                    <MetaLabel>Last Active</MetaLabel>
                    <MetaValue>
                      <FiClock size={12} /> {formatTimeAgo(session.lastActive)}
                    </MetaValue>
                  </MetaItem>
                  <MetaItem>
                    <MetaLabel>Auto Logout In</MetaLabel>
                    <MetaValue $isWarning={isExpiringSoon}>
                      {timeLeft}
                    </MetaValue>
                  </MetaItem>
                </MetaGrid>

                <ActionArea>
                  {!isCurrent && (
                    <Button $variant="danger" onClick={() => handleRevoke(session.id)}>
                      <FiXCircle /> Revoke Device
                    </Button>
                  )}
                  <Button $variant="warning" onClick={() => handleRevokeAllForUser(session.uid, session.name)}>
                    Log Out Everywhere
                  </Button>
                </ActionArea>
              </SessionCard>
            );
          })}
        </Grid>
      )}
    </Container>
  );
}
