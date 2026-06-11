'use client';

import React, { useState } from 'react';
import styled from 'styled-components';
import { useRouter } from 'next/navigation';
import { 
  FiArrowLeft, FiSave, FiInfo, FiBriefcase, FiMapPin, 
  FiFileText, FiPhone, FiMail, FiDollarSign, FiClock,
  FiPlus, FiTrash2
} from 'react-icons/fi';
import { createB2BClient } from '@/lib/b2bService';
import { useAuth } from '@/context/AuthContext';
import { Timestamp } from 'firebase/firestore';

/* ── Styled Components ────────────────────────────────────────── */
const Container = styled.div`
  max-width: 1000px;
  margin: 0 auto;
  display: flex;
  flex-direction: column;
  gap: 32px;
  animation: fadeIn 0.4s ease-out;

  @keyframes fadeIn {
    from { opacity: 0; transform: translateY(10px); }
    to { opacity: 1; transform: translateY(0); }
  }
`;

const TopBar = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
`;

const BackButton = styled.button`
  background: none;
  border: none;
  color: var(--color-text-secondary);
  display: flex;
  align-items: center;
  gap: 8px;
  font-weight: 600;
  cursor: pointer;
  transition: color 0.2s;

  &:hover {
    color: var(--color-accent-cyan);
  }
`;

const FormSection = styled.div`
  background: var(--color-background-secondary);
  border: 1px solid var(--color-border-primary);
  border-radius: 16px;
  padding: 32px;
  display: flex;
  flex-direction: column;
  gap: 24px;
`;

const SectionHeader = styled.div`
  display: flex;
  align-items: center;
  gap: 12px;
  padding-bottom: 16px;
  border-bottom: 1px solid var(--color-border-primary);
  
  svg {
    font-size: 1.2rem;
    color: var(--color-accent-cyan);
  }
  
  h2 {
    font-size: 1.1rem;
    font-weight: 700;
    color: var(--color-text-primary);
  }
`;

const FormGroup = styled.div`
  display: grid;
  grid-template-cols: repeat(auto-fit, minmax(240px, 1fr));
  gap: 20px;
`;

const Field = styled.div`
  display: flex;
  flex-direction: column;
  gap: 8px;

  label {
    font-size: 0.8rem;
    font-weight: 600;
    color: var(--color-text-secondary);
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }

  input, select, textarea {
    background: var(--color-background-tertiary);
    border: 1px solid var(--color-border-primary);
    padding: 12px 16px;
    border-radius: 8px;
    color: var(--color-text-primary);
    font-size: 0.95rem;
    transition: all 0.2s;

    &:focus {
      outline: none;
      border-color: var(--color-accent-cyan);
      box-shadow: 0 0 0 2px rgba(0, 229, 255, 0.1);
    }

    &::placeholder {
      color: var(--color-text-tertiary);
    }
  }
`;

const SaveButton = styled.button`
  background: var(--color-accent-cyan);
  color: #0f172a;
  border: none;
  padding: 14px 28px;
  border-radius: 10px;
  font-weight: 800;
  font-size: 1rem;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
  transition: all 0.2s;

  &:hover {
    transform: translateY(-2px);
    box-shadow: 0 6px 20px rgba(0, 229, 255, 0.3);
  }

  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
    transform: none;
  }
`;

/* ── Main Component ────────────────────────────────────────── */
export default function NewB2BClient() {
  const router = useRouter();
  const { userData } = useAuth();
  const [loading, setLoading] = useState(false);
  
  const [formData, setFormData] = useState({
    companyName: '',
    tradeLicense: '',
    gstin: '',
    pan: '',
    primaryContact: { name: '', phone: '', email: '', designation: '' },
    billingAddress: { street: '', landmark: '', pincode: '', city: 'Kolkata', state: 'West Bengal' },
    contractTerms: {
      startDate: new Date().toISOString().split('T')[0],
      endDate: new Date(new Date().setFullYear(new Date().getFullYear() + 1)).toISOString().split('T')[0],
      creditPeriod: 30,
      creditLimit: 50000,
      paymentMode: 'credit',
      pricePerJar: 45,
      minimumOrderQuantity: 10,
      securityDeposit: 5000,
      billingCycle: 'monthly',
      autoRenewal: true
    }
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const clientId = `B2B-${Date.now().toString().slice(-6)}`;
      
      await createB2BClient({
        ...formData,
        clientId,
        contractTerms: {
          ...formData.contractTerms,
          startDate: Timestamp.fromDate(new Date(formData.contractTerms.startDate)),
          endDate: Timestamp.fromDate(new Date(formData.contractTerms.endDate)),
        },
        secondaryContacts: [],
        deliveryLocations: [],
        accountManager: userData?.uid || 'system',
        status: 'active',
        kycStatus: 'pending',
        kycDocuments: {},
        createdBy: userData?.uid || 'system'
      } as any);

      router.push('/admin/b2b');
    } catch (error) {
      console.error('Submission failed:', error);
      alert('Failed to register client. Check console.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Container>
      <TopBar>
        <BackButton onClick={() => router.back()}>
          <FiArrowLeft /> Back to B2B Console
        </BackButton>
        <SaveButton onClick={handleSubmit} disabled={loading}>
          <FiSave /> {loading ? 'Registering...' : 'Register Enterprise Client'}
        </SaveButton>
      </TopBar>

      <form onSubmit={handleSubmit}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          {/* Section 1: Company Profile */}
          <FormSection>
            <SectionHeader>
              <FiBriefcase />
              <h2>Corporate Identity</h2>
            </SectionHeader>
            <FormGroup>
              <Field>
                <label>Legal Company Name</label>
                <input 
                  required
                  placeholder="e.g. Acme Corp Solutions Pvt Ltd"
                  value={formData.companyName}
                  onChange={e => setFormData({...formData, companyName: e.target.value})}
                />
              </Field>
              <Field>
                <label>GSTIN</label>
                <input 
                  required
                  placeholder="19XXXXX..."
                  value={formData.gstin}
                  onChange={e => setFormData({...formData, gstin: e.target.value})}
                />
              </Field>
            </FormGroup>
            <FormGroup>
              <Field>
                <label>Trade License / CIN</label>
                <input 
                  required
                  placeholder="License Number"
                  value={formData.tradeLicense}
                  onChange={e => setFormData({...formData, tradeLicense: e.target.value})}
                />
              </Field>
              <Field>
                <label>Company PAN</label>
                <input 
                  required
                  placeholder="ABCDE1234F"
                  value={formData.pan}
                  onChange={e => setFormData({...formData, pan: e.target.value})}
                />
              </Field>
            </FormGroup>
          </FormSection>

          {/* Section 2: Contact Details */}
          <FormSection>
            <SectionHeader>
              <FiPhone />
              <h2>Primary Point of Contact</h2>
            </SectionHeader>
            <FormGroup>
              <Field>
                <label>Full Name</label>
                <input 
                  required
                  placeholder="Operations Manager"
                  value={formData.primaryContact.name}
                  onChange={e => setFormData({...formData, primaryContact: {...formData.primaryContact, name: e.target.value}})}
                />
              </Field>
              <Field>
                <label>Designation</label>
                <input 
                  placeholder="e.g. Procurement Lead"
                  value={formData.primaryContact.designation}
                  onChange={e => setFormData({...formData, primaryContact: {...formData.primaryContact, designation: e.target.value}})}
                />
              </Field>
            </FormGroup>
            <FormGroup>
              <Field>
                <label>Phone Number</label>
                <input 
                  required
                  placeholder="+91..."
                  value={formData.primaryContact.phone}
                  onChange={e => setFormData({...formData, primaryContact: {...formData.primaryContact, phone: e.target.value}})}
                />
              </Field>
              <Field>
                <label>Official Email</label>
                <input 
                  required
                  type="email"
                  placeholder="email@company.com"
                  value={formData.primaryContact.email}
                  onChange={e => setFormData({...formData, primaryContact: {...formData.primaryContact, email: e.target.value}})}
                />
              </Field>
            </FormGroup>
          </FormSection>

          {/* Section 3: Billing & Logistics Address */}
          <FormSection>
            <SectionHeader>
              <FiMapPin />
              <h2>Billing Headquarters</h2>
            </SectionHeader>
            <Field>
              <label>Street Address</label>
              <textarea 
                required
                rows={2}
                placeholder="Building, Floor, Block..."
                value={formData.billingAddress.street}
                onChange={e => setFormData({...formData, billingAddress: {...formData.billingAddress, street: e.target.value}})}
              />
            </Field>
            <FormGroup>
              <Field>
                <label>Landmark</label>
                <input 
                  placeholder="Near..."
                  value={formData.billingAddress.landmark}
                  onChange={e => setFormData({...formData, billingAddress: {...formData.billingAddress, landmark: e.target.value}})}
                />
              </Field>
              <Field>
                <label>Pincode</label>
                <input 
                  required
                  placeholder="700XXX"
                  value={formData.billingAddress.pincode}
                  onChange={e => setFormData({...formData, billingAddress: {...formData.billingAddress, pincode: e.target.value}})}
                />
              </Field>
            </FormGroup>
          </FormSection>

          {/* Section 4: Commercial Contract Terms */}
          <FormSection>
            <SectionHeader>
              <FiFileText />
              <h2>Commercial Contract</h2>
            </SectionHeader>
            <FormGroup>
              <Field>
                <label>Contract Start Date</label>
                <input 
                  type="date"
                  value={formData.contractTerms.startDate}
                  onChange={e => setFormData({...formData, contractTerms: {...formData.contractTerms, startDate: e.target.value}})}
                />
              </Field>
              <Field>
                <label>Contract End Date</label>
                <input 
                  type="date"
                  value={formData.contractTerms.endDate}
                  onChange={e => setFormData({...formData, contractTerms: {...formData.contractTerms, endDate: e.target.value}})}
                />
              </Field>
            </FormGroup>
            <FormGroup>
              <Field>
                <label>Price Per Jar (₹)</label>
                <input 
                  type="number"
                  value={formData.contractTerms.pricePerJar || ''}
                  onChange={e => {
                    const val = parseInt(e.target.value);
                    setFormData({...formData, contractTerms: {...formData.contractTerms, pricePerJar: isNaN(val) ? 0 : val}});
                  }}
                />
              </Field>
              <Field>
                <label>Credit Limit (₹)</label>
                <input 
                  type="number"
                  value={formData.contractTerms.creditLimit || ''}
                  onChange={e => {
                    const val = parseInt(e.target.value);
                    setFormData({...formData, contractTerms: {...formData.contractTerms, creditLimit: isNaN(val) ? 0 : val}});
                  }}
                />
              </Field>
            </FormGroup>
            <FormGroup>
              <Field>
                <label>Security Deposit (₹)</label>
                <input 
                  type="number"
                  value={formData.contractTerms.securityDeposit || ''}
                  onChange={e => {
                    const val = parseInt(e.target.value);
                    setFormData({...formData, contractTerms: {...formData.contractTerms, securityDeposit: isNaN(val) ? 0 : val}});
                  }}
                />
              </Field>
              <Field>
                <label>Min. Order Qty (Jars)</label>
                <input 
                  type="number"
                  value={formData.contractTerms.minimumOrderQuantity || ''}
                  onChange={e => {
                    const val = parseInt(e.target.value);
                    setFormData({...formData, contractTerms: {...formData.contractTerms, minimumOrderQuantity: isNaN(val) ? 0 : val}});
                  }}
                />
              </Field>
            </FormGroup>
            <FormGroup>
              <Field>
                <label>Credit Period (Days)</label>
                <select
                  value={formData.contractTerms.creditPeriod}
                  onChange={e => setFormData({...formData, contractTerms: {...formData.contractTerms, creditPeriod: parseInt(e.target.value)}})}
                >
                  <option value={0}>0 (Cash/Advance)</option>
                  <option value={7}>7 Days</option>
                  <option value={15}>15 Days</option>
                  <option value={30}>30 Days</option>
                  <option value={45}>45 Days</option>
                  <option value={60}>60 Days</option>
                </select>
              </Field>
              <Field>
                <label>Billing Cycle</label>
                <select
                  value={formData.contractTerms.billingCycle}
                  onChange={e => setFormData({...formData, contractTerms: {...formData.contractTerms, billingCycle: e.target.value as any}})}
                >
                  <option value="weekly">Weekly</option>
                  <option value="biweekly">Bi-Weekly</option>
                  <option value="monthly">Monthly</option>
                </select>
              </Field>
            </FormGroup>
          </FormSection>
        </div>
      </form>
    </Container>
  );
}
