'use client';

import React, { useState, useEffect } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Image from 'next/image';
import styled from 'styled-components';
import { motion, AnimatePresence } from 'framer-motion';
import {
  FiPackage, FiSearch, FiPhone, FiMapPin, FiClock,
  FiNavigation, FiCheckCircle, FiRefreshCw, FiUser, FiInfo, FiX, FiDollarSign
} from 'react-icons/fi';
import {
  subscribeToCollection,
  updateDocument,
  triggerSubscriptionOrders,
  db
} from '@/lib/firebase';
import { normalizeOrderStatus } from '@/lib/orderStatus';
import { collection, getDocs } from 'firebase/firestore';
import { logActivity } from '@/lib/activityLogger';
import { useAuth } from '@/context/AuthContext';
import { DeliveryHandoverModal } from '@/components/DeliveryHandoverModal';

interface Order {
  id: string;
  userId: string;
  userName?: string;
  userPhone?: string;
  status: 'pending' | 'processing' | 'completed' | 'cancelled' | 'canceled' | 'placed' | 'confirmed' | 'in_progress' | 'out_for_delivery' | 'delivered';
  quantity: number;
  amount: number;
  address: {
    street: string;
    city: string;
    pincode: string;
    full?: string;
  };
  createdAt: Date | { toDate(): Date } | string;
  orderType: 'regular' | 'subscription';
  deliverySlot?: string;
  deliveryDate?: string | Date | { toDate(): Date } | null;
  isPriority?: boolean;
  assignedPartner?: string;
  plusCode?: string;
  floorNumber?: string;
  hasLift?: boolean;
  isAddressVerified?: boolean;
  bewareOfDogs?: boolean;
  paymentMethod?: 'cash' | 'wallet' | 'upi';
  deliveryPartner?: {
    name: string;
    phone: string;
  };
  updatedAt?: Date | { toDate(): Date } | string;
  autoAssignAttempted?: boolean;
  priority?: number;
  sla_deadline?: Date | { toDate(): Date } | string;
  items?: any[];
  raw?: any;
  handover?: {
    deliveredJars: number;
    collectedJars: number;
    netChange: number;
    proofImage?: string | null;
    notes?: string;
    completedAt: Date | { toDate(): Date } | string;
  };
}


interface User {
  id: string;
  name: string;
  phoneNumber: string;
  wallet_balance: number;
  jars_occupied: number;
  customerId?: string;
  userId?: string;
}

interface ArmyMember {
  id: string;
  name: string;
  phoneNumber: string;
  isOnline: boolean;
  activeOrdersCount: number;
}

// PARTNER_DATA is now dynamic from the 'army' collection

// Styled Components
const Container = styled.div`padding: 20px; max-width: 1600px; margin: 0 auto;`;
const Header = styled.div`display: flex; justify-content: space-between; align-items: center; margin-bottom: 30px; flex-wrap: wrap; gap: 20px;`;

const TitleSection = styled.div`
  display: flex;
  align-items: center;
  gap: 15px;
`;

const OrdersLogo = styled(Image)`
  width: 45px;
  height: 45px;
  border-radius: 8px;
  object-fit: cover;
`;

const Title = styled.h1`color: #333; margin: 0; font-size: 2rem; font-weight: 700; display: flex; align-items: center; gap: 12px;`;

const SearchInput = styled.input`
  padding: 12px 16px 12px 45px; border: 2px solid #e5e7eb; border-radius: 10px;
  font-size: 0.9rem; width: 400px; transition: all 0.3s ease;
  &:focus { outline: none; border-color: #8e2de2; box-shadow: 0 0 0 3px rgba(142, 45, 226, 0.1); }
`;

const SearchBox = styled.div`position: relative; display: flex; align-items: center;`;
const SearchIcon = styled(FiSearch)`position: absolute; left: 15px; color: #6b7280; font-size: 1.1rem;`;

const SectionsGrid = styled.div`
  display: grid; grid-template-columns: 1fr 1fr 1fr 1fr; gap: 25px; margin-bottom: 40px;
  @media (max-width: 1400px) { grid-template-columns: 1fr 1fr; }
  @media (max-width: 800px) { grid-template-columns: 1fr; }
`;

const OrderSection = styled.div<{ type: string }>`
  background: white; border-radius: 16px; box-shadow: 0 4px 20px rgba(0, 0, 0, 0.08);
  border: 1px solid #f0f0f0; overflow: hidden;
  &::before {
    content: ''; display: block; height: 4px;
    background: ${props =>
    props.type === 'dum-dum' ? 'linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%)' :
      props.type === 'salt-lake' ? 'linear-gradient(135deg, #10b981 0%, #059669 100%)' :
        props.type === 'subscription' ? 'linear-gradient(135deg, #8e2de2 0%, #4a00e0 100%)' :
          'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)'
  };
  }
`;

const SectionHeader = styled.div`padding: 20px 25px 15px 25px; border-bottom: 1px solid #f0f0f0;`;
const SectionTitle = styled.h2<{ type: string }>`
  margin: 0 0 8px 0; font-size: 1.3rem; font-weight: 700; display: flex; align-items: center; gap: 12px;
  color: ${props =>
    props.type === 'dum-dum' ? '#1d4ed8' :
      props.type === 'salt-lake' ? '#059669' :
        props.type === 'subscription' ? '#8e2de2' : '#d97706'
  };
`;

const OrdersList = styled.div`max-height: 600px; overflow-y: auto; padding: 10px;`;

const OrderCard = styled(motion.div)`
  background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 12px;
  padding: 20px; margin-bottom: 15px; cursor: pointer; transition: all 0.3s ease;
  &:hover { transform: translateY(-2px); box-shadow: 0 8px 25px rgba(0, 0, 0, 0.1); border-color: #8e2de2; }
`;

const OrderHeader = styled.div`display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 15px;`;
const OrderInfo = styled.div`flex: 1;`;
const OrderCustomer = styled.h3`margin: 0 0 8px 0; font-size: 1.1rem; font-weight: 600; color: #333; display: flex; align-items: center; gap: 8px;`;
const OrderDetails = styled.div`color: #666; font-size: 0.9rem; line-height: 1.5;`;

const OrderStatus = styled.span<{ status: string }>`
  padding: 6px 12px; border-radius: 20px; font-size: 0.8rem; font-weight: 600; text-transform: uppercase;
  ${props => {
    switch (props.status) {
      case 'pending': return 'background: #fef3c7; color: #92400e;';
      case 'processing': return 'background: #dbeafe; color: #1e40af;';
      case 'completed': return 'background: #d1fae5; color: #065f46;';
      default: return 'background: #fee2e2; color: #991b1b;';
    }
  }}
`;

const PriorityBadge = styled.span<{ priority: number }>`
  padding: 4px 8px; border-radius: 6px; font-size: 0.75rem; font-weight: 700;
  display: flex; align-items: center; gap: 4px; border: 1px solid transparent;
  ${props => {
    switch (props.priority) {
      case 2: return 'background: #fee2e2; color: #dc2626; border-color: #fecaca;';
      case 1: return 'background: #f0f9ff; color: #0284c7; border-color: #bae6fd;';
      default: return 'background: #f3f4f6; color: #4b5563; border-color: #e5e7eb;';
    }
  }}
`;

const SLATag = styled.div<{ $isBreached: boolean }>`
  font-size: 0.75rem; font-weight: 600; margin-top: 8px;
  display: flex; align-items: center; gap: 4px;
  color: ${props => props.$isBreached ? '#dc2626' : '#6b7280'};
`;

const OrderActions = styled.div`display: flex; gap: 8px; margin-top: 15px; flex-wrap: wrap;`;

const ActionBtn = styled.button<{ variant?: string }>`
  padding: 10px 12px; border-radius: 8px; border: none; cursor: pointer;
  display: flex; align-items: center; justify-content: center; gap: 6px; font-weight: 600; font-size: 0.85rem;
  flex: 1;
  min-width: calc(50% - 10px);
  ${props => {
    switch (props.variant) {
      case 'call': return 'background: #10b981; color: white; &:hover { background: #059669; }';
      case 'navigate': return 'background: #3b82f6; color: white; &:hover { background: #2563eb; }';
      case 'deliver': return 'background: #8e2de2; color: white; &:hover { background: #7c3aed; }';
      default: return 'background: #f3f4f6; color: #374151; &:hover { background: #e5e7eb; }';
    }
  }}
`;

const Modal = styled(motion.div)`
  position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0, 0, 0, 0.5);
  backdrop-filter: blur(5px); z-index: 1000; display: flex; align-items: center; justify-content: center; padding: 20px;
`;

const ModalContent = styled(motion.div)`
  background: white; border-radius: 20px; width: 100%; max-width: 600px; position: relative;
`;

const ModalHeader = styled.div`padding: 30px 30px 20px 30px; border-bottom: 1px solid #f0f0f0;`;
const ModalTitle = styled.h2`color: #333; margin: 0; font-size: 1.5rem; font-weight: 700; display: flex; align-items: center; gap: 12px;`;
const CloseBtn = styled.button`
  position: absolute; top: 20px; right: 20px; background: none; border: none;
  font-size: 1.5rem; color: #666; cursor: pointer; padding: 8px; border-radius: 8px;
  &:hover { background: #f3f4f6; color: #333; }
`;

const ModalBody = styled.div`padding: 20px 30px 30px 30px;`;
const CheckboxGroup = styled.div`display: flex; align-items: center; gap: 12px; margin: 12px 0;`;
const Checkbox = styled.input`width: 18px; height: 18px; margin: 0;`;
const Label = styled.label`font-weight: 600; color: #374151;`;
const TextArea = styled.textarea`
  width: 100%; padding: 12px; border: 2px solid #e5e7eb; border-radius: 8px;
  font-size: 0.9rem; resize: vertical; min-height: 80px;
  &:focus { outline: none; border-color: #8e2de2; box-shadow: 0 0 0 3px rgba(142, 45, 226, 0.1); }
`;

const ActionButton = styled.button<{ variant?: string }>`
  padding: 10px 16px; border-radius: 8px; border: none; cursor: pointer;
  display: flex; align-items: center; gap: 8px; font-weight: 600; font-size: 0.9rem;
  ${props => props.variant === 'primary' ?
    'background: linear-gradient(135deg, #8e2de2 0%, #4a00e0 100%); color: white;' :
    'background: white; color: #374151; border: 2px solid #e5e7eb;'
  }
`;

const PartnerSelect = styled.select`
  padding: 6px 10px; border: 1px solid #e5e7eb; border-radius: 6px;
  font-size: 0.8rem; background: white; cursor: pointer;
  &:focus { outline: none; border-color: #8e2de2; }
`;

const EmptyState = styled.div`text-align: center; padding: 40px 20px; color: #666;`;
const LoadingSpinner = styled(motion.div)`
  display: flex; align-items: center; justify-content: center; padding: 40px;
  svg { animation: spin 1s linear infinite; }
  @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
`;

// Add tab styles
const TabContainer = styled.div`
  display: flex;
  background: white;
  border-radius: 12px;
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.08);
  margin-bottom: 25px;
  overflow: hidden;
`;

const Tab = styled.button<{ $active: boolean }>`
  flex: 1;
  padding: 15px 20px;
  border: none;
  background: ${props => props.$active ? 'linear-gradient(135deg, #8e2de2 0%, #4a00e0 100%)' : 'white'};
  color: ${props => props.$active ? 'white' : '#666'};
  font-weight: 600;
  cursor: pointer;
  transition: all 0.3s ease;
  font-size: 1rem;
  
  &:hover {
    background: ${props => props.$active ? 'linear-gradient(135deg, #8e2de2 0%, #4a00e0 100%)' : '#f8f9fa'};
    color: ${props => props.$active ? 'white' : '#333'};
  }
  
  &:first-child {
    border-top-left-radius: 12px;
    border-bottom-left-radius: 12px;
  }
  
  &:last-child {
    border-top-right-radius: 12px;
    border-bottom-right-radius: 12px;
  }
`;

const BulkAssignBar = styled.div`
  background: white;
  padding: 15px 20px;
  border-radius: 12px;
  margin-bottom: 20px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
  border: 1px solid #e5e7eb;
  position: sticky;
  top: 10px;
  z-index: 100;
`;

const BulkAssignTitle = styled.h3`
  margin: 0;
  font-size: 1rem;
  color: #1f2937;
  display: flex;
  align-items: center;
  gap: 8px;
`;

const BulkAssignActions = styled.div`
  display: flex;
  align-items: center;
  gap: 12px;
`;

const TabBadge = styled.span`
  background: rgba(255, 255, 255, 0.2);
  color: white;
  padding: 2px 8px;
  border-radius: 12px;
  font-size: 0.8rem;
  margin-left: 8px;
  font-weight: 700;
`;

const InactiveTabBadge = styled.span`
  background: #e5e7eb;
  color: #6b7280;
  padding: 2px 8px;
  border-radius: 12px;
  font-size: 0.8rem;
  margin-left: 8px;
  font-weight: 700;
`;

export default function OrdersPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [armyMembers, setArmyMembers] = useState<ArmyMember[]>([]);
  const [filteredOrders, setFilteredOrders] = useState<Order[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [activeTab, setActiveTab] = useState<'open' | 'completed' | 'cancelled'>('open');
  const searchParams = useSearchParams();
  const orderIdParam = searchParams.get('orderId');
  const router = useRouter();

  useEffect(() => {
    if (orderIdParam && orders.length > 0) {
      setSearchTerm(orderIdParam);
      // Also switch to 'all' or appropriate tab if needed, 
      // but setSearchTerm filters globally across the currently selected tab in some implementations.
      // In this one, filteredOrders depends on activeTab, so let's make sure it's visible.
      const order = orders.find(o => o.id === orderIdParam);
      if (order) {
        if (order.status === 'completed' || order.status === 'delivered') setActiveTab('completed');
        else if (order.status === 'cancelled') setActiveTab('cancelled');
        else setActiveTab('open');
      }
    }
  }, [orderIdParam, orders]);
  const [bulkPartner, setBulkPartner] = useState('');
  const [isBulkAssigning, setIsBulkAssigning] = useState(false);
  
  // QR Code Payment state
  const [showQRModal, setShowQRModal] = useState(false);
  const [selectedQRCodeOrder, setSelectedQRCodeOrder] = useState<Order | null>(null);

  const formatDate = (date: Date | { toDate(): Date } | string | number | null | undefined): string => {
    if (!date) return 'N/A';
    try {
      let d: Date;
      if (typeof date === 'string') d = new Date(date);
      else if (date instanceof Date) d = date;
      else if (typeof date === 'object' && 'toDate' in date) d = date.toDate();
      else if (typeof date === 'number') d = new Date(date);
      else return 'Invalid Date';

      return d.toLocaleString('en-IN', {
        day: '2-digit', month: 'short', year: 'numeric',
        hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true
      });
    } catch { return 'Invalid Date'; }
  };

  const getUserDetails = (identifier: string | undefined): User | undefined => {
    if (!identifier) return undefined;
    const cleanId = identifier.toString().trim();
    const phoneNo = cleanId.replace('+91', '').replace(/\s/g, '');
    
    return users.find(u => {
      const uPhone = u.phoneNumber?.toString().replace(/\s/g, '');
      const uId = u.id?.toString();
      const uCustId = u.customerId?.toString();
      const uUserId = u.userId?.toString();

      return (
        uId === cleanId || 
        uCustId === cleanId || 
        uUserId === cleanId ||
        uPhone === phoneNo ||
        (uPhone && phoneNo.includes(uPhone)) ||
        (phoneNo && uPhone?.includes(phoneNo))
      );
    });
  };

  useEffect(() => {
    setLoading(true);
    const unsubscribeOrders = subscribeToCollection('orders', (snapshot) => {
      if (snapshot.empty) {
        setOrders([]);
        setFilteredOrders([]);
        return;
      }

      try {
        const ordersData = snapshot.docs.map((doc) => {
          const data = doc.data();
          const extractPincodeFromAddress = (address: string): string => {
            if (!address) return 'UNKNOWN';
            const pincodeMatch = address.match(/\b(\d{6})\b/);
            return pincodeMatch ? pincodeMatch[1] : 'UNKNOWN';
          };

          const totalQty = data.items?.reduce((acc: number, item: any) => acc + (item.quantity || 0), 0) || data.quantity || 1;
          const totalAmt = data.total || data.amount || data.items?.reduce((acc: number, item: any) => acc + (item.price || item.amount || 0), 0) || (totalQty * 37);

          const rawAddr = data.deliveryAddress || data.address;
          const getString = (val: any) => typeof val === 'string' ? val : '';
          
          let addrFull = '';
          let addrStreet = '';
          let addrPincode = '';

          if (typeof rawAddr === 'string') {
            addrFull = rawAddr;
            addrStreet = rawAddr;
            addrPincode = extractPincodeFromAddress(rawAddr);
          } else if (rawAddr && typeof rawAddr === 'object') {
            addrFull = getString(rawAddr.fullAddress || rawAddr.full || '');
            addrStreet = getString(rawAddr.street || rawAddr.area || addrFull);
            addrPincode = getString(rawAddr.pincode || '');
            if (!addrPincode && addrFull) addrPincode = extractPincodeFromAddress(addrFull);
          }

          const mappedOrder: Order = {
            id: doc.id,
            userId: String(data.userId || data.customerId || ''),
            userName: String(data.customerName || data.userName || data.full_name || data.name || ''),
            userPhone: String(data.customerPhone || data.phoneNumber || data.phone || ''),
            status: String(data.status || 'pending'),
            quantity: totalQty,
            amount: totalAmt,
            address: {
              street: addrStreet,
              city: String(data.deliveryAddress?.city || data.address?.city || ''),
              pincode: addrPincode,
              full: addrFull
            },
            createdAt: data.createdAt || data.orderDate || data.timestamp || new Date(),
            orderType: String(data.orderType || (data.subscriptionId ? 'subscription' : 'regular')),
            deliverySlot: data.deliverySlot,
            deliveryDate: data.deliveryDate,
            isPriority: data.isPriority,
            assignedPartner: data.assignedPartner,
            plusCode: data.plusCode || data.deliveryAddress?.plusCode || data.address?.plusCode,
            floorNumber: data.floorNumber || data.deliveryAddress?.floor || data.address?.floor,
            hasLift: data.hasLift ?? data.deliveryAddress?.hasLift ?? data.address?.hasLift,
            isAddressVerified: data.isAddressVerified ?? data.deliveryAddress?.isVerified ?? data.address?.isVerified,
            bewareOfDogs: data.bewareOfDogs ?? data.deliveryAddress?.bewareOfDogs ?? data.address?.bewareOfDogs,
            paymentMethod: String(data.paymentMethod || 'cash'),
            deliveryPartner: data.deliveryPartner,
            updatedAt: data.updatedAt,
            priority: data.priority ?? 0,
            sla_deadline: data.sla_deadline,
            items: data.items || [],
            raw: data
          };

          mappedOrder.status = normalizeOrderStatus(String(data.status || mappedOrder.status));
          return mappedOrder;
        }).filter((order) => order.id).sort((a, b) => {
          const getTimestamp = (date: Date | { toDate(): Date } | string): number => {
            try {
              if (typeof date === 'string') return new Date(date).getTime();
              if (date instanceof Date) return date.getTime();
              if (typeof date === 'object' && 'toDate' in date && typeof date.toDate === 'function') {
                return date.toDate().getTime();
              }
              return new Date().getTime();
            } catch { return new Date().getTime(); }
          };
          return getTimestamp(a.createdAt) - getTimestamp(b.createdAt);
        });

        setOrders(ordersData);
        setFilteredOrders(ordersData);
      } catch (error) {
        console.error('Error processing orders data:', error);
        setOrders([]);
        setFilteredOrders([]);
      }
    }, [], (error) => {
      console.error('Firebase orders subscription error:', error);
    });

    const unsubscribeUsers = subscribeToCollection('users', (snapshot) => {
      try {
        const usersData = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data(),
          phoneNumber: doc.data().phoneNumber || doc.data().phone || '',
          wallet_balance: doc.data().wallet_balance || doc.data().walletBalance || 0,
          jars_occupied: doc.data().jars_occupied || doc.data().holdJars || doc.data().occupiedJars || 0,
        })) as User[];
        setUsers(usersData);
      } catch (error) {
        console.error('Error processing users data:', error);
        setUsers([]);
      }
    }, [], (error) => {
      console.error('Firebase users subscription error:', error);
      setUsers([]);
    });

    const unsubscribeArmy = subscribeToCollection('army', (snapshot) => {
      try {
        const armyData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as ArmyMember[];
        setArmyMembers(armyData);
      } catch (error) {
        console.error('Error processing army data:', error);
      }
    }, [], (error) => {
      console.error('Firebase army subscription error:', error);
    });

    setTimeout(() => setLoading(false), 2000);
    return () => { unsubscribeOrders(); unsubscribeUsers(); unsubscribeArmy(); };
  }, []);

  useEffect(() => {
    let filtered = orders;
    if (activeTab === 'open') {
      filtered = orders.filter(order =>
        ['placed', 'pending', 'confirmed', 'processing', 'in_progress', 'out_for_delivery'].includes(order.status?.toLowerCase())
      );
    } else if (activeTab === 'completed') {
      filtered = orders.filter(order => {
        const status = order.status?.toLowerCase();
        return status === 'completed' || status === 'delivered';
      });
    } else if (activeTab === 'cancelled') {
      filtered = orders.filter(order => {
        const status = order.status?.toLowerCase();
        return status === 'cancelled' || status === 'canceled';
      });
    }

    if (searchTerm) {
      filtered = filtered.filter(order => {
        const user = getUserDetails(order.userId);
        return (
          order.userName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
          order.userPhone?.includes(searchTerm) ||
          order.address.pincode?.includes(searchTerm) ||
          user?.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
          order.id.toLowerCase().includes(searchTerm.toLowerCase())
        );
      });
    }
    setFilteredOrders(filtered);
  }, [searchTerm, orders, users, activeTab]);

  const getOrdersBySection = () => {
    if (activeTab === 'open') {
      const openStatuses = ['placed', 'pending', 'confirmed', 'processing', 'in_progress', 'out_for_delivery'];
      const openOrders = filteredOrders.filter(o => openStatuses.includes(o.status?.toLowerCase()));
      
      const now = new Date();
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);

      const getOrderDate = (date: any): Date | null => {
        if (!date) return null;
        try {
          if (typeof date === 'string') return new Date(date);
          if (date instanceof Date) return date;
          if (typeof date === 'object' && 'toDate' in date) return date.toDate();
          return null;
        } catch { return null; }
      };

      const isSameDay = (d1: Date, d2: Date) => 
        d1.getFullYear() === d2.getFullYear() && 
        d1.getMonth() === d2.getMonth() && 
        d1.getDate() === d2.getDate();

      const todayOrders = openOrders.filter(o => {
        const d = getOrderDate(o.deliveryDate || o.createdAt);
        return d && isSameDay(d, today);
      });

      const todayMorning = todayOrders.filter(o => {
        const slot = o.deliverySlot?.toLowerCase() || '';
        return slot.includes('morning') || slot.includes('11:00');
      });
      const todayAfternoon = todayOrders.filter(o => {
        const slot = o.deliverySlot?.toLowerCase() || '';
        return slot.includes('afternoon') || slot.includes('2:30');
      });
      const todayEvening = todayOrders.filter(o => {
        const slot = o.deliverySlot?.toLowerCase() || '';
        return slot.includes('evening') || slot.includes('6:00');
      });
      const todayOther = todayOrders.filter(o => {
        const slot = o.deliverySlot?.toLowerCase() || '';
        const isMorning = slot.includes('morning') || slot.includes('11:00');
        const isAfternoon = slot.includes('afternoon') || slot.includes('2:30');
        const isEvening = slot.includes('evening') || slot.includes('6:00');
        return !isMorning && !isAfternoon && !isEvening;
      });

      // Sort today's sub-sections by slot and then priority
      const sortBySlot = (a: Order, b: Order) => {
        if (a.isPriority && !b.isPriority) return -1;
        if (!a.isPriority && b.isPriority) return 1;
        return 0;
      };

      todayMorning.sort(sortBySlot);
      todayAfternoon.sort(sortBySlot);
      todayEvening.sort(sortBySlot);
      todayOther.sort(sortBySlot);

      const tomorrowOrders = openOrders.filter(o => {
        const d = getOrderDate(o.deliveryDate || o.createdAt);
        return d && isSameDay(d, tomorrow);
      });

      const futureOrders = openOrders.filter(o => {
        const d = getOrderDate(o.deliveryDate || o.createdAt);
        return d && d.getTime() > tomorrow.getTime() + 86400000; // After tomorrow
      });

      return { 
        todayMorning, 
        todayAfternoon, 
        todayEvening, 
        todayOther,
        tomorrowOrders, 
        futureOrders 
      };
    } else {
      const getTimestamp = (date: any): number => {
        try {
          if (!date) return 0;
          if (typeof date === 'string') return new Date(date).getTime();
          if (date instanceof Date) return date.getTime();
          if (typeof date === 'object' && 'toDate' in date) return date.toDate().getTime();
          return 0;
        } catch { return 0; }
      };

      const sortedAllOrders = [...filteredOrders].sort((a, b) => {
        const timeA = getTimestamp(a.updatedAt || a.createdAt);
        const timeB = getTimestamp(b.updatedAt || b.createdAt);
        return timeB - timeA; // Descending (newest first)
      });

      return {
        allOrders: sortedAllOrders,
        todayMorning: [], todayAfternoon: [], todayEvening: [], todayOther: [],
        tomorrowOrders: [], futureOrders: []
      };
    };
  };

  const { todayMorning, todayAfternoon, todayEvening, todayOther, tomorrowOrders, futureOrders, allOrders } = getOrdersBySection();

  const openOrdersCount = orders.filter(o => ['placed', 'pending', 'confirmed', 'processing', 'in_progress', 'out_for_delivery'].includes(o.status?.toLowerCase())).length;
  const completedOrdersCount = orders.filter(o => o.status === 'completed' || o.status === 'delivered').length;
  const cancelledOrdersCount = orders.filter(o => o.status === 'cancelled' || o.status === 'canceled').length;

  const handleCall = (phone: string) => {
    if (!phone || phone === 'N/A') {
      alert('Phone number not available');
      return;
    }
    const cleanPhone = phone.replace(/\s/g, '');
    window.open(`tel:${cleanPhone}`, '_self');
  };

  const checkIsDelayed = (order: Order): boolean => {
    if (activeTab !== 'open') return false;
    
    const openStatuses = ['placed', 'pending', 'confirmed', 'processing', 'in_progress', 'out_for_delivery'];
    if (!openStatuses.includes(order.status?.toLowerCase())) return false;

    const getOrderDate = (date: any): Date | null => {
      if (!date) return null;
      try {
        if (typeof date === 'string') return new Date(date);
        if (date instanceof Date) return date;
        if (typeof date === 'object' && 'toDate' in date) return date.toDate();
        return null;
      } catch { return null; }
    };

    const now = new Date();
    const deliveryDate = getOrderDate(order.deliveryDate || order.createdAt);
    if (!deliveryDate) return false;

    // 1. Check for SLA breach if field exists (Robust Phase 6 Logic)
    if (order.sla_deadline) {
      const deadline = typeof order.sla_deadline === 'object' && 'toDate' in order.sla_deadline 
        ? order.sla_deadline.toDate() 
        : new Date(order.sla_deadline as string);
      return now > deadline;
    }
    
    // 2. Fallback to Legacy Logic
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    
    // Check if order is from a previous day (Past due is always delayed)
    const orderDay = new Date(deliveryDate.getFullYear(), deliveryDate.getMonth(), deliveryDate.getDate());
    if (orderDay < today) return true;

    // For today's orders, check the time slot
    if (orderDay.getTime() === today.getTime()) {
      const currentHour = now.getHours();
      const currentMinute = now.getMinutes();
      const currentTimeInMinutes = currentHour * 60 + currentMinute;

      const slot = order.deliverySlot?.toLowerCase() || '';
      
      if (slot.includes('morning') || slot.includes('11:00') || slot.includes('8:00')) {
        // Morning slot ends at 1:30 PM (13:30)
        return currentTimeInMinutes > (13 * 60 + 30);
      }
      if (slot.includes('afternoon') || slot.includes('2:30') || slot.includes('1:00')) {
        // Afternoon slot ends at 4:30 PM (16:30)
        return currentTimeInMinutes > (16 * 60 + 30);
      }
      if (slot.includes('evening') || slot.includes('6:00') || slot.includes('5:00')) {
        // Evening slot ends at 9:30 PM (21:30) - Adjusted for production realism
        return currentTimeInMinutes > (21 * 60 + 30);
      }

      // Default: If it's a "placed" order from today and it's already late night
      return currentTimeInMinutes > (22 * 60 + 0); 
    }

    return false;
  };

  // Automatic Dispatch Effect - checks periodically for unassigned orders
  useEffect(() => {
    if (loading || armyMembers.length === 0) return;

    const autoDispatchInterval = setInterval(async () => {
      const unassignedToAssign = orders.filter(o => 
        ['placed', 'pending'].includes(o.status?.toLowerCase()) && 
        !o.assignedPartner && 
        !o.autoAssignAttempted // Prevent infinite loops if assignment fails
      );
      
      const onlineArmy = armyMembers.filter(m => m.isOnline);
      
      if (unassignedToAssign.length > 0 && onlineArmy.length > 0) {
        console.log(`🤖 Auto-dispatching ${unassignedToAssign.length} orders...`);
        for (let i = 0; i < unassignedToAssign.length; i++) {
          const order = unassignedToAssign[i];
          const partner = onlineArmy[i % onlineArmy.length];
          try {
            // Mark as attempted so we don't try every few seconds if it fails
            order.autoAssignAttempted = true; 
            
            await updateDocument('orders', order.id, {
              assignedPartner: partner.name,
              deliveryPartner: { name: partner.name, phone: partner.phoneNumber },
              status: 'processing',
              updatedAt: new Date()
            });
            
            console.log(`✅ Auto-assigned ${order.id} to ${partner.name}`);
          } catch (err) {
            console.error(`❌ Auto-assign failed for ${order.id}:`, err);
          }
        }
      }
    }, 60000); // Check every minute

    return () => clearInterval(autoDispatchInterval);
  }, [orders, armyMembers, loading]);


  const handleNavigation = (order: Order) => {
    let destinationAddress = '';
    if (order.address.full && order.address.full.trim()) {
      destinationAddress = order.address.full.trim();
    } else if (order.address.street) {
      destinationAddress = `${order.address.street}, ${order.address.city || ''} ${order.address.pincode || ''}`;
    }

    if (!destinationAddress) {
      alert('No address available.');
      return;
    }

    const mapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(destinationAddress)}`;
    window.open(mapsUrl, '_blank');
  };

  const handleDeliveryClick = (order: Order) => {
    setSelectedOrder(order);
    setShowModal(true);
  };

  const testFirebaseConnection = async () => {
    try {
      const snapshot = await getDocs(collection(db, 'orders'));
      alert(`Found ${snapshot.docs.length} orders.`);
    } catch (err) {
      alert(`Connection failed: ${err}`);
    }
  };

  const handleReceivePayment = (order: Order) => {
    setSelectedQRCodeOrder(order);
    setShowQRModal(true);
  };

  const handlePartnerChange = async (orderId: string, partnerKey: string) => {
    try {
      const partner = armyMembers.find(m => m.name === partnerKey);
      if (!partner) return;
      await updateDocument('orders', orderId, {
        assignedPartner: partnerKey,
        deliveryPartner: { name: partner.name, phone: partner.phoneNumber },
        status: 'processing',
        updatedAt: new Date()
      });
      alert(`Assigned ${partnerKey} successfully.`);
    } catch (err) {
      alert('Failed to assign partner.');
    }
  };

  const handleMarkDelivered = async (handoverData: any) => {
    if (!selectedOrder) return;
    setProcessing(true);
    try {
      const user = getUserDetails(selectedOrder.userId);
      const { deliveredJars, collectedJars, amountPaid, notes } = handoverData;
      
      const originalQty = selectedOrder.quantity || 1;
      const originalAmount = selectedOrder.amount || 0;
      const unitPrice = originalAmount / originalQty;
      const newAmount = unitPrice * deliveredJars;

      // Calculation: How much was already paid?
      const alreadyPaid = (selectedOrder.paymentMethod !== 'cash') ? (selectedOrder.amount || 0) : 0;
      const remainingDue = newAmount - alreadyPaid;
      const unpaidAmount = remainingDue - amountPaid;
      const holdJarsChange = deliveredJars - collectedJars;

      await updateDocument('orders', selectedOrder.id, {
        status: 'completed',
        deliveredAt: new Date(),
        handover: {
          deliveredJars: deliveredJars,
          collectedJars: collectedJars,
          netChange: holdJarsChange,
          completedAt: new Date(),
          notes: notes,
          amountPaid: amountPaid
        },
        amount: newAmount,
      });

      if (user) {
        await updateDocument('users', user.id, {
          wallet_balance: (user.wallet_balance || 0) - unpaidAmount,
          jars_occupied: (user.jars_occupied || 0) + holdJarsChange
        });
      }

      await logActivity({
        action: 'ORDER_DELIVERED',
        actor: 'ADMIN',
        actorName: 'Admin',
        actorId: 'admin_panel',
        details: `Order #${selectedOrder.id} marked as delivered. Jars net: ${holdJarsChange}, Amount: ₹${newAmount}`,
        targetId: selectedOrder.id,
      });
      
      // We don't call setShowModal(false) here because Step 4 (Success) is handled inside the component
    } catch (err) {
      console.error(err);
      alert('Failed to update order status');
    } finally {
      setProcessing(false);
    }
  };

  const handleBulkAssign = async (targetOrders: Order[]) => {
    if (!bulkPartner) { alert('Please select a partner'); return; }
    if (targetOrders.length === 0) { alert('No orders'); return; }
    if (!confirm(`Assign ${bulkPartner} to ${targetOrders.length} orders?`)) return;

    setIsBulkAssigning(true);
    let successCount = 0;
    try {
      for (const order of targetOrders) {
        try {
          await updateDocument('orders', order.id, {
            assignedPartner: bulkPartner,
            status: 'processing',
            updatedAt: new Date()
          });
          successCount++;
        } catch (err) { console.error(err); }
      }
      alert(`Assigned ${successCount} orders.`);
      await logActivity({
        action: 'BULK_PARTNER_ASSIGNMENT',
        actor: 'ADMIN',
        actorName: 'Admin',
        actorId: 'admin_panel',
        details: `Bulk assigned ${successCount} orders to ${bulkPartner}`,
        targetId: 'multiple_orders',
      });
    } finally {
      setIsBulkAssigning(false);
      setBulkPartner('');
    }
  };

  const handleCancelOrder = async (orderId: string) => {
    if (!confirm('Are you sure you want to cancel this order?')) return;
    try {
      await updateDocument('orders', orderId, {
        status: 'cancelled',
        updatedAt: new Date()
      });
      await logActivity({
        action: 'ORDER_CANCELLED',
        actor: 'ADMIN',
        actorName: 'Admin',
        actorId: 'admin_panel',
        details: `Order ${orderId} cancelled by admin`,
        targetId: orderId,
      });
      alert('Order cancelled successfully.');
    } catch (err) {
      alert('Failed to cancel order.');
    }
  };

  const handleAutoAssign = async () => {
    const unassignedOrders = orders.filter(o => 
      ['placed', 'pending'].includes(o.status?.toLowerCase()) && !o.assignedPartner
    );
    const onlineArmy = armyMembers.filter(m => m.isOnline);

    if (unassignedOrders.length === 0) {
      alert('No unassigned orders found.');
      return;
    }
    if (onlineArmy.length === 0) {
      alert('No online army members available.');
      return;
    }

    if (!confirm(`Auto-assign ${unassignedOrders.length} orders to ${onlineArmy.length} online members?`)) return;

    setIsBulkAssigning(true);
    let successCount = 0;
    try {
      // Simple Round-Robin
      for (let i = 0; i < unassignedOrders.length; i++) {
        const order = unassignedOrders[i];
        const partner = onlineArmy[i % onlineArmy.length];
        try {
          await updateDocument('orders', order.id, {
            assignedPartner: partner.name,
            deliveryPartner: { name: partner.name, phone: partner.phoneNumber },
            status: 'processing',
            updatedAt: new Date()
          });
          successCount++;
        } catch (err) { console.error(err); }
      }
      alert(`Successfully auto-assigned ${successCount} orders.`);
      await logActivity({
        action: 'AUTO_DISPATCH_TRIGGERED',
        actor: 'ADMIN',
        actorName: 'Admin',
        actorId: 'admin_panel',
        details: `Auto-dispatched ${successCount} orders.`,
        targetId: 'multiple_orders',
      });
    } finally {
      setIsBulkAssigning(false);
    }
  };

  const renderOrderCard = (order: Order) => {
    const user = getUserDetails(order.userId);
    const name = user?.name || order.userName || 'Unknown Customer';
    const phone = user?.phoneNumber || order.userPhone || 'N/A';
    const isDelayed = checkIsDelayed(order);

    const getPaymentBadge = (method: string) => {
      const m = method?.toLowerCase() || 'cash';
      if (m === 'wallet') return { 
        icon: '💳', 
        color: '#ffffff', 
        label: 'WALLET', 
        bg: 'linear-gradient(135deg, #6366f1 0%, #4338ca 100%)',
        shadow: '0 4px 12px rgba(99, 102, 241, 0.3)'
      };
      if (m === 'upi') return { 
        icon: '📲', 
        color: '#ffffff', 
        label: 'UPI / PAID', 
        bg: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
        shadow: '0 4px 12px rgba(16, 185, 129, 0.3)'
      };
      return { 
        icon: '💵', 
        color: '#ffffff', 
        label: 'CASH', 
        bg: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
        shadow: '0 4px 12px rgba(245, 158, 11, 0.3)'
      };
    };

    const payment = getPaymentBadge(order.paymentMethod || 'cash');

    return (
      <OrderCard 
        key={order.id} 
        initial={{ opacity: 0, y: 20 }} 
        animate={{ opacity: 1, y: 0 }}
        style={isDelayed ? { 
          border: '2px solid #ef4444', 
          background: 'linear-gradient(to right, #fffcfc, #ffffff)',
          boxShadow: '0 10px 30px rgba(239, 68, 68, 0.15)'
        } : {}}
      >
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '12px', alignItems: 'center' }}>
          {order.priority !== undefined && (
            <PriorityBadge priority={order.priority}>
              {order.priority === 2 ? '🚀 EXPRESS' : order.priority === 1 ? '♻️ SUBSCRIPTION' : '📦 NORMAL'}
            </PriorityBadge>
          )}
          {isDelayed && (
            <div style={{ 
              background: '#ef4444', color: 'white', padding: '4px 12px', borderRadius: '20px', 
              fontSize: '0.75rem', fontWeight: '900', textTransform: 'uppercase', letterSpacing: '1px',
              boxShadow: '0 2px 4px rgba(239, 68, 68, 0.3)', display: 'flex', alignItems: 'center', gap: '4px'
            }}>
              ⚠️ SLA BREACH
            </div>
          )}
        </div>
        
        <OrderHeader>
          <OrderInfo>
            <OrderCustomer 
              onClick={() => router.push(`/admin/users?customerId=${order.userId}`)} 
              style={{ cursor: 'pointer', color: '#6366f1', textDecoration: 'underline' }}
            >
              <FiUser size={16} />
              {name}
            </OrderCustomer>
            <OrderDetails>
              <div style={{ fontSize: '1.1rem', fontWeight: '800', color: '#1e293b', display: 'flex', alignItems: 'center' }}>
                <FiPhone size={16} style={{ marginRight: '8px', color: '#6366f1' }} />
                <a href={`tel:${phone}`} style={{ color: 'inherit', textDecoration: 'none' }}>{phone}</a>
              </div>
              
              <div style={{ wordBreak: 'break-word', marginTop: '8px', fontSize: '0.9rem', color: '#475569' }}>
                <FiMapPin size={14} style={{ marginRight: '6px' }} />
                {order.address.full || `${order.address.street}, ${order.address.pincode}`}
              </div>

              {order.plusCode && (
                <div style={{ marginTop: '6px' }}>
                  <FiNavigation size={14} style={{ marginRight: '6px', color: '#3b82f6' }} />
                  <a 
                    href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(order.plusCode)}`} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    style={{ color: '#3b82f6', fontWeight: '600', textDecoration: 'none', borderBottom: '1px dashed #3b82f6', fontSize: '0.85rem' }}
                  >
                    Google Maps Link
                  </a>
                </div>
              )}

              <div style={{ 
                display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', 
                marginTop: '12px', padding: '12px', background: '#f8fafc', borderRadius: '10px',
                fontSize: '0.8rem', border: '1px solid #e2e8f0'
              }}>
                <div style={{ color: '#64748b' }}>🏢 Floor: <span style={{ color: '#0f172a', fontWeight: '700' }}>{order.floorNumber || 'N/A'}</span></div>
                <div style={{ color: '#64748b' }}>🛗 Lift: <span style={{ color: '#0f172a', fontWeight: '700' }}>{order.hasLift ? '✅ Yes' : '❌ No'}</span></div>
                <div style={{ color: '#64748b' }}>📍 Verified: <span style={{ color: order.isAddressVerified ? '#10b981' : '#f59e0b', fontWeight: '700' }}>{order.isAddressVerified ? '✅ Yes' : '⏳ Pending'}</span></div>
                <div style={{ color: '#64748b' }}>🐕 Dogs: <span style={{ color: order.bewareOfDogs ? '#ef4444' : '#10b981', fontWeight: '700' }}>{order.bewareOfDogs ? '⚠️ YES' : '✅ No'}</span></div>
              </div>

              <div style={{ display: 'flex', gap: '10px', marginTop: '15px', alignItems: 'center' }}>
                <div style={{ 
                  padding: '8px 16px', borderRadius: '10px', fontSize: '0.9rem', fontWeight: '900',
                  background: payment.bg, color: payment.color, boxShadow: payment.shadow,
                  display: 'flex', alignItems: 'center', gap: '8px', border: 'none',
                  letterSpacing: '0.5px'
                }}>
                  <span style={{ fontSize: '1.3rem' }}>{payment.icon}</span> {payment.label}
                </div>
                {order.deliverySlot && (
                  <div style={{ 
                    padding: '6px 12px', borderRadius: '8px', background: '#f1f5f9', color: '#475569', 
                    fontSize: '0.75rem', fontWeight: '750', border: '1px solid #e2e8f0',
                    display: 'flex', alignItems: 'center', gap: '4px'
                  }}>
                    ⏰ {order.deliverySlot}
                  </div>
                )}
              </div>

              {order.deliveryPartner && (
                <div style={{ 
                  marginTop: '12px', padding: '12px', background: '#ecfdf5', borderRadius: '12px',
                  border: '1px solid #10b981', display: 'flex', alignItems: 'center', gap: '12px',
                  boxShadow: '0 2px 8px rgba(16, 185, 129, 0.1)'
                }}>
                  <div style={{ 
                    width: '36px', height: '36px', borderRadius: '50%', background: '#10b981', 
                    display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white'
                  }}>
                    <FiUser size={18} style={{ margin: '0 auto' }} />
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: '0.65rem', color: '#059669', fontWeight: '900', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Assigned Partner</div>
                    <div style={{ fontSize: '1rem', fontWeight: '800', color: '#064e3b' }}>{order.deliveryPartner.name}</div>
                  </div>
                </div>
              )}

              {order.sla_deadline && (
                <SLATag $isBreached={isDelayed}>
                  <FiClock size={12} /> 
                  SLA: {formatDate(order.sla_deadline)}
                </SLATag>
              )}

              <div style={{ color: '#94a3b8', fontSize: '0.7rem', marginTop: '12px', fontWeight: '600' }}>
                ID: {order.id} | Placed: {formatDate(order.createdAt)}
              </div>
            </OrderDetails>
          </OrderInfo>

          <div style={{ textAlign: 'right', minWidth: '110px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
            <div>
              <OrderStatus status={order.status}>{order.status}</OrderStatus>
              <div style={{ margin: '8px 0', fontSize: '1.5rem', fontWeight: '900', color: '#10b981' }}>₹{order.amount}</div>
              <div style={{ fontSize: '0.9rem', color: '#64748b', fontWeight: '700' }}>Qty: {order.quantity}</div>
            </div>
            
            <div style={{ marginTop: 'auto' }}>
              <div style={{ fontSize: '0.65rem', color: '#94a3b8', fontWeight: '900', marginBottom: '4px', textAlign: 'left', textTransform: 'uppercase' }}>Assign Army</div>
              <PartnerSelect
                value={order.assignedPartner || ''}
                onChange={(e) => handlePartnerChange(order.id, e.target.value)}
                onClick={(e) => e.stopPropagation()}
                style={{ width: '100%', padding: '8px', borderRadius: '8px' }}
              >
                <option value="">Select...</option>
                {armyMembers.map(m => (
                  <option key={m.id} value={m.name}>
                    {m.name} {m.isOnline ? '🟢' : '🔴'}
                  </option>
                ))}
              </PartnerSelect>
            </div>
          </div>
        </OrderHeader>

        <OrderActions style={{ marginTop: '20px', gap: '8px' }}>
          <ActionBtn variant="navigate" onClick={() => handleCall(phone)} style={{ background: '#10b981' }}>
            <FiPhone size={14} /> Call
          </ActionBtn>
          <ActionBtn variant="navigate" onClick={() => handleNavigation(order)}>
            <FiNavigation size={14} /> Route
          </ActionBtn>
          {(!order.paymentMethod || order.paymentMethod.toLowerCase() === 'cash') && (
            <ActionBtn variant="navigate" onClick={() => handleReceivePayment(order)} style={{ background: '#f59e0b', color: 'white' }}>
              <FiDollarSign size={14} /> Receive Pay
            </ActionBtn>
          )}
          <ActionBtn variant="deliver" onClick={() => handleDeliveryClick(order)}>
            <FiCheckCircle size={14} /> Deliver
          </ActionBtn>
          {(order.status !== 'completed' && order.status !== 'delivered' && order.status !== 'cancelled' && order.status !== 'canceled') && (
            <ActionBtn onClick={() => handleCancelOrder(order.id)} style={{ background: '#fee2e2', color: '#991b1b', border: '1px solid #fecaca' }}>
              <FiX size={14} /> Cancel
            </ActionBtn>
          )}
        </OrderActions>
      </OrderCard>
    );
  };

  if (loading) {
    return <LoadingSpinner><FiRefreshCw size={40} /></LoadingSpinner>;
  }

  return (
    <Container>
      <Header>
        <TitleSection>
          <OrdersLogo src="/hydrantlogo.png" alt="Logo" width={45} height={45} />
          <Title><FiPackage />Orders</Title>
        </TitleSection>
        <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
          <SearchBox>
            <SearchIcon />
            <SearchInput
              placeholder="Search orders..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </SearchBox>
          <ActionButton onClick={() => window.location.reload()}><FiRefreshCw />Refresh</ActionButton>
        </div>
      </Header>

      <TabContainer>
        <Tab $active={activeTab === 'open'} onClick={() => setActiveTab('open')}>
          📦 Open <TabBadge>{openOrdersCount}</TabBadge>
        </Tab>
        <Tab $active={activeTab === 'completed'} onClick={() => setActiveTab('completed')}>
          ✅ Done <TabBadge>{completedOrdersCount}</TabBadge>
        </Tab>
        <Tab $active={activeTab === 'cancelled'} onClick={() => setActiveTab('cancelled')}>
          ❌ X <TabBadge>{cancelledOrdersCount}</TabBadge>
        </Tab>
      </TabContainer>

      {activeTab === 'open' ? (
        <>
          <BulkAssignBar>
            <BulkAssignTitle><FiPackage /> Bulk Assign {filteredOrders.length} Orders</BulkAssignTitle>
            <BulkAssignActions>
              <PartnerSelect value={bulkPartner} onChange={(e) => setBulkPartner(e.target.value)}>
                <option value="">Select Army...</option>
                {armyMembers.map(m => (
                  <option key={m.id} value={m.name}>
                    {m.name} {m.isOnline ? '🟢' : '🔴'}
                  </option>
                ))}
              </PartnerSelect>
              <ActionButton variant="primary" onClick={() => handleBulkAssign(filteredOrders)} disabled={isBulkAssigning || !bulkPartner}>
                Apply
              </ActionButton>
              <ActionButton 
                variant="secondary" 
                onClick={handleAutoAssign} 
                disabled={isBulkAssigning}
                style={{ background: '#f8fafc', color: '#8e2de2', border: '1px solid #e2e8f0', fontWeight: 'bold' }}
              >
                <FiRefreshCw style={{ marginRight: '6px' }} /> Auto-Dispatch
              </ActionButton>
            </BulkAssignActions>
          </BulkAssignBar>
          <SectionsGrid>
            <OrderSection type="others" style={{ borderTop: '4px solid #3b82f6' }}>
              <SectionHeader><SectionTitle type="others"><FiClock /> Today - Morning</SectionTitle></SectionHeader>
              <OrdersList>{todayMorning && todayMorning.length > 0 ? todayMorning.map(renderOrderCard) : <EmptyState>No morning orders</EmptyState>}</OrdersList>
            </OrderSection>
            <OrderSection type="others" style={{ borderTop: '4px solid #f59e0b' }}>
              <SectionHeader><SectionTitle type="others"><FiClock /> Today - Afternoon</SectionTitle></SectionHeader>
              <OrdersList>{todayAfternoon && todayAfternoon.length > 0 ? todayAfternoon.map(renderOrderCard) : <EmptyState>No afternoon orders</EmptyState>}</OrdersList>
            </OrderSection>
            <OrderSection type="others" style={{ borderTop: '4px solid #8b5cf6' }}>
              <SectionHeader><SectionTitle type="others"><FiClock /> Today - Evening</SectionTitle></SectionHeader>
              <OrdersList>{todayEvening && todayEvening.length > 0 ? todayEvening.map(renderOrderCard) : <EmptyState>No evening orders</EmptyState>}</OrdersList>
            </OrderSection>
            <OrderSection type="others" style={{ borderTop: '4px solid #10b981' }}>
              <SectionHeader><SectionTitle type="others"><FiClock /> Today - Others</SectionTitle></SectionHeader>
              <OrdersList>{todayOther && todayOther.length > 0 ? todayOther.map(renderOrderCard) : <EmptyState>No other today orders</EmptyState>}</OrdersList>
            </OrderSection>
            <OrderSection type="others" style={{ borderTop: '4px solid #6366f1' }}>
              <SectionHeader><SectionTitle type="others"><FiClock /> Tomorrow</SectionTitle></SectionHeader>
              <OrdersList>{tomorrowOrders && tomorrowOrders.length > 0 ? tomorrowOrders.map(renderOrderCard) : <EmptyState>No tomorrow orders</EmptyState>}</OrdersList>
            </OrderSection>
            <OrderSection type="others" style={{ borderTop: '4px solid #94a3b8' }}>
              <SectionHeader><SectionTitle type="others"><FiClock /> Future</SectionTitle></SectionHeader>
              <OrdersList>{futureOrders && futureOrders.length > 0 ? futureOrders.map(renderOrderCard) : <EmptyState>No future orders</EmptyState>}</OrdersList>
            </OrderSection>
          </SectionsGrid>
        </>
      ) : (
        <div style={{ background: 'white', borderRadius: '16px', border: '1px solid #f0f0f0', overflow: 'hidden' }}>
          <div style={{ padding: '20px', background: activeTab === 'completed' ? '#10b981' : '#ef4444', color: 'white' }}>
            <h2 style={{ margin: 0 }}>{activeTab === 'completed' ? 'Completed' : 'Cancelled'} Orders</h2>
          </div>
          <div style={{ maxHeight: '600px', overflowY: 'auto', padding: '10px' }}>
            {allOrders && allOrders.length > 0 ? allOrders.map(renderOrderCard) : <EmptyState>No orders found</EmptyState>}
          </div>
        </div>
      )}

      <AnimatePresence>
        {showModal && selectedOrder && (
          <DeliveryHandoverModal 
            order={selectedOrder}
            onClose={() => setShowModal(false)}
            onComplete={handleMarkDelivered}
            processing={processing}
          />
        )}

        {showQRModal && selectedQRCodeOrder ? (
          <Modal initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <ModalContent initial={{ scale: 0.9 }} animate={{ scale: 1 }} exit={{ scale: 0.9 }} style={{ maxWidth: '400px', textAlign: 'center' }}>
              <CloseBtn onClick={() => setShowQRModal(false)}><FiX /></CloseBtn>
              <ModalHeader><ModalTitle style={{ justifyContent: 'center' }}>Receive Payment</ModalTitle></ModalHeader>
              <ModalBody>
                <div style={{ marginBottom: '20px', fontSize: '1.2rem', fontWeight: '800', color: '#1e293b' }}>
                  Amount to Collect: <span style={{ color: '#10b981', fontSize: '1.5rem' }}>₹{selectedQRCodeOrder.amount}</span>
                </div>
                
                <div style={{ background: '#f8fafc', padding: '20px', borderRadius: '16px', display: 'inline-block', boxShadow: '0 4px 10px rgba(0,0,0,0.05)' }}>
                  <Image 
                    src="/HYDRANT_PAYMENT_QR copy.jpeg" 
                    alt="Payment QR Code" 
                    width={250} 
                    height={250} 
                    style={{ borderRadius: '12px', objectFit: 'contain' }}
                  />
                </div>

                <div style={{ marginTop: '20px', fontSize: '0.9rem', color: '#64748b', fontWeight: '600' }}>
                  Order #{selectedQRCodeOrder.id} <br />
                  Customer: {selectedQRCodeOrder.userName}
                </div>

                <div style={{ marginTop: '25px' }}>
                  <ActionButton 
                    variant="primary" 
                    onClick={() => {
                      setShowQRModal(false);
                      handleDeliveryClick(selectedQRCodeOrder);
                    }} 
                    style={{ width: '100%', justifyContent: 'center', padding: '14px', fontSize: '1rem' }}
                  >
                    Proceed to Deliver <FiCheckCircle size={18} />
                  </ActionButton>
                </div>
              </ModalBody>
            </ModalContent>
          </Modal>
        ) : null}
      </AnimatePresence>
    </Container>
  );
}