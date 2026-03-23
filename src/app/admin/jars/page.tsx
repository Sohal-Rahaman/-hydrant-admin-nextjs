'use client';

import React, { useState, useEffect, useMemo } from 'react';
import styled from 'styled-components';
import { subscribeToCollection, updateDocument } from '@/lib/firebase';
import { logActivity } from '@/lib/activityLogger';
import { useAuth } from '@/context/AuthContext';
import { FiSearch, FiEdit3, FiSave, FiX, FiBox, FiPhone, FiMessageCircle } from 'react-icons/fi';

interface User {
  id: string;
  name: string;
  phone: string;
  customerId: string;
  jars_occupied: number;
  jarHold: number;
}

const PageContainer = styled.div`
  padding: 24px;
  max-width: 1200px;
  margin: 0 auto;
`;

const Header = styled.div`
  margin-bottom: 24px;
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  flex-wrap: wrap;
  gap: 16px;
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

const SummaryCard = styled.div`
  background: white;
  padding: 16px 24px;
  border-radius: 12px;
  box-shadow: 0 1px 3px rgba(0,0,0,0.1);
  display: flex;
  align-items: center;
  gap: 16px;
  border: 1px solid #e5e7eb;
`;

const SummaryIcon = styled.div`
  width: 48px;
  height: 48px;
  border-radius: 12px;
  background: #eff6ff;
  color: #3b82f6;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 24px;
`;

const SummaryInfo = styled.div``;

const SummaryValue = styled.div`
  font-size: 20px;
  font-weight: 700;
  color: #111827;
`;

const SummaryLabel = styled.div`
  font-size: 13px;
  color: #6b7280;
  font-weight: 500;
`;

const ControlsContainer = styled.div`
  margin-bottom: 24px;
`;

const SearchBox = styled.div`
  position: relative;
  max-width: 400px;

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
    border-color: #3b82f6;
    box-shadow: 0 0 0 2px rgba(59, 130, 246, 0.1);
  }
`;

const ListCard = styled.div`
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

const UserInfo = styled.div`
  display: flex;
  align-items: center;
  gap: 12px;
`;

const Avatar = styled.div`
  width: 40px;
  height: 40px;
  border-radius: 20px;
  background: linear-gradient(135deg, #0ea5e9 0%, #2563eb 100%);
  color: white;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 16px;
  font-weight: 600;
`;

const NameColumn = styled.div`
  display: flex;
  flex-direction: column;
`;

const NameText = styled.span`
  font-weight: 600;
  color: #111827;
`;

const IdText = styled.span`
  font-size: 12px;
  color: #6b7280;
  background: #f3f4f6;
  padding: 2px 6px;
  border-radius: 4px;
  margin-top: 4px;
  display: inline-block;
  width: fit-content;
`;

const JarBadge = styled.span`
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 6px 12px;
  border-radius: 999px;
  font-size: 14px;
  font-weight: 700;
  background: #eff6ff;
  color: #1d4ed8;
  border: 1px solid #bfdbfe;
`;

const ActionButtons = styled.div`
  display: flex;
  gap: 8px;
`;

const IconBtn = styled.button<{ $color: string; $bg?: string }>`
  width: 32px;
  height: 32px;
  border-radius: 6px;
  border: 1px solid ${props => props.$bg ? 'transparent' : '#e5e7eb'};
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  background: ${props => props.$bg || 'white'};
  color: ${props => props.$color};
  transition: all 0.2s;

  &:hover {
    background: ${props => props.$bg ? props.$bg + 'CC' : '#f9fafb'};
    border-color: ${props => props.$bg ? 'transparent' : '#d1d5db'};
  }
  
  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
`;

const EditInput = styled.input`
  width: 80px;
  padding: 8px 12px;
  border: 1px solid #3b82f6;
  border-radius: 6px;
  font-size: 14px;
  font-weight: 600;
  color: #111827;
  outline: none;
  
  &:focus {
    box-shadow: 0 0 0 2px rgba(59, 130, 246, 0.2);
  }
`;

const EmptyState = styled.div`
  padding: 48px;
  text-align: center;
  color: #6b7280;
`;

export default function JarHoldingsPage() {
  const { userData } = useAuth();
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState<string>('');
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    const unsub = subscribeToCollection('users', (snapshot) => {
      const formatted: User[] = snapshot.docs.map((d: any) => ({
        id: d.id,
        name: d.full_name || d.name || d.firstName + ' ' + (d.lastName || '') || 'Unknown',
        phone: d.phone || d.phoneNumber || '',
        customerId: d.customerId || '',
        jars_occupied: Number(d.jars_occupied) || 0,
        jarHold: Number(d.jarHold) || 0,
      }));
      setUsers(formatted);
      setLoading(false);
    });
    return () => unsub();
  }, []);

  const filteredUsers = useMemo(() => {
    // Only show users with jars
    let result = users.filter(u => (u.jars_occupied > 0 || u.jarHold > 0));

    if (searchTerm) {
      const q = searchTerm.toLowerCase();
      result = result.filter(u => 
        u.name.toLowerCase().includes(q) ||
        u.phone.includes(q) ||
        u.customerId.toLowerCase().includes(q)
      );
    }

    // Sort descending by jar count
    result.sort((a, b) => {
      const countA = a.jars_occupied || a.jarHold || 0;
      const countB = b.jars_occupied || b.jarHold || 0;
      return countB - countA;
    });

    return result;
  }, [users, searchTerm]);

  const totalJarsCount = useMemo(() => {
    return filteredUsers.reduce((sum, u) => sum + (u.jars_occupied || u.jarHold || 0), 0);
  }, [filteredUsers]);

  const handleWhatsApp = (phone: string) => {
    if (!phone) return;
    const cleanPhone = phone.replace(/[^\d]/g, '');
    const p = cleanPhone.startsWith('91') ? cleanPhone : '91' + cleanPhone;
    window.open(`https://wa.me/${p}`, '_blank');
  };

  const handleCall = (phone: string) => {
    if (!phone) return;
    window.open(`tel:${phone}`);
  };

  const startEdit = (user: User) => {
    setEditingId(user.id);
    setEditValue(String(user.jars_occupied || user.jarHold || 0));
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditValue('');
  };

  const saveEdit = async (user: User) => {
    const newCount = parseInt(editValue, 10);
    if (isNaN(newCount) || newCount < 0) {
      alert('Please enter a valid positive number');
      return;
    }

    setIsSaving(true);
    try {
      // Update both fields for backward compatibility, as seen in userSlice.ts of mobile app
      await updateDocument('users', user.id, {
        jars_occupied: newCount,
        jarHold: newCount
      });

      await logActivity({
        actorId: userData?.id || 'unknown',
        actorName: userData?.displayName || userData?.email || 'Unknown Admin',
        actor: 'ADMIN',
        action: 'JAR_UPDATED',
        targetId: user.id,
        details: `Updated jar hold count for user ${user.name} from ${user.jars_occupied || user.jarHold} to ${newCount}`
      });

      setEditingId(null);
    } catch (error) {
      console.error('Error updating jar count:', error);
      alert('Failed to update jar count');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <PageContainer>
      <Header>
        <TitleBox>
          <Title>Jar Holdings</Title>
          <Subtitle>Track unfilled water jars currently held by customers</Subtitle>
        </TitleBox>

        {!loading && (
          <SummaryCard>
            <SummaryIcon>
              <FiBox />
            </SummaryIcon>
            <SummaryInfo>
              <SummaryValue>{totalJarsCount}</SummaryValue>
              <SummaryLabel>Total Jars Held</SummaryLabel>
            </SummaryInfo>
            <div style={{ width: 1, height: 32, background: '#e5e7eb', margin: '0 8px' }} />
            <SummaryInfo>
              <SummaryValue>{filteredUsers.length}</SummaryValue>
              <SummaryLabel>Customers</SummaryLabel>
            </SummaryInfo>
          </SummaryCard>
        )}
      </Header>

      <ControlsContainer>
        <SearchBox>
          <FiSearch />
          <SearchInput 
            placeholder="Search by name, phone, or ID..." 
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </SearchBox>
      </ControlsContainer>

      <ListCard>
        {loading ? (
          <EmptyState>Loading jar holdings...</EmptyState>
        ) : filteredUsers.length === 0 ? (
          <EmptyState>No customers are currently holding any jars.</EmptyState>
        ) : (
          <Table>
            <thead>
              <Tr>
                <Th>Customer</Th>
                <Th>Contact</Th>
                <Th>Jars Held</Th>
                <Th>Actions</Th>
              </Tr>
            </thead>
            <tbody>
              {filteredUsers.map(user => {
                const isEditing = editingId === user.id;
                const holdCount = user.jars_occupied || user.jarHold || 0;

                return (
                  <Tr key={user.id}>
                    <Td>
                      <UserInfo>
                        <Avatar>{user.name.charAt(0).toUpperCase()}</Avatar>
                        <NameColumn>
                          <NameText>{user.name}</NameText>
                          <IdText>{user.customerId || 'No ID'}</IdText>
                        </NameColumn>
                      </UserInfo>
                    </Td>
                    <Td>
                      <div style={{ color: '#4b5563', fontSize: '14px' }}>{user.phone || 'N/A'}</div>
                    </Td>
                    <Td>
                      {isEditing ? (
                        <EditInput 
                          type="number"
                          min="0"
                          value={editValue}
                          onChange={(e) => setEditValue(e.target.value)}
                          autoFocus
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') saveEdit(user);
                            if (e.key === 'Escape') cancelEdit();
                          }}
                        />
                      ) : (
                        <JarBadge>
                          <FiBox />
                          {holdCount} {holdCount === 1 ? 'Jar' : 'Jars'}
                        </JarBadge>
                      )}
                    </Td>
                    <Td>
                      {isEditing ? (
                        <ActionButtons>
                          <IconBtn $color="white" $bg="#10b981" title="Save" onClick={() => saveEdit(user)} disabled={isSaving}>
                            <FiSave />
                          </IconBtn>
                          <IconBtn $color="#6b7280" title="Cancel" onClick={cancelEdit} disabled={isSaving}>
                            <FiX />
                          </IconBtn>
                        </ActionButtons>
                      ) : (
                        <ActionButtons>
                          <IconBtn $color="#8b5cf6" title="Update Jar Count" onClick={() => startEdit(user)}>
                            <FiEdit3 />
                          </IconBtn>
                          <div style={{ width: 1, background: '#e5e7eb', margin: '0 4px' }} />
                          <IconBtn $color="#10b981" title="WhatsApp" onClick={() => handleWhatsApp(user.phone)}>
                            <FiMessageCircle />
                          </IconBtn>
                          <IconBtn $color="#3b82f6" title="Call" onClick={() => handleCall(user.phone)}>
                            <FiPhone />
                          </IconBtn>
                        </ActionButtons>
                      )}
                    </Td>
                  </Tr>
                );
              })}
            </tbody>
          </Table>
        )}
      </ListCard>
    </PageContainer>
  );
}
