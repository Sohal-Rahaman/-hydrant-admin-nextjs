'use client';

import React, { useState, useEffect, useMemo } from 'react';
import styled from 'styled-components';
import { collection, query, getDocs, addDoc, Timestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { logActivity } from '@/lib/activityLogger';
import { useAuth } from '@/context/AuthContext';
import { FiUserPlus, FiUsers, FiSearch, FiCheck, FiX, FiShoppingCart } from 'react-icons/fi';
import { useRouter } from 'next/navigation';

const PageContainer = styled.div`
  padding: 24px;
  max-width: 800px;
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

const ModeTabs = styled.div`
  display: flex;
  gap: 12px;
  margin-bottom: 24px;
`;

const ModeTab = styled.button<{ $active: boolean }>`
  flex: 1;
  padding: 16px;
  border-radius: 12px;
  border: 2px solid ${props => props.$active ? '#3b82f6' : '#e5e7eb'};
  background: ${props => props.$active ? '#eff6ff' : 'white'};
  color: ${props => props.$active ? '#1d4ed8' : '#6b7280'};
  font-weight: 600;
  font-size: 15px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  transition: all 0.2s;

  &:hover {
    border-color: #3b82f6;
  }
`;

const Section = styled.div`
  background: white;
  border-radius: 12px;
  padding: 24px;
  border: 1px solid #e5e7eb;
  margin-bottom: 24px;
  box-shadow: 0 1px 3px rgba(0,0,0,0.05);
`;

const SectionTitle = styled.h2`
  font-size: 16px;
  font-weight: 700;
  color: #111827;
  margin: 0 0 16px 0;
`;

const FormGroup = styled.div`
  margin-bottom: 16px;
`;

const Label = styled.label`
  display: block;
  font-size: 13px;
  font-weight: 600;
  color: #374151;
  margin-bottom: 6px;
`;

const Input = styled.input`
  width: 100%;
  padding: 12px 16px;
  border: 1px solid #d1d5db;
  border-radius: 8px;
  font-size: 14px;
  outline: none;
  
  &:focus {
    border-color: #3b82f6;
    box-shadow: 0 0 0 2px rgba(59,130,246,0.1);
  }
`;

const SearchBox = styled.div`
  position: relative;
  margin-bottom: 16px;

  svg {
    position: absolute;
    left: 12px;
    top: 50%;
    transform: translateY(-50%);
    color: #9ca3af;
  }
  
  input {
    padding-left: 36px;
  }
`;

const SearchResults = styled.div`
  max-height: 250px;
  overflow-y: auto;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
`;

const CustomerItem = styled.div`
  padding: 12px 16px;
  border-bottom: 1px solid #e5e7eb;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 12px;

  &:last-child {
    border-bottom: none;
  }

  &:hover {
    background: #f9fafb;
  }
`;

const WalletTag = styled.div<{ $negative: boolean }>`
  font-size: 11px;
  font-weight: 700;
  padding: 2px 6px;
  border-radius: 4px;
  background: ${props => props.$negative ? '#fef2f2' : '#f0fdf4'};
  color: ${props => props.$negative ? '#ef4444' : '#10b981'};
  border: 1px solid ${props => props.$negative ? '#fee2e2' : '#dcfce7'};
  font-family: monospace;
`;

const CustomerInfo = styled.div`
  flex: 1;
`;

const CustomerName = styled.div`
  font-weight: 600;
  color: #111827;
`;

const CustomerPhone = styled.div`
  font-size: 13px;
  color: #6b7280;
  margin-top: 2px;
`;

const SelectedCustomerCard = styled.div`
  background: #eff6ff;
  border: 1px solid #bfdbfe;
  border-radius: 8px;
  padding: 16px;
  display: flex;
  align-items: center;
  justify-content: space-between;
`;

const CheckboxLabel = styled.label`
  display: flex;
  align-items: center;
  gap: 12px;
  cursor: pointer;
  padding: 12px;
  background: #f9fafb;
  border-radius: 8px;
  border: 1px solid #e5e7eb;
`;

const Checkbox = styled.input`
  width: 18px;
  height: 18px;
  accent-color: #3b82f6;
`;

const TotalRow = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-top: 24px;
  padding-top: 24px;
  border-top: 1px solid #e5e7eb;
`;

const SubmitButton = styled.button`
  width: 100%;
  padding: 16px;
  background: #3b82f6;
  color: white;
  border: none;
  border-radius: 12px;
  font-size: 16px;
  font-weight: 700;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  transition: background 0.2s;

  &:hover {
    background: #2563eb;
  }

  &:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }
`;

export default function CreateOrderPage() {
  const { userData } = useAuth();
  const router = useRouter();

  const [mode, setMode] = useState<'existing' | 'new'>('existing');
  
  // Existing Customer State
  const [users, setUsers] = useState<any[]>([]);
  const [searchText, setSearchText] = useState('');
  const [selectedCustomer, setSelectedCustomer] = useState<any>(null);

  // New Customer State
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [address, setAddress] = useState('');
  const [pincode, setPincode] = useState('');
  const [landmark, setLandmark] = useState('');
  const [locationCode, setLocationCode] = useState('');

  // Order Details State
  const [quantity, setQuantity] = useState('1');
  const [pricePerJar, setPricePerJar] = useState('37');
  const [isFastDelivery, setIsFastDelivery] = useState(false);
  
  const [loading, setLoading] = useState(false);
  const [fetchingUsers, setFetchingUsers] = useState(false);

  useEffect(() => {
    const fetchUsers = async () => {
      if (mode !== 'existing') return;
      setFetchingUsers(true);
      try {
        const q = query(collection(db, 'users'));
        const snap = await getDocs(q);
        const usersList = snap.docs.map(doc => {
          const d = doc.data();
          return {
            id: doc.id,
            ...d,
             wallet_balance: d.wallet_balance ?? d.walletBalance ?? 0,
             jars_occupied: d.jars_occupied ?? d.jarHold ?? 0,
          };
        });
        setUsers(usersList);
      } catch (err) {
        console.error('Error fetching users:', err);
      } finally {
        setFetchingUsers(false);
      }
    };
    fetchUsers();
  }, [mode]);

  const filteredUsers = useMemo(() => {
    if (!searchText) return [];
    const q = searchText.toLowerCase();
    return users.filter(u => 
      u.name?.toLowerCase().includes(q) || 
      u.phone?.includes(q)
    ).slice(0, 10);
  }, [users, searchText]);

  const totalAmount = useMemo(() => {
    const qty = Number(quantity) || 0;
    const price = Number(pricePerJar) || 0;
    const fastDelFee = isFastDelivery ? 7 : 0;
    return (qty * price) + fastDelFee;
  }, [quantity, pricePerJar, isFastDelivery]);

  const handleCreateOrder = async () => {
    setLoading(true);
    try {
      let customerId = selectedCustomer?.id;
      let customerData = selectedCustomer;

      if (mode === 'new') {
        if (!name.trim() || !phone.trim() || !address.trim()) {
          alert('Please enter customer name, phone, and address');
          setLoading(false);
          return;
        }

        const customerRef = await addDoc(collection(db, 'users'), {
          name: name.trim(),
          phone: phone.trim(),
          email: email.trim(),
          address: address.trim(),
          pincode: pincode.trim(),
          landmark: landmark.trim(),
          locationCode: locationCode.trim(),
          wallet_balance: -200, // ₹200 deposit for jar
          walletBalance: -200, // Legacy support
          jars_occupied: 1, // 1 free jar
          jarCount: 1, // Legacy support
          createdAt: Timestamp.fromDate(new Date()),
          updatedAt: Timestamp.fromDate(new Date()),
          role: 'customer'
        });

        customerId = customerRef.id;
        customerData = {
          id: customerRef.id,
          name: name.trim(),
          phone: phone.trim(),
          email: email.trim(),
          address: address.trim(),
          pincode: pincode.trim(),
          landmark: landmark.trim(),
          locationCode: locationCode.trim()
        };
      }

      if (!customerId) {
        alert('Please select a customer or define a new one');
        setLoading(false);
        return;
      }

      const qty = Number(quantity);
      const price = Number(pricePerJar);

      if (isNaN(qty) || qty <= 0) {
        alert('Please enter a valid quantity');
        setLoading(false);
        return;
      }

      const orderRef = await addDoc(collection(db, 'orders'), {
        userId: customerId,
        userName: customerData.name || '',
        userPhone: customerData.phone || '',
        customerName: customerData.name || '',
        customerPhone: customerData.phone || '',
        customerEmail: customerData.email || '',
        items: [{
          id: '1',
          name: '20L Water Jar',
          quantity: qty,
          price: price
        }],
        total: totalAmount,
        isFastDelivery: isFastDelivery,
        deliveryAddress: {
          address_line: customerData.address || address,
          address_type: 'Home',
          city: '',
          state: '',
          country: '',
          zipCode: customerData.pincode || pincode,
          fullAddress: customerData.address || address
        },
        status: 'pending',
        orderDate: Timestamp.fromDate(new Date()),
        createdAt: Timestamp.fromDate(new Date()),
        orderDateStr: new Date().toLocaleDateString('en-IN'),
        createdBy: userData?.id || 'admin',
        createdByName: userData?.displayName || 'Admin'
      });

      await logActivity({
        actorId: userData?.id || 'unknown',
        actorName: userData?.displayName || 'Admin',
        actor: 'ADMIN',
        action: 'ORDER_PLACED',
        details: `Created new order #${orderRef.id.slice(0,6)} for ${customerData.name} (Qty: ${qty}, Amount: ₹${totalAmount})`,
        targetId: orderRef.id,
      });

      alert(`Order created successfully for ${customerData.name}`);
      router.push('/admin/orders');

    } catch (error: any) {
      console.error(error);
      alert(error.message || 'Failed to create order');
    } finally {
      setLoading(false);
    }
  };

  return (
    <PageContainer>
      <Header>
        <Title>Create Order</Title>
        <Subtitle>Manually place an order on behalf of a customer</Subtitle>
      </Header>

      <ModeTabs>
        <ModeTab $active={mode === 'existing'} onClick={() => setMode('existing')}>
          <FiUsers size={18} /> Existing Customer
        </ModeTab>
        <ModeTab $active={mode === 'new'} onClick={() => setMode('new')}>
          <FiUserPlus size={18} /> New Customer
        </ModeTab>
      </ModeTabs>

      {mode === 'existing' && (
        <Section>
          <SectionTitle>Select Customer</SectionTitle>
          
          {selectedCustomer ? (
            <SelectedCustomerCard>
              <CustomerInfo>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <FiCheck color="#2563eb" />
                  <CustomerName>{selectedCustomer.name}</CustomerName>
                </div>
                <CustomerPhone>{selectedCustomer.phone}</CustomerPhone>
              </CustomerInfo>
              <button 
                onClick={() => setSelectedCustomer(null)}
                style={{ background: 'none', border: 'none', color: '#6b7280', cursor: 'pointer' }}
              >
                <FiX size={20} />
              </button>
            </SelectedCustomerCard>
          ) : (
            <>
              <SearchBox>
                <FiSearch />
                <Input 
                  placeholder="Search by name or phone..." 
                  value={searchText}
                  onChange={(e) => setSearchText(e.target.value)}
                />
              </SearchBox>
              
              {searchText && (
                <SearchResults>
                  {filteredUsers.length > 0 ? (
                    filteredUsers.map(u => (
                      <CustomerItem key={u.id} onClick={() => {
                        setSelectedCustomer(u);
                        setSearchText('');
                      }}>
                         <div style={{ background: '#f3f4f6', padding: '8px', borderRadius: '50%', color: '#6b7280' }}>
                           <FiUsers size={16} />
                         </div>
                         <CustomerInfo>
                           <CustomerName>{u.name}</CustomerName>
                           <CustomerPhone>{u.phone}</CustomerPhone>
                         </CustomerInfo>
                      </CustomerItem>
                    ))
                  ) : (
                    <div style={{ padding: '16px', textAlign: 'center', color: '#6b7280' }}>
                      No customers found
                    </div>
                  )}
                </SearchResults>
              )}
            </>
          )}
        </Section>
      )}

      {mode === 'new' && (
        <Section>
          <SectionTitle>Customer Details</SectionTitle>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
            <FormGroup>
              <Label>Name *</Label>
              <Input placeholder="John Doe" value={name} onChange={e => setName(e.target.value)} />
            </FormGroup>
            <FormGroup>
              <Label>Phone *</Label>
              <Input placeholder="+91..." value={phone} onChange={e => setPhone(e.target.value)} />
            </FormGroup>
          </div>
          
          <FormGroup>
            <Label>Email (Optional)</Label>
            <Input type="email" placeholder="john@example.com" value={email} onChange={e => setEmail(e.target.value)} />
          </FormGroup>

          <FormGroup>
            <Label>Full Address *</Label>
            <Input placeholder="House No, Street, Landmark" value={address} onChange={e => setAddress(e.target.value)} />
          </FormGroup>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '16px' }}>
            <FormGroup>
              <Label>Pincode</Label>
              <Input placeholder="Pincode" value={pincode} onChange={e => setPincode(e.target.value)} />
            </FormGroup>
            <FormGroup>
              <Label>Landmark (Optional)</Label>
              <Input placeholder="Nearby landmark" value={landmark} onChange={e => setLandmark(e.target.value)} />
            </FormGroup>
            <FormGroup>
              <Label>Location Code (Optional)</Label>
              <Input placeholder="E.g., SEC-18" value={locationCode} onChange={e => setLocationCode(e.target.value)} />
            </FormGroup>
          </div>
        </Section>
      )}

      <Section>
        <SectionTitle>Order Details</SectionTitle>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
          <FormGroup>
            <Label>Quantity (Jars) *</Label>
            <Input type="number" min="1" value={quantity} onChange={e => setQuantity(e.target.value)} />
          </FormGroup>
          <FormGroup>
            <Label>Price per Jar (₹) *</Label>
            <Input type="number" min="0" value={pricePerJar} onChange={e => setPricePerJar(e.target.value)} />
          </FormGroup>
        </div>

        <CheckboxLabel>
          <Checkbox 
            type="checkbox" 
            checked={isFastDelivery}
            onChange={(e) => setIsFastDelivery(e.target.checked)}
          />
          <div>
            <div style={{ fontWeight: 600, color: '#111827', fontSize: '14px' }}>Fast Delivery (30 mins)</div>
            <div style={{ fontSize: '13px', color: '#6b7280' }}>Additional ₹7.00 surcharge</div>
          </div>
        </CheckboxLabel>

        <TotalRow>
          <div style={{ fontSize: '18px', fontWeight: 600, color: '#374151' }}>Total Amount</div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: '24px', fontWeight: 700, color: '#3b82f6' }}>₹{totalAmount.toLocaleString()}</div>
            {isFastDelivery && <div style={{ fontSize: '12px', color: '#6b7280' }}>(Includes ₹7 delivery fee)</div>}
          </div>
        </TotalRow>
      </Section>

      <SubmitButton 
        onClick={handleCreateOrder}
        disabled={loading || (mode === 'existing' && !selectedCustomer)}
      >
        <FiShoppingCart />
        {loading ? 'Creating Order...' : 'Create Order'}
      </SubmitButton>

    </PageContainer>
  );
}
