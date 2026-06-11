'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import styled from 'styled-components';
import { 
  FiArrowLeft, FiBriefcase, FiTruck, FiFileText, FiUsers, 
  FiSettings, FiAlertCircle, FiCheckCircle, FiClock, 
  FiPlus, FiDollarSign, FiBox, FiActivity, FiSearch,
  FiX, FiCamera, FiChevronRight, FiAlertTriangle, FiTrash2, FiDownload
} from 'react-icons/fi';
import * as XLSX from 'xlsx';
import { getClientById, getLedgerEntries, getClientOrders, recordHandover, generateMonthlyStatement } from '@/lib/b2bService';
import { B2BClient, B2BLedgerEntry } from '@/types/b2b';
import { format, startOfMonth, endOfMonth, parseISO, isSameMonth } from 'date-fns';
import { Html5Qrcode } from 'html5-qrcode';
import { assignJarToCustomer, returnJar, db, getAllAdmins, StaffMember } from '@/lib/firebase';
import { doc, getDoc, setDoc, deleteDoc, addDoc, collection as fsCollection, Timestamp, updateDoc } from 'firebase/firestore';
import { useAuth } from '@/context/AuthContext';

const Container = styled.div`
  padding: 40px;
  max-width: 1440px;
  margin: 0 auto;
  color: #020617;
  font-family: 'Plus Jakarta Sans', 'Fira Sans', sans-serif;
`;

const Header = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 32px;
`;

const BackButton = styled.button`
  background: white;
  border: 1px solid #e2e8f0;
  color: #64748b;
  padding: 10px 16px;
  border-radius: 12px;
  display: flex;
  align-items: center;
  gap: 8px;
  cursor: pointer;
  font-weight: 700;
  transition: all 0.2s;

  &:hover {
    background: #f8fafc;
    color: #020617;
    border-color: #cbd5e1;
  }
`;

const ClientTitle = styled.div`
  margin-top: 16px;
  
  h1 {
    font-size: 3.2rem;
    font-weight: 800;
    margin-bottom: 8px;
    letter-spacing: -0.04em;
    color: #020617;
  }

  p {
    color: #475569;
    font-family: 'Fira Code', monospace;
    font-size: 1rem;
    font-weight: 600;
    letter-spacing: 0.05em;
  }
`;

const Badge = styled.span<{ $type?: 'active' | 'suspended' | 'pending' }>`
  padding: 6px 14px;
  border-radius: 99px;
  font-size: 0.75rem;
  font-weight: 800;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  background: ${props => {
    switch(props.$type) {
      case 'active': return '#ecfdf5';
      case 'suspended': return '#fef2f2';
      default: return '#fffbeb';
    }
  }};
  color: ${props => {
    switch(props.$type) {
      case 'active': return '#065f46';
      case 'suspended': return '#991b1b';
      default: return '#92400e';
    }
  }};
  border: 1px solid ${props => {
    switch(props.$type) {
      case 'active': return '#10b981';
      case 'suspended': return '#ef4444';
      default: return '#f59e0b';
    }
  }};
`;

const StatusBadge = styled.span<{ $status: string }>`
  padding: 4px 12px;
  border-radius: 20px;
  font-size: 0.75rem;
  font-weight: 800;
  text-transform: uppercase;
  background: ${props => props.$status === 'active' ? '#ecfdf5' : '#fff7ed'};
  color: ${props => props.$status === 'active' ? '#065f46' : '#9a3412'};
  border: 1px solid ${props => props.$status === 'active' ? '#10b981' : '#f59e0b'};
`;

const StatsGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
  gap: 24px;
  margin-bottom: 40px;
`;

const StatCard = styled.div<{ $variant?: 'blue' | 'purple' | 'orange' | 'green' }>`
  background: white;
  border: 1px solid #e2e8f0;
  border-radius: 24px;
  padding: 28px;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  position: relative;
  overflow: hidden;
  box-shadow: 0 1px 3px 0 rgba(0, 0, 0, 0.05);

  &::before {
    content: '';
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 4px;
    background: ${props => {
      switch(props.$variant) {
        case 'purple': return '#a855f7';
        case 'orange': return '#f97316';
        case 'green': return '#22c55e';
        default: return '#3b82f6';
      }
    }};
  }

  &:hover {
    transform: translateY(-4px);
    border-color: #cbd5e1;
    box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1);
  }
`;

const StatLabel = styled.div`
  color: #64748b;
  font-size: 0.85rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  margin-bottom: 12px;
`;

const StatValue = styled.div`
  font-size: 2rem;
  font-weight: 800;
  color: #020617;
  margin-bottom: 12px;
`;

const ProgressBar = styled.div`
  height: 6px;
  background: #f1f5f9;
  border-radius: 3px;
  overflow: hidden;
  margin-top: 12px;
`;

const ProgressFill = styled.div<{ $percent: number; $color: string }>`
  height: 100%;
  width: ${props => props.$percent}%;
  background: ${props => props.$color};
  transition: width 1s cubic-bezier(0.4, 0, 0.2, 1);
`;

const TabContainer = styled.div`
  margin-top: 40px;
`;

const TabHeader = styled.div`
  display: flex;
  gap: 8px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
  margin-bottom: 32px;
  padding-bottom: 2px;
`;

const TabButton = styled.button<{ $active: boolean }>`
  background: ${props => props.$active ? '#020617' : 'transparent'};
  border: 1px solid ${props => props.$active ? '#020617' : '#e2e8f0'};
  padding: 12px 24px;
  color: ${props => props.$active ? 'white' : '#64748b'};
  font-weight: 800;
  font-size: 0.95rem;
  cursor: pointer;
  border-radius: 14px;
  display: flex;
  align-items: center;
  gap: 10px;
  transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);

  &:hover {
    color: ${props => props.$active ? 'white' : '#020617'};
    background: ${props => props.$active ? '#0f172a' : '#f8fafc'};
    border-color: ${props => props.$active ? '#0f172a' : '#cbd5e1'};
  }
`;

const Card = styled.div`
  background: white;
  border: 1px solid #e2e8f0;
  border-radius: 32px;
  padding: 40px;
  box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05);
`;

const SectionTitle = styled.h2`
  font-size: 1.5rem;
  font-weight: 800;
  margin-bottom: 32px;
  display: flex;
  align-items: center;
  gap: 12px;
  color: #020617;
`;

const InfoGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
  gap: 32px;
`;

const InfoItem = styled.div`
  label {
    display: block;
    color: #64748b;
    font-size: 0.75rem;
    font-weight: 800;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    margin-bottom: 8px;
  }
  span {
    font-size: 1.1rem;
    color: #020617;
    font-weight: 700;
  }
`;

const Table = styled.table`
  width: 100%;
  border-collapse: separate;
  border-spacing: 0 8px;
  
  th {
    text-align: left;
    padding: 16px;
    color: #64748b;
    font-size: 0.8rem;
    text-transform: uppercase;
    font-weight: 600;
  }

  td {
    padding: 16px;
    background: rgba(255, 255, 255, 0.02);
    border-top: 1px solid rgba(255, 255, 255, 0.05);
    border-bottom: 1px solid rgba(255, 255, 255, 0.05);

    &:first-child {
      border-left: 1px solid rgba(255, 255, 255, 0.05);
      border-top-left-radius: 12px;
      border-bottom-left-radius: 12px;
    }

    &:last-child {
      border-right: 1px solid rgba(255, 255, 255, 0.05);
      border-top-right-radius: 12px;
      border-bottom-right-radius: 12px;
    }
  }
`;

const ActionButton = styled.button<{ $variant?: 'primary' | 'secondary' }>`
  padding: 12px 24px;
  border-radius: 14px;
  font-weight: 700;
  font-size: 0.95rem;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 10px;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  
  ${props => props.$variant === 'primary' ? `
    background: linear-gradient(135deg, #2563eb 0%, #7c3aed 100%);
    border: none;
    color: white;
    box-shadow: 0 8px 16px -4px rgba(37, 99, 235, 0.3);
    &:hover { 
      transform: translateY(-2px); 
      box-shadow: 0 12px 20px -4px rgba(37, 99, 235, 0.4); 
      background: linear-gradient(135deg, #1d4ed8 0%, #6d28d9 100%);
    }
  ` : `
    background: rgba(255, 255, 255, 0.05);
    border: 1px solid rgba(255, 255, 255, 0.1);
    color: #94a3b8;
    &:hover { 
      background: rgba(255, 255, 255, 0.1); 
      color: white;
      transform: translateY(-1px);
    }
  `}
`;

const ModalOverlay = styled.div`
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.8);
  backdrop-filter: blur(8px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
`;

const ModalContent = styled.div`
  background: white;
  border: 1px solid #e2e8f0;
  border-radius: 32px;
  padding: 40px;
  width: 100%;
  max-width: 500px;
  box-shadow: 0 40px 80px -20px rgba(0, 0, 0, 0.3);
  color: #020617;
`;

const FormField = styled.div`
  margin-bottom: 24px;
  label {
    display: block;
    color: #64748b;
    font-size: 0.85rem;
    margin-bottom: 8px;
    font-weight: 800;
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }
  input, textarea {
    width: 100%;
    background: #f8fafc;
    border: 2px solid #e2e8f0;
    border-radius: 14px;
    padding: 14px;
    color: #020617;
    font-size: 1rem;
    font-weight: 600;
    transition: all 0.2s;
    &:focus { 
      outline: none; 
      border-color: #020617;
      background: white;
    }
  }
`;

const HandoverModal = styled.div`
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.85);
  backdrop-filter: blur(10px);
  z-index: 2000;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 20px;
  font-family: 'Plus Jakarta Sans', sans-serif;
`;

const HandoverContent = styled.div`
  background: #1a1a1a;
  width: 100%;
  max-width: 500px;
  border-radius: 40px;
  padding: 32px;
  color: white;
  box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5);
  border: 1px solid rgba(255, 255, 255, 0.1);
`;

const ProgressDots = styled.div`
  display: flex;
  gap: 8px;
  margin-bottom: 32px;
  
  .dot {
    flex: 1;
    height: 4px;
    background: rgba(255, 255, 255, 0.1);
    border-radius: 2px;
    &.active { background: #10b981; }
  }
`;

const CameraArea = styled.div`
  background: rgba(255, 255, 255, 0.05);
  border-radius: 32px;
  aspect-ratio: 16 / 10;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  margin-bottom: 24px;
  cursor: pointer;
  overflow: hidden;
  border: 1px solid rgba(255, 255, 255, 0.05);
  
  svg { font-size: 3rem; color: rgba(255, 255, 255, 0.3); margin-bottom: 12px; }
  span { font-weight: 700; font-size: 1.1rem; }
  p { font-size: 0.8rem; opacity: 0.5; margin-top: 4px; }
`;

const ManualInputGroup = styled.div`
  display: flex;
  gap: 12px;
  margin-bottom: 24px;
  
  .input-wrapper {
    flex: 1;
    background: rgba(255, 255, 255, 0.05);
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 12px;
    display: flex;
    align-items: center;
    padding: 0 16px;
    
    span { color: #10b981; font-weight: 800; font-size: 0.9rem; }
    input { 
      background: transparent; 
      border: none; 
      color: white; 
      padding: 14px 8px; 
      width: 100%;
      font-weight: 700;
      font-size: 1rem;
      &:focus { outline: none; }
    }
  }
  
  button {
    background: #10b981;
    color: #1a1a1a;
    border: none;
    padding: 0 24px;
    border-radius: 12px;
    font-weight: 800;
    cursor: pointer;
    text-transform: uppercase;
    font-size: 0.8rem;
    letter-spacing: 0.05em;
    transition: all 0.2s;
    &:hover { transform: scale(1.05); background: #34d399; }
  }
`;

const ActionFooter = styled.div`
  display: flex;
  gap: 16px;
  margin-top: 32px;
  
  button {
    flex: 1;
    padding: 18px;
    border-radius: 20px;
    font-weight: 800;
    font-size: 1.1rem;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    transition: all 0.2s;
  }
  
  .back { background: rgba(255, 255, 255, 0.1); color: white; border: none; }
  .next { background: #10b981; color: #1a1a1a; border: none; }
`;

export default function ClientDetailPage() {
  const { id } = useParams();
  const router = useRouter();
  const [client, setClient] = useState<B2BClient | null>(null);
  const [ledger, setLedger] = useState<B2BLedgerEntry[]>([]);
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('overview');
  
  // Handover Modal State & Premium Scanning States
  const [isHandoverOpen, setIsHandoverOpen] = useState(false);
  const [deliveryStep, setDeliveryStep] = useState<'idle' | 'scan_delivery' | 'scan_return' | 'finalize'>('idle');
  const [scannedDelivered, setScannedDelivered] = useState<string[]>([]);
  const [scannedReturned, setScannedReturned] = useState<string[]>([]);
  const [manualInput, setManualInput] = useState('');
  const [handoverData, setHandoverData] = useState({ notes: '' });
  const [submittingHandover, setSubmittingHandover] = useState(false);
  const [isCameraActive, setIsCameraActive] = useState(false);
  
  // Custom camera controls & conflict resolvers
  const [isFlashOn, setIsFlashOn] = useState(false);
  const [hasFlash, setHasFlash] = useState(false);
  const [scanStatus, setScanStatus] = useState<'success' | 'duplicate' | 'error' | null>(null);
  const [scanError, setScanError] = useState<string | null>(null);
  const [lastScanned, setLastScanned] = useState<string | null>(null);
  const [conflict, setConflict] = useState<{
    type: 'delivery' | 'return';
    jarId: string;
    ownerId?: string;
    ownerName?: string;
    lastLockedAt?: any;
  } | null>(null);
  const [resolvingConflict, setResolvingConflict] = useState(false);
  
  const qrRef = useRef<Html5Qrcode | null>(null);
  const { currentUser, staffData } = useAuth();
  
  const [expandedMonths, setExpandedMonths] = useState<string[]>([format(new Date(), 'MMMM yyyy')]);
  const [expandedBillingMonths, setExpandedBillingMonths] = useState<string[]>([format(new Date(), 'MMMM yyyy')]);

  // ── Record Payment Modal state ──
  const [showAddPayment, setShowAddPayment] = useState(false);
  const [submittingPayment, setSubmittingPayment] = useState(false);
  const [showCustomPaymentStaff, setShowCustomPaymentStaff] = useState(false);
  const [paymentForm, setPaymentForm] = useState({
    date: format(new Date(), 'yyyy-MM-dd'),
    time: format(new Date(), 'HH:mm'),
    amount: '',
    referenceId: '',
    recordedBy: '',
    notes: '',
  });

  // ── Manual Entry Modal state ──
  const [showAddEntry, setShowAddEntry]   = useState(false);
  const [addingEntry, setAddingEntry]     = useState(false);
  const [manualEntry, setManualEntry]     = useState({
    date: format(new Date(), 'yyyy-MM-dd'),
    time: format(new Date(), 'HH:mm'),
    jarsDelivered: 1,
    jarsReturned: 0,
    notes: '',
    recordedBy: '',
  });
  const [staffList, setStaffList] = useState<StaffMember[]>([]);
  const [showCustomStaffInput, setShowCustomStaffInput] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // ── Edit/Correction Modal state ──
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingEntry, setEditingEntry] = useState<any | null>(null);
  const [submittingEdit, setSubmittingEdit] = useState(false);
  const [showCustomEditStaff, setShowCustomEditStaff] = useState(false);
  const [editForm, setEditForm] = useState({
    id: '',
    type: '',
    date: format(new Date(), 'yyyy-MM-dd'),
    time: format(new Date(), 'HH:mm'),
    amount: '',
    referenceId: '',
    recordedBy: '',
    notes: '',
    deliveredCount: 0,
    returnedCount: 0,
  });

  // Billing Date State
  const [billingPeriod, setBillingPeriod] = useState({
    start: format(startOfMonth(new Date()), 'yyyy-MM-dd'),
    end: format(endOfMonth(new Date()), 'yyyy-MM-dd')
  });
  const [statement, setStatement] = useState<any>(null);
  const [loadingStatement, setLoadingStatement] = useState(false);

  // ── Robust Date/Time Helper ──
  const parseLedgerTimestamp = (timestamp: any): Date => {
    if (!timestamp) return new Date();
    if (typeof timestamp.toDate === 'function') {
      return timestamp.toDate();
    }
    if (timestamp instanceof Date) {
      return timestamp;
    }
    if (typeof timestamp === 'string') {
      return new Date(timestamp);
    }
    if (typeof timestamp.seconds === 'number') {
      return new Date(timestamp.seconds * 1000 + Math.floor((timestamp.nanoseconds || 0) / 1000000));
    }
    return new Date();
  };

  // ── Audio Helpers ──
  const playSuccessBeep = () => {
    try {
      const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain); gain.connect(ctx.destination);
      osc.type = 'sine'; osc.frequency.setValueAtTime(880, ctx.currentTime);
      gain.gain.setValueAtTime(0.8, ctx.currentTime);
      osc.start(); osc.stop(ctx.currentTime + 0.15);
      if (window.navigator?.vibrate) window.navigator.vibrate(80);
    } catch {}
  };

  const playErrorBeep = () => {
    try {
      const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain); gain.connect(ctx.destination);
      osc.type = 'sawtooth'; osc.frequency.setValueAtTime(300, ctx.currentTime);
      gain.gain.setValueAtTime(0.8, ctx.currentTime);
      osc.start(); osc.stop(ctx.currentTime + 0.3);
      if (window.navigator?.vibrate) window.navigator.vibrate([200, 100, 200]);
    } catch {}
  };

  // ── Flash Toggle ──
  const toggleFlash = async () => {
    if (!qrRef.current || !hasFlash) return;
    try {
      const newState = !isFlashOn;
      await qrRef.current.applyVideoConstraints({
        //@ts-ignore
        torch: newState
      });
      setIsFlashOn(newState);
    } catch (e) {
      console.error("Flash toggle failed:", e);
    }
  };

  // ── Handlers ──
  const handleScanSuccess = async (rawId: string) => {
    let id = rawId.trim();
    if (!id) return;
    
    try {
      if (id.startsWith('http://') || id.startsWith('https://')) {
        const url = new URL(id);
        const urlId = url.searchParams.get('id');
        if (urlId) id = urlId.trim();
      }
    } catch (err) {
      console.warn('Scan text is not a URL, using raw string');
    }

    try {
      const jarRef = doc(db, 'jars', id);
      const jarDoc = await getDoc(jarRef);
      const jarData = jarDoc.exists() ? (jarDoc.data() as any) : null;

      const companyHandoverName = `${client?.companyName} [ b2b ]`;

      if (deliveryStep === 'scan_delivery') {
        if (jarData && jarData.status === 'locked' && jarData.currentOwnerId !== client?.id && jarData.currentOwnerId !== companyHandoverName) {
          setIsCameraActive(false);
          setScanError('Searching owner details...');
          
          let ownerName = 'Unknown Store';
          if (jarData.currentOwnerId.endsWith(' [ b2b ]')) {
            ownerName = jarData.currentOwnerId.replace(' [ b2b ]', '');
          } else {
            try {
              const userRef = doc(db, 'users', jarData.currentOwnerId);
              const userDoc = await getDoc(userRef);
              if (userDoc.exists()) {
                ownerName = userDoc.data().full_name || userDoc.data().name || 'Customer';
              }
            } catch {}
          }

          setConflict({
            type: 'delivery',
            jarId: id,
            ownerId: jarData.currentOwnerId,
            ownerName,
            lastLockedAt: jarData.lastScanAt || jarData.lastLockedAt
          });
          setScanError(null);
          playErrorBeep();
          return;
        }
      } else if (deliveryStep === 'scan_return') {
        const isOwnerMatch = jarData && (jarData.currentOwnerId === client?.id || jarData.currentOwnerId === companyHandoverName);
        if (!jarData || jarData.status !== 'locked' || !isOwnerMatch) {
          setIsCameraActive(false);
          setConflict({
            type: 'return',
            jarId: id,
            ownerId: jarData?.currentOwnerId || 'Unassigned',
            ownerName: jarData?.currentOwnerId ? (jarData.currentOwnerId.endsWith(' [ b2b ]') ? jarData.currentOwnerId.replace(' [ b2b ]', '') : 'Retail Customer') : 'Warehouse/New Jar'
          });
          playErrorBeep();
          return;
        }
      }
    } catch (e) {
      console.warn("Jar verification failed:", e);
    }

    setLastScanned(id);
    setScanError(null);
    
    if (deliveryStep === 'scan_delivery') {
      setScannedDelivered(prev => {
        if (prev.includes(id)) {
          setScanStatus('duplicate');
          playErrorBeep();
          return prev;
        }
        setScanStatus('success');
        playSuccessBeep();
        return [...prev, id];
      });
    } else if (deliveryStep === 'scan_return') {
      setScannedReturned(prev => {
        if (prev.includes(id)) {
          setScanStatus('duplicate');
          playErrorBeep();
          return prev;
        }
        setScanStatus('success');
        playSuccessBeep();
        return [...prev, id];
      });
    }

    setTimeout(() => setScanStatus(null), 800);
  };

  const resolveConflict = async () => {
    if (!conflict || !client) return;
    setResolvingConflict(true);
    try {
      const staffId = currentUser?.uid || 'admin';
      const companyHandoverName = `${client.companyName} [ b2b ]`;
      
      if (conflict.type === 'delivery') {
        const jarRef = doc(db, 'jars', conflict.jarId);
        const jarDoc = await getDoc(jarRef);
        const history = jarDoc.exists() ? (jarDoc.data().history || []) : [];
        
        await setDoc(jarRef, {
          id: conflict.jarId,
          currentOwnerId: companyHandoverName,
          status: 'locked',
          lastScanAt: new Date(),
          lastScanBy: staffId,
          history: [...history, { customerId: companyHandoverName, timestamp: new Date(), action: 'delivery' }]
        }, { merge: true });
        
        setScannedDelivered(prev => [...prev, conflict.jarId]);
      } else {
        await returnJar(conflict.jarId, staffId, conflict.ownerId || 'unknown');
        setScannedReturned(prev => [...prev, conflict.jarId]);
      }
      
      playSuccessBeep();
      setConflict(null);
      setIsCameraActive(true);
    } catch (e) {
      console.error("Conflict resolution failed:", e);
      alert("Conflict resolution failed. Please try again.");
    } finally {
      setResolvingConflict(false);
    }
  };

  // ── Html5Qrcode Stream Scanner Effect ──
  useEffect(() => {
    let isMounted = true;

    const startScanner = async () => {
      try {
        const element = document.getElementById("reader");
        if (!element) return;

        qrRef.current = new Html5Qrcode("reader");
        await qrRef.current.start(
          { facingMode: "environment" },
          { fps: 15, qrbox: { width: 280, height: 280 } },
          (decodedText) => {
            if (isMounted) handleScanSuccess(decodedText);
          },
          undefined
        );

        try {
          const track = qrRef.current.getRunningTrackCapabilities();
          if ((track as any).torch) setHasFlash(true);
        } catch {}

      } catch (err) {
        console.warn("Scanner initiation delay:", err);
      }
    };

    if (isHandoverOpen && isCameraActive && (deliveryStep === 'scan_delivery' || deliveryStep === 'scan_return')) {
      const timer = setTimeout(startScanner, 100);
      return () => {
        clearTimeout(timer);
        isMounted = false;
        setIsFlashOn(false);
        setHasFlash(false);
        if (qrRef.current && qrRef.current.isScanning) {
          qrRef.current.stop().catch(() => {});
        }
      };
    }

    return () => {
      isMounted = false;
      setIsFlashOn(false);
      setHasFlash(false);
      if (qrRef.current && qrRef.current.isScanning) {
        qrRef.current.stop().catch(() => {});
      }
    };
  }, [isHandoverOpen, isCameraActive, deliveryStep]);

  const handleManualAdd = () => {
    if (!manualInput) return;
    const parsedInput = manualInput.trim();
    let finalId = parsedInput;
    
    if (/^\d+$/.test(parsedInput)) {
      finalId = `HYD-JAR-${parsedInput.padStart(4, '0')}`;
    } else if (!parsedInput.toUpperCase().startsWith('HYD-JAR-')) {
      finalId = `HYD-JAR-${parsedInput.toUpperCase()}`;
    } else {
      finalId = parsedInput.toUpperCase();
    }
    
    handleScanSuccess(finalId);
    setManualInput('');
  };

  const handleHandoverSubmit = async () => {
    if (!client) return;
    setSubmittingHandover(true);
    try {
      // Resolve the human-readable name of who is doing this delivery
      const staffId = currentUser?.uid || 'admin_panel';
      const staffName =
        staffData?.name ||
        currentUser?.displayName ||
        (currentUser?.phoneNumber ? currentUser.phoneNumber.slice(-4) : null) ||
        'Admin';
      const b2bOwnerId = `${client.companyName} [ b2b ]`;

      for (const jarId of scannedDelivered) {
        try {
          await assignJarToCustomer(jarId, b2bOwnerId, staffId);
        } catch (e) {
          console.warn(`Failed to link delivery jar ${jarId}:`, e);
        }
      }

      for (const jarId of scannedReturned) {
        try {
          await returnJar(jarId, staffId, b2bOwnerId);
        } catch (e) {
          console.warn(`Failed to return jar ${jarId}:`, e);
        }
      }

      await recordHandover({
        clientId: client.id!,
        delivered: scannedDelivered.length,
        returned: scannedReturned.length,
        pricePerJar: client.contractTerms?.pricePerJar || 35,
        notes: `Serialized Handover: ${scannedDelivered.length} Out, ${scannedReturned.length} In. ${handoverData.notes}`,
        deliveredJarIds: scannedDelivered,
        returnedJarIds: scannedReturned,
        staffId: staffName,  // save the display name, not UID
      });

      setDeliveryStep('idle');
      setIsHandoverOpen(false);
      setScannedDelivered([]);
      setScannedReturned([]);
      setHandoverData({ notes: '' });
      alert('Handover recorded successfully!');
      loadData();
    } catch (err) {
      console.error('Handover failed:', err);
      alert('Failed to record handover: ' + err);
    } finally {
      setSubmittingHandover(false);
    }
  };

  useEffect(() => {
    if (id) {
      loadData();
    }
  }, [id]);

  async function loadData() {
    const clientId = id as string;
    try {
      // 1. Critical: Load Client Master Data
      const clientData = await getClientById(clientId);
      setClient(clientData);
      
      // 2. Non-Critical: Load Ledger & Orders (May fail if indexing)
      let ledgerData: any[] = [];
      try {
        ledgerData = await getLedgerEntries(clientId, 1000);
        setLedger(ledgerData);

        // Sync outstandingAmount & lastPayment details to client record in Firestore dynamically
        const computedOutstanding = ledgerData.reduce((sum, e) => {
          if (['delivery_handover', 'invoice_issued', 'manual_adjustment', 'jar_delivery'].includes(e.type)) {
            return sum + (e.amount ?? 0);
          }
          if (e.type === 'payment_received') {
            return sum - (e.amount ?? 0);
          }
          return sum;
        }, 0);

        const payments = ledgerData.filter(e => e.type === 'payment_received').sort((a, b) => parseLedgerTimestamp(b.timestamp).getTime() - parseLedgerTimestamp(a.timestamp).getTime());
        const lastPayment = payments[0];

        const updateData: any = {
          'financialSummary.outstandingAmount': computedOutstanding,
          updatedAt: Timestamp.now()
        };

        if (lastPayment) {
          updateData['financialSummary.lastPaymentDate'] = lastPayment.timestamp;
          updateData['financialSummary.lastPaymentAmount'] = lastPayment.amount ?? 0;
        } else {
          updateData['financialSummary.lastPaymentDate'] = null;
          updateData['financialSummary.lastPaymentAmount'] = 0;
        }

        await updateDoc(doc(db, 'b2b_clients', clientId), updateData);
        
        // Also update local memory client state
        if (clientData) {
          clientData.financialSummary = {
            ...clientData.financialSummary,
            outstandingAmount: computedOutstanding,
            lastPaymentDate: lastPayment ? lastPayment.timestamp : null,
            lastPaymentAmount: lastPayment ? (lastPayment.amount ?? 0) : 0
          };
          setClient(clientData);
        }
      } catch (e) {
        console.warn('Ledger indexing in progress or failed:', e);
      }

      try {
        const ordersData = await getClientOrders(clientId);
        setOrders(ordersData);
      } catch (e) {
        console.warn('Orders indexing in progress or failed:', e);
      }

      // 3. Load Active Staff/Admins for dropdown
      try {
        const admins = await getAllAdmins();
        setStaffList(admins.filter(a => a.status === 'active'));
      } catch (e) {
        console.warn('Failed to load active admins/staff:', e);
      }
    } catch (error) {
      console.error('Failed to load client master details:', error);
    } finally {
      setLoading(false);
    }
  }



  // ── Record manual payment entry ──
  const handleAddPayment = async () => {
    if (!client) return;
    const amountVal = parseFloat(paymentForm.amount);
    if (isNaN(amountVal) || amountVal <= 0) {
      alert('Please enter a valid payment amount greater than 0.');
      return;
    }
    setSubmittingPayment(true);
    try {
      const staffName =
        paymentForm.recordedBy?.trim() ||
        staffData?.name ||
        currentUser?.displayName ||
        (currentUser?.phoneNumber ? currentUser.phoneNumber.slice(-4) : null) ||
        'Admin';
      const dt = new Date(`${paymentForm.date}T${paymentForm.time}:00`);

      // 1. Add payment entry to b2b_ledgers
      await addDoc(fsCollection(db, 'b2b_ledgers'), {
        clientId:      client.id,
        type:          'payment_received',
        amount:        amountVal,
        recordedBy:    staffName,
        timestamp:     Timestamp.fromDate(dt),
        referenceId:   paymentForm.referenceId || 'CASH/BANK',
        description:   paymentForm.notes || `Payment Received: ₹${amountVal.toLocaleString()}`,
        metadata:      { paymentMethod: 'Manual Entry' }
      });

      // 2. Compute updated outstandingAmount based on our computed real-time balance
      const updatedOutstanding = calculatedOutstanding - amountVal;

      // 3. Update the client document aggregate outstandingAmount in Firestore so the dashboard is in sync
      await updateDoc(doc(db, 'b2b_clients', client.id), {
        'financialSummary.outstandingAmount': updatedOutstanding,
        'financialSummary.lastPaymentDate': Timestamp.fromDate(dt),
        'financialSummary.lastPaymentAmount': amountVal,
        updatedAt: Timestamp.now()
      });

      setShowAddPayment(false);
      setPaymentForm({
        date: format(new Date(), 'yyyy-MM-dd'),
        time: format(new Date(), 'HH:mm'),
        amount: '',
        referenceId: '',
        recordedBy: '',
        notes: '',
      });
      setShowCustomPaymentStaff(false);
      await loadData();
    } catch (err) {
      console.error('Failed to add payment:', err);
      alert('Failed to record payment: ' + err);
    } finally {
      setSubmittingPayment(false);
    }
  };

  // ── Add manual delivery entry ──
  const handleAddManualEntry = async () => {
    if (!client) return;
    if (manualEntry.jarsDelivered < 0 || manualEntry.jarsReturned < 0) {
      alert('Jar counts must be 0 or more.');
      return;
    }
    setAddingEntry(true);
    try {
      const staffName =
        manualEntry.recordedBy?.trim() ||
        staffData?.name ||
        currentUser?.displayName ||
        (currentUser?.phoneNumber ? currentUser.phoneNumber.slice(-4) : null) ||
        'Admin';
      const pricePerJar = client.contractTerms?.pricePerJar || 35;
      const amount      = manualEntry.jarsDelivered * pricePerJar;
      // Combine date + time into a proper Date
      const dt = new Date(`${manualEntry.date}T${manualEntry.time}:00`);
      await addDoc(fsCollection(db, 'b2b_ledgers'), {
        clientId:      client.id,
        type:          'delivery_handover',
        deliveredCount: manualEntry.jarsDelivered,
        returnedCount:  manualEntry.jarsReturned,
        jarCount:       manualEntry.jarsDelivered - manualEntry.jarsReturned,
        amount,
        recordedBy:    staffName,
        timestamp:     Timestamp.fromDate(dt),
        description:   manualEntry.notes || `Manual Entry: ${manualEntry.jarsDelivered} Delivered, ${manualEntry.jarsReturned} Returned`,
        isManualEntry: true,
        metadata:      { deliveredJarIds: [], returnedJarIds: [] },
      });
      setShowAddEntry(false);
      setManualEntry({ date: format(new Date(), 'yyyy-MM-dd'), time: format(new Date(), 'HH:mm'), jarsDelivered: 1, jarsReturned: 0, notes: '', recordedBy: '' });
      setShowCustomStaffInput(false);
      await loadData();
    } catch (err) {
      console.error('Failed to add manual entry:', err);
      alert('Failed to add entry: ' + err);
    } finally {
      setAddingEntry(false);
    }
  };

  // ── Delete a ledger entry (deliveries or payments) ──
  const handleDeleteEntry = async (entryId: string) => {
    if (!confirm('Delete this ledger record? This cannot be undone.')) return;
    setDeletingId(entryId);
    try {
      await deleteDoc(doc(db, 'b2b_ledgers', entryId));
      await loadData();
      playSuccessBeep();
    } catch (err) {
      console.error('Failed to delete entry:', err);
      alert('Failed to delete: ' + err);
      playErrorBeep();
    } finally {
      setDeletingId(null);
    }
  };

  // ── Edit/Correction Handlers ──
  const handleOpenEditModal = (entry: any) => {
    const ts = parseLedgerTimestamp(entry.timestamp);
    setEditingEntry(entry);
    setEditForm({
      id: entry.id,
      type: entry.type,
      date: format(ts, 'yyyy-MM-dd'),
      time: format(ts, 'HH:mm'),
      amount: (entry.amount ?? '').toString(),
      referenceId: entry.referenceId || '',
      recordedBy: entry.recordedBy || '',
      notes: entry.description || '',
      deliveredCount: entry.deliveredCount ?? (entry.jarCount > 0 ? entry.jarCount : 0),
      returnedCount: entry.returnedCount ?? (entry.jarCount < 0 ? Math.abs(entry.jarCount) : 0),
    });
    setShowCustomEditStaff(false);
    setShowEditModal(true);
  };

  const handleSaveEdit = async () => {
    if (!client || !editingEntry) return;
    setSubmittingEdit(true);
    try {
      const dt = new Date(`${editForm.date}T${editForm.time}:00`);
      const amountVal = parseFloat(editForm.amount);
      const isPayment = editForm.type === 'payment_received';
      
      const updatePayload: any = {
        timestamp: Timestamp.fromDate(dt),
        recordedBy: editForm.recordedBy || 'Admin',
        description: editForm.notes,
      };

      if (isPayment) {
        if (isNaN(amountVal) || amountVal <= 0) {
          alert('Please enter a valid amount greater than 0.');
          setSubmittingEdit(false);
          return;
        }
        updatePayload.amount = amountVal;
        updatePayload.referenceId = editForm.referenceId || 'CASH/BANK';
        if (!updatePayload.description || updatePayload.description.startsWith('Payment Received:')) {
          updatePayload.description = editForm.notes || `Payment Received: ₹${amountVal.toLocaleString()}`;
        }
      } else {
        // It's a delivery or adjustment
        const delJars = parseInt(editForm.deliveredCount as any) || 0;
        const retJars = parseInt(editForm.returnedCount as any) || 0;
        if (delJars < 0 || retJars < 0) {
          alert('Jar counts cannot be negative.');
          setSubmittingEdit(false);
          return;
        }
        const pricePerJar = client.contractTerms?.pricePerJar || 35;
        const computedAmount = isNaN(amountVal) ? (delJars * pricePerJar) : amountVal;
        
        updatePayload.deliveredCount = delJars;
        updatePayload.returnedCount = retJars;
        updatePayload.jarCount = delJars - retJars;
        updatePayload.amount = computedAmount;
        if (!updatePayload.description || updatePayload.description.startsWith('Manual Entry:')) {
          updatePayload.description = editForm.notes || `Manual Entry: ${delJars} Delivered, ${retJars} Returned`;
        }
      }

      await updateDoc(doc(db, 'b2b_ledgers', editingEntry.id), updatePayload);
      setShowEditModal(false);
      setEditingEntry(null);
      await loadData();
      playSuccessBeep();
    } catch (err) {
      console.error('Failed to save correction:', err);
      alert('Failed to save correction: ' + err);
      playErrorBeep();
    } finally {
      setSubmittingEdit(false);
    }
  };

  // ── Excel Export: Store Orders (from delivery ledger entries) ──
  const handleExportOrders = () => {
    const deliveryEntries = ledger.filter(e => ['delivery_handover', 'jar_delivery'].includes(e.type));
    if (!client || deliveryEntries.length === 0) {
      alert('No delivery records to export.');
      return;
    }
    const rows = deliveryEntries.map((entry, index) => {
      const date = parseLedgerTimestamp(entry.timestamp);
      return {
        'S.No': index + 1,
        'Record ID': entry.id?.slice(0, 10) || '',
        'Date': format(date, 'yyyy-MM-dd'),
        'Time': format(date, 'HH:mm'),
        'Jar Delivery': entry.deliveredCount ?? (entry.jarCount && entry.jarCount > 0 ? entry.jarCount : 0),
        'Jar Return': entry.returnedCount ?? (entry.jarCount && entry.jarCount < 0 ? Math.abs(entry.jarCount) : 0),
        'Total Amount (₹)': entry.amount ?? 0,
        'Delivered By': entry.recordedBy || 'Unknown',
        'Notes': entry.description || '',
      };
    });
    const totDel = rows.reduce((s, r) => s + (r['Jar Delivery'] as number), 0);
    const totRet = rows.reduce((s, r) => s + (r['Jar Return'] as number), 0);
    const totAmt = rows.reduce((s, r) => s + (r['Total Amount (₹)'] as number), 0);
    rows.push({ 'S.No': 'TOTAL' as any, 'Record ID': '', 'Date': '', 'Time': '', 'Jar Delivery': totDel, 'Jar Return': totRet, 'Total Amount (₹)': totAmt, 'Delivered By': '', 'Notes': '' });
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(rows);
    XLSX.utils.book_append_sheet(wb, ws, 'Deliveries');
    XLSX.writeFile(wb, `B2B_Deliveries_${client.companyName.replace(/\s+/g, '_')}_${format(new Date(), 'yyyy-MM-dd')}.xlsx`);
  };

  // ── Excel Export: Store Ledger ──
  const handleExportLedger = () => {
    if (!client || ledger.length === 0) {
      alert('No ledger entries to export.');
      return;
    }
    const rows = ledger.map((entry, index) => {
      const date = parseLedgerTimestamp(entry.timestamp);
      const delivered = entry.deliveredCount ?? (entry.jarCount && entry.jarCount > 0 ? entry.jarCount : 0);
      const returned  = entry.returnedCount ?? (entry.jarCount && entry.jarCount < 0 ? Math.abs(entry.jarCount) : 0);
      const pricePerJar = delivered > 0 && entry.amount ? Math.round(entry.amount / delivered) : (client?.contractTerms?.pricePerJar || 0);
      return {
        'S.No': index + 1,
        'Date': format(date, 'yyyy-MM-dd'),
        'Time': format(date, 'HH:mm:ss'),
        'Type': entry.type?.replace(/_/g, ' ') ?? '',
        'Reference ID': entry.referenceId || entry.id || '',
        'Qty Delivered': delivered,
        'Qty Returned': returned,
        'Price Per Jar (₹)': pricePerJar,
        'Total Value (₹)': entry.amount ?? 0,
        'Description': entry.description ?? '',
      };
    });
    const totalDelivered = rows.reduce((s, r) => s + (r['Qty Delivered'] as number), 0);
    const totalReturned  = rows.reduce((s, r) => s + (r['Qty Returned'] as number), 0);
    const totalValue     = rows.reduce((s, r) => s + (r['Total Value (₹)'] as number), 0);
    rows.push({
      'S.No': 'TOTAL' as any,
      'Date': '',
      'Time': '',
      'Type': '',
      'Reference ID': '',
      'Qty Delivered': totalDelivered,
      'Qty Returned': totalReturned,
      'Price Per Jar (₹)': '' as any,
      'Total Value (₹)': totalValue,
      'Description': '',
    });
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(rows);
    XLSX.utils.book_append_sheet(wb, ws, 'Store Ledger');
    XLSX.writeFile(wb, `B2B_Store_Ledger_${client.companyName.replace(/\s+/g, '_')}_${format(new Date(), 'yyyy-MM-dd')}.xlsx`);
  };

  async function fetchStatement() {
    if (!client) return;
    setLoadingStatement(true);
    try {
      const data = await generateMonthlyStatement(
        client.id, 
        parseISO(billingPeriod.start), 
        parseISO(billingPeriod.end)
      );
      setStatement(data);
    } catch (err) {
      alert('Failed to generate statement: ' + err);
    } finally {
      setLoadingStatement(false);
    }
  }

  if (loading) {
    return (
      <Container>
        <div style={{ padding: '100px', textAlign: 'center', opacity: 0.5 }}>
          <FiActivity style={{ animation: 'spin 2s linear infinite', fontSize: '2rem' }} />
          <p style={{ marginTop: '16px' }}>Loading Enterprise Profile...</p>
        </div>
      </Container>
    );
  }

  if (!client) {
    return (
      <Container>
        <Card style={{ textAlign: 'center', padding: '60px' }}>
          <FiAlertCircle size={48} color="#ef4444" style={{ margin: '0 auto 20px' }} />
          <h1>Client Not Found</h1>
          <p style={{ color: '#64748b', marginBottom: '24px' }}>The client ID might be invalid or has been removed.</p>
          <BackButton onClick={() => router.push('/admin/b2b')} style={{ margin: '0 auto' }}>
            Back to Dashboard
          </BackButton>
        </Card>
      </Container>
    );
  }

  // Dynamic ledger-based metrics computation
  const calculatedOutstanding = ledger.reduce((sum, e) => {
    if (['delivery_handover', 'invoice_issued', 'manual_adjustment', 'jar_delivery'].includes(e.type)) {
      return sum + (e.amount ?? 0);
    }
    if (e.type === 'payment_received') {
      return sum - (e.amount ?? 0);
    }
    return sum;
  }, 0);

  const calculatedJarsOnPremise = ledger.reduce((sum, e) => {
    if (e.type === 'jar_delivery') return sum + (e.jarCount ?? 0);
    if (e.type === 'jar_return') return sum - (e.jarCount ?? 0);
    if (e.type === 'delivery_handover') return sum + (e.jarCount ?? 0);
    if (e.type === 'manual_adjustment') return sum + (e.jarCount ?? 0);
    return sum;
  }, 0);

  const calculatedLifetimeRevenue = ledger.reduce((sum, e) => {
    if (['delivery_handover', 'jar_delivery', 'invoice_issued'].includes(e.type)) {
      return sum + (e.amount ?? 0);
    }
    if (e.type === 'manual_adjustment' && e.amount && e.amount > 0) {
      return sum + e.amount;
    }
    return sum;
  }, 0);

  const creditUsagePercent = client.contractTerms?.creditLimit 
    ? Math.max(0, Math.min(100, (calculatedOutstanding / client.contractTerms.creditLimit) * 100))
    : 0;

  const jarFleetPercent = client.jarInventory?.totalAllocated
    ? Math.max(0, Math.min(100, (calculatedJarsOnPremise / client.jarInventory.totalAllocated) * 100))
    : 0;

  return (
    <Container>
      <Header>
        <div>
          <BackButton onClick={() => router.push('/admin/b2b')}>
            <FiArrowLeft /> Back to B2B Console
          </BackButton>
          <ClientTitle>
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
              <h1>{client.companyName}</h1>
              <Badge $type={client.status as any}>{client.status}</Badge>
            </div>
            <p>CLIENT_UID: {client.id}</p>
          </ClientTitle>
        </div>
        <div style={{ display: 'flex', gap: '12px', marginTop: '20px' }}>
          <ActionButton $variant="secondary">
            <FiSettings /> Contract Settings
          </ActionButton>
          <ActionButton $variant="primary" onClick={() => router.push(`/admin/orders/new?clientId=${client.id}`)}>
            <FiPlus /> New Enterprise Order
          </ActionButton>
        </div>
      </Header>

      <StatsGrid>
        <StatCard $variant="blue">
          <StatLabel>Financial Standing</StatLabel>
          <StatValue>₹{calculatedOutstanding.toLocaleString()}</StatValue>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', color: '#64748b' }}>
            <span>Outstanding Dues</span>
            <span>Limit: ₹{(client.contractTerms?.creditLimit || 0).toLocaleString()}</span>
          </div>
          <ProgressBar>
            <ProgressFill $percent={creditUsagePercent} $color={creditUsagePercent > 80 ? '#ef4444' : '#3b82f6'} />
          </ProgressBar>
        </StatCard>

        <StatCard $variant="purple">
          <StatLabel>Jar Fleet Logistics</StatLabel>
          <StatValue>{calculatedJarsOnPremise} / {client.jarInventory?.totalAllocated || 0}</StatValue>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', color: '#64748b' }}>
            <span>Jars on Premise</span>
            <span>Total Allocated</span>
          </div>
          <ProgressBar>
            <ProgressFill $percent={jarFleetPercent} $color="#a855f7" />
          </ProgressBar>
        </StatCard>

        <StatCard $variant="green">
          <StatLabel>Total Lifetime Revenue</StatLabel>
          <StatValue>₹{calculatedLifetimeRevenue.toLocaleString()}</StatValue>
          <div style={{ display: 'flex', gap: '12px', fontSize: '0.8rem', color: '#4ade80' }}>
            <FiCheckCircle /> Healthy Payment History
          </div>
        </StatCard>
      </StatsGrid>

      <TabContainer>
        <TabHeader>
          <TabButton $active={activeTab === 'overview'} onClick={() => setActiveTab('overview')}>
            <FiBriefcase /> Overview
          </TabButton>
          <TabButton $active={activeTab === 'orders'} onClick={() => setActiveTab('orders')}>
            <FiTruck /> Deliveries ({ledger.filter(e => ['delivery_handover','jar_delivery'].includes(e.type)).length})
          </TabButton>
          <TabButton $active={activeTab === 'ledger'} onClick={() => setActiveTab('ledger')}>
            <FiFileText /> Ledger
          </TabButton>
          <TabButton $active={activeTab === 'billing'} onClick={() => setActiveTab('billing')}>
            <FiDollarSign /> Billing
          </TabButton>
          <TabButton $active={activeTab === 'contacts'} onClick={() => setActiveTab('contacts')}>
            <FiUsers /> Contacts
          </TabButton>
        </TabHeader>

        {activeTab === 'overview' && (
          <Card>
            <SectionTitle><FiBriefcase /> Corporate Identity & Contract</SectionTitle>
            <InfoGrid>
              <InfoItem>
                <label>Legal Company Name</label>
                <span>{client.companyName}</span>
              </InfoItem>
              <InfoItem>
                <label>GSTIN Number</label>
                <span>{client.gstin || 'NOT PROVIDED'}</span>
              </InfoItem>
              <InfoItem>
                <label>Trade License / CIN</label>
                <span>{client.tradeLicense || 'N/A'}</span>
              </InfoItem>
              <InfoItem>
                <label>Company PAN</label>
                <span>{client.pan || 'N/A'}</span>
              </InfoItem>
              <InfoItem>
                <label>Contract Pricing</label>
                <span>₹{client.contractTerms?.pricePerJar} / Jar</span>
              </InfoItem>
              <InfoItem>
                <label>Billing Cycle</label>
                <span style={{ textTransform: 'capitalize' }}>{client.contractTerms?.billingCycle}</span>
              </InfoItem>
              <InfoItem>
                <label>Credit Period</label>
                <span>{client.contractTerms?.creditPeriod} Days</span>
              </InfoItem>
              <InfoItem>
                <label>Contract Start Date</label>
                <span>{client.contractTerms?.startDate ? format((client.contractTerms.startDate as any).toDate(), 'PPP') : 'N/A'}</span>
              </InfoItem>
              <InfoItem>
                <label>System Registration</label>
                <span>{client.createdAt ? format((client.createdAt as any).toDate(), 'PPP') : 'N/A'}</span>
              </InfoItem>
            </InfoGrid>
          </Card>
        )}

        {activeTab === 'orders' && (() => {
          const deliveryEntries = ledger
            .filter(e => ['delivery_handover', 'jar_delivery'].includes(e.type))
            .sort((a, b) => {
              return parseLedgerTimestamp(b.timestamp).getTime() - parseLedgerTimestamp(a.timestamp).getTime();
            });
          const totDel = deliveryEntries.reduce((s, e) => s + (e.deliveredCount ?? (e.jarCount && e.jarCount > 0 ? e.jarCount : 0)), 0);
          const totRet = deliveryEntries.reduce((s, e) => s + (e.returnedCount ?? (e.jarCount && e.jarCount < 0 ? Math.abs(e.jarCount) : 0)), 0);
          const totAmt = deliveryEntries.reduce((s, e) => s + (e.amount ?? 0), 0);
          return (
            <>
              {/* ── Add Manual Entry Modal ── */}
              {showAddEntry && (
                <div style={{ position: 'fixed', inset: 0, background: 'rgba(2,6,23,0.7)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', backdropFilter: 'blur(6px)' }}>
                  <div style={{ background: 'white', borderRadius: '24px', padding: '36px', width: '480px', maxWidth: '95vw', boxShadow: '0 32px 64px rgba(0,0,0,0.4)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '28px' }}>
                      <div>
                        <h2 style={{ fontSize: '1.3rem', fontWeight: 900, color: '#020617', margin: 0 }}>Add Delivery Entry</h2>
                        <p style={{ fontSize: '0.82rem', color: '#64748b', marginTop: '4px' }}>Manually log a past or missed delivery</p>
                      </div>
                      <button onClick={() => setShowAddEntry(false)} style={{ background: '#f1f5f9', border: 'none', borderRadius: '10px', padding: '8px', cursor: 'pointer', color: '#64748b' }}>
                        <FiX size={18} />
                      </button>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                      <div>
                        <label style={{ fontSize: '0.75rem', fontWeight: 800, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em', display: 'block', marginBottom: '8px' }}>Date</label>
                        <input
                          type="date"
                          value={manualEntry.date}
                          onChange={e => setManualEntry(p => ({ ...p, date: e.target.value }))}
                          style={{ width: '100%', padding: '12px', border: '1.5px solid #e2e8f0', borderRadius: '12px', fontSize: '0.9rem', fontFamily: 'inherit', boxSizing: 'border-box', outline: 'none' }}
                        />
                      </div>
                      <div>
                        <label style={{ fontSize: '0.75rem', fontWeight: 800, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em', display: 'block', marginBottom: '8px' }}>Time</label>
                        <input
                          type="time"
                          value={manualEntry.time}
                          onChange={e => setManualEntry(p => ({ ...p, time: e.target.value }))}
                          style={{ width: '100%', padding: '12px', border: '1.5px solid #e2e8f0', borderRadius: '12px', fontSize: '0.9rem', fontFamily: 'inherit', boxSizing: 'border-box', outline: 'none' }}
                        />
                      </div>
                      <div>
                        <label style={{ fontSize: '0.75rem', fontWeight: 800, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em', display: 'block', marginBottom: '8px' }}>Jars Delivered 🫙</label>
                        <input
                          type="number"
                          min={0}
                          value={manualEntry.jarsDelivered}
                          onChange={e => setManualEntry(p => ({ ...p, jarsDelivered: Math.max(0, parseInt(e.target.value) || 0) }))}
                          style={{ width: '100%', padding: '12px', border: '1.5px solid #10b981', borderRadius: '12px', fontSize: '1rem', fontWeight: 800, fontFamily: 'inherit', boxSizing: 'border-box', outline: 'none', background: '#f0fdf4' }}
                        />
                      </div>
                      <div>
                        <label style={{ fontSize: '0.75rem', fontWeight: 800, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em', display: 'block', marginBottom: '8px' }}>Jars Returned ♻️</label>
                        <input
                          type="number"
                          min={0}
                          value={manualEntry.jarsReturned}
                          onChange={e => setManualEntry(p => ({ ...p, jarsReturned: Math.max(0, parseInt(e.target.value) || 0) }))}
                          style={{ width: '100%', padding: '12px', border: '1.5px solid #e2e8f0', borderRadius: '12px', fontSize: '1rem', fontWeight: 800, fontFamily: 'inherit', boxSizing: 'border-box', outline: 'none', background: '#fef2f2' }}
                        />
                      </div>
                    </div>

                    {(() => {
                      const uniqueStaffNames = Array.from(new Set([
                        ...(staffList?.map(s => s.name) || []),
                        ...(staffData?.name ? [staffData.name] : []),
                        ...(currentUser?.displayName ? [currentUser.displayName] : []),
                        'Rose', 'Moti', 'Sohal', 'Admin'
                      ].filter(Boolean)));
                      return (
                        <div style={{ marginTop: '16px' }}>
                          <label style={{ fontSize: '0.75rem', fontWeight: 800, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em', display: 'block', marginBottom: '8px' }}>Delivered By 👤</label>
                          <select
                            value={showCustomStaffInput ? '__CUSTOM__' : manualEntry.recordedBy}
                            onChange={e => {
                              if (e.target.value === '__CUSTOM__') {
                                setShowCustomStaffInput(true);
                                setManualEntry(p => ({ ...p, recordedBy: '' }));
                              } else {
                                setShowCustomStaffInput(false);
                                setManualEntry(p => ({ ...p, recordedBy: e.target.value }));
                              }
                            }}
                            style={{ width: '100%', padding: '12px', border: '1.5px solid #e2e8f0', borderRadius: '12px', fontSize: '0.9rem', fontWeight: 600, fontFamily: 'inherit', boxSizing: 'border-box', outline: 'none', background: '#f8fafc', color: '#020617' }}
                          >
                            {uniqueStaffNames.map(name => (
                              <option key={name} value={name}>{name}</option>
                            ))}
                            <option value="__CUSTOM__">✍️ Custom Name...</option>
                          </select>

                          {showCustomStaffInput && (
                            <div style={{ marginTop: '10px' }}>
                              <input
                                type="text"
                                placeholder="Type custom staff/admin name..."
                                value={manualEntry.recordedBy}
                                onChange={e => setManualEntry(p => ({ ...p, recordedBy: e.target.value }))}
                                style={{ width: '100%', padding: '12px', border: '1.5px solid #e2e8f0', borderRadius: '12px', fontSize: '0.9rem', fontFamily: 'inherit', boxSizing: 'border-box', outline: 'none' }}
                              />
                            </div>
                          )}
                        </div>
                      );
                    })()}

                    <div style={{ marginTop: '16px' }}>
                      <label style={{ fontSize: '0.75rem', fontWeight: 800, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em', display: 'block', marginBottom: '8px' }}>Notes (optional)</label>
                      <textarea
                        value={manualEntry.notes}
                        onChange={e => setManualEntry(p => ({ ...p, notes: e.target.value }))}
                        placeholder="e.g. Monday morning delivery, 4 jars delivered by Sohal"
                        rows={2}
                        style={{ width: '100%', padding: '12px', border: '1.5px solid #e2e8f0', borderRadius: '12px', fontSize: '0.88rem', fontFamily: 'inherit', boxSizing: 'border-box', resize: 'vertical', outline: 'none' }}
                      />
                    </div>

                    {/* Price preview */}
                    {manualEntry.jarsDelivered > 0 && (
                      <div style={{ marginTop: '16px', background: '#f0fdf4', border: '1px solid #a7f3d0', borderRadius: '12px', padding: '14px 16px', display: 'flex', justifyContent: 'space-between' }}>
                        <span style={{ fontSize: '0.82rem', color: '#065f46', fontWeight: 700 }}>Calculated Amount</span>
                        <span style={{ fontWeight: 900, color: '#065f46', fontSize: '1rem' }}>₹{(manualEntry.jarsDelivered * (client?.contractTerms?.pricePerJar || 35)).toLocaleString()}</span>
                      </div>
                    )}

                    <div style={{ display: 'flex', gap: '12px', marginTop: '24px' }}>
                      <button
                        onClick={() => setShowAddEntry(false)}
                        style={{ flex: 1, padding: '14px', border: '1.5px solid #e2e8f0', borderRadius: '14px', fontWeight: 700, cursor: 'pointer', background: 'white', color: '#64748b', fontFamily: 'inherit' }}
                      >
                        Cancel
                      </button>
                      <button
                        onClick={handleAddManualEntry}
                        disabled={addingEntry}
                        style={{ flex: 2, padding: '14px', background: addingEntry ? '#6ee7b7' : '#10b981', color: 'white', border: 'none', borderRadius: '14px', fontWeight: 900, cursor: addingEntry ? 'wait' : 'pointer', fontSize: '0.95rem', fontFamily: 'inherit', boxShadow: '0 4px 12px rgba(16,185,129,0.3)' }}
                      >
                        {addingEntry ? 'Saving...' : '✓ Save Entry'}
                      </button>
                    </div>
                  </div>
                </div>
              )}

              <Card>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
                  <SectionTitle style={{ margin: 0 }}><FiTruck /> Store Delivery Log</SectionTitle>
                  <div style={{ display: 'flex', gap: '10px' }}>
                    <button
                      onClick={() => {
                        const defaultName = staffData?.name || currentUser?.displayName || 'Admin';
                        setManualEntry({
                          date: format(new Date(), 'yyyy-MM-dd'),
                          time: format(new Date(), 'HH:mm'),
                          jarsDelivered: 1,
                          jarsReturned: 0,
                          notes: '',
                          recordedBy: defaultName,
                        });
                        setShowCustomStaffInput(false);
                        setShowAddEntry(true);
                      }}
                      style={{ display: 'flex', alignItems: 'center', gap: '8px', background: '#020617', color: '#10b981', border: '1.5px solid #10b981', padding: '10px 18px', borderRadius: '12px', fontWeight: 800, fontSize: '0.85rem', cursor: 'pointer' }}
                      onMouseOver={e => { e.currentTarget.style.background = '#10b981'; e.currentTarget.style.color = 'white'; }}
                      onMouseOut={e => { e.currentTarget.style.background = '#020617'; e.currentTarget.style.color = '#10b981'; }}
                    >
                      <FiPlus size={15} /> Add Entry
                    </button>
                    <button
                      onClick={handleExportOrders}
                      style={{ display: 'flex', alignItems: 'center', gap: '8px', background: '#10b981', color: 'white', border: 'none', padding: '10px 18px', borderRadius: '12px', fontWeight: 800, fontSize: '0.85rem', cursor: 'pointer', boxShadow: '0 4px 12px rgba(16,185,129,0.25)' }}
                      onMouseOver={e => (e.currentTarget.style.background = '#059669')}
                      onMouseOut={e => (e.currentTarget.style.background = '#10b981')}
                    >
                      <FiDownload size={14} /> Export
                    </button>
                  </div>
                </div>

                {deliveryEntries.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '60px', color: '#64748b' }}>
                    <FiTruck size={40} style={{ display: 'block', margin: '0 auto 16px', opacity: 0.3 }} />
                    <p style={{ fontWeight: 700, marginBottom: '8px' }}>No delivery records yet.</p>
                    <p style={{ fontSize: '0.85rem' }}>Click <strong>+ Add Entry</strong> to log a manual delivery, or use the scanner.</p>
                  </div>
                ) : (
                  <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.9rem' }}>
                      <thead>
                        <tr style={{ background: '#f8fafc' }}>
                          {['Sl No', 'Date', 'Time', 'Jar Delivery', 'Jar Return', 'Amount', 'Delivered By', 'Action'].map(h => (
                            <th key={h} style={{ textAlign: 'left', padding: '14px 16px', color: '#64748b', fontSize: '0.75rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em', borderBottom: '2px solid #e2e8f0', whiteSpace: 'nowrap' }}>{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {deliveryEntries.map((entry, index) => {
                          const ts        = parseLedgerTimestamp(entry.timestamp);
                          const delivered = entry.deliveredCount ?? (entry.jarCount && entry.jarCount > 0 ? entry.jarCount : 0);
                          const returned  = entry.returnedCount  ?? (entry.jarCount && entry.jarCount < 0 ? Math.abs(entry.jarCount) : 0);
                          const by        = entry.recordedBy || '—';
                          const isDeleting = deletingId === entry.id;
                          return (
                            <tr key={entry.id} style={{ background: index % 2 === 0 ? 'white' : '#f8fafc', opacity: isDeleting ? 0.4 : 1, transition: 'opacity 0.2s' }}>
                              <td style={{ padding: '14px 16px', color: '#94a3b8', fontWeight: 700, fontSize: '0.8rem' }}>{index + 1}</td>
                              <td style={{ padding: '14px 16px', fontWeight: 700, color: '#020617' }}>{format(ts, 'dd MMM yyyy')}</td>
                              <td style={{ padding: '14px 16px', color: '#64748b', fontWeight: 600, fontFamily: 'Fira Code', fontSize: '0.8rem' }}>{format(ts, 'hh:mm a')}</td>
                              <td style={{ padding: '14px 16px' }}>
                                <span style={{ background: '#ecfdf5', color: '#065f46', padding: '4px 12px', borderRadius: '8px', fontWeight: 800 }}>+{delivered} 🫙</span>
                              </td>
                              <td style={{ padding: '14px 16px' }}>
                                {returned > 0
                                  ? <span style={{ background: '#fef2f2', color: '#991b1b', padding: '4px 12px', borderRadius: '8px', fontWeight: 800 }}>-{returned} ♻️</span>
                                  : <span style={{ color: '#cbd5e1' }}>—</span>}
                              </td>
                              <td style={{ padding: '14px 16px', fontWeight: 800, color: '#020617' }}>₹{(entry.amount ?? 0).toLocaleString()}</td>
                              <td style={{ padding: '14px 16px' }}>
                                {(() => {
                                  const uniqueStaffNames = Array.from(new Set([
                                    ...(staffList?.map(s => s.name) || []),
                                    ...(staffData?.name ? [staffData.name] : []),
                                    ...(currentUser?.displayName ? [currentUser.displayName] : []),
                                    'Rose', 'Moti', 'Sohal', 'Admin'
                                  ].filter(Boolean)));
                                  
                                  const isCurrentInList = uniqueStaffNames.includes(by) || by === '—';
                                  
                                  return (
                                    <select
                                      value={by === '—' ? '' : (isCurrentInList ? by : by)}
                                      onChange={async (e) => {
                                        const val = e.target.value;
                                        let newName = val;
                                        if (val === '__CUSTOM__') {
                                          const custom = prompt('Enter custom name for this delivery:', by !== '—' ? by : '');
                                          if (custom === null) return; // User cancelled prompt
                                          newName = custom.trim();
                                        }
                                        if (val === '') {
                                          newName = '—';
                                        }
                                        if (!newName) return;
                                        
                                        try {
                                          await updateDoc(doc(db, 'b2b_ledgers', entry.id), { recordedBy: newName });
                                          await loadData();
                                        } catch (err) {
                                          console.error('Failed to update delivery staff:', err);
                                          alert('Failed to update: ' + err);
                                        }
                                      }}
                                      style={{
                                        background: '#020617',
                                        color: '#10b981',
                                        border: '1.5px solid #1e293b',
                                        borderRadius: '8px',
                                        padding: '6px 12px',
                                        fontWeight: 800,
                                        fontSize: '0.8rem',
                                        fontFamily: 'inherit',
                                        outline: 'none',
                                        cursor: 'pointer',
                                        maxWidth: '150px'
                                      }}
                                    >
                                      <option value="" style={{ background: '#020617', color: '#64748b' }}>Select Staff...</option>
                                      {uniqueStaffNames.map(name => (
                                        <option key={name} value={name} style={{ background: '#020617', color: '#10b981' }}>{name}</option>
                                      ))}
                                      {by !== '—' && !uniqueStaffNames.includes(by) ? (
                                        <option value={by} style={{ background: '#020617', color: '#10b981' }}>{by}</option>
                                      ) : null}
                                      <option value="__CUSTOM__" style={{ background: '#020617', color: '#f59e0b' }}>✍️ Custom...</option>
                                    </select>
                                  );
                                })()}
                              </td>
                              <td style={{ padding: '14px 16px' }}>
                                <button
                                  onClick={() => entry.id && handleDeleteEntry(entry.id)}
                                  disabled={isDeleting}
                                  title="Delete this record"
                                  style={{ background: '#fef2f2', color: '#dc2626', border: '1.5px solid #fca5a5', borderRadius: '8px', padding: '6px 10px', cursor: isDeleting ? 'wait' : 'pointer', display: 'flex', alignItems: 'center', gap: '4px', fontWeight: 700, fontSize: '0.78rem', fontFamily: 'inherit', transition: 'all 0.15s' }}
                                  onMouseOver={e => { e.currentTarget.style.background = '#dc2626'; e.currentTarget.style.color = 'white'; }}
                                  onMouseOut={e => { e.currentTarget.style.background = '#fef2f2'; e.currentTarget.style.color = '#dc2626'; }}
                                >
                                  <FiTrash2 size={13} /> {isDeleting ? '...' : 'Delete'}
                                </button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                      <tfoot>
                        <tr style={{ background: '#f0fdf4', borderTop: '2px solid #10b981' }}>
                          <td colSpan={3} style={{ padding: '14px 16px', fontWeight: 800, color: '#065f46', fontSize: '0.85rem' }}>TOTALS ({deliveryEntries.length} deliveries)</td>
                          <td style={{ padding: '14px 16px', fontWeight: 800, color: '#065f46' }}>+{totDel} 🫙</td>
                          <td style={{ padding: '14px 16px', fontWeight: 800, color: '#991b1b' }}>{totRet > 0 ? `-${totRet} ♻️` : '—'}</td>
                          <td style={{ padding: '14px 16px', fontWeight: 800, color: '#020617' }}>₹{totAmt.toLocaleString()}</td>
                          <td colSpan={2} />
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                )}
              </Card>
            </>
          );
        })()}

        {activeTab === 'ledger' && (() => {
          // ── Compute HUD aggregates ──
          const totalDelivered = ledger.reduce((s, e) => s + (e.deliveredCount ?? (e.jarCount && e.jarCount > 0 ? e.jarCount : 0)), 0);
          const totalReturned  = ledger.reduce((s, e) => s + (e.returnedCount ?? (e.jarCount && e.jarCount < 0 ? Math.abs(e.jarCount) : 0)), 0);
          const totalValue     = ledger.reduce((s, e) => s + (e.amount ?? 0), 0);
          const netHeld        = totalDelivered - totalReturned;

          return (
            <>
              {/* ── Record Payment Modal ── */}
              {showAddPayment && (
                <div style={{ position: 'fixed', inset: 0, background: 'rgba(2,6,23,0.7)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', backdropFilter: 'blur(6px)' }}>
                  <div style={{ background: 'white', borderRadius: '24px', padding: '36px', width: '480px', maxWidth: '95vw', boxShadow: '0 32px 64px rgba(0,0,0,0.4)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '28px' }}>
                      <div>
                        <h2 style={{ fontSize: '1.3rem', fontWeight: 900, color: '#020617', margin: 0 }}>Record Payment</h2>
                        <p style={{ fontSize: '0.82rem', color: '#64748b', marginTop: '4px' }}>Log a ledger payment from this store</p>
                      </div>
                      <button onClick={() => setShowAddPayment(false)} style={{ background: '#f1f5f9', border: 'none', borderRadius: '10px', padding: '8px', cursor: 'pointer', color: '#64748b' }}>
                        <FiX size={18} />
                      </button>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                      <div style={{ gridColumn: 'span 2' }}>
                        <label style={{ fontSize: '0.75rem', fontWeight: 800, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em', display: 'block', marginBottom: '8px' }}>Amount Paid (₹) 💰</label>
                        <input
                          type="number"
                          min={0.01}
                          step="any"
                          value={paymentForm.amount}
                          onChange={e => setPaymentForm(p => ({ ...p, amount: e.target.value }))}
                          placeholder="e.g. 5000"
                          style={{ width: '100%', padding: '14px', border: '2px solid #10b981', borderRadius: '12px', fontSize: '1.2rem', fontWeight: 900, fontFamily: 'inherit', boxSizing: 'border-box', outline: 'none', background: '#f0fdf4', color: '#047857' }}
                        />
                      </div>
                      
                      <div>
                        <label style={{ fontSize: '0.75rem', fontWeight: 800, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em', display: 'block', marginBottom: '8px' }}>Date</label>
                        <input
                          type="date"
                          value={paymentForm.date}
                          onChange={e => setPaymentForm(p => ({ ...p, date: e.target.value }))}
                          style={{ width: '100%', padding: '12px', border: '1.5px solid #e2e8f0', borderRadius: '12px', fontSize: '0.9rem', fontFamily: 'inherit', boxSizing: 'border-box', outline: 'none' }}
                        />
                      </div>
                      <div>
                        <label style={{ fontSize: '0.75rem', fontWeight: 800, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em', display: 'block', marginBottom: '8px' }}>Time</label>
                        <input
                          type="time"
                          value={paymentForm.time}
                          onChange={e => setPaymentForm(p => ({ ...p, time: e.target.value }))}
                          style={{ width: '100%', padding: '12px', border: '1.5px solid #e2e8f0', borderRadius: '12px', fontSize: '0.9rem', fontFamily: 'inherit', boxSizing: 'border-box', outline: 'none' }}
                        />
                      </div>
                      
                      <div style={{ gridColumn: 'span 2' }}>
                        <label style={{ fontSize: '0.75rem', fontWeight: 800, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em', display: 'block', marginBottom: '8px' }}>Reference / Method (optional) 💳</label>
                        <input
                          type="text"
                          placeholder="e.g. UPI, Bank Transfer, Cash"
                          value={paymentForm.referenceId}
                          onChange={e => setPaymentForm(p => ({ ...p, referenceId: e.target.value }))}
                          style={{ width: '100%', padding: '12px', border: '1.5px solid #e2e8f0', borderRadius: '12px', fontSize: '0.9rem', fontFamily: 'inherit', boxSizing: 'border-box', outline: 'none' }}
                        />
                      </div>
                    </div>

                    {(() => {
                      const uniqueStaffNames = Array.from(new Set([
                        ...(staffList?.map(s => s.name) || []),
                        ...(staffData?.name ? [staffData.name] : []),
                        ...(currentUser?.displayName ? [currentUser.displayName] : []),
                        'Rose', 'Moti', 'Sohal', 'Admin'
                      ].filter(Boolean)));
                      return (
                        <div style={{ marginTop: '16px' }}>
                          <label style={{ fontSize: '0.75rem', fontWeight: 800, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em', display: 'block', marginBottom: '8px' }}>Collected By 👤</label>
                          <select
                            value={showCustomPaymentStaff ? '__CUSTOM__' : paymentForm.recordedBy}
                            onChange={e => {
                              if (e.target.value === '__CUSTOM__') {
                                setShowCustomPaymentStaff(true);
                                setPaymentForm(p => ({ ...p, recordedBy: '' }));
                              } else {
                                setShowCustomPaymentStaff(false);
                                setPaymentForm(p => ({ ...p, recordedBy: e.target.value }));
                              }
                            }}
                            style={{ width: '100%', padding: '12px', border: '1.5px solid #e2e8f0', borderRadius: '12px', fontSize: '0.9rem', fontWeight: 600, fontFamily: 'inherit', boxSizing: 'border-box', outline: 'none', background: '#f8fafc', color: '#020617' }}
                          >
                            {uniqueStaffNames.map(name => (
                              <option key={name} value={name}>{name}</option>
                            ))}
                            <option value="__CUSTOM__">✍️ Custom Name...</option>
                          </select>

                          {showCustomPaymentStaff && (
                            <div style={{ marginTop: '10px' }}>
                              <input
                                type="text"
                                placeholder="Type custom staff/admin name..."
                                value={paymentForm.recordedBy}
                                onChange={e => setPaymentForm(p => ({ ...p, recordedBy: e.target.value }))}
                                style={{ width: '100%', padding: '12px', border: '1.5px solid #e2e8f0', borderRadius: '12px', fontSize: '0.9rem', fontFamily: 'inherit', boxSizing: 'border-box', outline: 'none' }}
                              />
                            </div>
                          )}
                        </div>
                      );
                    })()}

                    <div style={{ marginTop: '16px' }}>
                      <label style={{ fontSize: '0.75rem', fontWeight: 800, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em', display: 'block', marginBottom: '8px' }}>Notes (optional)</label>
                      <textarea
                        value={paymentForm.notes}
                        onChange={e => setPaymentForm(p => ({ ...p, notes: e.target.value }))}
                        placeholder="e.g. Part payment received via GPAY, pending clearance"
                        rows={2}
                        style={{ width: '100%', padding: '12px', border: '1.5px solid #e2e8f0', borderRadius: '12px', fontSize: '0.88rem', fontFamily: 'inherit', boxSizing: 'border-box', resize: 'vertical', outline: 'none' }}
                      />
                    </div>

                    <div style={{ display: 'flex', gap: '12px', marginTop: '24px' }}>
                      <button
                        onClick={() => setShowAddPayment(false)}
                        style={{ flex: 1, padding: '14px', border: '1.5px solid #e2e8f0', borderRadius: '14px', fontWeight: 700, cursor: 'pointer', background: 'white', color: '#64748b', fontFamily: 'inherit' }}
                      >
                        Cancel
                      </button>
                      <button
                        onClick={handleAddPayment}
                        disabled={submittingPayment}
                        style={{ flex: 2, padding: '14px', background: submittingPayment ? '#6ee7b7' : '#10b981', color: 'white', border: 'none', borderRadius: '14px', fontWeight: 900, cursor: submittingPayment ? 'wait' : 'pointer', fontSize: '0.95rem', fontFamily: 'inherit', boxShadow: '0 4px 12px rgba(16,185,129,0.3)' }}
                      >
                        {submittingPayment ? 'Saving...' : '✓ Save Payment'}
                      </button>
                    </div>
                  </div>
                </div>
              )}

              <Card>
                {/* ── Header ── */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '28px' }}>
                  <SectionTitle style={{ margin: 0 }}><FiFileText /> Financial Ledger (Audit Trail)</SectionTitle>
                  <div style={{ display: 'flex', gap: '10px' }}>
                    <ActionButton $variant="primary" onClick={() => {
                      setPaymentForm({
                        date: format(new Date(), 'yyyy-MM-dd'),
                        time: format(new Date(), 'HH:mm'),
                        amount: '',
                        referenceId: '',
                        recordedBy: staffData?.name || currentUser?.displayName || '',
                        notes: '',
                      });
                      setShowCustomPaymentStaff(false);
                      setShowAddPayment(true);
                    }}>
                      <FiDollarSign /> Record Payment
                    </ActionButton>
                    <ActionButton $variant="secondary" onClick={() => {
                      setIsHandoverOpen(true);
                      setDeliveryStep('scan_delivery');
                      setIsCameraActive(false);
                    }}>
                      <FiTruck /> Record Delivery
                    </ActionButton>
                    <button
                      onClick={handleExportLedger}
                      style={{
                        display: 'flex', alignItems: 'center', gap: '8px',
                        background: '#10b981', color: 'white', border: 'none',
                        padding: '10px 20px', borderRadius: '12px', fontWeight: 800,
                        fontSize: '0.85rem', cursor: 'pointer',
                        boxShadow: '0 4px 12px rgba(16,185,129,0.25)',
                        transition: 'all 0.2s'
                      }}
                      onMouseOver={e => (e.currentTarget.style.background = '#059669')}
                      onMouseOut={e => (e.currentTarget.style.background = '#10b981')}
                    >
                      <FiDownload size={14} /> Export Ledger
                    </button>
                  </div>
                </div>

                {/* ── HUD Stats Cards ── */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '16px', marginBottom: '32px' }}>
                  {[
                    { label: 'Total Delivered', value: `${totalDelivered} Jars`, color: '#10b981', bg: '#ecfdf5', border: '#a7f3d0' },
                    { label: 'Total Returned', value: `${totalReturned} Jars`, color: '#ef4444', bg: '#fef2f2', border: '#fca5a5' },
                    { label: 'Net Held at Client', value: `${netHeld} Jars`, color: netHeld >= 0 ? '#059669' : '#dc2626', bg: netHeld >= 0 ? '#f0fdf4' : '#fef2f2', border: netHeld >= 0 ? '#6ee7b7' : '#fca5a5' },
                    { label: 'Total Value', value: `₹${totalValue.toLocaleString()}`, color: '#020617', bg: '#f8fafc', border: '#e2e8f0' },
                  ].map(card => (
                    <div key={card.label} style={{ background: card.bg, border: `1px solid ${card.border}`, borderRadius: '16px', padding: '20px' }}>
                      <div style={{ fontSize: '0.7rem', fontWeight: 800, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '8px' }}>{card.label}</div>
                      <div style={{ fontSize: '1.4rem', fontWeight: 800, color: card.color }}>{card.value}</div>
                    </div>
                  ))}
                </div>

                {/* ── Monthly Accordion ── */}
                {ledger.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '60px', color: '#64748b' }}>
                    <FiFileText size={40} style={{ display: 'block', margin: '0 auto 16px', opacity: 0.3 }} />
                    No ledger entries found.
                  </div>
                ) : (
                  Object.entries(
                    ledger.reduce((groups: Record<string, any[]>, entry) => {
                      const month = format(parseLedgerTimestamp(entry.timestamp), 'MMMM yyyy');
                      if (!groups[month]) groups[month] = [];
                      groups[month].push(entry);
                      return groups;
                    }, {})
                  ).sort(([monthA], [monthB]) => {
                    const dateA = new Date(`01 ${monthA}`).getTime();
                    const dateB = new Date(`01 ${monthB}`).getTime();
                    return dateB - dateA;
                  }).map(([month, entries]: [string, any[]]) => {
                    const sortedEntries = [...entries].sort((a, b) => {
                      return parseLedgerTimestamp(b.timestamp).getTime() - parseLedgerTimestamp(a.timestamp).getTime();
                    });
                    const mDelivered = sortedEntries.reduce((s, e) => s + (e.deliveredCount ?? (e.jarCount && e.jarCount > 0 ? e.jarCount : 0)), 0);
                    const mBilled = sortedEntries.reduce((s, e) => {
                      if (['delivery_handover', 'jar_delivery', 'invoice_issued', 'manual_adjustment'].includes(e.type)) {
                        return s + (e.amount ?? 0);
                      }
                      return s;
                    }, 0);
                    const mPaid = sortedEntries.reduce((s, e) => s + (e.type === 'payment_received' ? (e.amount ?? 0) : 0), 0);
                    const mDue = Math.max(0, mBilled - mPaid);

                    let paymentStatus: 'fully_paid' | 'partial' | 'unpaid' = 'unpaid';
                    if (mBilled === 0 || mPaid >= mBilled) {
                      paymentStatus = 'fully_paid';
                    } else if (mPaid > 0) {
                      paymentStatus = 'partial';
                    }

                    return (
                      <div key={month} style={{ marginBottom: '20px' }}>
                        <button
                          onClick={() => setExpandedMonths(prev =>
                            prev.includes(month) ? prev.filter(m => m !== month) : [...prev, month]
                          )}
                          style={{
                            width: '100%', textAlign: 'left', padding: '18px 20px',
                            background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '14px',
                            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                            cursor: 'pointer', fontWeight: 800, color: '#020617', fontFamily: 'inherit',
                            marginBottom: expandedMonths.includes(month) ? '10px' : '0'
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: '16px', flexWrap: 'wrap' }}>
                            <span style={{ fontSize: '1rem' }}>{month}</span>
                            {isSameMonth(new Date(`01 ${month}`), new Date()) && (
                              <span style={{ fontSize: '0.65rem', padding: '3px 8px', background: '#ecfdf5', color: '#065f46', borderRadius: '6px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Running</span>
                            )}
                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '0.78rem', flexWrap: 'wrap' }}>
                              <span style={{ color: '#64748b', fontWeight: 700 }}>{mDelivered} Jars</span>
                              <span style={{ color: '#cbd5e1' }}>•</span>
                              <span style={{ color: '#475569', fontWeight: 700 }}>Billed: <strong style={{ color: '#020617' }}>₹{mBilled.toLocaleString()}</strong></span>
                              <span style={{ color: '#cbd5e1' }}>•</span>
                              <span style={{ color: '#475569', fontWeight: 700 }}>Paid: <strong style={{ color: '#16a34a' }}>₹{mPaid.toLocaleString()}</strong></span>
                              {paymentStatus === 'fully_paid' && (
                                <span style={{ fontSize: '0.65rem', padding: '3px 8px', background: '#ecfdf5', color: '#047857', border: '1px solid #10b981', borderRadius: '8px', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.04em' }}>✓ Fully Paid</span>
                              )}
                              {paymentStatus === 'partial' && (
                                <span style={{ fontSize: '0.65rem', padding: '3px 8px', background: '#fffbeb', color: '#b45309', border: '1px solid #f59e0b', borderRadius: '8px', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.04em' }}>⚡ Partial (₹{mDue.toLocaleString()} Due)</span>
                              )}
                              {paymentStatus === 'unpaid' && mBilled > 0 && (
                                <span style={{ fontSize: '0.65rem', padding: '3px 8px', background: '#fef2f2', color: '#b91c1c', border: '1px solid #f87171', borderRadius: '8px', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.04em' }}>⚠️ Unpaid (₹{mDue.toLocaleString()} Due)</span>
                              )}
                            </div>
                          </div>
                          <FiClock style={{ transform: expandedMonths.includes(month) ? 'rotate(90deg)' : 'none', transition: 'transform 0.2s', color: '#64748b' }} />
                        </button>

                        {expandedMonths.includes(month) && (
                          <div style={{ overflowX: 'auto' }}>
                            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.88rem' }}>
                              <thead>
                                <tr style={{ background: '#f8fafc' }}>
                                  {['Sl No', 'Date', 'Time', 'Type', 'Reference', 'Delivered', 'Returned', 'Price/Jar', 'Total Value', 'Notes', 'Action'].map(h => (
                                    <th key={h} style={{ textAlign: 'left', padding: '12px 14px', color: '#64748b', fontSize: '0.72rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.04em', borderBottom: '2px solid #e2e8f0', whiteSpace: 'nowrap' }}>{h}</th>
                                  ))}
                                </tr>
                              </thead>
                              <tbody>
                                {sortedEntries.map((entry, idx) => {
                                  const ts = parseLedgerTimestamp(entry.timestamp);
                                  const delivered = entry.deliveredCount ?? (entry.jarCount && entry.jarCount > 0 ? entry.jarCount : 0);
                                  const returned  = entry.returnedCount ?? (entry.jarCount && entry.jarCount < 0 ? Math.abs(entry.jarCount) : 0);
                                  const price = delivered > 0 && entry.amount ? Math.round(entry.amount / delivered) : (client?.contractTerms?.pricePerJar || 0);
                                  const isEven = idx % 2 === 0;
                                  const isDeleting = deletingId === entry.id;
                                  return (
                                    <tr key={entry.id} style={{ background: isEven ? 'white' : '#f8fafc', opacity: isDeleting ? 0.4 : 1, transition: 'opacity 0.2s' }}>
                                      <td style={{ padding: '12px 14px', color: '#94a3b8', fontWeight: 700, fontSize: '0.78rem' }}>{idx + 1}</td>
                                      <td style={{ padding: '12px 14px', fontWeight: 700, color: '#020617', whiteSpace: 'nowrap' }}>{format(ts, 'dd MMM yyyy')}</td>
                                      <td style={{ padding: '12px 14px', color: '#64748b', fontFamily: 'Fira Code', fontSize: '0.78rem', fontWeight: 600, whiteSpace: 'nowrap' }}>{format(ts, 'hh:mm a')}</td>
                                      <td style={{ padding: '12px 14px' }}>
                                        <StatusBadge $status={entry.type === 'payment_received' ? 'active' : (['jar_delivery','delivery_handover'].includes(entry.type) ? 'active' : 'pending')}>
                                          {entry.type?.replace(/_/g, ' ')}
                                        </StatusBadge>
                                      </td>
                                      <td style={{ padding: '12px 14px', fontFamily: 'Fira Code', fontSize: '0.78rem', fontWeight: 600, color: '#3b82f6' }}>{entry.referenceId || entry.id?.slice(0,10) || 'N/A'}</td>
                                      <td style={{ padding: '12px 14px' }}>
                                        {delivered > 0
                                          ? <span style={{ background: '#ecfdf5', color: '#065f46', padding: '3px 10px', borderRadius: '7px', fontWeight: 800, fontSize: '0.85rem' }}>+{delivered}</span>
                                          : <span style={{ color: '#cbd5e1' }}>—</span>}
                                      </td>
                                      <td style={{ padding: '12px 14px' }}>
                                        {returned > 0
                                          ? <span style={{ background: '#fef2f2', color: '#991b1b', padding: '3px 10px', borderRadius: '7px', fontWeight: 800, fontSize: '0.85rem' }}>-{returned}</span>
                                          : <span style={{ color: '#cbd5e1' }}>—</span>}
                                      </td>
                                      <td style={{ padding: '12px 14px', fontFamily: 'Fira Code', fontWeight: 700, color: '#020617' }}>{entry.type === 'payment_received' ? '—' : `₹${price}`}</td>
                                      <td style={{ padding: '12px 14px', fontWeight: 800, color: entry.amount ? (entry.type === 'payment_received' ? '#16a34a' : '#020617') : '#cbd5e1' }}>
                                        {entry.amount ? (entry.type === 'payment_received' ? `- ₹${entry.amount.toLocaleString()}` : `₹${entry.amount.toLocaleString()}`) : '—'}
                                      </td>
                                      <td style={{ padding: '12px 14px', fontSize: '0.82rem', color: '#475569', maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={entry.description}>{entry.description || '—'}</td>
                                      <td style={{ padding: '12px 14px', whiteSpace: 'nowrap' }}>
                                        <div style={{ display: 'flex', gap: '8px' }}>
                                          <button
                                            onClick={() => handleOpenEditModal(entry)}
                                            title="Correct this record"
                                            style={{ background: '#f8fafc', color: '#3b82f6', border: '1.5px solid #bfdbfe', borderRadius: '8px', padding: '6px 10px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px', fontWeight: 700, fontSize: '0.78rem', fontFamily: 'inherit', transition: 'all 0.15s' }}
                                            onMouseOver={e => { e.currentTarget.style.background = '#3b82f6'; e.currentTarget.style.color = 'white'; }}
                                            onMouseOut={e => { e.currentTarget.style.background = '#f8fafc'; e.currentTarget.style.color = '#3b82f6'; }}
                                          >
                                            Edit
                                          </button>
                                          <button
                                            onClick={() => entry.id && handleDeleteEntry(entry.id)}
                                            disabled={isDeleting}
                                            title="Delete this record"
                                            style={{ background: '#fef2f2', color: '#dc2626', border: '1.5px solid #fca5a5', borderRadius: '8px', padding: '6px 10px', cursor: isDeleting ? 'wait' : 'pointer', display: 'flex', alignItems: 'center', gap: '4px', fontWeight: 700, fontSize: '0.78rem', fontFamily: 'inherit', transition: 'all 0.15s' }}
                                            onMouseOver={e => { e.currentTarget.style.background = '#dc2626'; e.currentTarget.style.color = 'white'; }}
                                            onMouseOut={e => { e.currentTarget.style.background = '#fef2f2'; e.currentTarget.style.color = '#dc2626'; }}
                                          >
                                            {isDeleting ? '...' : 'Delete'}
                                          </button>
                                        </div>
                                      </td>
                                    </tr>
                                  );
                                })}
                              </tbody>
                              <tfoot>
                                <tr style={{ background: '#f8fafc', borderTop: '2px solid #cbd5e1' }}>
                                  <td colSpan={5} style={{ padding: '14px 16px', fontWeight: 800, color: '#475569', fontSize: '0.82rem' }}>MONTHLY SUMMARY ({sortedEntries.length} entries)</td>
                                  <td style={{ padding: '14px 16px', fontWeight: 800 }}>
                                    <span style={{ background: '#ecfdf5', color: '#047857', border: '1px solid #10b981', padding: '4px 10px', borderRadius: '8px', fontSize: '0.85rem' }}>+{mDelivered} Jars</span>
                                  </td>
                                  <td colSpan={2} style={{ padding: '14px 16px', textAlign: 'right', fontWeight: 700, color: '#64748b', fontSize: '0.8rem' }}>
                                    Billed: ₹{mBilled.toLocaleString()} | Paid: ₹{mPaid.toLocaleString()}
                                  </td>
                                  <td style={{ padding: '14px 16px', fontWeight: 800, color: mDue > 0 ? '#ef4444' : '#16a34a' }}>
                                    Due: ₹{mDue.toLocaleString()}
                                  </td>
                                  <td colSpan={2} />
                                </tr>
                              </tfoot>
                            </table>
                          </div>
                        )}
                      </div>
                    );
                  })
                )}
              </Card>
            </>
          );
        })()}

        {activeTab === 'billing' && (() => {
          // Group and sort ledger entries chronologically (oldest to newest) to compute carry forwards
          const monthlyLedgerFlow = (() => {
            if (!ledger || ledger.length === 0) return [];
            
            // Group by year-month key
            const groups: Record<string, any[]> = {};
            ledger.forEach(entry => {
              const monthKey = format(parseLedgerTimestamp(entry.timestamp), 'yyyy-MM');
              if (!groups[monthKey]) groups[monthKey] = [];
              groups[monthKey].push(entry);
            });
            
            // Sort keys ascending (oldest to newest)
            const sortedMonthKeys = Object.keys(groups).sort();
            
            let runningCarryForward = 0;
            const monthlyStats = sortedMonthKeys.map(key => {
              const monthEntries = groups[key];
              const monthDate = new Date(`${key}-01T00:00:00`);
              const monthLabel = format(monthDate, 'MMMM yyyy');
              
              // Calculate billed (deliveries and adjustments) in this month
              const billedInMonth = monthEntries.reduce((s, e) => {
                if (['delivery_handover', 'jar_delivery', 'invoice_issued', 'manual_adjustment'].includes(e.type)) {
                  return s + (e.amount ?? 0);
                }
                return s;
              }, 0);
              
              // Calculate paid (payments received) in this month
              const paidInMonth = monthEntries.reduce((s, e) => {
                if (e.type === 'payment_received') {
                  return s + (e.amount ?? 0);
                }
                return s;
              }, 0);
              
              const openingBalance = runningCarryForward;
              const closingBalance = openingBalance + billedInMonth - paidInMonth;
              
              // Keep tracking carry forward for next month
              runningCarryForward = closingBalance;
              
              // Separate out list of payments and handovers for detailed views
              const monthPayments = monthEntries.filter(e => e.type === 'payment_received').sort((a,b) => parseLedgerTimestamp(b.timestamp).getTime() - parseLedgerTimestamp(a.timestamp).getTime());
              const monthDeliveries = monthEntries.filter(e => ['delivery_handover', 'jar_delivery'].includes(e.type)).sort((a,b) => parseLedgerTimestamp(b.timestamp).getTime() - parseLedgerTimestamp(a.timestamp).getTime());
              
              return {
                monthKey: key,
                monthLabel,
                openingBalance,
                billedInMonth,
                paidInMonth,
                closingBalance,
                payments: monthPayments,
                deliveries: monthDeliveries,
                entries: monthEntries
              };
            });
            
            // Return newest month first for display
            return [...monthlyStats].reverse();
          })();

          return (
            <Card>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '32px', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
                <div>
                  <SectionTitle style={{ marginBottom: '8px' }}><FiDollarSign /> Billing & Statements</SectionTitle>
                  <p style={{ color: '#64748b', fontSize: '0.9rem', margin: 0 }}>Current Cycle: <strong style={{ color: '#020617' }}>{client.contractTerms?.billingCycle}</strong> (Credit: {client.contractTerms?.creditPeriod} days)</p>
                </div>
                <div style={{ display: 'flex', gap: '12px' }}>
                  <ActionButton $variant="primary" onClick={() => setShowAddPayment(true)}>
                     <FiPlus /> Record Payment
                  </ActionButton>
                </div>
              </div>

              {/* Dynamic Billing Overview Cards */}
              <InfoGrid style={{ marginBottom: '40px' }}>
                <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', padding: '24px', borderRadius: '20px' }}>
                  <label style={{ fontSize: '0.72rem', fontWeight: 800, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Unbilled Outstanding</label>
                  <div style={{ fontSize: '1.8rem', fontWeight: 900, color: '#020617', marginTop: '6px' }}>₹{calculatedOutstanding.toLocaleString()}</div>
                  <p style={{ fontSize: '0.8rem', color: '#64748b', marginTop: '6px', margin: 0 }}>Net current unbilled balance</p>
                </div>
                <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', padding: '24px', borderRadius: '20px' }}>
                  <label style={{ fontSize: '0.72rem', fontWeight: 800, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Estimated GST (18%)</label>
                  <div style={{ fontSize: '1.8rem', fontWeight: 900, color: '#020617', marginTop: '6px' }}>₹{(Math.floor(calculatedOutstanding * 0.18)).toLocaleString()}</div>
                  <p style={{ fontSize: '0.8rem', color: '#64748b', marginTop: '6px', margin: 0 }}>CGST: 9% | SGST: 9%</p>
                </div>
                <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', padding: '24px', borderRadius: '20px' }}>
                  <label style={{ fontSize: '0.72rem', fontWeight: 800, color: '#16a34a', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Total Lifetime Revenue</label>
                  <div style={{ fontSize: '1.8rem', fontWeight: 900, color: '#16a34a', marginTop: '6px' }}>₹{calculatedLifetimeRevenue.toLocaleString()}</div>
                  <p style={{ fontSize: '0.8rem', color: '#15803d', marginTop: '6px', margin: 0 }}>Sum of all deliveries to date</p>
                </div>
              </InfoGrid>

              <SectionTitle style={{ fontSize: '1.2rem', marginBottom: '24px' }}><FiClock /> Monthly Billing Cycles & Carry-Forward Ledger</SectionTitle>
              
              {monthlyLedgerFlow.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '60px', color: '#64748b', background: '#f8fafc', borderRadius: '20px', border: '1px dashed #cbd5e1' }}>
                  <FiDollarSign size={40} style={{ display: 'block', margin: '0 auto 16px', opacity: 0.3 }} />
                  No billing history available yet.
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                  {monthlyLedgerFlow.map((flow: any) => {
                    const isExpanded = expandedBillingMonths.includes(flow.monthLabel);
                    
                    return (
                      <div key={flow.monthKey} style={{ border: '1px solid #e2e8f0', borderRadius: '20px', background: 'white', overflow: 'hidden', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.02)' }}>
                        {/* Month Header / Math Flow */}
                        <div 
                          onClick={() => setExpandedBillingMonths(prev => 
                            prev.includes(flow.monthLabel) ? prev.filter(m => m !== flow.monthLabel) : [...prev, flow.monthLabel]
                          )}
                          style={{
                            padding: '24px', background: '#f8fafc', borderBottom: isExpanded ? '1px solid #e2e8f0' : 'none',
                            display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer', flexWrap: 'wrap', gap: '16px'
                          }}
                        >
                          <div>
                            <h3 style={{ fontSize: '1.1rem', fontWeight: 900, color: '#020617', margin: 0 }}>{flow.monthLabel}</h3>
                            <div style={{ display: 'flex', gap: '8px', marginTop: '6px', alignItems: 'center' }}>
                              {flow.closingBalance === 0 ? (
                                <span style={{ background: '#ecfdf5', color: '#065f46', border: '1px solid #10b981', fontSize: '0.65rem', padding: '3px 8px', borderRadius: '8px', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.04em' }}>✓ Fully Paid</span>
                              ) : flow.closingBalance < 0 ? (
                                <span style={{ background: '#f0fdf4', color: '#16a34a', border: '1px solid #22c55e', fontSize: '0.65rem', padding: '3px 8px', borderRadius: '8px', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.04em' }}>💸 Advance Credit</span>
                              ) : (
                                <span style={{ background: '#fffbeb', color: '#b45309', border: '1px solid #f59e0b', fontSize: '0.65rem', padding: '3px 8px', borderRadius: '8px', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.04em' }}>⚠️ Dues Outstanding</span>
                              )}
                            </div>
                          </div>

                          {/* Step-by-Step Math Flow */}
                          <div style={{ display: 'flex', alignItems: 'center', gap: '16px', flexWrap: 'wrap' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.85rem' }}>
                              <div style={{ textAlign: 'center' }}>
                                <span style={{ display: 'block', fontSize: '0.65rem', color: '#64748b', fontWeight: 800, textTransform: 'uppercase' }}>Opening</span>
                                <span style={{ fontWeight: 700, color: '#475569' }}>₹{flow.openingBalance.toLocaleString()}</span>
                              </div>
                              <span style={{ color: '#94a3b8', fontWeight: 900 }}>+</span>
                              <div style={{ textAlign: 'center' }}>
                                <span style={{ display: 'block', fontSize: '0.65rem', color: '#64748b', fontWeight: 800, textTransform: 'uppercase' }}>Billed</span>
                                <span style={{ fontWeight: 800, color: '#020617' }}>₹{flow.billedInMonth.toLocaleString()}</span>
                              </div>
                              <span style={{ color: '#94a3b8', fontWeight: 900 }}>-</span>
                              <div style={{ textAlign: 'center' }}>
                                <span style={{ display: 'block', fontSize: '0.65rem', color: '#64748b', fontWeight: 800, textTransform: 'uppercase' }}>Collected</span>
                                <span style={{ fontWeight: 800, color: '#16a34a' }}>₹{flow.paidInMonth.toLocaleString()}</span>
                              </div>
                              <span style={{ color: '#94a3b8', fontWeight: 900 }}>=</span>
                              <div style={{ textAlign: 'center', background: flow.closingBalance > 0 ? '#fef2f2' : (flow.closingBalance < 0 ? '#f0fdf4' : '#ecfdf5'), padding: '6px 12px', borderRadius: '10px', border: `1px solid ${flow.closingBalance > 0 ? '#f87171' : (flow.closingBalance < 0 ? '#bbf7d0' : '#10b981')}` }}>
                                <span style={{ display: 'block', fontSize: '0.65rem', color: flow.closingBalance > 0 ? '#b91c1c' : (flow.closingBalance < 0 ? '#15803d' : '#065f46'), fontWeight: 900, textTransform: 'uppercase' }}>Carry Forward</span>
                                <span style={{ fontWeight: 900, color: flow.closingBalance > 0 ? '#dc2626' : (flow.closingBalance < 0 ? '#16a34a' : '#059669') }}>₹{flow.closingBalance.toLocaleString()}</span>
                              </div>
                            </div>
                            <FiPlus style={{ transform: isExpanded ? 'rotate(45deg)' : 'none', transition: 'transform 0.2s', color: '#64748b', cursor: 'pointer' }} size={20} />
                          </div>
                        </div>

                        {/* Month Details Breakdown */}
                        {isExpanded && (
                          <div style={{ padding: '24px' }}>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px', breakInside: 'avoid' }}>
                              
                              {/* Left: Deliveries & Charges (Dues) */}
                              <div style={{ border: '1px solid #f1f5f9', borderRadius: '16px', padding: '18px', background: '#fafafa' }}>
                                <h4 style={{ margin: '0 0 16px', fontSize: '0.85rem', color: '#020617', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '8px', borderBottom: '2px solid #e2e8f0', paddingBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                                  <span style={{ width: '8px', height: '8px', background: '#3b82f6', borderRadius: '50%' }} /> Billed Deliveries ({flow.deliveries.length})
                                </h4>
                                {flow.deliveries.length === 0 ? (
                                  <p style={{ fontSize: '0.85rem', color: '#64748b', margin: '16px 0', textAlign: 'center', fontStyle: 'italic' }}>No deliveries logged in this cycle.</p>
                                ) : (
                                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', maxHeight: '250px', overflowY: 'auto', paddingRight: '4px' }}>
                                    {flow.deliveries.map((entry: any) => {
                                      const dTime = parseLedgerTimestamp(entry.timestamp);
                                      const devJars = entry.deliveredCount ?? (entry.jarCount > 0 ? entry.jarCount : 0);
                                      const retJars = entry.returnedCount ?? (entry.jarCount < 0 ? Math.abs(entry.jarCount) : 0);
                                      return (
                                        <div key={entry.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 14px', background: 'white', borderRadius: '12px', border: '1px solid #e2e8f0', fontSize: '0.82rem', transition: 'all 0.2s' }}>
                                          <div style={{ flex: 1 }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                              <span style={{ fontWeight: 800, color: '#020617' }}>{format(dTime, 'dd MMM, hh:mm a')}</span>
                                              <span style={{ fontSize: '0.65rem', padding: '2px 6px', background: '#f1f5f9', color: '#475569', borderRadius: '4px', fontWeight: 600 }}>Delivery</span>
                                            </div>
                                            <span style={{ display: 'block', fontSize: '0.72rem', color: '#64748b', marginTop: '4px' }}>
                                              {devJars} Del / {retJars} Ret • by <strong style={{ color: '#475569' }}>{entry.recordedBy || 'admin'}</strong>
                                            </span>
                                            {entry.description && (
                                              <span style={{ display: 'block', fontSize: '0.7rem', color: '#94a3b8', fontStyle: 'italic', marginTop: '2px' }}>"{entry.description}"</span>
                                            )}
                                          </div>
                                          
                                          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '8px', marginLeft: '12px' }}>
                                            <div style={{ fontWeight: 900, color: '#020617', fontSize: '0.9rem' }}>
                                              ₹{(entry.amount || 0).toLocaleString()}
                                            </div>
                                            <div style={{ display: 'flex', gap: '6px' }}>
                                              <button 
                                                onClick={() => handleOpenEditModal(entry)}
                                                style={{ background: 'transparent', border: 'none', color: '#3b82f6', cursor: 'pointer', padding: '2px', display: 'flex', alignItems: 'center', fontSize: '0.75rem', fontWeight: 700 }}
                                                title="Correct this entry"
                                              >
                                                Edit
                                              </button>
                                              <span style={{ color: '#cbd5e1' }}>|</span>
                                              <button 
                                                onClick={() => entry.id && handleDeleteEntry(entry.id)}
                                                style={{ background: 'transparent', border: 'none', color: '#ef4444', cursor: 'pointer', padding: '2px', display: 'flex', alignItems: 'center', fontSize: '0.75rem', fontWeight: 700 }}
                                                title="Delete entry"
                                              >
                                                Delete
                                              </button>
                                            </div>
                                          </div>
                                        </div>
                                      );
                                    })}
                                  </div>
                                )}
                                <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '16px', background: '#f8fafc', padding: '10px 12px', borderRadius: '8px', border: '1px solid #e2e8f0', fontSize: '0.85rem', fontWeight: 800 }}>
                                  <span style={{ color: '#475569' }}>Total Billed Dues:</span>
                                  <span style={{ color: '#020617' }}>₹{flow.billedInMonth.toLocaleString()}</span>
                                </div>
                              </div>

                              {/* Right: Collected Payments */}
                              <div style={{ border: '1px solid #f1f5f9', borderRadius: '16px', padding: '18px', background: '#fafafa' }}>
                                <h4 style={{ margin: '0 0 16px', fontSize: '0.85rem', color: '#16a34a', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '8px', borderBottom: '2px solid #bbf7d0', paddingBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                                  <span style={{ width: '8px', height: '8px', background: '#16a34a', borderRadius: '50%' }} /> Collected Payments ({flow.payments.length})
                                </h4>
                                {flow.payments.length === 0 ? (
                                  <p style={{ fontSize: '0.85rem', color: '#64748b', margin: '16px 0', textAlign: 'center', fontStyle: 'italic' }}>No payments collected in this cycle.</p>
                                ) : (
                                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', maxHeight: '250px', overflowY: 'auto', paddingRight: '4px' }}>
                                    {flow.payments.map((entry: any) => {
                                      const pTime = parseLedgerTimestamp(entry.timestamp);
                                      return (
                                        <div key={entry.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 14px', background: 'white', borderRadius: '12px', border: '1px solid #e2e8f0', fontSize: '0.82rem', transition: 'all 0.2s' }}>
                                          <div style={{ flex: 1 }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                              <span style={{ fontWeight: 800, color: '#16a34a' }}>{format(pTime, 'dd MMM, hh:mm a')}</span>
                                              <span style={{ fontSize: '0.65rem', padding: '2px 6px', background: '#ecfdf5', color: '#15803d', borderRadius: '4px', fontWeight: 600 }}>Payment</span>
                                            </div>
                                            <span style={{ display: 'block', fontSize: '0.72rem', color: '#64748b', marginTop: '4px' }}>
                                              Ref: <strong style={{ color: '#3b82f6', fontFamily: 'Fira Code' }}>{entry.referenceId || entry.id?.slice(0, 10)}</strong> • by <strong style={{ color: '#475569' }}>{entry.recordedBy || 'admin'}</strong>
                                            </span>
                                            {entry.description && (
                                              <span style={{ display: 'block', fontSize: '0.7rem', color: '#94a3b8', fontStyle: 'italic', marginTop: '2px' }}>"{entry.description}"</span>
                                            )}
                                          </div>
                                          
                                          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '8px', marginLeft: '12px' }}>
                                            <div style={{ fontWeight: 900, color: '#16a34a', fontSize: '0.9rem' }}>
                                              - ₹{(entry.amount || 0).toLocaleString()}
                                            </div>
                                            <div style={{ display: 'flex', gap: '6px' }}>
                                              <button 
                                                onClick={() => handleOpenEditModal(entry)}
                                                style={{ background: 'transparent', border: 'none', color: '#3b82f6', cursor: 'pointer', padding: '2px', display: 'flex', alignItems: 'center', fontSize: '0.75rem', fontWeight: 700 }}
                                                title="Correct this entry"
                                              >
                                                Edit
                                              </button>
                                              <span style={{ color: '#cbd5e1' }}>|</span>
                                              <button 
                                                onClick={() => entry.id && handleDeleteEntry(entry.id)}
                                                style={{ background: 'transparent', border: 'none', color: '#ef4444', cursor: 'pointer', padding: '2px', display: 'flex', alignItems: 'center', fontSize: '0.75rem', fontWeight: 700 }}
                                                title="Delete entry"
                                              >
                                                Delete
                                              </button>
                                            </div>
                                          </div>
                                        </div>
                                      );
                                    })}
                                  </div>
                                )}
                                <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '16px', background: '#f0fdf4', padding: '10px 12px', borderRadius: '8px', border: '1px solid #bbf7d0', fontSize: '0.85rem', fontWeight: 800 }}>
                                  <span style={{ color: '#15803d' }}>Total Collected Payments:</span>
                                  <span style={{ color: '#16a34a' }}>₹{flow.paidInMonth.toLocaleString()}</span>
                                </div>
                              </div>

                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </Card>
          );
        })()}

        {activeTab === 'contacts' && (
          <Card>
            <SectionTitle><FiUsers /> Primary Stakeholders</SectionTitle>
            <InfoGrid>
              <InfoItem>
                <label>Primary Contact</label>
                <span>{client?.primaryContact?.name || 'Not Provided'}</span>
              </InfoItem>
              <InfoItem>
                <label>Designation</label>
                <span>{client?.primaryContact?.designation || 'Manager'}</span>
              </InfoItem>
              <InfoItem>
                <label>Phone Number</label>
                <span>{client?.primaryContact?.phone || 'N/A'}</span>
              </InfoItem>
              <InfoItem>
                <label>Email Address</label>
                <span>{client?.primaryContact?.email || 'N/A'}</span>
              </InfoItem>
            </InfoGrid>
          </Card>
        )}
      </TabContainer>

      {/* Handover Modal */}
      {isHandoverOpen && (
        <HandoverModal onClick={() => {
          setIsCameraActive(false);
          setIsHandoverOpen(false);
          setDeliveryStep('idle');
        }}>
          <HandoverContent onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
              <h2 style={{ fontSize: '1.5rem', fontWeight: 800, margin: 0 }}>Enterprise Handover</h2>
              <FiPlus 
                style={{ transform: 'rotate(45deg)', cursor: 'pointer', opacity: 0.5 }} 
                size={24} 
                onClick={() => { 
                  setIsHandoverOpen(false); 
                  setDeliveryStep('idle'); 
                  setIsCameraActive(false);
                }} 
              />
            </div>

            <ProgressDots>
              <div className={`dot ${deliveryStep === 'scan_delivery' ? 'active' : ''}`} />
              <div className={`dot ${deliveryStep === 'scan_return' ? 'active' : ''}`} />
              <div className={`dot ${deliveryStep === 'finalize' ? 'active' : ''}`} />
            </ProgressDots>

            {conflict ? (
              /* Conflict UI */
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', textAlign: 'center' }}>
                <FiAlertTriangle size={48} color="#ef4444" style={{ margin: '0 auto' }} />
                <h3 style={{ fontSize: '1.2rem', fontWeight: 800, color: '#ef4444', margin: 0 }}>
                  {conflict.type === 'delivery' ? 'Jar Ownership Conflict' : 'Return Exception Detected'}
                </h3>
                <p style={{ fontSize: '0.9rem', opacity: 0.8, margin: 0 }}>
                  Jar <strong style={{ color: '#10b981' }}>{conflict.jarId}</strong> is currently assigned to:
                  <br />
                  <strong style={{ color: '#ef4444', fontSize: '1.1rem' }}>{conflict.ownerName}</strong> ({conflict.ownerId})
                </p>

                <div style={{ background: 'rgba(255,255,255,0.05)', padding: '16px', borderRadius: '16px', fontSize: '0.8rem', opacity: 0.8 }}>
                  <strong>Policy Exception:</strong> B2B Logistics protocol allows "Force Return & Assign" for empty jar collections with ownership mismatch.
                </div>

                <div style={{ display: 'flex', gap: '12px', marginTop: '8px' }}>
                  <button 
                    style={{ flex: 1, padding: '14px', borderRadius: '14px', border: '1px solid rgba(255,255,255,0.2)', background: 'transparent', color: 'white', fontWeight: 700, cursor: 'pointer' }}
                    onClick={() => { setConflict(null); setIsCameraActive(true); }}
                  >
                    Cancel Scan
                  </button>
                  <button 
                    style={{ flex: 1, padding: '14px', borderRadius: '14px', border: 'none', background: '#10b981', color: '#1a1a1a', fontWeight: 800, cursor: 'pointer' }}
                    onClick={resolveConflict}
                    disabled={resolvingConflict}
                  >
                    {resolvingConflict ? 'Reassigning...' : 'Force Return & Assign'}
                  </button>
                </div>
              </div>
            ) : deliveryStep === 'finalize' ? (
              /* Finalize Step UI */
              <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                 <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                  <div style={{ background: 'rgba(16, 185, 129, 0.1)', padding: '20px', borderRadius: '24px', border: '1px solid #10b981' }}>
                    <div style={{ fontSize: '0.75rem', fontWeight: 800, color: '#10b981', textTransform: 'uppercase' }}>Delivered</div>
                    <div style={{ fontSize: '1.8rem', fontWeight: 800 }}>{scannedDelivered.length}</div>
                  </div>
                  <div style={{ background: 'rgba(239, 68, 68, 0.1)', padding: '20px', borderRadius: '24px', border: '1px solid #ef4444' }}>
                    <div style={{ fontSize: '0.75rem', fontWeight: 800, color: '#ef4444', textTransform: 'uppercase' }}>Returned</div>
                    <div style={{ fontSize: '1.8rem', fontWeight: 800 }}>{scannedReturned.length}</div>
                  </div>
                </div>

                <div style={{ background: 'rgba(255,255,255,0.05)', padding: '24px', borderRadius: '24px', border: '1px solid rgba(255,255,255,0.1)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '12px' }}>
                    <span style={{ opacity: 0.6, fontWeight: 600 }}>Billing Calculation</span>
                    <span style={{ fontWeight: 800 }}>{scannedDelivered.length} x ₹{client?.contractTerms?.pricePerJar}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', paddingTop: '12px', borderTop: '1px dashed rgba(255,255,255,0.2)' }}>
                    <span style={{ fontSize: '1.1rem', fontWeight: 800 }}>Total Bill</span>
                    <span style={{ fontSize: '1.1rem', fontWeight: 800, color: '#10b981' }}>₹{(scannedDelivered.length * (client?.contractTerms?.pricePerJar || 0)).toLocaleString()}</span>
                  </div>
                </div>

                {/* Logistics Notes FormField inside Finalize */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <label style={{ fontSize: '0.85rem', color: '#64748b', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Logistics Notes</label>
                  <textarea 
                    rows={3}
                    placeholder="Add manual notes or exceptions here..."
                    style={{
                      width: '100%',
                      background: 'rgba(255,255,255,0.05)',
                      border: '1px solid rgba(255,255,255,0.1)',
                      borderRadius: '12px',
                      padding: '12px',
                      color: 'white',
                      fontSize: '0.95rem',
                      fontWeight: 600,
                      outline: 'none',
                      fontFamily: 'inherit'
                    }}
                    value={handoverData.notes}
                    onChange={e => setHandoverData({ ...handoverData, notes: e.target.value })}
                  />
                </div>

                <ActionFooter>
                  <button className="back" onClick={() => setDeliveryStep('scan_return')}>Back</button>
                  <button className="next" onClick={handleHandoverSubmit} disabled={submittingHandover}>
                    {submittingHandover ? 'Syncing...' : 'Submit Handover'}
                  </button>
                </ActionFooter>
              </div>
            ) : (
              /* Scan Steps UI */
              <>
                <div style={{ marginBottom: '16px', fontSize: '0.75rem', fontWeight: 800, textTransform: 'uppercase', opacity: 0.5, letterSpacing: '0.05em' }}>
                  STEP {deliveryStep === 'scan_delivery' ? '1' : '2'}: {deliveryStep === 'scan_delivery' ? 'SCAN DELIVERED JARS' : 'SCAN COLLECTED (EMPTY) JARS'}
                </div>

                <CameraArea onClick={() => setIsCameraActive(!isCameraActive)}>
                  {isCameraActive ? (
                    <div id="reader" style={{ width: '100%' }} />
                  ) : (
                    <>
                      <FiCamera />
                      <span>Open Camera</span>
                      <p>{(deliveryStep === 'scan_delivery' ? scannedDelivered : scannedReturned).length} Scanned</p>
                    </>
                  )}
                </CameraArea>

                <ManualInputGroup>
                  <div className="input-wrapper">
                    <span>HYD-JAR-</span>
                    <input 
                      placeholder="0000" 
                      value={manualInput}
                      onChange={e => setManualInput(e.target.value)}
                      onKeyDown={e => e.key === 'Enter' && handleManualAdd()}
                    />
                  </div>
                  <button onClick={handleManualAdd}>ADD</button>
                </ManualInputGroup>

                {/* List of scanned jars with delete buttons - RENDERED DIRECTLY BELOW SCANNER */}
                <div style={{ 
                  maxHeight: '130px', 
                  overflowY: 'auto', 
                  background: 'rgba(255,255,255,0.05)', 
                  borderRadius: '16px', 
                  padding: '12px', 
                  marginBottom: '16px',
                  border: '1px solid rgba(255,255,255,0.1)'
                }}>
                  <div style={{ fontSize: '0.75rem', fontWeight: 800, color: 'rgba(255,255,255,0.5)', textTransform: 'uppercase', marginBottom: '8px', letterSpacing: '0.05em' }}>
                    Serialized Jar Log:
                  </div>
                  {(deliveryStep === 'scan_delivery' ? scannedDelivered : scannedReturned).length === 0 ? (
                    <div style={{ textAlign: 'center', opacity: 0.4, fontSize: '0.8rem', padding: '12px', color: 'white' }}>
                      No jars recorded yet.
                    </div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      {(deliveryStep === 'scan_delivery' ? scannedDelivered : scannedReturned).map((jarId) => (
                        <div key={jarId} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(255,255,255,0.08)', padding: '8px 12px', borderRadius: '10px', fontSize: '0.9rem' }}>
                          <span style={{ fontFamily: 'Fira Code', fontWeight: 700, color: '#10b981' }}>{jarId}</span>
                          <FiTrash2 
                            style={{ color: '#ef4444', cursor: 'pointer', transition: 'all 0.2s' }} 
                            onClick={(e) => {
                              e.stopPropagation();
                              if (deliveryStep === 'scan_delivery') {
                                setScannedDelivered(prev => prev.filter(id => id !== jarId));
                              } else {
                                setScannedReturned(prev => prev.filter(id => id !== jarId));
                              }
                            }}
                          />
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div style={{ textAlign: 'center', opacity: 0.3, fontSize: '0.85rem', marginBottom: '16px' }}>
                  {(deliveryStep === 'scan_delivery' ? scannedDelivered : scannedReturned).length === 0 
                    ? `No jars ${deliveryStep === 'scan_delivery' ? 'scanned' : 'collected'} yet` 
                    : `${(deliveryStep === 'scan_delivery' ? scannedDelivered : scannedReturned).length} jars ready`}
                </div>

                {deliveryStep === 'scan_return' && (
                   <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'rgba(255,255,255,0.4)', fontSize: '0.75rem', marginBottom: '16px' }}>
                    <FiAlertCircle size={14} />
                    If no jars are collected, click &apos;Next&apos; to skip.
                  </div>
                )}

                <ActionFooter>
                  <button className="back" onClick={() => setDeliveryStep(deliveryStep === 'scan_delivery' ? 'idle' : 'scan_delivery')}>
                    <FiChevronRight style={{ transform: 'rotate(180deg)' }} /> Back
                  </button>
                  <button className="next" onClick={() => setDeliveryStep(deliveryStep === 'scan_delivery' ? 'scan_return' : 'finalize')}>
                    Next <FiChevronRight />
                  </button>
                </ActionFooter>
              </>
            )}
          </HandoverContent>
        </HandoverModal>
      )}

      {/* ── Edit/Correction Modal ── */}
      {showEditModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(2,6,23,0.7)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', backdropFilter: 'blur(6px)' }}>
          <div style={{ background: 'white', borderRadius: '24px', padding: '36px', width: '480px', maxWidth: '95vw', boxShadow: '0 32px 64px rgba(0,0,0,0.4)', color: '#020617' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '28px' }}>
              <div>
                <h2 style={{ fontSize: '1.3rem', fontWeight: 900, color: '#020617', margin: 0 }}>
                  {editForm.type === 'payment_received' ? 'Correct Payment' : 'Correct Delivery'}
                </h2>
                <p style={{ fontSize: '0.82rem', color: '#64748b', marginTop: '4px' }}>
                  {editForm.type === 'payment_received' ? 'Edit payment details or reference' : 'Adjust jar count and delivery value'}
                </p>
              </div>
              <button 
                onClick={() => { setShowEditModal(false); setEditingEntry(null); }} 
                style={{ background: '#f1f5f9', border: 'none', borderRadius: '10px', padding: '8px', cursor: 'pointer', color: '#64748b', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'background 0.2s' }}
                onMouseEnter={e => e.currentTarget.style.background = '#e2e8f0'}
                onMouseLeave={e => e.currentTarget.style.background = '#f1f5f9'}
              >
                <FiX size={18} />
              </button>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
              <div>
                <label style={{ fontSize: '0.75rem', fontWeight: 800, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em', display: 'block', marginBottom: '8px' }}>Date</label>
                <input
                  type="date"
                  value={editForm.date}
                  onChange={e => setEditForm(p => ({ ...p, date: e.target.value }))}
                  style={{ width: '100%', padding: '12px', border: '1.5px solid #e2e8f0', borderRadius: '12px', fontSize: '0.9rem', fontFamily: 'inherit', boxSizing: 'border-box', outline: 'none' }}
                />
              </div>
              <div>
                <label style={{ fontSize: '0.75rem', fontWeight: 800, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em', display: 'block', marginBottom: '8px' }}>Time</label>
                <input
                  type="time"
                  value={editForm.time}
                  onChange={e => setEditForm(p => ({ ...p, time: e.target.value }))}
                  style={{ width: '100%', padding: '12px', border: '1.5px solid #e2e8f0', borderRadius: '12px', fontSize: '0.9rem', fontFamily: 'inherit', boxSizing: 'border-box', outline: 'none' }}
                />
              </div>
            </div>

            {editForm.type === 'payment_received' ? (
              <>
                <div style={{ marginBottom: '16px' }}>
                  <label style={{ fontSize: '0.75rem', fontWeight: 800, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em', display: 'block', marginBottom: '8px' }}>Amount Paid (₹) 💰</label>
                  <input
                    type="number"
                    min={0.01}
                    step="any"
                    value={editForm.amount}
                    onChange={e => setEditForm(p => ({ ...p, amount: e.target.value }))}
                    style={{ width: '100%', padding: '14px', border: '2px solid #10b981', borderRadius: '12px', fontSize: '1.2rem', fontWeight: 900, fontFamily: 'inherit', boxSizing: 'border-box', outline: 'none', background: '#f0fdf4', color: '#047857' }}
                  />
                </div>
                <div style={{ marginBottom: '16px' }}>
                  <label style={{ fontSize: '0.75rem', fontWeight: 800, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em', display: 'block', marginBottom: '8px' }}>Reference / Method 💳</label>
                  <input
                    type="text"
                    placeholder="e.g. UPI, Bank Transfer, Cash"
                    value={editForm.referenceId}
                    onChange={e => setEditForm(p => ({ ...p, referenceId: e.target.value }))}
                    style={{ width: '100%', padding: '12px', border: '1.5px solid #e2e8f0', borderRadius: '12px', fontSize: '0.9rem', fontFamily: 'inherit', boxSizing: 'border-box', outline: 'none' }}
                  />
                </div>
              </>
            ) : (
              <>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
                  <div>
                    <label style={{ fontSize: '0.75rem', fontWeight: 800, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em', display: 'block', marginBottom: '8px' }}>Jars Delivered 🫙</label>
                    <input
                      type="number"
                      min={0}
                      value={editForm.deliveredCount}
                      onChange={e => setEditForm(p => ({ ...p, deliveredCount: Math.max(0, parseInt(e.target.value) || 0) }))}
                      style={{ width: '100%', padding: '12px', border: '1.5px solid #10b981', borderRadius: '12px', fontSize: '1rem', fontWeight: 800, fontFamily: 'inherit', boxSizing: 'border-box', outline: 'none', background: '#f0fdf4' }}
                    />
                  </div>
                  <div>
                    <label style={{ fontSize: '0.75rem', fontWeight: 800, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em', display: 'block', marginBottom: '8px' }}>Jars Returned ♻️</label>
                    <input
                      type="number"
                      min={0}
                      value={editForm.returnedCount}
                      onChange={e => setEditForm(p => ({ ...p, returnedCount: Math.max(0, parseInt(e.target.value) || 0) }))}
                      style={{ width: '100%', padding: '12px', border: '1.5px solid #e2e8f0', borderRadius: '12px', fontSize: '1rem', fontWeight: 800, fontFamily: 'inherit', boxSizing: 'border-box', outline: 'none', background: '#fef2f2' }}
                    />
                  </div>
                </div>
                <div style={{ marginBottom: '16px' }}>
                  <label style={{ fontSize: '0.75rem', fontWeight: 800, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em', display: 'block', marginBottom: '8px' }}>Custom Total Amount (₹) (optional)</label>
                  <input
                    type="number"
                    min={0}
                    step="any"
                    placeholder={`Defaults to ₹${((editForm.deliveredCount || 0) * (client?.contractTerms?.pricePerJar || 35)).toLocaleString()}`}
                    value={editForm.amount}
                    onChange={e => setEditForm(p => ({ ...p, amount: e.target.value }))}
                    style={{ width: '100%', padding: '12px', border: '1.5px solid #cbd5e1', borderRadius: '12px', fontSize: '0.95rem', fontFamily: 'inherit', boxSizing: 'border-box', outline: 'none' }}
                  />
                </div>
              </>
            )}

            {(() => {
              const uniqueStaffNames = Array.from(new Set([
                ...(staffList?.map(s => s.name) || []),
                ...(staffData?.name ? [staffData.name] : []),
                ...(currentUser?.displayName ? [currentUser.displayName] : []),
                'Rose', 'Moti', 'Sohal', 'Admin'
              ].filter(Boolean)));

              const isCustom = editForm.recordedBy && !uniqueStaffNames.includes(editForm.recordedBy);
              const dropdownValue = showCustomEditStaff || isCustom ? '__CUSTOM__' : editForm.recordedBy;

              return (
                <div style={{ marginBottom: '16px' }}>
                  <label style={{ fontSize: '0.75rem', fontWeight: 800, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em', display: 'block', marginBottom: '8px' }}>
                    Recorded By 👤
                  </label>
                  <select
                    value={dropdownValue}
                    onChange={e => {
                      if (e.target.value === '__CUSTOM__') {
                        setShowCustomEditStaff(true);
                        setEditForm(p => ({ ...p, recordedBy: '' }));
                      } else {
                        setShowCustomEditStaff(false);
                        setEditForm(p => ({ ...p, recordedBy: e.target.value }));
                      }
                    }}
                    style={{ width: '100%', padding: '12px', border: '1.5px solid #e2e8f0', borderRadius: '12px', fontSize: '0.9rem', fontWeight: 600, fontFamily: 'inherit', boxSizing: 'border-box', outline: 'none', background: '#f8fafc', color: '#020617' }}
                  >
                    {uniqueStaffNames.map(name => (
                      <option key={name} value={name}>{name}</option>
                    ))}
                    <option value="__CUSTOM__">✍️ Custom Name...</option>
                  </select>

                  {(showCustomEditStaff || isCustom) && (
                    <div style={{ marginTop: '10px' }}>
                      <input
                        type="text"
                        placeholder="Type custom staff/admin name..."
                        value={editForm.recordedBy}
                        onChange={e => setEditForm(p => ({ ...p, recordedBy: e.target.value }))}
                        style={{ width: '100%', padding: '12px', border: '1.5px solid #e2e8f0', borderRadius: '12px', fontSize: '0.9rem', fontFamily: 'inherit', boxSizing: 'border-box', outline: 'none' }}
                      />
                    </div>
                  )}
                </div>
              );
            })()}

            <div style={{ marginBottom: '24px' }}>
              <label style={{ fontSize: '0.75rem', fontWeight: 800, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em', display: 'block', marginBottom: '8px' }}>Notes / Description</label>
              <textarea
                value={editForm.notes}
                onChange={e => setEditForm(p => ({ ...p, notes: e.target.value }))}
                placeholder="e.g. Corrected quantity mismatch found in manual logs"
                rows={2}
                style={{ width: '100%', padding: '12px', border: '1.5px solid #e2e8f0', borderRadius: '12px', fontSize: '0.88rem', fontFamily: 'inherit', boxSizing: 'border-box', resize: 'vertical', outline: 'none' }}
              />
            </div>

            <div style={{ display: 'flex', gap: '12px' }}>
              <button
                onClick={() => { setShowEditModal(false); setEditingEntry(null); }}
                style={{ flex: 1, padding: '14px', border: '1.5px solid #e2e8f0', borderRadius: '14px', fontWeight: 700, cursor: 'pointer', background: 'white', color: '#64748b', fontFamily: 'inherit' }}
              >
                Cancel
              </button>
              <button
                onClick={handleSaveEdit}
                disabled={submittingEdit}
                style={{ flex: 2, padding: '14px', background: submittingEdit ? '#6ee7b7' : '#10b981', color: 'white', border: 'none', borderRadius: '14px', fontWeight: 900, cursor: submittingEdit ? 'wait' : 'pointer', fontSize: '0.95rem', fontFamily: 'inherit', boxShadow: '0 4px 12px rgba(16,185,129,0.3)' }}
              >
                {submittingEdit ? 'Saving...' : '✓ Save Correction'}
              </button>
            </div>
          </div>
        </div>
      )}
    </Container>
  );
}
