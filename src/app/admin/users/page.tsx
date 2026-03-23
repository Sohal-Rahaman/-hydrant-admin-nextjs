'use client';

import React, { useState, useEffect } from 'react';
import Image from 'next/image';
import styled, { css } from 'styled-components';
import { motion, AnimatePresence } from 'framer-motion';
import {
  FiUsers, FiSearch, FiPhone, FiMail, FiMapPin, FiCalendar,
  FiDollarSign, FiPackage, FiX, FiEdit3, FiSave, FiRefreshCw,
  FiNavigation, FiTrendingUp, FiCheckCircle, FiXCircle,
  FiStar, FiClock, FiActivity, FiArrowRight, FiInfo
} from 'react-icons/fi';
import {
  subscribeToCollection,
  updateDocument,
  addDocument,
  deleteDocument,
  generateCustomerId,
  getDocument
} from '@/lib/firebase';
import { useAuth } from '@/context/AuthContext';
import { logActivity } from '@/lib/activityLogger';

// Interface definitions
interface Address {
  id: string;
  userId: string;
  type: string; // 'home', 'office', etc.
  addressLine?: string; // Full address line from Firebase
  street: string;
  city: string;
  state: string;
  pincode: string;
  floor?: string;
  apartment?: string;
  landmark?: string;
  isDefault: boolean;
  createdAt: Date | { toDate(): Date } | string;
}

interface User {
  id: string;
  customerId: string;
  name: string; // Single name field from Firebase
  firstName?: string; // Legacy field for backward compatibility
  lastName?: string; // Legacy field for backward compatibility
  email: string;
  phoneNumber: string;
  createdAt: Date | { toDate(): Date } | string;
  totalCoins: number;
  totalShares: number;
  wallet_balance: number;
  jars_occupied: number;
  totalRevenue: number;
  totalCans: number;
  orders: Order[];
  addresses: Address[];
  subscription?: Subscription;
  referralCoins?: number;
  depositMoney?: number;
  role?: string;
  firstOrderDate?: Date | null;
  lastOrderDate?: Date | null;
  totalCompletedOrders?: number;
  totalCancelledOrders?: number;
}

// --- Helper Functions ---
const formatDate = (date: Date | { toDate(): Date } | string | number | undefined, includeTime = false) => {
  if (!date) return 'N/A';
  let d: Date;

  if (typeof date === 'string' || typeof date === 'number') {
    d = new Date(date);
  } else if (typeof date === 'object' && 'toDate' in date && typeof date.toDate === 'function') {
    d = date.toDate();
  } else if (date instanceof Date) {
    d = date;
  } else {
    return 'N/A';
  }

  if (isNaN(d.getTime())) return 'N/A';

  const options: Intl.DateTimeFormatOptions = {
    day: 'numeric', month: 'short', year: 'numeric',
    ...(includeTime && { hour: '2-digit', minute: '2-digit' })
  };
  return d.toLocaleDateString('en-IN', options);
};

const openMap = (address: Address) => {
  const query = address.addressLine || `${address.street}, ${address.city}, ${address.pincode}`;
  window.open(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`, '_blank');
};

interface Order {
  id: string;
  userId: string;
  status: string;
  createdAt: Date | { toDate(): Date } | string;
  [key: string]: unknown;
}

interface Subscription {
  id: string;
  userId: string;
  isActive: boolean;
  plan: string;
  planType?: string;
  totalMonthlyJars?: number;
  jarsDeliveredThisCycle?: number;
  carryForwardJars?: number;
  startDate: Date | { toDate(): Date } | string;
  endDate?: Date | { toDate(): Date } | string;
  nextDelivery?: Date | { toDate(): Date } | string;
  frequency?: string; // weekly, monthly, etc.
  deliveryDays?: string[];
  deliverySlot?: string;
  planPrice?: number;
  totalDeliveries?: number;
  remainingDeliveries?: number;
  pausedUntil?: Date | { toDate(): Date } | string;
  createdAt: Date | { toDate(): Date } | string;
  updatedAt?: Date | { toDate(): Date } | string;
}

// Styled Components (abbreviated for brevity)
const UsersContainer = styled.div`
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

const SortSelect = styled.select`
  padding: 12px 16px;
  border: 2px solid #e5e7eb;
  border-radius: 10px;
  font-size: 0.9rem;
  background: white;
  cursor: pointer;
  transition: all 0.3s ease;

  &:focus {
    outline: none;
    border-color: #8e2de2;
    box-shadow: 0 0 0 3px rgba(142, 45, 226, 0.1);
  }
`;

const SortContainer = styled.div`
  display: flex;
  align-items: center;
  gap: 10px;
`;

const SortLabel = styled.span`
  font-weight: 600;
  color: #333;
`;

const TitleSection = styled.div`
  display: flex;
  align-items: center;
  gap: 15px;
`;

const UsersLogo = styled(Image)`
  width: 45px;
  height: 45px;
  border-radius: 8px;
  object-fit: cover;
`;

const Title = styled.h1`
  color: #333;
  margin: 0;
  font-size: 2rem;
  font-weight: 700;
  display: flex;
  align-items: center;
  gap: 12px;
`;

const SearchBox = styled.div`
  position: relative;
  display: flex;
  align-items: center;

`;

const SearchInput = styled.input`
  padding: 12px 16px 12px 45px;
  border: 2px solid #e5e7eb;
  border-radius: 10px;
  font-size: 0.9rem;
  width: 400px;
  transition: all 0.3s ease;

  &:focus {
    outline: none;
    border-color: #8e2de2;
    box-shadow: 0 0 0 3px rgba(142, 45, 226, 0.1);
  }
`;

const SearchIcon = styled(FiSearch)`
  position: absolute;
  left: 15px;
  color: #6b7280;
  font-size: 1.1rem;
`;

const Container = styled.div`
  padding: 2rem;
  max-width: 1400px;
  margin: 0 auto;
`;

const UserGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(400px, 1fr));
  gap: 1.5rem;
  margin-bottom: 2rem;
`;

const UserCard = styled(motion.div)`
  background: white;
  padding: 25px;
  border-radius: 16px;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.08);
  border: 1px solid #f0f0f0;
  cursor: pointer;
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
    background: linear-gradient(135deg, #8e2de2 0%, #4a00e0 100%);
  }

  &:hover {
    transform: translateY(-5px);
    box-shadow: 0 8px 30px rgba(0, 0, 0, 0.12);
    border-color: #8e2de2;
  }

  &:active {
    transform: translateY(-2px);
  }
`;

const UserName = styled.h3`
  color: #333;
  margin: 0 0 8px 0;
  font-size: 1.2rem;
  font-weight: 600;
`;

const UserEmail = styled.div`
  color: #666;
  font-size: 0.9rem;
  margin-bottom: 4px;
  display: flex;
  align-items: center;
  gap: 6px;
`;

const UserPhone = styled.div`
  color: #666;
  font-size: 0.9rem;
  display: flex;
  align-items: center;
  gap: 6px;
`;

const CustomerId = styled.div`
  color: #8e2de2;
  font-size: 0.85rem;
  font-weight: 600;
  margin-top: 4px;
`;

const AddressPreview = styled.div`
  color: #666;
  font-size: 0.85rem;
  margin-top: 8px;
  display: flex;
  align-items: center;
  gap: 6px;
`;

const UserStats = styled.div`
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 15px;
  margin-top: 20px;
`;

const ClickHint = styled.div`
  color: #8e2de2;
  font-size: 0.8rem;
  text-align: center;
  margin-top: 15px;
  opacity: 0.7;
  transition: all 0.3s ease;

  ${UserCard}:hover & {
    opacity: 1;
  }
`;

const StatItem = styled.div`
  text-align: center;
`;

const StatValue = styled.div`
  font-size: 1.3rem;
  font-weight: 700;
  color: #333;
  margin-bottom: 4px;
`;

const StatLabel = styled.div`
  color: #666;
  font-size: 0.8rem;
  text-transform: uppercase;
  font-weight: 500;
`;

const SubscriptionBadge = styled.div<{ active: boolean }>`
  padding: 6px 12px;
  border-radius: 20px;
  font-size: 0.75rem;
  font-weight: 600;
  text-transform: uppercase;
  ${props => props.active
    ? `background: #d1fae5; color: #065f46;`
    : `background: #fee2e2; color: #991b1b;`
  }
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

const EmptyState = styled.div`
  text-align: center;
  padding: 60px 20px;
  color: #666;
`;

const UserDetailGrid = styled.div`
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 30px;
  margin-bottom: 30px;

  @media (max-width: 768px) {
    grid-template-columns: 1fr;
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


const AddressType = styled.div`
  background: #8e2de2;
  color: white;
  padding: 4px 8px;
  border-radius: 12px;
  font-size: 0.75rem;
  font-weight: 600;
  text-transform: uppercase;
  display: inline-block;
  margin-bottom: 8px;
`;

const AddressText = styled.div`
  color: #495057;
  font-size: 0.9rem;
  line-height: 1.4;
`;

// Modal Components
const ModalOverlay = styled(motion.div)`
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  backdrop-filter: blur(5px);
  z-index: 1000;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 20px;
`;

const ModalContent = styled(motion.div)`
  background: white;
  border-radius: 20px;
  width: 100%;
  max-width: 900px;
  max-height: 90vh;
  overflow-y: auto;
  position: relative;
`;

const ModalHeader = styled.div`
  padding: 30px 30px 0 30px;
  border-bottom: 1px solid #f0f0f0;
  margin-bottom: 30px;
`;

const ModalTitle = styled.h2`
  color: #333;
  margin: 0 0 20px 0;
  font-size: 1.5rem;
  font-weight: 700;
  display: flex;
  align-items: center;
  gap: 12px;
`;

const CloseButton = styled.button`
  position: absolute;
  top: 20px;
  right: 20px;
  background: none;
  border: none;
  font-size: 1.5rem;
  color: #666;
  cursor: pointer;
  padding: 8px;
  border-radius: 8px;
  transition: all 0.3s ease;

  &:hover {
    background: #f3f4f6;
    color: #333;
  }
`;

const ModalBody = styled.div`
  padding: 0 30px 30px 30px;
`;



const DetailSection = styled.div`
  background: #f9fafb;
  padding: 25px;
  border-radius: 12px;
  border: 1px solid #e5e7eb;
`;

const SectionTitle = styled.h3`
  color: #333;
  margin: 0 0 20px 0;
  font-size: 1.1rem;
  font-weight: 600;
  display: flex;
  align-items: center;
  gap: 8px;
`;

const DetailItem = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 0;
  border-bottom: 1px solid #e5e7eb;

  &:last-child {
    border-bottom: none;
  }
`;

const DetailLabel = styled.div`
  color: #666;
  font-weight: 500;
  display: flex;
  align-items: center;
  gap: 8px;
`;

const DetailValue = styled.div`
  color: #333;
  font-weight: 600;
  text-align: right;
`;

const EditableField = styled.input`
  background: white;
  border: 2px solid #e5e7eb;
  border-radius: 6px;
  padding: 8px 12px;
  font-size: 0.9rem;
  width: 100%;
  transition: all 0.3s ease;

  &:focus {
    outline: none;
    border-color: #8e2de2;
    box-shadow: 0 0 0 3px rgba(142, 45, 226, 0.1);
  }
`;

const ButtonGroup = styled.div`
  display: flex;
  gap: 12px;
  flex-wrap: wrap;
  margin-top: 20px;
`;

const ActionButton = styled(motion.button) <{ variant?: 'primary' | 'secondary' | 'danger' }>`
  padding: 8px 12px;
  border-radius: 6px;
  border: none;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 6px;
  font-weight: 600;
  font-size: 0.85rem;
  transition: all 0.3s ease;

  ${props => {
    switch (props.variant) {
      case 'primary':
        return `
          background: linear-gradient(135deg, #8e2de2 0%, #4a00e0 100%);
          color: white;
          &:hover { transform: translateY(-2px); }
        `;
      default:
        return `
          background: white;
          color: #374151;
          border: 2px solid #e5e7eb;
          &:hover { border-color: #8e2de2; color: #8e2de2; }
        `;
    }
  }}
`;

// New styled components for the enhanced UI
const ModalSubtitle = styled.div`
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-top: 10px;
  color: #64748b;
  font-size: 0.9rem;
  
  > div {
    display: flex;
    align-items: center;
    gap: 8px;
  }
`;

const DeepStatsGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 1rem;
  margin-bottom: 2rem;
`;

const DeepStatCard = styled.div<{ color: string }>`
  background: white;
  border-radius: 12px;
  padding: 1.5rem;
  text-align: center;
  box-shadow: 0 4px 6px rgba(0, 0, 0, 0.05);
  border: 1px solid #e2e8f0;
  transition: all 0.3s ease;
  
  &:hover {
    transform: translateY(-4px);
    box-shadow: 0 10px 15px rgba(0, 0, 0, 0.1);
  }
  
  .icon {
    font-size: 2rem;
    color: ${props => props.color};
    margin-bottom: 0.5rem;
  }
  
  h5 {
    margin: 0.5rem 0 0.25rem 0;
    color: #334155;
    font-size: 0.875rem;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }
  
  .value {
    font-size: 1.875rem;
    font-weight: 700;
    color: ${props => props.color};
    margin: 0.25rem 0;
  }
  
  .sub {
    font-size: 0.75rem;
    color: #64748b;
    margin: 0;
  }
`;

const InfoGrid = styled.div`
  display: flex;
  gap: 2rem;
  
  @media (max-width: 768px) {
    flex-direction: column;
  }
`;

const ActionRow = styled.div`
  display: flex;
  justify-content: flex-end;
  gap: 1rem;
  padding-top: 1.5rem;
  border-top: 1px solid #e2e8f0;
  margin-top: 1.5rem;
`;

const Button = styled.button<{ variant?: 'primary' | 'secondary' | 'danger' }>`
  padding: 0.5rem 1rem;
  border-radius: 6px;
  border: none;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  font-weight: 500;
  transition: all 0.3s ease;
  
  ${props => {
    switch (props.variant) {
      case 'primary':
        return `
          background: linear-gradient(135deg, #8e2de2 0%, #4a00e0 100%);
          color: white;
          &:hover { background: linear-gradient(135deg, #7e1dd2 0%, #3a00d0 100%); }
        `;
      case 'secondary':
        return `
          background: white;
          color: #374151;
          border: 1px solid #d1d5db;
          &:hover { background: #f3f4f6; }
        `;
      case 'danger':
        return `
          background: linear-gradient(135deg, #dc2626 0%, #b91c1c 100%);
          color: white;
          &:hover { background: linear-gradient(135deg, #b91c1c 0%, #991b1b 100%); }
        `;
      default:
        return `
          background: white;
          color: #374151;
          border: 1px solid #d1d5db;
          &:hover { background: #f3f4f6; }
        `;
    }
  }}
`;

// Additional missing styled components
const TitleGroup = styled.div`
  display: flex;
  align-items: center;
  gap: 15px;
`;

const Logo = styled(Image)`
  width: 48px;
  height: 48px;
  border-radius: 8px;
  object-fit: cover;
`;

const PageTitle = styled.h1`
  color: #333;
  margin: 0;
  font-size: 1.75rem;
  font-weight: 700;
  display: flex;
  align-items: center;
  gap: 12px;
  
  span {
    color: #8e2de2;
  }
`;

const Controls = styled.div`
  display: flex;
  align-items: center;
  gap: 15px;
  flex-wrap: wrap;
`;

const SearchWrapper = styled.div`
  position: relative;
  display: flex;
  align-items: center;
`;

const SelectInput = styled.select`
  padding: 10px 14px;
  border: 2px solid #e5e7eb;
  border-radius: 10px;
  font-size: 0.9rem;
  background: white;
  cursor: pointer;
  transition: all 0.3s ease;
  
  &:focus {
    outline: none;
    border-color: #8e2de2;
    box-shadow: 0 0 0 3px rgba(142, 45, 226, 0.1);
  }
`;

// Card components for the new UI
const Card = styled(motion.div)`
  background: white;
  border-radius: 16px;
  box-shadow: 0 4px 6px rgba(0, 0, 0, 0.05);
  border: 1px solid #e2e8f0;
  cursor: pointer;
  transition: all 0.3s ease;
  overflow: hidden;
  
  &:hover {
    transform: translateY(-4px);
    box-shadow: 0 10px 15px rgba(0, 0, 0, 0.1);
    border-color: #8e2de2;
  }
`;

const CardHeader = styled.div`
  padding: 1.5rem;
  border-bottom: 1px solid #e2e8f0;
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
`;

const UserIdentity = styled.div`
  h3 {
    margin: 0 0 0.25rem 0;
    color: #1e293b;
    font-size: 1.125rem;
    font-weight: 600;
  }
  
  p {
    margin: 0.25rem 0;
    color: #64748b;
    font-size: 0.875rem;
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }
`;

const StatusBadge = styled.div<{ $active: boolean }>`
  padding: 0.25rem 0.75rem;
  border-radius: 9999px;
  font-size: 0.75rem;
  font-weight: 600;
  text-transform: uppercase;
  ${props => props.$active
    ? `background: #d1fae5; color: #065f46;`
    : `background: #fee2e2; color: #991b1b;`
  }
`;

const KeyStatsRow = styled.div`
  display: flex;
  justify-content: space-between;
  padding: 1rem 1.5rem;
  gap: 1rem;
  
  @media (max-width: 768px) {
    flex-direction: column;
    gap: 0.5rem;
  }
`;

const StatPill = styled.div<{ color: string }>`
  background: white;
  border: 1px solid #e2e8f0;
  border-radius: 12px;
  padding: 0.75rem;
  text-align: center;
  flex: 1;
  transition: all 0.3s ease;
  
  &:hover {
    transform: translateY(-2px);
    box-shadow: 0 4px 6px rgba(0, 0, 0, 0.05);
  }
  
  .label {
    font-size: 0.75rem;
    color: #64748b;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    margin-bottom: 0.25rem;
  }
  
  .value {
    font-size: 1.25rem;
    font-weight: 700;
    color: ${props => props.color};
  }
`;

const CardFooter = styled.div`
  padding: 1rem 1.5rem;
  border-top: 1px solid #e2e8f0;
  display: flex;
  justify-content: space-between;
  align-items: center;
`;

// --- Main Component ---

export default function UsersPage() {
  const { currentUser, userData } = useAuth();
  const [users, setUsers] = useState<User[]>([]);
  const [addresses, setAddresses] = useState<Address[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
  const [filteredUsers, setFilteredUsers] = useState<User[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [sortOption, setSortOption] = useState('newest'); // Add sort option state
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [selectedReferralStats, setSelectedReferralStats] = useState({ pending: 0, completed: 0 });
  const [editMode, setEditMode] = useState(false);
  const [editedUser, setEditedUser] = useState<User | null>(null);
  const [editedSubscription, setEditedSubscription] = useState<Subscription | null>(null);
  const [subscriptionEditMode, setSubscriptionEditMode] = useState(false);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);

  // formatDate is now defined at the top of the file for global use in this component

  useEffect(() => {
    setLoading(true);

    // Subscribe to users collection with proper error handling
    const unsubscribeUsers = subscribeToCollection('users', (snapshot) => {
      console.log('Users snapshot received:', snapshot.docs.length, 'documents');
      try {
        const usersData = snapshot.docs.map((doc) => {
          const data = doc.data();
          console.log('User document:', doc.id, data);

          // Check if user has legacy address structure
          let legacyAddresses: Address[] = [];
          if (data.address) {
            legacyAddresses = [{
              id: `legacy-${doc.id}`,
              userId: doc.id,
              type: 'home',
              street: data.address.street || '',
              city: data.address.city || '',
              state: data.address.state || '',
              pincode: data.address.pincode || '',
              floor: data.address.floor || '',
              apartment: data.address.apartment || '',
              isDefault: true,
              createdAt: new Date()
            }];
            console.log('Found legacy address for user:', doc.id, legacyAddresses);
          }

          return {
            id: doc.id,
            customerId: data.customerId || generateCustomerId(),
            name: data.name || `${data.firstName || ''} ${data.lastName || ''}`.trim() || 'Unknown User',
            firstName: data.firstName || '', // Keep for legacy support
            lastName: data.lastName || '', // Keep for legacy support
            email: data.email || '',
            phoneNumber: data.phoneNumber || data.phone || '',
            createdAt: data.createdAt || new Date(),
            totalCoins: data.totalCoins || 0,
            totalShares: data.totalShares || 0,
            wallet_balance: data.wallet_balance || data.walletBalance || 0, // Use wallet_balance for user app compatibility
            jars_occupied: data.jars_occupied || data.holdJars || data.occupiedJars || 0, // Use jars_occupied for user app compatibility
            addresses: legacyAddresses, // Store legacy addresses temporarily
            totalRevenue: 0, // Will be calculated later
            totalCans: 0, // Will be calculated later
            orders: [], // Will be populated later

          };
        });
        console.log('Processed users:', usersData);
        setUsers(usersData as User[]);
      } catch (error) {
        console.error('Error processing users:', error);
        setUsers([]);
      }
    }, [], (error) => {
      console.error('Error subscribing to users:', error);
      setUsers([]);
    });

    // Subscribe to addresses collection with better error handling
    const unsubscribeAddresses = subscribeToCollection('addresses', (snapshot) => {
      console.log('Addresses snapshot received:', snapshot.docs.length, 'documents');
      try {
        const addressesData = snapshot.docs.map((doc) => {
          const data = doc.data();
          console.log('Address document:', doc.id, data);

          // Handle the actual Firebase structure with address_line
          const address = {
            id: doc.id,
            userId: data.userId || '',
            type: data.address_type || data.type || 'Home',
            addressLine: data.address_line || '', // Full address as single string
            street: data.address_line || data.street || '', // Use address_line as street for compatibility
            city: data.city || 'Kolkata', // Default city based on your data
            state: data.state || 'West Bengal', // Default state
            pincode: data.pincode || data.zipCode || '',
            floor: data.floor || '',
            apartment: data.apartment || '',
            landmark: data.landmark || '',
            isDefault: data.isDefault || false,
            createdAt: data.createdAt || new Date()
          };

          console.log('Processed address:', address);
          return address;
        });
        console.log('Total processed addresses:', addressesData.length);
        console.log('Addresses by userId:', addressesData.reduce((acc, addr) => {
          if (!acc[addr.userId]) acc[addr.userId] = [];
          acc[addr.userId].push(addr);
          return acc;
        }, {}));
        setAddresses(addressesData);
      } catch (error) {
        console.error('Error processing addresses:', error);
        setAddresses([]);
      }
    }, [], (error) => {
      console.error('Error subscribing to addresses:', error);
      setAddresses([]);
    });

    // Subscribe to orders collection with error handling
    const unsubscribeOrders = subscribeToCollection('orders', (snapshot) => {
      try {
        const ordersData = snapshot.docs.map((doc) => ({
          id: doc.id,
          userId: doc.data().userId || '',
          status: doc.data().status || 'pending',
          ...doc.data(),
          createdAt: doc.data().createdAt || new Date()
        }));
        setOrders(ordersData as Order[]);
      } catch (error) {
        console.error('Error processing orders:', error);
        setOrders([]);
      }
    }, [], (error) => {
      console.error('Error subscribing to orders:', error);
      setOrders([]);
    });

    // Subscribe to subscriptions collection with error handling
    const unsubscribeSubscriptions = subscribeToCollection('subscriptions', (snapshot) => {
      console.log('Subscriptions snapshot received:', snapshot.docs.length, 'documents');
      try {
        const subscriptionsData = snapshot.docs.map((doc) => {
          const data = doc.data();
          console.log('Subscription document:', doc.id, data);

          const subscription: Subscription = {
            id: doc.id,
            userId: data.userId || data.user_id || data.uid || '', // Support multiple field names
            isActive: Boolean(data.isActive), // Ensure boolean conversion
            plan: data.plan || (data.quantity ? `${data.quantity} Jars` : 'Basic'),
            planType: data.planType || 'interval',
            totalMonthlyJars: data.totalMonthlyJars,
            jarsDeliveredThisCycle: data.jarsDeliveredThisCycle,
            carryForwardJars: data.carryForwardJars,
            startDate: data.createdAt || data.startDate || new Date(),
            endDate: data.endDate,
            nextDelivery: data.nextDelivery || data.nextDeliveryDate,
            frequency: data.frequency || data.deliveryFrequency || 'weekly',
            deliveryDays: data.deliveryDays || [],
            deliverySlot: data.deliverySlot || data.timeSlot,
            planPrice: data.pricePerDelivery || data.monthlyPrice || 0,
            totalDeliveries: data.totalDeliveries || 0,
            remainingDeliveries: data.remainingDeliveries || 0,
            pausedUntil: data.pausedUntil,
            createdAt: data.createdAt || new Date(),
            updatedAt: data.updatedAt
          };

          console.log(`Subscription ${doc.id} for user ${data.userId || data.user_id || data.uid}:`, {
            rawIsActive: data.isActive,
            processedIsActive: subscription.isActive,
            dataType: typeof data.isActive,
            plan: subscription.plan,
            userIdField: data.userId ? 'userId' : data.user_id ? 'user_id' : data.uid ? 'uid' : 'MISSING'
          });
          return subscription;
        });
        console.log('Total processed subscriptions:', subscriptionsData.length);
        setSubscriptions(subscriptionsData);
      } catch (error) {
        console.error('Error processing subscriptions:', error);
        setSubscriptions([]);
      }
    }, [], (error) => {
      console.error('Error subscribing to subscriptions:', error);
      setSubscriptions([]);
    });

    const timer = setTimeout(() => {
      setLoading(false);
      // Debug: Log final state after loading
      console.log('=== LOADING COMPLETE - FINAL STATE ==');
      console.log('Total users loaded:', users.length);
      console.log('Total addresses loaded:', addresses.length);
      console.log('Users with addresses:', users.map(u => ({
        id: u.id,
        name: `${u.firstName} ${u.lastName}`,
        addressCount: u.addresses?.length || 0
      })));
    }, 2000);

    return () => {
      unsubscribeUsers();
      unsubscribeAddresses();
      unsubscribeOrders();
      unsubscribeSubscriptions();
      clearTimeout(timer);
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Combine users with their addresses and calculate stats
  useEffect(() => {
    console.log('Combining users with addresses...');
    console.log('Users count:', users.length);
    console.log('Addresses count:', addresses.length);

    const usersWithAddresses = users.map(user => {
      // First check for addresses from the addresses collection
      const userAddresses = addresses.filter(addr => {
        console.log(`Checking address ${addr.id} for user ${user.id}: addr.userId=${addr.userId}`);
        return addr.userId === user.id;
      });

      // If no addresses found in collection, use legacy addresses from user document
      let finalAddresses = userAddresses;
      if (userAddresses.length === 0 && user.addresses && user.addresses.length > 0) {
        console.log(`Using legacy addresses for user ${user.id}:`, user.addresses);
        finalAddresses = user.addresses;
      }

      console.log(`User ${user.id} (${user.firstName}) has ${finalAddresses.length} addresses:`, finalAddresses);

      const userOrders = orders.filter(order => order.userId === user.id);
      const completedOrders = userOrders.filter(order => order.status === 'completed');
      const cancelledOrders = userOrders.filter(order => order.status === 'cancelled');

      // Calculate order dates
      const orderDates = userOrders.map(order => {
        if (order.createdAt instanceof Date) return order.createdAt;
        if (typeof order.createdAt === 'object' && 'toDate' in order.createdAt) return order.createdAt.toDate();
        if (typeof order.createdAt === 'string') return new Date(order.createdAt);
        return new Date(0); // fallback to epoch if invalid
      }).filter(date => !isNaN(date.getTime())); // filter out invalid dates

      const firstOrderDate = orderDates.length > 0 ? new Date(Math.min(...orderDates.map(date => date.getTime()))) : null;
      const lastOrderDate = orderDates.length > 0 ? new Date(Math.max(...orderDates.map(date => date.getTime()))) : null;

      const userSubscription = subscriptions.find(sub => {
        console.log(`Comparing subscription userId ${sub.userId} with user id ${user.id}, customerId ${user.customerId}, email ${user.email}`);
        // Try multiple matching strategies
        return sub.userId === user.id ||
          sub.userId === user.customerId ||
          sub.userId === user.email;
      });

      console.log(`User ${user.id} (${user.name}):`, {
        hasSubscription: !!userSubscription,
        subscriptionId: userSubscription?.id,
        isActive: userSubscription?.isActive,
        isActiveType: typeof userSubscription?.isActive,
        isActiveStrict: userSubscription?.isActive === true,
        allSubscriptionUserIds: subscriptions.map(s => s.userId),
        subscriptionData: userSubscription
      });

      return {
        ...user,
        addresses: finalAddresses,
        orders: userOrders,
        totalRevenue: completedOrders.length * 37,
        totalCans: completedOrders.length,
        // Additional calculated fields
        firstOrderDate,
        lastOrderDate,
        totalCompletedOrders: completedOrders.length,
        totalCancelledOrders: cancelledOrders.length,
        subscription: userSubscription || undefined,
        referralCoins: user.totalCoins || 0,
        depositMoney: user.wallet_balance || 0,
      };
    });

    // Helper function to convert various date formats to Date object
    const parseDate = (date: Date | { toDate(): Date } | string | undefined): Date => {
      if (!date) return new Date(0);
      if (date instanceof Date) return date;
      if (typeof date === 'object' && 'toDate' in date && typeof date.toDate === 'function') {
        return date.toDate();
      }
      if (typeof date === 'string') {
        const parsed = new Date(date);
        return isNaN(parsed.getTime()) ? new Date(0) : parsed;
      }
      return new Date(0);
    };

    // Apply default sorting (newest) on initial combination
    usersWithAddresses.sort((a, b) => {
      const dateA = parseDate(a.createdAt);
      const dateB = parseDate(b.createdAt);
      return dateB.getTime() - dateA.getTime();
    });

    console.log('Final users with addresses:', usersWithAddresses);
    setFilteredUsers(usersWithAddresses);
  }, [users, addresses, orders, subscriptions]);

  // Filter users based on search term
  useEffect(() => {
    if (!searchTerm) {
      return;
    } else {
      const filtered = filteredUsers.filter(user => {
        const basicSearch =
          user.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
          user.firstName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
          user.lastName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
          user.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
          user.phoneNumber?.includes(searchTerm) ||
          user.customerId?.toLowerCase().includes(searchTerm.toLowerCase());

        const addressSearch = user.addresses.some(addr =>
          addr.addressLine?.toLowerCase().includes(searchTerm.toLowerCase()) ||
          addr.street?.toLowerCase().includes(searchTerm.toLowerCase()) ||
          addr.city?.toLowerCase().includes(searchTerm.toLowerCase()) ||
          addr.pincode?.includes(searchTerm) ||
          addr.type?.toLowerCase().includes(searchTerm.toLowerCase())
        );

        return basicSearch || addressSearch;
      });
      setFilteredUsers(filtered);
    }
  }, [searchTerm, filteredUsers]);

  // Add sorting effect
  useEffect(() => {
    let sortedUsers = [...filteredUsers];

    // Helper function to convert various date formats to Date object
    const parseDate = (date: Date | { toDate(): Date } | string | undefined): Date => {
      if (!date) return new Date(0);
      if (date instanceof Date) return date;
      if (typeof date === 'object' && 'toDate' in date && typeof date.toDate === 'function') {
        return date.toDate();
      }
      if (typeof date === 'string') {
        const parsed = new Date(date);
        return isNaN(parsed.getTime()) ? new Date(0) : parsed;
      }
      return new Date(0);
    };

    switch (sortOption) {
      case 'customerId':
        sortedUsers.sort((a, b) => a.customerId.localeCompare(b.customerId));
        break;
      case 'name':
        sortedUsers.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
        break;
      case 'newest':
        sortedUsers.sort((a, b) => {
          const dateA = parseDate(a.createdAt);
          const dateB = parseDate(b.createdAt);
          return dateB.getTime() - dateA.getTime();
        });
        break;
      case 'oldest':
        sortedUsers.sort((a, b) => {
          const dateA = parseDate(a.createdAt);
          const dateB = parseDate(b.createdAt);
          return dateA.getTime() - dateB.getTime();
        });
        break;
      case 'orders':
        sortedUsers.sort((a, b) => b.orders.length - a.orders.length);
        break;
      case 'revenue':
        sortedUsers.sort((a, b) => b.totalRevenue - a.totalRevenue);
        break;
      default:
        break;
    }

    setFilteredUsers(sortedUsers);
  }, [sortOption]);

  const handleUserClick = (user: User) => {
    setSelectedUser(user);
    // Ensure all fields are properly initialized in editedUser
    setEditedUser({
      ...user,
      referralCoins: user.referralCoins ?? user.totalCoins,
      depositMoney: user.depositMoney ?? user.wallet_balance,
    });
    setEditMode(false);
    setSubscriptionEditMode(false);
    setEditedSubscription(user.subscription || null);
  };

  useEffect(() => {
    const fetchReferralStats = async () => {
      if (!selectedUser?.customerId) return;
      try {
        const { collection, getDocs, query, where } = await import('firebase/firestore');
        const { db } = await import('@/lib/firebase');
        const q = query(
          collection(db, 'users'),
          where('referredBy', '==', selectedUser.customerId)
        );
        const snapshot = await getDocs(q);
        let pending = 0;
        let completed = 0;
        snapshot.forEach(doc => {
          if (doc.data().isReferralRewarded) {
            completed++;
          } else {
            pending++;
          }
        });
        setSelectedReferralStats({ completed, pending });
      } catch (error) {
        console.error('Error fetching referral stats:', error);
      }
    };
    fetchReferralStats();
  }, [selectedUser?.customerId]);

  const handleSave = async () => {
    if (!editedUser) return;

    setSaving(true);
    try {
      const updateData = {
        customerId: editedUser.customerId,
        name: editedUser.name,
        email: editedUser.email,
        phoneNumber: editedUser.phoneNumber,
        totalCoins: editedUser.totalCoins,
        totalShares: editedUser.totalShares,
        wallet_balance: editedUser.wallet_balance, // Use wallet_balance for user app compatibility
        jars_occupied: editedUser.jars_occupied, // Use jars_occupied for user app compatibility
        referralCoins: editedUser.referralCoins,
        depositMoney: editedUser.depositMoney,
        role: editedUser.role,
        updatedAt: new Date()
      };

      await updateDocument('users', editedUser.id, updateData);

      if (selectedUser) {
        if (editedUser.wallet_balance !== selectedUser.wallet_balance) {
          const change = editedUser.wallet_balance - selectedUser.wallet_balance;
          await logActivity({
            action: 'WALLET_UPDATED',
            actor: 'ADMIN',
            actorId: currentUser?.uid || 'unknown',
            actorName: currentUser?.email || 'Admin',
            targetId: editedUser.id,
            details: `Admin ${change > 0 ? 'added' : 'deducted'} ₹${Math.abs(change)} ${change > 0 ? 'to' : 'from'} wallet. New balance: ₹${editedUser.wallet_balance}`
          });
        }
        if (editedUser.jars_occupied !== selectedUser.jars_occupied) {
          await logActivity({
            action: 'JAR_UPDATED',
            actor: 'ADMIN',
            actorId: currentUser?.uid || 'unknown',
            actorName: currentUser?.email || 'Admin',
            targetId: editedUser.id,
            details: `Admin updated hold jars from ${selectedUser.jars_occupied} to ${editedUser.jars_occupied}`
          });
        }
        if (editedUser.role !== selectedUser.role) {
          await logActivity({
            action: 'ROLE_UPDATED',
            actor: 'ADMIN',
            actorId: currentUser?.uid || 'unknown',
            actorName: currentUser?.email || 'Admin',
            targetId: editedUser.id,
            details: `Admin changed role from ${selectedUser.role || 'user'} to ${editedUser.role || 'user'}`
          });
        }
      }

      setSelectedUser(editedUser);
      setEditMode(false);

      // Show success message with real-time update info
      const message = selectedUser && (editedUser.jars_occupied !== selectedUser.jars_occupied || editedUser.wallet_balance !== selectedUser.wallet_balance)
        ? 'User details updated successfully! Hold Jars and Wallet Balance changes will reflect in the user app immediately.'
        : 'User details updated successfully!';
      alert(message);
    } catch (error) {
      console.error('Error updating user:', error);
      alert('Error updating user details. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!selectedUser) return;

    const confirmDelete = window.confirm(
      `Are you sure you want to delete user ${selectedUser.name || `${selectedUser.firstName} ${selectedUser.lastName}`}? This action cannot be undone.`
    );

    if (!confirmDelete) return;

    setSaving(true);
    try {
      await deleteDocument('users', selectedUser.id);
      
      await logActivity({
        action: 'USER_DELETED',
        actor: 'ADMIN',
        actorId: currentUser?.uid || 'unknown',
        actorName: currentUser?.email || 'Admin',
        targetId: selectedUser.id,
        details: `Admin deleted user ${selectedUser.name || `${selectedUser.firstName} ${selectedUser.lastName}`.trim()}`
      });

      setSelectedUser(null);
      alert('User deleted successfully!');
    } catch (error) {
      console.error('Error deleting user:', error);
      alert('Error deleting user. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const handleCall = (phoneNumber: string) => {
    window.open(`tel:${phoneNumber}`, '_self');
  };

  const handleNavigation = (address: Address) => {
    if (address && (address.addressLine || address.street)) {
      const fullAddress = address.addressLine || `${address.street}, ${address.city}, ${address.state}`;
      const encodedAddress = encodeURIComponent(fullAddress);
      window.open(`https://www.google.com/maps/search/?api=1&query=${encodedAddress}`, '_blank');
    }
  };

  // Subscription Management Functions
  const handleSubscriptionSave = async () => {
    if (!editedSubscription || !selectedUser) return;

    setSaving(true);
    try {
      if (editedSubscription.id) {
        // Update existing subscription
        const updateData = {
          isActive: editedSubscription.isActive,
          plan: editedSubscription.plan,
          frequency: editedSubscription.frequency,
          planPrice: editedSubscription.planPrice,
          nextDelivery: editedSubscription.nextDelivery,
          deliverySlot: editedSubscription.deliverySlot,
          totalDeliveries: editedSubscription.totalDeliveries,
          remainingDeliveries: editedSubscription.remainingDeliveries,
          pausedUntil: editedSubscription.pausedUntil,
          updatedAt: new Date()
        };
        await updateDocument('subscriptions', editedSubscription.id, updateData);
      } else {
        // Create new subscription
        const newSubscription = {
          userId: selectedUser.id,
          isActive: editedSubscription.isActive,
          plan: editedSubscription.plan,
          frequency: editedSubscription.frequency,
          planPrice: editedSubscription.planPrice,
          nextDelivery: editedSubscription.nextDelivery,
          deliverySlot: editedSubscription.deliverySlot,
          totalDeliveries: editedSubscription.totalDeliveries,
          remainingDeliveries: editedSubscription.remainingDeliveries,
          startDate: new Date(),
          createdAt: new Date()
        };
        await addDocument('subscriptions', newSubscription);
      }

      setSubscriptionEditMode(false);
      alert('Subscription updated successfully!');
    } catch (error) {
      console.error('Error updating subscription:', error);
      alert('Error updating subscription. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const handleSubscriptionPause = async () => {
    if (!selectedUser?.subscription) return;

    const pauseUntil = prompt('Pause subscription until (YYYY-MM-DD):');
    if (!pauseUntil) return;

    setSaving(true);
    try {
      await updateDocument('subscriptions', selectedUser.subscription.id, {
        isActive: false,
        pausedUntil: new Date(pauseUntil),
        updatedAt: new Date()
      });
      alert('Subscription paused successfully!');
    } catch (error) {
      console.error('Error pausing subscription:', error);
      alert('Error pausing subscription. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const handleSubscriptionDelete = async () => {
    if (!selectedUser?.subscription) return;

    const confirmDelete = window.confirm(
      `Are you sure you want to delete the subscription for ${selectedUser.name}? This action cannot be undone.`
    );

    if (!confirmDelete) return;

    setSaving(true);
    try {
      await deleteDocument('subscriptions', selectedUser.subscription.id);
      alert('Subscription deleted successfully!');
    } catch (error) {
      console.error('Error deleting subscription:', error);
      alert('Error deleting subscription. Please try again.');
    } finally {
      setSaving(false);
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
    <Container>
      <Header>
        <TitleGroup>
          <Logo
            src="/logo.jpeg"
            alt="Hydrant Logo"
            width={48}
            height={48}
          />
          <PageTitle>
            User <span>Management</span>
          </PageTitle>
        </TitleGroup>
        <Controls>
          <SearchWrapper>
            <SearchInput
              type="text"
              placeholder="Search by name, email, phone, customer ID, or address..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
            <FiSearch style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
          </SearchWrapper>
          <SelectInput value={sortOption} onChange={(e) => setSortOption(e.target.value)}>
            <option value="newest">Newest Users</option>
            <option value="oldest">Oldest Users</option>
            <option value="customerId">Customer ID</option>
            <option value="name">Name</option>
            <option value="orders">Most Orders</option>
            <option value="revenue">Highest Revenue</option>
          </SelectInput>
        </Controls>
      </Header>

      {/* Debug Panel - Remove in production */}
      <div style={{
        background: '#f8f9fa',
        border: '1px solid #dee2e6',
        padding: '12px',
        borderRadius: '8px',
        marginBottom: '20px',
        fontSize: '13px',
        fontFamily: 'monospace',
        color: '#495057'
      }}>
        <strong>🔍 Debug Info:</strong><br />
        Users loaded: {users.length} |
        Addresses loaded: {addresses.length} |
        Subscriptions loaded: {subscriptions.length} |
        Combined users: {filteredUsers.length} |
        Users with addresses: {filteredUsers.filter(u => u.addresses && u.addresses.length > 0).length} |
        Active subscriptions: {filteredUsers.filter(u => u.subscription?.isActive).length}<br />
        <details style={{ marginTop: '8px' }}>
          <summary style={{ cursor: 'pointer', color: '#007bff' }}>View address details</summary>
          <div style={{ marginTop: '8px', maxHeight: '200px', overflow: 'auto' }}>
            {addresses.slice(0, 5).map(addr => (
              <div key={addr.id} style={{ margin: '4px 0', padding: '4px', background: '#fff', borderRadius: '4px' }}>
                <strong>ID:</strong> {addr.id} | <strong>UserID:</strong> {addr.userId} | <strong>Type:</strong> {addr.type}<br />
                <strong>Address:</strong> {addr.addressLine || `${addr.street}, ${addr.city}`} | <strong>Default:</strong> {addr.isDefault ? 'Yes' : 'No'}
              </div>
            ))}
            {addresses.length > 5 && <div style={{ fontStyle: 'italic' }}>...and {addresses.length - 5} more addresses</div>}
          </div>
        </details>
        <details style={{ marginTop: '8px' }}>
          <summary style={{ cursor: 'pointer', color: '#28a745' }}>View subscription details</summary>
          <div style={{ marginTop: '8px', maxHeight: '200px', overflow: 'auto' }}>
            {subscriptions.slice(0, 5).map(sub => (
              <div key={sub.id} style={{
                margin: '4px 0',
                padding: '4px',
                background: sub.isActive ? '#d4edda' : '#f8d7da',
                borderRadius: '4px',
                border: `1px solid ${sub.isActive ? '#28a745' : '#dc3545'}`
              }}>
                <strong>ID:</strong> {sub.id} | <strong>UserID:</strong> {sub.userId} |
                <strong style={{ color: sub.isActive ? '#28a745' : '#dc3545' }}>Active:</strong> {sub.isActive ? 'YES' : 'NO'}<br />
                <strong>Plan:</strong> {sub.plan} | <strong>Frequency:</strong> {sub.frequency}
              </div>
            ))}
            {subscriptions.length > 5 && <div style={{ fontStyle: 'italic' }}>...and {subscriptions.length - 5} more subscriptions</div>}
          </div>
        </details>
      </div>

      <InfoBox>
        <FiInfo />
        <div>
          <strong>Multi-Collection User Management:</strong> Data fetched from separate Firebase collections.
          <br />• User details from &apos;users&apos; collection (name, phone, email, wallet, hold jars)
          <br />• Address data from &apos;addresses&apos; collection (multiple addresses with types)
          <br />• Subscription data from &apos;subscriptions&apos; collection (plan, frequency, delivery details)
          <br />• <strong>Hold Jars:</strong> Track user&apos;s current jar inventory - updates reflect in user app
          <br />• Search across all user information and saved addresses
        </div>
      </InfoBox>

      <UserGrid>
        {filteredUsers.length > 0 ? (
          filteredUsers.map((user, index) => {
            const defaultAddress = user.addresses.find(addr => addr.isDefault) || user.addresses[0];
            return (
              <Card
                key={user.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.1 }}
                onClick={() => handleUserClick(user)}
              >
                <CardHeader>
                  <UserIdentity>
                    <h3>{user.name || `${user.firstName} ${user.lastName}`.trim()}</h3>
                    <p><FiMail size={14} /> {user.email}</p>
                    <p><FiPhone size={14} /> {user.phoneNumber}</p>
                    <p style={{ color: '#6366f1', fontWeight: '600' }}>ID: {user.customerId}</p>
                  </UserIdentity>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '8px' }}>
                    <StatusBadge $active={user.subscription?.isActive === true}>
                      {user.subscription?.isActive === true ? 'Active' : 'Inactive'}
                    </StatusBadge>
                  </div>

                </CardHeader>

                <KeyStatsRow>
                  <StatPill color="#8e2de2">
                    <span className="label">Wallet</span>
                    <span className="value">₹{user.wallet_balance || 0}</span>
                  </StatPill>
                  <StatPill color="#10b981">
                    <span className="label">Hold Jars</span>
                    <span className="value">{user.jars_occupied || 0}</span>
                  </StatPill>
                  <StatPill color="#3b82f6">
                    <span className="label">Orders</span>
                    <span className="value">{user.orders.length}</span>
                  </StatPill>
                  <StatPill color="#f59e0b">
                    <span className="label">Revenue</span>
                    <span className="value">₹{user.totalRevenue}</span>
                  </StatPill>
                </KeyStatsRow>

                {defaultAddress && (
                  <CardFooter>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <FiMapPin size={14} style={{ color: '#64748b' }} />
                      <span style={{ fontSize: '0.875rem', color: '#64748b' }}>
                        {defaultAddress.type}: {defaultAddress.addressLine || `${defaultAddress.city}, ${defaultAddress.pincode}`}
                        {defaultAddress.isDefault && (
                          <span style={{
                            background: '#e0e7ff',
                            color: '#4f46e5',
                            fontSize: '0.7rem',
                            padding: '2px 6px',
                            borderRadius: '9999px',
                            fontWeight: '600',
                            marginLeft: '0.5rem'
                          }}>
                            DEFAULT
                          </span>
                        )}
                      </span>
                    </div>
                    <FiArrowRight size={16} style={{ color: '#94a3b8' }} />
                  </CardFooter>
                )}

                {user.addresses.length > 0 && (
                  <div style={{ marginTop: '20px' }}>
                    <h4 style={{ margin: '0 0 10px 0', color: '#666', fontSize: '0.9rem' }}>
                      Saved Addresses ({user.addresses.length})
                    </h4>
                    {user.addresses.slice(0, 2).map((address) => (
                      <div key={address.id} style={{ background: '#f8f9fa', border: '1px solid #e9ecef', borderRadius: '8px', padding: '15px', marginBottom: '10px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
                          <div style={{ background: '#8e2de2', color: 'white', padding: '4px 8px', borderRadius: '12px', fontSize: '0.75rem', fontWeight: '600', textTransform: 'uppercase', display: 'inline-block', marginBottom: '8px' }}>
                            {address.type}
                          </div>
                          {address.isDefault && (
                            <span style={{
                              background: '#28a745',
                              color: 'white',
                              fontSize: '0.7rem',
                              padding: '1px 4px',
                              borderRadius: '3px',
                              fontWeight: '600',
                              marginLeft: '6px'
                            }}>
                              DEFAULT
                            </span>
                          )}
                        </div>
                        <div style={{ color: '#495057', fontSize: '0.9rem', lineHeight: '1.4' }}>
                          {address.addressLine || `${address.street}, ${address.city}, ${address.state} - ${address.pincode}`}
                        </div>
                      </div>
                    ))}
                    {user.addresses.length > 2 && (
                      <div style={{ color: '#666', fontSize: '0.85rem', fontStyle: 'italic' }}>
                        +{user.addresses.length - 2} more addresses
                      </div>
                    )}
                  </div>
                )}

                <div style={{ color: '#8e2de2', fontSize: '0.8rem', textAlign: 'center', marginTop: '15px', opacity: '0.7', transition: 'all 0.3s ease' }}>
                  👆 Click to view details &amp; manage user
                </div>
              </Card>
            );
          })
        ) : (
          <EmptyState>
            <FiUsers size={48} style={{ marginBottom: '16px' }} />
            <h3>No users found</h3>
            <p>No users match your search criteria</p>
          </EmptyState>
        )}
      </UserGrid>

      {/* User Detail Modal */}
      <AnimatePresence>
        {selectedUser && (
          <ModalOverlay
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setSelectedUser(null)}
          >
            <ModalContent
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
            >
              <CloseButton onClick={() => setSelectedUser(null)}>
                <FiX />
              </CloseButton>

              <ModalHeader>
                <ModalTitle>
                  {selectedUser.name || `${selectedUser.firstName} ${selectedUser.lastName}`.trim()}
                </ModalTitle>
                <ModalSubtitle>
                  <div><FiMail /> {selectedUser.email}</div>
                  <div><FiPhone /> {selectedUser.phoneNumber}</div>
                  <div><FiUsers /> {selectedUser.customerId}</div>
                </ModalSubtitle>
              </ModalHeader>

              <ModalBody>
                <DeepStatsGrid>
                  <DeepStatCard color="#8e2de2">
                    <FiDollarSign className="icon" />
                    <h5>Total Revenue</h5>
                    <div className="value">₹{selectedUser.totalRevenue}</div>
                    <div className="sub">Total earnings from completed orders</div>
                  </DeepStatCard>

                  <DeepStatCard color="#10b981">
                    <FiPackage className="icon" />
                    <h5>Hold Jars</h5>
                    <div className="value">{selectedUser.jars_occupied || 0}</div>
                    <div className="sub">Currently held by user</div>
                  </DeepStatCard>

                  <DeepStatCard color="#3b82f6">
                    <FiActivity className="icon" />
                    <h5>Total Orders</h5>
                    <div className="value">{selectedUser.orders.length}</div>
                    <div className="sub">All orders placed</div>
                  </DeepStatCard>

                  <DeepStatCard color="#f59e0b">
                    <FiClock className="icon" />
                    <h5>Wallet Balance</h5>
                    <div className="value">₹{selectedUser.wallet_balance || 0}</div>
                    <div className="sub">Available for orders</div>
                  </DeepStatCard>
                </DeepStatsGrid>

                <UserDetailGrid>
                  <InfoGrid>
                    <div style={{ flex: 2 }}>
                      <SectionTitle>
                        <FiUsers /> Personal Information
                      </SectionTitle>

                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1.5rem' }}>
                        <div>
                          <div style={{ fontSize: '0.75rem', fontWeight: '600', color: '#64748b', textTransform: 'uppercase', marginBottom: '0.5rem' }}>Customer ID</div>
                          <div style={{ fontSize: '1.125rem', fontWeight: '600', color: '#1e293b', fontFamily: 'monospace' }}>
                            {selectedUser.customerId}
                          </div>
                        </div>

                        <div>
                          <div style={{ fontSize: '0.75rem', fontWeight: '600', color: '#64748b', textTransform: 'uppercase', marginBottom: '0.5rem' }}>Join Date</div>
                          <div style={{ fontSize: '1.125rem', fontWeight: '600', color: '#1e293b' }}>
                            {formatDate(selectedUser.createdAt)}
                          </div>
                        </div>
                      </div>

                      <div style={{ marginBottom: '1.5rem' }}>
                        <div style={{ fontSize: '0.75rem', fontWeight: '600', color: '#64748b', textTransform: 'uppercase', marginBottom: '0.5rem' }}>Full Name</div>
                        <div style={{ fontSize: '1.125rem', fontWeight: '600', color: '#1e293b' }}>
                          {editMode ? (
                            <EditableField
                              value={editedUser?.name || ''}
                              onChange={(e) => setEditedUser({ ...editedUser!, name: e.target.value })}
                            />
                          ) : (
                            selectedUser.name || `${selectedUser.firstName || ''} ${selectedUser.lastName || ''}`.trim()
                          )}
                        </div>
                      </div>

                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1.5rem' }}>
                        <div>
                          <div style={{ fontSize: '0.75rem', fontWeight: '600', color: '#64748b', textTransform: 'uppercase', marginBottom: '0.5rem' }}>Phone</div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            {editMode ? (
                              <EditableField
                                value={editedUser?.phoneNumber || ''}
                                onChange={(e) => setEditedUser({ ...editedUser!, phoneNumber: e.target.value })}
                              />
                            ) : (
                              <>
                                <span style={{ fontSize: '1.125rem', fontWeight: '600', color: '#1e293b' }}>{selectedUser.phoneNumber}</span>
                                <Button
                                  variant="secondary"
                                  onClick={() => handleCall(selectedUser.phoneNumber)}
                                  style={{ padding: '0.25rem 0.5rem', fontSize: '0.75rem' }}
                                >
                                  <FiPhone size={12} /> Call
                                </Button>
                              </>
                            )}
                          </div>
                        </div>

                        <div>
                          <div style={{ fontSize: '0.75rem', fontWeight: '600', color: '#64748b', textTransform: 'uppercase', marginBottom: '0.5rem' }}>Email</div>
                          <div style={{ fontSize: '1.125rem', fontWeight: '600', color: '#1e293b' }}>
                            {editMode ? (
                              <EditableField
                                value={editedUser?.email || ''}
                                onChange={(e) => setEditedUser({ ...editedUser!, email: e.target.value })}
                              />
                            ) : (
                              selectedUser.email
                            )}
                          </div>
                        </div>
                      </div>

                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1.5rem' }}>
                        <div>
                          <div style={{ fontSize: '0.75rem', fontWeight: '600', color: '#64748b', textTransform: 'uppercase', marginBottom: '0.5rem' }}>Role</div>
                          <div style={{ fontSize: '1.125rem', fontWeight: '600', color: '#1e293b' }}>
                            {editMode && userData?.role === 'superadmin' ? (
                              <SelectInput
                                value={editedUser?.role || 'user'}
                                onChange={(e) => setEditedUser({ ...editedUser!, role: e.target.value })}
                                style={{ width: '100%', padding: '8px', fontSize: '1rem' }}
                              >
                                <option value="user">User</option>
                                <option value="support">Support</option>
                                <option value="manager">Manager</option>
                                <option value="admin">Admin</option>
                                <option value="superadmin">Super Admin</option>
                              </SelectInput>
                            ) : (
                              <span style={{ textTransform: 'capitalize' }}>{selectedUser.role || 'User'}</span>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>

                    <div style={{ flex: 3 }}>
                      <SectionTitle>
                        <FiStar /> Wallet & Business
                      </SectionTitle>

                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '1rem', marginBottom: '1.5rem' }}>
                        <div style={{ padding: '1rem', background: '#f8fafc', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                          <div style={{ fontSize: '0.75rem', fontWeight: '600', color: '#64748b', textTransform: 'uppercase', marginBottom: '0.5rem' }}>Total Coins</div>
                          <div style={{ fontSize: '1.5rem', fontWeight: '700', color: '#1e293b' }}>
                            {editMode ? (
                              <EditableField
                                type="number"
                                value={editedUser?.totalCoins || 0}
                                onChange={(e) => setEditedUser({ ...editedUser!, totalCoins: parseInt(e.target.value) || 0 })}
                              />
                            ) : (
                              selectedUser.totalCoins || 0
                            )}
                          </div>
                        </div>

                        <div style={{ padding: '1rem', background: '#f8fafc', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                          <div style={{ fontSize: '0.75rem', fontWeight: '600', color: '#64748b', textTransform: 'uppercase', marginBottom: '0.5rem' }}>Wallet Balance</div>
                          <div style={{ fontSize: '1.5rem', fontWeight: '700', color: '#1e293b', display: 'flex', alignItems: 'center' }}>
                            ₹
                            {editMode ? (
                              <EditableField
                                type="number"
                                value={editedUser?.wallet_balance || 0}
                                onChange={(e) => setEditedUser({ ...editedUser!, wallet_balance: parseInt(e.target.value) || 0 })}
                                style={{ marginLeft: '4px' }}
                              />
                            ) : (
                              selectedUser.wallet_balance || 0
                            )}
                          </div>
                        </div>
                      </div>

                      <div style={{ padding: '1rem', background: '#f8fafc', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                        <div style={{ fontSize: '0.75rem', fontWeight: '600', color: '#64748b', textTransform: 'uppercase', marginBottom: '0.5rem' }}>Referral Coins</div>
                        <div style={{ fontSize: '1.5rem', fontWeight: '700', color: '#1e293b' }}>
                          {editMode ? (
                            <EditableField
                              type="number"
                              value={editedUser?.referralCoins || 0}
                              onChange={(e) => setEditedUser({ ...editedUser!, referralCoins: parseInt(e.target.value) || 0 })}
                            />
                          ) : (
                            selectedUser.referralCoins || 0
                          )}
                        </div>
                      </div>



                      <div style={{ padding: '1rem', background: '#f8fafc', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                        <div style={{ fontSize: '0.75rem', fontWeight: '600', color: '#64748b', textTransform: 'uppercase', marginBottom: '0.5rem' }}>Deposit Money</div>
                        <div style={{ fontSize: '1.5rem', fontWeight: '700', color: '#1e293b', display: 'flex', alignItems: 'center' }}>
                          ₹
                          {editMode ? (
                            <EditableField
                              type="number"
                              value={editedUser?.depositMoney || 0}
                              onChange={(e) => setEditedUser({ ...editedUser!, depositMoney: parseInt(e.target.value) || 0 })}
                              style={{ marginLeft: '4px' }}
                            />
                          ) : (
                            selectedUser.depositMoney || 0
                          )}
                        </div>
                      </div>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '1rem', marginBottom: '1.5rem' }}>
                      <div style={{ padding: '1rem', background: '#f8fafc', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                        <div style={{ fontSize: '0.75rem', fontWeight: '600', color: '#64748b', textTransform: 'uppercase', marginBottom: '0.5rem' }}>Completed Referrals</div>
                        <div style={{ fontSize: '1.5rem', fontWeight: '700', color: '#10b981' }}>
                          {selectedReferralStats.completed}
                        </div>
                      </div>

                      <div style={{ padding: '1rem', background: '#f8fafc', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                        <div style={{ fontSize: '0.75rem', fontWeight: '600', color: '#64748b', textTransform: 'uppercase', marginBottom: '0.5rem' }}>Pending Referrals</div>
                        <div style={{ fontSize: '1.5rem', fontWeight: '700', color: '#f59e0b' }}>
                          {selectedReferralStats.pending}
                        </div>
                      </div>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '1rem' }}>
                      <div style={{ padding: '1rem', background: '#f8fafc', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                        <div style={{ fontSize: '0.75rem', fontWeight: '600', color: '#64748b', textTransform: 'uppercase', marginBottom: '0.5rem' }}>Hold Jars</div>
                        <div style={{ fontSize: '1.5rem', fontWeight: '700', color: '#1e293b' }}>
                          {editMode ? (
                            <EditableField
                              type="number"
                              value={editedUser?.jars_occupied || 0}
                              onChange={(e) => setEditedUser({ ...editedUser!, jars_occupied: parseInt(e.target.value) || 0 })}
                            />
                          ) : (
                            selectedUser.jars_occupied || 0
                          )}
                        </div>
                      </div>

                      <div style={{ padding: '1rem', background: '#f8fafc', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                        <div style={{ fontSize: '0.75rem', fontWeight: '600', color: '#64748b', textTransform: 'uppercase', marginBottom: '0.5rem' }}>Subscription</div>
                        <div style={{ fontSize: '1.5rem', fontWeight: '700', color: selectedUser.subscription?.isActive === true ? '#10b981' : '#dc2626' }}>
                          {selectedUser.subscription?.isActive === true ? 'Active' : 'Inactive'}
                        </div>
                      </div>
                    </div>
                </InfoGrid>
              </UserDetailGrid>

              <div style={{ marginTop: '2rem' }}>
                <SectionTitle>
                  <FiPackage /> Order Statistics
                </SectionTitle>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '1rem', marginBottom: '1.5rem' }}>
                  <div style={{ padding: '1rem', background: '#f8fafc', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                    <div style={{ fontSize: '0.75rem', fontWeight: '600', color: '#64748b', textTransform: 'uppercase', marginBottom: '0.5rem' }}>Total Completed Orders</div>
                    <div style={{ fontSize: '1.5rem', fontWeight: '700', color: '#28a745' }}>
                      {selectedUser.totalCompletedOrders || 0}
                    </div>
                  </div>

                  <div style={{ padding: '1rem', background: '#f8fafc', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                    <div style={{ fontSize: '0.75rem', fontWeight: '600', color: '#64748b', textTransform: 'uppercase', marginBottom: '0.5rem' }}>Total Cancelled Orders</div>
                    <div style={{ fontSize: '1.5rem', fontWeight: '700', color: '#dc3545' }}>
                      {selectedUser.totalCancelledOrders || 0}
                    </div>
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '1rem' }}>
                  <div style={{ padding: '1rem', background: '#f8fafc', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                    <div style={{ fontSize: '0.75rem', fontWeight: '600', color: '#64748b', textTransform: 'uppercase', marginBottom: '0.5rem' }}>First Order Date</div>
                    <div style={{ fontSize: '1.125rem', fontWeight: '600', color: '#17a2b8' }}>
                      {selectedUser.firstOrderDate ? formatDate(selectedUser.firstOrderDate) : 'No orders'}
                    </div>
                  </div>

                  <div style={{ padding: '1rem', background: '#f8fafc', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                    <div style={{ fontSize: '0.75rem', fontWeight: '600', color: '#64748b', textTransform: 'uppercase', marginBottom: '0.5rem' }}>Last Order Date</div>
                    <div style={{ fontSize: '1.125rem', fontWeight: '600', color: '#17a2b8' }}>
                      {selectedUser.lastOrderDate ? formatDate(selectedUser.lastOrderDate) : 'No orders'}
                    </div>
                  </div>
                </div>
              </div>

              <div style={{ marginTop: '2rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                  <SectionTitle>
                    <FiCheckCircle /> Subscription Management
                  </SectionTitle>
                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                    {!subscriptionEditMode && selectedUser.subscription && (
                      <>
                        <Button
                          variant="primary"
                          onClick={() => setSubscriptionEditMode(true)}
                          style={{ padding: '0.25rem 0.5rem', fontSize: '0.75rem' }}
                        >
                          <FiEdit3 size={12} /> Edit
                        </Button>
                        <Button
                          variant="secondary"
                          onClick={handleSubscriptionPause}
                          style={{ padding: '0.25rem 0.5rem', fontSize: '0.75rem' }}
                        >
                          <FiXCircle size={12} /> Pause
                        </Button>
                        <Button
                          variant="danger"
                          onClick={handleSubscriptionDelete}
                          style={{ padding: '0.25rem 0.5rem', fontSize: '0.75rem' }}
                        >
                          <FiX size={12} /> Delete
                        </Button>
                      </>
                    )}
                  </div>
                </div>

                {selectedUser.subscription ? (
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '1rem', marginBottom: '1.5rem' }}>
                    <div style={{ padding: '1rem', background: '#f8fafc', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                      <div style={{ fontSize: '0.75rem', fontWeight: '600', color: '#64748b', textTransform: 'uppercase', marginBottom: '0.5rem' }}>Plan / Format</div>
                      <div style={{ fontSize: '1.125rem', fontWeight: '600', color: '#8e2de2' }}>
                        {selectedUser.subscription.planType === 'monthly' ? 'Monthly Flexible' : selectedUser.subscription.plan}
                      </div>
                    </div>

                    {selectedUser.subscription.planType === 'monthly' && (
                      <div style={{ padding: '1rem', background: '#f8fafc', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                        <div style={{ fontSize: '0.75rem', fontWeight: '600', color: '#64748b', textTransform: 'uppercase', marginBottom: '0.5rem' }}>Monthly Target Jars</div>
                        <div style={{ fontSize: '1.125rem', fontWeight: '600', color: '#1e293b' }}>
                          {selectedUser.subscription.totalMonthlyJars || 0}
                        </div>
                      </div>
                    )}

                    {selectedUser.subscription.planType === 'monthly' && (
                      <div style={{ padding: '1rem', background: '#e0f2fe', borderRadius: '8px', border: '1px solid #bae6fd' }}>
                        <div style={{ fontSize: '0.75rem', fontWeight: '600', color: '#0369a1', textTransform: 'uppercase', marginBottom: '0.5rem' }}>Cycle Progress & Rollover</div>
                        <div style={{ fontSize: '1.125rem', fontWeight: '600', color: '#0f172a' }}>
                          {selectedUser.subscription.jarsDeliveredThisCycle || 0} Delivered
                          {selectedUser.subscription.carryForwardJars > 0 && <span style={{ color: '#0369a1', marginLeft: 8 }}>(+{selectedUser.subscription.carryForwardJars} Rollover)</span>}
                        </div>
                      </div>
                    )}

                    {selectedUser.subscription.frequency && (
                      <div style={{ padding: '1rem', background: '#f8fafc', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                        <div style={{ fontSize: '0.75rem', fontWeight: '600', color: '#64748b', textTransform: 'uppercase', marginBottom: '0.5rem' }}>Frequency</div>
                        <div style={{ fontSize: '1.125rem', fontWeight: '600', color: '#1e293b' }}>
                          {selectedUser.subscription.frequency.charAt(0).toUpperCase() + selectedUser.subscription.frequency.slice(1)}
                        </div>
                      </div>
                    )}

                    {selectedUser.subscription.deliveryDays && selectedUser.subscription.deliveryDays.length > 0 && (
                      <div style={{ padding: '1rem', background: '#f8fafc', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                        <div style={{ fontSize: '0.75rem', fontWeight: '600', color: '#64748b', textTransform: 'uppercase', marginBottom: '0.5rem' }}>Delivery Days</div>
                        <div style={{ fontSize: '1.125rem', fontWeight: '600', color: '#1e293b' }}>
                          {selectedUser.subscription.deliveryDays.join(', ')}
                        </div>
                      </div>
                    )}

                    {selectedUser.subscription.planPrice && (
                      <div style={{ padding: '1rem', background: '#f8fafc', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                        <div style={{ fontSize: '0.75rem', fontWeight: '600', color: '#64748b', textTransform: 'uppercase', marginBottom: '0.5rem' }}>Plan Price</div>
                        <div style={{ fontSize: '1.125rem', fontWeight: '600', color: '#1e293b' }}>₹{selectedUser.subscription.planPrice}</div>
                      </div>
                    )}

                    <div style={{ padding: '1rem', background: '#f8fafc', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                      <div style={{ fontSize: '0.75rem', fontWeight: '600', color: '#64748b', textTransform: 'uppercase', marginBottom: '0.5rem' }}>Start Date</div>
                      <div style={{ fontSize: '1.125rem', fontWeight: '600', color: '#1e293b' }}>
                        {formatDate(selectedUser.subscription.startDate)}
                      </div>
                    </div>

                    {selectedUser.subscription.nextDelivery && (
                      <div style={{ padding: '1rem', background: '#f8fafc', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                        <div style={{ fontSize: '0.75rem', fontWeight: '600', color: '#64748b', textTransform: 'uppercase', marginBottom: '0.5rem' }}>Next Delivery</div>
                        <div style={{ fontSize: '1.125rem', fontWeight: '600', color: '#28a745' }}>
                          {formatDate(selectedUser.subscription.nextDelivery)}
                        </div>
                      </div>
                    )}

                    {selectedUser.subscription.deliverySlot && (
                      <div style={{ padding: '1rem', background: '#f8fafc', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                        <div style={{ fontSize: '0.75rem', fontWeight: '600', color: '#64748b', textTransform: 'uppercase', marginBottom: '0.5rem' }}>Delivery Slot</div>
                        <div style={{ fontSize: '1.125rem', fontWeight: '600', color: '#1e293b' }}>
                          {selectedUser.subscription.deliverySlot}
                        </div>
                      </div>
                    )}

                    {selectedUser.subscription.totalDeliveries && (
                      <div style={{ padding: '1rem', background: '#f8fafc', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                        <div style={{ fontSize: '0.75rem', fontWeight: '600', color: '#64748b', textTransform: 'uppercase', marginBottom: '0.5rem' }}>Total Deliveries</div>
                        <div style={{ fontSize: '1.125rem', fontWeight: '600', color: '#1e293b' }}>
                          {selectedUser.subscription.totalDeliveries}
                        </div>
                      </div>
                    )}

                    {selectedUser.subscription.remainingDeliveries !== undefined && (
                      <div style={{ padding: '1rem', background: '#f8fafc', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                        <div style={{ fontSize: '0.75rem', fontWeight: '600', color: '#64748b', textTransform: 'uppercase', marginBottom: '0.5rem' }}>Remaining Deliveries</div>
                        <div style={{ fontSize: '1.125rem', fontWeight: '600', color: selectedUser.subscription.remainingDeliveries > 0 ? '#28a745' : '#dc3545' }}>
                          {selectedUser.subscription.remainingDeliveries}
                        </div>
                      </div>
                    )}

                    {selectedUser.subscription.pausedUntil && (
                      <div style={{ padding: '1rem', background: '#f8fafc', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                        <div style={{ fontSize: '0.75rem', fontWeight: '600', color: '#64748b', textTransform: 'uppercase', marginBottom: '0.5rem' }}>Paused Until</div>
                        <div style={{ fontSize: '1.125rem', fontWeight: '600', color: '#f59e0b' }}>
                          {formatDate(selectedUser.subscription.pausedUntil)}
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <div style={{ padding: '1.5rem', textAlign: 'center', color: '#666', background: '#f8fafc', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                    <p>No subscription found. Click Edit to create a new subscription.</p>
                  </div>
                )}
              </div>

              <div style={{ marginTop: '2rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                  <SectionTitle>
                    <FiMapPin /> Saved Addresses ({selectedUser.addresses.length})
                  </SectionTitle>
                  <Button
                    variant="primary"
                    onClick={async () => {
                      // Create new address form
                      const type = prompt('Address Type (e.g., Home, Office, etc.):', 'Home') || 'Home';
                      const addressLine = prompt('Full Address:', '') || '';
                      const street = prompt('Street:', '') || '';
                      const city = prompt('City:', '') || 'Kolkata';
                      const state = prompt('State:', '') || 'West Bengal';
                      const pincode = prompt('Pincode:', '') || '';
                      const floor = prompt('Floor (optional):', '') || '';
                      const apartment = prompt('Apartment (optional):', '') || '';
                      const landmark = prompt('Landmark (optional):', '') || '';
                      const isDefault = confirm('Should this be the default address?');

                      if (type && (addressLine || street)) {
                        try {
                          const newAddressData = {
                            userId: selectedUser!.id,
                            address_type: type,
                            address_line: addressLine,
                            street,
                            city,
                            state,
                            pincode,
                            floor,
                            apartment,
                            landmark,
                            isDefault,
                            createdAt: new Date(),
                            updatedAt: new Date()
                          };

                          const docRef = await addDocument('addresses', newAddressData);

                          // Update the local state
                          if (selectedUser) {
                            const newAddress = {
                              id: docRef.id,
                              ...newAddressData
                            };

                            setSelectedUser({
                              ...selectedUser,
                              addresses: [...selectedUser.addresses, {
                                id: newAddress.id,
                                userId: newAddress.userId,
                                type: newAddress.address_type,
                                addressLine: newAddress.address_line,
                                street: newAddress.street,
                                city: newAddress.city,
                                state: newAddress.state,
                                pincode: newAddress.pincode,
                                floor: newAddress.floor,
                                apartment: newAddress.apartment,
                                landmark: newAddress.landmark,
                                isDefault: newAddress.isDefault,
                                createdAt: newAddress.createdAt
                              }]
                            });

                            alert('New address added successfully!');
                          }
                        } catch (error) {
                          console.error('Error adding address:', error);
                          alert('Error adding address. Please try again.');
                        }
                      }
                    }}
                    style={{ padding: '0.25rem 0.5rem', fontSize: '0.75rem' }}
                  >
                    <FiEdit3 size={12} /> Manage Addresses
                  </Button>
                </div>

                {selectedUser.addresses.length > 0 ? (
                  selectedUser.addresses.map((address) => (
                    <div key={address.id} style={{ background: '#f8fafc', padding: '1rem', borderRadius: '8px', border: '1px solid #e2e8f0', marginBottom: '1rem' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.5rem' }}>
                        <div style={{ background: '#e0e7ff', color: '#4338ca', padding: '0.125rem 0.5rem', borderRadius: '9999px', fontSize: '0.7rem', fontWeight: '700', textTransform: 'uppercase' }}>
                          {address.type}
                        </div>
                        {address.isDefault && (
                          <div style={{
                            background: '#dcfce7',
                            color: '#16a34a',
                            fontSize: '0.7rem',
                            padding: '0.125rem 0.5rem',
                            borderRadius: '9999px',
                            fontWeight: '700',
                            textTransform: 'uppercase'
                          }}>
                            DEFAULT
                          </div>
                        )}
                      </div>
                      <div style={{ fontSize: '0.875rem', color: '#475569', lineHeight: '1.5', marginBottom: '0.75rem' }}>
                        {address.addressLine || (
                          `${address.floor ? `Floor ${address.floor}, ` : ''}${address.apartment ? `${address.apartment}, ` : ''}${address.street}, ${address.city}, ${address.state} - ${address.pincode}${address.landmark ? `\nLandmark: ${address.landmark}` : ''}`
                        )}
                      </div>
                      <div style={{ display: 'flex', gap: '0.5rem' }}>
                        <Button
                          variant="secondary"
                          onClick={() => openMap(address)}
                          style={{ padding: '0.25rem 0.5rem', fontSize: '0.75rem' }}
                        >
                          <FiNavigation size={12} /> Navigate
                        </Button>
                        <Button
                          variant="secondary"
                          onClick={async () => {
                            // Create an address edit form
                            const type = prompt('Address Type:', address.type) || address.type;
                            const addressLine = prompt('Full Address:', address.addressLine || '') || address.addressLine || '';
                            const street = prompt('Street:', address.street || '') || address.street || '';
                            const city = prompt('City:', address.city || 'Kolkata') || 'Kolkata';
                            const state = prompt('State:', address.state || 'West Bengal') || 'West Bengal';
                            const pincode = prompt('Pincode:', address.pincode || '') || address.pincode || '';
                            const floor = prompt('Floor (optional):', address.floor || '') || '';
                            const apartment = prompt('Apartment (optional):', address.apartment || '') || '';
                            const landmark = prompt('Landmark (optional):', address.landmark || '') || '';
                            const isDefault = confirm(`Should this be the default address? Current: ${address.isDefault}`);

                            if (type && (addressLine || street)) {
                              try {
                                await updateDocument('addresses', address.id, {
                                  address_type: type,
                                  address_line: addressLine,
                                  street,
                                  city,
                                  state,
                                  pincode,
                                  floor,
                                  apartment,
                                  landmark,
                                  isDefault,
                                  updatedAt: new Date()
                                });

                                // Update the local state
                                if (selectedUser) {
                                  const updatedAddresses = selectedUser.addresses.map(addr =>
                                    addr.id === address.id
                                      ? { ...addr, type, addressLine, street, city, state, pincode, floor, apartment, landmark, isDefault }
                                      : addr
                                  );

                                  setSelectedUser({
                                    ...selectedUser,
                                    addresses: updatedAddresses
                                  });

                                  alert('Address updated successfully!');
                                }
                              } catch (error) {
                                console.error('Error updating address:', error);
                                alert('Error updating address. Please try again.');
                              }
                            }
                          }}
                          style={{ padding: '0.25rem 0.5rem', fontSize: '0.75rem' }}
                        >
                          <FiEdit3 size={12} /> Edit
                        </Button>
                      </div>
                    </div>
                  ))
                ) : (
                  <div style={{ padding: '1.5rem', textAlign: 'center', color: '#666', background: '#f8fafc', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                    <p>No addresses found for this user.</p>
                  </div>
                )}
              </div>

              <ActionRow>
                {editMode ? (
                  <>
                    <Button
                      variant="primary"
                      onClick={handleSave}
                      disabled={saving}
                    >
                      <FiSave />
                      {saving ? 'Saving...' : 'Save Changes'}
                    </Button>
                    <Button
                      variant="secondary"
                      onClick={() => {
                        setEditMode(false);
                        setEditedUser(selectedUser);
                      }}
                    >
                      <FiX />
                      Cancel
                    </Button>
                  </>
                ) : (
                  <>
                    <Button
                      variant="primary"
                      onClick={() => setEditMode(true)}
                    >
                      <FiEdit3 />
                      Edit Details
                    </Button>
                    <Button
                      variant="danger"
                      onClick={handleDelete}
                      disabled={saving}
                    >
                      <FiX />
                      {saving ? 'Deleting...' : 'Delete User'}
                    </Button>
                  </>
                )}
              </ActionRow>
            </ModalBody>
          </ModalContent>
          </ModalOverlay>
        )}
    </AnimatePresence>
    </Container >
  );
}