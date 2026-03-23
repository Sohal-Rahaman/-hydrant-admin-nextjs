'use client';

import React, { useState, useEffect, useMemo } from 'react';
import styled from 'styled-components';
import { subscribeToCollection, updateDocument } from '@/lib/firebase';
import { logActivity } from '@/lib/activityLogger';
import { useAuth } from '@/context/AuthContext';
import { FiSearch, FiMapPin, FiPhone, FiMessageCircle, FiCheckCircle, FiXCircle, FiMoreVertical, FiFilter } from 'react-icons/fi';

interface Lead {
  id: string;
  name: string;
  phone: string;
  manual_address: string;
  jars_held: number;
  deposit_paid: number;
  status: 'trial' | 'converted' | 'returned';
  location_data?: {
    lat: number;
    lng: number;
    map_link: string;
  };
  createdAt: string;
  updatedAt?: string;
  notes?: string;
}

const PageContainer = styled.div`
  padding: 24px;
  max-width: 1200px;
  margin: 0 auto;
`;

const Header = styled.div`
  margin-bottom: 24px;
`;

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

const ControlsContainer = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 24px;
  gap: 16px;
  flex-wrap: wrap;
`;

const SearchBox = styled.div`
  position: relative;
  flex: 1;
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

const FilterGroup = styled.div`
  display: flex;
  gap: 8px;
  overflow-x: auto;
  padding-bottom: 4px;
`;

const FilterChip = styled.button<{ $active: boolean; $color: string }>`
  padding: 8px 16px;
  border-radius: 999px;
  font-size: 13px;
  font-weight: 600;
  display: flex;
  align-items: center;
  gap: 6px;
  cursor: pointer;
  transition: all 0.2s;
  white-space: nowrap;
  
  border: 1px solid ${props => props.$active ? props.$color : '#e5e7eb'};
  background: ${props => props.$active ? `${props.$color}15` : 'white'};
  color: ${props => props.$active ? props.$color : '#4b5563'};

  &:hover {
    background: ${props => props.$active ? `${props.$color}25` : '#f9fafb'};
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

const NameText = styled.div`
  font-weight: 600;
  color: #111827;
  margin-bottom: 4px;
`;

const AddressText = styled.div`
  font-size: 12px;
  color: #6b7280;
  display: flex;
  align-items: center;
  gap: 4px;
  max-width: 250px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
`;

const StatusBadge = styled.span<{ $status: string }>`
  padding: 4px 10px;
  border-radius: 999px;
  font-size: 12px;
  font-weight: 600;
  text-transform: capitalize;
  
  background: ${props => {
    switch(props.$status) {
      case 'trial': return '#fef3c7'; // Amber
      case 'converted': return '#dcfce7'; // Green
      case 'returned': return '#fee2e2'; // Red
      default: return '#f3f4f6';
    }
  }};
  
  color: ${props => {
    switch(props.$status) {
      case 'trial': return '#d97706';
      case 'converted': return '#16a34a';
      case 'returned': return '#dc2626';
      default: return '#4b5563';
    }
  }};
`;

const ActionButtons = styled.div`
  display: flex;
  gap: 8px;
`;

const IconBtn = styled.button<{ $color?: string; $bg?: string }>`
  width: 32px;
  height: 32px;
  border-radius: 6px;
  border: 1px solid ${props => props.$bg ? 'transparent' : '#e5e7eb'};
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  background: ${props => props.$bg || 'white'};
  color: ${props => props.$color || '#4b5563'};
  transition: all 0.2s;

  &:hover {
    background: ${props => props.$bg ? props.$bg + 'CC' : '#f9fafb'};
    border-color: ${props => props.$bg ? 'transparent' : '#d1d5db'};
  }
`;

const EmptyState = styled.div`
  padding: 48px;
  text-align: center;
  color: #6b7280;
`;

const NotesInput = styled.input`
  width: 100%;
  padding: 8px;
  font-size: 13px;
  border: 1px solid transparent;
  border-radius: 4px;
  outline: none;
  background: transparent;
  
  &:hover, &:focus {
    border-color: #d1d5db;
    background: white;
  }
`;

const MetaData = styled.div`
  display: flex;
  flex-direction: column;
  gap: 4px;
  font-size: 13px;
  color: #4b5563;
`;

const MetaLabel = styled.span`
  color: #9ca3af;
  font-size: 12px;
`;

export default function TrialCustomersPage() {
  const { userData } = useAuth();
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  
  const [filters, setFilters] = useState({
    trial: true,
    converted: true,
    returned: true
  });

  useEffect(() => {
    const unsub = subscribeToCollection('leads', (snapshot) => {
      const formatted: Lead[] = snapshot.docs.map((d: any) => ({
        id: d.id,
        name: d.name || 'Unknown',
        phone: d.phone || '',
        manual_address: d.manual_address || '',
        jars_held: Number(d.jars_held) || 0,
        deposit_paid: Number(d.deposit_paid) || 0,
        status: d.status || 'trial',
        location_data: d.location_data,
        createdAt: d.createdAt?.toDate?.()?.toISOString() || d.createdAt || new Date().toISOString(),
        notes: d.notes || ''
      }));
      setLeads(formatted);
      setLoading(false);
    });
    return () => unsub();
  }, []);

  const filteredLeads = useMemo(() => {
    let result = leads.filter(l => {
      if (l.status === 'trial' && !filters.trial) return false;
      if (l.status === 'converted' && !filters.converted) return false;
      if (l.status === 'returned' && !filters.returned) return false;
      return true;
    });

    if (searchTerm) {
      const q = searchTerm.toLowerCase();
      result = result.filter(l => 
        l.name.toLowerCase().includes(q) ||
        l.phone.includes(q) ||
        l.manual_address.toLowerCase().includes(q)
      );
    }

    result.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    return result;
  }, [leads, searchTerm, filters]);

  const toggleFilter = (key: keyof typeof filters) => {
    setFilters(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const handleStatusChange = async (leadId: string, newStatus: 'trial' | 'converted' | 'returned', leadName: string) => {
    if (!window.confirm(`Are you sure you want to mark ${leadName} as ${newStatus}?`)) return;

    try {
      await updateDocument('leads', leadId, {
        status: newStatus,
        updatedAt: new Date().toISOString()
      });

      await logActivity({
        actorId: userData?.id || 'unknown',
        actorName: userData?.displayName || userData?.email || 'Unknown Admin',
        actor: 'ADMIN',
        action: 'OTHER',
        targetId: leadId,
        details: `Updated trial customer ${leadName} status to ${newStatus}`
      });

    } catch (error) {
      console.error('Error updating status:', error);
      alert('Failed to update status');
    }
  };

  const handleNoteUpdate = async (leadId: string, note: string) => {
    try {
      await updateDocument('leads', leadId, {
        notes: note,
        updatedAt: new Date().toISOString()
      });
    } catch (error) {
      console.error('Error updating notes:', error);
    }
  };

  const openMap = (link?: string) => {
    if (link) {
      window.open(link, '_blank');
    } else {
      alert('No map location provided for this lead.');
    }
  };

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

  return (
    <PageContainer>
      <Header>
        <Title>Trial Customers</Title>
        <Subtitle>Manage prospective leads, trial jars, and conversions</Subtitle>
      </Header>

      <ControlsContainer>
        <SearchBox>
          <FiSearch />
          <SearchInput 
            placeholder="Search by name, phone, or address..." 
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </SearchBox>

        <FilterGroup>
          <FilterChip 
            $active={filters.trial} 
            $color="#d97706" 
            onClick={() => toggleFilter('trial')}
          >
            Trial ({leads.filter(l => l.status === 'trial').length})
          </FilterChip>
          <FilterChip 
            $active={filters.converted} 
            $color="#16a34a" 
            onClick={() => toggleFilter('converted')}
          >
            Converted ({leads.filter(l => l.status === 'converted').length})
          </FilterChip>
          <FilterChip 
            $active={filters.returned} 
            $color="#dc2626" 
            onClick={() => toggleFilter('returned')}
          >
            Returned ({leads.filter(l => l.status === 'returned').length})
          </FilterChip>
        </FilterGroup>
      </ControlsContainer>

      <ListCard>
        {loading ? (
          <EmptyState>Loading leads...</EmptyState>
        ) : filteredLeads.length === 0 ? (
          <EmptyState>No leads found matching current filters.</EmptyState>
        ) : (
          <Table>
            <thead>
              <Tr>
                <Th>Customer Details</Th>
                <Th>Status</Th>
                <Th>Trial Info</Th>
                <Th>Notes</Th>
                <Th>Actions</Th>
              </Tr>
            </thead>
            <tbody>
              {filteredLeads.map(lead => (
                <Tr key={lead.id}>
                  <Td>
                    <NameText>{lead.name}</NameText>
                    <div style={{ color: '#4b5563', fontSize: '13px', marginBottom: '4px' }}>{lead.phone}</div>
                    <AddressText title={lead.manual_address}>
                      <FiMapPin style={{ flexShrink: 0 }} />
                      {lead.manual_address || 'No address provided'}
                    </AddressText>
                  </Td>
                  <Td>
                    <StatusBadge $status={lead.status}>{lead.status}</StatusBadge>
                  </Td>
                  <Td>
                    <MetaData>
                      <div>
                        <strong>{lead.jars_held}</strong> <MetaLabel>Jars</MetaLabel>
                      </div>
                      <div>
                        <strong>₹{lead.deposit_paid}</strong> <MetaLabel>Deposit</MetaLabel>
                      </div>
                      <div>
                        <MetaLabel>Added:</MetaLabel> {new Date(lead.createdAt).toLocaleDateString()}
                      </div>
                    </MetaData>
                  </Td>
                  <Td style={{ maxWidth: '200px' }}>
                    <NotesInput 
                      defaultValue={lead.notes} 
                      placeholder="Add a note..."
                      onBlur={(e) => {
                        if (e.target.value !== lead.notes) {
                          handleNoteUpdate(lead.id, e.target.value);
                        }
                      }}
                    />
                  </Td>
                  <Td>
                    <ActionButtons>
                      <IconBtn title="WhatsApp" onClick={() => handleWhatsApp(lead.phone)} $color="#10b981">
                        <FiMessageCircle />
                      </IconBtn>
                      <IconBtn title="Call" onClick={() => handleCall(lead.phone)} $color="#3b82f6">
                        <FiPhone />
                      </IconBtn>
                      <IconBtn title="View Map" onClick={() => openMap(lead.location_data?.map_link)} $color="#8b5cf6">
                        <FiMapPin />
                      </IconBtn>
                      
                      <div style={{ width: 1, background: '#e5e7eb', margin: '0 4px' }} />
                      
                      {lead.status === 'trial' && (
                        <>
                          <IconBtn 
                            title="Convert to Customer" 
                            onClick={() => handleStatusChange(lead.id, 'converted', lead.name)}
                            $bg="#10b981"
                            $color="white"
                          >
                            <FiCheckCircle />
                          </IconBtn>
                          <IconBtn 
                            title="Mark as Returned" 
                            onClick={() => handleStatusChange(lead.id, 'returned', lead.name)}
                            $bg="#ef4444"
                            $color="white"
                          >
                            <FiXCircle />
                          </IconBtn>
                        </>
                      )}
                    </ActionButtons>
                  </Td>
                </Tr>
              ))}
            </tbody>
          </Table>
        )}
      </ListCard>
    </PageContainer>
  );
}
