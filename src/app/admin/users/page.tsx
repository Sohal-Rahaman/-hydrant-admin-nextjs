'use client';

import React, { useState, useEffect } from 'react';
import Image from 'next/image';
import styled from 'styled-components';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  FiUsers, FiSearch, FiPhone, FiMail, FiMapPin, FiCalendar,
  FiDollarSign, FiPackage, FiX, FiEdit3, FiSave, FiRefreshCw,
  FiNavigation, FiTrendingUp, FiCheckCircle, FiXCircle,
  FiStar, FiInfo
} from 'react-icons/fi';
import { 
  subscribeToCollection, 
  updateDocument,
  addDocument,
  deleteDocument,
  generateCustomerId
} from '@/lib/firebase';

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
  walletBalance: number;
  holdJars: number; // Number of jars user currently holds
  totalRevenue: number;
  totalCans: number;
  orders: Order[];
  addresses: Address[];
  subscription?: Subscription;
}

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
  startDate: Date | { toDate(): Date } | string;
  endDate?: Date | { toDate(): Date } | string;
  nextDelivery?: Date | { toDate(): Date } | string;
  frequency?: string; // weekly, monthly, etc.
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

const UsersGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(350px, 1fr));
  gap: 25px;
  margin-bottom: 40px;
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

const AddressCard = styled.div`
  background: #f8f9fa;
  border: 1px solid #e9ecef;
  border-radius: 8px;
  padding: 15px;
  margin-bottom: 10px;
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

const UserDetailGrid = styled.div`
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 30px;
  margin-bottom: 30px;

  @media (max-width: 768px) {
    grid-template-columns: 1fr;
  }
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

const ActionButton = styled(motion.button)<{ variant?: 'primary' | 'secondary' | 'danger' }>`
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

export default function UsersPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [addresses, setAddresses] = useState<Address[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
  const [filteredUsers, setFilteredUsers] = useState<User[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [editMode, setEditMode] = useState(false);
  const [editedUser, setEditedUser] = useState<User | null>(null);
  const [editedSubscription, setEditedSubscription] = useState<Subscription | null>(null);
  const [subscriptionEditMode, setSubscriptionEditMode] = useState(false);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);

  // Helper function to format dates consistently
  const formatDate = (date: Date | { toDate(): Date } | string | undefined): string => {
    if (!date) return 'N/A';
    try {
      if (typeof date === 'string') {
        return new Date(date).toLocaleDateString();
      }
      if (date instanceof Date) {
        return date.toLocaleDateString();
      }
      if (typeof date === 'object' && 'toDate' in date && typeof date.toDate === 'function') {
        return date.toDate().toLocaleDateString();
      }
      return 'Invalid Date';
    } catch {
      return 'Invalid Date';
    }
  };

  useEffect(() => {
    setLoading(true);

    // Subscribe to users collection
    const unsubscribeUsers = subscribeToCollection('users', (snapshot) => {
      console.log('Users snapshot received:', snapshot.docs.length, 'documents');
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const usersData = snapshot.docs.map((doc: any) => {
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
          walletBalance: data.walletBalance || 0,
          holdJars: data.holdJars || data.occupiedJars || 0, // Support both field names
          addresses: legacyAddresses, // Store legacy addresses temporarily
          totalRevenue: 0, // Will be calculated later
          totalCans: 0, // Will be calculated later
          orders: [] // Will be populated later
        };
      });
      console.log('Processed users:', usersData);
      setUsers(usersData as User[]);
    });

    // Subscribe to addresses collection with better error handling
    const unsubscribeAddresses = subscribeToCollection('addresses', (snapshot) => {
      console.log('Addresses snapshot received:', snapshot.docs.length, 'documents');
      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const addressesData = snapshot.docs.map((doc: any) => {
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
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        console.log('Addresses by userId:', addressesData.reduce((acc: any, addr: any) => {
          if (!acc[addr.userId]) acc[addr.userId] = [];
          acc[addr.userId].push(addr);
          return acc;
        }, {}));
        setAddresses(addressesData);
      } catch (error) {
        console.error('Error processing addresses:', error);
        setAddresses([]);
      }
    });

    // Subscribe to orders collection  
    const unsubscribeOrders = subscribeToCollection('orders', (snapshot) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const ordersData = snapshot.docs.map((doc: any) => ({
        id: doc.id,
        ...doc.data(),
        createdAt: doc.data().createdAt || new Date()
      }));
      setOrders(ordersData);
    });

    // Subscribe to subscriptions collection
    const unsubscribeSubscriptions = subscribeToCollection('subscriptions', (snapshot) => {
      console.log('Subscriptions snapshot received:', snapshot.docs.length, 'documents');
      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const subscriptionsData = snapshot.docs.map((doc: any) => {
          const data = doc.data();
          console.log('Subscription document:', doc.id, data);
          
          const subscription: Subscription = {
            id: doc.id,
            userId: data.userId || data.user_id || data.uid || '', // Support multiple field names
            isActive: Boolean(data.isActive), // Ensure boolean conversion
            plan: data.plan || data.planName || 'Basic',
            startDate: data.startDate || data.createdAt || new Date(),
            endDate: data.endDate,
            nextDelivery: data.nextDelivery || data.nextDeliveryDate,
            frequency: data.frequency || data.deliveryFrequency || 'weekly',
            deliverySlot: data.deliverySlot || data.timeSlot,
            planPrice: data.planPrice || data.price || 0,
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
        subscription: userSubscription || undefined
      };
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

  const handleUserClick = (user: User) => {
    setSelectedUser(user);
    setEditedUser(user);
    setEditMode(false);
    setSubscriptionEditMode(false);
    setEditedSubscription(user.subscription || null);
  };

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
        walletBalance: editedUser.walletBalance,
        holdJars: editedUser.holdJars,
        updatedAt: new Date()
      };
      
      await updateDocument('users', editedUser.id, updateData);
      setSelectedUser(editedUser);
      setEditMode(false);
      
      // Show success message with real-time update info
      const message = selectedUser && (editedUser.holdJars !== selectedUser.holdJars || editedUser.walletBalance !== selectedUser.walletBalance)
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
    <UsersContainer>
      <Header>
        <TitleSection>
          <UsersLogo 
            src="/logo.jpeg" 
            alt="Hydrant Logo"
            width={45}
            height={45}
          />
          <Title>
            <FiUsers />
            Users Management
          </Title>
        </TitleSection>
        <SearchBox>
          <SearchIcon />
          <SearchInput
            type="text"
            placeholder="Search by name, email, phone, customer ID, or address..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </SearchBox>
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
        <strong>🔍 Debug Info:</strong><br/>
        Users loaded: {users.length} | 
        Addresses loaded: {addresses.length} | 
        Subscriptions loaded: {subscriptions.length} | 
        Combined users: {filteredUsers.length} | 
        Users with addresses: {filteredUsers.filter(u => u.addresses && u.addresses.length > 0).length} | 
        Active subscriptions: {filteredUsers.filter(u => u.subscription?.isActive).length}<br/>
        <details style={{ marginTop: '8px' }}>
          <summary style={{ cursor: 'pointer', color: '#007bff' }}>View address details</summary>
          <div style={{ marginTop: '8px', maxHeight: '200px', overflow: 'auto' }}>
            {addresses.slice(0, 5).map(addr => (
              <div key={addr.id} style={{ margin: '4px 0', padding: '4px', background: '#fff', borderRadius: '4px' }}>
                <strong>ID:</strong> {addr.id} | <strong>UserID:</strong> {addr.userId} | <strong>Type:</strong> {addr.type}<br/>
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
                <strong style={{ color: sub.isActive ? '#28a745' : '#dc3545' }}>Active:</strong> {sub.isActive ? 'YES' : 'NO'}<br/>
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

      <UsersGrid>
        {filteredUsers.length > 0 ? (
          filteredUsers.map((user, index) => {
            const defaultAddress = user.addresses.find(addr => addr.isDefault) || user.addresses[0];
            return (
              <UserCard
                key={user.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.1 }}
                onClick={() => handleUserClick(user)}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '20px' }}>
                  <div style={{ flex: 1 }}>
                    <UserName>
                      {user.name || `${user.firstName} ${user.lastName}`.trim()}
                    </UserName>
                    <UserEmail>
                      <FiMail size={14} />
                      {user.email}
                    </UserEmail>
                    <UserPhone>
                      <FiPhone size={14} />
                      {user.phoneNumber}
                    </UserPhone>
                    <CustomerId>
                      ID: {user.customerId}
                    </CustomerId>
                    {defaultAddress && (
                      <AddressPreview>
                        <FiMapPin size={14} />
                        {defaultAddress.type}: {defaultAddress.addressLine || `${defaultAddress.city}, ${defaultAddress.pincode}`}
                        {defaultAddress.isDefault && (
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
                      </AddressPreview>
                    )}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <SubscriptionBadge active={(() => {
                      const isActive = user.subscription?.isActive === true;
                      console.log(`User ${user.id} subscription badge:`, {
                        subscription: user.subscription,
                        isActiveRaw: user.subscription?.isActive,
                        isActiveProcessed: isActive,
                        type: typeof user.subscription?.isActive
                      });
                      return isActive;
                    })()}>
                      {user.subscription?.isActive === true ? 'Active' : 'Inactive'}
                    </SubscriptionBadge>
                    <small style={{ fontSize: '0.6rem', color: '#666' }}>
                      (Raw: {String(user.subscription?.isActive)}, Type: {typeof user.subscription?.isActive})
                    </small>
                  </div>
                </div>
                
                <UserStats>
                  <StatItem>
                    <StatValue>{user.orders.length}</StatValue>
                    <StatLabel>Orders</StatLabel>
                  </StatItem>
                  <StatItem>
                    <StatValue>₹{user.totalRevenue}</StatValue>
                    <StatLabel>Revenue</StatLabel>
                  </StatItem>
                  <StatItem>
                    <StatValue>{user.addresses.length}</StatValue>
                    <StatLabel>Addresses</StatLabel>
                  </StatItem>
                  <StatItem>
                    <StatValue>{user.holdJars}</StatValue>
                    <StatLabel>Hold Jars</StatLabel>
                  </StatItem>
                </UserStats>

                {user.addresses.length > 0 && (
                  <div style={{ marginTop: '20px' }}>
                    <h4 style={{ margin: '0 0 10px 0', color: '#666', fontSize: '0.9rem' }}>
                      Saved Addresses ({user.addresses.length})
                    </h4>
                    {user.addresses.slice(0, 2).map((address) => (
                      <AddressCard key={address.id}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
                          <AddressType>{address.type}</AddressType>
                          {address.isDefault && (
                            <span style={{
                              background: '#28a745',
                              color: 'white',
                              fontSize: '0.75rem',
                              padding: '2px 6px',
                              borderRadius: '4px',
                              fontWeight: '600'
                            }}>
                              DEFAULT
                            </span>
                          )}
                        </div>
                        <AddressText>
                          {address.addressLine || `${address.street}, ${address.city}, ${address.state} - ${address.pincode}`}
                        </AddressText>
                      </AddressCard>
                    ))}
                    {user.addresses.length > 2 && (
                      <div style={{ color: '#666', fontSize: '0.85rem', fontStyle: 'italic' }}>
                        +{user.addresses.length - 2} more addresses
                      </div>
                    )}
                  </div>
                )}

                <ClickHint>
                  👆 Click to view details &amp; manage user
                </ClickHint>
              </UserCard>
            );
          })
        ) : (
          <EmptyState>
            <FiUsers size={48} style={{ marginBottom: '16px' }} />
            <h3>No users found</h3>
            <p>No users match your search criteria</p>
          </EmptyState>
        )}
      </UsersGrid>

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
                  <FiUsers />
                  {selectedUser.name || `${selectedUser.firstName} ${selectedUser.lastName}`.trim()}
                </ModalTitle>
              </ModalHeader>

              <ModalBody>
                <UserDetailGrid>
                  <DetailSection>
                    <SectionTitle>
                      <FiUsers />
                      Personal Information
                    </SectionTitle>
                    
                    <DetailItem>
                      <DetailLabel>Customer ID</DetailLabel>
                      <DetailValue>
                        {editMode ? (
                          <EditableField
                            value={editedUser?.customerId || ''}
                            onChange={(e) => setEditedUser(prev => prev ? {...prev, customerId: e.target.value} : null)}
                          />
                        ) : (
                          <span style={{ fontFamily: 'monospace', fontWeight: 'bold', color: '#8e2de2' }}>
                            {selectedUser.customerId}
                          </span>
                        )}
                      </DetailValue>
                    </DetailItem>
                    
                    <DetailItem>
                      <DetailLabel>
                        <FiUsers />
                        Full Name
                      </DetailLabel>
                      <DetailValue>
                        {editMode ? (
                          <EditableField
                            value={editedUser?.name || `${editedUser?.firstName || ''} ${editedUser?.lastName || ''}`.trim()}
                            onChange={(e) => setEditedUser(prev => prev ? {...prev, name: e.target.value} : null)}
                          />
                        ) : (
                          selectedUser.name || `${selectedUser.firstName || ''} ${selectedUser.lastName || ''}`.trim()
                        )}
                      </DetailValue>
                    </DetailItem>
                    
                    <DetailItem>
                      <DetailLabel>
                        <FiPhone />
                        Phone
                      </DetailLabel>
                      <DetailValue>
                        {editMode ? (
                          <EditableField
                            value={editedUser?.phoneNumber || ''}
                            onChange={(e) => setEditedUser(prev => prev ? {...prev, phoneNumber: e.target.value} : null)}
                          />
                        ) : (
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            {selectedUser.phoneNumber}
                            <ActionButton
                              variant="secondary"
                              onClick={() => handleCall(selectedUser.phoneNumber)}
                              style={{ padding: '4px 8px' }}
                            >
                              <FiPhone size={12} />
                              Call
                            </ActionButton>
                          </div>
                        )}
                      </DetailValue>
                    </DetailItem>
                    
                    <DetailItem>
                      <DetailLabel>
                        <FiMail />
                        Email
                      </DetailLabel>
                      <DetailValue>
                        {editMode ? (
                          <EditableField
                            value={editedUser?.email || ''}
                            onChange={(e) => setEditedUser(prev => prev ? {...prev, email: e.target.value} : null)}
                          />
                        ) : (
                          selectedUser.email
                        )}
                      </DetailValue>
                    </DetailItem>
                  </DetailSection>

                  <DetailSection>
                    <SectionTitle>
                      <FiStar />
                      Wallet & Business
                    </SectionTitle>
                    
                    <DetailItem>
                      <DetailLabel>
                        <FiStar />
                        Total Coins
                      </DetailLabel>
                      <DetailValue>
                        {editMode ? (
                          <EditableField
                            type="number"
                            value={editedUser?.totalCoins || 0}
                            onChange={(e) => setEditedUser(prev => prev ? {...prev, totalCoins: Number(e.target.value)} : null)}
                          />
                        ) : (
                          selectedUser.totalCoins || 0
                        )}
                      </DetailValue>
                    </DetailItem>
                    
                    <DetailItem>
                      <DetailLabel>
                        <FiDollarSign />
                        Wallet Balance
                      </DetailLabel>
                      <DetailValue>
                        {editMode ? (
                          <EditableField
                            type="number"
                            value={editedUser?.walletBalance || 0}
                            onChange={(e) => setEditedUser(prev => prev ? {...prev, walletBalance: Number(e.target.value)} : null)}
                          />
                        ) : (
                          `₹${selectedUser.walletBalance || 0}`
                        )}
                      </DetailValue>
                    </DetailItem>
                    
                    <DetailItem>
                      <DetailLabel>
                        <FiPackage />
                        Hold Jars
                      </DetailLabel>
                      <DetailValue>
                        {editMode ? (
                          <EditableField
                            type="number"
                            value={editedUser?.holdJars || 0}
                            onChange={(e) => setEditedUser(prev => prev ? {...prev, holdJars: Number(e.target.value)} : null)}
                            style={{ background: '#fff3cd', border: '2px solid #ffc107' }}
                          />
                        ) : (
                          <span style={{ 
                            fontWeight: 'bold', 
                            color: selectedUser.holdJars > 0 ? '#28a745' : '#6c757d',
                            fontSize: '1.1rem'
                          }}>
                            {selectedUser.holdJars || 0} jars
                          </span>
                        )}
                      </DetailValue>
                    </DetailItem>
                    
                    <DetailItem>
                      <DetailLabel>
                        <FiTrendingUp />
                        Total Revenue
                      </DetailLabel>
                      <DetailValue>₹{selectedUser.totalRevenue}</DetailValue>
                    </DetailItem>
                    
                    <DetailItem>
                      <DetailLabel>
                        <FiPackage />
                        Total Orders
                      </DetailLabel>
                      <DetailValue>{selectedUser.orders.length}</DetailValue>
                    </DetailItem>
                    
                    <DetailItem>
                      <DetailLabel>
                        {selectedUser.subscription?.isActive ? <FiCheckCircle /> : <FiXCircle />}
                        Subscription Status
                      </DetailLabel>
                      <DetailValue>
                        <SubscriptionBadge active={(() => {
                          const isActive = selectedUser.subscription?.isActive === true;
                          console.log(`Modal subscription badge for ${selectedUser.id}:`, {
                            subscription: selectedUser.subscription,
                            isActiveRaw: selectedUser.subscription?.isActive,
                            isActiveProcessed: isActive,
                            type: typeof selectedUser.subscription?.isActive
                          });
                          return isActive;
                        })()}>
                          {selectedUser.subscription?.isActive === true ? 'Active' : 'Inactive'}
                        </SubscriptionBadge>
                      </DetailValue>
                    </DetailItem>
                  </DetailSection>

                  {/* Subscription Details Section */}
                  {(selectedUser.subscription || subscriptionEditMode) && (
                    <DetailSection>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <SectionTitle>
                          <FiCheckCircle />
                          Subscription Management
                        </SectionTitle>
                        <div style={{ display: 'flex', gap: '8px' }}>
                          {!subscriptionEditMode && selectedUser.subscription && (
                            <>
                              <ActionButton
                                variant="primary"
                                onClick={() => setSubscriptionEditMode(true)}
                                style={{ padding: '4px 8px', fontSize: '0.8rem' }}
                              >
                                <FiEdit3 size={12} />
                                Edit
                              </ActionButton>
                              <ActionButton
                                variant="secondary"
                                onClick={handleSubscriptionPause}
                                style={{ padding: '4px 8px', fontSize: '0.8rem' }}
                              >
                                <FiXCircle size={12} />
                                Pause
                              </ActionButton>
                              <ActionButton
                                variant="danger"
                                onClick={handleSubscriptionDelete}
                                style={{ padding: '4px 8px', fontSize: '0.8rem' }}
                              >
                                <FiX size={12} />
                                Delete
                              </ActionButton>
                            </>
                          )}
                        </div>
                      </div>
                      
                      {selectedUser.subscription ? (
                        <>
                          <DetailItem>
                            <DetailLabel>
                              <FiPackage />
                              Plan
                            </DetailLabel>
                            <DetailValue>
                              <span style={{ fontWeight: 'bold', color: '#8e2de2' }}>
                                {selectedUser.subscription.plan}
                              </span>
                            </DetailValue>
                          </DetailItem>
                          
                          {selectedUser.subscription.frequency && (
                            <DetailItem>
                              <DetailLabel>
                                <FiRefreshCw />
                                Frequency
                              </DetailLabel>
                              <DetailValue>
                                {selectedUser.subscription.frequency.charAt(0).toUpperCase() + selectedUser.subscription.frequency.slice(1)}
                              </DetailValue>
                            </DetailItem>
                          )}
                          
                          {selectedUser.subscription.planPrice && (
                            <DetailItem>
                              <DetailLabel>
                                <FiDollarSign />
                                Plan Price
                              </DetailLabel>
                              <DetailValue>₹{selectedUser.subscription.planPrice}</DetailValue>
                            </DetailItem>
                          )}
                          
                          <DetailItem>
                            <DetailLabel>
                              <FiCalendar />
                              Start Date
                            </DetailLabel>
                            <DetailValue>
                              {formatDate(selectedUser.subscription.startDate)}
                            </DetailValue>
                          </DetailItem>
                          
                          {selectedUser.subscription.nextDelivery && (
                            <DetailItem>
                              <DetailLabel>
                                <FiTrendingUp />
                                Next Delivery
                              </DetailLabel>
                              <DetailValue>
                                <span style={{ color: '#28a745', fontWeight: 'bold' }}>
                                  {formatDate(selectedUser.subscription.nextDelivery)}
                                </span>
                              </DetailValue>
                            </DetailItem>
                          )}
                          
                          {selectedUser.subscription.deliverySlot && (
                            <DetailItem>
                              <DetailLabel>
                                <FiMapPin />
                                Delivery Slot
                              </DetailLabel>
                              <DetailValue>{selectedUser.subscription.deliverySlot}</DetailValue>
                            </DetailItem>
                          )}
                          
                          {selectedUser.subscription.totalDeliveries && (
                            <DetailItem>
                              <DetailLabel>
                                <FiPackage />
                                Total Deliveries
                              </DetailLabel>
                              <DetailValue>{selectedUser.subscription.totalDeliveries}</DetailValue>
                            </DetailItem>
                          )}
                          
                          {selectedUser.subscription.remainingDeliveries !== undefined && (
                            <DetailItem>
                              <DetailLabel>
                                <FiTrendingUp />
                                Remaining Deliveries
                              </DetailLabel>
                              <DetailValue>
                                <span style={{ color: selectedUser.subscription.remainingDeliveries > 0 ? '#28a745' : '#dc3545' }}>
                                  {selectedUser.subscription.remainingDeliveries}
                                </span>
                              </DetailValue>
                            </DetailItem>
                          )}
                          
                          {selectedUser.subscription.pausedUntil && (
                            <DetailItem>
                              <DetailLabel>
                                <FiXCircle />
                                Paused Until
                              </DetailLabel>
                              <DetailValue>
                                <span style={{ color: '#ffc107', fontWeight: 'bold' }}>
                                  {formatDate(selectedUser.subscription.pausedUntil)}
                                </span>
                              </DetailValue>
                            </DetailItem>
                          )}
                        </>
                      ) : (
                        <div style={{ padding: '20px', textAlign: 'center', color: '#666' }}>
                          <p>No subscription found. Click Edit to create a new subscription.</p>
                        </div>
                      )}
                    </DetailSection>
                  )}
                </UserDetailGrid>

                {/* Note: Subscription management with edit/pause/delete functionality is available */}
                {/* Addresses Section */}
                {selectedUser.addresses.length > 0 && (
                  <DetailSection style={{ marginTop: '20px' }}>
                    <SectionTitle>
                      <FiMapPin />
                      Saved Addresses ({selectedUser.addresses.length})
                    </SectionTitle>
                    
                    {selectedUser.addresses.map((address) => (
                      <AddressCard key={address.id}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
                          <AddressType>{address.type}</AddressType>
                          {address.isDefault && (
                            <span style={{
                              background: '#28a745',
                              color: 'white',
                              fontSize: '0.75rem',
                              padding: '2px 6px',
                              borderRadius: '4px',
                              fontWeight: '600'
                            }}>
                              DEFAULT
                            </span>
                          )}
                        </div>
                        <AddressText>
                          {address.addressLine || (
                            `${address.floor ? `Floor ${address.floor}, ` : ''}${address.apartment ? `${address.apartment}, ` : ''}${address.street}, ${address.city}, ${address.state} - ${address.pincode}${address.landmark ? `\nLandmark: ${address.landmark}` : ''}`
                          )}
                        </AddressText>
                        <ActionButton
                          variant="secondary"
                          onClick={() => handleNavigation(address)}
                          style={{ marginTop: '8px', padding: '4px 8px' }}
                        >
                          <FiNavigation size={12} />
                          Navigate
                        </ActionButton>
                      </AddressCard>
                    ))}
                  </DetailSection>
                )}

                <ButtonGroup>
                  {editMode ? (
                    <>
                      <ActionButton
                        variant="primary"
                        onClick={handleSave}
                        disabled={saving}
                      >
                        <FiSave />
                        {saving ? 'Saving...' : 'Save Changes'}
                      </ActionButton>
                      <ActionButton
                        variant="secondary"
                        onClick={() => {
                          setEditMode(false);
                          setEditedUser(selectedUser);
                        }}
                      >
                        <FiX />
                        Cancel
                      </ActionButton>
                    </>
                  ) : (
                    <>
                      <ActionButton
                        variant="primary"
                        onClick={() => setEditMode(true)}
                      >
                        <FiEdit3 />
                        Edit Details
                      </ActionButton>
                      <ActionButton
                        variant="danger"
                        onClick={handleDelete}
                        disabled={saving}
                      >
                        <FiX />
                        {saving ? 'Deleting...' : 'Delete User'}
                      </ActionButton>
                    </>
                  )}
                </ButtonGroup>
              </ModalBody>
            </ModalContent>
          </ModalOverlay>
        )}
      </AnimatePresence>
    </UsersContainer>
  );
}