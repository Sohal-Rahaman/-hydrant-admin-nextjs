'use client';

import React, { useEffect, useState } from 'react';
import styled from 'styled-components';
import { useRouter } from 'next/navigation';
import { subscribeToCollection, Jar, getAllUsers, User } from '@/lib/firebase';
import { 
  FiPackage, 
  FiLock, 
  FiCheckCircle, 
  FiAlertTriangle, 
  FiSearch,
  FiCalendar,
  FiUser,
  FiPrinter
} from 'react-icons/fi';

const Container = styled.div`
  padding: 24px;
`;

const StatsGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 20px;
  margin-bottom: 32px;
`;

const StatCard = styled.div<{ $color: string }>`
  background: white;
  padding: 20px;
  border-radius: 16px;
  box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
  border-left: 4px solid ${props => props.$color};
`;

const StatLabel = styled.p`
  color: #64748b;
  font-size: 14px;
  font-weight: 600;
  margin-bottom: 4px;
`;

const StatValue = styled.p`
  color: #1e293b;
  font-size: 24px;
  font-weight: 700;
`;

const TableCard = styled.div`
  background: white;
  border-radius: 16px;
  box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
  overflow: hidden;
`;

const Controls = styled.div`
  padding: 20px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  border-bottom: 1px solid #f1f5f9;
  flex-wrap: wrap;
  gap: 16px;
`;

const SearchInput = styled.div`
  position: relative;
  width: 300px;
  
  input {
    width: 100%;
    padding: 10px 10px 10px 40px;
    border-radius: 8px;
    border: 1px solid #e2e8f0;
    font-size: 14px;
  }
  
  svg {
    position: absolute;
    left: 12px;
    top: 50%;
    transform: translateY(-50%);
    color: #94a3b8;
  }
`;

const Table = styled.table`
  width: 100%;
  border-collapse: collapse;
  
  th {
    text-align: left;
    padding: 16px;
    background: #f8fafc;
    color: #64748b;
    font-size: 13px;
    font-weight: 600;
    text-transform: uppercase;
  }
  
  td {
    padding: 16px;
    border-bottom: 1px solid #f1f5f9;
    font-size: 14px;
    color: #475569;
  }
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

export default function JarsInventoryPage() {
  const [jars, setJars] = useState<Jar[]>([]);
  const [users, setUsers] = useState<Record<string, User>>({});
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    // Fetch users for mapping IDs to names
    getAllUsers().then(u => {
      const userMap = u.reduce((acc, user) => {
        acc[user.id] = user;
        if (user.customerId) acc[user.customerId] = user;
        return acc;
      }, {} as Record<string, User>);
      setUsers(userMap);
    });

    // Subscribe to Jars
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

  const stats = {
    total: jars.length,
    available: jars.filter(j => j.status === 'available').length,
    locked: jars.filter(j => j.status === 'locked').length,
    lost: jars.filter(j => j.status === 'lost').length
  };

  const filteredJars = jars.filter(j => 
    j.id.toLowerCase().includes(search.toLowerCase()) || 
    (j.currentOwnerId && users[j.currentOwnerId]?.name?.toLowerCase().includes(search.toLowerCase()))
  );

  return (
    <Container>
      <div style={{ marginBottom: '32px', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <h1 style={{ fontSize: '28px', fontWeight: '800', color: '#0f172a' }}>Jar Inventory</h1>
          <p style={{ color: '#64748b' }}>Real-time tracking of all 20L jars in circulation</p>
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

      <StatsGrid>
        <StatCard $color="#94a3b8">
          <StatLabel><FiPackage style={{ marginBottom: '-2px' }} /> Total Jars</StatLabel>
          <StatValue>{stats.total}</StatValue>
        </StatCard>
        <StatCard $color="#10b981">
          <StatLabel><FiCheckCircle style={{ marginBottom: '-2px' }} /> In Warehouse</StatLabel>
          <StatValue>{stats.available}</StatValue>
        </StatCard>
        <StatCard $color="#3b82f6">
          <StatLabel><FiLock style={{ marginBottom: '-2px' }} /> With Customers</StatLabel>
          <StatValue>{stats.locked}</StatValue>
        </StatCard>
        <StatCard $color="#ef4444">
          <StatLabel><FiAlertTriangle style={{ marginBottom: '-2px' }} /> Reported Lost</StatLabel>
          <StatValue>{stats.lost}</StatValue>
        </StatCard>
      </StatsGrid>

      <TableCard>
        <Controls>
          <SearchInput>
            <FiSearch />
            <input 
              type="text" 
              placeholder="Search by Jar ID or Customer..." 
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </SearchInput>
        </Controls>

        <Table>
          <thead>
            <tr>
              <th>Jar ID</th>
              <th>Status</th>
              <th>Current Owner</th>
              <th>Last Scan At</th>
              <th>Hold Time</th>
            </tr>
          </thead>
          <tbody>
            {filteredJars.map(jar => {
              const owner = jar.currentOwnerId ? users[jar.currentOwnerId] : null;
              const lastScan = jar.lastScanAt?.toDate ? jar.lastScanAt.toDate() : new Date(jar.lastScanAt);
              const holdDays = jar.status === 'locked' 
                ? Math.floor((new Date().getTime() - lastScan.getTime()) / (1000 * 3600 * 24))
                : 0;

              return (
                <tr key={jar.id}>
                  <td style={{ fontWeight: '700', color: '#1e293b' }}>{jar.id}</td>
                  <td>
                    <StatusBadge $status={jar.status}>{jar.status}</StatusBadge>
                  </td>
                  <td>
                    {owner ? (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <FiUser color="#94a3b8" />
                        <div>
                          <div style={{ fontWeight: '600' }}>{owner.name || owner.full_name}</div>
                          <div style={{ fontSize: '11px', color: '#94a3b8' }}>
                            {owner.phone} &bull; <span style={{ color: '#0f172a', fontWeight: 'bold' }}>{owner.customerId || 'ID Pending'}</span>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <span style={{ color: '#cbd5e1' }}>Warehouse</span>
                    )}
                  </td>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <FiCalendar color="#94a3b8" />
                      {lastScan.toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })}
                    </div>
                  </td>
                  <td>
                    {jar.status === 'locked' && (
                      <span style={{ 
                        color: holdDays > 5 ? '#dc2626' : '#64748b',
                        fontWeight: holdDays > 5 ? '700' : '400'
                      }}>
                        {holdDays} days
                      </span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </Table>
        
        {filteredJars.length === 0 && (
          <div style={{ padding: '40px', textAlign: 'center', color: '#94a3b8' }}>
            No jars found matching your search.
          </div>
        )}
      </TableCard>
    </Container>
  );
}
