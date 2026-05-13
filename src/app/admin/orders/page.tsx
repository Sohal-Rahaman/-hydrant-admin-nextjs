'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Image from 'next/image';
import styled, { keyframes, css } from 'styled-components';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  FiX, FiZap, FiAlertTriangle, FiMapPin, FiClock, FiSun, FiMoon, 
  FiCoffee, FiChevronRight, FiPhone, FiCheck, FiFilter, FiRefreshCw,
  FiArrowRight, FiMoreVertical, FiTruck, FiMap, FiSearch, FiNavigation,
  FiCheckCircle, FiPackage, FiDroplet, FiDownload, FiChevronUp, 
  FiChevronDown, FiBarChart2, FiRefreshCcw, FiCalendar
} from 'react-icons/fi';
import { 
  Phone, 
  Navigation, 
  X, 
  User, 
  Package, 
  Clock, 
  MapPin, 
  Wallet, 
  ChevronRight,
  CheckCircle,
  AlertCircle
} from 'lucide-react';
import { subscribeToCollection, updateDocument, db, assignJarToCustomer, returnJar, subscribeToLiveStatus } from '@/lib/firebase';
import UserInsightDrawer from '@/components/UserInsightDrawer';
import { normalizeOrderStatus } from '@/lib/orderStatus';
import { collection, getDocs } from 'firebase/firestore';
import { Player } from '@lottiefiles/react-lottie-player';
import { logActivity } from '@/lib/activityLogger';
import { useAuth } from '@/context/AuthContext';
import { DeliveryHandoverModal } from '@/components/DeliveryHandoverModal';
import { DeliveryMap } from '@/components/DeliveryMap';

/* ── Types ─────────────────────────────────────────────────── */
interface Order {
  id: string; userId: string; userName?: string; userPhone?: string; phone?: string;
  customerName?: string;
  status: 'pending'|'processing'|'completed'|'cancelled'|'canceled'|'placed'|'confirmed'|'in_progress'|'out_for_delivery'|'delivered';
  quantity: number; amount: number;
  address?: { street: string; city: string; pincode: string; full?: string; latitude?: number; longitude?: number };
  deliveryAddress?: { id?: string; type?: string; fullAddress?: string; address_line?: string; latitude?: number; longitude?: number };
  createdAt: Date|{toDate():Date}|string;
  orderType: 'regular'|'subscription';
  deliverySlot?: string; deliveryDate?: string|Date|{toDate():Date}|null;
  isPriority?: boolean; assignedPartner?: string; plusCode?: string;
  floorNumber?: string; hasLift?: boolean; isAddressVerified?: boolean;
  bewareOfDogs?: boolean; paymentMethod?: 'cash'|'wallet'|'upi'|'razorpay'|'card'|string;
  deliveryPartner?: { name: string; phone: string };
  updatedAt?: Date|{toDate():Date}|string;
  autoAssignAttempted?: boolean; priority?: number;
  sla_deadline?: Date|{toDate():Date}|string;
  items?: any[]; raw?: any;
  amountPaid?: number; deliveredJars?: number; collectedJars?: number;
  handover?: { deliveredJars:number; collectedJars:number; netChange:number; amountPaid?:number; proofImage?:string|null; notes?:string; completedAt:Date|{toDate():Date}|string };
  [key: string]: any;
}
interface User { id:string; name:string; phoneNumber:string; wallet_balance:number; jars_occupied:number; customerId?:string; userId?:string; [key: string]: any; }
interface ArmyMember { id:string; name:string; phoneNumber:string; isOnline:boolean; activeOrdersCount:number }

/* ── Helpers ────────────────────────────────────────────────── */
const getName = (order: Order, user?: any): string => {
  const n = user?.name || user?.full_name || order.customerName || order.userName || order.name || '';
  if (n) return n;
  if (order.userPhone || order.phone) return order.userPhone || order.phone || 'Customer';
  return 'Customer #' + order.id.slice(-4).toUpperCase();
};

const getTs = (d:any):number => {
  try {
    if (!d) return 0;
    if (typeof d==='string') return new Date(d).getTime();
    if (d instanceof Date) return d.getTime();
    if (typeof d==='object'&&'toDate'in d) return d.toDate().getTime();
    return 0;
  } catch { return 0; }
};

const fmt = (d?: { toDate(): Date } | Date | string | null) => {
  if (!d) return '—';
  try {
    const dt = typeof d === 'object' && 'toDate' in d ? d.toDate() : new Date(d as string | Date);
    return dt.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
  } catch { return '—'; }
};

const dist = (lat1: number, lon1: number, lat2: number, lon2: number) => {
  const R = 6371; // km
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
          Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
          Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
};

const WAREHOUSE = { lat: 22.6362, lng: 88.4299 };

const timeAgo = (d:any):string => {
  const ms = Date.now() - getTs(d);
  const m = Math.floor(ms/60000);
  if (m<1) return 'just now';
  if (m<60) return `${m}m ago`;
  const h = Math.floor(m/60);
  if (h<24) return `${h}h ago`;
  return `${Math.floor(h/24)}d ago`;
};

const STATUS_COLOR:Record<string,string> = {
  placed:'#F59E0B', pending:'#F59E0B', confirmed:'#3B82F6',
  processing:'#3B82F6', in_progress:'#8B5CF6', out_for_delivery:'#10B981',
  completed:'#10B981', delivered:'#10B981', cancelled:'#EF4444', canceled:'#EF4444',
};
const STATUS_PROGRESS:Record<string,number> = {
  placed:15, pending:20, confirmed:35, processing:50,
  in_progress:65, out_for_delivery:85, completed:100, delivered:100, cancelled:0, canceled:0,
};
const STATUS_LABEL:Record<string,string> = {
  placed:'Placed', pending:'Pending', confirmed:'Confirmed', processing:'Processing',
  in_progress:'In Progress', out_for_delivery:'Out for Delivery',
  completed:'Delivered', delivered:'Delivered', cancelled:'Cancelled', canceled:'Cancelled',
};

const PM_COLOR:Record<string,string> = { cash:'#F59E0B', wallet:'#3B82F6', upi:'#8B5CF6' };

/* ── Animations ─────────────────────────────────────────────── */
const pulseBorder = keyframes`
  0%,100%{box-shadow:0 0 0 0 rgba(239,68,68,0.3)}
  50%{box-shadow:0 0 0 6px rgba(239,68,68,0)}
`;
const shimmer = keyframes`
  0%{background-position:-200% 0}100%{background-position:200% 0}
`;
const spin = keyframes`from{transform:rotate(0deg)}to{transform:rotate(360deg)}`;
const fadeUp = keyframes`from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:translateY(0)}`;

/* ── Styled Components ──────────────────────────────────────── */
const Page = styled.div`
  min-height: 100vh;
  background: var(--background);
  color: var(--foreground);
  font-family: 'Fira Sans', sans-serif;
  padding-bottom: 120px;
`;

const TopBar = styled.div`
  background: var(--color-background-secondary);
  backdrop-filter: blur(24px);
  padding: 12px 20px;
  border-bottom: 1px solid var(--color-border-primary);
  position: sticky;
  top: 0;
  z-index: 100;
  @media (max-width: 1024px) { top: 64px }
`;
const TopBarRow = styled.div`
  display:flex; align-items:center; justify-content:space-between; gap:12px;
  @media(max-width:768px){flex-wrap:wrap}
`;
const TitleGroup = styled.div`
  display:flex; align-items:center; gap:10px; flex-shrink:0;
  @media(max-width:768px){display:none}
`;
const PageTitle = styled.h1`
  font-size: 1.1rem;
  font-weight: 700;
  color: var(--foreground);
  margin: 0;
  letter-spacing: -0.3px;
  font-family: 'Fira Code', monospace;
  text-transform: uppercase;
`;

const PageSub = styled.p`
  font-size: 10px;
  color: var(--color-text-tertiary);
  margin: 0;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.5px;
`;

const SearchRow = styled.div`
  display:flex; gap:8px; align-items:center; flex:1; min-width:0;
  @media(max-width:768px){flex:0 0 100%}
`;
const SearchBox = styled.div`
  background: var(--color-background-tertiary);
  border: 1px solid var(--color-border-primary);
  border-radius: var(--radius-technical);
  display: flex;
  align-items: center;
  padding: 0 14px;
  gap: 8px;
  flex: 1;
  transition: all 0.2s;
  &:focus-within { border-color: var(--color-accent-cyan); box-shadow: 0 0 0 1px var(--color-accent-cyan); }
`;

const SearchInput = styled.input`
  background: transparent;
  border: none;
  padding: 10px 0;
  color: var(--foreground);
  outline: none;
  font-size: 0.85rem;
  font-family: 'Fira Code', monospace;
  width: 100%;
  &::placeholder { color: var(--color-text-tertiary); }
`;

const IconBtn = styled.button`
  background: var(--color-background-tertiary);
  border: 1px solid var(--color-border-primary);
  border-radius: var(--radius-technical);
  color: var(--color-text-secondary);
  width: 40px;
  height: 40px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  flex-shrink: 0;
  transition: all 0.2s;
  &:hover { border-color: var(--color-accent-cyan); color: var(--color-accent-cyan); }
`;

const StatsTabs = styled.div`
  display: flex;
  gap: 8px;
  padding: 12px 20px;
  overflow-x: auto;
  border-bottom: 1px solid var(--color-border-primary);
  background: var(--background);
  &::-webkit-scrollbar { display: none }
`;
const StatTab = styled.button<{ $active: boolean; $clr: string }>`
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 8px 16px;
  border-radius: var(--radius-technical);
  border: 1px solid ${p => p.$active ? p.$clr : 'var(--color-border-primary)'};
  background: ${p => p.$active ? `${p.$clr}15` : 'var(--color-background-secondary)'};
  color: ${p => p.$active ? p.$clr : 'var(--color-text-secondary)'};
  cursor: pointer;
  transition: all 0.2s;
  white-space: nowrap;
  flex-shrink: 0;
  &:hover { border-color: ${p => p.$clr}; color: ${p => p.$clr}; }
  .num { font-family: 'Fira Code', monospace; font-size: 1.2rem; font-weight: 700; line-height: 1; }
  .lbl { font-size: 9px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.5px; opacity: 0.8; }
`;

const FilterStrip = styled.div`
  display:flex; gap:8px; padding:8px 20px; border-bottom:1px solid #1a1a1a; overflow-x:auto;
  &::-webkit-scrollbar{display:none}
`;
const FPill = styled.button<{$active:boolean}>`
  padding:6px 14px; border-radius:10px; font-size:12px; font-weight:700; cursor:pointer;
  border:1px solid ${p=>p.$active?'#10B981':'#242424'};
  background:${p=>p.$active?'rgba(16,185,129,.1)':'transparent'};
  color:${p=>p.$active?'#10B981':'#555'}; white-space:nowrap;
  transition:all .2s;
  &:hover{border-color:#10B981;color:#10B981}
`;

/* ── Card ── */
const CardWrap = styled(motion.div)<{ $delayed: boolean }>`
  background: var(--color-background-secondary);
  border-radius: var(--radius-technical);
  overflow: hidden;
  border: 1px solid ${p => p.$delayed ? 'rgba(239, 68, 68, 0.4)' : 'var(--color-border-primary)'};
  position: relative;
  margin-bottom: 8px;
  cursor: pointer;
  transition: all 0.15s;
  ${p => p.$delayed && css`animation: ${pulseBorder} 2s infinite`}
  &:hover { border-color: var(--color-border-secondary); background: var(--color-background-tertiary); }
`;
const Accent = styled.div<{$clr:string}>`
  position:absolute; left:0; top:0; bottom:0; width:4px; background:${p=>p.$clr};
`;
const CardBody = styled.div`padding:14px 14px 14px 18px`;

const Row = styled.div`display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 6px`;
const CName = styled.div`font-size: 14px; font-weight: 700; color: var(--foreground); letter-spacing: -0.2px`;
const AmtChip = styled.div`
  font-family: 'Fira Code', monospace;
  font-size: 14px;
  font-weight: 700;
  color: var(--color-accent-green);
  background: rgba(163, 230, 53, 0.1);
  border: 1px solid rgba(163, 230, 53, 0.2);
  border-radius: var(--radius-technical);
  padding: 2px 8px;
  white-space: nowrap;
  flex-shrink: 0;
`;

const MetaRow = styled.div`display:flex;align-items:center;gap:6px;flex-wrap:wrap;margin-bottom:10px`;
const Chip = styled.div<{ $v: 'id' | 'time' | 'priority' | 'delayed' | 'partner' | 'status' }>`
  display: flex;
  align-items: center;
  gap: 3px;
  font-size: 10px;
  font-weight: 700;
  border-radius: var(--radius-technical);
  padding: 2px 6px;
  font-family: 'Fira Code', monospace;
  ${p => p.$v === 'id' && css`background: var(--color-background-tertiary); color: var(--color-text-secondary); border: 1px solid var(--color-border-primary)`}
  ${p => p.$v === 'time' && css`color: var(--color-text-tertiary); background: transparent; padding: 0`}
  ${p => p.$v === 'priority' && css`background: rgba(0, 229, 255, 0.1); color: var(--color-accent-cyan); border: 1px solid rgba(0, 229, 255, 0.3)`}
  ${p => p.$v === 'delayed' && css`background: rgba(239, 68, 68, 0.1); color: #EF4444; border: 1px solid rgba(239, 68, 68, 0.3)`}
  ${p => p.$v === 'partner' && css`background: rgba(163, 230, 53, 0.1); color: var(--color-accent-green); border: 1px solid rgba(163, 230, 53, 0.3)`}
  ${p => p.$v === 'status' && css`background: var(--color-background-tertiary); color: var(--color-text-tertiary); border: 1px solid var(--color-border-primary)`}
`;

const AddrBox = styled.div`
  display: flex;
  align-items: flex-start;
  gap: 6px;
  background: var(--color-background-tertiary);
  border: 1px solid var(--color-border-primary);
  border-radius: var(--radius-technical);
  padding: 8px 10px;
  margin-bottom: 10px;
  font-size: 11px;
  color: var(--color-text-secondary);
  line-height: 1.4;
`;

const AddrText = styled.div`
  overflow: hidden;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
`;

const FloorRow = styled.div`
  display: flex;
  gap: 6px;
  margin-top: 4px;
  font-size: 10px;
  color: var(--color-text-tertiary);
`;

const TagRow = styled.div`display:flex;gap:6px;flex-wrap:wrap;margin-bottom:10px`;
const Tag = styled.div<{ $clr?: string }>`
  padding: 2px 8px;
  border-radius: var(--radius-technical);
  font-size: 9px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.3px;
  font-family: 'Fira Code', monospace;
  background: ${p => p.$clr ? `${p.$clr}15` : 'var(--color-background-tertiary)'};
  color: ${p => p.$clr || 'var(--color-text-tertiary)'};
  border: 1px solid ${p => p.$clr ? `${p.$clr}30` : 'var(--color-border-primary)'};
`;

const LiveDot = styled.div`
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: #10B981;
  box-shadow: 0 0 0 rgba(16, 185, 129, 0.4);
  animation: pulse-live 2s infinite;
  @keyframes pulse-live {
    0% { box-shadow: 0 0 0 0 rgba(16, 185, 129, 0.4); }
    70% { box-shadow: 0 0 0 10px rgba(16, 185, 129, 0); }
    100% { box-shadow: 0 0 0 0 rgba(16, 185, 129, 0); }
  }
`;

const PBar = styled.div`height:3px;background:#1a1a1a;border-radius:2px;margin-bottom:10px;overflow:hidden`;
const PFill = styled.div<{$w:number;$clr:string}>`
  height:100%;width:${p=>p.$w}%;background:${p=>p.$clr};border-radius:2px;transition:width .4s
`;

const ActGrid = styled.div`
  display:grid;grid-template-columns:repeat(4,1fr);gap:6px;margin-bottom:10px;
  @media(max-width:400px){grid-template-columns:repeat(2,1fr)}
`;
const ABtn = styled.button<{ $v?: 'primary' | 'danger' | 'info' | 'default' }>`
  padding: 8px 6px;
  border-radius: var(--radius-technical);
  font-size: 10px;
  font-weight: 700;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 4px;
  cursor: pointer;
  min-height: 40px;
  transition: all 0.15s;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  ${p => p.$v === 'primary' && css`background: var(--color-accent-green); border: 1px solid var(--color-accent-green); color: #000; &:hover { filter: brightness(1.1) }`}
  ${p => p.$v === 'danger' && css`background: rgba(239, 68, 68, 0.1); border: 1px solid rgba(239, 68, 68, 0.3); color: #EF4444; &:hover { background: rgba(239, 68, 68, 0.2) }`}
  ${p => p.$v === 'info' && css`background: rgba(0, 229, 255, 0.1); border: 1px solid rgba(0, 229, 255, 0.3); color: var(--color-accent-cyan); &:hover { background: rgba(0, 229, 255, 0.2) }`}
  ${p => (!p.$v || p.$v === 'default') && css`background: var(--color-background-tertiary); border: 1px solid var(--color-border-primary); color: var(--color-text-secondary); &:hover { border-color: var(--color-border-secondary) }`}
`;
const PSel = styled.select`
  width: 100%;
  padding: 8px 12px;
  border-radius: var(--radius-technical);
  border: 1px solid var(--color-border-primary);
  background: var(--color-background-tertiary);
  color: var(--color-text-secondary);
  font-size: 11px;
  font-family: 'Fira Sans', sans-serif;
  font-weight: 600;
  cursor: pointer;
  outline: none;
  appearance: none;
  &:focus { border-color: var(--color-accent-cyan) }
  &:hover { border-color: var(--color-border-secondary) }
  option { background: var(--color-background-tertiary) }
`;

/* ── Slot section headers ── */
const SlotSection = styled.div`margin-bottom:24px`;
const SlotHead = styled.div<{ $clr: string }>`
  display:flex;align-items:center;gap:10px;margin-bottom:12px;padding:0 4px;
  .icon{color:${p=>p.$clr}}
  .txt{font-size:12px;font-weight:800;text-transform:uppercase;letter-spacing:1px;color:#1A1A1A}
  .badge{background:${p=>p.$clr}15;color:${p=>p.$clr};font-size:10px;font-weight:900;padding:2px 8px;border-radius:12px}
  .ln{flex:1;height:1px;background:#E2E8F0}
`;

const MobileViewContainer = styled.div`
  @media(min-width:1024px){display:none}
  background: #F8FBFB;
  min-height: 100vh;
  color: #1A1A1A;
`;

const MobStatusBar = styled.div`
  background: #0F6E56;
  color: #E1F5EE;
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px 16px 6px;
  font-size: 11px;
  font-weight: 500;
  position: sticky;
  top: 0;
  z-index: 200;
`;

const MobTopBar = styled.div`
  background: #0F6E56;
  color: #E1F5EE;
  padding: 10px 16px 14px;
  position: sticky;
  top: 25px;
  z-index: 150;
`;

const MobTopBarRow = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
`;

const MobStatsRow = styled.div`
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 8px;
  margin-top: 2px;
`;

const MobStatPill = styled.div`
  background: rgba(255,255,255,0.12);
  border-radius: 8px;
  padding: 6px 8px;
  text-align: center;
  .val { font-size: 15px; font-weight: 700; color: #fff; line-height: 1.2; }
  .lbl { font-size: 8px; color: #9FE1CB; margin-top: 1px; text-transform: uppercase; font-weight: 800; letter-spacing: 0.3px; }
`;

const MobViewTabs = styled.div`
  display: flex;
  border-bottom: 1px solid #E2E8F0;
  background: #ffffff;
  position: sticky;
  top: 130px;
  z-index: 100;
`;

const MobViewTab = styled.button<{ $active: boolean }>`
  flex: 1;
  text-align: center;
  padding: 12px 0;
  font-size: 13px;
  font-weight: 700;
  color: ${p => p.$active ? '#0F6E56' : 'var(--color-text-tertiary)'};
  cursor: pointer;
  border: none;
  background: transparent;
  border-bottom: 2px solid ${p => p.$active ? '#0F6E56' : 'transparent'};
  transition: all 0.15s;
  text-transform: uppercase;
  letter-spacing: 0.5px;
`;

const MobContent = styled.div`
  padding: 12px;
  background: #F1F5F9;
  min-height: 80vh;
`;

const MobSummaryStrip = styled.div`
  display: flex;
  gap: 8px;
  margin-bottom: 16px;
`;

const MobSumCard = styled.div<{ $clr: string }>`
  flex: 1;
  background: #ffffff;
  border-radius: var(--radius-technical);
  border: 1px solid #E2E8F0;
  padding: 10px 8px;
  text-align: center;
  box-shadow: 0 1px 3px rgba(0,0,0,0.05);
  .val { font-size: 20px; font-weight: 800; color: ${p => p.$clr}; font-family: 'Fira Code', monospace; }
  .lbl { font-size: 9px; color: #64748B; margin-top: 2px; text-transform: uppercase; font-weight: 700; }
`;

const MobSeqBadge = styled.div<{ $status: 'active' | 'next' | 'std' }>`
  width: 28px;
  height: 28px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 12px;
  font-weight: 800;
  flex-shrink: 0;
  margin-right: 12px;
  font-family: 'Fira Code', monospace;
  ${p => p.$status === 'active' && 'background: #0F6E56; color: #E1F5EE; box-shadow: 0 0 10px rgba(15,110,86,0.2);'}
  ${p => p.$status === 'next' && 'background: #E1F5EE; color: #0F6E56; border: 1px solid #0F6E56;'}
  ${p => p.$status === 'std' && 'background: #EDF2F7; color: #4A5568;'}
`;

const MobOrderCard = styled(motion.div)<{ $fast?: boolean }>`
  background: #fff;
  border-radius: 32px;
  padding: 28px;
  margin-bottom: 24px;
  box-shadow: 0 20px 40px rgba(0,0,0,0.04), 0 1px 2px rgba(0,0,0,0.01);
  border: 1px solid #F1F5F9;
  position: relative;
  overflow: hidden;
  min-height: 400px;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  transition: all 0.4s cubic-bezier(0.4, 0, 0.2, 1);
  ${props => props.$fast && `
    border: 2px solid #EF444430;
    background: linear-gradient(to bottom right, #fff, #FFF5F5);
  `}
`;

const SkeletonPulse = keyframes`
  0% { background-position: -200% 0; }
  100% { background-position: 200% 0; }
`;

const MobSkeletonCard = styled.div`
  background: #fff;
  border-radius: 32px;
  padding: 28px;
  margin-bottom: 24px;
  min-height: 400px;
  border: 1px solid #F1F5F9;
  .shimmer {
    background: linear-gradient(90deg, #F1F5F9 25%, #F8FAFC 50%, #F1F5F9 75%);
    background-size: 200% 100%;
    animation: ${SkeletonPulse} 1.5s infinite linear;
    border-radius: 8px;
  }
`;

const MobCardTitle = styled.div`
  font-size: 26px;
  font-weight: 900;
  color: #111827;
  letter-spacing: -0.03em;
  line-height: 1.1;
`;

const MobCardAddress = styled.div`
  font-size: 16px;
  color: #4B5563;
  margin-top: 12px;
  line-height: 1.6;
  font-weight: 600;
  display: flex;
  align-items: flex-start;
  gap: 10px;
`;

const MobActionGrid = styled.div`
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
  margin-top: 24px;
`;

const BigActionBtn = styled.button<{ $variant: 'call' | 'nav' | 'done' | 'cancel' }>`
  height: 58px;
  border-radius: 18px;
  border: none;
  font-size: 15px;
  font-weight: 800;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
  cursor: pointer;
  transition: all 0.2s;
  font-family: 'Outfit', sans-serif;
  
  ${props => props.$variant === 'call' && `
    background: #DCFCE7;
    color: #166534;
    border: 1px solid #BBF7D0;
  `}
  ${props => props.$variant === 'nav' && `
    background: #DBEAFE;
    color: #1E40AF;
    border: 1px solid #BFDBFE;
  `}
  ${props => props.$variant === 'done' && `
    background: #111827;
    color: #fff;
    grid-column: 1 / -1;
  `}
  ${props => props.$variant === 'cancel' && `
    background: #FFF1F2;
    color: #9F1239;
    border: 1px solid #FECDD3;
    grid-column: 1 / -1;
    height: 48px;
    margin-top: 8px;
    font-size: 13px;
    opacity: 0.8;
  `}
`;

const MobDetailRow = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 18px;
`;

const TacticalBadge = styled.div<{ $color?: string; $bg?: string }>`
  padding: 6px 12px;
  border-radius: 12px;
  font-size: 11px;
  font-weight: 900;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  display: flex;
  align-items: center;
  gap: 6px;
  background: ${props => props.$bg || '#F1F5F9'};
  color: ${props => props.$color || '#64748B'};
`;

const MobDivider = styled.div`
  display: flex;
  align-items: center;
  gap: 12px;
  margin: 20px 0 12px;
  span {
    font-size: 10px;
    font-weight: 800;
    color: var(--color-text-tertiary);
    text-transform: uppercase;
    letter-spacing: 0.1em;
    white-space: nowrap;
  }
  &::before, &::after {
    content: '';
    flex: 1;
    height: 1px;
    background: var(--color-border-primary);
  }
`;

/* ── Kanban (desktop) ── */
const KanbanBoard = styled.div`
  display:flex;gap:14px;padding:20px;overflow-x:auto;min-height:calc(100vh - 280px);
  &::-webkit-scrollbar{height:6px}
  &::-webkit-scrollbar-thumb{background:#2a2a2a;border-radius:3px}
  @media(max-width:1023px){display:none}
`;
const Lane = styled.div`min-width:295px;max-width:295px;display:flex;flex-direction:column;gap:0`;
const LaneHead = styled.div<{ $clr: string }>`
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 4px 12px;
  .left {
    display: flex;
    align-items: center;
    gap: 8px;
    .ic { color: ${p => p.$clr } }
    .title { font-family: 'Fira Code', monospace; font-size: 13px; font-weight: 700; color: ${p => p.$clr }; text-transform: uppercase; }
    .sub { font-size: 9px; color: var(--color-text-tertiary); font-weight: 600; display: block; margin-top: 1px; text-transform: uppercase; }
  }
  .cnt { 
    background: var(--color-background-tertiary); 
    border: 1px solid var(--color-border-primary); 
    padding: 2px 8px; 
    border-radius: 4px; 
    font-family: 'Fira Code', monospace;
    font-size: 11px; 
    font-weight: 700; 
    color: var(--color-text-secondary); 
  }
`;

/* ── Flat list (completed/cancelled) ── */
const FlatGrid = styled.div`
  padding:16px;
  display:grid;gap:0;
  @media(min-width:768px){grid-template-columns:repeat(2,1fr);gap:0 12px}
  @media(min-width:1280px){grid-template-columns:repeat(3,1fr)}
`;

/* ── Skeleton ── */
const SkeletonWrap = styled.div`
  background:#181818;border-radius:18px;border:1px solid #1e1e1e;
  padding:16px 18px;margin-bottom:10px;
`;
const SkLine = styled.div<{$w?:string;$h?:string}>`
  height:${p=>p.$h||'12px'};width:${p=>p.$w||'100%'};margin-bottom:8px;border-radius:6px;
  background:linear-gradient(90deg,#1e1e1e 25%,#2a2a2a 50%,#1e1e1e 75%);
  background-size:200% 100%;animation:${shimmer} 1.4s infinite;
`;

const EmptySlot = styled.div`
  display:flex;flex-direction:column;align-items:center;gap:8px;
  padding:32px 20px;color:#444;
  .ic{font-size:28px;margin-bottom:4px;color:#2a2a2a}
  .t{font-size:13px;font-weight:700;color:#444}
  .s{font-size:12px;color:#333}
`;

/* ── Modal ── */
const ModalBg = styled(motion.div)`
  position:fixed;inset:0;background:rgba(0,0,0,.7);backdrop-filter:blur(8px);
  z-index:1000;display:flex;align-items:center;justify-content:center;padding:20px
`;
const ModalBox = styled(motion.div)`
  background: var(--color-background-secondary);
  border-radius: var(--radius-technical);
  border: 1px solid var(--color-border-primary);
  width: 100%;
  max-width: 600px;
  position: relative;
  color: var(--foreground);
`;

const MHead = styled.div`
  padding: 24px 24px 16px;
  border-bottom: 1px solid var(--color-border-primary);
`;

const MTitle = styled.h2`
  color: var(--foreground);
  margin: 0;
  font-size: 1.2rem;
  font-weight: 700;
  display: flex;
  align-items: center;
  gap: 10px;
  font-family: 'Fira Code', monospace;
  text-transform: uppercase;
`;
const MClose = styled.button`
  position:absolute;top:18px;right:18px;background:none;border:none;
  font-size:1.4rem;color:#94a3b8;cursor:pointer;padding:6px;border-radius:8px;
  &:hover{background:#f1f5f9;color:#1e293b}
`;
const MBody = styled.div`padding: 20px 24px 24px`;

const TextArea = styled.textarea`
  width: 100%;
  padding: 12px;
  background: var(--color-background-tertiary);
  border: 1px solid var(--color-border-primary);
  border-radius: var(--radius-technical);
  font-size: 0.9rem;
  color: var(--foreground);
  resize: vertical;
  min-height: 80px;
  font-family: inherit;
  &:focus { outline: none; border-color: var(--color-accent-cyan); }
`;

const MActionBtn = styled.button<{ $primary?: boolean }>`
  padding: 10px 20px;
  border-radius: var(--radius-technical);
  cursor: pointer;
  font-weight: 700;
  font-size: 0.9rem;
  display: flex;
  align-items: center;
  gap: 8px;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  ${p => p.$primary
    ? 'background: var(--color-accent-green); border: none; color: #000;'
    : 'background: var(--color-background-tertiary); color: var(--color-text-secondary); border: 1px solid var(--color-border-primary);'}
`;

const SpinWrap = styled.div`
  display:flex;align-items:center;justify-content:center;min-height:60vh;background:#0c0c0c;
  svg{animation:${spin} 1s linear infinite;color:#10B981}
`;

/* ── Live Status Badge ── */
const LiveStatusBadge = ({ orderId, initialStatus }: { orderId: string; initialStatus: string }) => {
  const [liveStatus, setLiveStatus] = useState(initialStatus);
  const [isLive, setIsLive] = useState(false);

  useEffect(() => {
    const unsub = subscribeToLiveStatus(orderId, (data) => {
      if (data && data.status) {
        setLiveStatus(data.status);
        setIsLive(true);
      }
    });
    return () => unsub();
  }, [orderId]);

  const clr = STATUS_COLOR[liveStatus] || STATUS_COLOR.pending;
  const lbl = STATUS_LABEL[liveStatus] || liveStatus;

  return (
    <Tag $clr={clr}>
      {isLive && <LiveDot style={{ marginRight: 6, width: 6, height: 6 }} />}
      {lbl}
    </Tag>
  );
};

/* ════════════════════════════════════════════════════════════
   COMPONENT
════════════════════════════════════════════════════════════ */
export default function OrdersPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [armyMembers, setArmyMembers] = useState<ArmyMember[]>([]);
  const [filteredOrders, setFilteredOrders] = useState<Order[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedOrder, setSelectedOrder] = useState<Order|null>(null);
  const [showModal, setShowModal] = useState(false);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [activeTab, setActiveTab] = useState<'open'|'completed'|'cancelled'|'statement'|'logistics'>('open');
  // Statement tab state
  const [stmtRange, setStmtRange] = useState<'today'|'yesterday'|'week'|'month'|'year'|'custom'>('month');
  const [stmtFrom, setStmtFrom] = useState('');
  const [stmtTo, setStmtTo] = useState('');
  const [stmtSort, setStmtSort] = useState<{col:string;dir:'asc'|'desc'}>({col:'createdAt',dir:'desc'});
  const [stmtStatus, setStmtStatus] = useState<'all'|'delivered'|'cancelled'>('all');
  const [editingCell, setEditingCell] = useState<{id:string;field:string;type:'order'|'user'}|null>(null);
  const [editValue, setEditValue] = useState('');
  const [showQRModal, setShowQRModal] = useState(false);
  const [selectedQRCodeOrder, setSelectedQRCodeOrder] = useState<Order|null>(null);
  const [bulkPartner, setBulkPartner] = useState('');
  const [isBulkAssigning, setIsBulkAssigning] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [selectedUserForDrawer, setSelectedUserForDrawer] = useState<any>(null);
  const [isUserDrawerOpen, setIsUserDrawerOpen] = useState(false);
  const [mobileTab, setMobileTab] = useState<'queue'|'map'|'done'>('queue');
  const [cancelConfirm, setCancelConfirm] = useState<string|null>(null);
  const searchParams = useSearchParams();
  const orderIdParam = searchParams.get('orderId');
  const router = useRouter();
  const { currentUser: userAuth } = useAuth();

  /* ── Helpers ── */
  const getUserDetails = (id:string|undefined):User|undefined => {
    if(!id) return;
    const cid=id.toString().trim();
    const ph=cid.replace('+91','').replace(/\s/g,'');
    return users.find(u=>{
      const up=u.phoneNumber?.toString().replace(/\s/g,'');
      return u.id===cid||u.customerId===cid||u.userId===cid||up===ph||
        (up&&ph.includes(up))||(ph&&up?.includes(ph));
    });
  };

  const checkDelayed = (o:Order):boolean => {
    if(activeTab!=='open') return false;
    const openStatus=['placed','pending','confirmed','processing','in_progress','out_for_delivery'];
    if(!openStatus.includes(o.status?.toLowerCase())) return false;
    const toDate=(d:any):Date|null=>{
      if(!d) return null;
      try{if(typeof d==='string') return new Date(d);if(d instanceof Date)return d;if('toDate'in d)return d.toDate();return null;}catch{return null;}
    };
    const now=new Date();
    if(o.sla_deadline){
      const dl=typeof o.sla_deadline==='object'&&'toDate'in o.sla_deadline?o.sla_deadline.toDate():new Date(o.sla_deadline as string);
      return now>dl;
    }
    const today=new Date(now.getFullYear(),now.getMonth(),now.getDate());
    const dd=toDate(o.deliveryDate||o.createdAt);
    if(!dd) return false;
    const od=new Date(dd.getFullYear(),dd.getMonth(),dd.getDate());
    if(od<today) return true;
    if(od.getTime()===today.getTime()){
      const t=now.getHours()*60+now.getMinutes();
      const s=o.deliverySlot?.toLowerCase()||'';
      if(s.includes('morning')||s.includes('11:00')||s.includes('8:00')) return t>(13*60+30);
      if(s.includes('afternoon')||s.includes('2:30')||s.includes('1:00')) return t>(16*60+30);
      if(s.includes('evening')||s.includes('6:00')||s.includes('5:00')) return t>(22*60+30);
      return t>(22*60);
    }
    return false;
  };

  /* URL param: jump to order */
  useEffect(() => {
    if (orderIdParam && orders.length > 0) {
      setSearchTerm(orderIdParam);
      const order = orders.find(o => o.id === orderIdParam);
      if (order) {
        if (['completed','delivered'].includes(order.status)) setActiveTab('completed');
        else if (['cancelled','canceled'].includes(order.status)) setActiveTab('cancelled');
        else setActiveTab('open');
      }
    }
  }, [orderIdParam, orders]);

  /* Firebase subscriptions */
  useEffect(() => {
    setLoading(true);
    const unsubOrders = subscribeToCollection('orders', (snapshot) => {
      if (snapshot.empty) { setOrders([]); setFilteredOrders([]); return; }
      try {
        const data = snapshot.docs.map(doc => {
          const d = doc.data();
          const pinRe = (s:string) => s?.match(/\b(\d{6})\b/)?.[1] || 'UNKNOWN';
          const qty = d.items?.reduce((a:number,i:any)=>a+(i.quantity||0),0)||d.quantity||1;
          const amt = d.total||d.amount||d.items?.reduce((a:number,i:any)=>a+(i.price||i.amount||0),0)||(qty*37);
          const raw = d.deliveryAddress||d.address;
          const gs = (v:any)=>typeof v==='string'?v:'';
          let full='',street='',pin='';
          if (typeof raw==='string') { full=raw;street=raw;pin=pinRe(raw); }
          else if (raw && typeof raw==='object') {
            full=gs(raw.fullAddress||raw.full||'');
            street=gs(raw.street||raw.area||full);
            pin=gs(raw.pincode||'');
            if(!pin&&full) pin=pinRe(full);
          }
          const o:Order = {
            id:doc.id, userId:String(d.userId||d.customerId||''),
            userName:String(d.customerName||d.userName||d.full_name||d.name||''),
            userPhone:String(d.customerPhone||d.phoneNumber||d.phone||''),
            status:String(d.status||'pending') as Order['status'],
            quantity:qty, amount:amt,
            address:{street,city:String(d.deliveryAddress?.city||d.address?.city||''),pincode:pin,full},
            createdAt:d.createdAt||d.orderDate||d.timestamp||new Date(),
            orderType:String(d.orderType||(d.subscriptionId?'subscription':'regular')) as Order['orderType'],
            deliverySlot:d.deliverySlot, deliveryDate:d.deliveryDate,
            isPriority:d.isPriority, assignedPartner:d.assignedPartner,
            plusCode:d.plusCode||d.deliveryAddress?.plusCode||d.address?.plusCode,
            floorNumber:d.floorNumber||d.deliveryAddress?.floor||d.address?.floor,
            hasLift:d.hasLift??d.deliveryAddress?.hasLift??d.address?.hasLift,
            isAddressVerified:d.isAddressVerified??d.deliveryAddress?.isVerified??d.address?.isVerified,
            bewareOfDogs:d.bewareOfDogs??d.deliveryAddress?.bewareOfDogs??d.address?.bewareOfDogs,
            paymentMethod:String(d.paymentMethod||'cash') as Order['paymentMethod'],
            deliveryPartner:d.deliveryPartner, updatedAt:d.updatedAt,
            priority:d.priority??0, sla_deadline:d.sla_deadline,
            items:d.items||[], 
            handover: d.handover ? {
              deliveredJars: d.handover.deliveredJars ?? d.handover.delivered_jars ?? d.quantity ?? 0,
              collectedJars: d.handover.collectedJars ?? d.handover.collected_jars ?? d.handover.returnedJars ?? d.handover.returned_jars ?? d.handover.emptyJars ?? d.handover.empty_jars ?? 0,
              netChange: d.handover.netChange ?? d.handover.net_change ?? 0,
              amountPaid: d.handover.amountPaid ?? d.handover.amount_paid ?? 0,
              completedAt: d.handover.completedAt ?? d.handover.completed_at ?? d.updatedAt ?? null,
              notes: d.handover.notes ?? ''
            } : (d.deliveredJars !== undefined || d.collectedJars !== undefined || d.returnedJars !== undefined || d.emptyJars !== undefined ? {
              deliveredJars: d.deliveredJars ?? d.delivered_jars ?? d.quantity ?? 0,
              collectedJars: d.collectedJars ?? d.collected_jars ?? d.returnedJars ?? d.returned_jars ?? d.emptyJars ?? d.empty_jars ?? 0,
              netChange: (d.deliveredJars ?? 0) - (d.collectedJars ?? d.returned_jars ?? 0),
              amountPaid: d.amountPaid ?? d.amount_paid ?? 0,
              completedAt: d.completedAt ?? d.completed_at ?? d.updatedAt ?? null,
              notes: ''
            } : undefined),
            raw:d,
          };
          o.status = normalizeOrderStatus(String(d.status||o.status));
          return o;
        }).filter(o=>o.id);
        setOrders(data);
        setFilteredOrders(data);
      } catch(e) { console.error(e); setOrders([]); setFilteredOrders([]); }
    }, [], (e)=>console.error('orders sub error:',e));

    const unsubUsers = subscribeToCollection('users', (snap) => {
      try {
        setUsers(snap.docs.map(doc=>({
          id:doc.id,...doc.data(),
          phoneNumber:doc.data().phoneNumber||doc.data().phone||'',
          wallet_balance:doc.data().wallet_balance ?? doc.data().walletBalance ?? 0,
          jars_occupied:doc.data().jars_occupied ?? doc.data().holdJars ?? doc.data().occupiedJars ?? 0,
        })) as User[]);
      } catch { setUsers([]); }
    }, [], ()=>setUsers([]));

    const unsubArmy = subscribeToCollection('army', (snap) => {
      try { setArmyMembers(snap.docs.map(doc=>({id:doc.id,...doc.data()})) as ArmyMember[]); } catch {}
    }, [], ()=>{});

    setTimeout(()=>setLoading(false),1200);
    return ()=>{ unsubOrders(); unsubUsers(); unsubArmy(); };
  }, []);

  /* Filter effect */
  useEffect(() => {
    let f = orders;
    if (activeTab==='open') f=orders.filter(o=>['placed','pending','confirmed','processing','in_progress','out_for_delivery'].includes(o.status?.toLowerCase()));
    else if (activeTab==='completed') f=orders.filter(o=>['completed','delivered'].includes(o.status?.toLowerCase()));
    else if (activeTab==='cancelled') f=orders.filter(o=>['cancelled','canceled'].includes(o.status?.toLowerCase()));
    else if (activeTab==='statement') f=orders; // all orders for statement
    if (searchTerm) {
      const t=searchTerm.toLowerCase();
      f=f.filter(o=>{
        const u=getUserDetails(o.userId);
        return o.userName?.toLowerCase().includes(t)||o.userPhone?.includes(searchTerm)||
          o.address.pincode?.includes(searchTerm)||u?.name?.toLowerCase().includes(t)||
          o.id.toLowerCase().includes(t);
      });
    }
    setFilteredOrders(f);
  }, [searchTerm,orders,users,activeTab]);

  /* ── Mobile Priority Sorting Logic ── */
  const mobileQueue = useMemo(() => {
    // Only process open orders for the active queue
    const openStatus = ['placed','pending','confirmed','processing','in_progress','out_for_delivery'];
    let queueOrders = orders.filter(o => openStatus.includes(o.status?.toLowerCase() || ''));

    // Apply same search filter as desktop for consistency
    if (searchTerm) {
      const t = searchTerm.toLowerCase();
      queueOrders = queueOrders.filter(o => {
        const u = getUserDetails(o.userId);
        return o.userName?.toLowerCase().includes(t) || o.userPhone?.includes(searchTerm) ||
          o.address?.pincode?.includes(searchTerm) || u?.name?.toLowerCase().includes(t) ||
          o.id.toLowerCase().includes(t);
      });
    }

    const slotMatch = (s: string | undefined, kw: string[]) => {
      const slot = (s || '').toLowerCase();
      return kw.some(k => slot.includes(k));
    };

    const getSlotPriority = (s?:string) => {
      if (slotMatch(s, ['morning','11:00'])) return 1;
      if (slotMatch(s, ['afternoon','2:30'])) return 2;
      if (slotMatch(s, ['evening','6:00'])) return 3;
      return 4;
    };

    // Partition by slots
    const rawFast = queueOrders.filter(o => o.isPriority);
    const othersOpen = queueOrders.filter(o => !o.isPriority);

    const rawMorning = othersOpen.filter(o => getSlotPriority(o.deliverySlot) === 1);
    const rawAfternoon = othersOpen.filter(o => getSlotPriority(o.deliverySlot) === 2);
    const rawEvening = othersOpen.filter(o => getSlotPriority(o.deliverySlot) === 3);
    const rawOthers = othersOpen.filter(o => getSlotPriority(o.deliverySlot) === 4);

    // GREEDY ROUTE OPTIMIZATION (Nearest Neighbor)
    const optimizeRoute = (orderList: Order[], startPos: {lat: number, lng: number}) => {
      // Optimization is heavy O(N^2). Skip if list is too large to prevent UI lag.
      if (orderList.length > 40) return { result: orderList, lastPos: startPos };
      
      let currentPos = { ...startPos };
      const unvisited = [...orderList];
      const result: Order[] = [];

      while (unvisited.length > 0) {
        let bestIndex = 0;
        let minDist = Infinity;

        unvisited.forEach((o, i) => {
          const lat = o.deliveryAddress?.latitude || o.raw?.latitude || WAREHOUSE.lat;
          const lng = o.deliveryAddress?.longitude || o.raw?.longitude || WAREHOUSE.lng;
          const d = dist(currentPos.lat, currentPos.lng, lat, lng);
          if (d < minDist) {
            minDist = d;
            bestIndex = i;
          }
        });

        const bestOrder = unvisited.splice(bestIndex, 1)[0];
        result.push(bestOrder);
        currentPos = {
          lat: bestOrder.deliveryAddress?.latitude || bestOrder.raw?.latitude || WAREHOUSE.lat,
          lng: bestOrder.deliveryAddress?.longitude || bestOrder.raw?.longitude || WAREHOUSE.lng
        };
      }
      return { result, lastPos: currentPos };
    };

    const fastOpt = optimizeRoute(rawFast, WAREHOUSE);
    const morningOpt = optimizeRoute(rawMorning, fastOpt.lastPos);
    const afternoonOpt = optimizeRoute(rawAfternoon, morningOpt.lastPos);
    const eveningOpt = optimizeRoute(rawEvening, afternoonOpt.lastPos);
    const othersOpt = optimizeRoute(rawOthers, eveningOpt.lastPos);

    const all = [
      ...fastOpt.result, 
      ...morningOpt.result, 
      ...afternoonOpt.result, 
      ...eveningOpt.result, 
      ...othersOpt.result
    ];

    return {
      fast: fastOpt.result,
      morning: morningOpt.result,
      afternoon: afternoonOpt.result,
      evening: eveningOpt.result,
      others: othersOpt.result,
      all,
      done: orders.filter(o => ['delivered', 'completed'].includes(o.status?.toLowerCase())),
      cancelled: orders.filter(o => o.status?.toLowerCase() === 'cancelled')
    };
  }, [orders, searchTerm, users, activeTab]);

  const completedToday = useMemo(() => {
    const today = new Date();
    today.setHours(0,0,0,0);
    return orders.filter(o => 
      ['completed','delivered'].includes(o.status?.toLowerCase()) && 
      getTs(o.updatedAt || o.createdAt) >= today.getTime()
    ).sort((a,b) => getTs(b.updatedAt || b.createdAt) - getTs(a.updatedAt || a.createdAt));
  }, [orders]);

  /* Auto-dispatch */
  useEffect(() => {
    if (loading||armyMembers.length===0) return;
    const iv = setInterval(async()=>{
      const unas=orders.filter(o=>['placed','pending'].includes(o.status?.toLowerCase())&&!o.assignedPartner&&!o.autoAssignAttempted);
      const online=armyMembers.filter(m=>m.isOnline);
      if(unas.length>0&&online.length>0){
        for(let i=0;i<unas.length;i++){
          const o=unas[i]; const p=online[i%online.length];
          try {
            o.autoAssignAttempted=true;
            await updateDocument('orders',o.id,{assignedPartner:p.name,deliveryPartner:{name:p.name,phone:p.phoneNumber},status:'processing',updatedAt:new Date()});
          } catch(e){console.error(e);}
        }
      }
    },60000);
    return ()=>clearInterval(iv);
  },[orders,armyMembers,loading]);

  /* ── Handlers ── */
  const handleCall=(phone:string)=>{
    if(!phone||phone==='N/A'){alert('Phone not available');return;}
    window.open(`tel:${phone.replace(/\s/g,'')}`, '_self');
  };

  /* ── Mobile Card Generator ── */
  const renderMobSkeleton = () => (
    <MobSkeletonCard>
      <div className="shimmer" style={{ width: '60px', height: '20px', marginBottom: 16 }} />
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 20 }}>
        <div className="shimmer" style={{ width: '150px', height: '32px' }} />
        <div className="shimmer" style={{ width: '80px', height: '32px' }} />
      </div>
      <div className="shimmer" style={{ width: '100%', height: '60px', marginBottom: 20 }} />
      <div style={{ display: 'flex', gap: 10, marginBottom: 40 }}>
        <div className="shimmer" style={{ width: '100px', height: '30px' }} />
        <div className="shimmer" style={{ width: '100px', height: '30px' }} />
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <div className="shimmer" style={{ height: '58px', borderRadius: 18 }} />
        <div className="shimmer" style={{ height: '58px', borderRadius: 18 }} />
        <div className="shimmer" style={{ height: '58px', gridColumn: 'span 2', borderRadius: 18 }} />
      </div>
    </MobSkeletonCard>
  );

  const renderMobCard = (o: Order, idx: number, seqOffset: number = 0, isFast: boolean = false) => {
    if (loading) return renderMobSkeleton();
    
    const user = getUserDetails(o.userId);
    const phone = user?.phoneNumber || o.userPhone || o.phone || '';
    const currentStatus = o.status?.toLowerCase();
    const isDone = currentStatus === 'completed' || currentStatus === 'delivered';

    return (
      <MobOrderCard 
        key={o.id} 
        $fast={isFast}
        initial={{ opacity: 0, scale: 0.9, y: 30 }}
        whileInView={{ opacity: 1, scale: 1, y: 0 }}
        viewport={{ once: true, margin: "-50px" }}
        transition={{ duration: 0.5, ease: "easeOut" }}
      >
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
             <div style={{ background: isFast ? '#EF4444' : '#0F6E56', color: '#fff', fontSize: 11, fontWeight: 900, padding: '6px 14px', borderRadius: 10, letterSpacing: '0.05em' }}>
               {isFast ? 'FAST TRACK' : `STOP #${seqOffset + idx + 1}`}
             </div>
             <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: 11, color: '#94A3B8', fontWeight: 800, fontFamily: 'monospace' }}>{o.id}</div>
                <div style={{ fontSize: 24, fontWeight: 950, color: '#10B981', marginTop: 4 }}>₹{o.amount || (o.quantity * 37)}</div>
             </div>
          </div>

          <div style={{ marginBottom: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div 
                style={{ flex: 1, minWidth: 0, display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}
                onClick={() => router.push('/admin/users?customerId=' + o.userId)}
              >
                <MobCardTitle>
                  {getName(o, user)}
                </MobCardTitle>
                <ChevronRight size={24} color="#CBD5E1" />
              </div>
            </div>
            <div style={{ marginTop: 8, display: 'flex', gap: 8, alignItems: 'center' }}>
              {user?.customerId && (
                <TacticalBadge $bg="rgba(15,110,86,0.08)" $color="#0F6E56" style={{ borderRadius: 8, fontSize: 12 }}>
                  ID: {user.customerId}
                </TacticalBadge>
              )}
              {o.plusCode && (
                <TacticalBadge $bg="#F1F5F9" $color="#3B82F6" style={{ borderRadius: 8, fontSize: 12 }}>
                  <MapPin size={12} /> {o.plusCode}
                </TacticalBadge>
              )}
            </div>
          </div>

          <MobCardAddress>
            <div style={{ width: 44, height: 44, background: '#DBEAFE', borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
               <MapPin size={22} color="#2563EB" />
            </div>
            <span style={{ fontSize: 17, fontWeight: 700 }}>{o.deliveryAddress?.fullAddress || o.deliveryAddress?.address_line || o.address?.street || 'No Address Provided'}</span>
          </MobCardAddress>

          <MobDetailRow style={{ marginTop: 24 }}>
            <TacticalBadge $bg="#111827" $color="#fff" style={{ padding: '8px 16px', borderRadius: 14 }}>
              <Package size={14} />
              {o.quantity} Jars
            </TacticalBadge>
            
            {o.deliverySlot && (
               <TacticalBadge 
                 $bg={o.deliverySlot.toLowerCase().includes('morning') ? '#FEF3C7' : o.deliverySlot.toLowerCase().includes('afternoon') ? '#DBEAFE' : '#F3E8FF'} 
                 $color={o.deliverySlot.toLowerCase().includes('morning') ? '#92400E' : o.deliverySlot.toLowerCase().includes('afternoon') ? '#1E40AF' : '#6B21A8'}
                 style={{ padding: '8px 16px', borderRadius: 14 }}
               >
                 <Clock size={16} />
                 {o.deliverySlot}
               </TacticalBadge>
            )}

            {o.paymentMethod && (
              <TacticalBadge 
                $bg={(['wallet', 'upi', 'razorpay'].includes(o.paymentMethod.toLowerCase())) ? '#F5F3FF' : (o.paymentMethod.toLowerCase() === 'cash' ? '#ECFDF5' : '#FFFBEB')} 
                $color={(['wallet', 'upi', 'razorpay'].includes(o.paymentMethod.toLowerCase())) ? '#7C3AED' : (o.paymentMethod.toLowerCase() === 'cash' ? '#059669' : '#D97706')}
                style={{ padding: '8px 16px', borderRadius: 14, fontWeight: 900 }}
              >
                <Wallet size={16} />
                {o.paymentMethod.toUpperCase()} {(['wallet', 'upi', 'razorpay'].includes(o.paymentMethod.toLowerCase())) && '• PAID'}
              </TacticalBadge>
            )}
          </MobDetailRow>
        </div>

        {!isDone && (
          <MobActionGrid>
            <BigActionBtn $variant="call" onClick={() => handleCall(phone)}>
              <Player 
                autoplay 
                loop 
                src="https://lottie.host/0e6c6c4e-5e2e-4b41-9a70-8b06d48c95e1/call.json" 
                style={{ width: 22, height: 22 }} 
              /> CALL
            </BigActionBtn>
            <BigActionBtn $variant="nav" onClick={() => handleNavigation(o)}>
              <Player 
                autoplay 
                loop 
                src="https://lottie.host/9e8b7c6a-4d2b-4e1f-8c3a-9b8a7c6d5e4f/map.json" 
                style={{ width: 22, height: 22 }} 
              /> MAP
            </BigActionBtn>
            <BigActionBtn $variant="done" onClick={() => handleDeliveryClick(o)}>
              <Player 
                autoplay 
                src="https://lottie.host/8b8a1b6c-5e4f-3d2b-9c3f-4e5a7e0b5d5d/success.json" 
                style={{ width: 28, height: 28 }} 
              /> DELIVERED
            </BigActionBtn>
            <BigActionBtn $variant="cancel" onClick={() => handleCancelOrder(o.id)}>
              <X size={18} /> Cancel
            </BigActionBtn>
          </MobActionGrid>
        )}

        {isDone && (
          <div style={{ marginTop: 24, paddingTop: 24, borderTop: '2px dashed #E2E8F0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
             <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#64748B', fontSize: 14, fontWeight: 800 }}>
                <Clock size={18} /> {timeAgo(o.updatedAt || o.createdAt)}
             </div>
             <TacticalBadge $bg="#DCFCE7" $color="#166534" style={{ fontSize: 13, padding: '10px 20px', borderRadius: 16 }}>
                <CheckCircle size={16} /> COMPLETED
             </TacticalBadge>
          </div>
        )}
      </MobOrderCard>
    );
  };
  const handleNavigation=(o:Order)=>{
    const lat = o.deliveryAddress?.latitude || o.raw?.latitude || o.raw?.location?.latitude;
    const lng = o.deliveryAddress?.longitude || o.raw?.longitude || o.raw?.location?.longitude;
    const plusCode = o.plusCode || o.raw?.plusCode;
    
    if (lat && lng) {
      window.open(`https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`, '_blank');
      return;
    }
    
    if (plusCode) {
      window.open(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(plusCode)}`, '_blank');
      return;
    }

    const dest=o.address.full?.trim()||`${o.address.street}, ${o.address.city} ${o.address.pincode}`;
    if(!dest){alert('No address info found');return;}
    window.open(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(dest)}`,'_blank');
  };
  const [isBulkProcessing, setIsBulkProcessing] = useState(false);
  const handleCancelOrder = (orderId: string) => {
    setCancelConfirm(orderId);
  };

  const confirmCancel = async (orderId: string) => {
    setProcessing(true);
    try {
      await updateDocument('orders', orderId, { 
        status: 'cancelled', 
        cancelledAt: new Date(),
        updatedAt: new Date(),
        cancellationReason: 'Cancelled by Admin from Mobile View'
      });
      await logActivity({
        action: 'ORDER_CANCELLED', actor: 'ADMIN', actorName: 'Admin', actorId: userAuth?.uid || 'admin',
        details: `Cancelled order #${orderId}`, targetId: orderId
      });
      setCancelConfirm(null);
    } catch (e) {
      console.error(e);
      alert('Failed to cancel order');
    } finally {
      setProcessing(false);
    }
  };

  const handleDeliveryClick=(o:Order)=>{ setSelectedOrder(o); setShowModal(true); };

  const handleBulkCancelAll = async (targetOrders: Order[]) => {
    if (targetOrders.length === 0) { alert('No orders to cancel'); return; }
    if (!confirm(`⚠️ CRITICAL ACTION: Are you sure you want to CANCEL ALL ${targetOrders.length} open orders? This cannot be undone.`)) return;
    
    setIsBulkProcessing(true);
    try {
      for (const order of targetOrders) {
        await updateDocument('orders', order.id, { 
          status: 'cancelled', 
          cancelledAt: new Date(),
          updatedAt: new Date(),
          cancellationReason: 'Bulk Cancelled by Admin'
        });
        await logActivity({
          action: 'ORDER_CANCELLED_BULK', actor: 'ADMIN', actorName: 'Admin', actorId: userAuth?.uid || 'admin',
          details: `Bulk cancelled order #${order.id}`, targetId: order.id
        });
      }
      alert(`✅ Successfully cancelled ${targetOrders.length} orders.`);
    } catch (e) {
      console.error(e);
      alert('❌ Failed during bulk cancel. Some orders might not have been updated.');
    } finally {
      setIsBulkProcessing(false);
    }
  };

  const handleBulkDeliverAll = async (targetOrders: Order[]) => {
    if (targetOrders.length === 0) { alert('No orders to deliver'); return; }
    if (!confirm(`⚠️ BULK DELIVERY: Mark ALL ${targetOrders.length} open orders as DELIVERED? \n\nThis will assume full quantity delivered and update wallet/jar balances accordingly.`)) return;
    
    setIsBulkProcessing(true);
    try {
      const adminId = userAuth?.uid || 'admin_panel';
      for (const order of targetOrders) {
        const user = getUserDetails(order.userId);
        const qty = order.quantity || 1;
        const amt = order.amount || (qty * 37);
        const netJars = qty; 
        
        await updateDocument('orders', order.id, {
          status: 'completed', 
          deliveredAt: new Date(),
          updatedAt: new Date(),
          handover: {
            deliveredJars: qty, 
            collectedJars: 0, 
            netChange: netJars, 
            completedAt: new Date(),
            notes: 'Bulk Delivered', 
            amountPaid: order.paymentMethod === 'cash' ? 0 : amt
          }
        });
        
        if (user) {
          const unpaid = (order.paymentMethod === 'cash') ? amt : 0;
          await updateDocument('users', user.id, {
            wallet_balance: (user.wallet_balance || 0) - unpaid,
            jars_occupied: (user.jars_occupied || 0) + netJars
          });
        }

        await logActivity({
          action: 'ORDER_DELIVERED_BULK', actor: 'ADMIN', actorName: 'Admin', actorId: adminId,
          details: `Bulk delivered order #${order.id}`, targetId: order.id
        });
      }
      alert(`✅ Successfully delivered ${targetOrders.length} orders.`);
    } catch (e) {
      console.error(e);
      alert('❌ Failed during bulk delivery. Some orders might not have been updated.');
    } finally {
      setIsBulkProcessing(false);
    }
  };
  const handleReceivePayment=(o:Order)=>{ setSelectedQRCodeOrder(o); setShowQRModal(true); };
  const handlePartnerChange=async(orderId:string,name:string)=>{
    const p=armyMembers.find(m=>m.name===name);
    if(!p) return;
    try {
      await updateDocument('orders',orderId,{assignedPartner:name,deliveryPartner:{name:p.name,phone:p.phoneNumber},status:'processing',updatedAt:new Date()});
    } catch { alert('Failed to assign.'); }
  };
  const handleMarkDelivered=async(handoverData:any)=>{
    if(!selectedOrder) return;
    setProcessing(true);
    try {
      const user=getUserDetails(selectedOrder.userId);
      const { deliveredJars, collectedJars, deliveredJarIds, collectedJarIds, amountPaid, notes } = handoverData;
      
      const adminId = userAuth?.uid || 'admin_panel';
      const actualCustomerId = user?.customerId || user?.id || selectedOrder.userId;

      // 1. Process deliveries (Assign jars to customer)
      if (deliveredJarIds && deliveredJarIds.length > 0) {
        for (const jarId of deliveredJarIds) {
          try {
            await assignJarToCustomer(jarId, actualCustomerId, adminId);
          } catch (e) {
            console.warn(`Could not assign jar ${jarId}:`, e);
          }
        }
      }

      // 2. Process pickups (Return jars to warehouse)
      if (collectedJarIds && collectedJarIds.length > 0) {
        for (const jarId of collectedJarIds) {
          try {
            await returnJar(jarId, adminId, actualCustomerId);
          } catch (e) {
            console.warn(`Could not return jar ${jarId}:`, e);
          }
        }
      }

      const unit=selectedOrder.amount/(selectedOrder.quantity||1);
      const newAmt=unit*deliveredJars;
      const already=(selectedOrder.paymentMethod!=='cash')?(selectedOrder.amount||0):0;
      const unpaid=(newAmt-already)-amountPaid;
      const netJars=deliveredJars-collectedJars;

      await updateDocument('orders',selectedOrder.id,{
        status:'completed',deliveredAt:new Date(),
        handover:{
          deliveredJars,collectedJars,netChange:netJars,completedAt:new Date(),
          notes,amountPaid,
          deliveredJarIds: deliveredJarIds || [],
          collectedJarIds: collectedJarIds || []
        },
        amount:newAmt,
      });

      if(user) await updateDocument('users',user.id,{wallet_balance:(user.wallet_balance||0)-unpaid,jars_occupied:(user.jars_occupied||0)+netJars});
      
      await logActivity({
        action:'ORDER_DELIVERED',actor:'ADMIN',actorName:'Admin',actorId:adminId,
        details:`Order #${selectedOrder.id} delivered. Scanned ${deliveredJarIds?.length || 0} delivered, ${collectedJarIds?.length || 0} collected.`,
        targetId:selectedOrder.id
      });

    } catch(e){console.error(e);alert('Failed to update order');}
    finally { setProcessing(false); }
  };
  const handleBulkAssign=async(targetOrders:Order[])=>{
    if(!bulkPartner){alert('Select a partner');return;}
    if(targetOrders.length===0){alert('No orders');return;}
    if(!confirm(`Assign ${bulkPartner} to ${targetOrders.length} orders?`)) return;
    setIsBulkAssigning(true);
    let ok=0;
    try {
      for(const o of targetOrders){
        try{await updateDocument('orders',o.id,{assignedPartner:bulkPartner,status:'processing',updatedAt:new Date()});ok++;}catch{}
      }
      alert(`Assigned ${ok} orders.`);
      await logActivity({action:'BULK_PARTNER_ASSIGNMENT',actor:'ADMIN',actorName:'Admin',actorId:'admin_panel',details:`Bulk: ${ok} orders → ${bulkPartner}`,targetId:'multiple_orders'});
    } finally { setIsBulkAssigning(false); setBulkPartner(''); }
  };
  const handleRefresh=()=>{
    setIsRefreshing(true);
    setTimeout(()=>{ setIsRefreshing(false); window.location.reload(); },500);
  };

  /* ── Sorting ── */
  const sortOrders=(arr:Order[]):Order[] => {
    return [...arr].sort((a,b)=>{
      if(a.isPriority&&!b.isPriority) return -1;
      if(!a.isPriority&&b.isPriority) return 1;
      return getTs(a.createdAt)-getTs(b.createdAt); // oldest first
    });
  };

  /* ── Section slicing for open orders ── */
  const getOrdersBySection=()=>{
    if(activeTab==='open'){
      const open=['placed','pending','confirmed','processing','in_progress','out_for_delivery'];
      const openOrders=filteredOrders.filter(o=>open.includes(o.status?.toLowerCase()));
      const now=new Date();
      const today=new Date(now.getFullYear(),now.getMonth(),now.getDate());
      const tomorrow=new Date(today); tomorrow.setDate(tomorrow.getDate()+1);
      const toD=(d:any):Date|null=>{
        if(!d) return null;
        try{if(typeof d==='string')return new Date(d);if(d instanceof Date)return d;if('toDate'in d)return d.toDate();return null;}catch{return null;}
      };
      const same=(d1:Date,d2:Date)=>d1.getFullYear()===d2.getFullYear()&&d1.getMonth()===d2.getMonth()&&d1.getDate()===d2.getDate();
      const todayAll=openOrders.filter(o=>{
        const d=toD(o.deliveryDate||o.createdAt);
        if(!d) return false;
        // Include if delivery is Today OR in the past (Overdue)
        return same(d,today) || d.getTime() < today.getTime();
      });
      const slotMatch=(o:Order,kw:string[])=>{ const s=(o.deliverySlot||'').toLowerCase(); return kw.some(k=>s.includes(k)); };
      const morning=sortOrders(todayAll.filter(o=>slotMatch(o,['morning','11:00'])));
      const afternoon=sortOrders(todayAll.filter(o=>slotMatch(o,['afternoon','2:30'])));
      const evening=sortOrders(todayAll.filter(o=>slotMatch(o,['evening','6:00'])));
      const mIds=new Set([...morning,...afternoon,...evening].map(o=>o.id));
      const others=sortOrders(todayAll.filter(o=>!mIds.has(o.id)));
      const tmr=sortOrders(openOrders.filter(o=>{const d=toD(o.deliveryDate||o.createdAt);return d&&same(d,tomorrow);}));
      const future=sortOrders(openOrders.filter(o=>{const d=toD(o.deliveryDate||o.createdAt);return d&&d.getTime()>tomorrow.getTime()+86400000;}));
      return {morning,afternoon,evening,others,tmr,future,all:[]};
    }
    const all=[...filteredOrders].sort((a,b)=>getTs(b.updatedAt||b.createdAt)-getTs(a.updatedAt||a.createdAt));
    return {morning:[],afternoon:[],evening:[],others:[],tmr:[],future:[],all};
  };

  const {morning=[], afternoon=[], evening=[], others=[], tmr=[], future=[], all=[]}=getOrdersBySection();

  const openCount=orders.filter(o=>['placed','pending','confirmed','processing','in_progress','out_for_delivery'].includes(o.status?.toLowerCase())).length;
  const doneCount=orders.filter(o=>['completed','delivered'].includes(o.status?.toLowerCase())).length;
  const cancelCount=orders.filter(o=>['cancelled','canceled'].includes(o.status?.toLowerCase())).length;

  /* ── Statement helpers ── */
  const getStmtOrders = ():Order[] => {
    const now=new Date();
    let from:Date, to:Date=new Date(now.getFullYear(),now.getMonth(),now.getDate(),23,59,59);
    if(stmtRange==='today'){from=new Date(now.getFullYear(),now.getMonth(),now.getDate());}
    else if(stmtRange==='yesterday'){
      from=new Date(now.getFullYear(),now.getMonth(),now.getDate());
      from.setDate(from.getDate()-1);
      to=new Date(from.getFullYear(),from.getMonth(),from.getDate(),23,59,59);
    }
    else if(stmtRange==='week'){from=new Date(now);from.setDate(from.getDate()-7);}
    else if(stmtRange==='month'){from=new Date(now.getFullYear(),now.getMonth(),1);}
    else if(stmtRange==='year'){from=new Date(now.getFullYear(),0,1);}
    else{
      from=stmtFrom?new Date(stmtFrom):new Date(0);
      to=stmtTo?new Date(stmtTo+'T23:59:59'):to;
    }
    const fromTs=from.getTime(), toTs=to.getTime();
    let filtered=orders.filter(o=>{
      const t=getTs(o.createdAt);
      const inRange = t>=fromTs && t<=toTs;
      if (!inRange) return false;
      if (stmtStatus === 'all') return true;
      const s = o.status?.toLowerCase();
      if (stmtStatus === 'delivered') return ['completed','delivered'].includes(s);
      if (stmtStatus === 'cancelled') return ['cancelled','canceled'].includes(s);
      return true;
    });
    if(searchTerm){
      const q=searchTerm.toLowerCase();
      filtered=filtered.filter(o=>{
        const u=getUserDetails(o.userId);
        return o.userName?.toLowerCase().includes(q)||o.userPhone?.includes(searchTerm)||
          u?.name?.toLowerCase().includes(q)||o.id.toLowerCase().includes(q)||
          u?.customerId?.toLowerCase().includes(q);
      });
    }
    // Sort
    return [...filtered].sort((a,b)=>{
      const u1=getUserDetails(a.userId),u2=getUserDetails(b.userId);
      let va:any=0,vb:any=0;
      if(stmtSort.col==='name'){va=u1?.name||a.userName||'';vb=u2?.name||b.userName||'';}
      else if(stmtSort.col==='customerId'){va=u1?.customerId||'';vb=u2?.customerId||'';}
      else if(stmtSort.col==='phone'){va=u1?.phoneNumber||a.userPhone||'';vb=u2?.phoneNumber||b.userPhone||'';}
      else if(stmtSort.col==='qty'){va=a.quantity;vb=b.quantity;}
      else if(stmtSort.col==='amount'){va=a.amount;vb=b.amount;}
      else if(stmtSort.col==='wallet'){va=u1?.wallet_balance||0;vb=u2?.wallet_balance||0;}
      else if(stmtSort.col==='holdJars'){va=u1?.jars_occupied||0;vb=u2?.jars_occupied||0;}
      else if(stmtSort.col==='createdAt'){va=getTs(a.createdAt);vb=getTs(b.createdAt);}
      else if(stmtSort.col==='status'){va=a.status||'';vb=b.status||'';}
      else if(stmtSort.col==='payment'){va=a.paymentMethod||'';vb=b.paymentMethod||'';}
      if(typeof va==='string') return stmtSort.dir==='asc'?va.localeCompare(vb):vb.localeCompare(va);
      return stmtSort.dir==='asc'?va-vb:vb-va;
    });
  };

  const exportStmtCSV = (rows: Order[]) => {
    const headers = ['Sl. No.', 'Date', 'Time', 'Order ID', 'Customer', 'HYDRA-ID', 'Phone', 'Qty', 'Delivered', 'Returned', 'Hold Jars', 'Wallet ₹', 'Payment', 'Amount ₹', 'Status'];
    const lines = rows.map((o, i) => {
      const u = getUserDetails(o.userId);
      const dt = new Date(getTs(o.createdAt));
      const d = dt.toLocaleDateString('en-IN');
      const t = dt.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
      const delivered = o.handover?.deliveredJars ?? o.quantity ?? 0;
      const returned = o.handover?.collectedJars ?? 0;
      
      const row = [
        i + 1, d, t, o.id,
        u?.name || o.userName || '',
        u?.customerId || '',
        u?.phoneNumber || o.userPhone || '',
        o.quantity, delivered, returned,
        u?.jars_occupied ?? 0,
        u?.wallet_balance ?? 0,
        o.paymentMethod || '',
        delivered * 37,
        o.status,
      ];

      return row.map(v => {
        const s = String(v ?? '');
        if (s.includes(',') || s.includes('"') || s.includes('\n')) {
          return `"${s.replace(/"/g, '""')}"`;
        }
        return s;
      }).join(',');
    });

    const csv = [headers.join(','), ...lines].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    const dateStr = new Date().toISOString().slice(0, 10);
    link.setAttribute('href', url);
    link.setAttribute('download', `HYDRANT-ORDERS-${dateStr}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const syncToZoho = async (rows: Order[]) => {
    const btn = document.getElementById('sync-zoho-btn');
    if (btn) {
      btn.innerHTML = '<span class="loading"></span> Syncing...';
      (btn as HTMLButtonElement).disabled = true;
    }
    
    try {
      const formattedRows = rows.map((o, i) => {
        const u = getUserDetails(o.userId);
        const dt = new Date(getTs(o.createdAt));
        const delivered = o.handover?.deliveredJars ?? o.quantity ?? 0;
        const returned = o.handover?.collectedJars ?? 0;
        return [
          i + 1,
          dt.toLocaleDateString('en-IN'),
          dt.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }),
          o.id,
          u?.name || o.userName || '',
          u?.customerId || '',
          u?.phoneNumber || o.userPhone || '',
          o.quantity, delivered, returned,
          u?.jars_occupied ?? 0,
          u?.wallet_balance ?? 0,
          o.paymentMethod || '',
          delivered * 37,
          o.status
        ];
      });

      const res = await fetch('/api/zoho/sync-statements', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rows: formattedRows })
      });

      if (!res.ok) throw new Error('Sync failed');
      alert('Successfully synced to Zoho Sheet!');
    } catch (err) {
      console.error(err);
      alert('Failed to sync to Zoho. Check console for details.');
    } finally {
      if (btn) {
        btn.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3"/></svg> Sync to Zoho';
        (btn as HTMLButtonElement).disabled = false;
      }
    }
  };

  const toggleSort=(col:string)=>setStmtSort(prev=>({col,dir:prev.col===col&&prev.dir==='asc'?'desc':'asc'}));

  /* Statement styled components (inline since they're additive) */
  const SortIcon=({col}:{col:string})=>stmtSort.col!==col?null:stmtSort.dir==='asc'?<FiChevronUp size={10}/>:<FiChevronDown size={10}/>;

  /* ── Render helpers ── */
  const renderSkeleton=()=>(
    <SkeletonWrap>
      <div style={{display:'flex',justifyContent:'space-between',marginBottom:8}}>
        <SkLine $w="55%" $h="14px" /><SkLine $w="20%" $h="14px" />
      </div>
      <SkLine $w="40%" $h="10px" />
      <SkLine $w="85%" $h="10px" />
      <SkLine $h="3px" />
      <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:6}}>
        {[0,1,2,3].map(i=><SkLine key={i} $h="40px" />)}
      </div>
    </SkeletonWrap>
  );

  const renderCard=(order:Order)=>{
    const user=getUserDetails(order.userId);
    const name=getName(order, user);
    const phone=user?.phoneNumber||order.userPhone||user?.phone||'N/A';
    const isDelayed=checkDelayed(order);
    const status=order.status?.toLowerCase()||'pending';
    const color=STATUS_COLOR[status]||'#888';
    const progress=STATUS_PROGRESS[status]||0;
    
    // Support both Legacy 'address' and New 'deliveryAddress' structures
    const addr = order.deliveryAddress?.fullAddress || 
                 order.deliveryAddress?.address_line || 
                 order.address?.full || 
                 (order.address ? `${order.address.street}, ${order.address.pincode}` : 'Address N/A');

    return (
      <CardWrap
        key={order.id}
        $delayed={isDelayed}
        initial={{opacity:0,y:10}}
        animate={{opacity:1,y:0}}
        transition={{duration:.2}}
        style={{display:'block'}}
      >
        <Accent $clr={color}/>
        <CardBody onClick={()=>router.push(`/admin/users?customerId=${order.userId}`)}>
          <Row>
            <div>
              <CName>{name}</CName>
            </div>
            <AmtChip>₹{order.amount}</AmtChip>
          </Row>

          <MetaRow>
            <Chip $v="id">#{order.id.slice(-6).toUpperCase()}</Chip>
            <Chip $v="time">
              <FiClock size={10}/> {timeAgo(order.createdAt)}
            </Chip>
            <Chip $v="id">
              <FiCalendar size={10} style={{marginRight:3}}/> {order.deliveryDate ? fmt(order.deliveryDate) : 'ASAP'}
            </Chip>
            {order.quantity>0&&<Chip $v="status">{order.quantity} jar{order.quantity>1?'s':''}</Chip>}
            {order.isPriority&&<Chip $v="priority"><FiZap size={10}/> PRIORITY</Chip>}
            {isDelayed&&<Chip $v="delayed"><FiAlertTriangle size={10}/> DELAYED</Chip>}
            {order.assignedPartner&&<Chip $v="partner"><FiTruck size={10}/>{order.assignedPartner}</Chip>}
          </MetaRow>

          {addr&&(
            <AddrBox>
              <FiMapPin size={12} style={{color:'#555',flexShrink:0,marginTop:2}}/>
              <div>
                <AddrText>{addr}</AddrText>
                {(order.floorNumber||order.hasLift!==undefined||order.bewareOfDogs)&&(
                  <FloorRow>
                    {order.floorNumber&&<span>Floor {order.floorNumber}</span>}
                    {order.hasLift===true&&<span>Lift</span>}
                    {order.hasLift===false&&<span>No Lift</span>}
                    {order.bewareOfDogs&&<span style={{color:'#EF4444'}}>Dogs</span>}
                  </FloorRow>
                )}
              </div>
            </AddrBox>
          )}

          <TagRow>
            {order.paymentMethod && (
              <Tag $clr={PM_COLOR[order.paymentMethod]}>
                {order.paymentMethod}
                {(order.paymentMethod === 'wallet' || order.paymentMethod === 'upi' || order.paymentMethod === 'razorpay') && (
                  <span style={{ marginLeft: 6, paddingLeft: 6, borderLeft: '1px solid currentColor', fontWeight: 900 }}>PAID</span>
                )}
              </Tag>
            )}
            {order.deliverySlot&&<Tag $clr="#60A5FA">{order.deliverySlot}</Tag>}
            {order.orderType==='subscription'&&<Tag>SUB</Tag>}
            <LiveStatusBadge orderId={order.id} initialStatus={status} />
          </TagRow>

          <PBar><PFill $w={progress} $clr={color}/></PBar>

          <ActGrid onClick={e=>e.stopPropagation()}>
            <ABtn onClick={()=>handleCall(phone)}>
              <FiPhone size={12}/>Call
            </ABtn>
            <ABtn $v="info" onClick={()=>handleNavigation(order)}>
              <FiNavigation size={12}/>Route
            </ABtn>
            <ABtn $v="primary" onClick={()=>handleDeliveryClick(order)}>
              <FiCheckCircle size={12}/>Deliver
            </ABtn>
            <ABtn $v="danger" onClick={()=>handleCancelOrder(order.id)}>
              <FiX size={12}/>Cancel
            </ABtn>
          </ActGrid>

          <div onClick={e=>e.stopPropagation()}>
            {(() => {
              const onlineArmy = armyMembers.filter(m => m.isOnline);
              return (
                <PSel
                  value={order.assignedPartner||''}
                  onChange={e=>handlePartnerChange(order.id,e.target.value)}
                  style={onlineArmy.length===0?{borderColor:'rgba(239,68,68,.3)',color:'#555'}:{}}
                >
                  <option value="">
                    {onlineArmy.length===0 ? '⚠ No army online' : `— Assign (${onlineArmy.length} online) —`}
                  </option>
                  {onlineArmy.map(m=>(
                    <option key={m.id} value={m.name}>
                      ● {m.name}
                    </option>
                  ))}
                </PSel>
              );
            })()}
          </div>
        </CardBody>
      </CardWrap>
    );
  };

  const renderSlotSection=(label:string,subtitle:string,icon:React.ReactNode,clr:string,orders:Order[])=>{
    const safeOrders=Array.isArray(orders)?orders:[];
    if(safeOrders.length===0) return null;
    return (
      <SlotSection key={label}>
        <SlotHead $clr={clr}>
          <span className="icon">{icon}</span>
          <span className="txt">{label}</span>
          <span className="badge">{safeOrders.length}</span>
          <span className="ln"/>
        </SlotHead>
        {safeOrders.map(renderCard)}
      </SlotSection>
    );
  };

  const renderLane=(label:string,time:string,icon:React.ReactNode,clr:string,items:Order[])=>(
    <Lane key={label}>
      <LaneHead $clr={clr}>
        <div className="left">
          <span className="ic">{icon}</span>
          <div>
            <span className="title">{label}</span>
            <span className="sub">{time}</span>
          </div>
        </div>
        <span className="cnt">{items.length}</span>
      </LaneHead>
      {items.length===0
        ?<EmptySlot><FiPackage className="ic"/><div className="t">No orders</div><div className="s">All clear for this slot</div></EmptySlot>
        :items.map(renderCard)
      }
    </Lane>
  );

  if(loading){
    return(
      <Page>
        <SpinWrap><FiRefreshCw size={36}/></SpinWrap>
      </Page>
    );
  }

  /* ── Open orders total for stats ── */
  const hasOpenOrders=morning.length+afternoon.length+evening.length+others.length+tmr.length+future.length>0;

  return(
    <Page>
      {/* ─ TopBar ─ */}
      <TopBar>
        <TopBarRow>
          <TitleGroup>
            <Image src="/hydrantlogo.png" alt="Logo" width={36} height={36} style={{borderRadius:8}}/>
            <div>
              <PageTitle>Orders</PageTitle>
              <PageSub>Emerald Edition · {filteredOrders.length} shipments</PageSub>
            </div>
          </TitleGroup>
          <SearchRow>
            <SearchBox>
              <FiSearch size={14} color="#555"/>
              <SearchInput
                placeholder="Name, phone, order ID…"
                value={searchTerm}
                onChange={e=>setSearchTerm(e.target.value)}
              />
              {searchTerm&&<FiX size={14} color="#555" style={{cursor:'pointer',flexShrink:0}} onClick={()=>setSearchTerm('')}/>}
            </SearchBox>
            <IconBtn onClick={handleRefresh} title="Refresh" aria-label="Refresh orders">
              <FiRefreshCw size={15} style={isRefreshing?{animation:`${spin} 1s linear infinite`}:{}}/>
            </IconBtn>
          </SearchRow>
        </TopBarRow>
      </TopBar>

      {/* ─ Stats Tabs ─ */}
      <StatsTabs>
        <StatTab $active={activeTab==='open'} $clr="#10B981" onClick={()=>setActiveTab('open')}>
          <div className="num">{openCount}</div>
          <div className="lbl">Open</div>
        </StatTab>
        <StatTab $active={activeTab==='completed'} $clr="#3B82F6" onClick={()=>setActiveTab('completed')}>
          <div className="num">{doneCount}</div>
          <div className="lbl">Delivered</div>
        </StatTab>
        <StatTab $active={activeTab==='cancelled'} $clr="#EF4444" onClick={()=>setActiveTab('cancelled')}>
          <div className="num">{cancelCount}</div>
          <div className="lbl">Cancelled</div>
        </StatTab>
        <StatTab $active={activeTab==='statement'} $clr="#8B5CF6" onClick={()=>setActiveTab('statement')}>
          <div className="num"><FiBarChart2 size={16}/></div>
          <div className="lbl">Statement</div>
        </StatTab>
        <StatTab $active={activeTab==='logistics'} $clr="#0F6E56" onClick={()=>setActiveTab('logistics')}>
          <div className="num"><FiMap size={16}/></div>
          <div className="lbl">Logistics</div>
        </StatTab>
      </StatsTabs>

      {/* ─ Filter strip (open tab only) ─ */}
      {activeTab==='open'&&(
        <FilterStrip>
          <FPill $active={true}>Today</FPill>
          <FPill $active={false} style={{opacity:.5}} title="Coming soon">Tomorrow</FPill>
          <FPill $active={!!bulkPartner}>
            Bulk: {bulkPartner||'None'}
          </FPill>
          <div style={{marginLeft:'auto',display:'flex',gap:8,alignItems:'center'}}>
            <select
              value={bulkPartner}
              onChange={e=>setBulkPartner(e.target.value)}
              style={{background:'#181818',border:'1px solid #2a2a2a',borderRadius:8,color:'#aaa',padding:'6px 10px',fontSize:12,cursor:'pointer',outline:'none',fontFamily:'inherit'}}
            >
              <option value="">Assign all to… ({armyMembers.filter(m=>m.isOnline).length} online)</option>
              {armyMembers.filter(m=>m.isOnline).map(m=><option key={m.id} value={m.name}>● {m.name}</option>)}
            </select>
            
            {bulkPartner ? (
              <FPill $active onClick={()=>handleBulkAssign([...morning,...afternoon,...evening,...others])} style={{opacity:isBulkAssigning?.6:1}}>
                {isBulkAssigning?'Assigning…':'Assign All'}
              </FPill>
            ) : (
              <div style={{ display: 'flex', gap: 6 }}>
                <FPill $active={false} onClick={() => handleBulkDeliverAll([...morning, ...afternoon, ...evening, ...others])} style={{ border: '1px solid #10B981', color: '#10B981', opacity: isBulkProcessing ? 0.5 : 1 }}>
                  Deliver All
                </FPill>
                <FPill $active={false} onClick={() => handleBulkCancelAll([...morning, ...afternoon, ...evening, ...others])} style={{ border: '1px solid #EF4444', color: '#EF4444', opacity: isBulkProcessing ? 0.5 : 1 }}>
                  Cancel All
                </FPill>
              </div>
            )}
          </div>
        </FilterStrip>
      )}


      {/* ═══════════════════════════════════════════════════════
          MOBILE DELIVERY PARTNER VIEW ( < 1024px )
      ═══════════════════════════════════════════════════════ */}
      <MobileViewContainer>
        <MobStatusBar>
          <span>{new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}</span>
          <span>Hydrant Admin Pro</span>
          <span>●●●</span>
        </MobStatusBar>

        <MobTopBar>
          <MobTopBarRow>
            <div>
              <div style={{fontSize: 15, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 6}}>
                <div style={{width: 8, height: 8, borderRadius: '50%', background: '#5DCAA5'}} />
                Ops Console
              </div>
              <div style={{fontSize: 11, color: '#9FE1CB', marginTop: 2}}>Zone: All Active Sectors</div>
            </div>
            <div style={{textAlign: 'right'}}>
              <div style={{fontSize: 10, color: '#9FE1CB', fontWeight: 800, textTransform: 'uppercase'}}>Today&apos;s Progress</div>
              <div style={{fontSize: 14, fontWeight: 800, color: '#fff'}}>{doneCount} / {openCount + doneCount} done</div>
              <div style={{background: 'rgba(255,255,255,0.15)', borderRadius: 4, height: 4, width: 80, marginTop: 4, overflow: 'hidden', marginLeft: 'auto'}}>
                <div style={{background: '#5DCAA5', height: '100%', width: `${Math.min(100, (doneCount / (openCount + doneCount || 1)) * 100)}%`}} />
              </div>
            </div>
          </MobTopBarRow>

          {/* Logistics Quick Info */}
          <div style={{ marginTop: 12, padding: '8px 12px', background: 'rgba(255,255,255,0.05)', borderRadius: 10, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ display: 'flex', gap: 12 }}>
               <div style={{ display: 'flex', flexDirection: 'column' }}>
                 <span style={{ fontSize: 8, color: '#9FE1CB', fontWeight: 800 }}>EST. DISTANCE</span>
                 <span style={{ fontSize: 12, fontWeight: 800, color: '#fff' }}>{mobileQueue.all.length > 0 ? (mobileQueue.all.length * 1.2).toFixed(1) : 0} KM</span>
               </div>
               <div style={{ display: 'flex', flexDirection: 'column' }}>
                 <span style={{ fontSize: 8, color: '#9FE1CB', fontWeight: 800 }}>FUEL COST</span>
                 <span style={{ fontSize: 12, fontWeight: 800, color: '#fff' }}>₹{mobileQueue.all.length > 0 ? (mobileQueue.all.length * 1.2 * 3.5).toFixed(0) : 0}</span>
               </div>
            </div>
            <div style={{ background: '#5DCAA5', color: '#0F6E56', fontSize: 9, fontWeight: 900, padding: '3px 8px', borderRadius: 6 }}>OPTIMIZED</div>
          </div>
          
          <MobStatsRow>
            <MobStatPill>
              <div className="val">{mobileQueue.fast.length}</div>
              <div className="lbl">Fast Pending</div>
            </MobStatPill>
            <MobStatPill>
              <div className="val">{mobileQueue.morning.length + mobileQueue.afternoon.length + mobileQueue.evening.length}</div>
              <div className="lbl">Slot Pending</div>
            </MobStatPill>
            <MobStatPill>
              <div className="val">Online</div>
              <div className="lbl">{armyMembers.filter(m => m.isOnline).length} Partners</div>
            </MobStatPill>
          </MobStatsRow>
        </MobTopBar>

        <MobViewTabs>
          <MobViewTab $active={mobileTab === 'queue'} onClick={() => setMobileTab('queue')}>Queue</MobViewTab>
          <MobViewTab $active={mobileTab === 'map'} onClick={() => setMobileTab('map')}>Route</MobViewTab>
          <MobViewTab $active={mobileTab === 'done'} onClick={() => setMobileTab('done')}>Delivered</MobViewTab>
        </MobViewTabs>

        <MobContent>
          {loading && mobileQueue.all.length === 0 && (
            <>
              <div style={{fontSize: 11, fontWeight: 800, color: '#94A3B8', textTransform: 'uppercase', marginBottom: 16, letterSpacing: '0.05em'}}>Syncing Live Intelligence...</div>
              {[1, 2, 3].map(i => <div key={i}>{renderMobSkeleton()}</div>)}
            </>
          )}

          {mobileTab === 'queue' && (
            <>
              {/* BULK ACTIONS (MOBILE) */}
              {mobileQueue.all.length > 0 && (
                <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
                  <ABtn $v="primary" style={{ flex: 1, minHeight: 38, fontSize: 11 }} onClick={() => handleBulkDeliverAll(mobileQueue.all)}>
                    Deliver All ({mobileQueue.all.length})
                  </ABtn>
                  <ABtn $v="danger" style={{ flex: 1, minHeight: 38, fontSize: 11 }} onClick={() => handleBulkCancelAll(mobileQueue.all)}>
                    Cancel All
                  </ABtn>
                </div>
              )}

              <MobSummaryStrip>
                <MobSumCard $clr="#993C1D">
                  <div className="val">{mobileQueue.fast.length}</div>
                  <div className="lbl">Fast</div>
                </MobSumCard>
                <MobSumCard $clr="#854F0B">
                  <div className="val">{mobileQueue.morning.length}</div>
                  <div className="lbl">Morning</div>
                </MobSumCard>
                <MobSumCard $clr="#185FA5">
                  <div className="val">{mobileQueue.afternoon.length}</div>
                  <div className="lbl">Afternoon</div>
                </MobSumCard>
              </MobSummaryStrip>

              {/* FAST SECTION */}
              {mobileQueue.fast.length > 0 && (
                <>
                  <div style={{fontSize: 11, fontWeight: 800, color: 'var(--color-text-tertiary)', textTransform: 'uppercase', marginBottom: 10}}>⚡ Fast Priority — Deliver ASAP</div>
                  {mobileQueue.fast.map((o, idx) => renderMobCard(o, idx, 0, true))}
                </>
              )}

              {/* SLOTS */}
              {mobileQueue.morning.length > 0 && (
                <>
                  <MobDivider><span>Morning · 11:00 AM – 1:30 PM</span></MobDivider>
                  {mobileQueue.morning.map((o, idx) => renderMobCard(o, idx, mobileQueue.fast.length))}
                </>
              )}

              {mobileQueue.afternoon.length > 0 && (
                <>
                  <MobDivider><span>Afternoon · 2:30 PM – 4:30 PM</span></MobDivider>
                  {mobileQueue.afternoon.map((o, idx) => renderMobCard(o, idx, mobileQueue.fast.length + mobileQueue.morning.length))}
                </>
              )}

              {mobileQueue.evening.length > 0 && (
                <>
                  <MobDivider><span>Evening · 6:00 PM – 10:30 PM</span></MobDivider>
                  {mobileQueue.evening.map((o, idx) => renderMobCard(o, idx, mobileQueue.fast.length + mobileQueue.morning.length + mobileQueue.afternoon.length))}
                </>
              )}

              {mobileQueue.others.length > 0 && (
                <>
                  <MobDivider><span>Other Slots</span></MobDivider>
                  {mobileQueue.others.map((o, idx) => renderMobCard(o, idx, mobileQueue.all.length - mobileQueue.others.length))}
                </>
              )}

              {mobileQueue.all.length === 0 && (
                <EmptySlot style={{padding: '60px 20px'}}>
                  <FiCheckCircle size={48} color="#0F6E56" style={{opacity: 0.3}} />
                  <div style={{fontSize: 16, fontWeight: 800, marginTop: 16}}>All Clear!</div>
                  <div style={{fontSize: 13, color: '#555'}}>No pending deliveries in the queue.</div>
                </EmptySlot>
              )}
            </>
          )}

          {mobileTab === 'map' && (
            <div style={{padding: '0 0 40px'}}>
              <div style={{padding: 16, background: 'rgba(15,110,86,0.05)', borderBottom: '1px solid rgba(15,110,86,0.1)', marginBottom: 12}}>
                 <div style={{fontSize: 10, fontWeight: 800, color: '#0F6E56', textTransform: 'uppercase', letterSpacing: '0.05em'}}>Optimized Sequence</div>
                 <div style={{fontSize: 16, fontWeight: 800, marginTop: 4}}>{mobileQueue.all.length} Waypoints Active</div>
                 <div style={{fontSize: 12, color: '#555', marginTop: 4}}>Stops are ordered by Priority (Fast Delivery → Morning → Afternoon → Evening)</div>
                 
                 <DeliveryMap orders={orders} warehouse={WAREHOUSE} />
              </div>

              {mobileQueue.all.length === 0 ? (
                <div style={{padding: 40, textAlign: 'center'}}>
                  <FiCheckCircle size={48} color="#0F6E56" style={{opacity: 0.2}} />
                  <div style={{fontSize: 14, fontWeight: 700, marginTop: 16}}>No routes to plan today.</div>
                </div>
              ) : (
                <div style={{padding: '0 16px'}}>
                  {mobileQueue.all.map((o, idx) => {
                    const isFast = mobileQueue.fast.some(f => f.id === o.id);
                    const user = getUserDetails(o.userId);
                    return (
                      <div key={o.id} style={{display: 'flex', gap: 12, marginBottom: 20, position: 'relative'}}>
                        {idx !== mobileQueue.all.length - 1 && (
                          <div style={{position: 'absolute', left: 17, top: 34, bottom: -20, width: 2, background: 'rgba(15,110,86,0.1)', borderStyle: 'dashed'}} />
                        )}
                        <div style={{
                          width: 36, height: 36, borderRadius: '50%', background: isFast ? '#EF4444' : '#0F6E56', 
                          color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', 
                          fontSize: 14, fontWeight: 900, flexShrink: 0, zIndex: 1,
                          boxShadow: '0 4px 10px rgba(0,0,0,0.1)'
                        }}>
                          {idx + 1}
                        </div>
                        <div style={{flex: 1, background: '#fff', border: '1px solid #E2E8F0', borderRadius: 18, padding: '16px 18px', display: 'flex', flexDirection: 'column', gap: 10, boxShadow: '0 2px 8px rgba(0,0,0,0.03)'}}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                            <div style={{ minWidth: 0, flex: 1 }}>
                              <div 
                                style={{fontSize: 16, fontWeight: 800, color: '#111827', cursor: 'pointer', display: 'flex', alignItems: 'center'}}
                                onClick={() => router.push('/admin/users?customerId=' + o.userId)}
                              >
                                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{getName(o, user)}</span>
                                {user?.customerId && (
                                  <span style={{ fontSize: 9, fontWeight: 900, color: '#0F6E56', background: 'rgba(15,110,86,0.1)', padding: '2px 6px', borderRadius: 6, marginLeft: 8, flexShrink: 0 }}>
                                    #{user.customerId}
                                  </span>
                                )}
                              </div>
                              <div style={{fontSize: 12, color: '#64748B', marginTop: 4, display: 'flex', alignItems: 'center', gap: 4}}>
                                <FiMapPin size={12} /> {o.plusCode || '#NO-PLUS-CODE'}
                              </div>
                            </div>
                            <div style={{ fontSize: 13, fontWeight: 900, background: '#F1F5F9', padding: '4px 8px', borderRadius: 8 }}>{o.quantity}</div>
                          </div>
                          
                          <div style={{ display: 'flex', gap: 10 }}>
                            <BigActionBtn $variant="call" style={{ height: 40, fontSize: 13, borderRadius: 10 }} onClick={() => handleCall(user?.phoneNumber || o.userPhone || o.phone)}>
                              <FiPhone size={16}/> Call
                            </BigActionBtn>
                            <BigActionBtn $variant="nav" style={{ height: 40, fontSize: 13, borderRadius: 10 }} onClick={() => handleNavigation(o)}>
                              <FiNavigation size={16}/> Map
                            </BigActionBtn>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                  
                  <BigActionBtn $variant="done" style={{marginTop: 14, width: '100%', height: 64, fontSize: 18, borderRadius: 16}} onClick={() => {
                    if (mobileQueue.all[0]) handleNavigation(mobileQueue.all[0]);
                  }}>
                    <FiNavigation size={24} /> START NAVIGATION
                  </BigActionBtn>
                </div>
              )}

              {/* Floating Next Customer Card */}
              {mobileQueue.all.length > 0 && (
                <div style={{ position: 'fixed', bottom: 20, left: 16, right: 16, background: '#fff', borderRadius: 24, padding: '20px 22px', boxShadow: '0 20px 60px rgba(0,0,0,0.25)', border: '1px solid #0F6E5640', zIndex: 1000 }}>
                   <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
                      <div style={{ background: '#0F6E56', color: '#fff', fontSize: 10, fontWeight: 900, padding: '4px 12px', borderRadius: 20, letterSpacing: '0.05em' }}>UP NEXT</div>
                      <div style={{ fontSize: 12, color: '#64748B', fontWeight: 800 }}>{mobileQueue.all.length} stops left</div>
                   </div>
                   <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
                      <div style={{ width: 52, height: 52, borderRadius: 18, background: '#111827', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, fontWeight: 900, boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}>
                        {mobileQueue.all[0].quantity}
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div 
                          style={{ fontSize: 18, fontWeight: 800, color: '#111827', cursor: 'pointer', display: 'flex', alignItems: 'center' }}
                          onClick={() => router.push('/admin/users?customerId=' + mobileQueue.all[0].userId)}
                        >
                          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{getName(mobileQueue.all[0], getUserDetails(mobileQueue.all[0].userId))}</span>
                          {getUserDetails(mobileQueue.all[0].userId)?.customerId && (
                            <span style={{ fontSize: 10, fontWeight: 900, color: '#0F6E56', background: 'rgba(15,110,86,0.1)', padding: '2px 8px', borderRadius: 8, marginLeft: 8, flexShrink: 0 }}>
                              #{getUserDetails(mobileQueue.all[0].userId)?.customerId}
                            </span>
                          )}
                        </div>
                        <div style={{ fontSize: 13, color: '#4B5563', display: 'flex', alignItems: 'center', gap: 4, marginTop: 4 }}>
                          <FiMapPin size={12} color="#0F6E56" /> <span style={{overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap'}}>{mobileQueue.all[0].plusCode || 'No Plus Code'}</span>
                        </div>
                      </div>
                      <div style={{ display: 'flex', gap: 10 }}>
                         <button onClick={() => handleCall(mobileQueue.all[0].userPhone || mobileQueue.all[0].phone)} style={{ width: 48, height: 48, borderRadius: 14, border: '1px solid #E2E8F0', background: '#DCFCE7', color: '#166534', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 2px 8px rgba(0,0,0,0.05)' }}>
                            <FiPhone size={22} />
                         </button>
                         <button onClick={() => handleNavigation(mobileQueue.all[0])} style={{ width: 48, height: 48, borderRadius: 14, border: 'none', background: '#111827', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}>
                            <FiNavigation size={22} />
                         </button>
                      </div>
                   </div>
                </div>
              )}
            </div>
          )}

          {mobileTab === 'done' && (
            <>
              <MobSummaryStrip>
                <MobSumCard $clr="#10B981">
                  <div className="val">{completedToday.length}</div>
                  <div className="lbl">Delivered</div>
                </MobSumCard>
                <MobSumCard $clr="#8B5CF6">
                  <div className="val">₹{completedToday.reduce((s,o) => s + (o.handover?.amountPaid || (o.quantity * 37)), 0)}</div>
                  <div className="lbl">Revenue</div>
                </MobSumCard>
              </MobSummaryStrip>

              <div style={{fontSize: 11, fontWeight: 800, color: 'var(--color-text-tertiary)', textTransform: 'uppercase', marginBottom: 12}}>Delivered Today</div>
              {completedToday.map((o, idx) => renderMobCard(o, idx))}
              {completedToday.length === 0 && (
                 <div style={{padding: '40px 20px', textAlign: 'center', color: '#555', fontSize: 13}}>No orders completed yet today.</div>
              )}
            </>
          )}
        </MobContent>
      </MobileViewContainer>

      {/* ═══════════════════════════════════════════════════════
          DESKTOP VIEW ( >= 1024px )
      ═══════════════════════════════════════════════════════ */}
      <div style={{ display: 'contents' }}>
        {activeTab === 'open' && (
          <>
            {/* Desktop Kanban */}
            <KanbanBoard>
              {renderLane('Morning', '11 AM – 1:30 PM', <FiSun size={14} />, '#F59E0B', morning)}
              {renderLane('Afternoon', '2:30 PM – 4:30 PM', <FiSun size={14} />, '#3B82F6', afternoon)}
              {renderLane('Evening', '6 PM – 10:30 PM', <FiMoon size={14} />, '#8B5CF6', evening)}
              {renderLane('Others', 'Misc Slots', <FiClock size={14} />, '#10B981', others)}
              {renderLane('Tomorrow', 'Next Day', <FiPackage size={14} />, '#555', tmr)}
            </KanbanBoard>
          </>
        )}
      </div>

      {/* ═══════════════════════════════════════════════════════
          COMPLETED / CANCELLED — responsive grid
      ═══════════════════════════════════════════════════════ */}
      {(activeTab==='completed'||activeTab==='cancelled')&&(
        <FlatGrid>
          {all.length===0&&(
            <EmptySlot style={{gridColumn:'1/-1',padding:'60px 20px'}}>
              <FiPackage className="ic" style={{fontSize:40,color:'#1a1a1a'}}/>
              <div className="t">No {activeTab} orders</div>
              <div className="s">{searchTerm?`No results for "${searchTerm}"`:'Nothing here yet'}</div>
            </EmptySlot>
          )}
          {all.map(renderCard)}
        </FlatGrid>
      )}

      {/* ═══════════════════════════════════════════════════════
          STATEMENT — full sortable table with date filters
      ═══════════════════════════════════════════════════════ */}
      {activeTab==='statement'&&(()=>{
        const rows=getStmtOrders();
        const totalAmt=rows.filter(o=>['completed','delivered'].includes(o.status)).reduce((s,o)=>s+(o.handover?.deliveredJars??o.quantity??0)*37,0);
        const totalQty=rows.reduce((s,o)=>s+(o.quantity||0),0);
        const SLabel=({children,col}:{children:React.ReactNode,col:string})=>(
          <th
            onClick={()=>toggleSort(col)}
            style={{textAlign:'left',padding:'8px 10px',fontSize:10,fontWeight:700,color:stmtSort.col===col?'#8B5CF6':'#555',
              textTransform:'uppercase',letterSpacing:'.05em',whiteSpace:'nowrap',cursor:'pointer',userSelect:'none',
              borderBottom:'1px solid #1e1e1e',background:'#111'}}
          >
            {children} <SortIcon col={col}/>
          </th>
        );
        return (
          <div style={{padding:'0 0 40px'}}>
            {/* Filter bar */}
            <div style={{display:'flex',gap:8,alignItems:'center',padding:'12px 16px',flexWrap:'wrap',borderBottom:'1px solid #1a1a1a'}}>
              {(['today','yesterday','week','month','year','custom'] as const).map(r=>(
                <button key={r} onClick={()=>setStmtRange(r)}
                  style={{padding:'5px 14px',borderRadius:20,border:'1px solid',
                    borderColor:stmtRange===r?'#8B5CF6':'#2a2a2a',
                    background:stmtRange===r?'rgba(139,92,246,.15)':'transparent',
                    color:stmtRange===r?'#8B5CF6':'#666',fontSize:12,fontWeight:600,cursor:'pointer',
                    textTransform:'capitalize',transition:'all .15s'}}
                >{r==='custom'?'Custom':r.charAt(0).toUpperCase()+r.slice(1)}</button>
              ))}
              {stmtRange==='custom'&&(
                <div style={{display:'flex',alignItems:'center',gap:12,background:'rgba(16,185,129,0.08)',border:'1px solid rgba(16,185,129,0.3)',borderRadius:10,padding:'6px 12px'}}>
                  <div style={{display:'flex',alignItems:'center',gap:8,position:'relative'}}>
                    <FiCalendar size={14} color="#10B981"/>
                    <input type="date" value={stmtFrom} onChange={e=>setStmtFrom(e.target.value)}
                      style={{background:'transparent',border:'none',color:'#10B981',fontWeight:700,fontSize:12,outline:'none',cursor:'pointer'}}/>
                  </div>
                  <span style={{color:'rgba(16,185,129,0.5)',fontWeight:900}}>→</span>
                  <div style={{display:'flex',alignItems:'center',gap:8,position:'relative'}}>
                    <FiCalendar size={14} color="#10B981"/>
                    <input type="date" value={stmtTo} onChange={e=>setStmtTo(e.target.value)}
                      style={{background:'transparent',border:'none',color:'#10B981',fontWeight:700,fontSize:12,outline:'none',cursor:'pointer'}}/>
                  </div>
                </div>
              )}
              
              <div style={{display:'flex',alignItems:'center',gap:6,marginLeft:8}}>
                <span style={{fontSize:11,color:'#555',fontWeight:600}}>STATUS:</span>
                <select value={stmtStatus} onChange={e=>setStmtStatus(e.target.value as any)}
                  style={{background:'#111',border:'1px solid #2a2a2a',borderRadius:8,color:'#ccc',padding:'4px 8px',fontSize:12,cursor:'pointer'}}>
                  <option value="all">All Orders</option>
                  <option value="delivered">Delivered Only</option>
                  <option value="cancelled">Cancelled Only</option>
                </select>
              </div>

              <div style={{marginLeft:'auto',display:'flex',gap:8,alignItems:'center'}}>
                <span style={{fontSize:12,color:'#555'}}>{rows.length} orders · ₹{totalAmt.toLocaleString('en-IN')} · {totalQty} jars</span>
                <div style={{display:'flex',gap:10,alignItems:'center'}}>
                  <button id="sync-zoho-btn" onClick={()=>syncToZoho(rows)}
                    style={{display:'flex',alignItems:'center',gap:6,padding:'6px 14px',background:'#111',
                      border:'1px solid #333',borderRadius:8,color:'#eee',fontSize:12,fontWeight:600,cursor:'pointer'}}>
                    <FiRefreshCcw size={12}/> Sync to Zoho
                  </button>
                  <button onClick={()=>exportStmtCSV(rows)}
                    style={{display:'flex',alignItems:'center',gap:6,padding:'6px 14px',background:'rgba(16,185,129,.15)',
                      border:'1px solid rgba(16,185,129,.4)',borderRadius:8,color:'#10B981',fontSize:12,fontWeight:600,cursor:'pointer'}}>
                    <FiDownload size={12}/> Export Excel
                  </button>
                </div>
              </div>
            </div>
            {/* Table */}
            <div style={{overflowX:'auto'}}>
              <table style={{width:'100%',borderCollapse:'collapse',fontSize:12}}>
                <thead>
                  <tr>
                    <th style={{textAlign:'left',padding:'8px 10px',fontSize:10,fontWeight:700,color:'#555',textTransform:'uppercase',letterSpacing:'.05em',whiteSpace:'nowrap',borderBottom:'1px solid #1e1e1e',background:'#111'}}>Sl.</th>
                    <SLabel col="createdAt">Date & Time</SLabel>
                    <SLabel col="name">Customer</SLabel>
                    <SLabel col="customerId">HYDRA-ID</SLabel>
                    <SLabel col="phone">Phone</SLabel>
                    <SLabel col="qty">Qty</SLabel>
                    <th style={{textAlign:'left',padding:'8px 10px',fontSize:10,fontWeight:700,color:'#555',textTransform:'uppercase',letterSpacing:'.05em',whiteSpace:'nowrap',borderBottom:'1px solid #1e1e1e',background:'#111'}}>Delivered</th>
                    <th style={{textAlign:'left',padding:'8px 10px',fontSize:10,fontWeight:700,color:'#555',textTransform:'uppercase',letterSpacing:'.05em',whiteSpace:'nowrap',borderBottom:'1px solid #1e1e1e',background:'#111'}}>Returned</th>
                    <SLabel col="holdJars">Hold Jars</SLabel>
                    <SLabel col="wallet">Wallet ₹</SLabel>
                    <SLabel col="payment">Payment</SLabel>
                    <SLabel col="amount">Amount ₹</SLabel>
                    <SLabel col="status">Status</SLabel>
                  </tr>
                </thead>
                <tbody>
                  {rows.length===0&&(
                    <tr><td colSpan={12} style={{textAlign:'center',padding:'48px 20px',color:'#444'}}>
                      No orders in this period
                    </td></tr>
                  )}
                  {rows.map((o,i)=>{
                    const u=getUserDetails(o.userId);
                    const dt=new Date(getTs(o.createdAt));
                    const dateStr=dt.toLocaleDateString('en-IN',{day:'numeric',month:'short',year:'2-digit'});
                    const timeStr=dt.toLocaleTimeString('en-IN',{hour:'2-digit',minute:'2-digit'});
                    const delivered=o.handover?.deliveredJars??o.quantity??0;
                    const returned=o.handover?.collectedJars??0;
                    const holdJars=u?.jars_occupied??0;
                    const wallet=u?.wallet_balance??0;
                    const isDone=['completed','delivered'].includes(o.status);
                    const isCancelled=['cancelled','canceled'].includes(o.status);
                    const statusClr=isDone?'#10B981':isCancelled?'#EF4444':'#F59E0B';
                    const pmClr=o.paymentMethod==='wallet'?'#3B82F6':o.paymentMethod==='upi'?'#8B5CF6':'#F59E0B';

                    const handleSaveLocal = async (val:string) => {
                      if(!editingCell) return;
                      const {id,field,type}=editingCell;
                      try {
                        const n=parseInt(val)||0;
                        if(type==='order'){
                          const oldDelivered = o.handover?.deliveredJars ?? o.quantity ?? 0;
                          const oldReturned = o.handover?.collectedJars ?? 0;
                          const oldAmt = o.amount || 0;
                          
                          const handover = {
                            ...(o.handover || {deliveredJars:0,collectedJars:0,netChange:0,notes:''}),
                            ...(field==='delivered' ? {deliveredJars:n} : {collectedJars:n})
                          };
                          
                          const oldNet = oldDelivered - oldReturned;
                          const newNet = (handover.deliveredJars || 0) - (handover.collectedJars || 0);
                          const diff = newNet - oldNet;

                          // Update User's Jars Occupied (Hold Jars) in Database
                          if (diff !== 0 && o.userId) {
                            const newHold = (u?.jars_occupied || 0) + diff;
                            await updateDocument('users', o.userId, { jars_occupied: Math.max(0, newHold) });
                          }
                          
                          // Recalculate amount (using current order's unit price or default 37)
                          const unitPrice = o.quantity > 0 ? (oldAmt / o.quantity) : 37;
                          const newAmt = Math.round(unitPrice * (handover.deliveredJars || 0));
                          const amtDiff = newAmt - oldAmt;
                          
                          // Update User's Wallet Balance in Database if order is completed
                          if (amtDiff !== 0 && o.userId && ['completed','delivered'].includes(o.status)) {
                            const newTotalWallet = (u?.wallet_balance || 0) - amtDiff;
                            await updateDocument('users', o.userId, { wallet_balance: newTotalWallet });
                          }
                          
                          handover.netChange=newNet;
                          await updateDocument('orders', id, { handover, amount: newAmt });
                          
                          // Also log the audit change
                          await logActivity({
                            action: 'ORDER_EDITED_BY_ADMIN',
                            actor: 'ADMIN',
                            actorName: 'Admin',
                            actorId: 'admin_panel',
                            details: `Admin changed ${field} to ${n} for Order #${id}. Syncing to User #${o.userId}.`,
                            targetId: id
                          });
                        } else {
                          // Direct User Update
                          await updateDocument('users', id, { [field]: n });
                          await logActivity({
                            action: 'USER_EDITED_BY_ADMIN',
                            actor: 'ADMIN',
                            actorName: 'Admin',
                            actorId: 'admin_panel',
                            details: `Admin changed ${field} to ${n} for User #${id}.`,
                            targetId: id
                          });
                        }
                      } catch(e){console.error('Save error:', e);}
                      setEditingCell(null);
                    };

                    const isEditing = (field:string, type:'order'|'user', rowId:string) => 
                      editingCell?.id === rowId && editingCell?.field === field && editingCell?.type === type;

                    return (
                      <tr key={o.id}
                        style={{background:i%2===0?'#0c0c0c':'#101010',cursor:'pointer',transition:'background .1s'}}
                        onMouseEnter={e=>(e.currentTarget.style.background='#161616')}
                        onMouseLeave={e=>(e.currentTarget.style.background=i%2===0?'#0c0c0c':'#101010')}
                        onClick={(e)=>{
                          e.stopPropagation();
                          setSelectedUserForDrawer(u);
                          setIsUserDrawerOpen(true);
                        }}
                      >
                        <td style={{padding:'9px 10px',borderBottom:'1px solid #161616',color:'#444',fontSize:10}}>
                          {i+1}
                        </td>
                        <td style={{padding:'9px 10px',borderBottom:'1px solid #161616',whiteSpace:'nowrap'}}>
                          <div style={{fontSize:11,color:'#ddd'}}>{dateStr}</div>
                          <div style={{fontSize:10,color:'#555'}}>{timeStr}</div>
                        </td>
                        <td style={{padding:'9px 10px',borderBottom:'1px solid #161616',whiteSpace:'nowrap'}}>
                          <div style={{fontWeight:600,color:'#eee'}}>{u?.name||o.userName||'—'}</div>
                        </td>
                        <td style={{padding:'9px 10px',borderBottom:'1px solid #161616'}}>
                          <span style={{fontFamily:'monospace',fontSize:11,color:'#10B981',background:'rgba(16,185,129,.1)',padding:'2px 6px',borderRadius:4}}>
                            {u?.customerId||'—'}
                          </span>
                        </td>
                        <td style={{padding:'9px 10px',borderBottom:'1px solid #161616',color:'#aaa',whiteSpace:'nowrap'}}>
                          {u?.phoneNumber||o.userPhone||'—'}
                        </td>
                        <td style={{padding:'9px 10px',borderBottom:'1px solid #161616',textAlign:'center',fontWeight:700,color:'#eee'}}>
                          {o.quantity??0}
                        </td>
                        <td style={{padding:'9px 10px',borderBottom:'1px solid #161616',textAlign:'center',color:'#10B981',fontWeight:600}}
                          onClick={(e)=>{e.stopPropagation();setEditingCell({id:o.id,field:'delivered',type:'order'});setEditValue(String(delivered));}}>
                          {isEditing('delivered','order',o.id) ? (
                            <input autoFocus value={editValue} onChange={e=>setEditValue(e.target.value)} onBlur={()=>handleSaveLocal(editValue)} onKeyDown={e=>e.key==='Enter'&&handleSaveLocal(editValue)} style={{width:40,background:'#1e1e1e',border:'1px solid #10B981',color:'#fff',textAlign:'center',borderRadius:4}}/>
                          ) : delivered}
                        </td>
                        <td style={{padding:'9px 10px',borderBottom:'1px solid #161616',textAlign:'center',color:'#F59E0B',fontWeight:600}}
                          onClick={(e)=>{e.stopPropagation();setEditingCell({id:o.id,field:'returned',type:'order'});setEditValue(String(returned));}}>
                          {isEditing('returned','order',o.id) ? (
                            <input autoFocus value={editValue} onChange={e=>setEditValue(e.target.value)} onBlur={()=>handleSaveLocal(editValue)} onKeyDown={e=>e.key==='Enter'&&handleSaveLocal(editValue)} style={{width:40,background:'#1e1e1e',border:'1px solid #F59E0B',color:'#fff',textAlign:'center',borderRadius:4}}/>
                          ) : returned}
                        </td>
                        <td style={{padding:'9px 10px',borderBottom:'1px solid #161616',textAlign:'center'}}
                          onClick={(e)=>{if(!u)return;e.stopPropagation();setEditingCell({id:u.id,field:'jars_occupied',type:'user'});setEditValue(String(holdJars));}}>
                          {u && isEditing('jars_occupied','user',u.id) ? (
                             <input autoFocus value={editValue} onChange={e=>setEditValue(e.target.value)} onBlur={()=>handleSaveLocal(editValue)} onKeyDown={e=>e.key==='Enter'&&handleSaveLocal(editValue)} style={{width:40,background:'#1e1e1e',border:'1px solid #F59E0B',color:'#fff',textAlign:'center',borderRadius:4}}/>
                          ) : (
                            holdJars>0
                              ?<span style={{background:holdJars>=3?'rgba(239,68,68,.15)':'rgba(245,158,11,.15)',color:holdJars>=3?'#EF4444':'#F59E0B',padding:'2px 8px',borderRadius:4,fontSize:11,fontWeight:700}}>{holdJars}</span>
                              :<span style={{color:'#333'}}>0</span>
                          )}
                        </td>
                        <td style={{padding:'9px 10px',borderBottom:'1px solid #161616',textAlign:'right'}}
                          onClick={(e)=>{if(!u)return;e.stopPropagation();setEditingCell({id:u.id,field:'wallet_balance',type:'user'});setEditValue(String(wallet));}}>
                          {u && isEditing('wallet_balance','user',u.id) ? (
                            <input autoFocus value={editValue} onChange={e=>setEditValue(e.target.value)} onBlur={()=>handleSaveLocal(editValue)} onKeyDown={e=>e.key==='Enter'&&handleSaveLocal(editValue)} style={{width:60,background:'#1e1e1e',border:'1px solid #8B5CF6',color:'#fff',textAlign:'right',borderRadius:4}}/>
                          ) : (
                            <span style={{color:wallet<0?'#EF4444':wallet>0?'#10B981':'#555',fontWeight:600}}>₹{wallet}</span>
                          )}
                        </td>
                        <td style={{padding:'9px 10px',borderBottom:'1px solid #161616',whiteSpace:'nowrap'}}>
                          <span style={{background:`${pmClr}1a`,color:pmClr,padding:'2px 8px',borderRadius:12,fontSize:10,fontWeight:700,textTransform:'uppercase'}}>
                            {o.paymentMethod||'—'}
                          </span>
                        </td>
                        <td style={{padding:'9px 10px',borderBottom:'1px solid #161616',textAlign:'right',fontWeight:700,color:'#eee'}}>
                          ₹{delivered * 37}
                        </td>
                        <td style={{padding:'9px 10px',borderBottom:'1px solid #161616',whiteSpace:'nowrap'}}>
                          <span style={{background:`${statusClr}1a`,color:statusClr,padding:'2px 8px',borderRadius:12,fontSize:10,fontWeight:700,textTransform:'uppercase'}}>
                            {STATUS_LABEL[o.status]||o.status}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        );
      })()}

      {activeTab==='logistics' && (
        <div style={{ padding: '0 20px 40px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 300px', gap: 20, marginTop: 20 }}>
            <div>
              <DeliveryMap orders={orders} warehouse={WAREHOUSE} />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div style={{ background: '#111', border: '1px solid #1a1a1a', borderRadius: 20, padding: 20 }}>
                <div style={{ fontSize: 10, fontWeight: 800, color: '#0F6E56', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Delivery Intelligence</div>
                <div style={{ fontSize: 18, fontWeight: 800, marginTop: 4, color: '#fff' }}>Route Analytics</div>
                
                <div style={{ marginTop: 20, display: 'flex', flexDirection: 'column', gap: 12 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid #1a1a1a', paddingBottom: 8 }}>
                    <span style={{ fontSize: 12, color: '#666' }}>Today&apos;s Success</span>
                    <span style={{ fontSize: 12, fontWeight: 700, color: '#10B981' }}>{Math.round((doneCount / (openCount + doneCount || 1)) * 100)}%</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid #1a1a1a', paddingBottom: 8 }}>
                    <span style={{ fontSize: 12, color: '#666' }}>Avg. Time/Stop</span>
                    <span style={{ fontSize: 12, fontWeight: 700, color: '#fff' }}>8.5 mins</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid #1a1a1a', paddingBottom: 8 }}>
                    <span style={{ fontSize: 12, color: '#666' }}>Fuel Saved (Est)</span>
                    <span style={{ fontSize: 12, fontWeight: 700, color: '#5DCAA5' }}>12%</span>
                  </div>
                </div>
              </div>

              <div style={{ background: 'rgba(15,110,86,0.05)', border: '1px solid rgba(15,110,86,0.1)', borderRadius: 20, padding: 20 }}>
                <div style={{ fontSize: 10, fontWeight: 800, color: '#0F6E56', textTransform: 'uppercase' }}>Cluster Density</div>
                <div style={{ marginTop: 16, display: 'flex', flexDirection: 'column', gap: 10 }}>
                   {['Kankinara', 'Naihati', 'Barrackpore'].map(z => (
                     <div key={z} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#0F6E56' }} />
                        <span style={{ fontSize: 12, color: '#333', flex: 1 }}>{z}</span>
                        <span style={{ fontSize: 11, color: '#999', fontWeight: 600 }}>{Math.floor(Math.random() * 20) + 5} Orders</span>
                     </div>
                   ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════
          MODALS
      ═══════════════════════════════════════════════════════ */}
      <AnimatePresence>
        {showModal&&selectedOrder&&(
          <DeliveryHandoverModal
            order={selectedOrder}
            user={getUserDetails(selectedOrder.userId)}
            walletBalance={getUserDetails(selectedOrder.userId)?.wallet_balance ?? 0}
            onClose={()=>setShowModal(false)}
            onComplete={handleMarkDelivered}
            processing={processing}
          />
        )}

        {showQRModal&&selectedQRCodeOrder&&(
          <ModalBg initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}}>
            <ModalBox initial={{scale:.9,opacity:0}} animate={{scale:1,opacity:1}} exit={{scale:.9,opacity:0}} style={{maxWidth:420,textAlign:'center'}}>
              <MClose onClick={()=>setShowQRModal(false)}><FiX/></MClose>
              <MHead><MTitle style={{justifyContent:'center'}}><FiDroplet color="#10B981"/>Receive Payment</MTitle></MHead>
              <MBody>
                <div style={{marginBottom:20,fontSize:'1.1rem',fontWeight:800,color:'#1e293b'}}>
                  Collect: <span style={{color:'#10B981',fontSize:'1.4rem'}}>₹{selectedQRCodeOrder.amount}</span>
                </div>
                <div style={{background:'#f8fafc',padding:16,borderRadius:16,display:'inline-block',boxShadow:'0 4px 12px rgba(0,0,0,.08)'}}>
                  <Image src="/HYDRANT_PAYMENT_QR copy.jpeg" alt="QR" width={230} height={230} style={{borderRadius:10,objectFit:'contain'}}/>
                </div>
                <div style={{marginTop:16,fontSize:'.85rem',color:'#64748b',fontWeight:600}}>
                  Order #{selectedQRCodeOrder.id}<br/>Customer: {selectedQRCodeOrder.userName}
                </div>
                <div style={{marginTop:20}}>
                  <MActionBtn $primary style={{width:'100%',justifyContent:'center',padding:14,fontSize:'1rem'}}
                    onClick={()=>{ setShowQRModal(false); handleDeliveryClick(selectedQRCodeOrder); }}>
                    <FiCheckCircle size={18}/> Proceed to Deliver
                  </MActionBtn>
                </div>
              </MBody>
            </ModalBox>
          </ModalBg>
        )}
        {cancelConfirm && (
          <ModalBg initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}}>
            <ModalBox initial={{scale:.9,opacity:0}} animate={{scale:1,opacity:1}} exit={{scale:.9,opacity:0}} style={{maxWidth:400}}>
              <MClose onClick={() => setCancelConfirm(null)}><FiX/></MClose>
              <MHead>
                <MTitle style={{color: '#EF4444'}}><FiAlertTriangle /> Cancel Order?</MTitle>
              </MHead>
              <MBody>
                <p style={{ color: '#475569', fontSize: 14, lineHeight: 1.6, marginBottom: 24 }}>
                  Are you sure you want to cancel order <strong>#{cancelConfirm}</strong>? 
                  This will remove it from the active delivery queue. This action cannot be undone.
                </p>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <MActionBtn onClick={() => setCancelConfirm(null)} style={{ justifyContent: 'center' }}>
                    Keep Order
                  </MActionBtn>
                  <MActionBtn 
                    $primary 
                    style={{ background: '#EF4444', color: '#fff', border: 'none', justifyContent: 'center' }}
                    onClick={() => confirmCancel(cancelConfirm)}
                  >
                    Cancel Order
                  </MActionBtn>
                </div>
              </MBody>
            </ModalBox>
          </ModalBg>
        )}
      </AnimatePresence>

      <UserInsightDrawer 
        isOpen={isUserDrawerOpen} 
        onClose={() => setIsUserDrawerOpen(false)} 
        user={selectedUserForDrawer} 
      />
    </Page>
  );
}