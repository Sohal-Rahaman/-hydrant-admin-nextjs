'use client';

import { useState, useEffect } from 'react';
import styled from 'styled-components';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '@/context/AuthContext';
import { subscribeToCollection, addDocument, updateDocument, deleteDocument } from '@/lib/firebase';
import { logActivity } from '@/lib/activityLogger';
import { 
  FiTruck, 
  FiSearch, 
  FiEdit3, 
  FiTrash2, 
  FiUserPlus,
  FiX,
  FiSave,
  FiPhone,
  FiCheckCircle,
  FiCircle,
  FiActivity,
  FiMoreVertical
} from 'react-icons/fi';
import { db } from '@/lib/firebase';
import { collection, query, orderBy, Timestamp } from 'firebase/firestore';

const Container = styled.div`
  max-width: 1400px;
  margin: 0 auto;
  padding: 24px;
`;

const TopBar = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 32px;
  flex-wrap: wrap;
  gap: 16px;
`;

const Title = styled.h1`
  font-size: 24px;
  font-weight: 800;
  color: #f0f0f0;
  display: flex;
  align-items: center;
  gap: 12px;
`;

const SearchBox = styled.div`
  position: relative;
  width: 300px;

  @media (max-width: 640px) {
    width: 100%;
  }

  svg {
    position: absolute;
    left: 16px;
    top: 50%;
    transform: translateY(-50%);
    color: #666;
  }

  input {
    width: 100%;
    padding: 12px 16px 12px 48px;
    background: #181818;
    border: 1px solid #2e2e2e;
    border-radius: 12px;
    color: #f0f0f0;
    font-size: 14px;
    outline: none;
    transition: all 0.2s;
    
    &:focus {
      border-color: #10B981;
    }
  }
`;

const Grid = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(350px, 1fr));
  gap: 24px;
`;

const MemberCard = styled(motion.div)`
  background: #181818;
  border: 1px solid #2e2e2e;
  border-radius: 20px;
  padding: 24px;
  transition: all 0.2s;

  &:hover {
    border-color: #3e3e3e;
    transform: translateY(-2px);
  }
`;

const StatusBadge = styled.button<{ $online: boolean }>`
  padding: 6px 12px;
  border-radius: 20px;
  font-size: 11px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.1em;
  display: flex;
  align-items: center;
  gap: 8px;
  border: 1px solid ${props => props.$online ? 'rgba(16, 185, 129, 0.2)' : '#2e2e2e'};
  background: ${props => props.$online ? 'rgba(16, 185, 129, 0.1)' : 'transparent'};
  color: ${props => props.$online ? '#10B981' : '#666'};
  cursor: pointer;
  transition: all 0.2s;

  &:hover {
    background: ${props => props.$online ? 'rgba(16, 185, 129, 0.2)' : '#222'};
  }
`;

const ActionButton = styled.button<{ variant?: 'primary' | 'danger' | 'ghost' }>`
  padding: 8px 12px;
  border-radius: 10px;
  font-weight: 600;
  font-size: 13px;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  cursor: pointer;
  transition: all 0.2s;
  border: none;

  ${props => {
    switch (props.variant) {
      case 'primary': return `background: #10B981; color: white; &:hover { background: #059669; }`;
      case 'danger': return `background: rgba(239, 68, 68, 0.1); color: #EF4444; border: 1px solid rgba(239, 68, 68, 0.2); &:hover { background: #EF4444; color: white; }`;
      default: return `background: #222; color: #aaa; border: 1px solid #2e2e2e; &:hover { background: #2a2a2a; border-color: #444; }`;
    }
  }}
`;

const ModalOverlay = styled(motion.div)`
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.8);
  backdrop-filter: blur(8px);
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 1000;
  padding: 24px;
`;

const ModalContent = styled(motion.div)`
  background: #181818;
  border: 1px solid #2e2e2e;
  border-radius: 24px;
  padding: 32px;
  width: 100%;
  max-width: 480px;
`;

const FormGroup = styled.div`
  margin-bottom: 20px;

  label {
    display: block;
    font-size: 11px;
    font-weight: 700;
    color: #666;
    text-transform: uppercase;
    letter-spacing: 0.1em;
    margin-bottom: 8px;
  }

  input, select {
    width: 100%;
    padding: 14px;
    background: #0f0f0f;
    border: 1px solid #2e2e2e;
    border-radius: 12px;
    color: #f0f0f0;
    font-size: 14px;
    outline: none;
    
    &:focus {
      border-color: #10B981;
    }
  }
`;

interface ArmyMember {
  id: string;
  name: string;
  phoneNumber: string;
  isOnline: boolean;
  activeOrdersCount: number;
  createdAt?: any;
}

export default function ArmyManagementPage() {
  const { userData } = useAuth();
  const [army, setArmy] = useState<ArmyMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingMember, setEditingMember] = useState<ArmyMember | null>(null);
  
  const [formData, setFormData] = useState({
    name: '',
    phoneNumber: '',
    isOnline: false
  });
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    const unsubscribe = subscribeToCollection('army', (snapshot) => {
      const armyData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as ArmyMember[];
      setArmy(armyData);
      setLoading(false);
    }, [orderBy('createdAt', 'desc')]);

    return () => unsubscribe();
  }, []);

  const handleOpenModal = (member: ArmyMember | null = null) => {
    if (member) {
      setEditingMember(member);
      setFormData({
        name: member.name,
        phoneNumber: member.phoneNumber,
        isOnline: member.isOnline
      });
    } else {
      setEditingMember(null);
      setFormData({
        name: '',
        phoneNumber: '',
        isOnline: false
      });
    }
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setEditingMember(null);
  };

  const handleSave = async () => {
    if (!formData.name || !formData.phoneNumber) {
       alert('Please fill in all fields');
       return;
    }

    setIsSaving(true);
    try {
      if (editingMember) {
        await updateDocument('army', editingMember.id, {
          ...formData,
          updatedAt: Timestamp.now()
        });
        await logActivity({
          action: 'ARMY_MEMBER_UPDATED',
          actor: 'ADMIN',
          actorId: userData?.id || 'admin',
          actorName: userData?.displayName || userData?.email || 'Admin',
          targetId: editingMember.id,
          details: `Updated army member: ${formData.name}`
        });
      } else {
        const docRef = await addDocument('army', {
          ...formData,
          activeOrdersCount: 0,
          createdAt: Timestamp.now(),
          updatedAt: Timestamp.now()
        });
        await logActivity({
          action: 'ARMY_MEMBER_ADDED',
          actor: 'ADMIN',
          actorId: userData?.id || 'admin',
          actorName: userData?.displayName || userData?.email || 'Admin',
          targetId: docRef.id,
          details: `Added new army member: ${formData.name}`
        });
      }
      closeModal();
    } catch (error) {
      console.error(error);
      alert('Error saving data');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (member: ArmyMember) => {
    if (window.confirm(`Are you sure you want to delete ${member.name}?`)) {
      try {
        await deleteDocument('army', member.id);
        await logActivity({
          action: 'ARMY_MEMBER_DELETED',
          actor: 'ADMIN',
          actorId: userData?.id || 'admin',
          actorName: userData?.displayName || userData?.email || 'Admin',
          targetId: member.id,
          details: `Deleted army member: ${member.name}`
        });
      } catch (error) {
        console.error(error);
      }
    }
  };

  const toggleStatus = async (member: ArmyMember) => {
    try {
      await updateDocument('army', member.id, {
        isOnline: !member.isOnline,
        updatedAt: Timestamp.now()
      });
    } catch (error) {
      console.error(error);
    }
  };

  const filteredArmy = army.filter(member => 
    member.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    member.phoneNumber.includes(searchTerm)
  );

  return (
    <div style={{ background: '#0f0f0f', minHeight: '100vh', color: '#f0f0f0' }}>
      <Container>
        <TopBar>
          <div style={{ display: 'flex', alignItems: 'center', gap: '24px' }}>
            <Title><FiTruck /> Army Ops</Title>
            <SearchBox>
              <FiSearch />
              <input 
                placeholder="Search fleet..." 
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </SearchBox>
          </div>
          <ActionButton variant="primary" onClick={() => handleOpenModal()} style={{ padding: '12px 20px' }}>
            <FiUserPlus /> Recruit Partner
          </ActionButton>
        </TopBar>

        {loading ? (
          <div style={{ padding: '100px', textAlign: 'center', color: '#666' }}>Loading Army data...</div>
        ) : (
          <Grid>
            {filteredArmy.map((member) => (
              <MemberCard
                key={member.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '20px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                    <div style={{ 
                      width: '48px', 
                      height: '48px', 
                      borderRadius: '12px', 
                      background: '#10B981', 
                      display: 'flex', 
                      alignItems: 'center', 
                      justifyContent: 'center',
                      fontWeight: 800,
                      fontSize: '18px',
                      boxShadow: '0 8px 16px rgba(16, 185, 129, 0.1)'
                    }}>
                      {member.name[0].toUpperCase()}
                    </div>
                    <div>
                      <div style={{ fontWeight: 700, fontSize: '16px', color: '#f0f0f0' }}>{member.name}</div>
                      <div style={{ fontSize: '13px', color: '#666', display: 'flex', alignItems: 'center', gap: '4px', marginTop: '2px' }}>
                        <FiPhone size={12} /> {member.phoneNumber}
                      </div>
                    </div>
                  </div>
                  <StatusBadge $online={member.isOnline} onClick={() => toggleStatus(member)}>
                    {member.isOnline ? <FiCheckCircle /> : <FiCircle />}
                    {member.isOnline ? 'Online' : 'Offline'}
                  </StatusBadge>
                </div>

                <div style={{ 
                  display: 'grid', 
                  gridTemplateColumns: '1fr 1fr', 
                  gap: '12px', 
                  background: '#0f0f0f', 
                  padding: '16px', 
                  borderRadius: '16px',
                  marginBottom: '20px'
                }}>
                  <div>
                    <div style={{ fontSize: '10px', color: '#666', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Current Load</div>
                    <div style={{ fontSize: '15px', fontWeight: 700, color: member.activeOrdersCount > 0 ? '#10B981' : '#f0f0f0', display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <FiActivity size={14} /> {member.activeOrdersCount} Tasks
                    </div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: '10px', color: '#666', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Performance</div>
                    <div style={{ fontSize: '15px', fontWeight: 700, color: '#f0f0f0' }}>100%</div>
                  </div>
                </div>

                <div style={{ display: 'flex', gap: '12px' }}>
                  <ActionButton onClick={() => handleOpenModal(member)} style={{ flex: 1 }}>
                    <FiEdit3 /> Manage
                  </ActionButton>
                  <ActionButton variant="danger" onClick={() => handleDelete(member)}>
                    <FiTrash2 />
                  </ActionButton>
                </div>
              </MemberCard>
            ))}
          </Grid>
        )}

        <AnimatePresence>
          {isModalOpen && (
            <ModalOverlay
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={closeModal}
            >
              <ModalContent
                initial={{ scale: 0.95, opacity: 0, y: 20 }}
                animate={{ scale: 1, opacity: 1, y: 0 }}
                exit={{ scale: 0.95, opacity: 0, y: 20 }}
                onClick={(e) => e.stopPropagation()}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
                  <h2 style={{ fontSize: '20px', fontWeight: 800 }}>{editingMember ? 'Edit Partner' : 'Recruit Partner'}</h2>
                  <ActionButton variant="ghost" onClick={closeModal} style={{ padding: '8px' }}>
                    <FiX size={20} />
                  </ActionButton>
                </div>

                <FormGroup>
                  <label>Full Name</label>
                  <input 
                    type="text" 
                    placeholder="Enter name"
                    value={formData.name}
                    onChange={(e) => setFormData(p => ({ ...p, name: e.target.value }))}
                  />
                </FormGroup>

                <FormGroup>
                  <label>Phone Number</label>
                  <input 
                    type="text" 
                    placeholder="+91..."
                    value={formData.phoneNumber}
                    onChange={(e) => setFormData(p => ({ ...p, phoneNumber: e.target.value }))}
                  />
                </FormGroup>

                <FormGroup>
                  <label>Operational Status</label>
                  <select 
                    value={formData.isOnline ? 'online' : 'offline'} 
                    onChange={(e) => setFormData(p => ({ ...p, isOnline: e.target.value === 'online' }))}
                  >
                    <option value="offline">Offline / Resting</option>
                    <option value="online">Online / Active</option>
                  </select>
                </FormGroup>

                <div style={{ display: 'flex', gap: '12px', marginTop: '32px' }}>
                  <ActionButton onClick={closeModal} style={{ flex: 1 }}>Cancel</ActionButton>
                  <ActionButton variant="primary" onClick={handleSave} disabled={isSaving} style={{ flex: 2 }}>
                    <FiSave /> {isSaving ? 'Processing...' : 'Save Changes'}
                  </ActionButton>
                </div>
              </ModalContent>
            </ModalOverlay>
          )}
        </AnimatePresence>
      </Container>
    </div>
  );
}
