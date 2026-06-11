'use client';

import React, { useState, useEffect, useRef } from 'react';
import styled from 'styled-components';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  FiPlus, FiUsers, FiBriefcase, FiArrowRight, FiPackage, 
  FiDollarSign, FiAlertCircle, FiSearch, FiFilter, FiMoreVertical,
  FiChevronRight, FiClock, FiShield, FiRefreshCw, FiMapPin, FiTruck, FiCamera,
  FiX, FiZap, FiTrash2, FiDownload, FiCheckCircle, FiAlertTriangle, FiFileText
} from 'react-icons/fi';
import { getB2BClients, recordLedgerEntry, recordHandover, getClientOrders, getAllLedgerEntries } from '@/lib/b2bService';
import { assignJarToCustomer, returnJar, db } from '@/lib/firebase';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { B2BClient, B2BLedgerEntry } from '@/types/b2b';
import { useAuth } from '@/context/AuthContext';
import { useRouter } from 'next/navigation';
import { format, startOfMonth, endOfMonth, isWithinInterval, parseISO } from 'date-fns';
import { Html5Qrcode } from 'html5-qrcode';
import * as XLSX from 'xlsx';

/* ── Styled Components ────────────────────────────────────────── */
const DashboardContainer = styled.div`
  padding: 40px;
  max-width: 1400px;
  margin: 0 auto;
  color: #020617;
  font-family: 'Plus Jakarta Sans', 'Fira Sans', sans-serif;
  animation: fadeIn 0.5s ease-out;

  @keyframes fadeIn {
    from { opacity: 0; transform: translateY(10px); }
    to { opacity: 1; transform: translateY(0); }
  }
`;

const TabHeader = styled.div`
  display: flex;
  gap: 12px;
  border-bottom: 2px solid #e2e8f0;
  margin-bottom: 32px;
  padding-bottom: 2px;
`;

const TabButton = styled.button<{ $active: boolean }>`
  background: ${props => props.$active ? '#020617' : 'transparent'};
  border: 1px solid ${props => props.$active ? '#020617' : 'transparent'};
  border-bottom: ${props => props.$active ? '2px solid #020617' : 'none'};
  padding: 12px 24px;
  color: ${props => props.$active ? '#020617' : '#64748b'};
  font-weight: 800;
  font-size: 1rem;
  cursor: pointer;
  border-radius: 12px 12px 0 0;
  display: flex;
  align-items: center;
  gap: 8px;
  transition: all 0.2s ease-in-out;

  &:hover {
    color: #020617;
    background: ${props => props.$active ? 'transparent' : '#f8fafc'};
  }
`;

const LedgerFilterBar = styled.div`
  background: white;
  border: 1px solid #e2e8f0;
  border-radius: 20px;
  padding: 24px;
  display: flex;
  flex-wrap: wrap;
  gap: 20px;
  margin-bottom: 24px;
  align-items: flex-end;
  box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05);
`;

const FilterGroup = styled.div`
  display: flex;
  flex-direction: column;
  gap: 8px;
  flex: 1;
  min-width: 200px;

  label {
    font-size: 0.75rem;
    font-weight: 800;
    color: #64748b;
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }

  input, select {
    padding: 12px 16px;
    border-radius: 12px;
    border: 1px solid #cbd5e1;
    font-weight: 700;
    color: #020617;
    background: #f8fafc;
    font-size: 0.95rem;
    width: 100%;
    outline: none;
    transition: all 0.2s;

    &:focus {
      border-color: #020617;
      background: white;
    }
  }
`;

const ExportButton = styled.button`
  background: #10b981;
  color: white;
  border: none;
  padding: 14px 28px;
  border-radius: 12px;
  font-weight: 800;
  display: flex;
  align-items: center;
  gap: 10px;
  cursor: pointer;
  box-shadow: 0 10px 15px -3px rgba(16, 185, 129, 0.2);
  transition: all 0.2s;

  &:hover {
    transform: translateY(-2px);
    background: #059669;
    box-shadow: 0 15px 20px -3px rgba(16, 185, 129, 0.3);
  }
`;

const LedgerTableContainer = styled.div`
  background: white;
  border: 1px solid #e2e8f0;
  border-radius: 24px;
  overflow: hidden;
  box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05);
`;

const LedgerTable = styled.table`
  width: 100%;
  border-collapse: collapse;
  text-align: left;

  th {
    background: #f8fafc;
    padding: 18px 24px;
    color: #64748b;
    font-size: 0.8rem;
    font-weight: 800;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    border-bottom: 1px solid #e2e8f0;
  }

  td {
    padding: 20px 24px;
    border-bottom: 1px solid #f1f5f9;
    color: #334155;
    font-size: 0.95rem;
    font-weight: 600;
  }

  tr:last-child td {
    border-bottom: none;
  }

  tr:hover td {
    background: #f8fafc;
  }
`;

const LedgerSummaryBar = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 20px;
  margin-top: 24px;
  background: white;
  border: 1px solid #e2e8f0;
  border-radius: 24px;
  padding: 24px;
  box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05);
`;

const SummaryItem = styled.div<{ $color?: string }>`
  label {
    display: block;
    font-size: 0.75rem;
    font-weight: 800;
    color: #64748b;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    margin-bottom: 6px;
  }
  .value {
    font-size: 1.6rem;
    font-weight: 800;
    color: ${props => props.$color || '#020617'};
  }
`;

const Header = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 40px;
  
  @media (max-width: 768px) {
    flex-direction: column;
    align-items: flex-start;
    gap: 16px;
  }
`;

const TitleSection = styled.div`
  h1 {
    font-size: 2.8rem;
    font-weight: 800;
    letter-spacing: -0.03em;
    color: #020617;
    margin-bottom: 8px;
  }
  p {
    color: #334155;
    font-size: 1.1rem;
    font-weight: 500;
  }
`;

const ActionButtons = styled.div`
  display: flex;
  gap: 12px;
`;

const PrimaryButton = styled.button`
  background: #020617;
  color: white;
  border: none;
  padding: 14px 28px;
  border-radius: 14px;
  font-weight: 700;
  display: flex;
  align-items: center;
  gap: 10px;
  cursor: pointer;
  box-shadow: 0 10px 20px -5px rgba(2, 6, 23, 0.2);
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);

  &:hover {
    transform: translateY(-2px);
    background: #0f172a;
    box-shadow: 0 15px 30px -5px rgba(2, 6, 23, 0.3);
  }
`;

const StatsGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
  gap: 20px;
  margin-bottom: 48px;
`;

const StatCard = styled.div<{ $variant?: 'warning' | 'info' | 'success' }>`
  background: white;
  border: 1px solid #e2e8f0;
  border-radius: 24px;
  padding: 28px;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05);

  &:hover {
    transform: translateY(-4px);
    border-color: #cbd5e1;
    box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1);
  }
`;

const StatHeader = styled.div`
  display: flex;
  align-items: center;
  gap: 10px;
  color: #64748b;
  font-size: 0.85rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  margin-bottom: 12px;

  svg {
    font-size: 1.1rem;
    color: #0f172a;
  }
`;

const StatValue = styled.div`
  font-size: 2rem;
  font-weight: 800;
  color: #020617;
`;

const StatSubtext = styled.div`
  font-size: 0.8rem;
  color: #64748b;
  margin-top: 4px;
`;

const SectionHeader = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 24px;

  h2 {
    font-size: 1.5rem;
    font-weight: 800;
    color: #020617;
    letter-spacing: -0.02em;
  }
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

const ClientGrid = styled.div`
  display: flex;
  flex-direction: column;
  gap: 16px;
`;

const ClientCard = styled.div`
  background: white;
  border: 1px solid #e2e8f0;
  border-radius: 24px;
  padding: 24px;
  display: grid;
  grid-template-columns: 1fr 200px 200px 80px;
  align-items: center;
  gap: 24px;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  cursor: pointer;
  box-shadow: 0 1px 3px 0 rgba(0, 0, 0, 0.05);

  &:hover {
    border-color: #020617;
    transform: translateY(-2px);
    box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1);
  }
`;

const CompanySection = styled.div`
  h3 {
    font-size: 1.25rem;
    font-weight: 800;
    color: #020617;
    margin-bottom: 6px;
  }
  .metadata {
    display: flex;
    gap: 16px;
    font-size: 0.85rem;
    color: #334155;
    font-weight: 600;
  }
`;

const DataPoint = styled.div<{ $color?: string }>`
  label {
    display: block;
    font-size: 0.7rem;
    font-weight: 800;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: #64748b;
    margin-bottom: 4px;
  }
  .value {
    font-size: 1.1rem;
    font-weight: 800;
    color: ${props => props.$color || '#020617'};
    font-family: 'Fira Code', monospace;
  }
`;

const EmptyState = styled.div`
  padding: 80px;
  background: #f8fafc;
  border: 2px dashed #e2e8f0;
  border-radius: 32px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 20px;
  text-align: center;
  color: #475569;

  svg {
    font-size: 4rem;
    color: #cbd5e1;
  }
`;

/* ── Drawer Components ────────────────────────────────────────── */
const DrawerOverlay = styled(motion.div)`
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(2, 6, 23, 0.6);
  backdrop-filter: blur(4px);
  z-index: 1000;
`;

const DrawerContent = styled(motion.div)`
  position: fixed;
  top: 0;
  right: 0;
  height: 100vh;
  width: 500px;
  background: white;
  z-index: 1001;
  box-shadow: -10px 0 30px rgba(0, 0, 0, 0.1);
  padding: 40px;
  overflow-y: auto;
  display: flex;
  flex-direction: column;

  @media (max-width: 600px) {
    width: 100%;
  }
`;

const DrawerHeader = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 32px;

  h2 {
    font-size: 2rem;
    font-weight: 800;
    color: #020617;
    letter-spacing: -0.03em;
  }
`;

const DrawerClose = styled.button`
  background: #f1f5f9;
  border: none;
  width: 40px;
  height: 40px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: all 0.2s;
  
  &:hover {
    background: #e2e8f0;
    transform: rotate(90deg);
  }
`;

const DrawerSection = styled.div`
  margin-bottom: 32px;
  
  h4 {
    font-size: 0.85rem;
    font-weight: 800;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: #64748b;
    margin-bottom: 16px;
    display: flex;
    align-items: center;
    gap: 8px;
  }
`;

const InfoRow = styled.div`
  display: flex;
  justify-content: space-between;
  padding: 12px 0;
  border-bottom: 1px solid #f1f5f9;
  
  .label {
    color: #64748b;
    font-weight: 600;
  }
  .value {
    color: #020617;
    font-weight: 700;
    text-align: right;
  }
`;

const OrderItem = styled.div`
  background: #f8fafc;
  border: 1px solid #e2e8f0;
  border-radius: 16px;
  padding: 16px;
  margin-bottom: 12px;
  display: flex;
  justify-content: space-between;
  align-items: center;

  .details {
    h5 {
      font-weight: 800;
      color: #020617;
      margin-bottom: 2px;
    }
    p {
      font-size: 0.75rem;
      color: #64748b;
      font-weight: 600;
    }
  }
  .amount {
    text-align: right;
    font-weight: 800;
    color: #020617;
    span {
      display: block;
      font-size: 0.7rem;
      color: #64748b;
    }
  }
`;

const ScannerOverlay = styled.div`
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(2, 6, 23, 0.9);
  z-index: 2000;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 20px;
`;

const ScannerBox = styled.div`
  width: 100%;
  max-width: 400px;
  background: white;
  border-radius: 24px;
  overflow: hidden;
  position: relative;
  
  #reader {
    width: 100% !important;
    border: none !important;
  }
`;

const DeliveryForm = styled.div`
  display: flex;
  flex-direction: column;
  gap: 16px;
  background: #f8fafc;
  padding: 24px;
  border-radius: 20px;
  margin-top: 12px;
`;

const InputGroup = styled.div`
  display: flex;
  flex-direction: column;
  gap: 6px;
  label {
    font-size: 0.75rem;
    font-weight: 800;
    color: #64748b;
    text-transform: uppercase;
  }
  input {
    padding: 12px;
    border-radius: 10px;
    border: 1px solid #e2e8f0;
    font-weight: 700;
    &:focus { outline: none; border-color: #020617; }
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

/* ── Main Component ────────────────────────────────────────── */
export default function B2BDashboard() {
  const [clients, setClients] = useState<B2BClient[]>([]);
  const [selectedClient, setSelectedClient] = useState<B2BClient | null>(null);
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingOrders, setLoadingOrders] = useState(false);
  
  // Tab & Master Ledger States
  const [activeConsoleTab, setActiveConsoleTab] = useState<'clients' | 'ledger'>('clients');
  const [ledger, setLedger] = useState<B2BLedgerEntry[]>([]);
  const [loadingLedger, setLoadingLedger] = useState(false);
  const [startDateFilter, setStartDateFilter] = useState('');
  const [endDateFilter, setEndDateFilter] = useState('');
  const [storeFilter, setStoreFilter] = useState('all');
  const [searchFilter, setSearchFilter] = useState('');

  // Premium Scanning States
  const [showScanner, setShowScanner] = useState(false);
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
  const { currentUser, userData } = useAuth();
  const router = useRouter();

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

  useEffect(() => {
    const fetchInitialData = async () => {
      try {
        setLoading(true);
        setLoadingLedger(true);
        const data = await getB2BClients();
        setClients(data);
        
        try {
          const ledgerData = await getAllLedgerEntries(500);
          setLedger(ledgerData);
        } catch (le) {
          console.warn('Failed to load initial master ledger logs:', le);
        }
      } catch (error) {
        console.error('Failed to fetch clients:', error);
      } finally {
        setLoading(false);
        setLoadingLedger(false);
      }
    };

    fetchInitialData();
  }, []);

  useEffect(() => {
    if (selectedClient) {
      const fetchOrders = async () => {
        setLoadingOrders(true);
        try {
          const data = await getClientOrders(selectedClient.id);
          setOrders(data);
        } catch (error) {
          console.error('Failed to fetch orders:', error);
        } finally {
          setLoadingOrders(false);
        }
      };
      fetchOrders();
    } else {
      setOrders([]);
    }
  }, [selectedClient]);

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
    
    // URL parser helper
    try {
      if (id.startsWith('http://') || id.startsWith('https://')) {
        const url = new URL(id);
        const urlId = url.searchParams.get('id');
        if (urlId) id = urlId.trim();
      }
    } catch (err) {
      console.warn('Scan text is not a URL, using raw string');
    }

    // ── FIRESTORE VALIDATION ──
    try {
      const jarRef = doc(db, 'jars', id);
      const jarDoc = await getDoc(jarRef);
      const jarData = jarDoc.exists() ? (jarDoc.data() as any) : null;

      const companyHandoverName = `${selectedClient?.companyName} [ b2b ]`;

      if (deliveryStep === 'scan_delivery') {
        // Check if locked to a DIFFERENT owner
        if (jarData && jarData.status === 'locked' && jarData.currentOwnerId !== selectedClient?.id && jarData.currentOwnerId !== companyHandoverName) {
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
        // Return: jar should be locked to THIS client
        const isOwnerMatch = jarData && (jarData.currentOwnerId === selectedClient?.id || jarData.currentOwnerId === companyHandoverName);
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
    // ── END FIRESTORE VALIDATION ──

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
    if (!conflict || !selectedClient) return;
    setResolvingConflict(true);
    try {
      const staffId = currentUser?.uid || 'admin';
      const companyHandoverName = `${selectedClient.companyName} [ b2b ]`;
      
      if (conflict.type === 'delivery') {
        // Force unlock and assign to B2B Store
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
        // Force return from store
        await returnJar(conflict.jarId, staffId, conflict.ownerId || 'unknown');
        setScannedReturned(prev => [...prev, conflict.jarId]);
      }
      
      playSuccessBeep();
      setConflict(null);
      setIsCameraActive(true); // Restart camera after resolution
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

        // Flash detection
        try {
          const track = qrRef.current.getRunningTrackCapabilities();
          if ((track as any).torch) setHasFlash(true);
        } catch {}

      } catch (err) {
        console.warn("Scanner initiation delay:", err);
      }
    };

    if (showScanner && isCameraActive && (deliveryStep === 'scan_delivery' || deliveryStep === 'scan_return')) {
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
  }, [showScanner, isCameraActive, deliveryStep]);

  const handleManualAdd = () => {
    if (!manualInput) return;
    const parsedInput = manualInput.trim();
    let finalId = parsedInput;
    
    // Smart Autocomplete digits padding
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
    if (!selectedClient) return;
    setSubmittingHandover(true);
    try {
      const staffId = currentUser?.uid || 'admin_panel';
      const b2bOwnerId = `${selectedClient.companyName} [ b2b ]`;

      // 1. Link delivered jars to this B2B client
      for (const jarId of scannedDelivered) {
        try {
          await assignJarToCustomer(jarId, b2bOwnerId, staffId);
        } catch (e) {
          console.warn(`Failed to link delivery jar ${jarId}:`, e);
        }
      }

      // 2. Return collected jars to warehouse
      for (const jarId of scannedReturned) {
        try {
          await returnJar(jarId, staffId, b2bOwnerId);
        } catch (e) {
          console.warn(`Failed to return jar ${jarId}:`, e);
        }
      }

      // 3. Record the transaction in the ledger
      await recordHandover({
        clientId: selectedClient.id!,
        delivered: scannedDelivered.length,
        returned: scannedReturned.length,
        pricePerJar: selectedClient.contractTerms?.pricePerJar || 35,
        notes: `Serialized Handover: ${scannedDelivered.length} Out, ${scannedReturned.length} In. ${handoverData.notes}`,
        deliveredJarIds: scannedDelivered,
        returnedJarIds: scannedReturned
      });

      // 4. Refresh local state
      const data = await getB2BClients();
      setClients(data);
      const updatedClient = data.find(c => c.id === selectedClient.id);
      if (updatedClient) setSelectedClient(updatedClient);

      setDeliveryStep('idle');
      setShowScanner(false);
      setScannedDelivered([]);
      setScannedReturned([]);
      setHandoverData({ notes: '' });
      alert('Handover recorded successfully!');
    } catch (err) {
      console.error('Handover failed:', err);
      alert('Failed to record handover: ' + err);
    } finally {
      setSubmittingHandover(false);
    }
  };

  const filteredLedger = ledger.filter(entry => {
    // 1. Store filter
    if (storeFilter !== 'all' && entry.clientId !== storeFilter) return false;
    
    // 2. Date filter
    if (entry.timestamp) {
      const date = parseLedgerTimestamp(entry.timestamp);
      if (startDateFilter && date < parseISO(startDateFilter)) return false;
      if (endDateFilter && date > parseISO(endDateFilter + 'T23:59:59')) return false;
    }
    
    // 3. Search filter
    if (searchFilter) {
      const searchLower = searchFilter.toLowerCase();
      const clientName = clients.find(c => c.id === entry.clientId)?.companyName?.toLowerCase() || '';
      const desc = entry.description?.toLowerCase() || '';
      const ref = entry.referenceId?.toLowerCase() || entry.id?.toLowerCase() || '';
      if (!clientName.includes(searchLower) && !desc.includes(searchLower) && !ref.includes(searchLower)) return false;
    }
    
    return true;
  }).sort((a, b) => {
    return parseLedgerTimestamp(b.timestamp).getTime() - parseLedgerTimestamp(a.timestamp).getTime();
  });

  const handleExportExcel = () => {
    if (filteredLedger.length === 0) {
      alert("No ledger entries found with current filters.");
      return;
    }

    // Sheet 1: Raw Ledger Log (Audit Trail)
    const rawData = filteredLedger.map((entry, index) => {
      const date = parseLedgerTimestamp(entry.timestamp);
      const clientName = clients.find(c => c.id === entry.clientId)?.companyName || 'Unknown Store';
      const typeText = entry.type === 'delivery_handover' ? 'Handover' : entry.type.replace('_', ' ');
      
      const price = entry.deliveredCount && entry.deliveredCount > 0 && entry.amount 
        ? entry.amount / entry.deliveredCount 
        : (clients.find(c => c.id === entry.clientId)?.contractTerms?.pricePerJar || 35);
        
      return {
        "S.No": index + 1,
        "Date": format(date, 'yyyy-MM-dd'),
        "Time": format(date, 'HH:mm:ss'),
        "Store": clientName,
        "Type": typeText,
        "Delivered": entry.deliveredCount || 0,
        "Returned": entry.returnedCount || 0,
        "Price per Jar": price,
        "Total Value": entry.amount || 0,
        "Reference ID": entry.referenceId || entry.id || '',
        "Description": entry.description || ''
      };
    });

    // Sheet 2: Monthly Store Aggregates
    const storeAggregates: { [key: string]: {
      storeName: string;
      contractPrice: number;
      totalDelivered: number;
      totalReturned: number;
      totalBilled: number;
      outstandingDues: number;
    }} = {};

    clients.forEach(client => {
      if (storeFilter === 'all' || storeFilter === client.id) {
        storeAggregates[client.id!] = {
          storeName: client.companyName,
          contractPrice: client.contractTerms?.pricePerJar || 35,
          totalDelivered: 0,
          totalReturned: 0,
          totalBilled: 0,
          outstandingDues: client.financialSummary?.outstandingAmount || 0
        };
      }
    });

    filteredLedger.forEach(entry => {
      const clientId = entry.clientId;
      if (storeAggregates[clientId]) {
        storeAggregates[clientId].totalDelivered += (entry.deliveredCount || 0);
        storeAggregates[clientId].totalReturned += (entry.returnedCount || 0);
        storeAggregates[clientId].totalBilled += (entry.amount || 0);
      }
    });

    const aggregateData = Object.values(storeAggregates).map((agg, index) => ({
      "S.No": index + 1,
      "Store Name": agg.storeName,
      "Contract Price": agg.contractPrice,
      "Total Delivered": agg.totalDelivered,
      "Total Returned": agg.totalReturned,
      "Net Holding": agg.totalDelivered - agg.totalReturned,
      "Total Billed": agg.totalBilled,
      "Current Outstanding Dues": agg.outstandingDues
    }));

    const wb = XLSX.utils.book_new();
    
    const wsRaw = XLSX.utils.json_to_sheet(rawData);
    XLSX.utils.book_append_sheet(wb, wsRaw, "Ledger Audit Trail");
    
    const wsAgg = XLSX.utils.json_to_sheet(aggregateData);
    XLSX.utils.book_append_sheet(wb, wsAgg, "Store Aggregates Summary");

    XLSX.writeFile(wb, `B2B_Master_Ledger_Report_${format(new Date(), 'yyyy-MM-dd')}.xlsx`);
  };

  const totalOutstanding = clients.reduce((sum, c) => sum + (c.financialSummary?.outstandingAmount || 0), 0);
  const totalJarsAtClients = clients.reduce((sum, c) => sum + (c.jarInventory?.atClient || 0), 0);

  return (
    <DashboardContainer>
      <Header>
        <TitleSection>
          <h1>B2B Enterprise Console</h1>
          <p>Managing corporate contracts, bulk logistics, and credit lines.</p>
        </TitleSection>
        <ActionButtons>
          <PrimaryButton onClick={() => router.push('/admin/b2b/new')}>
            <FiPlus /> Add Corporate Client
          </PrimaryButton>
        </ActionButtons>
      </Header>

      <StatsGrid>
        <StatCard>
          <StatHeader><FiUsers /> Total Clients</StatHeader>
          <StatValue>{clients.length}</StatValue>
          <StatSubtext>Active corporate contracts</StatSubtext>
        </StatCard>
        
        <StatCard $variant="warning">
          <StatHeader><FiDollarSign /> Outstanding Dues</StatHeader>
          <StatValue>₹{totalOutstanding.toLocaleString()}</StatValue>
          <StatSubtext>Aggregated credit across all clients</StatSubtext>
        </StatCard>

        <StatCard $variant="info">
          <StatHeader><FiPackage /> Jars in Field</StatHeader>
          <StatValue>{totalJarsAtClients}</StatValue>
          <StatSubtext>Jars currently with B2B clients</StatSubtext>
        </StatCard>

        <StatCard $variant="success">
          <StatHeader><FiShield /> Compliance Rate</StatHeader>
          <StatValue>100%</StatValue>
          <StatSubtext>GST & KYC verified accounts</StatSubtext>
        </StatCard>
      </StatsGrid>

      <TabHeader>
        <TabButton $active={activeConsoleTab === 'clients'} onClick={() => setActiveConsoleTab('clients')}>
          <FiUsers /> Corporate Stores
        </TabButton>
        <TabButton $active={activeConsoleTab === 'ledger'} onClick={() => setActiveConsoleTab('ledger')}>
          <FiFileText /> Consolidated Master Ledger
        </TabButton>
      </TabHeader>

      {activeConsoleTab === 'clients' ? (
        <>
          <SectionHeader>
            <h2>Enterprise Client List</h2>
            <div style={{ display: 'flex', gap: '16px' }}>
              <FiSearch style={{ color: '#475569', cursor: 'pointer' }} />
              <FiFilter style={{ color: '#475569', cursor: 'pointer' }} />
            </div>
          </SectionHeader>

          {loading ? (
            <div style={{ padding: '80px', textAlign: 'center', color: '#64748b' }}>
              <FiRefreshCw style={{ animation: 'spin 2s linear infinite', fontSize: '2rem', marginBottom: '12px' }} /> 
              <p style={{ fontWeight: 600 }}>Loading Enterprise Data...</p>
            </div>
          ) : clients.length === 0 ? (
            <EmptyState>
              <FiBriefcase />
              <div>
                <h3 style={{ fontSize: '1.5rem', color: '#fff', marginBottom: '8px' }}>No B2B Clients Found</h3>
                <p>Start by adding your first corporate partner to begin bulk logistics.</p>
              </div>
              <PrimaryButton onClick={() => router.push('/admin/b2b/new')}>
                Register First Client
              </PrimaryButton>
            </EmptyState>
          ) : (
            <ClientGrid>
              {clients.map((client) => (
                <ClientCard 
                  key={client.id}
                  onClick={() => setSelectedClient(client)}
                >
                  <CompanySection>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
                      <h3>{client.companyName}</h3>
                      <StatusBadge $status={client.status}>{client.status}</StatusBadge>
                    </div>
                    <div className="metadata">
                      <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <FiMapPin size={14} /> {client.billingAddress.city}
                      </span>
                      <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <FiClock size={14} /> {client.contractTerms?.billingCycle}
                      </span>
                      <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <FiShield size={14} /> {client.gstin || 'NO GSTIN'}
                      </span>
                    </div>
                  </CompanySection>

                  <DataPoint $color={(client.financialSummary?.outstandingAmount || 0) > 0 ? '#f87171' : '#10b981'}>
                    <label>Outstanding Dues</label>
                    <div className="value">₹{(client.financialSummary?.outstandingAmount || 0).toLocaleString()}</div>
                  </DataPoint>

                  <DataPoint $color="#3b82f6">
                    <label>Jar Balance</label>
                    <div className="value">{client.jarInventory?.atClient || 0} Jars</div>
                  </DataPoint>

                  <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                    <div style={{ width: '40px', height: '40px', borderRadius: '50%', background: 'rgba(59, 130, 246, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#3b82f6', transition: 'all 0.2s' }}>
                      <FiChevronRight size={20} />
                    </div>
                  </div>
                </ClientCard>
              ))}
            </ClientGrid>
          )}
        </>
      ) : (
        <>
          <LedgerFilterBar>
            <FilterGroup>
              <label>Search Logs</label>
              <input 
                type="text" 
                placeholder="Search description, reference..." 
                value={searchFilter}
                onChange={e => setSearchFilter(e.target.value)}
              />
            </FilterGroup>
            <FilterGroup>
              <label>Store Filter</label>
              <select 
                value={storeFilter} 
                onChange={e => setStoreFilter(e.target.value)}
              >
                <option value="all">All Corporate Stores</option>
                {clients.map(c => (
                  <option key={c.id} value={c.id}>{c.companyName}</option>
                ))}
              </select>
            </FilterGroup>
            <FilterGroup>
              <label>Start Date</label>
              <input 
                type="date" 
                value={startDateFilter}
                onChange={e => setStartDateFilter(e.target.value)}
              />
            </FilterGroup>
            <FilterGroup>
              <label>End Date</label>
              <input 
                type="date" 
                value={endDateFilter}
                onChange={e => setEndDateFilter(e.target.value)}
              />
            </FilterGroup>
            <ExportButton onClick={handleExportExcel}>
              <FiDownload /> Export Excel Report
            </ExportButton>
          </LedgerFilterBar>

          {loadingLedger ? (
            <div style={{ padding: '80px', textAlign: 'center', color: '#64748b' }}>
              <FiRefreshCw style={{ animation: 'spin 2s linear infinite', fontSize: '2rem', marginBottom: '12px' }} /> 
              <p style={{ fontWeight: 600 }}>Loading Master Ledger Entries...</p>
            </div>
          ) : filteredLedger.length === 0 ? (
            <EmptyState>
              <FiFileText />
              <div>
                <h3 style={{ fontSize: '1.5rem', color: '#fff', marginBottom: '8px' }}>No Ledger Records Found</h3>
                <p>No transaction logs matched your active filter options.</p>
              </div>
            </EmptyState>
          ) : (
            <>
              <LedgerTableContainer>
                <LedgerTable>
                  <thead>
                    <tr>
                      <th>S.No</th>
                      <th>Date & Time</th>
                      <th>Store Name</th>
                      <th>Type</th>
                      <th>Delivered</th>
                      <th>Returned</th>
                      <th>Price Per Jar</th>
                      <th>Total Value</th>
                      <th>Ref ID</th>
                      <th>Description</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredLedger.map((entry, index) => {
                      const date = parseLedgerTimestamp(entry.timestamp);
                      const clientName = clients.find(c => c.id === entry.clientId)?.companyName || 'Unknown Store';
                      const price = entry.deliveredCount && entry.deliveredCount > 0 && entry.amount 
                        ? entry.amount / entry.deliveredCount 
                        : (clients.find(c => c.id === entry.clientId)?.contractTerms?.pricePerJar || 35);
                        
                      return (
                        <tr key={entry.id}>
                          <td>{index + 1}</td>
                          <td>
                            <div style={{ fontWeight: 800, color: '#020617' }}>{format(date, 'MMM dd, yyyy')}</div>
                            <div style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 600 }}>{format(date, 'hh:mm a')}</div>
                          </td>
                          <td style={{ color: '#020617', fontWeight: 800 }}>{clientName}</td>
                          <td>
                            <StatusBadge $status={entry.type === 'delivery_handover' ? 'active' : 'pending'}>
                              {entry.type === 'delivery_handover' ? 'Handover' : entry.type.replace('_', ' ')}
                            </StatusBadge>
                          </td>
                          <td style={{ fontWeight: 800, color: '#059669' }}>{entry.deliveredCount || 0}</td>
                          <td style={{ fontWeight: 800, color: '#dc2626' }}>{entry.returnedCount || 0}</td>
                          <td>₹{price}</td>
                          <td style={{ fontWeight: 800, color: '#020617' }}>₹{(entry.amount || 0).toLocaleString()}</td>
                          <td style={{ fontFamily: 'Fira Code', fontSize: '0.8rem' }}>{entry.referenceId || entry.id?.slice(0, 8)}</td>
                          <td style={{ fontSize: '0.85rem', color: '#64748b', maxWidth: '200px' }}>{entry.description}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </LedgerTable>
              </LedgerTableContainer>

              <LedgerSummaryBar>
                <SummaryItem $color="#10b981">
                  <label>Total Jars Delivered</label>
                  <div className="value">
                    {filteredLedger.reduce((sum, entry) => sum + (entry.deliveredCount || 0), 0)}
                  </div>
                </SummaryItem>
                <SummaryItem $color="#ef4444">
                  <label>Total Jars Returned</label>
                  <div className="value">
                    {filteredLedger.reduce((sum, entry) => sum + (entry.returnedCount || 0), 0)}
                  </div>
                </SummaryItem>
                <SummaryItem $color="#3b82f6">
                  <label>Net Jars Delta</label>
                  <div className="value">
                    {filteredLedger.reduce((sum, entry) => sum + ((entry.deliveredCount || 0) - (entry.returnedCount || 0)), 0)}
                  </div>
                </SummaryItem>
                <SummaryItem $color="#020617">
                  <label>Total Billed Value</label>
                  <div className="value">
                    ₹{filteredLedger.reduce((sum, entry) => sum + (entry.amount || 0), 0).toLocaleString()}
                  </div>
                </SummaryItem>
              </LedgerSummaryBar>
            </>
          )}
        </>
      )}

      {/* ── Client Detail Drawer ── */}
      <AnimatePresence>
        {selectedClient && (
          <>
            <DrawerOverlay 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSelectedClient(null)}
            />
            <DrawerContent
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
            >
              <DrawerHeader>
                <div>
                  <StatusBadge $status={selectedClient.status} style={{ marginBottom: '8px', display: 'inline-block' }}>
                    {selectedClient.status}
                  </StatusBadge>
                  <h2>{selectedClient.companyName}</h2>
                </div>
                <DrawerClose onClick={() => setSelectedClient(null)}>
                  <FiArrowRight size={20} />
                </DrawerClose>
              </DrawerHeader>

              <DrawerSection>
                <h4><FiUsers /> Primary Contact</h4>
                <div style={{ background: '#f8fafc', padding: '20px', borderRadius: '16px' }}>
                  <div style={{ fontWeight: 800, fontSize: '1.1rem', marginBottom: '4px' }}>{selectedClient.primaryContact.name}</div>
                  <div style={{ color: '#64748b', fontWeight: 600, fontSize: '0.9rem', marginBottom: '12px' }}>{selectedClient.primaryContact.designation}</div>
                  <div style={{ display: 'flex', gap: '16px', fontSize: '0.85rem', fontWeight: 700 }}>
                    <span style={{ color: '#3b82f6' }}>{selectedClient.primaryContact.phone}</span>
                    <span style={{ color: '#64748b' }}>|</span>
                    <span style={{ color: '#3b82f6' }}>{selectedClient.primaryContact.email}</span>
                  </div>
                </div>
              </DrawerSection>

              <DrawerSection>
                <h4><FiDollarSign /> Financial Health</h4>
                <InfoRow>
                  <span className="label">Outstanding Amount</span>
                  <span className="value" style={{ color: (selectedClient.financialSummary?.outstandingAmount || 0) > 0 ? '#ef4444' : '#10b981' }}>
                    ₹{(selectedClient.financialSummary?.outstandingAmount || 0).toLocaleString()}
                  </span>
                </InfoRow>
                <InfoRow>
                  <span className="label">Credit Limit</span>
                  <span className="value">₹{(selectedClient.contractTerms?.creditLimit || 0).toLocaleString()}</span>
                </InfoRow>
                <InfoRow>
                  <span className="label">Advance Balance</span>
                  <span className="value">₹{(selectedClient.financialSummary?.advanceBalance || 0).toLocaleString()}</span>
                </InfoRow>
              </DrawerSection>

              <DrawerSection>
                <h4><FiPackage /> Logistics & Inventory</h4>
                <InfoRow>
                  <span className="label">Jars at Client</span>
                  <span className="value">{selectedClient.jarInventory?.atClient || 0} Units</span>
                </InfoRow>
                <InfoRow>
                  <span className="label">Allocated Fleet</span>
                  <span className="value">{selectedClient.jarInventory?.totalAllocated || 0} Units</span>
                </InfoRow>
                <InfoRow>
                  <span className="label">In Transit</span>
                  <span className="value">{selectedClient.jarInventory?.inTransit || 0} Units</span>
                </InfoRow>
              </DrawerSection>

              <DrawerSection>
                <h4><FiBriefcase /> Contract Summary</h4>
                <InfoRow>
                  <span className="label">Billing Cycle</span>
                  <span className="value" style={{ textTransform: 'capitalize' }}>{selectedClient.contractTerms?.billingCycle}</span>
                </InfoRow>
                <InfoRow>
                  <span className="label">Price Per Jar</span>
                  <span className="value">₹{selectedClient.contractTerms?.pricePerJar}</span>
                </InfoRow>
                <InfoRow>
                  <span className="label">Credit Period</span>
                  <span className="value">{selectedClient.contractTerms?.creditPeriod} Days</span>
                </InfoRow>
              </DrawerSection>

              <DrawerSection>
                <h4><FiTruck /> Recent Orders</h4>
                {loadingOrders ? (
                  <p style={{ fontSize: '0.85rem', color: '#64748b' }}>Fetching order history...</p>
                ) : orders.length === 0 ? (
                  <p style={{ fontSize: '0.85rem', color: '#64748b' }}>No recent orders found.</p>
                ) : (
                  orders.slice(0, 3).map(order => (
                    <OrderItem key={order.id}>
                      <div className="details">
                        <h5>Order #{order.id.slice(-6).toUpperCase()}</h5>
                        <p>{format(parseLedgerTimestamp(order.createdAt), 'dd MMM yyyy, hh:mm a')}</p>
                      </div>
                      <div className="amount">
                        ₹{order.totalAmount || 0}
                        <span>{order.quantity} Jars</span>
                      </div>
                    </OrderItem>
                  ))
                )}
              </DrawerSection>

              <div style={{ marginTop: 'auto', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <PrimaryButton 
                  style={{ width: '100%', justifyContent: 'center', background: '#3b82f6' }}
                  onClick={() => {
                    setShowScanner(true);
                    setDeliveryStep('scan_delivery');
                    setIsCameraActive(false); // Start with camera closed like in screenshot
                  }}
                >
                  <FiTruck /> Start Handover Session
                </PrimaryButton>
                <PrimaryButton 
                  style={{ width: '100%', justifyContent: 'center' }}
                  onClick={() => router.push(`/admin/b2b/${selectedClient.id}`)}
                >
                  View Full Profile <FiArrowRight />
                </PrimaryButton>
                <button 
                  style={{ 
                    width: '100%', 
                    padding: '14px', 
                    borderRadius: '14px', 
                    border: '1px solid #e2e8f0', 
                    background: 'white',
                    color: '#64748b',
                    fontWeight: 700,
                    cursor: 'pointer'
                  }}
                  onClick={() => setSelectedClient(null)}
                >
                  Close Preview
                </button>
              </div>
            </DrawerContent>
          </>
        )}
      </AnimatePresence>

      {/* ── Handover Modal ── */}
      {showScanner && (
        <HandoverModal>
          <HandoverContent>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
              <h2 style={{ fontSize: '1.8rem', fontWeight: 800 }}>Complete Delivery</h2>
              <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                <button style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.2)', color: 'white', padding: '8px 16px', borderRadius: '10px', fontSize: '0.75rem', fontWeight: 800 }}>RAW DATA</button>
                <FiPlus style={{ transform: 'rotate(45deg)', cursor: 'pointer', opacity: 0.5 }} size={24} onClick={() => { setShowScanner(false); setDeliveryStep('idle'); }} />
              </div>
            </div>

            <ProgressDots>
              <div className={`dot ${deliveryStep === 'scan_delivery' ? 'active' : ''}`} />
              <div className={`dot ${deliveryStep === 'scan_return' ? 'active' : ''}`} />
              <div className={`dot ${deliveryStep === 'finalize' ? 'active' : ''}`} />
              <div className="dot" />
            </ProgressDots>

            {conflict ? (
              /* Custom Conflict Resolver modal overlay */
              <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', background: 'rgba(239, 68, 68, 0.1)', border: '1px solid #ef4444', padding: '24px', borderRadius: '24px', animation: 'fadeIn 0.2s' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <FiAlertTriangle size={24} style={{ color: '#ef4444' }} />
                  <h3 style={{ fontSize: '1.25rem', fontWeight: 800, color: 'white', margin: 0 }}>Ownership Conflict Detected</h3>
                </div>
                
                <p style={{ fontSize: '0.95rem', color: 'rgba(255,255,255,0.8)', lineHeight: '1.5', margin: 0 }}>
                  Jar <strong style={{ color: '#10b981', fontFamily: 'monospace' }}>{conflict.jarId}</strong> is already assigned to:
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
                    <span style={{ fontWeight: 800 }}>{scannedDelivered.length} x ₹{selectedClient?.contractTerms?.pricePerJar}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', paddingTop: '12px', borderTop: '1px dashed rgba(255,255,255,0.2)' }}>
                    <span style={{ fontSize: '1.1rem', fontWeight: 800 }}>Total Bill</span>
                    <span style={{ fontSize: '1.1rem', fontWeight: 800, color: '#10b981' }}>₹{(scannedDelivered.length * (selectedClient?.contractTerms?.pricePerJar || 0)).toLocaleString()}</span>
                  </div>
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

                {/* List of scanned jars with delete buttons */}
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
                    If no jars are collected, click 'Next' to skip.
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

    </DashboardContainer>
  );
}
