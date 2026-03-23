'use client';
import { useState, useEffect } from 'react';
import styled from 'styled-components';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '@/context/AuthContext';
import { updateDocument } from '@/lib/firebase';
import { logActivity } from '@/lib/activityLogger';
import { 
  FiShield, 
  FiSearch, 
  FiEdit3, 
  FiTrash2, 
  FiUserPlus,
  FiX,
  FiSave,
  FiMail,
  FiPhone,
  FiUser
} from 'react-icons/fi';
import { query, collection, where, getDocs } from 'firebase/firestore';
import { db } from '@/lib/firebase';

const Container = styled.div`
  max-width: 1200px;
  margin: 0 auto;
`;

const PageHeader = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 24px;
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

const Button = styled(motion.button)<{ variant?: 'primary' | 'secondary' | 'danger' }>`
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
`;

const RoleBadge = styled.span<{ role: string }>`
  padding: 6px 12px;
  border-radius: 20px;
  font-size: 0.75rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.05em;

  ${props => {
    switch (props.role) {
      case 'superadmin': return 'background: #fef08a; color: #854d0e;';
      case 'admin': return 'background: #e0e7ff; color: #4338ca;';
      case 'manager': return 'background: #dcfce7; color: #15803d;';
      case 'support': return 'background: #ffedd5; color: #c2410c;';
      default: return 'background: #f1f5f9; color: #475569;';
    }
  }}
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


interface AdminUser {
  id: string;
  name: string;
  email: string;
  phoneNumber: string;
  role: string;
}

export default function AdminsPage() {
  const { currentUser, userData } = useAuth();
  const [admins, setAdmins] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingAdmin, setEditingAdmin] = useState<AdminUser | null>(null);
  
  // Promotion form state
  const [searchEmail, setSearchEmail] = useState('');
  const [userToPromote, setUserToPromote] = useState<AdminUser | null>(null);
  const [newRole, setNewRole] = useState('admin');
  const [isSearching, setIsSearching] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    fetchAdmins();
  }, []);

  const fetchAdmins = async () => {
    try {
      setLoading(true);
      const q = query(collection(db, 'users'), where('role', 'in', ['superadmin', 'admin', 'manager', 'support']));
      const querySnapshot = await getDocs(q);
      const adminsData = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as AdminUser[];
      
      setAdmins(adminsData);
    } catch (error) {
      console.error('Error fetching admins:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSearchUser = async () => {
    if (!searchEmail.trim()) return;
    
    setIsSearching(true);
    setUserToPromote(null);
    try {
      const q = query(collection(db, 'users'), where('email', '==', searchEmail.toLowerCase().trim()));
      const querySnapshot = await getDocs(q);
      
      if (!querySnapshot.empty) {
        const doc = querySnapshot.docs[0];
        setUserToPromote({
          id: doc.id,
          ...doc.data()
        } as AdminUser);
      } else {
        alert('No user found with this email.');
      }
    } catch (error) {
      console.error('Error searching user:', error);
      alert('Error searching for user.');
    } finally {
      setIsSearching(false);
    }
  };

  const handleSaveRole = async () => {
    const targetUser = editingAdmin || userToPromote;
    if (!targetUser) return;

    setIsSaving(true);
    try {
      const oldRole = targetUser.role || 'user';
      await updateDocument('users', targetUser.id, {
        role: newRole,
        updatedAt: new Date()
      });

      await logActivity({
        action: 'ROLE_UPDATED',
        actor: 'ADMIN',
        actorId: currentUser?.uid || 'unknown',
        actorName: currentUser?.email || 'Admin',
        targetId: targetUser.id,
        details: `SuperAdmin changed role from ${oldRole} to ${newRole} for ${targetUser.email}`
      });

      alert('Role updated successfully.');
      closeModal();
      fetchAdmins();
    } catch (error) {
      console.error('Error updating role:', error);
      alert('Error updating role. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleRemoveRole = async (admin: AdminUser) => {
    if (admin.id === currentUser?.uid) {
      alert("You cannot remove your own admin role.");
      return;
    }

    if (window.confirm(`Are you sure you want to remove admin privileges from ${admin.name || admin.email}?`)) {
      try {
        await updateDocument('users', admin.id, {
          role: 'user', // Demote to regular user
          updatedAt: new Date()
        });

        await logActivity({
          action: 'ROLE_UPDATED',
          actor: 'ADMIN',
          actorId: currentUser?.uid || 'unknown',
          actorName: currentUser?.email || 'Admin',
          targetId: admin.id,
          details: `SuperAdmin revoked admin privileges (changed role from ${admin.role} to user) for ${admin.email}`
        });

        fetchAdmins();
      } catch (error) {
        console.error('Error removing role:', error);
        alert('Error removing admin role.');
      }
    }
  };

  const openEditModal = (admin: AdminUser) => {
    if (admin.id === currentUser?.uid) {
        alert("You cannot edit your own role here. Use your profile settings.");
        return;
    }
    setEditingAdmin(admin);
    setNewRole(admin.role);
    setUserToPromote(null);
    setSearchEmail('');
    setIsModalOpen(true);
  };

  const openAddModal = () => {
    setEditingAdmin(null);
    setUserToPromote(null);
    setSearchEmail('');
    setNewRole('support');
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setEditingAdmin(null);
    setUserToPromote(null);
  };

  const filteredAdmins = admins.filter(admin => 
    (admin.name?.toLowerCase() || '').includes(searchTerm.toLowerCase()) ||
    (admin.email?.toLowerCase() || '').includes(searchTerm.toLowerCase())
  );

  // Security Check
  if (userData?.role !== 'superadmin') {
    return (
      <Container style={{ textAlign: 'center', padding: '100px 20px' }}>
        <FiShield size={64} color="#ef4444" style={{ marginBottom: 20 }} />
        <h1>Access Denied</h1>
        <p>You need SuperAdmin privileges to access this page.</p>
      </Container>
    );
  }

  return (
    <Container>
      <PageHeader>
        <PageTitle>
          <FiShield /> Admin Management
        </PageTitle>
        <Controls>
          <SearchContainer>
            <FiSearch />
            <SearchInput
              type="text"
              placeholder="Search admins by name or email..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </SearchContainer>
          <Button variant="primary" onClick={openAddModal}>
            <FiUserPlus /> Add Admin
          </Button>
        </Controls>
      </PageHeader>

      <TableContainer>
        {loading ? (
          <div style={{ padding: '40px', textAlign: 'center', color: '#64748b' }}>Loading admins...</div>
        ) : filteredAdmins.length === 0 ? (
          <div style={{ padding: '40px', textAlign: 'center', color: '#64748b' }}>No admins found.</div>
        ) : (
          <Table>
            <thead>
              <tr>
                <th>User</th>
                <th>Contact</th>
                <th>Role</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredAdmins.map((admin) => (
                <tr key={admin.id}>
                  <td>
                    <div style={{ fontWeight: 600, color: '#1e293b' }}>{admin.name || 'No Name'}</div>
                    <div style={{ fontSize: '0.85rem', color: '#64748b' }}>ID: {admin.id.substring(0, 8)}...</div>
                  </td>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.9rem', color: '#475569' }}>
                      <FiMail color="#8e2de2" /> {admin.email}
                    </div>
                    {admin.phoneNumber && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.9rem', color: '#475569', marginTop: '4px' }}>
                        <FiPhone color="#10b981" /> {admin.phoneNumber}
                      </div>
                    )}
                  </td>
                  <td>
                    <RoleBadge role={admin.role || 'user'}>{admin.role || 'user'}</RoleBadge>
                  </td>
                  <td>
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <Button variant="secondary" onClick={() => openEditModal(admin)} style={{ padding: '6px 10px', fontSize: '0.8rem' }}>
                        <FiEdit3 /> Edit
                      </Button>
                      <Button variant="danger" onClick={() => handleRemoveRole(admin)} style={{ padding: '6px 10px', fontSize: '0.8rem' }}>
                        <FiTrash2 /> Remove
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
                {editingAdmin ? <><FiEdit3 /> Edit Admin Role</> : <><FiUserPlus /> Promote User to Admin</>}
              </ModalTitle>

              {!editingAdmin && !userToPromote && (
                <FormGroup>
                  <label>Find User by Email</label>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <input 
                      type="email" 
                      placeholder="user@example.com"
                      value={searchEmail}
                      onChange={(e) => setSearchEmail(e.target.value)}
                    />
                    <Button variant="primary" onClick={handleSearchUser} disabled={isSearching || !searchEmail}>
                      {isSearching ? '...' : 'Find'}
                    </Button>
                  </div>
                </FormGroup>
              )}

              {(userToPromote || editingAdmin) && (
                <>
                  <div style={{ padding: '16px', background: '#f8fafc', borderRadius: '8px', marginBottom: '20px', border: '1px solid #e2e8f0' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
                      <div style={{ width: 40, height: 40, borderRadius: '50%', background: '#e0e7ff', color: '#4338ca', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.2rem' }}>
                        <FiUser />
                      </div>
                      <div>
                        <div style={{ fontWeight: 600, color: '#1e293b' }}>{(userToPromote || editingAdmin)?.name || 'No Name'}</div>
                        <div style={{ fontSize: '0.85rem', color: '#64748b' }}>{(userToPromote || editingAdmin)?.email}</div>
                      </div>
                    </div>
                  </div>

                  <FormGroup>
                    <label>Assign Role</label>
                    <select value={newRole} onChange={(e) => setNewRole(e.target.value)}>
                      <option value="user">User (Remove Admin)</option>
                      <option value="support">Support (Read-only / CS)</option>
                      <option value="manager">Manager (Operations)</option>
                      <option value="admin">Admin (Full Access except Admins)</option>
                      {userData?.role === 'superadmin' && <option value="superadmin">Super Admin (Master)</option>}
                    </select>
                  </FormGroup>

                  <ModalActions>
                    <Button variant="secondary" onClick={closeModal} disabled={isSaving}>
                      <FiX /> Cancel
                    </Button>
                    <Button variant="primary" onClick={handleSaveRole} disabled={isSaving}>
                        <FiSave /> {isSaving ? 'Saving...' : 'Save Role'}
                    </Button>
                  </ModalActions>
                </>
              )}
            </ModalContent>
          </ModalOverlay>
        )}
      </AnimatePresence>
    </Container>
  );
}
