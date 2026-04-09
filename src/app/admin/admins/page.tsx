'use client';
import { useState, useEffect } from 'react';
import styled from 'styled-components';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '@/context/AuthContext';
import { addDocument, updateDocument, getAllAdmins, getAllUsers, StaffMember, SUPERADMIN_PHONES } from '@/lib/firebase';
import { logActivity } from '@/lib/activityLogger';
import { 
  FiShield, 
  FiSearch, 
  FiEdit3, 
  FiTrash2, 
  FiUserPlus,
  FiX,
  FiSave,
  FiPhone,
  FiUser,
  FiCheck,
  FiClock,
  FiAlertCircle,
  FiMail
} from 'react-icons/fi';

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
    color: #6366f1;
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
    border-color: #6366f1;
    box-shadow: 0 0 0 3px rgba(99, 102, 241, 0.1);
  }
`;

const Button = styled(motion.button)<{ variant?: 'primary' | 'secondary' | 'danger' | 'ghost' }>`
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
      case 'primary': return `background: linear-gradient(135deg, #6366f1 0%, #4f46e5 100%); color: white;`;
      case 'danger': return `background: #fee2e2; color: #ef4444; border: 1px solid #fecaca;`;
      case 'ghost': return `background: transparent; color: #64748b; border: 1px solid transparent;`;
      default: return `background: white; color: #475569; border: 1px solid #e2e8f0;`;
    }
  }}

  &:hover {
    transform: translateY(-2px);
    ${props => props.variant === 'primary' ? 'box-shadow: 0 4px 12px rgba(99, 102, 241, 0.2);' : ''}
    ${props => props.variant === 'ghost' ? 'background: #f1f5f9;' : ''}
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

const RoleBadge = styled.span<{ $role: string }>`
  padding: 6px 12px;
  border-radius: 20px;
  font-size: 0.75rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.05em;

  ${props => {
    switch (props.$role) {
      case 'superadmin': return 'background: #fef3c7; color: #92400e;';
      case 'admin': return 'background: #e0e7ff; color: #3730a3;';
      case 'manager': return 'background: #dcfce7; color: #166534;';
      case 'developer': return 'background: #fae8ff; color: #86198f;';
      case 'marketing': return 'background: #ffe4e6; color: #9f1239;';
      case 'analytics': return 'background: #ecfeff; color: #083344;';
      case 'user': return 'background: #f1f5f9; color: #475569;';
      default: return 'background: #f1f5f9; color: #475569;';
    }
  }}
`;

const PermissionTag = styled.span`
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 2px 8px;
  background: #f8fafc;
  border: 1px solid #e2e8f0;
  border-radius: 4px;
  font-size: 0.75rem;
  color: #64748b;
  margin-right: 4px;
  margin-bottom: 4px;
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
  max-width: 600px;
  max-height: 90vh;
  overflow-y: auto;
  box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1);
`;

const ModalTitle = styled.h2`
  margin: 0 0 24px 0;
  font-size: 1.5rem;
  color: #1e293b;
  display: flex;
  align-items: center;
  gap: 12px;

  svg {
    color: #6366f1;
  }
`;

const FormGroup = styled.div`
  margin-bottom: 20px;

  label {
    display: block;
    font-size: 0.85rem;
    font-weight: 700;
    color: #475569;
    margin-bottom: 8px;
    display: flex;
    align-items: center;
    gap: 6px;
  }

  input, select {
    width: 100%;
    padding: 12px;
    border: 1px solid #cbd5e1;
    border-radius: 8px;
    font-size: 0.95rem;
    color: #1e293b;
    transition: all 0.3s ease;

    &:focus {
      outline: none;
      border-color: #6366f1;
      box-shadow: 0 0 0 3px rgba(99, 102, 241, 0.1);
    }
  }
`;

const PermissionGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 12px;
  margin-top: 12px;
  padding: 16px;
  background: #f8fafc;
  border-radius: 12px;
  border: 1px solid #e2e8f0;
`;

const PermissionItem = styled.label<{ $checked: boolean }>`
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px;
  border-radius: 8px;
  cursor: pointer;
  background: ${props => props.$checked ? 'white' : 'transparent'};
  border: 1px solid ${props => props.$checked ? '#6366f1' : 'transparent'};
  transition: all 0.2s ease;

  input {
    width: auto;
    margin: 0;
  }

  span {
    font-size: 0.85rem;
    font-weight: ${props => props.$checked ? '600' : '400'};
    color: ${props => props.$checked ? '#4f46e5' : '#64748b'};
  }

  &:hover {
    background: white;
  }
`;

const ModalActions = styled.div`
  display: flex;
  justify-content: flex-end;
  gap: 12px;
  margin-top: 32px;
  padding-top: 24px;
  border-top: 1px solid #f1f5f9;
`;

const AVAILABLE_PERMISSIONS = [
  { id: 'all', label: 'All Access (Master)' },
  { id: 'orders', label: 'Order Management' },
  { id: 'crm', label: 'CRM & Leads' },
  { id: 'wallet', label: 'Wallet & Finance' },
  { id: 'fleet', label: 'Fleet & Army' },
  { id: 'analytics', label: 'Analytics' },
  { id: 'staff', label: 'Staff Management' },
  { id: 'inventory', label: 'Jar Inventory' },
  { id: 'support', label: 'Customer Support' },
  { id: 'marketing', label: 'Coupons & Referrals' },
];

export default function AdminsPage() {
  const { currentUser, role: myRole } = useAuth();
  const [admins, setAdmins] = useState<StaffMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingAdmin, setEditingAdmin] = useState<StaffMember | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  // Form State
  const [formData, setFormData] = useState({
    name: '',
    phone: '+91',
    email: '',
    role: 'admin' as any,
    permissions: [] as string[],
    status: 'active' as 'active' | 'inactive'
  });

  useEffect(() => {
    fetchAdmins();
  }, []);

  const syncMissingSuperAdmins = async (existingAdmins: StaffMember[]) => {
    try {
      // 1. Get existing admin phones for easy lookup
      const existingPhones = new Set(existingAdmins.map(a => a.phone.replace(/[^\d+]/g, '')));
      
      // 2. Filter super admins missing from database
      const missingSuperAdmins = SUPERADMIN_PHONES.filter(phone => {
        const normalized = phone.replace(/[^\d+]/g, '');
        return !existingPhones.has(normalized);
      });

      if (missingSuperAdmins.length === 0) return;

      console.log(`🔄 Syncing ${missingSuperAdmins.length} missing super admins...`);
      
      // 3. Get user data to find correct names if possible
      const allUsers = await getAllUsers();
      
      for (const phone of missingSuperAdmins) {
        const normalized = phone.replace(/[^\d+]/g, '');
        const matchingUser = allUsers.find(u => (u.phone || '').replace(/[^\d+]/g, '') === normalized);
        
        // Placeholder names mapping from firebase.ts comments
        const placeholderNames: Record<string, string> = {
          '+917908013185': 'Sohal Rahaman',
          '+917001397070': 'SK Rose',
          '+919832036181': 'Motiur Rahman',
          '+911111111111': 'Test Account'
        };

        const staffData = {
          name: matchingUser?.full_name || matchingUser?.name || placeholderNames[phone] || 'Super Admin',
          phone: normalized,
          email: matchingUser?.email || '',
          role: 'superadmin',
          permissions: ['all'],
          status: 'active',
          createdAt: new Date(),
          addedBy: 'system-sync'
        };

        await addDocument('admins', staffData);
        console.log(`✅ Onboarded ${staffData.name} (${normalized})`);
      }

      // Re-fetch to update UI after sync
      const updatedAdmins = await getAllAdmins();
      setAdmins(updatedAdmins);
    } catch (error) {
      console.error('Error syncing super admins:', error);
    }
  };

  const fetchAdmins = async () => {
    try {
      setLoading(true);
      const data = await getAllAdmins();
      setAdmins(data);
      
      // Sync logic for legacy superadmins
      await syncMissingSuperAdmins(data);
    } catch (error) {
      console.error('Error fetching admins:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleOpenModal = (admin?: StaffMember) => {
    if (admin) {
      setEditingAdmin(admin);
      setFormData({
        name: admin.name,
        phone: admin.phone,
        email: admin.email || '',
        role: admin.role,
        permissions: admin.permissions || [],
        status: admin.status
      });
    } else {
      setEditingAdmin(null);
      setFormData({
        name: '',
        phone: '+91',
        email: '',
        role: 'admin',
        permissions: ['orders'],
        status: 'active'
      });
    }
    setIsModalOpen(true);
  };

  const handleTogglePermission = (id: string) => {
    setFormData(prev => {
      const newPerms = prev.permissions.includes(id)
        ? prev.permissions.filter(p => p !== id)
        : [...prev.permissions, id];
      
      // If 'all' is toggled, manage behavior
      if (id === 'all') {
        return { ...prev, permissions: prev.permissions.includes('all') ? [] : ['all'] };
      }
      return { ...prev, permissions: newPerms.filter(p => p !== 'all') };
    });
  };

  const handleSave = async () => {
    if (!formData.name || formData.phone.length < 13) {
      alert('Please fill in name and valid phone number (+91XXXXXXXXXX)');
      return;
    }

    setIsSaving(true);
    try {
      const normalizedPhone = formData.phone.replace(/[^\d+]/g, '');
      
      if (editingAdmin) {
        await updateDocument('admins', editingAdmin.id, {
          ...formData,
          phone: normalizedPhone,
          updatedAt: new Date()
        });
        await logActivity({
          action: 'STAFF_UPDATED',
          actor: 'ADMIN',
          actorId: currentUser?.uid || 'unknown',
          actorName: currentUser?.phoneNumber || 'SuperAdmin',
          targetId: editingAdmin.id,
          details: `Updated staff member ${formData.name} (${normalizedPhone})`
        });
      } else {
        await addDocument('admins', {
          ...formData,
          phone: normalizedPhone,
          createdAt: new Date(),
          addedBy: currentUser?.uid
        });
        await logActivity({
          action: 'STAFF_ADDED',
          actor: 'ADMIN',
          actorId: currentUser?.uid || 'unknown',
          actorName: currentUser?.phoneNumber || 'SuperAdmin',
          details: `Added new staff member ${formData.name} (${normalizedPhone})`
        });
      }

      setIsModalOpen(false);
      fetchAdmins();
    } catch (error) {
      console.error('Error saving admin:', error);
      alert('Failed to save record.');
    } finally {
      setIsSaving(false);
    }
  };

  const filteredAdmins = admins.filter(admin => 
    admin.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    admin.phone.includes(searchTerm)
  );

  if (myRole !== 'superadmin') {
    return (
      <Container style={{ padding: '60px 20px', textAlign: 'center' }}>
        <FiAlertCircle size={48} color="#ef4444" style={{ marginBottom: 16 }} />
        <h2 style={{ color: '#1e293b' }}>Access Denied</h2>
        <p style={{ color: '#64748b' }}>Only the Super Admin can manage team access.</p>
      </Container>
    );
  }

  return (
    <Container>
      <PageHeader>
        <PageTitle>
          <FiShield /> Manage Roles & Access
        </PageTitle>
        <Controls>
          <SearchContainer>
            <FiSearch />
            <SearchInput
              type="text"
              placeholder="Search by name, phone or email..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </SearchContainer>
          <Button variant="primary" onClick={() => handleOpenModal()}>
            <FiUserPlus /> Onboard Team Member
          </Button>
        </Controls>
      </PageHeader>

      <TableContainer>
        {loading ? (
          <div style={{ padding: '40px', textAlign: 'center', color: '#64748b' }}>
            <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 1 }}>💧</motion.div>
            Loading team database...
          </div>
        ) : (
          <Table>
            <thead>
              <tr>
                <th>Member</th>
                <th>Phone Number</th>
                <th>Role</th>
                <th>Access/Permissions</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredAdmins.map((admin) => (
                <tr key={admin.id}>
                  <td>
                    <div style={{ fontWeight: 600, color: '#1e293b' }}>{admin.name}</div>
                    <div style={{ fontSize: '0.8rem', color: '#64748b', display: 'flex', alignItems: 'center', gap: 4 }}>
                      <FiMail size={12} /> {admin.email || 'No email set'}
                    </div>
                    <div style={{ fontSize: '0.7rem', color: '#94a3b8', marginTop: 4 }}>
                      Added {new Date(admin.createdAt?.seconds * 1000).toLocaleDateString()}
                    </div>
                  </td>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#475569' }}>
                      <FiPhone size={14} color="#10b981" /> {admin.phone}
                    </div>
                  </td>
                  <td>
                    <RoleBadge $role={admin.role}>{admin.role}</RoleBadge>
                  </td>
                  <td>
                    {admin.permissions?.map(p => (
                      <PermissionTag key={p}>
                        <FiCheck size={10} /> {AVAILABLE_PERMISSIONS.find(ap => ap.id === p)?.label || p}
                      </PermissionTag>
                    ))}
                    {(!admin.permissions || admin.permissions.length === 0) && (
                      <span style={{ fontSize: '0.8rem', color: '#cbd5e1' }}>No permissions set</span>
                    )}
                  </td>
                  <td>
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <Button variant="ghost" onClick={() => handleOpenModal(admin)}>
                        <FiEdit3 />
                      </Button>
                      <Button variant="ghost" style={{ color: '#ef4444' }} onClick={() => {/* Delete logic */}}>
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
            onClick={() => setIsModalOpen(false)}
          >
            <ModalContent
              initial={{ scale: 0.95, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 20 }}
              onClick={(e) => e.stopPropagation()}
            >
              <ModalTitle>
                {editingAdmin ? <FiEdit3 /> : <FiUserPlus />}
                {editingAdmin ? 'Update Employee Role' : 'Role Onboarding Tool'}
              </ModalTitle>

              <FormGroup>
                <label><FiUser /> Full Name</label>
                <input 
                  type="text" 
                  placeholder="e.g. SK ROSE"
                  value={formData.name}
                  onChange={(e) => setFormData({...formData, name: e.target.value})}
                />
              </FormGroup>

              <FormGroup>
                <label><FiPhone /> Phone Number (Verified for OTP)</label>
                <input 
                  type="tel" 
                  placeholder="+91XXXXXXXXXX"
                  value={formData.phone}
                  onChange={(e) => setFormData({...formData, phone: e.target.value})}
                />
              </FormGroup>
              
              <FormGroup>
                <label><FiMail /> Gmail / Google Account</label>
                <input 
                  type="email" 
                  placeholder="name@gmail.com"
                  value={formData.email}
                  onChange={(e) => setFormData({...formData, email: e.target.value})}
                />
              </FormGroup>

              <FormGroup>
                <label><FiShield /> System Role</label>
                <select 
                  value={formData.role} 
                  onChange={(e) => setFormData({...formData, role: e.target.value as any})}
                >
                  <option value="user">Agent (Standard User)</option>
                  <option value="developer">Tech Team (Developer)</option>
                  <option value="marketing">Marketing Team</option>
                  <option value="analytics">Analytics Manager</option>
                  <option value="manager">Operations Manager</option>
                  <option value="admin">System Admin</option>
                  <option value="superadmin">Super Admin (Master)</option>
                </select>
              </FormGroup>

              <label style={{ fontSize: '0.85rem', fontWeight: 700, color: '#475569' }}>
                Select Accessible Sections
              </label>
              <PermissionGrid>
                {AVAILABLE_PERMISSIONS.map(p => (
                  <PermissionItem key={p.id} $checked={formData.permissions.includes(p.id)}>
                    <input 
                      type="checkbox" 
                      checked={formData.permissions.includes(p.id)}
                      onChange={() => handleTogglePermission(p.id)}
                    />
                    <span>{p.label}</span>
                  </PermissionItem>
                ))}
              </PermissionGrid>

              <ModalActions>
                <Button variant="ghost" onClick={() => setIsModalOpen(false)}>
                  Cancel
                </Button>
                <Button variant="primary" onClick={handleSave} disabled={isSaving}>
                  <FiSave /> {isSaving ? 'Saving...' : 'Save Member Access'}
                </Button>
              </ModalActions>
            </ModalContent>
          </ModalOverlay>
        )}
      </AnimatePresence>
    </Container>
  );
}
