'use client';

import React, { useEffect, useState } from 'react';
import styled from 'styled-components';
import { useRouter } from 'next/navigation';
import { subscribeToCollection, Jar, getAllUsers, User, assignJarToCustomer, returnJar, normalizeUser } from '@/lib/firebase';
import { 
  FiPackage, 
  FiLock, 
  FiCheckCircle, 
  FiAlertTriangle, 
  FiSearch,
  FiCalendar,
  FiUser,
  FiPrinter,
  FiPhone,
  FiClock,
  FiFilter,
  FiLogOut,
  FiLogIn,
  FiPlus,
  FiX
} from 'react-icons/fi';
import { useAuth } from '@/context/AuthContext';
import { motion, AnimatePresence } from 'framer-motion';

const Container = styled.div`
  padding: 24px;
`;

const StatsGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
  gap: 16px;
  margin-bottom: 28px;
`;

const StatCard = styled.div<{ $color: string; $glow?: boolean }>`
  background: ${p => p.$glow ? '#fff7ed' : 'white'};
  padding: 20px;
  border-radius: 16px;
  box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
  border-left: 4px solid ${props => props.$color};
  ${p => p.$glow && `box-shadow: 0 0 0 2px rgba(249,115,22,0.15), 0 4px 6px -1px rgba(0,0,0,0.08);`}
`;

const StatLabel = styled.p`
  color: #64748b;
  font-size: 13px;
  font-weight: 600;
  margin-bottom: 4px;
  display: flex;
  align-items: center;
  gap: 6px;
`;

const StatValue = styled.p`
  color: #1e293b;
  font-size: 28px;
  font-weight: 800;
`;

const TableCard = styled.div`
  background: white;
  border-radius: 16px;
  box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
  overflow: hidden;
`;

const OverdueCard = styled.div`
  background: #fff7ed;
  border: 2px solid #fb923c;
  border-radius: 16px;
  overflow: hidden;
  margin-bottom: 24px;
`;

const Controls = styled.div`
  padding: 16px 20px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  border-bottom: 1px solid #f1f5f9;
  flex-wrap: wrap;
  gap: 12px;
`;

const SearchInput = styled.div`
  position: relative;
  width: 280px;
  
  input {
    width: 100%;
    padding: 9px 9px 9px 38px;
    border-radius: 8px;
    border: 1px solid #e2e8f0;
    font-size: 14px;
    outline: none;
    &:focus { border-color: #3b82f6; }
  }
  
  svg {
    position: absolute;
    left: 11px;
    top: 50%;
    transform: translateY(-50%);
    color: #94a3b8;
  }
`;

const FilterTabs = styled.div`
  display: flex;
  gap: 8px;
`;

const FilterTab = styled.button<{ $active: boolean }>`
  padding: 7px 16px;
  border-radius: 8px;
  border: 1px solid ${p => p.$active ? '#3b82f6' : '#e2e8f0'};
  background: ${p => p.$active ? '#eff6ff' : 'white'};
  color: ${p => p.$active ? '#2563eb' : '#64748b'};
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
`;

const Table = styled.table`
  width: 100%;
  border-collapse: collapse;
  
  th {
    text-align: left;
    padding: 14px 16px;
    background: #f8fafc;
    color: #64748b;
    font-size: 12px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.04em;
  }
  
  td {
    padding: 14px 16px;
    border-bottom: 1px solid #f1f5f9;
    font-size: 14px;
    color: #475569;
  }

  tr:last-child td { border-bottom: none; }
  tr:hover td { background: #f8fafc; }
`;

const StatusBadge = styled.span<{ $status: string }>`
  padding: 4px 10px;
  border-radius: 20px;
  font-size: 12px;
  font-weight: 600;
  text-transform: capitalize;
  
  background: ${props => {
    switch(props.$status) {
      case 'available': return '#f0fdf4';
      case 'locked': return '#eff6ff';
      case 'lost': return '#fef2f2';
      default: return '#f8fafc';
    }
  }};
  
  color: ${props => {
    switch(props.$status) {
      case 'available': return '#16a34a';
      case 'locked': return '#2563eb';
      case 'lost': return '#dc2626';
      default: return '#64748b';
    }
  }};
`;

const FlagBadge = styled.span<{ $days: number }>`
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 3px 10px;
  border-radius: 20px;
  font-size: 12px;
  font-weight: 700;
  background: ${p => p.$days >= 7 ? '#fef2f2' : p.$days >= 4 ? '#fff7ed' : '#f0fdf4'};
  color: ${p => p.$days >= 7 ? '#dc2626' : p.$days >= 4 ? '#ea580c' : '#16a34a'};
  border: 1px solid ${p => p.$days >= 7 ? '#fca5a5' : p.$days >= 4 ? '#fdba74' : '#86efac'};
`;

const CallBtn = styled.a`
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 6px 14px;
  border-radius: 8px;
  background: #10b981;
  color: white;
  font-size: 12px;
  font-weight: 700;
  text-decoration: none;
  &:hover { background: #059669; }
`;

const SuccessAlert = styled(motion.div)`
  background: #f0fdf4;
  border: 1px solid #bbf7d0;
  color: #166534;
  padding: 12px 20px;
  border-radius: 12px;
  margin-bottom: 20px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  font-size: 13px;
  font-weight: 600;
  box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05);
`;

const ActionBtn = styled.button<{ $variant: 'unlock' | 'lock' }>`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  padding: 6px 10px;
  border-radius: 8px;
  font-size: 11px;
  font-weight: 700;
  cursor: pointer;
  transition: all 0.2s;
  border: 1px solid transparent;
  width: 100%;

  ${p => p.$variant === 'unlock' && `
    background: #fef2f2;
    color: #dc2626;
    border-color: #fee2e2;
    &:hover { background: #fee2e2; border-color: #fecaca; }
  `}

  ${p => p.$variant === 'lock' && `
    background: #eff6ff;
    color: #2563eb;
    border-color: #dbeafe;
    &:hover { background: #dbeafe; border-color: #bfdbfe; }
  `}

  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
`;

const ModalOverlay = styled(motion.div)`
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.4);
  backdrop-filter: blur(4px);
  z-index: 2000;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 20px;
`;

const ModalContent = styled(motion.div)`
  background: white;
  width: 100%;
  max-width: 480px;
  border-radius: 20px;
  box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04);
  overflow: hidden;
  display: flex;
  flex-direction: column;
  max-height: 80vh;
`;

const ModalHeader = styled.div`
  padding: 20px;
  border-bottom: 1px solid #f1f5f9;
  display: flex;
  align-items: center;
  justify-content: space-between;
  h3 { margin: 0; font-size: 18px; font-weight: 800; color: #0f172a; }
`;

const ModalBody = styled.div`
  padding: 20px;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 16px;
`;

const UserItem = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px;
  border-radius: 12px;
  border: 1px solid #f1f5f9;
  cursor: pointer;
  transition: all 0.2s;
  &:hover { background: #f8fafc; border-color: #e2e8f0; }
  .info {
    .name { font-weight: 700; color: #1e293b; font-size: 14px; }
    .cid { font-size: 11px; color: #94a3b8; font-family: monospace; }
  }
`;

type StatusFilter = 'all' | 'available' | 'locked' | 'lost';

export default function JarsInventoryPage() {
  const [jars, setJars] = useState<Jar[]>([]);
  const [users, setUsers] = useState<Record<string, any>>({});
  const [usersList, setUsersList] = useState<any[]>([]);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [loading, setLoading] = useState(true);
  
  const [isLockModalOpen, setIsLockModalOpen] = useState(false);
  const [selectedJarId, setSelectedJarId] = useState<string | null>(null);
  const [userSearchText, setUserSearchText] = useState('');
  const [isProcessingAction, setIsProcessingAction] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  
  const { currentUser } = useAuth();
  const router = useRouter();

  useEffect(() => {
    getAllUsers().then(u => {
      const normalized = u.map(user => normalizeUser(user));
      setUsersList(normalized);
      const userMap = normalized.reduce((acc, user) => {
        acc[user.id] = user;
        if (user.customerId) acc[user.customerId] = user;
        return acc;
      }, {} as Record<string, any>);
      setUsers(userMap);
    });

    const unsubscribe = subscribeToCollection('jars', (snapshot) => {
      const jarList = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      } as Jar));
      setJars(jarList);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const getDays = (jar: Jar) => {
    if (jar.status !== 'locked') return 0;
    const lastScan = jar.lastScanAt?.toDate ? jar.lastScanAt.toDate() : new Date(jar.lastScanAt);
    return Math.floor((Date.now() - lastScan.getTime()) / (1000 * 3600 * 24));
  };

  const overdueJars = jars
    .filter(j => j.status === 'locked' && getDays(j) >= 4)
    .sort((a, b) => getDays(b) - getDays(a));

  const stats = {
    total: jars.length,
    available: jars.filter(j => j.status === 'available').length,
    locked: jars.filter(j => j.status === 'locked').length,
    lost: jars.filter(j => j.status === 'lost').length,
    overdue: overdueJars.length,
  };

  const filteredJars = jars
    .filter(j => statusFilter === 'all' || j.status === statusFilter)
    .filter(j =>
      j.id.toLowerCase().includes(search.toLowerCase()) ||
      (j.currentOwnerId && users[j.currentOwnerId]?.displayName?.toLowerCase().includes(search.toLowerCase()))
    )
    .sort((a, b) => getDays(b) - getDays(a));

  const getOwnerName = (jar: Jar) => {
    if (!jar.currentOwnerId) return null;
    const u = users[jar.currentOwnerId];
    return u ? u.displayName : null;
  };

  const getPhone = (jar: Jar) => {
    if (!jar.currentOwnerId) return null;
    const u = users[jar.currentOwnerId];
    return u ? u.displayPhone : null;
  };

  const getCustomerId = (jar: Jar) => {
    if (!jar.currentOwnerId) return null;
    const u = users[jar.currentOwnerId];
    return u?.customerId || null;
  };

  const handleManualUnlock = async (jarId: string) => {
    if (!confirm(`Are you sure you want to manually UNLOCK jar ${jarId}? This will return it to the warehouse.`)) return;
    
    setIsProcessingAction(true);
    try {
      const staffId = currentUser?.uid || 'admin_panel';
      await returnJar(jarId, staffId);
      setSuccessMessage(`Success: Jar ${jarId} has been returned to the warehouse.`);
      setTimeout(() => setSuccessMessage(null), 5000);
    } catch (error: any) {
      alert(`Error: ${error.message || 'Failed to unlock jar'}`);
    } finally {
      setIsProcessingAction(false);
    }
  };

  const handleOpenLockModal = (jarId: string) => {
    setSelectedJarId(jarId);
    setUserSearchText('');
    setIsLockModalOpen(true);
  };

  const handleLockJar = async (user: any) => {
    if (!selectedJarId) return;
    
    const ident = user.customerId || user.id;
    if (!confirm(`Manually lock jar ${selectedJarId} to ${user.displayName}?`)) return;

    setIsProcessingAction(true);
    try {
      const staffId = currentUser?.uid || 'admin_panel';
      await assignJarToCustomer(selectedJarId, ident, staffId);
      setSuccessMessage(`Success: Jar ${selectedJarId} is now locked to ${user.displayName}.`);
      setTimeout(() => setSuccessMessage(null), 5000);
      setIsLockModalOpen(false);
      setSelectedJarId(null);
    } catch (error: any) {
      alert(`Error: ${error.message || 'Failed to lock jar'}`);
    } finally {
      setIsProcessingAction(false);
    }
  };

  const filteredUsersForModal = usersList.filter(u => {
    const q = userSearchText.toLowerCase();
    return u.displayName.toLowerCase().includes(q) || u.displayPhone.includes(q) || (u.customerId || '').toLowerCase().includes(q);
  }).slice(0, 5);

  return (
    <Container>
      <div style={{ marginBottom: '28px', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <h1 style={{ fontSize: '26px', fontWeight: '800', color: '#0f172a' }}>Jar Inventory</h1>
          <p style={{ color: '#64748b', fontSize: '14px' }}>Real-time tracking of all 20L jars in circulation</p>
        </div>
        <button
          onClick={() => router.push('/admin/jars/qr-print')}
          style={{
            display: 'flex', alignItems: 'center', gap: '8px',
            padding: '10px 20px', borderRadius: '10px',
            background: '#0f172a', color: '#fff',
            fontWeight: '700', border: 'none', cursor: 'pointer', fontSize: '14px',
          }}
        >
          <FiPrinter /> Print QR Labels
        </button>
      </div>

      <AnimatePresence>
        {successMessage && (
          <SuccessAlert
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <FiCheckCircle color="#22c55e" /> {successMessage}
            </div>
            <button 
              onClick={() => setSuccessMessage(null)}
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#166534', fontWeight: 'bold' }}
            >
              <FiX size={16} />
            </button>
          </SuccessAlert>
        )}
      </AnimatePresence>

      <StatsGrid>
        <StatCard $color="#94a3b8">
          <StatLabel><FiPackage /> Total Jars</StatLabel>
          <StatValue>{stats.total}</StatValue>
        </StatCard>
        <StatCard $color="#10b981">
          <StatLabel><FiCheckCircle /> In Warehouse</StatLabel>
          <StatValue>{stats.available}</StatValue>
        </StatCard>
        <StatCard $color="#3b82f6">
          <StatLabel><FiLock /> With Customers (Holding)</StatLabel>
          <StatValue>{stats.locked}</StatValue>
        </StatCard>
        <StatCard $color="#f97316" $glow={stats.overdue > 0}>
          <StatLabel><FiClock style={{ color: '#f97316' }} /> Overdue (Holding &gt;4 days)</StatLabel>
          <StatValue style={{ color: stats.overdue > 0 ? '#ea580c' : '#1e293b' }}>
            {stats.overdue}
          </StatValue>
        </StatCard>
        <StatCard $color="#ef4444">
          <StatLabel><FiAlertTriangle /> Reported Lost</StatLabel>
          <StatValue>{stats.lost}</StatValue>
        </StatCard>
      </StatsGrid>

      {overdueJars.length > 0 && (
        <OverdueCard>
          <div style={{ padding: '16px 20px', borderBottom: '1px solid #fdba74', display: 'flex', alignItems: 'center', gap: '10px' }}>
            <FiAlertTriangle size={20} color="#ea580c" />
            <div>
              <div style={{ fontWeight: '800', color: '#c2410c', fontSize: '15px' }}>
                {overdueJars.length} Jar{overdueJars.length > 1 ? 's' : ''} Overdue — Contact Required
              </div>
              <div style={{ fontSize: '12px', color: '#9a3412', marginTop: '2px' }}>
                These jars have been held for 4+ days. Call the customer to arrange return.
              </div>
            </div>
          </div>
          <div style={{ overflowX: 'auto' }}>
            <Table>
              <thead>
                <tr>
                  <th>Jar ID</th>
                  <th>Customer</th>
                  <th>Customer ID</th>
                  <th style={{ textAlign: 'center' }}>Days Held</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {overdueJars.map(jar => {
                  const days = getDays(jar);
                  const name = getOwnerName(jar) ?? 'Unknown';
                  const phone = getPhone(jar);
                  const cid = getCustomerId(jar);
                  const waPhone = phone ? phone.replace(/\D/g, '').replace(/^(?!91)/, '91') : '';
                  return (
                    <tr key={jar.id} style={{ background: days >= 7 ? '#fef2f2' : 'transparent' }}>
                      <td style={{ fontWeight: '800', color: '#1e293b', fontFamily: 'monospace' }}>{jar.id}</td>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <FiUser size={14} color="#94a3b8" />
                          <span style={{ fontWeight: '600' }}>{name}</span>
                        </div>
                      </td>
                      <td style={{ fontWeight: '700', color: '#0f172a', fontFamily: 'monospace', fontSize: '13px' }}>
                        {cid || '—'}
                      </td>
                      <td style={{ textAlign: 'center' }}>
                        <FlagBadge $days={days}>
                          {days >= 7 ? '🔴' : '🟡'} {days} days
                        </FlagBadge>
                      </td>
                      <td>
                        {phone ? (
                          <div style={{ display: 'flex', gap: '8px' }}>
                            <CallBtn href={`tel:${phone}`}>
                              <FiPhone size={12} /> Call
                            </CallBtn>
                            <CallBtn
                              href={`https://wa.me/${waPhone}?text=Hi, please return the water jar ${jar.id} held for ${days} days.`}
                              target="_blank"
                              style={{ background: '#25d366' }}
                            >
                              WhatsApp
                            </CallBtn>
                          </div>
                        ) : (
                          <span style={{ color: '#cbd5e1', fontSize: '12px' }}>No phone</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </Table>
          </div>
        </OverdueCard>
      )}

      <TableCard>
        <Controls>
          <SearchInput>
            <FiSearch />
            <input
              type="text"
              placeholder="Search Jar ID or Customer..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </SearchInput>
          <FilterTabs>
            {(['all', 'locked', 'available', 'lost'] as StatusFilter[]).map(f => (
              <FilterTab key={f} $active={statusFilter === f} onClick={() => setStatusFilter(f)}>
                {f === 'all' ? 'All' : f === 'locked' ? 'Holding' : f === 'available' ? 'Warehouse' : f.charAt(0).toUpperCase() + f.slice(1)}
              </FilterTab>
            ))}
          </FilterTabs>
        </Controls>

        {loading ? (
          <div style={{ padding: '40px', textAlign: 'center', color: '#94a3b8' }}>Loading jars...</div>
        ) : (
          <>
            <Table>
              <thead>
                <tr>
                  <th>Jar ID</th>
                  <th>Status</th>
                  <th>Current Owner</th>
                  <th>Last Scan</th>
                  <th style={{ textAlign: 'center' }}>Time</th>
                  <th style={{ textAlign: 'right', paddingRight: '20px' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredJars.map(jar => {
                  const owner = jar.currentOwnerId ? users[jar.currentOwnerId] : null;
                  const lastScan = jar.lastScanAt?.toDate ? jar.lastScanAt.toDate() : new Date(jar.lastScanAt);
                  const days = getDays(jar);

                  return (
                    <tr key={jar.id}>
                      <td style={{ fontWeight: '700', color: '#1e293b', fontFamily: 'monospace' }}>{jar.id}</td>
                      <td>
                        <StatusBadge $status={jar.status}>{jar.status}</StatusBadge>
                      </td>
                      <td>
                        {owner ? (
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <FiUser color="#94a3b8" size={14} />
                            <div>
                              <div style={{ fontWeight: '600', color: '#1e293b' }}>{owner.displayName}</div>
                              <div style={{ fontSize: '11px', color: '#94a3b8' }}>
                                {owner.displayPhone} &bull; <span style={{ color: '#0f172a', fontWeight: 'bold' }}>{owner.customerId || 'ID Pending'}</span>
                              </div>
                            </div>
                          </div>
                        ) : (
                          <span style={{ color: '#cbd5e1' }}>Warehouse</span>
                        )}
                      </td>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#475569' }}>
                          <FiCalendar color="#94a3b8" size={13} />
                          {lastScan.toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })}
                        </div>
                      </td>
                      <td style={{ textAlign: 'center' }}>
                        {jar.status === 'locked' && (
                          <FlagBadge $days={days}>
                            {days >= 7 ? '🔴' : days >= 4 ? '🟡' : '🟢'} {days}d
                          </FlagBadge>
                        )}
                      </td>
                      <td style={{ textAlign: 'right', paddingRight: '16px' }}>
                        {jar.status === 'locked' ? (
                          <ActionBtn 
                            $variant="unlock" 
                            disabled={isProcessingAction}
                            onClick={() => handleManualUnlock(jar.id)}
                          >
                            <FiLogOut size={12}/> Unlock
                          </ActionBtn>
                        ) : jar.status === 'available' ? (
                          <ActionBtn 
                            $variant="lock" 
                            disabled={isProcessingAction}
                            onClick={() => handleOpenLockModal(jar.id)}
                          >
                            <FiLogIn size={12}/> Lock to User
                          </ActionBtn>
                        ) : (
                          <span style={{ color: '#cbd5e1', fontSize: '11px' }}>—</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </Table>

            <AnimatePresence>
              {isLockModalOpen && (
                <ModalOverlay
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                >
                  <ModalContent
                    initial={{ scale: 0.9, y: 20 }}
                    animate={{ scale: 1, y: 0 }}
                    exit={{ scale: 0.9, y: 20 }}
                  >
                    <ModalHeader>
                      <h3>Lock Jar: {selectedJarId}</h3>
                      <button 
                        onClick={() => setIsLockModalOpen(false)}
                        style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748b' }}
                      >
                        <FiX size={20} />
                      </button>
                    </ModalHeader>
                    <ModalBody>
                      <div className="relative">
                        <FiSearch style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
                        <input
                          type="text"
                          placeholder="Search customer name, phone, or ID..."
                          value={userSearchText}
                          onChange={(e) => setUserSearchText(e.target.value)}
                          style={{
                            width: '100%',
                            padding: '12px 12px 12px 38px',
                            borderRadius: '12px',
                            border: '1px solid #e2e8f0',
                            outline: 'none',
                            fontSize: '14px'
                          }}
                          autoFocus
                        />
                      </div>
                      
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        <div style={{ fontSize: '11px', color: '#64748b', fontWeight: '800', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                          Select Customer
                        </div>
                        {filteredUsersForModal.map(user => (
                          <UserItem key={user.id} onClick={() => handleLockJar(user)}>
                            <div className="info">
                              <div className="name">{user.displayName}</div>
                              <div className="cid">{user.customerId} &bull; {user.displayPhone}</div>
                            </div>
                            <FiPlus size={16} color="#3b82f6" />
                          </UserItem>
                        ))}
                        {filteredUsersForModal.length === 0 && (
                          <div style={{ padding: '20px', textAlign: 'center', color: '#94a3b8', fontSize: '13px' }}>
                            {userSearchText ? 'No customers found.' : 'Start typing to search...'}
                          </div>
                        )}
                      </div>
                    </ModalBody>
                  </ModalContent>
                </ModalOverlay>
              )}
            </AnimatePresence>

            {filteredJars.length === 0 && (
              <div style={{ padding: '40px', textAlign: 'center', color: '#94a3b8' }}>
                No jars found matching your search.
              </div>
            )}
          </>
        )}
      </TableCard>
    </Container>
  );
}
