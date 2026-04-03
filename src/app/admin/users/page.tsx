'use client';

import React, { useState, useEffect, useCallback } from 'react';
import styled from 'styled-components';
import {
  subscribeToCollection, updateDocument, addDocument, deleteDocument
} from '@/lib/firebase';
import { FiSearch, FiGift, FiCopy, FiPhoneCall, FiBell, FiSlash, FiChevronDown, FiChevronUp, FiCheck, FiPackage, FiMessageCircle, FiPlus, FiMinus, FiCheckCircle, FiXCircle, FiTrash2, FiEdit2, FiGrid } from 'react-icons/fi';
import { where, serverTimestamp, writeBatch, doc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuth } from '@/context/AuthContext';
import { useSearchParams, useRouter } from 'next/navigation';

// ─── Types ────────────────────────────────────────────────
interface Address {
  id?: string; userId?: string;
  // Core fields (matches iOS AppContext.jsx saveAddress schema)
  address_type: string;      // 'Home' | 'Office' | 'Other'
  address_line?: string;     // full formatted address string
  plus_code?: string;        // critical for pinpoint delivery
  house_no?: string;         // e.g. "402, Block B"
  floor_no?: string;         // e.g. "3"
  landmark?: string;         // optional
  lift_available?: string | null;  // 'Yes' | 'No' | null
  be_aware_of_dogs?: boolean;
  latitude?: number | null;
  longitude?: number | null;
  isDefault?: boolean;
  createdAt?: unknown; updatedAt?: unknown;
}
interface Order {
  id: string; userId?: string; status: string;
  createdAt?: { toDate(): Date } | Date | string;
  quantity: number; 
  amount: number; 
  totalAmount?: number;
  paymentMethod?: string;
  slot?: any; 
  address?: any;
  items?: any[];
  raw?: any;
  fastDelivery?: boolean; 
  discount?: number; 
  deposit?: number;
}
interface Transaction {
  id: string; userId?: string; type: 'credit' | 'debit';
  amount: number; category?: string; method?: string;
  note?: string; createdAt?: { toDate(): Date } | Date | string;
}
interface User {
  id: string; customerId: string; name?: string;
  full_name?: string; displayName?: string;
  firstName?: string; lastName?: string;
  email?: string; phoneNumber?: string; phone?: string; alt_phone?: string;
  wallet_balance?: number; jars_occupied?: number; jarHold?: number;
  depositPaid?: boolean; referralCount?: number; bonusEarned?: number;
  lastOrderDate?: { toDate(): Date } | Date | string;
  createdAt?: { toDate(): Date } | Date | string;
  role?: string; isActive?: boolean; status?: string;
  addresses?: Address[]; orders?: Order[];
}

// ─── Helpers ──────────────────────────────────────────────
const fmt = (d?: { toDate(): Date } | Date | string | null) => {
  if (!d) return '—';
  try {
    const dt = typeof d === 'object' && 'toDate' in d ? d.toDate() : new Date(d as string | Date);
    return dt.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
  } catch { return '—'; }
};
const dName = (u: User) => u.full_name || u.name || u.displayName || `${u.firstName || ''} ${u.lastName || ''}`.trim() || 'Unknown';
const initials = (n: string) => n.split(' ').filter(Boolean).map(w => w[0]).join('').slice(0, 2).toUpperCase() || '?';
const AVATAR_PALETTES = [
  { bg: '#E6F1FB', tc: '#185FA5' }, { bg: '#E1F5EE', tc: '#0F6E56' },
  { bg: '#FAEEDA', tc: '#854F0B' }, { bg: '#FBEAF0', tc: '#993556' },
  { bg: '#EEEDFE', tc: '#3C3489' },
];
const palette = (id: string) => AVATAR_PALETTES[(id?.charCodeAt(0) ?? 0) % AVATAR_PALETTES.length];
const statusBadge = (s: string) =>
  s === 'delivered' || s === 'completed' ? 'b-delivered' :
  s === 'cancelled' ? 'b-cancelled' :
  s === 'in_transit' || s === 'in transit' ? 'b-transit' : 'b-pending';
const payBadge = (p?: string) =>
  p === 'wallet' || p === 'Wallet' ? 'b-wallet' :
  p === 'cash' || p === 'Cash' ? 'b-cash' : 'b-upi';

// ─── Styled Components ────────────────────────────────────
const Wrap = styled.div`
  display: grid;
  grid-template-columns: 220px 1fr;
  height: calc(100vh - 40px);
  border: 0.5px solid var(--color-border-tertiary);
  border-radius: 14px;
  overflow: hidden;
  background: var(--color-background-primary);
`;
const Sidebar = styled.div`
  background: var(--color-background-secondary);
  border-right: 0.5px solid var(--color-border-tertiary);
  display: flex; flex-direction: column;
  min-height: 0;
`;
const SideHead = styled.div`
  padding: 12px;
  border-bottom: 0.5px solid var(--color-border-tertiary);
`;
const SHeadLabel = styled.div`
  font-size: 10px; color: var(--color-text-tertiary);
  text-transform: uppercase; letter-spacing: .05em; margin-bottom: 6px;
`;
const Search = styled.div`
  position: relative;
  svg { position: absolute; left: 8px; top: 50%; transform: translateY(-50%); color: var(--color-text-tertiary); font-size: 12px; }
`;
const SearchInput = styled.input`
  width: 100%; padding: 6px 10px 6px 28px; font-size: 12px;
  border: 0.5px solid var(--color-border-secondary); border-radius: 8px;
  background: var(--color-background-primary); color: var(--color-text-primary);
  &:focus { outline: none; border-color: var(--color-border-info); }
`;
const UserList = styled.div`
  flex: 1; 
  overflow-y: auto;
  min-height: 0;
  
  &::-webkit-scrollbar { width: 5px; }
  &::-webkit-scrollbar-track { background: transparent; }
  &::-webkit-scrollbar-thumb { background: var(--color-border-tertiary); border-radius: 10px; }
  &:hover::-webkit-scrollbar-thumb { background: #cbd5e1; }
`;
const UserRow = styled.div<{ $active?: boolean }>`
  padding: 9px 12px; cursor: pointer;
  border-bottom: 0.5px solid var(--color-border-tertiary);
  display: flex; align-items: center; gap: 8px;
  background: ${p => p.$active ? 'var(--color-background-info)' : 'transparent'};
  &:hover { background: ${p => p.$active ? 'var(--color-background-info)' : 'var(--color-background-primary)'}; }
`;
const Avatar = styled.div<{ $bg: string; $tc: string; $size?: number }>`
  width: ${p => p.$size ?? 30}px; height: ${p => p.$size ?? 30}px;
  border-radius: 50%; background: ${p => p.$bg}; color: ${p => p.$tc};
  display: flex; align-items: center; justify-content: center;
  font-size: ${p => (p.$size ?? 30) < 36 ? 11 : 14}px;
  font-weight: 600; flex-shrink: 0;
`;
const UName = styled.div<{ $active?: boolean }>`
  font-size: 12px; font-weight: 500;
  color: ${p => p.$active ? 'var(--color-text-info)' : 'var(--color-text-primary)'};
`;
const UID = styled.div`font-size: 10px; color: var(--color-text-tertiary);`;
const Main = styled.div`display: flex; flex-direction: column; overflow: hidden; min-width: 0;`;
const MainHead = styled.div`
  padding: 12px 16px; border-bottom: 0.5px solid var(--color-border-tertiary);
  display: flex; align-items: center; justify-content: space-between;
  flex-shrink: 0;
`;
const Badge = styled.span<{ $variant: string }>`
  display: inline-flex; align-items: center; gap: 4px;
  padding: 2px 9px; border-radius: 20px; font-size: 10px; font-weight: 500;
  ${p => p.$variant === 'success' && 'background:var(--color-background-success);color:var(--color-text-success);'}
  ${p => p.$variant === 'warning' && 'background:var(--color-background-warning);color:var(--color-text-warning);'}
  ${p => p.$variant === 'danger'  && 'background:var(--color-background-danger);color:var(--color-text-danger);'}
  ${p => p.$variant === 'info'    && 'background:var(--color-background-info);color:var(--color-text-info);'}
`;
const BtnXS = styled.button<{ $variant?: string }>`
  padding: 5px 12px; font-size: 11px; border-radius: 6px; cursor: pointer; font-weight: 500;
  border: 1px solid ${p => p.$variant === 'danger' ? 'var(--color-text-danger)' : p.$variant === 'info' ? 'var(--color-text-info)' : 'var(--color-border-secondary)'};
  background: ${p => p.$variant === 'info' ? 'var(--color-background-info)' : p.$variant === 'danger' ? 'var(--color-background-danger)' : 'var(--color-background-primary)'};
  color: ${p => p.$variant === 'danger' ? 'var(--color-text-danger)' : p.$variant === 'info' ? 'var(--color-text-info)' : 'var(--color-text-primary)'};
  display: flex; align-items: center; gap: 5px;
  transition: all 0.2s;
  &:hover { background: ${p => p.$variant === 'info' ? '#d0e5f9' : p.$variant === 'danger' ? '#fadedd' : 'var(--color-background-secondary)'}; }
`;
const TabBar = styled.div`
  display: flex; border-bottom: 0.5px solid var(--color-border-tertiary);
  padding: 0 16px; flex-shrink: 0; overflow-x: auto;
  &::-webkit-scrollbar { display: none; }
`;
const Tab = styled.button<{ $active?: boolean }>`
  padding: 10px 16px; font-size: 12px; cursor: pointer; font-weight: 600;
  color: ${p => p.$active ? 'var(--color-text-info)' : 'var(--color-text-tertiary)'};
  border: none; background: none; white-space: nowrap;
  border-bottom: 2.5px solid ${p => p.$active ? 'var(--color-text-info)' : 'transparent'};
  margin-bottom: -0.5px;
  transition: all 0.2s;
  &:hover { color: var(--color-text-primary); background: var(--color-background-secondary); }
`;
const TabBody = styled.div`padding: 14px 16px; overflow-y: auto; flex: 1;`;
const Metrics = styled.div<{ $cols?: number }>`
  display: grid;
  grid-template-columns: repeat(${p => p.$cols ?? 4}, 1fr);
  gap: 8px; margin-bottom: 14px;
`;
const Metric = styled.div`
  background: var(--color-background-secondary);
  border-radius: 8px;
  padding: 8px 12px;
  display: flex;
  flex-direction: column;
  gap: 2px;
  border: 0.5px solid var(--color-border-tertiary);
`;

const ML = styled.div<{ $color?: string }>`
  font-size: 9px;
  font-weight: 600;
  color: ${p => p.$color || 'var(--color-text-tertiary)'};
  text-transform: uppercase;
  letter-spacing: 0.04em;
`;

const MV = styled.div<{ $color?: string }>`
  font-size: 16px;
  font-weight: 700;
  color: ${p => p.$color || 'var(--color-text-primary)'};
`;

const MSub = styled.div`font-size: 10px; color: var(--color-text-tertiary); margin-top: 1px;`;
const SectionTitle = styled.div`
  font-size: 11px; font-weight: 500; color: var(--color-text-secondary);
  text-transform: uppercase; letter-spacing: .05em; margin: 14px 0 8px;
`;
const Table = styled.table`width: 100%; border-collapse: collapse; font-size: 12px;`;
const Th = styled.th`
  text-align: left; padding: 6px 10px; font-size: 10px; font-weight: 500;
  color: var(--color-text-tertiary); text-transform: uppercase; letter-spacing: .04em;
  border-bottom: 0.5px solid var(--color-border-tertiary); white-space: nowrap;
`;
const Td = styled.td`
  padding: 8px 10px; border-bottom: 0.5px solid var(--color-border-tertiary);
  color: var(--color-text-primary); vertical-align: middle;
`;
const FilterBar = styled.div`display: flex; gap: 8px; margin-bottom: 12px; flex-wrap: wrap; align-items: center;`;
const FSel = styled.select`
  padding: 5px 8px; font-size: 12px;
  border: 0.5px solid var(--color-border-secondary); border-radius: 8px;
  background: var(--color-background-secondary); color: var(--color-text-primary);
`;
const FInput = styled.input`
  padding: 5px 8px; font-size: 12px; width: 110px;
  border: 0.5px solid var(--color-border-secondary); border-radius: 8px;
  background: var(--color-background-secondary); color: var(--color-text-primary);
  &:focus { outline: none; border-color: var(--color-border-info); }
`;
const ExpandBtn = styled.button`
  background: none; border: 0.5px solid var(--color-border-tertiary);
  border-radius: 4px; padding: 2px 7px; font-size: 11px; cursor: pointer;
  color: var(--color-text-secondary);
  display: flex; align-items: center; gap: 4px;
  &:hover { background: var(--color-background-secondary); }
`;
const OrderDetail = styled.div`
  background: var(--color-background-secondary);
  border-radius: 8px; padding: 12px; font-size: 12px;
  border-left: 2px solid var(--color-border-info);
`;
const DetailGrid = styled.div`
  display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 8px; margin-top: 8px;
`;
const ProfileGrid = styled.div`display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-bottom: 14px;`;
const ProfileField = styled.div`
  label { display: block; font-size: 10px; color: var(--color-text-tertiary); text-transform: uppercase; letter-spacing: .04em; margin-bottom: 4px; }
  input, select { width: 100%; padding: 7px 10px; font-size: 13px; border: 0.5px solid var(--color-border-secondary); border-radius: 8px; background: var(--color-background-secondary); color: var(--color-text-primary); }
  input:focus, select:focus { outline: none; border-color: var(--color-border-info); }
  input:disabled { opacity: .5; }
`;
const AddrCard = styled.div<{ $default?: boolean }>`
  border: 0.5px solid ${p => p.$default ? 'var(--color-border-success)' : 'var(--color-border-tertiary)'};
  border-radius: 8px; padding: 10px 12px; margin-bottom: 8px;
  background: ${p => p.$default ? 'var(--color-background-success)' : 'transparent'};
  display: flex; justify-content: space-between; align-items: flex-start; gap: 8px;
`;
const RevGrid = styled.div`display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; margin-bottom: 14px;`;
const RevCard = styled.div`background: var(--color-background-secondary); border-radius: 8px; padding: 12px;`;

const MetricCard = styled.div`
  background: var(--color-background-primary);
  border: 1px solid var(--color-border-secondary);
  border-radius: 12px;
  padding: 14px 18px;
  display: flex;
  flex-direction: column;
  gap: 4px;
  box-shadow: 0 4px 12px rgba(0,0,0,0.05);
  flex: 1;
`;

const WalletAdj = styled.div`background: var(--color-background-secondary); border-radius: 8px; padding: 12px; margin-bottom: 10px;`;
const AdjRow = styled.div`display: flex; gap: 8px; align-items: center; flex-wrap: wrap; margin-bottom: 8px; font-size: 11px; color: var(--color-text-secondary);`;
const AdjInput = styled.input`padding: 6px 8px; font-size: 12px; border: 0.5px solid var(--color-border-secondary); border-radius: 8px; background: var(--color-background-primary); color: var(--color-text-primary);`;
const AdjSelect = styled.select`padding: 6px 8px; font-size: 12px; border: 0.5px solid var(--color-border-secondary); border-radius: 8px; background: var(--color-background-primary); color: var(--color-text-primary);`;
const BtnPrimary = styled.button`
  padding: 8px 18px; background: var(--color-text-info); color: #fff; border: none; border-radius: 8px; 
  font-size: 12px; font-weight: 600; cursor: pointer; transition: all 0.2s;
  box-shadow: 0 2px 4px rgba(24, 95, 165, 0.2);
  &:hover { opacity: .9; transform: translateY(-1px); box-shadow: 0 4px 6px rgba(24, 95, 165, 0.3); }
  &:active { transform: translateY(0); }
`;
const BtnSec = styled.button`
  padding: 8px 18px; background: var(--color-background-primary); 
  border: 1px solid var(--color-border-secondary); border-radius: 8px; 
  font-size: 12px; font-weight: 500; color: var(--color-text-primary); cursor: pointer;
  transition: all 0.2s;
  &:hover { background: var(--color-background-secondary); border-color: var(--color-text-tertiary); }
`;
const ActionBar = styled.div`display: flex; gap: 8px; margin-top: 12px;`;
const CopyBtn = styled.button`background: var(--color-background-info); border: none; border-radius: 6px; padding: 5px 10px; cursor: pointer; color: var(--color-text-info); display: flex; align-items: center; gap: 4px; font-size: 11px;`;
const Toast = styled.div<{ $show: boolean }>`
  position: fixed; bottom: 24px; right: 24px; z-index: 9999;
  padding: 10px 18px; background: var(--color-text-success); color: #fff;
  border-radius: 8px; font-size: 13px; font-weight: 500;
  transition: opacity .3s; opacity: ${p => p.$show ? 1 : 0}; pointer-events: none;
`;
const EmptyState = styled.div`text-align: center; padding: 48px 20px; color: var(--color-text-tertiary); font-size: 14px;`;
const BarWrap = styled.div`margin-bottom: 8px;`;
const BarLabel = styled.div`display: flex; justify-content: space-between; font-size: 11px; color: var(--color-text-secondary); margin-bottom: 4px;`;
const BarTrack = styled.div`height: 8px; background: var(--color-background-secondary); border-radius: 4px; overflow: hidden;`;
const BarFill = styled.div<{ $w: number; $color: string }>`height: 100%; width: ${p => p.$w}%; background: ${p => p.$color}; border-radius: 4px; transition: width .4s;`;
const MonoBadge = styled.span`font-family: monospace; font-size: 11px;`;
const ScrollToTop = styled.button<{ $show: boolean }>`
  position: fixed; bottom: 24px; right: 80px; z-index: 1500;
  width: 40px; height: 40px; border-radius: 50%;
  background: var(--color-background-info); color: var(--color-text-info);
  border: 1px solid var(--color-border-info); cursor: pointer;
  display: flex; align-items: center; justify-content: center;
  box-shadow: 0 4px 12px rgba(0,0,0,0.2);
  transition: all 0.3s;
  opacity: ${p => p.$show ? 1 : 0};
  pointer-events: ${p => p.$show ? 'auto' : 'none'};
  &:hover { transform: translateY(-2px); background: #d0e5f9; }
`;

const ModalBackdrop = styled.div`
  position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0, 0, 0, 0.4);
  z-index: 2000; display: flex; align-items: center; justify-content: center; padding: 20px;
  backdrop-filter: blur(2px);
`;
const ModalContainer = styled.div`
  background: var(--color-background-primary); border-radius: 16px; width: 100%; max-width: 440px; 
  position: relative; box-shadow: 0 20px 40px rgba(0,0,0,0.2); overflow: hidden;
  border: 1px solid var(--color-border);
`;
const ModalHead = styled.div`padding: 16px 20px; border-bottom: 1px solid var(--color-border); display: flex; justify-content: space-between; align-items: center; background: var(--color-background-secondary);`;
const ModalTitle = styled.div`font-size: 14px; font-weight: 600; color: var(--color-text-primary);`;
const CloseBtn = styled.button`background: none; border: none; font-size: 20px; color: var(--color-text-tertiary); cursor: pointer; &:hover { color: var(--color-text-primary); }`;
const ModalBody = styled.div`padding: 20px;`;

// small inline badge for css-class approach
const IBadge = ({ cls, children }: { cls: string; children: React.ReactNode }) => {
  const map: Record<string, { bg: string; color: string }> = {
    'b-delivered': { bg: 'var(--color-background-success)', color: 'var(--color-text-success)' },
    'b-cancelled': { bg: 'var(--color-background-danger)', color: 'var(--color-text-danger)' },
    'b-pending':   { bg: 'var(--color-background-warning)', color: 'var(--color-text-warning)' },
    'b-transit':   { bg: 'var(--color-background-info)', color: 'var(--color-text-info)' },
    'b-wallet':    { bg: '#E1F5EE', color: '#085041' },
    'b-cash':      { bg: '#FAEEDA', color: '#633806' },
    'b-upi':       { bg: '#EEEDFE', color: '#3C3489' },
  };
  const s = map[cls] ?? { bg: '#eee', color: '#333' };
  return <span style={{ display: 'inline-flex', alignItems: 'center', padding: '2px 8px', borderRadius: 20, fontSize: 10, fontWeight: 500, background: s.bg, color: s.color }}>{children}</span>;
};

const Bar = ({ label, val, total, color, suffix = '' }: { label: string; val: number; total: number; color: string; suffix?: string }) => (
  <BarWrap>
    <BarLabel><span>{label}</span><span>{suffix || val}</span></BarLabel>
    <BarTrack><BarFill $w={total ? Math.round(val / total * 100) : 0} $color={color} /></BarTrack>
  </BarWrap>
);

const FleetContainer = styled.div`
  margin-top: 10px;
  background: var(--color-background-secondary);
  border-radius: 12px;
  border: 1px solid var(--color-border);
  overflow: hidden;
  display: flex;
  flex-direction: column;
  height: calc(100vh - 120px);
`;

const FleetHeader = styled.div`
  padding: 16px 20px;
  border-bottom: 1px solid var(--color-border);
  background: var(--color-background-primary);
  display: flex;
  justify-content: space-between;
  align-items: center;
`;

const FleetScroll = styled.div`
  overflow: auto;
  flex: 1;
  padding: 0;
  
  /* Custom Emerald Scrollbar */
  &::-webkit-scrollbar {
    width: 8px;
    height: 8px;
  }
  &::-webkit-scrollbar-track {
    background: rgba(0, 0, 0, 0.05);
  }
  &::-webkit-scrollbar-thumb {
    background: #10b981; /* Emerald-500 */
    border-radius: 10px;
    border: 2px solid var(--color-background-secondary);
  }
  &::-webkit-scrollbar-thumb:hover {
    background: #059669; /* Emerald-600 */
  }
`;

const FilterChip = styled.button<{ $active: boolean }>`
  padding: 6px 14px;
  border-radius: 20px;
  font-size: 11px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
  border: 1.5px solid ${p => p.$active ? '#10b981' : 'var(--color-border-secondary)'};
  background: ${p => p.$active ? 'rgba(16, 185, 129, 0.1)' : 'transparent'};
  color: ${p => p.$active ? '#10b981' : 'var(--color-text-secondary)'};
  
  &:hover {
    border-color: #10b981;
    color: #10b981;
  }
`;

const JarControl = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
  background: var(--color-background-primary);
  border: 1px solid var(--color-border);
  border-radius: 6px;
  padding: 2px 6px;
`;

const JarBtn = styled.button`
  background: none;
  border: none;
  cursor: pointer;
  color: var(--color-text-info);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 4px;
  border-radius: 4px;
  &:hover { background: var(--color-background-secondary); }
`;

// ─── Main Component ───────────────────────────────────────
type TabId = 'overview' | 'profile' | 'orders' | 'transactions' | 'revenue' | 'wallet';

export default function UsersPage() {
  const { userData } = useAuth();
  const [users, setUsers] = useState<User[]>([]);
  const [addresses, setAddresses] = useState<Address[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<User | null>(null);
  const [tab, setTab] = useState<TabId>('overview');
  const [expandedOrder, setExpandedOrder] = useState<string | null>(null);
  const [toast, setToast] = useState('');
  const [toastShow, setToastShow] = useState(false);
  const [fleetMode, setFleetMode] = useState(false);
  const [showToTop, setShowToTop] = useState(false);
  const [inactiveFilter, setInactiveFilter] = useState<'all' | '10d' | '1mo' | '5mo'>('all');


  // order tab filters
  const [fStatus, setFStatus] = useState('');
  const [fPay, setFPay] = useState('');
  const [fSlot, setFSlot] = useState('');
  const [fSearch, setFSearch] = useState('');

  // txn filters
  const [ftType, setFtType] = useState('');
  const [ftCat, setFtCat] = useState('');

  // wallet adj
  const [adjType, setAdjType] = useState('Credit');
  const [adjAmt, setAdjAmt] = useState('');
  const [adjReason, setAdjReason] = useState('');

  // jar
  const [jarCount, setJarCount] = useState('');
  const [jarReason, setJarReason] = useState('');

  // per-user caches
  const [userOrders, setUserOrders] = useState<Order[]>([]);
  const [userTxns, setUserTxns] = useState<Transaction[]>([]);
  const [editFields, setEditFields] = useState<Partial<User>>({});
  const [saving, setSaving] = useState(false);
  const [editingAddress, setEditingAddress] = useState<Address | null>(null);
  const [isAddrModalOpen, setIsAddrModalOpen] = useState(false);
  const [addrForm, setAddrForm] = useState<Partial<Address>>({});

  const updateUserField = async (userId: string, field: string, value: any) => {
    try {
      await updateDocument('users', userId, { [field]: value });
      showToast(`Updated ${field.replace('_', ' ')}`);
    } catch (err) {
      console.error(err);
      showToast('Failed to update');
    }
  };

  useEffect(() => {
    if (editingAddress) {
      setAddrForm(editingAddress);
      setIsAddrModalOpen(true);
    } else {
      setAddrForm({ address_type: 'Home' });
    }
  }, [editingAddress]);

  const showToast = useCallback((msg: string) => {
    setToast(msg); setToastShow(true);
    setTimeout(() => setToastShow(false), 2600);
  }, []);

  const searchParams = useSearchParams();
  const customerIdParam = searchParams.get('customerId');
  const router = useRouter();

  // Handle deep linking from Orders page or Fleet link
  useEffect(() => {
    const mode = searchParams.get('mode');
    if (mode === 'fleet') setFleetMode(true);
    
    if (customerIdParam && users.length > 0) {
      const user = users.find(u => u.customerId === customerIdParam || u.id === customerIdParam);
      if (user) setSelected(user);
    }
  }, [customerIdParam, searchParams, users]);

  // Global subscriptions
  useEffect(() => {
    const unsub1 = subscribeToCollection('users', snap => {
      setUsers(snap.docs.map(d => ({ id: d.id, ...d.data() } as User)));
    });
    const unsub2 = subscribeToCollection('addresses', snap => {
      setAddresses(snap.docs.map(d => ({ id: d.id, ...d.data() } as Address)));
    });
    const unsub3 = subscribeToCollection('orders', snap => {
      const mapped = snap.docs.map(doc => {
        const data = doc.data();
        const totalQty = data.items?.reduce((acc: number, item: any) => acc + (item.quantity || 0), 0) || data.quantity || 1;
        const totalAmt = data.total || data.amount || data.items?.reduce((acc: number, item: any) => acc + (item.price || item.amount || 0), 0) || (totalQty * 37);
        
        const rawAddr = data.deliveryAddress || data.address;
        const getString = (val: any) => typeof val === 'string' ? val : '';
        const extractPincode = (str: string) => str.match(/\d{6}/)?.[0] || '';

        let addrFull = '';
        let addrStreet = '';
        let addrPincode = '';

        if (typeof rawAddr === 'string') {
          addrFull = rawAddr;
          addrStreet = rawAddr;
          addrPincode = extractPincode(rawAddr);
        } else if (rawAddr && typeof rawAddr === 'object') {
          addrFull = getString(rawAddr.fullAddress || rawAddr.full || '');
          addrStreet = getString(rawAddr.street || rawAddr.area || addrFull);
          addrPincode = getString(rawAddr.pincode || extractPincode(addrFull));
        }

        return {
          id: doc.id,
          ...data,
          quantity: totalQty,
          amount: totalAmt,
          address: addrFull,
          raw: data
        } as Order;
      });
      setOrders(mapped);
    });
    return () => { unsub1(); unsub2(); unsub3(); };
  }, []);

  // Update showToTop on scroll (for Fleet Mode)
  useEffect(() => {
    const mainEl = document.querySelector('#admin-main-panel');
    if (!mainEl) return;
    const handleScroll = () => setShowToTop(mainEl.scrollTop > 400);
    mainEl.addEventListener('scroll', handleScroll);
    return () => mainEl.removeEventListener('scroll', handleScroll);
  }, [fleetMode]);

  const scrollToTop = () => {
    const mainEl = document.querySelector('#admin-main-panel');
    if (mainEl) mainEl.scrollTo({ top: 0, behavior: 'smooth' });
  };


  // Per-user order/txn live subscription
  useEffect(() => {
    if (!selected) return;
    const uo = orders.filter(o => o.userId === selected.id);
    setUserOrders(uo);
    const unsubTxns = subscribeToCollection('transactions', snap => {
      setUserTxns(snap.docs.map(d => ({ id: d.id, ...d.data() } as Transaction)));
    }, [where('userId', '==', selected.id)]);
    return () => unsubTxns();
  }, [selected, orders]);

  // Whenever user is selected, seed edit fields and jar count
  useEffect(() => {
    if (!selected) return;
    setEditFields({
      full_name: selected.full_name || selected.name || '',
      email: selected.email || '',
      phone: (selected as any).phone || selected.phoneNumber || '',
      alt_phone: (selected as any).alt_phone || '',
    });
    setJarCount(String(selected.jars_occupied || 0));
    setTab('overview');
    setExpandedOrder(null);
    setFStatus(''); setFPay(''); setFSlot(''); setFSearch('');
    setFtType(''); setFtCat('');
  }, [selected?.id]);

  const filteredUsers = users
    .filter(u => {
      const q = search.toLowerCase();
      const matchesSearch = !q ||
        dName(u).toLowerCase().includes(q) ||
        (u.customerId || '').toLowerCase().includes(q) ||
        (u.email || '').toLowerCase().includes(q) ||
        (u.phoneNumber || '').toLowerCase().includes(q) ||
        (u.phone || '').toLowerCase().includes(q);

      if (!matchesSearch) return false;

      // Inactive filter logic
      if (inactiveFilter !== 'all') {
        const uOrds = orders.filter(o => o.userId === u.id);
        if (uOrds.length === 0) return true; // Never ordered = inactive

        const lastO = uOrds.sort((a,b) => {
          const getTs = (o: any) => {
            const t = o.createdAt;
            if (!t) return 0;
            if (typeof t.toMillis === 'function') return t.toMillis();
            return new Date(t).getTime();
          };
          return getTs(b) - getTs(a);
        })[0];

        const lastTs = lastO.createdAt ? (typeof (lastO.createdAt as any).toMillis === 'function' ? (lastO.createdAt as any).toMillis() : new Date(lastO.createdAt as any).getTime()) : 0;
        const diffMs = Date.now() - lastTs;
        const diffDays = diffMs / (1000 * 60 * 60 * 24);

        if (inactiveFilter === '10d') return diffDays >= 10;
        if (inactiveFilter === '1mo') return diffDays >= 30;
        if (inactiveFilter === '5mo') return diffDays >= 150;
      }

      return true;
    })
    .sort((a, b) => {
      // Specific sort: if inactivity filter is on, sort by inactivity duration (Low to High)
      if (inactiveFilter !== 'all') {
        const getInactivityMs = (u: User) => {
          const uOrds = orders.filter(o => o.userId === u.id);
          if (uOrds.length === 0) return 9999999999999; // Effectively infinity (never ordered)
          const lastO = uOrds.reduce((latest: any, o: any) => {
            const getTs = (ord: any) => {
              const t = ord.createdAt;
              if (!t) return 0;
              if (typeof t.toMillis === 'function') return t.toMillis();
              return new Date(t).getTime();
            };
            return getTs(o) > getTs(latest) ? o : latest;
          }, uOrds[0]);
          const lTs = lastO.createdAt ? (typeof (lastO.createdAt as any).toMillis === 'function' ? (lastO.createdAt as any).toMillis() : new Date(lastO.createdAt as any).getTime()) : 0;
          return Date.now() - lTs;
        };
        const diffA = getInactivityMs(a);
        const diffB = getInactivityMs(b);
        if (diffA !== diffB) return diffA - diffB;
      }

      // Default sort (when no inactivity filter): Newest Customer ID first
      const getIDNum = (id?: string) => {
        if (!id) return 0;
        const m = id.match(/\d+/);
        return m ? parseInt(m[0]) : 0;
      };
      const nA = getIDNum(a.customerId);
      const nB = getIDNum(b.customerId);
      if (nA !== nB) return nB - nA;

      // Secondary default: Newest account first
      const getAccTs = (u: User) => {
        const c = u.createdAt as any;
        if (!c) return 0;
        if (typeof c.toMillis === 'function') return c.toMillis();
        if (typeof c.toDate === 'function') return c.toDate().getTime();
        if (c instanceof Date) return c.getTime();
        return new Date(c).getTime() || 0;
      };
      return getAccTs(b) - getAccTs(a);
    });


  // ── Overview helpers ──
  const oDelivered = (ords: Order[]) => ords.filter(o => o.status === 'delivered' || o.status === 'completed');
  const oCancelled = (ords: Order[]) => ords.filter(o => o.status === 'cancelled');
  const oRevenue   = (ords: Order[]) => oDelivered(ords).reduce((s, o) => s + (o.totalAmount || o.amount || 0), 0);

  // ── Handle wallet adjustment ──
  const handleWalletAdj = async () => {
    if (!selected) return;
    const amt = parseInt(adjAmt);
    if (!amt || amt <= 0) { showToast('Enter a valid amount'); return; }
    const isCredit = adjType === 'Credit';
    const newBal = (selected.wallet_balance || 0) + (isCredit ? amt : -amt);
    setSaving(true);
    try {
      await updateDocument('users', selected.id, { wallet_balance: newBal });
      await addDocument('transactions', {
        userId: selected.id, customerId: selected.customerId,
        type: isCredit ? 'credit' : 'debit', amount: amt,
        category: 'admin_adjustment', note: adjReason || 'Admin adjustment',
        createdAt: serverTimestamp(),
      });
      showToast(`${adjType} ₹${amt} applied & logged`);
      setAdjAmt(''); setAdjReason('');
    } catch (e) { showToast('Error — check console'); }
    setSaving(false);
  };

  // ── Handle jar correction ──
  const handleJarCorrection = async () => {
    if (!selected) return;
    const count = parseInt(jarCount);
    if (isNaN(count) || count < 0) { showToast('Enter a valid jar count'); return; }
    setSaving(true);
    try {
      await updateDocument('users', selected.id, { jars_occupied: count });
      await addDocument('activity_logs', {
        action: 'jar_correction', userId: selected.id,
        adminId: userData?.id, oldValue: selected.jars_occupied,
        newValue: count, reason: jarReason || 'Manual correction',
        createdAt: serverTimestamp(),
      });
      showToast('Jar count updated & audit logged');
      setJarReason('');
    } catch (e) { showToast('Error — check console'); }
    setSaving(false);
  };

  // ── Handle profile save — writes exact iOS app user schema ──
  const handleProfileSave = async () => {
    if (!selected) return;
    setSaving(true);
    try {
      // Only write fields that the iOS app user doc schema uses
      const data: Record<string, unknown> = {};
      if (editFields.full_name !== undefined) data.full_name = editFields.full_name;
      if ((editFields as any).email !== undefined) data.email = (editFields as any).email;
      if ((editFields as any).phone !== undefined) data.phone = (editFields as any).phone;
      if ((editFields as any).alt_phone !== undefined) data.alt_phone = (editFields as any).alt_phone;
      await updateDocument('users', selected.id, data);
      showToast('Profile saved to Firestore');
    } catch (e) { showToast('Error saving profile'); }
    setSaving(false);
  };

  // ── Handle Address Default ──
  const handleSetDefaultAddress = async (addrId: string) => {
    if (!selected) return;
    setSaving(true);
    try {
      const batch = writeBatch(db);
      const userAddrs = addresses.filter(a => a.userId === selected.id);
      userAddrs.forEach(a => {
        batch.update(doc(db, 'addresses', a.id!), { isDefault: a.id === addrId });
      });
      await batch.commit();
      showToast('Default address updated');
    } catch (e) { showToast('Error updating default address'); }
    setSaving(false);
  };

  // ── Handle Address Save — writes exact iOS app address schema (AppContext.jsx saveAddress) ──
  const handleAddressSave = async () => {
    if (!selected) return;
    if (!addrForm.address_type || !addrForm.address_line) { showToast('Address type and address line are required'); return; }
    setSaving(true);
    try {
      const now = serverTimestamp();
      // Build the exact Firestore payload matching iOS AppContext saveAddress
      const payload: Record<string, unknown> = {
        address_type: addrForm.address_type,
        address_line: addrForm.address_line,
        plus_code: addrForm.plus_code || null,
        house_no: addrForm.house_no || null,
        floor_no: addrForm.floor_no || null,
        landmark: addrForm.landmark || null,
        lift_available: addrForm.lift_available || null,
        be_aware_of_dogs: addrForm.be_aware_of_dogs ?? false,
        latitude: addrForm.latitude || null,
        longitude: addrForm.longitude || null,
        isDefault: addrForm.isDefault ?? false,
        userId: selected.id,
        updatedAt: now,
      };
      if (editingAddress?.id) {
        await updateDocument('addresses', editingAddress.id, payload);
        // If setting as default, clear others first
        if (payload.isDefault) {
          const batch = writeBatch(db);
          addresses.filter(a => a.userId === selected.id && a.id !== editingAddress.id)
            .forEach(a => batch.update(doc(db, 'addresses', a.id!), { isDefault: false }));
          await batch.commit();
        }
        showToast('Address updated in Firestore');
      } else {
        const userAddrs = addresses.filter(a => a.userId === selected.id);
        const isFirstAddress = userAddrs.length === 0;
        // Clear existing defaults if adding a new default
        if (isFirstAddress || payload.isDefault) {
          const batch = writeBatch(db);
          userAddrs.forEach(a => batch.update(doc(db, 'addresses', a.id!), { isDefault: false }));
          await batch.commit();
          payload.isDefault = true;
        }
        await addDocument('addresses', { ...payload, createdAt: now });
        showToast('New address added to Firestore');
      }
      setIsAddrModalOpen(false);
      setEditingAddress(null);
    } catch (e) { showToast('Error saving address'); }
    setSaving(false);
  };

  // ── Handle Address Delete ──
  const handleAddressDelete = async (addrId: string) => {
    if (!confirm('Delete this address?')) return;
    setSaving(true);
    try {
      await deleteDocument('addresses', addrId);
      showToast('Address deleted');
    } catch (e) { showToast('Error deleting address'); }
    setSaving(false);
  };

  // ── Permanently delete a user account + their addresses ──
  const handleDeleteUser = async (user: User) => {
    const confirmed = confirm(
      `⚠️ PERMANENT DELETE\n\nThis will delete "${dName(user)}" (${user.customerId}) and all their saved addresses from Firestore.\n\nThis cannot be undone. Continue?`
    );
    if (!confirmed) return;
    setSaving(true);
    try {
      // Delete all addresses belonging to this user
      const userAddrs = addresses.filter(a => a.userId === user.id);
      await Promise.all(userAddrs.map(a => deleteDocument('addresses', a.id!)));
      // Delete the user doc itself
      await deleteDocument('users', user.id);
      // Deselect if this was the active user
      if (selected?.id === user.id) setSelected(null);
      showToast(`User "${dName(user)}" permanently deleted`);
    } catch (e) { showToast('Error deleting user — check console'); console.error(e); }
    setSaving(false);
  };
  const filteredOrders = userOrders.filter(o => {
    const s = o.status?.toLowerCase();
    const fs = fStatus.toLowerCase();
    return (
      (!fStatus || s === fs || (fStatus === 'Delivered' && s === 'completed') || s?.includes(fs)) &&
      (!fPay || (o.paymentMethod || '').toLowerCase() === fPay.toLowerCase()) &&
      (!fSlot || String(o.slot) === fSlot) &&
      (!fSearch || o.id.toLowerCase().includes(fSearch.toLowerCase()))
    );
  });

  const filteredTxns = userTxns.filter(t =>
    (!ftType || t.type === ftType) &&
    (!ftCat || t.category === ftCat)
  );

  if (!selected && filteredUsers.length > 0 && users.length > 0) {
    // auto-select first user
    setTimeout(() => setSelected(filteredUsers[0]), 0);
  }

  const selPalette = selected ? palette(selected.customerId || selected.id) : AVATAR_PALETTES[0];

  const renderFleetView = () => {
    // 1. Calculate stats across all users
    const fleetStats = users.reduce((acc, u) => {
      acc.totalJars += (u.jars_occupied || 0);
      acc.totalWallet += (u.wallet_balance || 0);
      
      const uOrds = orders.filter(o => o.userId === u.id);
      if (uOrds.length > 0) {
        const lastO = uOrds.sort((a,b) => {
          const tA = a.createdAt ? (typeof (a.createdAt as any).toMillis === 'function' ? (a.createdAt as any).toMillis() : new Date(a.createdAt as any).getTime()) : 0;
          const tB = b.createdAt ? (typeof (b.createdAt as any).toMillis === 'function' ? (b.createdAt as any).toMillis() : new Date(b.createdAt as any).getTime()) : 0;
          return tB - tA;
        })[0];
        const lastTs = lastO.createdAt ? (typeof (lastO.createdAt as any).toMillis === 'function' ? (lastO.createdAt as any).toMillis() : new Date(lastO.createdAt as any).getTime()) : 0;
        if ((Date.now() - lastTs) > (10 * 24 * 60 * 60 * 1000)) acc.inactive10d++;
      } else {
        acc.inactive10d++;
      }
      return acc;
    }, { totalJars: 0, totalWallet: 0, inactive10d: 0 });

    return (
      <FleetContainer>
        <FleetHeader>
          <div style={{ display: 'flex', gap: 24, flex: 1 }}>
            <MetricCard>
              <ML $color="#71717a">FLEET CUSTOMERS</ML>
              <MV style={{ color: '#10b981' }}>{users.length}</MV>
            </MetricCard>
            <MetricCard>
              <ML $color="#71717a">TOTAL JARS OUT</ML>
              <MV style={{ color: '#3b82f6' }}>{fleetStats.totalJars}</MV>
            </MetricCard>
            <MetricCard>
              <ML $color="#71717a">WALLET FLOAT</ML>
              <MV style={{ color: '#059669' }}>₹{fleetStats.totalWallet.toLocaleString()}</MV>
            </MetricCard>
            <MetricCard>
              <ML $color="#71717a">INACTIVE (10D+)</ML>
              <MV style={{ color: 'var(--color-text-danger)' }}>{fleetStats.inactive10d}</MV>
            </MetricCard>
          </div>

          <div style={{ display: 'flex', gap: 8, alignItems: 'center', background: 'rgba(255,255,255,0.03)', padding: '4px 12px', borderRadius: 100, border: '1px solid rgba(255,255,255,0.05)' }}>
            <span style={{ fontSize: 10, color: 'var(--color-text-tertiary)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Filters:</span>
            {(['all', '10d', '1mo', '5mo'] as const).map(f => (
              <FilterChip 
                key={f} 
                $active={inactiveFilter === f} 
                onClick={() => setInactiveFilter(f)}
                style={{ fontSize: 10, padding: '4px 12px' }}
              >
                {f === 'all' ? 'All' : f === '10d' ? '10d+' : f === '1mo' ? '1mo+' : '5mo+'}
              </FilterChip>
            ))}
          </div>
        </FleetHeader>

        <FleetScroll style={{ height: 'calc(100vh - 220px)', overflow: 'auto' }}>
          <Table style={{ position: 'relative', borderCollapse: 'separate', borderSpacing: 0 }}>
            <thead style={{ position: 'sticky', top: 0, zIndex: 100, background: 'var(--color-background-primary)', boxShadow: '0 2px 8px rgba(0,0,0,0.2)' }}>
              <tr>
                <Th style={{ padding: '16px 20px', borderBottom: '1px solid var(--color-border-primary)' }}>Customer ID</Th>
                <Th style={{ borderBottom: '1px solid var(--color-border-primary)' }}>Customer Details</Th>
                <Th style={{ borderBottom: '1px solid var(--color-border-primary)' }}>Last Seen / Status</Th>
                <Th style={{ borderBottom: '1px solid var(--color-border-primary)' }}>Hold Jars</Th>
                <Th style={{ borderBottom: '1px solid var(--color-border-primary)' }}>Wallet</Th>
                <Th style={{ borderBottom: '1px solid var(--color-border-primary)' }}>Deposit</Th>
                <Th style={{ borderBottom: '1px solid var(--color-border-primary)' }}>Referrals</Th>
                <Th style={{ textAlign: 'right', paddingRight: 20, borderBottom: '1px solid var(--color-border-primary)' }}>Actions</Th>
              </tr>
            </thead>
            <tbody>
              {filteredUsers.length === 0 ? (
                <tr>
                  <Td colSpan={8} style={{ textAlign: 'center', padding: '100px 0', opacity: 0.5 }}>
                    <FiSearch size={40} style={{ marginBottom: 12, opacity: 0.2 }} />
                    <p>No customers matching the current filter</p>
                  </Td>
                </tr>
              ) : filteredUsers.map(u => {
                const uOrds = orders.filter(o => o.userId === u.id);
                const lastO = uOrds.length > 0 ? [...uOrds].sort((a,b) => {
                  const tA = a.createdAt ? (typeof (a.createdAt as any).toMillis === 'function' ? (a.createdAt as any).toMillis() : new Date(a.createdAt as any).getTime()) : 0;
                  const tB = b.createdAt ? (typeof (b.createdAt as any).toMillis === 'function' ? (b.createdAt as any).toMillis() : new Date(b.createdAt as any).getTime()) : 0;
                  return tB - tA;
                })[0] : null;

                const lastTs = lastO?.createdAt ? (typeof (lastO.createdAt as any).toMillis === 'function' ? (lastO.createdAt as any).toMillis() : new Date(lastO.createdAt as any).getTime()) : 0;
                const diffDays = lastTs ? Math.floor((Date.now() - lastTs) / (1000 * 60 * 60 * 24)) : 999;
                
                return (
                  <tr key={u.id} style={{ transition: 'all 0.2s' }}>
                    <Td style={{ paddingLeft: 20 }}>
                      <MonoBadge style={{ color: '#10b981', fontWeight: 700, fontSize: 11, background: 'rgba(16,185,129,0.08)', padding: '4px 8px', borderRadius: '6px' }}>
                        {u.customerId || u.id.slice(-6).toUpperCase()}
                      </MonoBadge>
                    </Td>
                    <Td>
                      <div style={{ display: 'flex', flexDirection: 'column' }}>
                        <span style={{ fontWeight: 600, color: 'var(--color-text-primary)', fontSize: 13 }}>{dName(u)}</span>
                        <span style={{ fontSize: 10, color: 'var(--color-text-tertiary)', letterSpacing: '0.02em' }}>{u.phoneNumber || u.phone || 'No phone'}</span>
                      </div>
                    </Td>
                    <Td>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                        <div style={{ 
                          fontSize: 11, 
                          color: diffDays > 30 ? '#f87171' : diffDays > 10 ? '#fbbf24' : '#4ade80',
                          fontWeight: 700 
                        }}>
                          {diffDays === 999 ? 'No Activity' : `${diffDays} days ago`}
                        </div>
                        <div style={{ fontSize: 9, color: 'var(--color-text-tertiary)' }}>
                          {lastO ? fmt(lastO.createdAt) : 'Fresh Client'}
                        </div>
                      </div>
                    </Td>
                    <Td>
                      <JarControl>
                        <JarBtn onClick={(e) => { e.stopPropagation(); updateUserField(u.id, 'jars_occupied', Math.max(0, (u.jars_occupied || 0) - 1)); }} title="Remive Jar">
                          <FiMinus size={12} />
                        </JarBtn>
                        <span style={{ minWidth: '18px', textAlign: 'center', fontWeight: 700, fontSize: 14 }}>{u.jars_occupied || 0}</span>
                        <JarBtn onClick={(e) => { e.stopPropagation(); updateUserField(u.id, 'jars_occupied', (u.jars_occupied || 0) + 1); }} title="Add Jar">
                          <FiPlus size={12} />
                        </JarBtn>
                      </JarControl>
                    </Td>
                    <Td>
                      <div style={{ color: (u.wallet_balance || 0) < 0 ? '#f87171' : '#10b981', fontWeight: 700, fontSize: 13 }}>
                        ₹{(u.wallet_balance || 0).toLocaleString()}
                      </div>
                    </Td>
                    <Td>
                      <div 
                        onClick={(e) => { e.stopPropagation(); updateUserField(u.id, 'depositPaid', !u.depositPaid); }}
                        style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}
                      >
                        {u.depositPaid ? (
                          <div style={{ display: 'flex', alignItems: 'center', gap: 4, color: '#10b981' }}>
                            <FiCheckCircle size={14} />
                            <span style={{ fontSize: 10, fontWeight: 700 }}>PAID</span>
                          </div>
                        ) : (
                          <div style={{ display: 'flex', alignItems: 'center', gap: 4, color: '#ef4444' }}>
                            <FiXCircle size={14} />
                            <span style={{ fontSize: 10, fontWeight: 700 }}>UNPAID</span>
                          </div>
                        )}
                        {!u.depositPaid && <BtnXS style={{ padding: '1px 5px', fontSize: 8 }}>Approve</BtnXS>}
                      </div>
                    </Td>
                    <Td>
                      <div style={{ display: 'flex', flexDirection: 'column' }}>
                        <div style={{ fontSize: 11, fontWeight: 700, color: '#3b82f6' }}>{u.referralCount || 0} Refs</div>
                        <div style={{ fontSize: 9, color: 'var(--color-text-tertiary)' }}>₹{u.bonusEarned || 0} bonus</div>
                      </div>
                    </Td>
                    <Td style={{ textAlign: 'right', paddingRight: 20 }}>
                      <BtnXS $variant="info" 
                             onClick={() => { setSelected(u); setFleetMode(false); }} 
                             style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', padding: '6px 12px' }}>
                        Settings
                      </BtnXS>
                    </Td>
                  </tr>
                );
              })}
            </tbody>
          </Table>
        </FleetScroll>
      </FleetContainer>
    );
  };

  // ── Render tabs ──
  const renderOverview = () => {
    const del = oDelivered(userOrders).length;
    const can = oCancelled(userOrders).length;
    const tot = userOrders.length;
    const rev = oRevenue(userOrders);
    const walletRev = oDelivered(userOrders).filter(o => o.paymentMethod === 'wallet').reduce((s, o) => s + (o.totalAmount || o.amount || 0), 0);
    const cashRev   = oDelivered(userOrders).filter(o => o.paymentMethod === 'cash').reduce((s, o) => s + (o.totalAmount || o.amount || 0), 0);
    const upiRev    = oDelivered(userOrders).filter(o => o.paymentMethod !== 'wallet' && o.paymentMethod !== 'cash').reduce((s, o) => s + (o.totalAmount || o.amount || 0), 0);
    const recent = userOrders.slice(0, 4);
    return (
      <>
        <Metrics $cols={4}>
          <Metric><ML>Total orders</ML><MV>{tot}</MV><MSub>All time</MSub></Metric>
          <Metric><ML>Delivered</ML><MV $color="var(--color-text-success)">{del}</MV><MSub>{tot ? Math.round(del / tot * 100) : 0}% success rate</MSub></Metric>
          <Metric><ML>Cancelled</ML><MV $color="var(--color-text-danger)">{can}</MV><MSub>{tot ? Math.round(can / tot * 100) : 0}% cancel rate</MSub></Metric>
          <Metric><ML>Revenue</ML><MV $color="var(--color-text-success)">₹{rev}</MV><MSub>Delivered only</MSub></Metric>
        </Metrics>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <div>
            <SectionTitle>Order breakdown</SectionTitle>
            <Bar label="Delivered" val={del} total={tot} color="#3b6d11" />
            <Bar label="Cancelled" val={can} total={tot} color="#a32d2d" />
            <Bar label="Other" val={tot - del - can} total={tot} color="#185fa5" />
          </div>
          <div>
            <SectionTitle>Payment split</SectionTitle>
            <Bar label="Wallet" val={walletRev} total={rev} color="#085041" suffix={`₹${walletRev}`} />
            <Bar label="UPI" val={upiRev} total={rev} color="#3C3489" suffix={`₹${upiRev}`} />
            <Bar label="Cash" val={cashRev} total={rev} color="#633806" suffix={`₹${cashRev}`} />
          </div>
        </div>

        <SectionTitle>Recent orders</SectionTitle>
        <Table>
          <thead><tr>
            <Th>Order ID</Th><Th>Date</Th><Th>Jars</Th><Th>Amount</Th><Th>Payment</Th><Th>Status</Th>
          </tr></thead>
          <tbody>
            {recent.length === 0 && <tr><Td colSpan={6} style={{ textAlign: 'center', color: 'var(--color-text-tertiary)' }}>No orders yet</Td></tr>}
            {recent.map(o => (
              <tr key={o.id} onClick={() => router.push(`/admin/orders?orderId=${o.id}`)} style={{ cursor: 'pointer' }}>
                <Td><MonoBadge>{o.id.slice(-8)}</MonoBadge></Td>
                <Td style={{ whiteSpace: 'nowrap', fontSize: 11 }}>{fmt(o.createdAt)}</Td>
                <Td>{o.quantity ?? '—'}</Td>
                <Td>₹{o.totalAmount || o.amount || 0}</Td>
                <Td><IBadge cls={payBadge(o.paymentMethod)}>{o.paymentMethod || '—'}</IBadge></Td>
                <Td><IBadge cls={statusBadge(o.status)}>{o.status}</IBadge></Td>
              </tr>
            ))}
          </tbody>
        </Table>
      </>
    );
  };

  const renderProfile = () => {
    const userAddrs = addresses.filter(a => a.userId === selected?.id);
    return (
      <>
        <ProfileGrid>
          {[
            { label: 'Full Name', key: 'full_name' },
            { label: 'Email', key: 'email' },
            { label: 'Primary Phone', key: 'phone' },
            { label: 'Alt Phone', key: 'alt_phone' },
            { label: 'Customer ID', key: 'customerId', disabled: true },
            { label: 'Joined', key: '_joined', disabled: true },
          ].map(f => (
            <ProfileField key={f.label}>
              <label>{f.label}</label>
              {f.key === '_joined'
                ? <input value={fmt(selected?.createdAt)} disabled />
                : f.disabled
                  ? <input value={String((selected as unknown as Record<string, unknown>)?.[f.key] ?? '')} disabled />
                  : <input
                      value={String((editFields as Record<string, unknown>)[f.key] ?? '')}
                      onChange={e => setEditFields(p => ({ ...p, [f.key]: e.target.value }))}
                    />
              }
            </ProfileField>
          ))}
        </ProfileGrid>

        <div style={{ display: 'flex', gap: 8, marginTop: 15 }}>
          <BtnXS $variant="info" as="a" href={`tel:${(selected as any)?.phone || selected?.phoneNumber}`} style={{ flex: 1, textDecoration: 'none', justifyContent: 'center' }}>
            <FiPhoneCall size={14} /> Call Phone
          </BtnXS>
          <BtnXS $variant="success" as="a" href={`https://wa.me/${((selected as any)?.phone || selected?.phoneNumber || '').replace(/\D/g, '')}`} target="_blank" style={{ flex: 1, textDecoration: 'none', justifyContent: 'center', background: '#25D366', color: 'white', borderColor: '#25D366' }}>
            <FiMessageCircle size={14} /> WhatsApp
          </BtnXS>
        </div>
        <SectionTitle>Delivery addresses</SectionTitle>
        {userAddrs.length === 0 && <div style={{ color: 'var(--color-text-tertiary)', fontSize: 13 }}>No addresses found.</div>}
        {userAddrs.map((a, i) => (
          <AddrCard key={a.id || i} $default={!!a.isDefault}>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 13, fontWeight: 600 }}>{a.address_type}</div>
              <div style={{ fontSize: 11, color: 'var(--color-text-secondary)', marginTop: 2 }}>{a.address_line}</div>
              <div style={{ display: 'flex', gap: 6, marginTop: 5, flexWrap: 'wrap' }}>
                {a.isDefault && <span style={{ background: 'var(--color-background-success)', color: 'var(--color-text-success)', borderRadius: 12, fontSize: 10, padding: '2px 8px' }}>Default</span>}
                {a.plus_code && (
                  <span title="Plus Code — Used for pinpoint delivery accuracy" style={{ background: '#E3F2FD', color: '#1565C0', borderRadius: 12, fontSize: 10, padding: '2px 8px', fontFamily: 'monospace', fontWeight: 600 }}>
                    📍 {a.plus_code}
                  </span>
                )}
                {!a.plus_code && (
                  <span style={{ background: 'var(--color-background-warning)', color: 'var(--color-text-warning)', borderRadius: 12, fontSize: 10, padding: '2px 8px' }}>No Plus Code</span>
                )}
              </div>
            </div>
            <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
              {!a.isDefault && <BtnXS $variant="info" onClick={() => handleSetDefaultAddress(a.id!)}>Set default</BtnXS>}
              <BtnXS $variant="info" onClick={() => setEditingAddress(a)} title="Edit Address"><FiEdit2 size={11} /></BtnXS>
              <BtnXS $variant="danger" onClick={() => handleAddressDelete(a.id!)} title="Delete Address"><FiTrash2 size={11} /></BtnXS>
            </div>
          </AddrCard>
        ))}
        <BtnPrimary 
           style={{ marginTop: 10, width: '100%', background: 'transparent', color: 'var(--color-text-secondary)', border: '1px dashed var(--color-border)', justifyContent: 'center' }}
           onClick={() => { setEditingAddress(null); setIsAddrModalOpen(true); }}
        >
          <FiPlus /> Add new delivery address
        </BtnPrimary>
        <ActionBar>
          <BtnPrimary onClick={handleProfileSave} disabled={saving}>{saving ? 'Saving…' : 'Save Profile'}</BtnPrimary>
          <BtnSec onClick={() => setEditFields({ full_name: (selected as any)?.full_name || '', email: selected?.email || '', phone: (selected as any)?.phone || '', alt_phone: (selected as any)?.alt_phone || '' })}>Discard</BtnSec>
        </ActionBar>
      </>
    );
  };

  const renderOrders = () => {
    const del = filteredOrders.filter(o => o.status === 'delivered' || o.status === 'completed').length;
    const can = filteredOrders.filter(o => o.status === 'cancelled').length;
    const rev = filteredOrders.filter(o => o.status === 'delivered' || o.status === 'completed').reduce((s, o) => s + (o.totalAmount || o.amount || 0), 0);
    return (
      <>
        <FilterBar>
          <FSel value={fStatus} onChange={e => setFStatus(e.target.value)}>
            <option value="">All status</option>
            <option value="delivered">Delivered</option>
            <option value="cancelled">Cancelled</option>
            <option value="pending">Pending</option>
            <option value="in_transit">In transit</option>
          </FSel>
          <FSel value={fPay} onChange={e => setFPay(e.target.value)}>
            <option value="">All payments</option>
            <option value="wallet">Wallet</option>
            <option value="cash">Cash</option>
            <option value="upi">UPI</option>
          </FSel>
          <FSel value={fSlot} onChange={e => setFSlot(e.target.value)}>
            <option value="">All slots</option>
            <option value="1">Slot 1</option><option value="2">Slot 2</option><option value="3">Slot 3</option>
          </FSel>
          <FInput placeholder="Order ID…" value={fSearch} onChange={e => setFSearch(e.target.value)} />
        </FilterBar>

        <div style={{ display: 'flex', gap: 8, marginBottom: 10, flexWrap: 'wrap' }}>
          <Metric style={{ flex: 1, minWidth: 80 }}><ML>Showing</ML><MV>{filteredOrders.length}</MV></Metric>
          <Metric style={{ flex: 1, minWidth: 80 }}><ML>Delivered</ML><MV $color="var(--color-text-success)">{del}</MV></Metric>
          <Metric style={{ flex: 1, minWidth: 80 }}><ML>Cancelled</ML><MV $color="var(--color-text-danger)">{can}</MV></Metric>
          <Metric style={{ flex: 1, minWidth: 80 }}><ML>Revenue</ML><MV>₹{rev}</MV></Metric>
        </div>

        <Table>
          <thead><tr>
            <Th>Order ID</Th><Th>Date</Th><Th>Slot</Th><Th>Jars</Th><Th>Amount</Th><Th>Payment</Th><Th>Status</Th><Th>Fast</Th><Th />
          </tr></thead>
          <tbody>
            {filteredOrders.length === 0 && <tr><Td colSpan={9} style={{ textAlign: 'center', color: 'var(--color-text-tertiary)' }}>No orders match filters</Td></tr>}
            {filteredOrders.map(o => (
              <React.Fragment key={o.id}>
                <tr>
                  <Td><MonoBadge>{o.raw?.orderNumber || o.id.slice(-8)}</MonoBadge></Td>
                  <Td style={{ whiteSpace: 'nowrap', fontSize: 11 }}>{fmt(o.createdAt)}</Td>
                  <Td style={{ fontSize: 11 }}>{o.raw?.deliverySlot || '—'}</Td>
                  <Td>{o.quantity ?? '—'}</Td>
                  <Td>₹{o.raw?.total || o.totalAmount || o.amount || 0}</Td>
                  <Td><IBadge cls={payBadge(o.paymentMethod)}>{o.paymentMethod || '—'}</IBadge></Td>
                  <Td><IBadge cls={statusBadge(o.status)}>{o.status}</IBadge></Td>
                  <Td>{(o.raw?.isPriority || o.fastDelivery) ? <IBadge cls="b-transit">Yes</IBadge> : '—'}</Td>
                  <Td>
                    <ExpandBtn onClick={() => setExpandedOrder(expandedOrder === o.id ? null : o.id)}>
                      {expandedOrder === o.id ? <><FiChevronUp size={11} /> Hide</> : <><FiChevronDown size={11} /> Details</>}
                    </ExpandBtn>
                  </Td>
                </tr>
                {expandedOrder === o.id && (
                  <tr>
                    <Td colSpan={9} style={{ padding: '0 10px 10px' }}>
                      <OrderDetail>
                        <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 6 }}>Order breakdown — {o.raw?.orderNumber || o.id}</div>
                        <DetailGrid>
                          <div><div style={{ fontSize: 10, color: 'var(--color-text-tertiary)', marginBottom: 2 }}>Delivery Address</div><div style={{ fontSize: 11 }}>{o.raw?.deliveryAddress?.fullAddress || o.address || '—'}</div></div>
                          <div><div style={{ fontSize: 10, color: 'var(--color-text-tertiary)', marginBottom: 2 }}>Delivery Date</div><div style={{ fontSize: 12, fontWeight: 500 }}>{o.raw?.deliveryDate || '—'}</div></div>
                          <div><div style={{ fontSize: 10, color: 'var(--color-text-tertiary)', marginBottom: 2 }}>Delivery Slot</div><div style={{ fontSize: 12, fontWeight: 500 }}>{o.raw?.deliverySlot || '—'}</div></div>
                          <div><div style={{ fontSize: 10, color: 'var(--color-text-tertiary)', marginBottom: 2 }}>Payment Status</div><div style={{ fontSize: 12, fontWeight: 500 }}>{o.raw?.paymentStatus || '—'}</div></div>
                          <div><div style={{ fontSize: 10, color: 'var(--color-text-tertiary)', marginBottom: 2 }}>Fast Delivery</div><div style={{ fontSize: 12, fontWeight: 500 }}>{o.raw?.isPriority ? '₹7 fee' : 'None'}</div></div>
                          <div>
                            <div style={{ fontSize: 10, color: 'var(--color-text-tertiary)', marginBottom: 2 }}>Items</div>
                            <div style={{ fontSize: 12, fontWeight: 500 }}>
                              {o.items && o.items.length > 0 ? (
                                <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                                  {o.items.map((item: any, idx: number) => (
                                    <li key={idx}>{item.name} × {item.quantity || 1} = ₹{((item.price || 0) * (item.quantity || 1)).toFixed(2)}</li>
                                  ))}
                                </ul>
                              ) : (
                                `${o.quantity} jar(s) × ₹37`
                              )}
                            </div>
                          </div>
                          <div><div style={{ fontSize: 10, color: 'var(--color-text-tertiary)', marginBottom: 2 }}>Total charged</div><div style={{ fontSize: 12, fontWeight: 600, color: 'var(--color-text-info)' }}>₹{o.raw?.total || o.amount}</div></div>
                        </DetailGrid>

                        <div style={{ marginTop: '12px', borderTop: '0.5px solid var(--color-border-tertiary)', paddingTop: '10px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <button 
                            onClick={() => {
                              const win = window.open('', '_blank');
                              win?.document.write(`<pre>${JSON.stringify(o.raw || o, null, 2)}</pre>`);
                            }}
                            style={{ background: 'none', border: 'none', color: '#64748b', fontSize: '10px', cursor: 'pointer', textDecoration: 'underline' }}
                          >
                            View raw JSON
                          </button>
                          <BtnXS $variant="info" onClick={() => router.push(`/admin/orders?orderId=${o.id}`)} style={{ padding: '6px 12px', gap: '6px' }}>
                            <FiPackage size={14} /> View in Orders tab
                          </BtnXS>
                        </div>
                      </OrderDetail>
                    </Td>
                  </tr>
                )}
              </React.Fragment>
            ))}
          </tbody>
        </Table>
      </>
    );
  };

  const renderTransactions = () => {
    const totalCredit = userTxns.filter(t => t.type === 'credit').reduce((s, t) => s + t.amount, 0);
    const totalDebit  = userTxns.filter(t => t.type === 'debit').reduce((s, t) => s + t.amount, 0);
    return (
      <>
        <FilterBar>
          <FSel value={ftType} onChange={e => setFtType(e.target.value)}>
            <option value="">All types</option>
            <option value="credit">Credits</option>
            <option value="debit">Debits</option>
          </FSel>
          <FSel value={ftCat} onChange={e => setFtCat(e.target.value)}>
            <option value="">All categories</option>
            <option value="order_payment">Order payment</option>
            <option value="wallet_topup">Wallet topup</option>
            <option value="referral">Referral reward</option>
            <option value="refund">Refund</option>
            <option value="admin_adjustment">Admin adjustment</option>
          </FSel>
        </FilterBar>
        <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
          <Metric style={{ flex: 1 }}><ML>Total credits</ML><MV $color="var(--color-text-success)">+₹{totalCredit}</MV></Metric>
          <Metric style={{ flex: 1 }}><ML>Total debits</ML><MV $color="var(--color-text-danger)">-₹{totalDebit}</MV></Metric>
          <Metric style={{ flex: 1 }}><ML>Current balance</ML><MV>₹{selected?.wallet_balance ?? 0}</MV></Metric>
        </div>
        <Table>
          <thead><tr>
            <Th>Txn ID</Th><Th>Date</Th><Th>Type</Th><Th>Category</Th><Th>Method</Th><Th>Amount</Th><Th>Note</Th>
          </tr></thead>
          <tbody>
            {filteredTxns.length === 0 && <tr><Td colSpan={7} style={{ textAlign: 'center', color: 'var(--color-text-tertiary)' }}>No transactions</Td></tr>}
            {filteredTxns.map(t => (
              <tr key={t.id}>
                <Td><MonoBadge style={{ fontSize: 10 }}>{t.id.slice(-8)}</MonoBadge></Td>
                <Td style={{ whiteSpace: 'nowrap', fontSize: 11 }}>{fmt(t.createdAt)}</Td>
                <Td><IBadge cls={t.type === 'credit' ? 'b-delivered' : 'b-cancelled'}>{t.type}</IBadge></Td>
                <Td style={{ fontSize: 11, color: 'var(--color-text-secondary)' }}>{(t.category || '').replace('_', ' ')}</Td>
                <Td>{t.method ? <IBadge cls={payBadge(t.method)}>{t.method}</IBadge> : '—'}</Td>
                <Td style={{ fontWeight: 500, color: t.type === 'credit' ? 'var(--color-text-success)' : 'var(--color-text-danger)' }}>
                  {t.type === 'credit' ? '+' : '-'}₹{t.amount}
                </Td>
                <Td style={{ fontSize: 11, color: 'var(--color-text-secondary)' }}>{t.note || '—'}</Td>
              </tr>
            ))}
          </tbody>
        </Table>
      </>
    );
  };

  const renderRevenue = () => {
    const del = oDelivered(userOrders);
    const rev = oRevenue(userOrders);
    const discounts = userOrders.reduce((s, o) => s + (o.discount || 0), 0);
    const deposits  = userOrders.reduce((s, o) => s + (o.deposit || 0), 0);
    const fastFees  = del.filter(o => o.fastDelivery).length * 7;
    const walletRev = del.filter(o => o.paymentMethod === 'wallet').reduce((s, o) => s + (o.totalAmount || o.amount || 0), 0);
    const cashRev   = del.filter(o => o.paymentMethod === 'cash').reduce((s, o) => s + (o.totalAmount || o.amount || 0), 0);
    const upiRev    = del.filter(o => o.paymentMethod !== 'wallet' && o.paymentMethod !== 'cash').reduce((s, o) => s + (o.totalAmount || o.amount || 0), 0);
    return (
      <>
        <RevGrid>
          <RevCard><div style={{ fontSize: 10, color: 'var(--color-text-tertiary)', textTransform: 'uppercase', letterSpacing: '.04em', marginBottom: 3 }}>Total revenue</div><div style={{ fontSize: 22, fontWeight: 500, color: 'var(--color-text-success)' }}>₹{rev}</div><div style={{ fontSize: 10, color: 'var(--color-text-tertiary)', marginTop: 2 }}>Delivered orders only</div></RevCard>
          <RevCard><div style={{ fontSize: 10, color: 'var(--color-text-tertiary)', textTransform: 'uppercase', letterSpacing: '.04em', marginBottom: 3 }}>Discounts given</div><div style={{ fontSize: 22, fontWeight: 500, color: 'var(--color-text-danger)' }}>-₹{discounts}</div><div style={{ fontSize: 10, color: 'var(--color-text-tertiary)', marginTop: 2 }}>First order &amp; referral</div></RevCard>
          <RevCard><div style={{ fontSize: 10, color: 'var(--color-text-tertiary)', textTransform: 'uppercase', letterSpacing: '.04em', marginBottom: 3 }}>Deposits collected</div><div style={{ fontSize: 22, fontWeight: 500, color: 'var(--color-text-warning)' }}>₹{deposits}</div><div style={{ fontSize: 10, color: 'var(--color-text-tertiary)', marginTop: 2 }}>Jar deposits</div></RevCard>
          <RevCard><div style={{ fontSize: 10, color: 'var(--color-text-tertiary)', textTransform: 'uppercase', letterSpacing: '.04em', marginBottom: 3 }}>Fast delivery fees</div><div style={{ fontSize: 22, fontWeight: 500, color: 'var(--color-text-info)' }}>₹{fastFees}</div><div style={{ fontSize: 10, color: 'var(--color-text-tertiary)', marginTop: 2 }}>{del.filter(o => o.fastDelivery).length} fast orders</div></RevCard>
          <RevCard><div style={{ fontSize: 10, color: 'var(--color-text-tertiary)', textTransform: 'uppercase', letterSpacing: '.04em', marginBottom: 3 }}>Avg order value</div><div style={{ fontSize: 22, fontWeight: 500 }}>₹{del.length ? Math.round(rev / del.length) : 0}</div><div style={{ fontSize: 10, color: 'var(--color-text-tertiary)', marginTop: 2 }}>Delivered orders</div></RevCard>
          <RevCard><div style={{ fontSize: 10, color: 'var(--color-text-tertiary)', textTransform: 'uppercase', letterSpacing: '.04em', marginBottom: 3 }}>Net revenue</div><div style={{ fontSize: 22, fontWeight: 500, color: 'var(--color-text-success)' }}>₹{rev - discounts}</div><div style={{ fontSize: 10, color: 'var(--color-text-tertiary)', marginTop: 2 }}>After discounts</div></RevCard>
        </RevGrid>
        <SectionTitle>Revenue by payment method</SectionTitle>
        <Bar label="Wallet" val={walletRev} total={rev} color="#085041" suffix={`₹${walletRev}`} />
        <Bar label="UPI"    val={upiRev}    total={rev} color="#3C3489" suffix={`₹${upiRev}`} />
        <Bar label="Cash"   val={cashRev}   total={rev} color="#633806" suffix={`₹${cashRev}`} />
      </>
    );
  };

  const renderWallet = () => (
    <>
      <Metrics $cols={3}>
        <Metric><ML>Wallet balance</ML><MV $color="var(--color-text-success)">₹{selected?.wallet_balance ?? 0}</MV></Metric>
        <Metric><ML>Jars with customer</ML><MV>{selected?.jars_occupied ?? 0}</MV></Metric>
        <Metric><ML>Jar deposit</ML><MV $color="var(--color-text-warning)">₹200</MV></Metric>
      </Metrics>
      <SectionTitle>Manual wallet adjustment</SectionTitle>
      <WalletAdj>
        <AdjRow>
          <span>Type</span>
          <AdjSelect value={adjType} onChange={e => setAdjType(e.target.value)}><option>Credit</option><option>Debit</option></AdjSelect>
          <span>Amount (₹)</span>
          <AdjInput type="number" placeholder="0" style={{ width: 80 }} value={adjAmt} onChange={e => setAdjAmt(e.target.value)} />
          <span>Reason</span>
          <AdjInput placeholder="e.g. Referral reward" style={{ flex: 1, minWidth: 120 }} value={adjReason} onChange={e => setAdjReason(e.target.value)} />
        </AdjRow>
        <BtnPrimary onClick={handleWalletAdj} disabled={saving}>Apply &amp; log to transactions</BtnPrimary>
      </WalletAdj>
      <SectionTitle>Jar management</SectionTitle>
      <WalletAdj>
        <AdjRow>
          <span>Jars with customer</span>
          <AdjInput type="number" style={{ width: 70 }} value={jarCount} onChange={e => setJarCount(e.target.value)} />
          <span>Reason</span>
          <AdjInput placeholder="e.g. Manual correction" style={{ flex: 1, minWidth: 120 }} value={jarReason} onChange={e => setJarReason(e.target.value)} />
        </AdjRow>
        <BtnPrimary onClick={handleJarCorrection} disabled={saving}>Save jar correction &amp; audit log</BtnPrimary>
      </WalletAdj>
    </>
  );

  const renderAddressModal = () => {
    if (!isAddrModalOpen) return null;
    return (
      <ModalBackdrop onClick={() => setIsAddrModalOpen(false)}>
        <ModalContainer onClick={e => e.stopPropagation()} style={{ maxWidth: 520, maxHeight: '90vh', overflowY: 'auto' }}>
          <ModalHead>
            <ModalTitle>{editingAddress ? 'Edit Address' : 'Add New Address'}</ModalTitle>
            <CloseBtn onClick={() => { setIsAddrModalOpen(false); setEditingAddress(null); }}>&times;</CloseBtn>
          </ModalHead>
          <ModalBody>
            {/* Plus Code — critical for pinpoint delivery */}
            <div style={{ background: 'linear-gradient(135deg, #E3F2FD, #EDE7F6)', borderRadius: 10, padding: '10px 14px', marginBottom: 14, border: '1.5px solid #90CAF9' }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: '#1565C0', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 6 }}>📍 Plus Code — Required for Pinpoint Delivery</div>
              <input
                value={addrForm.plus_code || ''}
                onChange={e => setAddrForm(p => ({ ...p, plus_code: e.target.value }))}
                placeholder="e.g. RWMW+5Q Kolkata" 
                style={{ width: '100%', padding: '8px 12px', fontSize: 13, fontFamily: 'monospace', fontWeight: 600, border: '1.5px solid #90CAF9', borderRadius: 8, background: 'white', color: '#1565C0', boxSizing: 'border-box' }}
              />
              <div style={{ fontSize: 10, color: '#1976D2', marginTop: 5 }}>Find at maps.google.com → right-click location → copy plus code</div>
            </div>

            {/* Address type + full line */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
              <ProfileField style={{ gridColumn: 'span 2' }}>
                <label>Address Type</label>
                <select value={addrForm.address_type || 'Home'} onChange={e => setAddrForm(p => ({ ...p, address_type: e.target.value }))}>
                  <option>Home</option>
                  <option>Work</option>
                  <option>Other</option>
                </select>
              </ProfileField>
              <ProfileField style={{ gridColumn: 'span 2' }}>
                <label>Full Address Line *</label>
                <input value={addrForm.address_line || ''} onChange={e => setAddrForm(p => ({ ...p, address_line: e.target.value }))} placeholder="e.g. 402 Block B, Lake Road, Near Park, Kolkata 700006" />
              </ProfileField>

              {/* House / flat details — matches iOS AddressModal.jsx fields */}
              <ProfileField>
                <label>House / Flat / Block No.</label>
                <input value={addrForm.house_no || ''} onChange={e => setAddrForm(p => ({ ...p, house_no: e.target.value }))} placeholder="e.g. 402, Block B" />
              </ProfileField>
              <ProfileField>
                <label>Floor No.</label>
                <input value={addrForm.floor_no || ''} onChange={e => setAddrForm(p => ({ ...p, floor_no: e.target.value }))} placeholder="e.g. 3 or G" />
              </ProfileField>
              <ProfileField>
                <label>Landmark (optional)</label>
                <input value={addrForm.landmark || ''} onChange={e => setAddrForm(p => ({ ...p, landmark: e.target.value }))} placeholder="e.g. Near Central Park" />
              </ProfileField>
              <ProfileField>
                <label>Lift Available?</label>
                <select value={addrForm.lift_available || ''} onChange={e => setAddrForm(p => ({ ...p, lift_available: e.target.value || null }))}>
                  <option value="">Not applicable</option>
                  <option value="Yes">Yes</option>
                  <option value="No">No</option>
                </select>
              </ProfileField>
            </div>

            {/* Toggles */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 12px', border: '0.5px solid var(--color-border-secondary)', borderRadius: 8, marginBottom: 8 }}>
              <span style={{ fontSize: 12, color: 'var(--color-text-primary)' }}>🐾 Be aware of dogs</span>
              <input type="checkbox" checked={!!addrForm.be_aware_of_dogs} onChange={e => setAddrForm(p => ({ ...p, be_aware_of_dogs: e.target.checked }))} style={{ width: 16, height: 16, cursor: 'pointer' }} />
            </div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 12px', border: '0.5px solid var(--color-border-secondary)', borderRadius: 8, marginBottom: 14 }}>
              <span style={{ fontSize: 12, color: 'var(--color-text-primary)' }}>⭐ Set as default delivery address</span>
              <input type="checkbox" checked={!!addrForm.isDefault} onChange={e => setAddrForm(p => ({ ...p, isDefault: e.target.checked }))} style={{ width: 16, height: 16, cursor: 'pointer' }} />
            </div>

            <div style={{ display: 'flex', gap: 8 }}>
              <BtnPrimary style={{ flex: 1 }} onClick={handleAddressSave} disabled={saving}>
                {saving ? 'Saving...' : (editingAddress ? 'Update' : 'Add')} Address
              </BtnPrimary>
              <BtnSec onClick={() => { setIsAddrModalOpen(false); setEditingAddress(null); }}>Cancel</BtnSec>
            </div>
          </ModalBody>
        </ModalContainer>
      </ModalBackdrop>
    );
  };

  const tabContent: Record<TabId, React.ReactNode> = {
    overview:     renderOverview(),
    profile:      renderProfile(),
    orders:       renderOrders(),
    transactions: renderTransactions(),
    revenue:      renderRevenue(),
    wallet:       renderWallet(),
  };

  const statusVariant = (s?: string | boolean) => {
    if (s === 'Verified' || s === true) return 'success';
    if (s === 'Blocked') return 'danger';
    return 'warning';
  };

  return (
    <>
      <Wrap>
        {/* ── Sidebar ── */}
        <Sidebar>
          <SideHead>
            <SHeadLabel>Customers</SHeadLabel>
            <Search>
              <FiSearch />
              <SearchInput placeholder="Search…" value={search} onChange={e => setSearch(e.target.value)} />
            </Search>
          </SideHead>
          <UserList>
            {filteredUsers.map(u => {
              const p = palette(u.customerId || u.id);
              const name = dName(u);
              return (
                <UserRow key={u.id} $active={selected?.id === u.id} onClick={() => setSelected(u)}>
                  <Avatar $bg={p.bg} $tc={p.tc}>{initials(name)}</Avatar>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <UName $active={selected?.id === u.id}>{name}</UName>
                    <UID>{u.customerId || u.id}</UID>
                  </div>
                  <button
                    title="Permanently delete user"
                    onClick={e => { e.stopPropagation(); handleDeleteUser(u); }}
                    style={{
                      background: 'none', border: 'none', cursor: 'pointer', padding: '4px',
                      color: 'var(--color-text-tertiary)', borderRadius: 4, flexShrink: 0,
                      opacity: 0, transition: 'opacity 0.15s',
                    }}
                    onMouseEnter={e => (e.currentTarget.style.opacity = '1')}
                    onMouseLeave={e => (e.currentTarget.style.opacity = '0')}
                  >
                    <FiTrash2 size={12} color="var(--color-text-danger)" />
                  </button>
                </UserRow>
              );
            })}
            {filteredUsers.length === 0 && <EmptyState>No users found</EmptyState>}
          </UserList>
        </Sidebar>

        {/* ── Main Panel ── */}
        <Main id="admin-main-panel">
          {fleetMode ? renderFleetView() : selected ? (

            <>
              {/* Header */}
              <MainHead>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <Avatar $bg={selPalette.bg} $tc={selPalette.tc} $size={36}>
                    {initials(dName(selected))}
                  </Avatar>
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 600 }}>{dName(selected)}</div>
                    <div style={{ fontSize: 11, color: 'var(--color-text-tertiary)' }}>
                      {selected.customerId} · Joined {fmt(selected.createdAt)}
                    </div>
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                  <Badge $variant={statusVariant(selected.status || selected.isActive)}>
                    {selected.status || (selected.isActive ? 'Active' : 'Inactive')}
                  </Badge>
                  <div style={{ display: 'flex', gap: 4 }}>
                    <BtnXS $variant="info" as="a" href={`tel:${selected?.phoneNumber || selected?.phone}`} style={{ textDecoration: 'none', width: '32px', padding: 0, justifyContent: 'center' }} title="Call Customer">
                      <FiPhoneCall size={14} />
                    </BtnXS>
                    <BtnXS $variant="success" as="a" href={`https://wa.me/${(selected?.phoneNumber || selected?.phone || '').replace(/\D/g, '')}`} target="_blank" style={{ textDecoration: 'none', background: '#25D366', color: 'white', borderColor: '#25D366', width: '32px', padding: 0, justifyContent: 'center' }} title="WhatsApp">
                      <FiMessageCircle size={14} /> 
                    </BtnXS>
                  </div>
                  <CopyBtn onClick={() => { navigator.clipboard.writeText(selected.customerId); showToast('ID copied'); }}>
                    <FiCopy size={11} />
                  </CopyBtn>
                  <BtnXS $variant="danger" onClick={() => showToast('Account suspended')}>
                    <FiSlash size={11} /> Suspend
                  </BtnXS>
                  <BtnXS $variant="info" onClick={() => showToast('FCM message sent')}>
                    <FiBell size={11} /> FCM
                  </BtnXS>
                  <BtnXS 
                    $variant={fleetMode ? 'info' : undefined}
                    onClick={() => setFleetMode(!fleetMode)}
                    style={{ background: fleetMode ? 'var(--color-background-info)' : 'transparent', fontWeight: 700 }}
                  >
                    {fleetMode ? 'Exit Fleet' : 'Fleet Mode'}
                  </BtnXS>
                </div>
              </MainHead>


              {/* Tabs */}
              <TabBar>
                {(['overview', 'profile', 'orders', 'transactions', 'revenue', 'wallet'] as TabId[]).map(t => (
                  <Tab key={t} $active={tab === t} onClick={() => setTab(t)}>
                    {t === 'overview' ? 'Overview' :
                     t === 'profile'  ? 'Profile & Addresses' :
                     t === 'orders'   ? 'Orders' :
                     t === 'transactions' ? 'Transactions' :
                     t === 'revenue'  ? 'Revenue' : 'Wallet & Jars'}
                  </Tab>
                ))}
              </TabBar>

              {/* Tab body */}
              <TabBody key={`${selected.id}-${tab}`}>
                {tabContent[tab]}
              </TabBody>
            </>
          ) : (
            <EmptyState style={{ margin: 'auto' }}>
              <FiSearch size={32} style={{ opacity: 0.3, marginBottom: 12 }} />
              <p style={{ marginBottom: '16px' }}>Select a customer from the sidebar</p>
              <BtnXS 
                $variant="info"
                onClick={() => setFleetMode(true)}
                style={{ margin: '0 auto', padding: '8px 20px', fontWeight: 700 }}
              >
                Launch Fleet Board
              </BtnXS>
            </EmptyState>

          )}
        </Main>
      </Wrap>

      <ScrollToTop $show={showToTop} onClick={scrollToTop} title="Scroll to top">
        <FiChevronUp size={24} />
      </ScrollToTop>


      <Toast $show={toastShow}>{toast}</Toast>
      {renderAddressModal()}
    </>
  );
}