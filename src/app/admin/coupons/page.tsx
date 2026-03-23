'use client';

import React, { useState, useEffect } from 'react';
import styled from 'styled-components';
import { motion } from 'framer-motion';
import { 
  FiTag, 
  FiPlus, 
  FiEdit, 
  FiTrash2, 
  FiSave, 
  FiX, 
  FiRefreshCw,
  FiCalendar,
  FiDollarSign,
  FiPercent,
  FiToggleLeft,
  FiToggleRight
} from 'react-icons/fi';
import { 
  subscribeToCollection, 
  addDocument,
  updateDocument,
  deleteDocument
} from '@/lib/firebase';

interface Coupon {
  id: string;
  code: string;
  description: string;
  type: string;
  discountType: string;
  discountValue: number;
  maxUses: number | null;
  usedCount: number;
  isActive: boolean;
  createdAt: Date | { toDate(): Date } | string;
  expiresAt: Date | { toDate(): Date } | string | null;
}

const CouponsContainer = styled.div`
  padding: 20px;
  max-width: 1400px;
  margin: 0 auto;
`;

const Header = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 30px;
  flex-wrap: wrap;
  gap: 20px;
`;

const TitleSection = styled.div`
  display: flex;
  align-items: center;
  gap: 15px;
`;

const Title = styled.h1`
  color: #333;
  margin: 0;
  font-size: 2rem;
  font-weight: 700;
`;

const ActionButton = styled(motion.button)`
  background: linear-gradient(135deg, #8e2de2 0%, #4a00e0 100%);
  color: white;
  border: none;
  padding: 12px 20px;
  border-radius: 10px;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 8px;
  font-weight: 600;
  transition: all 0.3s ease;

  &:hover {
    transform: translateY(-2px);
    box-shadow: 0 5px 15px rgba(142, 45, 226, 0.4);
  }

  &:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }
`;

const CouponsGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(350px, 1fr));
  gap: 25px;
  margin-bottom: 40px;
`;

const CouponCard = styled(motion.div)<{ active: boolean }>`
  background: white;
  padding: 25px;
  border-radius: 16px;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.08);
  border: 1px solid ${props => props.active ? '#10b981' : '#f0f0f0'};
  position: relative;
  overflow: hidden;
  transition: all 0.3s ease;

  &::before {
    content: '';
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    height: 4px;
    background: ${props => props.active 
      ? 'linear-gradient(135deg, #10b981 0%, #059669 100%)' 
      : 'linear-gradient(135deg, #8e2de2 0%, #4a00e0 100%)'};
  }

  ${props => !props.active && `
    opacity: 0.7;
  `}
`;

const CouponHeader = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 20px;
`;

const CouponCode = styled.h3`
  color: #333;
  margin: 0;
  font-size: 1.5rem;
  font-weight: 700;
  font-family: monospace;
  background: #f3f4f6;
  padding: 8px 12px;
  border-radius: 8px;
  display: inline-block;
`;

const CouponStatus = styled.div<{ $active: boolean }>`
  padding: 6px 12px;
  border-radius: 20px;
  font-size: 0.8rem;
  font-weight: 600;
  text-transform: uppercase;
  ${props => props.$active
    ? `background: #d1fae5; color: #065f46;`
    : `background: #fee2e2; color: #991b1b;`
  }
`;

const CouponDetails = styled.div`
  margin-bottom: 20px;
`;

const DetailRow = styled.div`
  display: flex;
  justify-content: space-between;
  margin-bottom: 12px;
  padding-bottom: 12px;
  border-bottom: 1px solid #f0f0f0;

  &:last-child {
    border-bottom: none;
    margin-bottom: 0;
    padding-bottom: 0;
  }
`;

const DetailLabel = styled.div`
  color: #666;
  font-size: 0.9rem;
`;

const DetailValue = styled.div`
  color: #333;
  font-weight: 600;
  text-align: right;
`;

const CouponDescription = styled.div`
  color: #666;
  font-size: 0.9rem;
  margin-top: 15px;
  padding-top: 15px;
  border-top: 1px solid #f0f0f0;
`;

const FormContainer = styled.div`
  background: white;
  padding: 30px;
  border-radius: 16px;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.08);
  border: 1px solid #f0f0f0;
  margin-bottom: 40px;
`;

const FormTitle = styled.h2`
  color: #333;
  margin: 0 0 25px 0;
  font-size: 1.5rem;
  font-weight: 600;
  display: flex;
  align-items: center;
  gap: 10px;
`;

const FormGroup = styled.div`
  margin-bottom: 20px;
`;

const FormLabel = styled.label`
  display: block;
  margin-bottom: 8px;
  font-weight: 500;
  color: #333;
`;

const FormInput = styled.input`
  width: 100%;
  padding: 12px 16px;
  border: 2px solid #e5e7eb;
  border-radius: 10px;
  font-size: 1rem;
  transition: all 0.3s ease;

  &:focus {
    outline: none;
    border-color: #8e2de2;
    box-shadow: 0 0 0 3px rgba(142, 45, 226, 0.1);
  }
`;

const FormSelect = styled.select`
  width: 100%;
  padding: 12px 16px;
  border: 2px solid #e5e7eb;
  border-radius: 10px;
  font-size: 1rem;
  background: white;
  cursor: pointer;
  transition: all 0.3s ease;

  &:focus {
    outline: none;
    border-color: #8e2de2;
    box-shadow: 0 0 0 3px rgba(142, 45, 226, 0.1);
  }
`;

const FormTextArea = styled.textarea`
  width: 100%;
  padding: 12px 16px;
  border: 2px solid #e5e7eb;
  border-radius: 10px;
  font-size: 1rem;
  min-height: 100px;
  resize: vertical;
  transition: all 0.3s ease;

  &:focus {
    outline: none;
    border-color: #8e2de2;
    box-shadow: 0 0 0 3px rgba(142, 45, 226, 0.1);
  }
`;

const ToggleContainer = styled.div`
  display: flex;
  align-items: center;
  gap: 10px;
`;

const ToggleLabel = styled.span`
  font-weight: 500;
  color: #333;
`;

const ButtonGroup = styled.div`
  display: flex;
  gap: 12px;
  flex-wrap: wrap;
  margin-top: 20px;
`;

const SecondaryButton = styled.button`
  background: white;
  color: #374151;
  border: 2px solid #e5e7eb;
  padding: 12px 20px;
  border-radius: 10px;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 8px;
  font-weight: 600;
  transition: all 0.3s ease;

  &:hover {
    border-color: #8e2de2;
    color: #8e2de2;
  }
`;

const DeleteButton = styled.button`
  background: #ef4444;
  color: white;
  border: none;
  padding: 12px 20px;
  border-radius: 10px;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 8px;
  font-weight: 600;
  transition: all 0.3s ease;

  &:hover {
    background: #dc2626;
    transform: translateY(-2px);
  }
`;

const EmptyState = styled.div`
  text-align: center;
  padding: 60px 20px;
  color: #666;
`;

const LoadingSpinner = styled(motion.div)`
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 40px;
  
  svg {
    animation: spin 1s linear infinite;
  }

  @keyframes spin {
    from { transform: rotate(0deg); }
    to { transform: rotate(360deg); }
  }
`;

const InfoBox = styled.div`
  background: #e0f2fe;
  border: 1px solid #0891b2;
  color: #0c4a6e;
  padding: 15px;
  border-radius: 10px;
  margin-bottom: 20px;
  display: flex;
  align-items: flex-start;
  gap: 10px;
  font-size: 0.9rem;
  line-height: 1.5;
`;

export default function CouponsManagement() {
  const [coupons, setCoupons] = useState<Coupon[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editingCoupon, setEditingCoupon] = useState<Coupon | null>(null);
  const [formData, setFormData] = useState({
    code: '',
    description: '',
    type: 'joining_fee_waiver',
    discountType: 'fixed_amount',
    discountValue: 200,
    maxUses: '',
    expiresAt: '',
    isActive: true
  });

  // Helper function to convert various date formats to Date object
  const toDate = (dateValue: Date | { toDate(): Date } | string | number): Date => {
    if (!dateValue) return new Date();
    if (dateValue instanceof Date) return dateValue;
    if (typeof dateValue === 'object' && 'toDate' in dateValue) return dateValue.toDate();
    return new Date(dateValue);
  };

  useEffect(() => {
    const unsubscribe = subscribeToCollection('coupons', (snapshot) => {
      try {
        const couponsData = snapshot.docs.map(doc => {
          const data = doc.data();
          return {
            id: doc.id,
            ...data,
            createdAt: data.createdAt || new Date(),
            expiresAt: data.expiresAt || null,
            maxUses: data.maxUses || null,
            usedCount: data.usedCount || 0
          };
        }) as Coupon[];
        
        setCoupons(couponsData);
        setLoading(false);
      } catch (error) {
        console.error('Error processing coupons:', error);
        setLoading(false);
      }
    }, [], (error) => {
      console.error('Coupons subscription error:', error);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target as HTMLInputElement;
    
    if (type === 'checkbox') {
      const checked = (e.target as HTMLInputElement).checked;
      setFormData(prev => ({ ...prev, [name]: checked }));
    } else {
      setFormData(prev => ({ ...prev, [name]: value }));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setActionLoading(true);
    
    try {
      const couponData = {
        code: formData.code.toUpperCase(),
        description: formData.description,
        type: formData.type,
        discountType: formData.discountType,
        discountValue: Number(formData.discountValue),
        maxUses: formData.maxUses ? Number(formData.maxUses) : null,
        usedCount: 0,
        isActive: formData.isActive,
        createdAt: new Date(),
        expiresAt: formData.expiresAt ? new Date(formData.expiresAt) : null
      };
      
      if (editingCoupon) {
        await updateDocument('coupons', editingCoupon.id, couponData);
        alert('Coupon updated successfully!');
      } else {
        await addDocument('coupons', couponData);
        alert('Coupon created successfully!');
      }
      
      resetForm();
    } catch (error) {
      console.error('Error saving coupon:', error);
      alert('Error saving coupon. Please try again.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleEdit = (coupon: Coupon) => {
    setEditingCoupon(coupon);
    setFormData({
      code: coupon.code,
      description: coupon.description || '',
      type: coupon.type || 'joining_fee_waiver',
      discountType: coupon.discountType || 'fixed_amount',
      discountValue: coupon.discountValue || 200,
      maxUses: coupon.maxUses ? coupon.maxUses.toString() : '',
      expiresAt: coupon.expiresAt ? toDate(coupon.expiresAt).toISOString().split('T')[0] : '',
      isActive: coupon.isActive
    });
    setShowForm(true);
  };

  const handleDelete = async (couponId: string, couponCode: string) => {
    const confirmDelete = window.confirm(`Are you sure you want to delete coupon "${couponCode}"? This action cannot be undone.`);
    
    if (!confirmDelete) return;
    
    setActionLoading(true);
    try {
      await deleteDocument('coupons', couponId);
      alert('Coupon deleted successfully!');
    } catch (error) {
      console.error('Error deleting coupon:', error);
      alert('Error deleting coupon. Please try again.');
    } finally {
      setActionLoading(false);
    }
  };

  const resetForm = () => {
    setFormData({
      code: '',
      description: '',
      type: 'joining_fee_waiver',
      discountType: 'fixed_amount',
      discountValue: 200,
      maxUses: '',
      expiresAt: '',
      isActive: true
    });
    setEditingCoupon(null);
    setShowForm(false);
  };

  const toggleCouponStatus = async (coupon: Coupon) => {
    setActionLoading(true);
    try {
      await updateDocument('coupons', coupon.id, {
        isActive: !coupon.isActive
      });
      alert(`Coupon ${!coupon.isActive ? 'activated' : 'deactivated'} successfully!`);
    } catch (error) {
      console.error('Error toggling coupon status:', error);
      alert('Error updating coupon status. Please try again.');
    } finally {
      setActionLoading(false);
    }
  };

  if (loading) {
    return (
      <LoadingSpinner>
        <FiRefreshCw size={40} />
      </LoadingSpinner>
    );
  }

  return (
    <CouponsContainer>
      <Header>
        <TitleSection>
          <FiTag size={32} style={{ color: '#8e2de2' }} />
          <Title>Coupon Management</Title>
        </TitleSection>
        <ActionButton 
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={() => {
            resetForm();
            setShowForm(true);
          }}
          disabled={actionLoading}
        >
          <FiPlus /> Create New Coupon
        </ActionButton>
      </Header>

      <InfoBox>
        <FiTag />
        <div>
          <strong>Coupon Management System</strong>
          <br />• Create and manage discount coupons for your customers
          <br />• <strong>Important:</strong> Discounts apply to item value only (₹37 × quantity), excluding delivery charges
          <br />• Track coupon usage and expiration dates
          <br />• Activate/deactivate coupons as needed
          <br />• NEW100 coupon for waiving ₹200 joining fee for new users
        </div>
      </InfoBox>

      {showForm && (
        <FormContainer>
          <FormTitle>
            <FiTag /> {editingCoupon ? 'Edit Coupon' : 'Create New Coupon'}
          </FormTitle>
          
          <form onSubmit={handleSubmit}>
            <FormGroup>
              <FormLabel htmlFor="code">Coupon Code *</FormLabel>
              <FormInput
                type="text"
                id="code"
                name="code"
                value={formData.code}
                onChange={handleInputChange}
                placeholder="e.g., NEW100"
                required
                disabled={!!editingCoupon}
              />
            </FormGroup>
            
            <FormGroup>
              <FormLabel htmlFor="description">Description</FormLabel>
              <FormTextArea
                id="description"
                name="description"
                value={formData.description}
                onChange={handleInputChange}
                placeholder="Describe what this coupon does... (Note: Discounts apply to item value only - ₹37 × quantity)"
              />
            </FormGroup>
            
            <FormGroup>
              <FormLabel htmlFor="type">Coupon Type</FormLabel>
              <FormSelect
                id="type"
                name="type"
                value={formData.type}
                onChange={handleInputChange}
              >
                <option value="joining_fee_waiver">Joining Fee Waiver</option>
                <option value="percentage_discount">Percentage Discount</option>
                <option value="fixed_amount">Fixed Amount Discount</option>
                <option value="free_delivery">Free Delivery</option>
              </FormSelect>
            </FormGroup>
            
            <FormGroup>
              <FormLabel htmlFor="discountType">Discount Type</FormLabel>
              <FormSelect
                id="discountType"
                name="discountType"
                value={formData.discountType}
                onChange={handleInputChange}
              >
                <option value="fixed_amount">Fixed Amount</option>
                <option value="percentage">Percentage</option>
              </FormSelect>
            </FormGroup>
            
            <FormGroup>
              <FormLabel htmlFor="discountValue">Discount Value</FormLabel>
              <FormInput
                type="number"
                id="discountValue"
                name="discountValue"
                value={formData.discountValue}
                onChange={handleInputChange}
                min="0"
                step="1"
              />
              {formData.discountType === 'percentage' ? (
                <div style={{ fontSize: '0.9rem', color: '#666', marginTop: '5px' }}>
                  Percentage discount applied to item value (₹37 × quantity)
                </div>
              ) : (
                <div style={{ fontSize: '0.9rem', color: '#666', marginTop: '5px' }}>
                  Fixed amount discount applied to item value (₹37 × quantity)
                </div>
              )}
            </FormGroup>
            
            <FormGroup>
              <FormLabel htmlFor="maxUses">Maximum Uses (optional)</FormLabel>
              <FormInput
                type="number"
                id="maxUses"
                name="maxUses"
                value={formData.maxUses}
                onChange={handleInputChange}
                min="0"
                placeholder="Unlimited if left blank"
              />
            </FormGroup>
            
            <FormGroup>
              <FormLabel htmlFor="expiresAt">Expiration Date (optional)</FormLabel>
              <FormInput
                type="date"
                id="expiresAt"
                name="expiresAt"
                value={formData.expiresAt}
                onChange={handleInputChange}
              />
            </FormGroup>
            
            <FormGroup>
              <ToggleContainer>
                <ToggleLabel>Active Status:</ToggleLabel>
                {formData.isActive ? (
                  <FiToggleRight 
                    size={24} 
                    color="#10b981" 
                    style={{ cursor: 'pointer' }}
                    onClick={() => setFormData(prev => ({ ...prev, isActive: false }))}
                  />
                ) : (
                  <FiToggleLeft 
                    size={24} 
                    color="#9ca3af" 
                    style={{ cursor: 'pointer' }}
                    onClick={() => setFormData(prev => ({ ...prev, isActive: true }))}
                  />
                )}
                <span>{formData.isActive ? 'Active' : 'Inactive'}</span>
              </ToggleContainer>
            </FormGroup>
            
            <ButtonGroup>
              <ActionButton 
                type="submit" 
                disabled={actionLoading}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
              >
                <FiSave /> {actionLoading ? 'Saving...' : (editingCoupon ? 'Update Coupon' : 'Create Coupon')}
              </ActionButton>
              
              <SecondaryButton 
                type="button" 
                onClick={resetForm}
                disabled={actionLoading}
              >
                <FiX /> Cancel
              </SecondaryButton>
              
              {editingCoupon && (
                <DeleteButton 
                  type="button" 
                  onClick={() => handleDelete(editingCoupon.id, editingCoupon.code)}
                  disabled={actionLoading}
                >
                  <FiTrash2 /> Delete Coupon
                </DeleteButton>
              )}
            </ButtonGroup>
          </form>
        </FormContainer>
      )}

      <CouponsGrid>
        {coupons.length > 0 ? (
          coupons.map((coupon, index) => {
            const isExpired = coupon.expiresAt && toDate(coupon.expiresAt) < new Date();
            const isMaxUsed = coupon.maxUses && coupon.usedCount >= coupon.maxUses;
            const isActive = coupon.isActive && !isExpired && !isMaxUsed;
            
            return (
              <CouponCard
                key={coupon.id}
                active={isActive}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.1 }}
              >
                <CouponHeader>
                  <CouponCode>{coupon.code}</CouponCode>
                  <CouponStatus $active={isActive}>
                    {isActive ? 'Active' : isExpired ? 'Expired' : isMaxUsed ? 'Max Used' : 'Inactive'}
                  </CouponStatus>
                </CouponHeader>
                
                <CouponDetails>
                  <DetailRow>
                    <DetailLabel>Type</DetailLabel>
                    <DetailValue>
                      {coupon.type === 'joining_fee_waiver' ? 'Joining Fee Waiver' :
                       coupon.type === 'percentage_discount' ? 'Percentage Discount' :
                       coupon.type === 'fixed_amount' ? 'Fixed Amount Discount' :
                       coupon.type === 'free_delivery' ? 'Free Delivery' : coupon.type}
                    </DetailValue>
                  </DetailRow>
                  
                  <DetailRow>
                    <DetailLabel>Discount</DetailLabel>
                    <DetailValue>
                      {coupon.discountType === 'percentage' ? (
                        <><FiPercent /> {coupon.discountValue}% off item value</>
                      ) : (
                        <><FiDollarSign /> ₹{coupon.discountValue} off item value</>
                      )}
                    </DetailValue>
                  </DetailRow>
                  
                  <DetailRow>
                    <DetailLabel>Note</DetailLabel>
                    <DetailValue style={{ fontSize: '0.8rem', color: '#666' }}>
                      Applied to ₹37 × quantity only
                    </DetailValue>
                  </DetailRow>
                  
                  <DetailRow>
                    <DetailLabel>Usage</DetailLabel>
                    <DetailValue>
                      {coupon.usedCount} / {coupon.maxUses || '∞'}
                    </DetailValue>
                  </DetailRow>
                  
                  {coupon.expiresAt && (
                    <DetailRow>
                      <DetailLabel>Expires</DetailLabel>
                      <DetailValue>
                        <FiCalendar /> {toDate(coupon.expiresAt).toLocaleDateString()}
                      </DetailValue>
                    </DetailRow>
                  )}
                </CouponDetails>
                
                {coupon.description && (
                  <CouponDescription>
                    {coupon.description}
                  </CouponDescription>
                )}
                
                <ButtonGroup>
                  <SecondaryButton 
                    onClick={() => handleEdit(coupon)}
                    disabled={actionLoading}
                  >
                    <FiEdit /> Edit
                  </SecondaryButton>
                  
                  <SecondaryButton 
                    onClick={() => toggleCouponStatus(coupon)}
                    disabled={actionLoading}
                  >
                    {coupon.isActive ? <FiToggleRight /> : <FiToggleLeft />} 
                    {coupon.isActive ? 'Deactivate' : 'Activate'}
                  </SecondaryButton>
                  
                  <DeleteButton 
                    onClick={() => handleDelete(coupon.id, coupon.code)}
                    disabled={actionLoading}
                  >
                    <FiTrash2 /> Delete
                  </DeleteButton>
                </ButtonGroup>
              </CouponCard>
            );
          })
        ) : (
          <EmptyState>
            <FiTag size={48} style={{ marginBottom: '16px' }} />
            <h3>No Coupons Found</h3>
            <p>Create your first coupon to get started</p>
          </EmptyState>
        )}
      </CouponsGrid>
    </CouponsContainer>
  );
}