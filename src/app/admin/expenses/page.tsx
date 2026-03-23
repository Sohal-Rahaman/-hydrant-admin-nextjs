'use client';

import React, { useState, useEffect, useMemo } from 'react';
import styled from 'styled-components';
import { subscribeToCollection, addDocument, updateDocument } from '@/lib/firebase';
import { logActivity } from '@/lib/activityLogger';
import { useAuth } from '@/context/AuthContext';
import { FiSearch, FiPlus, FiEdit2, FiCalendar, FiDollarSign, FiFilter, FiX } from 'react-icons/fi';
import { Timestamp } from 'firebase/firestore';

export type ExpenseCategory = 'water_purchase' | 'vehicle_fuel' | 'food' | 'room_rent' | 'electric_bill' | 'miscellaneous' | 'other';

interface Expense {
  id: string;
  category: ExpenseCategory;
  amount: number;
  description: string;
  customLabel?: string;
  date: string;
  createdAt: string;
  createdBy: string;
  displayDate?: string;
}

const CATEGORIES: { value: ExpenseCategory; label: string; color: string }[] = [
  { value: 'water_purchase', label: 'Water Purchase', color: '#0ea5e9' },
  { value: 'vehicle_fuel', label: 'Vehicle Fuel', color: '#f97316' },
  { value: 'food', label: 'Food', color: '#22c55e' },
  { value: 'room_rent', label: 'Room Rent', color: '#8b5cf6' },
  { value: 'electric_bill', label: 'Electric Bill', color: '#eab308' },
  { value: 'miscellaneous', label: 'Miscellaneous', color: '#ec4899' },
  { value: 'other', label: 'Other', color: '#64748b' },
];

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

const HeaderRight = styled.div`
  display: flex;
  gap: 16px;
  align-items: center;
`;

const SummaryGroup = styled.div`
  display: flex;
  gap: 12px;
`;

const SummaryCard = styled.div`
  background: white;
  padding: 12px 20px;
  border-radius: 12px;
  border: 1px solid #e5e7eb;
  display: flex;
  flex-direction: column;
  min-width: 150px;
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

const PrimaryButton = styled.button`
  background: #3b82f6;
  color: white;
  border: none;
  border-radius: 8px;
  padding: 10px 20px;
  font-weight: 600;
  font-size: 14px;
  display: flex;
  align-items: center;
  gap: 8px;
  cursor: pointer;
  height: 48px;
  transition: all 0.2s;

  &:hover {
    background: #2563eb;
  }
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

const ControlsContainer = styled.div`
  display: flex;
  gap: 16px;
  margin-bottom: 24px;
  align-items: center;
`;

const CategorySelect = styled.select`
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

const CategoryBadge = styled.span<{ $color: string }>`
  padding: 4px 10px;
  border-radius: 999px;
  font-size: 12px;
  font-weight: 600;
  background: ${props => `${props.$color}15`};
  color: ${props => props.$color};
  display: inline-block;
  white-space: nowrap;
`;

const AmountText = styled.div`
  font-weight: 700;
  color: #111827;
  font-size: 16px;
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

const DateGroup = styled.div`
  padding: 12px 24px;
  background: #f3f4f6;
  font-weight: 600;
  font-size: 14px;
  color: #374151;
  border-bottom: 1px solid #e5e7eb;
  border-top: 1px solid #e5e7eb;
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
  max-width: 500px;
  box-shadow: 0 20px 25px -5px rgba(0,0,0,0.1);
  overflow: hidden;
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
  display: flex;
  flex-direction: column;
  gap: 16px;
`;

const FormGroup = styled.div`
  display: flex;
  flex-direction: column;
  gap: 6px;
`;

const Label = styled.label`
  font-size: 13px;
  font-weight: 600;
  color: #374151;
`;

const Input = styled.input`
  padding: 10px 12px;
  border: 1px solid #d1d5db;
  border-radius: 8px;
  font-size: 14px;
  outline: none;
  
  &:focus {
    border-color: #3b82f6;
    box-shadow: 0 0 0 2px rgba(59,130,246,0.1);
  }
`;

const TextArea = styled.textarea`
  padding: 10px 12px;
  border: 1px solid #d1d5db;
  border-radius: 8px;
  font-size: 14px;
  outline: none;
  min-height: 80px;
  resize: vertical;
  
  &:focus {
    border-color: #3b82f6;
    box-shadow: 0 0 0 2px rgba(59,130,246,0.1);
  }
`;

const Select = styled.select`
  padding: 10px 12px;
  border: 1px solid #d1d5db;
  border-radius: 8px;
  font-size: 14px;
  outline: none;
  background: white;
  
  &:focus {
    border-color: #3b82f6;
  }
`;

const ModalFooter = styled.div`
  padding: 16px 24px;
  border-top: 1px solid #e5e7eb;
  display: flex;
  justify-content: flex-end;
  gap: 12px;
  background: #f9fafb;
`;

const Button = styled.button<{ $primary?: boolean }>`
  padding: 8px 16px;
  border-radius: 6px;
  font-weight: 600;
  font-size: 14px;
  cursor: pointer;
  border: 1px solid ${props => props.$primary ? 'transparent' : '#d1d5db'};
  background: ${props => props.$primary ? '#3b82f6' : 'white'};
  color: ${props => props.$primary ? 'white' : '#374151'};

  &:hover {
    background: ${props => props.$primary ? '#2563eb' : '#f9fafb'};
  }
  
  &:disabled {
    opacity: 0.7;
    cursor: not-allowed;
  }
`;

export default function ExpensesPage() {
  const { userData } = useAuth();
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [loading, setLoading] = useState(true);
  
  const [searchTerm, setSearchTerm] = useState('');
  const [filterCategory, setFilterCategory] = useState<ExpenseCategory | 'all'>('all');
  
  // Modal state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  
  // Form state
  const [editId, setEditId] = useState<string | null>(null);
  const [category, setCategory] = useState<ExpenseCategory>('water_purchase');
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [customLabel, setCustomLabel] = useState('');
  const [date, setDate] = useState('');

  useEffect(() => {
    const unsub = subscribeToCollection('expenses', (snapshot: any) => {
      const formatted: Expense[] = snapshot.docs.map((d: any) => {
        const data = d.data();
        return {
          id: d.id,
          category: data.category || 'other',
          amount: Number(data.amount) || 0,
          description: data.description || '',
          customLabel: data.customLabel || '',
          date: data.date?.toDate?.()?.toISOString() || data.date || new Date().toISOString(),
          createdAt: data.createdAt?.toDate?.()?.toISOString() || data.createdAt || new Date().toISOString(),
          createdBy: data.createdBy || 'unknown',
        };
      });
      setExpenses(formatted);
      setLoading(false);
    });
    return () => unsub();
  }, []);

  const filteredExpenses = useMemo(() => {
    let result = expenses;

    if (filterCategory !== 'all') {
      result = result.filter(e => e.category === filterCategory);
    }

    if (searchTerm) {
      const q = searchTerm.toLowerCase();
      result = result.filter(e => 
        e.description.toLowerCase().includes(q) ||
        e.customLabel?.toLowerCase().includes(q)
      );
    }

    result.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    return result;
  }, [expenses, searchTerm, filterCategory]);

  const { totalAmount, monthlyAmount } = useMemo(() => {
    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();

    let total = 0;
    let monthly = 0;

    expenses.forEach(e => {
      total += e.amount;
      const d = new Date(e.date);
      if (d.getMonth() === currentMonth && d.getFullYear() === currentYear) {
        monthly += e.amount;
      }
    });

    return { totalAmount: total, monthlyAmount: monthly };
  }, [expenses]);

  const openAddModal = () => {
    setEditId(null);
    setCategory('water_purchase');
    setAmount('');
    setDescription('');
    setCustomLabel('');
    setDate(new Date().toISOString().split('T')[0]); // Current date in YYYY-MM-DD
    setIsModalOpen(true);
  };

  const openEditModal = (e: Expense) => {
    setEditId(e.id);
    setCategory(e.category);
    setAmount(String(e.amount));
    setDescription(e.description);
    setCustomLabel(e.customLabel || '');
    setDate(new Date(e.date).toISOString().split('T')[0]);
    setIsModalOpen(true);
  };

  const getCategoryDetails = (cat: string) => {
    return CATEGORIES.find(c => c.value === cat) || CATEGORIES[CATEGORIES.length - 1];
  };

  const handleSave = async () => {
    if (!amount || isNaN(Number(amount)) || Number(amount) <= 0) {
      alert('Please enter a valid amount');
      return;
    }
    if (!description.trim()) {
      alert('Please enter a description');
      return;
    }
    if (category === 'other' && !customLabel.trim()) {
      alert('Please enter a custom label for "Other" category');
      return;
    }
    if (!date) {
      alert('Please select a date');
      return;
    }

    setIsSaving(true);
    try {
      const expenseDate = new Date(date);
      
      const payload = {
        category,
        amount: Number(amount),
        description: description.trim(),
        customLabel: category === 'other' ? customLabel.trim() : '',
        date: expenseDate, // Firebase lib handles Date obj ideally, or we can use Timestamp
      };

      if (editId) {
        await updateDocument('expenses', editId, payload);
        await logActivity({
          actorId: userData?.id || 'unknown',
          actorName: userData?.displayName || 'Admin',
          actor: 'ADMIN',
          action: 'OTHER',
          details: `Updated expense: ₹${amount} for ${category}`,
          targetId: editId,
        });
      } else {
        const payloadData = {
          ...payload,
          createdAt: new Date(),
          createdBy: userData?.id || 'admin'
        };
        await addDocument('expenses', payloadData);
        await logActivity({
          actorId: userData?.id || 'unknown',
          actorName: userData?.displayName || 'Admin',
          actor: 'ADMIN',
          action: 'OTHER',
          details: `Added expense: ₹${amount} for ${category}`,
          targetId: 'new',
        });
      }

      setIsModalOpen(false);
    } catch (err) {
      console.error('Error saving expense:', err);
      alert('Failed to save expense');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <PageContainer>
      <Header>
        <TitleBox>
          <Title>Expenses</Title>
          <Subtitle>Track operational and miscellaneous expenses</Subtitle>
        </TitleBox>
        <HeaderRight>
          <SummaryGroup>
            <SummaryCard>
              <SummaryLabel>This Month</SummaryLabel>
              <SummaryValue>₹{monthlyAmount.toLocaleString()}</SummaryValue>
            </SummaryCard>
            <SummaryCard>
              <SummaryLabel>Total All Time</SummaryLabel>
              <SummaryValue>₹{totalAmount.toLocaleString()}</SummaryValue>
            </SummaryCard>
          </SummaryGroup>
          <PrimaryButton onClick={openAddModal}>
            <FiPlus size={18} /> Add Expense
          </PrimaryButton>
        </HeaderRight>
      </Header>

      <ControlsContainer>
        <SearchBox>
          <FiSearch />
          <SearchInput 
            placeholder="Search description or label..." 
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </SearchBox>
        <CategorySelect value={filterCategory} onChange={(e) => setFilterCategory(e.target.value as any)}>
          <option value="all">All Categories</option>
          {CATEGORIES.map(c => (
            <option key={c.value} value={c.value}>{c.label}</option>
          ))}
        </CategorySelect>
      </ControlsContainer>

      <ListCard>
        {loading ? (
          <div style={{ padding: '48px', textAlign: 'center', color: '#6b7280' }}>Loading expenses...</div>
        ) : filteredExpenses.length === 0 ? (
          <div style={{ padding: '48px', textAlign: 'center', color: '#6b7280' }}>
            No expenses found.
          </div>
        ) : (
          <Table>
            <thead>
              <Tr>
                <Th>Date</Th>
                <Th>Category</Th>
                <Th>Description</Th>
                <Th>Amount</Th>
                <Th>Actions</Th>
              </Tr>
            </thead>
            <tbody>
              {filteredExpenses.map(exp => {
                const catDetails = getCategoryDetails(exp.category);
                const displayLabel = exp.category === 'other' && exp.customLabel ? exp.customLabel : catDetails.label;
                const dateObj = new Date(exp.date);
                
                return (
                  <Tr key={exp.id}>
                    <Td style={{ whiteSpace: 'nowrap' }}>
                      <div style={{ fontWeight: 600, color: '#111827' }}>{dateObj.toLocaleDateString('en-IN')}</div>
                      <div style={{ fontSize: '12px', color: '#6b7280' }}>
                        {dateObj.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
                      </div>
                    </Td>
                    <Td>
                      <CategoryBadge $color={catDetails.color}>{displayLabel}</CategoryBadge>
                    </Td>
                    <Td>
                      <div style={{ color: '#374151', fontSize: '14px', maxWidth: '300px' }}>
                        {exp.description}
                      </div>
                    </Td>
                    <Td>
                      <AmountText>₹{exp.amount.toLocaleString()}</AmountText>
                    </Td>
                    <Td>
                      <IconBtn onClick={() => openEditModal(exp)} title="Edit">
                        <FiEdit2 size={16} />
                      </IconBtn>
                    </Td>
                  </Tr>
                );
              })}
            </tbody>
          </Table>
        )}
      </ListCard>

      {isModalOpen && (
        <ModalOverlay onClick={() => setIsModalOpen(false)}>
          <ModalContent onClick={e => e.stopPropagation()}>
            <ModalHeader>
              <h2>{editId ? 'Edit Expense' : 'Add Expense'}</h2>
              <CloseBtn onClick={() => setIsModalOpen(false)}><FiX /></CloseBtn>
            </ModalHeader>
            <ModalBody>
              <FormGroup>
                <Label>Date</Label>
                <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
              </FormGroup>
              
              <FormGroup>
                <Label>Category</Label>
                <Select value={category} onChange={(e) => setCategory(e.target.value as ExpenseCategory)}>
                  {CATEGORIES.map(c => (
                    <option key={c.value} value={c.value}>{c.label}</option>
                  ))}
                </Select>
              </FormGroup>

              {category === 'other' && (
                <FormGroup>
                  <Label>Custom Label</Label>
                  <Input 
                    type="text" 
                    placeholder="e.g., Office Supplies" 
                    value={customLabel} 
                    onChange={e => setCustomLabel(e.target.value)} 
                  />
                </FormGroup>
              )}

              <FormGroup>
                <Label>Amount (₹)</Label>
                <Input 
                  type="number" 
                  min="0"
                  placeholder="0" 
                  value={amount} 
                  onChange={e => setAmount(e.target.value)} 
                />
              </FormGroup>

              <FormGroup>
                <Label>Description</Label>
                <TextArea 
                  placeholder="What was this expense for?"
                  value={description}
                  onChange={e => setDescription(e.target.value)}
                />
              </FormGroup>
            </ModalBody>
            <ModalFooter>
              <Button onClick={() => setIsModalOpen(false)} disabled={isSaving}>Cancel</Button>
              <Button $primary onClick={handleSave} disabled={isSaving}>
                {isSaving ? 'Saving...' : (editId ? 'Update Expense' : 'Add Expense')}
              </Button>
            </ModalFooter>
          </ModalContent>
        </ModalOverlay>
      )}
    </PageContainer>
  );
}
