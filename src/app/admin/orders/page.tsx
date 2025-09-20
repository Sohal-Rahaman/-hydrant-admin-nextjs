'use client';

import React, { useState, useEffect } from 'react';
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
import { collection, getDocs } from 'firebase/firestore';

// Interfaces
interface Order {
  id: string;
  userId: string;
  userName?: string;
  userPhone?: string;
  status: 'pending' | 'processing' | 'completed' | 'cancelled';
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

const OrderActions = styled.div`display: flex; gap: 8px; margin-top: 15px; flex-wrap: wrap;`;

const ActionBtn = styled.button<{ variant?: string }>`
  padding: 6px 12px; border-radius: 6px; border: none; cursor: pointer;
  display: flex; align-items: center; gap: 6px; font-weight: 500; font-size: 0.8rem;
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
  const [filteredOrders, setFilteredOrders] = useState<Order[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [delivery, setDelivery] = useState({ jarReturned: false, paymentReceived: false, notes: '' });
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [activeTab, setActiveTab] = useState<'open' | 'completed' | 'cancelled'>('open');

  const formatDate = (date: Date | { toDate(): Date } | string | number | null | undefined): string => {
    if (!date) return 'N/A';
    try {
      if (typeof date === 'string') return new Date(date).toLocaleString();
      if (date instanceof Date) return date.toLocaleString();
      if (typeof date === 'object' && 'toDate' in date) return date.toDate().toLocaleString();
      return 'Invalid Date';
    } catch { return 'Invalid Date'; }
  };

  const getUserDetails = (userIdentifier: string) => {
    // Try to find user by userId first, then by customerId
    return users.find(user => 
      user.id === userIdentifier || 
      user.customerId === userIdentifier ||
      user.userId === userIdentifier
    );
  };

  useEffect(() => {
    setLoading(true);
    console.log('🔍 Setting up Firebase orders subscription...');

    const unsubscribeOrders = subscribeToCollection('orders', (snapshot) => {
      console.log('📦 Firebase orders snapshot received:', {
        totalDocs: snapshot.docs.length,
        isEmpty: snapshot.empty,
        size: snapshot.size
      });
      
      if (snapshot.empty) {
        console.warn('⚠️ Orders collection is empty or not found');
        setOrders([]);
        setFilteredOrders([]);
        return;
      }

      try {
        const ordersData = snapshot.docs.map((doc, index) => {
          const data = doc.data();
          console.log(`📋 Order ${index + 1}:`, {
            id: doc.id,
            rawData: data,
            customerName: data.customerName,
            customerPhone: data.customerPhone,
            customerEmail: data.customerEmail,
            customerId: data.customerId,
            userId: data.userId,
            deliveryAddress: data.deliveryAddress,
            items: data.items,
            status: data.status,
            orderNumber: data.orderNumber,
            total: data.total
          });
          
          // Extract pincode from fullAddress string
          const extractPincodeFromAddress = (address: string): string => {
            if (!address) return 'UNKNOWN';
            // Look for 6-digit pincode pattern in address
            const pincodeMatch = address.match(/\b(\d{6})\b/);
            return pincodeMatch ? pincodeMatch[1] : 'UNKNOWN';
          };
          
          // More flexible data mapping to handle actual Firebase structure
          const mappedOrder: Order = {
            id: doc.id,
            userId: data.userId || data.customerId || '',
            userName: data.customerName || data.userName || '',
            userPhone: data.customerPhone || data.phoneNumber || '',
            status: data.status || 'pending',
            quantity: data.items?.[0]?.quantity || data.quantity || 1,
            amount: data.total || data.amount || (data.items?.[0]?.quantity || 1) * 37,
            address: {
              street: data.deliveryAddress?.fullAddress || '',
              city: '',
              pincode: extractPincodeFromAddress(data.deliveryAddress?.fullAddress || ''),
              full: data.deliveryAddress?.fullAddress || ''
            },
            createdAt: data.createdAt || data.orderDate || data.timestamp || new Date(),
            orderType: data.orderType || (data.subscriptionId ? 'subscription' : 'regular')
          };
          
          // Normalize status values - handle any variations that might exist in the database
          const statusMap: Record<string, Order['status']> = {
            'pending': 'pending',
            'processing': 'processing',
            'completed': 'completed',
            'cancelled': 'cancelled',
            'delivered': 'completed', // Map delivered to completed as per previous fixes
            'canceled': 'cancelled',  // Handle common typo
          };
          
          if (mappedOrder.status in statusMap) {
            mappedOrder.status = statusMap[mappedOrder.status];
          } else if (!['pending', 'processing', 'completed', 'cancelled'].includes(mappedOrder.status)) {
            console.warn('⚠️ Unexpected order status, defaulting to "pending":', {
              orderId: doc.id,
              status: mappedOrder.status,
              rawData: data
            });
            mappedOrder.status = 'pending';
          }
          
          // Debug log for order status mapping
          console.log(`📊 Order Status Debug for Order ${index + 1}:`, {
            orderId: doc.id,
            firebaseStatus: data.status,
            mappedStatus: mappedOrder.status,
            isCompleted: mappedOrder.status === 'completed',
            isCancelled: mappedOrder.status === 'cancelled'
          });
          
          // Debug log for subscription order detection
          if (data.subscriptionId || data.orderType === 'subscription') {
            console.log('🔄 Subscription Order Detected:', {
              orderId: doc.id,
              subscriptionId: data.subscriptionId,
              orderType: data.orderType,
              userId: mappedOrder.userId,
              status: mappedOrder.status
            });
          }
          
          // Debug log for address mapping
          console.log(`🏠 Address Debug for Order ${index + 1}:`, {
            orderId: doc.id,
            customerName: data.customerName,
            rawDeliveryAddress: data.deliveryAddress,
            fullAddressFromFirebase: data.deliveryAddress?.fullAddress,
            mappedAddressFull: mappedOrder.address.full,
            allPossibleAddressFields: {
              'deliveryAddress.fullAddress': data.deliveryAddress?.fullAddress,
              'deliveryAddress.address': data.deliveryAddress?.address,
              'deliveryAddress.street': data.deliveryAddress?.street,
              'address': data.address,
              'fullAddress': data.fullAddress,
              'userAddress': data.userAddress,
              'shippingAddress': data.shippingAddress
            }
          });
          
          console.log(`✅ Mapped Order ${index + 1}:`, mappedOrder);
          return mappedOrder;
        }).filter((order) => {
          // Only filter out orders that are completely invalid (no ID)
          const isValid = order.id;
          if (!isValid) {
            console.warn('⚠️ Filtering out invalid order (no ID):', order);
          }
          return isValid;
        }).sort((a, b) => {
          const getTimestamp = (date: Date | { toDate(): Date } | string): number => {
            try {
              if (typeof date === 'string') return new Date(date).getTime();
              if (date instanceof Date) return date.getTime();
              if (typeof date === 'object' && 'toDate' in date && typeof date.toDate === 'function') {
                return date.toDate().getTime();
              }
              return new Date().getTime();
            } catch {
              return new Date().getTime();
            }
          };
          return getTimestamp(a.createdAt) - getTimestamp(b.createdAt);
        });
        
        console.log('✅ Processed orders data:', {
          totalOrders: ordersData.length,
          orderStatuses: ordersData.map((o) => o.status),
          pincodes: ordersData.map((o) => o.address.pincode),
          uniquePincodes: [...new Set(ordersData.map((o) => o.address.pincode))],
          dumDumCount: ordersData.filter((o) => o.address.pincode === '700030').length,
          saltLakeCount: ordersData.filter((o) => o.address.pincode === '700074').length,
          subscriptionCount: ordersData.filter((o) => o.orderType === 'subscription').length,
          nonDeliveredCount: ordersData.filter((o) => o.status !== 'completed').length,
          otherPincodesCount: ordersData.filter((o) => 
            o.address.pincode !== '700030' && 
            o.address.pincode !== '700074' && 
            o.orderType !== 'subscription'
          ).length,
          otherPincodes: [...new Set(ordersData
            .filter((o) => o.address.pincode !== '700030' && o.address.pincode !== '700074')
            .map((o) => o.address.pincode)
          )]
        });
        
        setOrders(ordersData);
        setFilteredOrders(ordersData);
      } catch (error) {
        console.error('❌ Error processing orders data:', error);
        setOrders([]);
        setFilteredOrders([]);
      }
    }, [], (error) => {
      console.error('❌ Firebase orders subscription error:', error);
      alert(`Error connecting to Firebase orders: ${error.message}. Check console for details.`);
    });

    const unsubscribeUsers = subscribeToCollection('users', (snapshot) => {
      console.log('👥 Firebase users snapshot received:', {
        totalUsers: snapshot.docs.length,
        isEmpty: snapshot.empty
      });
      
      try {
        const usersData = snapshot.docs.map(doc => ({ 
          id: doc.id, 
          ...doc.data(),
          phoneNumber: doc.data().phoneNumber || doc.data().phone || '',
          wallet_balance: doc.data().wallet_balance || doc.data().walletBalance || 0, // Use wallet_balance for user app compatibility
          jars_occupied: doc.data().jars_occupied || doc.data().holdJars || doc.data().occupiedJars || 0 // Use jars_occupied for user app compatibility
        })) as User[];
        console.log('✅ Processed users data:', usersData.length, 'users');
        setUsers(usersData);
      } catch (error) {
        console.error('❌ Error processing users data:', error);
        setUsers([]);
      }
    }, [], (error) => {
      console.error('❌ Firebase users subscription error:', error);
      setUsers([]);
    });

    setTimeout(() => setLoading(false), 2000);

    return () => { unsubscribeOrders(); unsubscribeUsers(); };
  }, []);

  useEffect(() => {
    let filtered = orders;
    
    // Debug log for filtering
    console.log('🔍 Filtering orders for tab:', activeTab, {
      totalOrders: orders.length,
      completedCount: orders.filter(o => o.status === 'completed').length,
      cancelledCount: orders.filter(o => o.status === 'cancelled').length,
      pendingCount: orders.filter(o => o.status === 'pending').length,
      processingCount: orders.filter(o => o.status === 'processing').length
    });
    
    // Filter by tab first
    if (activeTab === 'open') {
      // Only show pending and processing orders (exclude delivered and cancelled)
      filtered = orders.filter(order => 
        order.status === 'pending' || order.status === 'processing'
      );
      console.log('📦 Open orders filtered:', filtered.length);
    } else if (activeTab === 'completed') {
      // Only show completed orders
      filtered = orders.filter(order => {
        const isCompleted = order.status === 'completed';
        console.log(`✅ Order ${order.id} status check:`, {
          status: order.status,
          isCompleted: isCompleted
        });
        return isCompleted;
      });
      console.log('✅ Completed orders filtered:', filtered.length);
    } else if (activeTab === 'cancelled') {
      // Only show cancelled orders
      filtered = orders.filter(order => {
        const isCancelled = order.status === 'cancelled';
        console.log(`❌ Order ${order.id} status check:`, {
          status: order.status,
          isCancelled: isCancelled
        });
        return isCancelled;
      });
      console.log('❌ Cancelled orders filtered:', filtered.length);
    }
    
    // Then apply search filter if there's a search term
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

  // Filter orders based on active tab and organize by sections
  const getOrdersBySection = () => {
    console.log('🧮 Getting orders by section for tab:', activeTab, {
      filteredOrdersCount: filteredOrders.length,
      completedCount: filteredOrders.filter(o => o.status === 'completed').length,
      cancelledCount: filteredOrders.filter(o => o.status === 'cancelled').length
    });
    
    if (activeTab === 'open') {
      // For open orders: organize by pincode (only pending/processing)
      const dumDumOrders = filteredOrders.filter(o => o.address.pincode === '700030' && (o.status === 'pending' || o.status === 'processing'));
      const saltLakeOrders = filteredOrders.filter(o => o.address.pincode === '700074' && (o.status === 'pending' || o.status === 'processing'));
      const subscriptionOrders = filteredOrders.filter(o => o.orderType === 'subscription' && (o.status === 'pending' || o.status === 'processing'));
      const otherOrders = filteredOrders.filter(o => 
        o.address.pincode !== '700030' && 
        o.address.pincode !== '700074' && 
        o.orderType !== 'subscription' &&
        (o.status === 'pending' || o.status === 'processing')
      );
      
      console.log('📂 Open orders sections:', {
        dumDum: dumDumOrders.length,
        saltLake: saltLakeOrders.length,
        subscription: subscriptionOrders.length,
        other: otherOrders.length
      });
      
      return { dumDumOrders, saltLakeOrders, subscriptionOrders, otherOrders };
    } else {
      // For completed/cancelled: show all in single list
      console.log('📂 Completed/Cancelled orders section:', {
        allOrders: filteredOrders.length,
        orders: filteredOrders.map(o => ({ id: o.id, status: o.status }))
      });
      
      return {
        allOrders: filteredOrders,
        dumDumOrders: [],
        saltLakeOrders: [],
        subscriptionOrders: [],
        otherOrders: []
      };
    }
  };
  
  const { dumDumOrders, saltLakeOrders, subscriptionOrders, otherOrders, allOrders } = getOrdersBySection();
  
  // Get counts for tab badges
  const openOrdersCount = orders.filter(o => o.status === 'pending' || o.status === 'processing').length;
  const completedOrdersCount = orders.filter(o => o.status === 'completed').length;
  const cancelledOrdersCount = orders.filter(o => o.status === 'cancelled').length;
  
  // Debug log for order counts
  console.log('🔢 Order counts:', {
    open: openOrdersCount,
    completed: completedOrdersCount,
    cancelled: cancelledOrdersCount,
    total: orders.length
  });

  const handleCall = (phone: string) => phone && window.open(`tel:${phone}`, '_self');
  
  const handleNavigation = (order: Order) => {
    // Debug: Log all available address data for this specific order
    console.log('🔍 DETAILED ADDRESS DEBUG:', {
      orderId: order.id,
      customerName: order.userName,
      'order.address': order.address,
      'order.address.full': order.address.full,
      'order.address.street': order.address.street,
      'order.address.city': order.address.city,
      'order.address.pincode': order.address.pincode
    });
    
    // Use the exact full address from Firebase, prioritizing the complete address string
    let destinationAddress = '';
    
    // First priority: Use the full address if available (this is the exact address saved by user)
    if (order.address.full && order.address.full.trim()) {
      destinationAddress = order.address.full.trim();
      console.log('✅ Using FULL ADDRESS from Firebase:', destinationAddress);
    }
    // Fallback: Construct from parts only if full address is not available
    else if (order.address.street && order.address.city && order.address.pincode) {
      destinationAddress = `${order.address.street}, ${order.address.city} - ${order.address.pincode}`;
      console.log('⚠️ Using CONSTRUCTED ADDRESS:', destinationAddress);
    }
    // Last resort: Use pincode only if no other address data is available
    else if (order.address.pincode) {
      destinationAddress = order.address.pincode;
      console.log('⚠️ Using PINCODE ONLY:', destinationAddress);
    }
    else {
      alert('❌ No valid address found for this order. Cannot navigate.');
      console.error('❌ No address data available for order:', order);
      return;
    }
    
    // Additional validation - ensure we're not getting a transformed address
    if (destinationAddress.includes('S Sinthee Rd') || destinationAddress.includes('Biswanath Colony')) {
      console.error('❌ DETECTED TRANSFORMED ADDRESS! Original expected but got transformed:', destinationAddress);
      alert('❌ Error: Address appears to be transformed. Please check the original data in Firebase.');
      return;
    }
    
    // Log the exact address being used for navigation
    console.log('🗺️ Final navigation address:', {
      orderId: order.id,
      finalDestination: destinationAddress,
      addressLength: destinationAddress.length
    });
    
    // Validate address has meaningful content (not just pincode)
    if (destinationAddress.length < 6) {
      alert('❌ Address appears to be incomplete. Please check the order details.');
      return;
    }
    
    // Show confirmation to user before navigation
    const confirmNavigation = confirm(`Navigate to this address?

${destinationAddress}

Click OK to open Google Maps with this exact address.`);
    if (!confirmNavigation) {
      return;
    }
    
    // Try to get user's current location and show route
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const { latitude, longitude } = position.coords;
          console.log('📍 Current location:', { latitude, longitude });
          console.log('🎯 Destination:', destinationAddress);
          
          // Open Google Maps with directions from current location to exact delivery address
          const mapsUrl = `https://www.google.com/maps/dir/${latitude},${longitude}/${encodeURIComponent(destinationAddress)}`;
          console.log('🗺️ Opening Maps URL:', mapsUrl);
          window.open(mapsUrl, '_blank');
        },
        (error) => {
          console.warn('⚠️ Geolocation failed:', error.message);
          // Fallback: Open Google Maps with exact destination address only
          const mapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(destinationAddress)}`;
          console.log('🗺️ Opening Maps URL (fallback):', mapsUrl);
          window.open(mapsUrl, '_blank');
        },
        {
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 300000 // 5 minutes
        }
      );
    } else {
      // Fallback for browsers without geolocation support
      console.log('🗺️ Geolocation not supported, opening destination only');
      const mapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(destinationAddress)}`;
      console.log('🗺️ Opening Maps URL (no geolocation):', mapsUrl);
      window.open(mapsUrl, '_blank');
    }
  };

  const handleDeliveryClick = (order: Order) => {
    setSelectedOrder(order);
    setDelivery({ jarReturned: false, paymentReceived: false, notes: '' });
    setShowModal(true);
  };

  const testFirebaseConnection = async () => {
    console.log('🧪 Testing Firebase connection...');
    try {
      console.log('Firebase config check:', {
        hasDB: !!db,
        apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY ? 'SET' : 'MISSING',
        projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || 'MISSING'
      });
      
      const ordersRef = collection(db, 'orders');
      const snapshot = await getDocs(ordersRef);
      
      console.log('✅ Firebase connection test results:', {
        totalDocs: snapshot.docs.length,
        isEmpty: snapshot.empty
      });
      
      // Show first 3 orders to understand data structure
      const sampleOrders = snapshot.docs.slice(0, 3).map(doc => ({
        id: doc.id,
        data: doc.data()
      }));
      
      console.log('📋 Sample order documents:', sampleOrders);
      
      // Analyze order statuses
      const orderStatuses = snapshot.docs.map(doc => doc.data().status || 'pending');
      const statusCounts: Record<string, number> = {};
      orderStatuses.forEach(status => {
        statusCounts[status] = (statusCounts[status] || 0) + 1;
      });
      
      console.log('📊 Order status distribution:', statusCounts);
      
      // Check for different possible field names
      const firstOrder = snapshot.docs[0]?.data();
      if (firstOrder) {
        console.log('🔍 First order field analysis:', {
          hasStatus: 'status' in firstOrder,
          hasUserId: 'userId' in firstOrder,
          hasCustomerId: 'customerId' in firstOrder,
          hasUserName: 'userName' in firstOrder,
          hasCustomerName: 'customerName' in firstOrder,
          hasPhone: 'userPhone' in firstOrder,
          hasPhoneNumber: 'phoneNumber' in firstOrder,
          hasAddress: 'address' in firstOrder,
          hasDeliveryAddress: 'deliveryAddress' in firstOrder,
          hasPincode: 'pincode' in firstOrder,
          hasQuantity: 'quantity' in firstOrder,
          hasAmount: 'amount' in firstOrder,
          hasCreatedAt: 'createdAt' in firstOrder,
          hasOrderType: 'orderType' in firstOrder,
          hasSubscriptionId: 'subscriptionId' in firstOrder,
          allFields: Object.keys(firstOrder)
        });
      }
      
      // Show all unique statuses found in the database
      const uniqueStatuses = [...new Set(orderStatuses)];
      console.log('🏷️ Unique order statuses in database:', uniqueStatuses);
      
      alert(`Firebase test: Found ${snapshot.docs.length} orders in database
Statuses: ${Object.entries(statusCounts).map(([status, count]) => `${status}(${count})`).join(', ')}`);
    } catch (error) {
      console.error('❌ Firebase connection test failed:', error);
      alert(`Firebase connection failed: ${error}`);
    }
  };

  const handleMarkDelivered = async () => {
    if (!selectedOrder) return;
    setProcessing(true);
    try {
      // Try multiple user lookup strategies
      const user = getUserDetails(selectedOrder.userId);
      
      if (!user) {
        console.warn('User not found with userId:', selectedOrder.userId);
        console.log('Available users:', users.map(u => ({ id: u.id, customerId: u.customerId, name: u.name })));
        console.log('Order details:', selectedOrder);
        
        // If no user found, we can still process the order but without user updates
        console.log('Proceeding with order update only (no user wallet/jar updates)');
      }

      let walletChange = 0;
      let holdJarsChange = 0;

      // Always deduct the order amount from wallet when order is completed
      walletChange = -(selectedOrder.quantity * 37);
      
      // If jar is not returned, add to hold jars
      if (!delivery.jarReturned) {
        holdJarsChange = selectedOrder.quantity;
      }
      
      // If payment is received, no additional changes needed
      // If payment is not received, wallet balance will be negative (already deducted above)

      await updateDocument('orders', selectedOrder.id, {
        status: 'completed',
        deliveredAt: new Date(),
        deliveryNotes: delivery.notes,
        jarReturned: delivery.jarReturned,
        paymentReceived: delivery.paymentReceived
      });

      if ((walletChange !== 0 || holdJarsChange !== 0) && user) {
        const updates: any = { updatedAt: new Date() };
        if (walletChange !== 0) updates.wallet_balance = user.wallet_balance + walletChange; // Use wallet_balance for user app compatibility
        if (holdJarsChange !== 0) updates.jars_occupied = user.jars_occupied + holdJarsChange; // Use jars_occupied for user app compatibility
        await updateDocument('users', user.id, updates);
        console.log('User data updated successfully:', updates);
      } else if (walletChange !== 0 || holdJarsChange !== 0) {
        console.warn('Cannot update user data - user not found. Order marked as delivered only.');
      }

      setShowModal(false);
    } catch (error) {
      console.error('Error:', error);
      alert('Error updating order.');
    } finally {
      setProcessing(false);
    }
  };

  const renderOrderCard = (order: Order) => {
    // Debug log for order rendering
    console.log('📄 Rendering order card:', {
      orderId: order.id,
      status: order.status,
      type: order.orderType,
      amount: order.amount,
      tab: activeTab
    });
    
    const user = getUserDetails(order.userId);
    const name = order.userName || user?.name || 'Unknown Customer';
    const phone = order.userPhone || user?.phoneNumber || 'N/A';
    
    // Debug log for missing users
    if (!user && order.userId) {
      console.log('User not found for order:', {
        orderId: order.id,
        orderUserId: order.userId,
        orderUserName: order.userName,
        orderUserPhone: order.userPhone
      });
    }
    
    return (
      <OrderCard key={order.id} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
        <OrderHeader>
          <OrderInfo>
            <OrderCustomer>
              <FiUser size={16} />
              {name}
              {!user && order.userId && (
                <span style={{
                  background: '#fbbf24',
                  color: '#92400e',
                  fontSize: '0.7rem',
                  padding: '2px 6px',
                  borderRadius: '4px',
                  fontWeight: '600',
                  marginLeft: '8px'
                }}>
                  USER NOT FOUND
                </span>
              )}
            </OrderCustomer>
            <OrderDetails>
              <div><FiPhone size={14} style={{ marginRight: '6px' }} />{phone}</div>
              <div><FiMapPin size={14} style={{ marginRight: '6px' }} />
                {order.address.full || `${order.address.street}, ${order.address.city} - ${order.address.pincode}`}
              </div>
              <div><FiClock size={14} style={{ marginRight: '6px' }} />{formatDate(order.createdAt)}</div>
              {order.orderType === 'subscription' && <div>🔄 Subscription Order</div>}
              <div style={{ fontSize: '0.85rem', color: '#666', marginTop: '4px' }}>Pincode: {order.address.pincode}</div>
            </OrderDetails>
          </OrderInfo>
          <div style={{ textAlign: 'right' }}>
            <OrderStatus status={order.status}>{order.status}</OrderStatus>
            <div style={{ margin: '8px 0', fontSize: '1.1rem', fontWeight: '700', color: '#10b981' }}>₹{order.amount}</div>
            <div style={{ fontSize: '0.9rem', color: '#666' }}>Qty: {order.quantity}</div>
          </div>
        </OrderHeader>
        
        <OrderActions>
          <ActionBtn variant="call" onClick={() => handleCall(phone)} disabled={phone === 'N/A'}>
            <FiPhone size={14} />Call
          </ActionBtn>
          <ActionBtn variant="navigate" onClick={() => handleNavigation(order)} title="Get directions from current location">
            <FiNavigation size={14} />Get Route
          </ActionBtn>
          <ActionBtn variant="deliver" onClick={() => handleDeliveryClick(order)}>
            <FiCheckCircle size={14} />Complete Order
          </ActionBtn>
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
          <OrdersLogo 
            src="/logo.jpeg" 
            alt="Hydrant Logo"
            width={45}
            height={45}
          />
          <Title><FiPackage />Orders Management</Title>
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
          <ActionButton variant="primary" onClick={() => triggerSubscriptionOrders()}>
            <FiRefreshCw />Generate Subscription Orders
          </ActionButton>
          <ActionButton onClick={testFirebaseConnection}>
            <FiInfo />Test Firebase Connection
          </ActionButton>
          <ActionButton onClick={() => window.location.reload()}>
            <FiRefreshCw />Refresh Page
          </ActionButton>
          <ActionButton onClick={() => window.open('/admin/test-orders', '_blank')}>
            <FiInfo />Debug Orders
          </ActionButton>
        </div>
      </Header>

      <div style={{ background: '#e0f2fe', border: '1px solid #0891b2', color: '#0c4a6e', padding: '15px', borderRadius: '10px', marginBottom: '20px', display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
        <FiInfo />
        <div>
          <strong>Smart Order Management:</strong> Orders organized by status and delivery areas, sorted by time (oldest first).
          <br />• <strong>Open Orders:</strong> {openOrdersCount} pending/processing orders across all areas
          <br />• <strong>Completed Orders:</strong> {completedOrdersCount} successfully completed orders
          <br />• <strong>Cancelled Orders:</strong> {cancelledOrdersCount} cancelled orders
          {activeTab === 'open' && (
            <>
              <br />• <strong>700030 (Dum Dum):</strong> {dumDumOrders?.length || 0} pending orders
              <br />• <strong>700074 (Salt Lake City):</strong> {saltLakeOrders?.length || 0} pending orders  
              <br />• <strong>Subscription Orders:</strong> {subscriptionOrders?.length || 0} auto-generated orders
              <br />• <strong>Other Areas:</strong> {otherOrders?.length || 0} orders from different locations
            </>
          )}
        </div>
      </div>

      <TabContainer>
        <Tab 
          $active={activeTab === 'open'} 
          onClick={() => setActiveTab('open')}
        >
          📦 Open Orders
          {activeTab === 'open' ? (
            <TabBadge>{openOrdersCount}</TabBadge>
          ) : (
            <InactiveTabBadge>{openOrdersCount}</InactiveTabBadge>
          )}
        </Tab>
        <Tab 
          $active={activeTab === 'completed'} 
          onClick={() => setActiveTab('completed')}
        >
          ✅ Completed Orders
          {activeTab === 'completed' ? (
            <TabBadge>{completedOrdersCount}</TabBadge>
          ) : (
            <InactiveTabBadge>{completedOrdersCount}</InactiveTabBadge>
          )}
        </Tab>
        <Tab 
          $active={activeTab === 'cancelled'} 
          onClick={() => setActiveTab('cancelled')}
        >
          ❌ Cancelled Orders
          {activeTab === 'cancelled' ? (
            <TabBadge>{cancelledOrdersCount}</TabBadge>
          ) : (
            <InactiveTabBadge>{cancelledOrdersCount}</InactiveTabBadge>
          )}
        </Tab>
      </TabContainer>

      {activeTab === 'open' ? (
        // Open Orders: Show organized by pincode sections
        <SectionsGrid>
          <OrderSection type="dum-dum">
            <SectionHeader>
              <SectionTitle type="dum-dum"><FiMapPin />700030 - Dum Dum</SectionTitle>
              <div style={{ color: '#666', fontSize: '0.9rem' }}>{dumDumOrders?.length || 0} pending orders</div>
            </SectionHeader>
            <OrdersList>
              {dumDumOrders && dumDumOrders.length > 0 ? dumDumOrders.map(renderOrderCard) : 
                <EmptyState><FiPackage size={24} /><div>No orders in this area</div></EmptyState>}
            </OrdersList>
          </OrderSection>

          <OrderSection type="salt-lake">
            <SectionHeader>
              <SectionTitle type="salt-lake"><FiMapPin />700074 - Salt Lake City</SectionTitle>
              <div style={{ color: '#666', fontSize: '0.9rem' }}>{saltLakeOrders?.length || 0} pending orders</div>
            </SectionHeader>
            <OrdersList>
              {saltLakeOrders && saltLakeOrders.length > 0 ? saltLakeOrders.map(renderOrderCard) : 
                <EmptyState><FiPackage size={24} /><div>No orders in this area</div></EmptyState>}
            </OrdersList>
          </OrderSection>

          <OrderSection type="subscription">
            <SectionHeader>
              <SectionTitle type="subscription"><FiRefreshCw />Subscription Orders</SectionTitle>
              <div style={{ color: '#666', fontSize: '0.9rem' }}>{subscriptionOrders?.length || 0} auto-generated</div>
            </SectionHeader>
            <OrdersList>
              {subscriptionOrders && subscriptionOrders.length > 0 ? subscriptionOrders.map(renderOrderCard) : 
                <EmptyState><FiRefreshCw size={24} /><div>No subscription orders</div></EmptyState>}
            </OrdersList>
          </OrderSection>

          <OrderSection type="others">
            <SectionHeader>
              <SectionTitle type="others"><FiPackage />Other Areas</SectionTitle>
              <div style={{ color: '#666', fontSize: '0.9rem' }}>{otherOrders?.length || 0} orders from various locations</div>
            </SectionHeader>
            <OrdersList>
              {otherOrders && otherOrders.length > 0 ? otherOrders.map(renderOrderCard) : 
                <EmptyState><FiPackage size={24} /><div>No orders from other areas</div></EmptyState>}
            </OrdersList>
          </OrderSection>
        </SectionsGrid>
      ) : (
        // Completed/Cancelled Orders: Show single list
        <div style={{ 
          background: 'white', 
          borderRadius: '16px', 
          boxShadow: '0 4px 20px rgba(0, 0, 0, 0.08)',
          border: '1px solid #f0f0f0',
          overflow: 'hidden'
        }}>
          <div style={{
            padding: '20px 25px 15px 25px', 
            borderBottom: '1px solid #f0f0f0',
            background: activeTab === 'completed' ? 'linear-gradient(135deg, #10b981 0%, #059669 100%)' : 
                        'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)',
            color: 'white'
          }}>
            <h2 style={{ margin: '0 0 8px 0', fontSize: '1.3rem', fontWeight: '700', display: 'flex', alignItems: 'center', gap: '12px' }}>
              {activeTab === 'completed' ? (
                <><FiCheckCircle />Completed Orders</>
              ) : (
                <><FiX />Cancelled Orders</>
              )}
            </h2>
            <div style={{ fontSize: '0.9rem', opacity: '0.9' }}>
              {allOrders?.length || 0} {activeTab} orders
            </div>
          </div>
          <div style={{ maxHeight: '600px', overflowY: 'auto', padding: '10px' }}>
            {allOrders && allOrders.length > 0 ? (
              <>
                <div style={{ marginBottom: '10px', fontSize: '0.9rem', color: '#666' }}>
                  Showing {allOrders.length} {activeTab} orders
                </div>
                {allOrders.map(renderOrderCard)}
              </>
            ) : (
              <EmptyState>
                {activeTab === 'completed' ? (
                  <><FiCheckCircle size={24} /><div>No completed orders found</div></>
                ) : (
                  <><FiX size={24} /><div>No cancelled orders found</div></>
                )}
                <div style={{ marginTop: '10px', fontSize: '0.9rem' }}>
                  {activeTab === 'completed' 
                    ? 'Completed orders will appear here after delivery confirmation' 
                    : 'Cancelled orders will appear here when customers cancel their orders'}
                </div>
              </EmptyState>
            )}
          </div>
        </div>
      )}

      <AnimatePresence>
        {showModal && selectedOrder && (
          <Modal initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <ModalContent initial={{ scale: 0.9 }} animate={{ scale: 1 }} exit={{ scale: 0.9 }}>
              <CloseBtn onClick={() => setShowModal(false)}><FiX /></CloseBtn>
              <ModalHeader>
                <ModalTitle><FiCheckCircle />Mark Order as Completed</ModalTitle>
              </ModalHeader>
              <ModalBody>
                <div style={{ marginBottom: '20px', padding: '15px', background: '#f9fafb', borderRadius: '8px' }}>
                  <strong>Order Details:</strong><br />
                  Customer: {selectedOrder.userName || 'Unknown'}<br />
                  Quantity: {selectedOrder.quantity} jars<br />
                  Amount: ₹{selectedOrder.amount}
                </div>

                <CheckboxGroup>
                  <Checkbox 
                    type="checkbox" 
                    checked={delivery.jarReturned}
                    onChange={(e) => setDelivery(prev => ({ ...prev, jarReturned: e.target.checked }))}
                  />
                  <Label>Jar returned by customer</Label>
                </CheckboxGroup>

                <CheckboxGroup>
                  <Checkbox 
                    type="checkbox" 
                    checked={delivery.paymentReceived}
                    onChange={(e) => setDelivery(prev => ({ ...prev, paymentReceived: e.target.checked }))}
                  />
                  <Label>Payment received from customer</Label>
                </CheckboxGroup>

                {/* Payment QR Code - shown when payment is not yet received */}
                {!delivery.paymentReceived && (
                  <div style={{ 
                    marginTop: '20px', 
                    padding: '15px', 
                    background: '#f0f9ff', 
                    borderRadius: '8px', 
                    border: '1px solid #bae6fd',
                    textAlign: 'center'
                  }}>
                    <h4 style={{ margin: '0 0 10px 0', color: '#0369a1' }}>
                      <FiDollarSign style={{ marginRight: '8px' }} />
                      Payment QR Code
                    </h4>
                    <p style={{ fontSize: '0.9rem', color: '#334155', marginBottom: '15px' }}>
                      Scan this QR code to receive payment from customer
                    </p>
                    <Image 
                      src="/paymentcode.png" 
                      alt="Payment QR Code" 
                      width={150} 
                      height={150}
                      style={{ 
                        borderRadius: '8px', 
                        border: '1px solid #cbd5e1',
                        margin: '0 auto'
                      }}
                    />
                    <p style={{ 
                      fontSize: '0.8rem', 
                      color: '#64748b', 
                      marginTop: '10px',
                      fontStyle: 'italic'
                    }}>
                      Amount: ₹{selectedOrder?.amount || 0}
                    </p>
                  </div>
                )}

                <div style={{ margin: '20px 0' }}>
                  <Label>Delivery Notes:</Label>
                  <TextArea 
                    placeholder="Add any delivery notes..."
                    value={delivery.notes}
                    onChange={(e) => setDelivery(prev => ({ ...prev, notes: e.target.value }))}
                  />
                </div>

                {/* Delivery Logic Preview */}
                <div style={{ 
                  padding: '15px', 
                  borderRadius: '8px', 
                  marginBottom: '20px',
                  background: delivery.jarReturned && delivery.paymentReceived ? '#d1fae5' : 
                    !delivery.jarReturned ? '#fef3c7' : '#fee2e2',
                  color: delivery.jarReturned && delivery.paymentReceived ? '#065f46' : 
                    !delivery.jarReturned ? '#92400e' : '#991b1b'
                }}>
                  <strong>Result:</strong> {
                    `Deduct ₹${selectedOrder.quantity * 37} from wallet balance` +
                    (!delivery.jarReturned ? ` and add ${selectedOrder.quantity} jar(s) to hold jars` : '')
                  }
                </div>

                <div style={{ display: 'flex', gap: '12px' }}>
                  <ActionButton variant="primary" onClick={handleMarkDelivered} disabled={processing}>
                    <FiCheckCircle />{processing ? 'Processing...' : 'Confirm Completion'}
                  </ActionButton>
                  <ActionButton onClick={() => setShowModal(false)}>Cancel</ActionButton>
                </div>
              </ModalBody>
            </ModalContent>
          </Modal>
        )}
      </AnimatePresence>
    </Container>
  );
}