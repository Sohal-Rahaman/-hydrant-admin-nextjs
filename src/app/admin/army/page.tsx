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
  FiUser,
  FiActivity,
  FiCheckCircle,
  FiCircle
} from 'react-icons/fi';
import { db } from '@/lib/firebase';
import { collection, query, orderBy, Timestamp } from 'firebase/firestore';

const Container = styled.div`
  max-width: 1200px;
  margin: 0 auto;
`;

const PageHeader = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 24px;
  flex-wrap: wrap;
  gap: 16px;
`;

const PageTitle = styled.h1`
  font-size: 1.8rem;
  color: #1e293b;
  display: flex;
  align-items: center;
  gap: 12px;
  margin: 0;

  svg {
    color: #8e2de2;
  }
`;

const Controls = styled.div`
  display: flex;
  gap: 16px;
  align-items: center;
  flex-wrap: wrap;
`;

const SearchContainer = styled.div`
  position: relative;
  width: 300px;

  svg {
    position: absolute;
    left: 12px;
    top: 50%;
    transform: translateY(-50%);
    color: #94a3b8;
  }

  @media (max-width: 640px) {
    width: 100%;
  }
`;

const SearchInput = styled.input`
  width: 100%;
  padding: 10px 10px 10px 36px;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  font-size: 0.95rem;
  transition: all 0.3s ease;

  &:focus {
    outline: none;
    border-color: #8e2de2;
    box-shadow: 0 0 0 3px rgba(142, 45, 226, 0.1);
  }
`;

const Button = styled(motion.button)<{ variant?: 'primary' | 'secondary' | 'danger' | 'success' }>`
  padding: 10px 20px;
  border-radius: 8px;
  border: none;
  font-weight: 600;
  font-size: 0.95rem;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 8px;
  transition: all 0.3s ease;

  ${props => {
    switch (props.variant) {
      case 'primary': return `background: linear-gradient(135deg, #8e2de2 0%, #4a00e0 100%); color: white;`;
      case 'danger': return `background: #fee2e2; color: #ef4444; border: 1px solid #fecaca;`;
      case 'success': return `background: #dcfce7; color: #15803d; border: 1px solid #bbf7d0;`;
      default: return `background: white; color: #475569; border: 1px solid #e2e8f0;`;
    }
  }}

  &:hover {
    transform: translateY(-2px);
    ${props => props.variant === 'primary' ? 'box-shadow: 0 4px 12px rgba(142, 45, 226, 0.2);' : ''}
  }
  
  &:disabled {
    opacity: 0.6;
    cursor: not-allowed;
    transform: none;
  }
`;

const TableContainer = styled.div`
  background: white;
  border-radius: 12px;
  box-shadow: 0 4px 6px rgba(0,0,0,0.02);
  border: 1px solid #e2e8f0;
  overflow: hidden;
`;

const Table = styled.table`
  width: 100%;
  border-collapse: collapse;

  th, td {
    padding: 16px;
    text-align: left;
    border-bottom: 1px solid #e2e8f0;
  }

  th {
    background: #f8fafc;
    font-weight: 600;
    color: #475569;
    font-size: 0.85rem;
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }

  tr:last-child td {
    border-bottom: none;
  }

  tbody tr {
    transition: all 0.3s ease;
    &:hover {
      background: #f8fafc;
    }
  }

  @media (max-width: 768px) {
    th:nth-child(3), td:nth-child(3) { display: none; }
  }
`;

const StatusBadge = styled.span<{ $online: boolean }>`
  padding: 6px 12px;
  border-radius: 20px;
  font-size: 0.75rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  display: flex;
  align-items: center;
  gap: 6px;
  width: fit-content;

  ${props => props.$online ? 
    'background: #dcfce7; color: #15803d; border: 1px solid #bbf7d0;' : 
    'background: #f1f5f9; color: #475569; border: 1px solid #e2e8f0;'
  }
`;

const ModalOverlay = styled(motion.div)`
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(15, 23, 42, 0.6);
  backdrop-filter: blur(4px);
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 1000;
  padding: 20px;
`;

const ModalContent = styled(motion.div)`
  background: white;
  border-radius: 16px;
  padding: 32px;
  width: 100%;
  max-width: 500px;
  box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04);
`;

const ModalTitle = styled.h2`
  margin: 0 0 24px 0;
  font-size: 1.5rem;
  color: #1e293b;
  display: flex;
  align-items: center;
  gap: 12px;

  svg {
    color: #8e2de2;
  }
`;

const FormGroup = styled.div`
  margin-bottom: 20px;

  label {
    display: block;
    font-size: 0.85rem;
    font-weight: 600;
    color: #475569;
    margin-bottom: 8px;
  }

  input, select {
    width: 100%;
    padding: 10px 12px;
    border: 1px solid #cbd5e1;
    border-radius: 8px;
    font-size: 0.95rem;
    color: #1e293b;
    transition: all 0.3s ease;

    &:focus {
      outline: none;
      border-color: #8e2de2;
      box-shadow: 0 0 0 3px rgba(142, 45, 226, 0.1);
    }
  }
`;

const ModalActions = styled.div`
  display: flex;
  justify-content: flex-end;
  gap: 12px;
  margin-top: 32px;
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
  
  // Form state
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
      console.error('Error saving army member:', error);
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
        console.error('Error deleting army member:', error);
        alert('Error deleting data');
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
      console.error('Error toggling status:', error);
    }
  };

  const filteredArmy = army.filter(member => 
    member.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    member.phoneNumber.includes(searchTerm)
  );

  return (
    <Container>
      <PageHeader>
        <PageTitle>
          <FiTruck /> Army Management
        </PageTitle>
        <Controls>
          <SearchContainer>
            <FiSearch />
            <SearchInput
              type="text"
              placeholder="Search by name or phone..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </SearchContainer>
          <Button variant="primary" onClick={() => handleOpenModal()}>
            <FiUserPlus /> Add Army Member
          </Button>
        </Controls>
      </PageHeader>

      <TableContainer>
        {loading ? (
          <div style={{ padding: '40px', textAlign: 'center', color: '#64748b' }}>Loading army data...</div>
        ) : filteredArmy.length === 0 ? (
          <div style={{ padding: '40px', textAlign: 'center', color: '#64748b' }}>No army members found.</div>
        ) : (
          <Table>
            <thead>
              <tr>
                <th>Member</th>
                <th>Status</th>
                <th>Active Orders</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredArmy.map((member) => (
                <tr key={member.id}>
                  <td>
                    <div style={{ fontWeight: 700, color: '#1e293b', fontSize: '1rem' }}>{member.name}</div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.9rem', color: '#6366f1', marginTop: '4px', fontWeight: 600 }}>
                      <FiPhone size={14} /> {member.phoneNumber}
                    </div>
                  </td>
                  <td>
                    <StatusBadge 
                      $online={member.isOnline} 
                      onClick={() => toggleStatus(member)}
                      style={{ cursor: 'pointer' }}
                    >
                      {member.isOnline ? <FiCheckCircle /> : <FiCircle />}
                      {member.isOnline ? 'Online' : 'Offline'}
                    </StatusBadge>
                  </td>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#475569', fontWeight: 600 }}>
                      <FiActivity size={16} color={member.activeOrdersCount > 0 ? '#8e2de2' : '#94a3b8'} />
                      {member.activeOrdersCount} Orders
                    </div>
                  </td>
                  <td>
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <Button variant="secondary" onClick={() => handleOpenModal(member)} style={{ padding: '8px 12px' }}>
                        <FiEdit3 />
                      </Button>
                      <Button variant="danger" onClick={() => handleDelete(member)} style={{ padding: '8px 12px' }}>
                        <FiTrash2 />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </Table>
        )}
      </TableContainer>

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
              <ModalTitle>
                {editingMember ? <FiEdit3 /> : <FiUserPlus />}
                {editingMember ? 'Edit Army Member' : 'Add New Army Member'}
              </ModalTitle>

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
                <label>Initial Status</label>
                <select 
                  value={formData.isOnline ? 'online' : 'offline'} 
                  onChange={(e) => setFormData(p => ({ ...p, isOnline: e.target.value === 'online' }))}
                >
                  <option value="offline">Offline</option>
                  <option value="online">Online</option>
                </select>
              </FormGroup>

              <ModalActions>
                <Button variant="secondary" onClick={closeModal} disabled={isSaving}>
                  <FiX /> Cancel
                </Button>
                <Button variant="primary" onClick={handleSave} disabled={isSaving}>
                  <FiSave /> {isSaving ? 'Saving...' : 'Save Member'}
                </Button>
              </ModalActions>
            </ModalContent>
          </ModalOverlay>
        )}
      </AnimatePresence>
    </Container>
  );
}
