import { Timestamp } from 'firebase/firestore';

export type B2BStatus = 'active' | 'suspended' | 'inactive';
export type KYCStatus = 'pending' | 'verified' | 'rejected';
export type PaymentMode = 'credit' | 'advance' | 'cod';
export type BillingCycle = 'weekly' | 'biweekly' | 'monthly';

export interface B2BContact {
  name: string;
  phone: string;
  email: string;
  designation: string;
}

export interface B2BAddress {
  street: string;
  landmark: string;
  pincode: string;
  city: string;
  state: string;
  gstin?: string; // Location-specific GST if different
}

export interface DeliveryLocation {
  locationId: string;
  siteName: string;
  address: B2BAddress;
  contactPerson: {
    name: string;
    phone: string;
  };
  deliverySchedule: {
    frequency: 'daily' | 'weekly' | 'biweekly' | 'monthly' | 'on-demand';
    preferredDays: string[];
    preferredTimeSlot: string;
  };
  averageConsumption: number;
  isActive: boolean;
}

export interface B2BClient {
  id?: string;
  clientId: string; // Statutory ID: B2B-XXXX
  companyName: string;
  tradeLicense: string;
  gstin: string;
  pan: string;
  
  primaryContact: B2BContact;
  secondaryContacts: B2BContact[];
  
  billingAddress: B2BAddress;
  deliveryLocations: DeliveryLocation[];
  
  contractTerms: {
    startDate: Timestamp;
    endDate: Timestamp;
    autoRenewal: boolean;
    creditPeriod: number; // Days
    creditLimit: number;
    paymentMode: PaymentMode;
    pricePerJar: number;
    minimumOrderQuantity: number;
    securityDeposit: number;
    billingCycle: BillingCycle;
  };
  
  jarInventory: {
    totalAllocated: number;
    atClient: number;
    inTransit: number;
  };
  
  financialSummary: {
    totalRevenue: number;
    outstandingAmount: number;
    advanceBalance: number;
    lastPaymentDate?: Timestamp;
    lastPaymentAmount?: number;
  };
  
  accountManager: string; // Admin UID
  status: B2BStatus;
  kycStatus: KYCStatus;
  kycDocuments: {
    tradeLicenseUrl?: string;
    gstCertificateUrl?: string;
    panCardUrl?: string;
  };
  
  createdAt: Timestamp;
  updatedAt: Timestamp;
  createdBy: string;
}

export interface B2BLedgerEntry {
  id?: string;
  clientId: string;
  type: 'jar_delivery' | 'jar_return' | 'payment_received' | 'invoice_issued' | 'manual_adjustment' | 'delivery_handover';
  amount?: number; // For financial transactions
  jarCount?: number; // For jar movements
  deliveredCount?: number; // For premium serial scan movements
  returnedCount?: number; // For premium serial scan movements
  referenceId: string; // Order ID or Invoice ID
  description: string;
  timestamp: Timestamp;
  recordedBy: string;
  metadata?: any;
}
