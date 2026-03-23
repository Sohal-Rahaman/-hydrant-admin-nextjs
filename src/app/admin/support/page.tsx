'use client';

import React, { useState, useEffect, useMemo } from 'react';
import styled from 'styled-components';
import { subscribeToCollection, updateDocument } from '@/lib/firebase';
import { logActivity } from '@/lib/activityLogger';
import { useAuth } from '@/context/AuthContext';
import { FiSearch, FiFilter, FiMail, FiCheckCircle, FiClock, FiX, FiEye } from 'react-icons/fi';
import { Timestamp } from 'firebase/firestore';

type MessageStatus = 'unread' | 'read' | 'resolved';

interface SupportMessage {
  id: string;
  userId: string | null;
  name: string;
  phone: string;
  email: string;
  subject: string;
  message: string;
  status: MessageStatus;
  createdAt: string;
}

const STATUS_CFG: Record<MessageStatus, { color: string; bg: string; label: string; icon: any }> = {
  unread: { color: '#f59e0b', bg: '#fef3c7', label: 'Unread', icon: FiMail },
  read: { color: '#3b82f6', bg: '#dbeafe', label: 'Read', icon: FiClock },
  resolved: { color: '#10b981', bg: '#d1fae5', label: 'Resolved', icon: FiCheckCircle },
};

const NEXT_STATUS: Record<MessageStatus, MessageStatus | null> = {
  unread: 'read',
  read: 'resolved',
  resolved: null,
};

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

const SummaryGroup = styled.div`
  display: flex;
  gap: 12px;
`;

const SummaryCard = styled.div<{ $color: string }>`
  background: white;
  padding: 12px 20px;
  border-radius: 12px;
  border: 1px solid #e5e7eb;
  border-left: 4px solid ${props => props.$color};
  display: flex;
  flex-direction: column;
  min-width: 120px;
`;

const SummaryLabel = styled.div`
  font-size: 12px;
  color: #6b7280;
  font-weight: 600;
  text-transform: uppercase;
  margin-bottom: 4px;
`;

const SummaryValue = styled.div`
  font-size: 20px;
  font-weight: 700;
  color: #111827;
`;

const ControlsContainer = styled.div`
  display: flex;
  gap: 16px;
  margin-bottom: 24px;
  align-items: center;
`;

const SearchBox = styled.div`
  position: relative;
  flex: 1;
  max-width: 300px;

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

  &:focus {
    border-color: #3b82f6;
    box-shadow: 0 0 0 2px rgba(59, 130, 246, 0.1);
  }
`;

const FilterSelect = styled.select`
  padding: 10px 16px;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  outline: none;
  font-size: 14px;
  background: white;
  color: #4b5563;
  cursor: pointer;

  &:focus {
    border-color: #3b82f6;
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
  vertical-align: top;
`;

const Tr = styled.tr<{ $isUnread?: boolean }>`
  background: ${props => props.$isUnread ? '#fdf8f6' : 'white'};
  &:last-child td {
    border-bottom: none;
  }
  &:hover {
    background: #f9fafb;
  }
`;

const StatusBadge = styled.span<{ $color: string; $bg: string }>`
  padding: 4px 10px;
  border-radius: 999px;
  font-size: 12px;
  font-weight: 600;
  background: ${props => props.$bg};
  color: ${props => props.$color};
  display: inline-flex;
  align-items: center;
  gap: 4px;
  white-space: nowrap;
`;

const IconBtn = styled.button`
  width: 32px;
  height: 32px;
  border-radius: 6px;
  border: none;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  background: #f3f4f6;
  color: #4b5563;
  transition: all 0.2s;

  &:hover {
    background: #e5e7eb;
    color: #111827;
  }
`;

const UserInfo = styled.div`
  display: flex;
  flex-direction: column;
  gap: 4px;
`;

const UserName = styled.div`
  font-weight: 600;
  color: #111827;
`;

const UserContact = styled.div`
  font-size: 13px;
  color: #6b7280;
`;

// --- MODAL ---

const ModalOverlay = styled.div`
  position: fixed;
  top: 0; left: 0; right: 0; bottom: 0;
  background: rgba(0,0,0,0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 50;
  padding: 24px;
`;

const ModalContent = styled.div`
  background: white;
  border-radius: 16px;
  width: 100%;
  max-width: 600px;
  box-shadow: 0 20px 25px -5px rgba(0,0,0,0.1);
  overflow: hidden;
  display: flex;
  flex-direction: column;
  max-height: 90vh;
`;

const ModalHeader = styled.div`
  padding: 20px 24px;
  border-bottom: 1px solid #e5e7eb;
  display: flex;
  justify-content: space-between;
  align-items: center;

  h2 { margin: 0; font-size: 18px; color: #111827; }
`;

const CloseBtn = styled.button`
  background: none; border: none; font-size: 20px; color: #6b7280; cursor: pointer;
  &:hover { color: #111827; }
`;

const ModalBody = styled.div`
  padding: 24px;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 20px;
`;

const DetailRow = styled.div`
  display: flex;
  flex-direction: column;
  gap: 4px;
`;

const DetailLabel = styled.div`
  font-size: 12px;
  font-weight: 600;
  color: #6b7280;
  text-transform: uppercase;
`;

const DetailValue = styled.div`
  font-size: 15px;
  color: #111827;
  line-height: 1.5;
  background: #f9fafb;
  padding: 12px;
  border-radius: 8px;
  border: 1px solid #e5e7eb;
`;

const ModalFooter = styled.div`
  padding: 16px 24px;
  border-top: 1px solid #e5e7eb;
  display: flex;
  justify-content: space-between;
  align-items: center;
  background: #f9fafb;
`;

const Button = styled.button<{ $primary?: boolean; $color?: string }>`
  padding: 10px 20px;
  border-radius: 8px;
  font-weight: 600;
  font-size: 14px;
  cursor: pointer;
  border: 1px solid ${props => props.$primary ? 'transparent' : '#d1d5db'};
  background: ${props => props.$primary ? (props.$color || '#3b82f6') : 'white'};
  color: ${props => props.$primary ? 'white' : '#374151'};
  transition: opacity 0.2s;

  &:hover {
    opacity: 0.9;
    background: ${props => !props.$primary && '#f3f4f6'};
  }
  
  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
`;

export default function SupportTicketsPage() {
  const { userData } = useAuth();
  const [messages, setMessages] = useState<SupportMessage[]>([]);
  const [loading, setLoading] = useState(true);
  
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState<MessageStatus | 'all'>('all');
  
  const [selectedMessage, setSelectedMessage] = useState<SupportMessage | null>(null);
  const [isUpdating, setIsUpdating] = useState(false);

  useEffect(() => {
    const unsub = subscribeToCollection('contact_messages', (snapshot: any) => {
      const msgs: SupportMessage[] = snapshot.docs.map((d: any) => {
        const data = d.data();
        return {
          id: d.id,
          userId: data.userId || null,
          name: data.name || 'Unknown',
          phone: data.phone || '',
          email: data.email || '',
          subject: data.subject || 'No Subject',
          message: data.message || '',
          status: data.status || 'unread',
          createdAt: data.createdAt?.toDate?.()?.toISOString() || new Date().toISOString(),
        };
      });
      setMessages(msgs);
      setLoading(false);
    });
    return () => unsub();
  }, []);

  const filteredMessages = useMemo(() => {
    let result = messages;

    if (filterStatus !== 'all') {
      result = result.filter(m => m.status === filterStatus);
    }

    if (searchTerm) {
      const q = searchTerm.toLowerCase();
      result = result.filter(m => 
        m.name.toLowerCase().includes(q) ||
        m.phone.includes(q) ||
        m.subject.toLowerCase().includes(q) ||
        m.message.toLowerCase().includes(q)
      );
    }

    result.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    return result;
  }, [messages, searchTerm, filterStatus]);

  const counts = useMemo(() => {
    return {
      unread: messages.filter(m => m.status === 'unread').length,
      read: messages.filter(m => m.status === 'read').length,
      resolved: messages.filter(m => m.status === 'resolved').length,
    };
  }, [messages]);

  const handleStatusChange = async (msg: SupportMessage, nextStatus: MessageStatus) => {
    setIsUpdating(true);
    try {
      await updateDocument('contact_messages', msg.id, { status: nextStatus });
      await logActivity({
        actorId: userData?.id || 'unknown',
        actorName: userData?.displayName || 'Admin',
        actor: 'ADMIN',
        action: 'OTHER',
        details: `Marked support ticket from ${msg.name} as ${nextStatus}`,
        targetId: msg.id,
      });
      // Update local selected state if it's open
      if (selectedMessage?.id === msg.id) {
        setSelectedMessage({ ...msg, status: nextStatus });
      }
    } catch (error) {
      console.error('Error updating status:', error);
      alert('Failed to update status');
    } finally {
      setIsUpdating(false);
    }
  };

  return (
    <PageContainer>
      <Header>
        <TitleBox>
          <Title>Support Tickets</Title>
          <Subtitle>Manage customer inquiries and messages</Subtitle>
        </TitleBox>
        <SummaryGroup>
          <SummaryCard $color={STATUS_CFG.unread.color}>
            <SummaryLabel>Unread</SummaryLabel>
            <SummaryValue style={{ color: STATUS_CFG.unread.color }}>{counts.unread}</SummaryValue>
          </SummaryCard>
          <SummaryCard $color={STATUS_CFG.read.color}>
            <SummaryLabel>Read / Actioning</SummaryLabel>
            <SummaryValue>{counts.read}</SummaryValue>
          </SummaryCard>
          <SummaryCard $color={STATUS_CFG.resolved.color}>
            <SummaryLabel>Resolved</SummaryLabel>
            <SummaryValue>{counts.resolved}</SummaryValue>
          </SummaryCard>
        </SummaryGroup>
      </Header>

      <ControlsContainer>
        <SearchBox>
          <FiSearch />
          <SearchInput 
            placeholder="Search by name, phone, or subject..." 
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </SearchBox>
        <FilterSelect value={filterStatus} onChange={(e) => setFilterStatus(e.target.value as any)}>
          <option value="all">All Statuses</option>
          <option value="unread">Unread</option>
          <option value="read">Read / Actioning</option>
          <option value="resolved">Resolved</option>
        </FilterSelect>
      </ControlsContainer>

      <ListCard>
        {loading ? (
          <div style={{ padding: '48px', textAlign: 'center', color: '#6b7280' }}>Loading messages...</div>
        ) : filteredMessages.length === 0 ? (
          <div style={{ padding: '48px', textAlign: 'center', color: '#6b7280' }}>
            No tickets found.
          </div>
        ) : (
          <Table>
            <thead>
              <Tr>
                <Th>Date</Th>
                <Th>User details</Th>
                <Th>Subject & Message</Th>
                <Th>Status</Th>
                <Th>Action</Th>
              </Tr>
            </thead>
            <tbody>
              {filteredMessages.map(msg => {
                const dateObj = new Date(msg.createdAt);
                const cfg = STATUS_CFG[msg.status];
                const StatusIcon = cfg.icon;
                
                return (
                  <Tr key={msg.id} $isUnread={msg.status === 'unread'}>
                    <Td style={{ whiteSpace: 'nowrap' }}>
                      <div style={{ fontWeight: 600, color: '#111827' }}>{dateObj.toLocaleDateString('en-IN')}</div>
                      <div style={{ fontSize: '12px', color: '#6b7280' }}>
                        {dateObj.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
                      </div>
                    </Td>
                    <Td>
                      <UserInfo>
                        <UserName>{msg.name}</UserName>
                        <UserContact>{msg.phone}</UserContact>
                        {msg.email && <UserContact>{msg.email}</UserContact>}
                      </UserInfo>
                    </Td>
                    <Td>
                      <div style={{ fontWeight: 600, color: '#374151', marginBottom: 4, fontSize: '14px' }}>
                        {msg.subject}
                      </div>
                      <div style={{ color: '#6b7280', fontSize: '13px', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                        {msg.message}
                      </div>
                    </Td>
                    <Td>
                      <StatusBadge $bg={cfg.bg} $color={cfg.color}>
                        <StatusIcon size={12} /> {cfg.label}
                      </StatusBadge>
                    </Td>
                    <Td>
                      <IconBtn onClick={() => {
                        setSelectedMessage(msg);
                        if (msg.status === 'unread') {
                           handleStatusChange(msg, 'read');
                        }
                      }} title="View Message">
                        <FiEye size={16} />
                      </IconBtn>
                    </Td>
                  </Tr>
                );
              })}
            </tbody>
          </Table>
        )}
      </ListCard>

      {selectedMessage && (
        <ModalOverlay onClick={() => setSelectedMessage(null)}>
          <ModalContent onClick={e => e.stopPropagation()}>
            <ModalHeader>
              <h2>Ticket Details</h2>
              <CloseBtn onClick={() => setSelectedMessage(null)}><FiX /></CloseBtn>
            </ModalHeader>
            <ModalBody>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                <DetailRow>
                  <DetailLabel>Customer Name</DetailLabel>
                  <DetailValue>{selectedMessage.name}</DetailValue>
                </DetailRow>
                <DetailRow>
                  <DetailLabel>Phone</DetailLabel>
                  <DetailValue>{selectedMessage.phone}</DetailValue>
                </DetailRow>
              </div>
              
              {selectedMessage.email && (
                <DetailRow>
                  <DetailLabel>Email</DetailLabel>
                  <DetailValue>{selectedMessage.email}</DetailValue>
                </DetailRow>
              )}

              <DetailRow>
                <DetailLabel>Date & Time</DetailLabel>
                <DetailValue>
                  {new Date(selectedMessage.createdAt).toLocaleString('en-IN', { dateStyle: 'long', timeStyle: 'short' })}
                </DetailValue>
              </DetailRow>

              <DetailRow>
                <DetailLabel>Subject</DetailLabel>
                <DetailValue style={{ fontWeight: 600 }}>{selectedMessage.subject}</DetailValue>
              </DetailRow>

              <DetailRow>
                <DetailLabel>Message</DetailLabel>
                <DetailValue style={{ minHeight: '100px', whiteSpace: 'pre-wrap' }}>
                  {selectedMessage.message}
                </DetailValue>
              </DetailRow>
            </ModalBody>
            <ModalFooter>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontSize: '13px', color: '#6b7280', fontWeight: 600 }}>Current Status:</span>
                <StatusBadge 
                  $bg={STATUS_CFG[selectedMessage.status].bg} 
                  $color={STATUS_CFG[selectedMessage.status].color}
                >
                  {STATUS_CFG[selectedMessage.status].label}
                </StatusBadge>
              </div>
              
              <div style={{ display: 'flex', gap: '12px' }}>
                {NEXT_STATUS[selectedMessage.status] && (
                  <Button 
                    $primary 
                    $color={STATUS_CFG[NEXT_STATUS[selectedMessage.status]!].color}
                    onClick={() => handleStatusChange(selectedMessage, NEXT_STATUS[selectedMessage.status]!)}
                    disabled={isUpdating}
                  >
                    {isUpdating ? 'Updating...' : `Mark as ${STATUS_CFG[NEXT_STATUS[selectedMessage.status]!].label}`}
                  </Button>
                )}
                {selectedMessage.status !== 'resolved' && NEXT_STATUS[selectedMessage.status] !== 'resolved' && (
                  <Button 
                    $primary 
                    $color={STATUS_CFG['resolved'].color}
                    onClick={() => handleStatusChange(selectedMessage, 'resolved')}
                    disabled={isUpdating}
                  >
                    {isUpdating ? 'Updating...' : 'Mark as Resolved'}
                  </Button>
                )}
              </div>
            </ModalFooter>
          </ModalContent>
        </ModalOverlay>
      )}
    </PageContainer>
  );
}
