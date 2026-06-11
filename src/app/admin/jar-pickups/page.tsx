'use client';

import React, { useEffect, useState } from 'react';
import styled from 'styled-components';
import { db } from '@/lib/firebase';
import { collection, query, orderBy, onSnapshot, doc, updateDoc } from 'firebase/firestore';
import { 
  FiTruck, 
  FiCheckCircle, 
  FiClock, 
  FiMapPin,
  FiSearch,
  FiUser,
  FiDollarSign,
  FiCalendar,
  FiAlertTriangle
} from 'react-icons/fi';
import { motion } from 'framer-motion';

const Container = styled.div`
  padding: 24px;
`;

const Header = styled.div`
  margin-bottom: 28px;
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 16px;
`;

const Title = styled.h1`
  font-size: 26px;
  font-weight: 800;
  color: #0f172a;
`;

const Subtitle = styled.p`
  color: #64748b;
  font-size: 14px;
`;

const TableCard = styled.div`
  background: white;
  border-radius: 16px;
  box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
  overflow: hidden;
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
  display: inline-flex;
  align-items: center;
  gap: 4px;
  
  background: ${props => {
    switch(props.$status) {
      case 'completed': return '#f0fdf4';
      case 'pending': return '#fff7ed';
      case 'cancelled': return '#fef2f2';
      default: return '#f8fafc';
    }
  }};
  
  color: ${props => {
    switch(props.$status) {
      case 'completed': return '#16a34a';
      case 'pending': return '#ea580c';
      case 'cancelled': return '#dc2626';
      default: return '#64748b';
    }
  }};
`;

const ActionBtn = styled.button<{ $variant?: 'primary' }>`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  padding: 6px 12px;
  border-radius: 8px;
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
  border: 1px solid transparent;
  
  ${p => p.$variant === 'primary' ? `
    background: #f0fdf4;
    color: #16a34a;
    border-color: #bbf7d0;
    &:hover { background: #dcfce7; }
  ` : `
    background: #f1f5f9;
    color: #475569;
    &:hover { background: #e2e8f0; }
  `}
`;

type PickupStatus = 'all' | 'pending' | 'completed' | 'cancelled';

export default function JarPickupsPage() {
  const [pickups, setPickups] = useState<any[]>([]);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<PickupStatus>('all');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const q = query(collection(db, 'jar_pickups'), orderBy('createdAt', 'desc'));
    const unsubscribe = onSnapshot(q,
      snapshot => {
        const list = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        setPickups(list);
        setLoading(false);
      },
      error => {
        console.error("Error fetching jar pickups: ", error);
        setLoading(false);
      }
    );
    return () => unsubscribe();
  }, []);

  const handleMarkCompleted = async (id: string) => {
    if (!confirm('Mark this pickup as completed? This implies jars were collected and refund processed.')) return;
    try {
      const docRef = doc(db, 'jar_pickups', id);
      await updateDoc(docRef, {
        status: 'completed',
        completedAt: new Date()
      });
    } catch (err) {
      alert('Error updating status');
      console.error(err);
    }
  };

  const filteredPickups = pickups
    .filter(p => statusFilter === 'all' || p.status === statusFilter)
    .filter(p => 
      p.customerName?.toLowerCase().includes(search.toLowerCase()) || 
      p.userId?.toLowerCase().includes(search.toLowerCase()) ||
      p.id.toLowerCase().includes(search.toLowerCase())
    );

  return (
    <Container>
      <Header>
        <div>
          <Title>Jar Pickups</Title>
          <Subtitle>Manage user requests for returning empty jars and processing refunds</Subtitle>
        </div>
      </Header>

      <TableCard>
        <Controls>
          <SearchInput>
            <FiSearch />
            <input
              type="text"
              placeholder="Search by name, user ID, or pickup ID..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </SearchInput>
          <FilterTabs>
            {(['all', 'pending', 'completed', 'cancelled'] as PickupStatus[]).map(f => (
              <FilterTab key={f} $active={statusFilter === f} onClick={() => setStatusFilter(f)}>
                {f.charAt(0).toUpperCase() + f.slice(1)}
              </FilterTab>
            ))}
          </FilterTabs>
        </Controls>

        {loading ? (
          <div style={{ padding: '40px', textAlign: 'center', color: '#94a3b8' }}>Loading pickup requests...</div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <Table>
              <thead>
                <tr>
                  <th>Customer Info</th>
                  <th>Pickup Address</th>
                  <th>Schedule</th>
                  <th>Jars & Refund</th>
                  <th>Status</th>
                  <th style={{ textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredPickups.map(pickup => (
                  <tr key={pickup.id}>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <FiUser color="#94a3b8" />
                        <div>
                          <div style={{ fontWeight: '600', color: '#1e293b' }}>{pickup.customerName}</div>
                          <div style={{ fontSize: '11px', color: '#94a3b8', fontFamily: 'monospace' }}>
                            {pickup.userId}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'flex-start', gap: '6px' }}>
                        <FiMapPin color="#64748b" style={{ marginTop: '3px', flexShrink: 0 }} />
                        <div>
                          <div style={{ fontSize: '13px', color: '#334155', maxWidth: '200px', lineHeight: '1.4' }}>
                            {pickup.address}
                          </div>
                          <div style={{ fontSize: '11px', color: '#94a3b8', marginTop: '2px', textTransform: 'capitalize' }}>
                            {pickup.addressType || 'Home'}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td>
                      <div style={{ color: '#0f172a', fontWeight: '600', fontSize: '13px' }}>
                        {pickup.selectedDate}
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '12px', color: '#64748b', marginTop: '4px' }}>
                        <FiClock size={12} /> {pickup.selectedSlot}
                      </div>
                    </td>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontWeight: '700', color: '#0f172a' }}>
                        <FiTruck color="#3b82f6" /> {pickup.quantity} {pickup.quantity === 1 ? 'Jar' : 'Jars'}
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '13px', color: '#10b981', marginTop: '4px', fontWeight: '600' }}>
                        <FiDollarSign size={12} /> ₹{pickup.refundAmount?.toFixed(0)} Refund
                      </div>
                    </td>
                    <td>
                      <StatusBadge $status={pickup.status}>
                        {pickup.status === 'pending' && <FiClock size={10} />}
                        {pickup.status === 'completed' && <FiCheckCircle size={10} />}
                        {pickup.status}
                      </StatusBadge>
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      {pickup.status === 'pending' ? (
                        <ActionBtn $variant="primary" onClick={() => handleMarkCompleted(pickup.id)}>
                          <FiCheckCircle size={14} /> Mark Complete
                        </ActionBtn>
                      ) : (
                        <span style={{ fontSize: '12px', color: '#cbd5e1' }}>—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </Table>
            {filteredPickups.length === 0 && (
              <div style={{ padding: '40px', textAlign: 'center', color: '#94a3b8' }}>
                No pickup requests found.
              </div>
            )}
          </div>
        )}
      </TableCard>
    </Container>
  );
}
