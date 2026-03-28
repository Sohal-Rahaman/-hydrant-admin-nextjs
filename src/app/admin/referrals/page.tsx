'use client';

import React, { useState, useEffect } from 'react';
import styled from 'styled-components';
import { motion, AnimatePresence } from 'framer-motion';
import {
  FiGift, FiSearch, FiChevronDown, FiChevronUp,
  FiCheck, FiClock, FiX, FiUser
} from 'react-icons/fi';
import { subscribeToCollection } from '@/lib/firebase';
import { where, orderBy } from 'firebase/firestore';

// --- Types ---
interface Referral {
  id: string;
  referrerId: string;
  refereeId: string;
  refereeCustomerId: string;
  refereeName: string;
  referrerName?: string;
  status: 'pending' | 'processing' | 'rewarded' | 'expired';
  codeUsed: string;
  downloadedAt: { toDate(): Date } | Date | null;
  firstOrderId: string | null;
  firstOrderPlacedAt?: { toDate(): Date } | Date | null;
  deliveredAt: { toDate(): Date } | Date | null;
  creditedAt: { toDate(): Date } | Date | null;
  rewardAmount: number;
}

// --- Helpers ---
const fmt = (d: { toDate(): Date } | Date | null | undefined) => {
  if (!d) return '—';
  const date = 'toDate' in d ? d.toDate() : d;
  return date.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
};

const STATUS_CONFIG = {
  pending:    { label: 'Pending',       bg: 'var(--color-background-warning)', color: 'var(--color-text-warning)' },
  processing: { label: 'In processing', bg: 'var(--color-background-warning)', color: 'var(--color-text-warning)' },
  rewarded:   { label: 'Rewarded',      bg: 'var(--color-background-success)', color: 'var(--color-text-success)' },
  expired:    { label: 'Expired',        bg: 'var(--color-background-danger)',  color: 'var(--color-text-danger)'  },
};

// --- Styled Components ---
const Page = styled.div`
  padding: 28px 32px;
  max-width: 1280px;
  margin: 0 auto;
`;

const PageHeader = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 28px;
  flex-wrap: wrap;
  gap: 16px;
`;

const TitleRow = styled.div`
  display: flex;
  align-items: center;
  gap: 12px;
`;

const Title = styled.h1`
  font-size: 1.6rem;
  font-weight: 700;
  color: var(--color-text-primary);
  margin: 0;
  display: flex;
  align-items: center;
  gap: 10px;
`;

const Subtitle = styled.p`
  font-size: 0.85rem;
  color: var(--color-text-tertiary);
  margin: 2px 0 0;
`;

const MetricsGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(5, 1fr);
  gap: 12px;
  margin-bottom: 24px;

  @media (max-width: 900px) {
    grid-template-columns: repeat(3, 1fr);
  }
`;

const MetricCard = styled.div<{ $accent?: string }>`
  background: var(--color-background-secondary);
  border: 0.5px solid var(--color-border-tertiary);
  border-radius: 12px;
  padding: 16px 18px;
`;

const MetricLabel = styled.div`
  font-size: 10px;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--color-text-tertiary);
  margin-bottom: 4px;
`;

const MetricValue = styled.div<{ $color?: string }>`
  font-size: 26px;
  font-weight: 600;
  color: ${p => p.$color ?? 'var(--color-text-primary)'};
`;

const MetricSub = styled.div`
  font-size: 11px;
  color: var(--color-text-tertiary);
  margin-top: 2px;
`;

const FilterBar = styled.div`
  display: flex;
  gap: 10px;
  align-items: center;
  flex-wrap: wrap;
  margin-bottom: 18px;
`;

const FilterSelect = styled.select`
  padding: 7px 10px;
  font-size: 12px;
  border: 0.5px solid var(--color-border-secondary);
  border-radius: 8px;
  background: var(--color-background-secondary);
  color: var(--color-text-primary);
  cursor: pointer;
`;

const SearchWrapper = styled.div`
  position: relative;
  display: flex;
  align-items: center;
`;

const SearchInput = styled.input`
  padding: 7px 10px 7px 32px;
  font-size: 12px;
  border: 0.5px solid var(--color-border-secondary);
  border-radius: 8px;
  background: var(--color-background-secondary);
  color: var(--color-text-primary);
  width: 200px;
  &:focus { outline: none; border-color: var(--color-border-info); }
`;

const SearchIcon = styled(FiSearch)`
  position: absolute;
  left: 9px;
  color: var(--color-text-tertiary);
  font-size: 13px;
`;

const ReferralList = styled.div`
  display: flex;
  flex-direction: column;
  gap: 10px;
`;

const ReferralCard = styled(motion.div)`
  background: var(--color-background-primary);
  border: 0.5px solid var(--color-border-tertiary);
  border-radius: 12px;
  overflow: hidden;
`;

const ReferralCardHead = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 14px 18px;
  cursor: pointer;
  gap: 12px;

  &:hover { background: var(--color-background-secondary); }
`;

const AvatarCircle = styled.div<{ $bg: string; $color: string }>`
  width: 34px;
  height: 34px;
  border-radius: 50%;
  background: ${p => p.$bg};
  color: ${p => p.$color};
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 12px;
  font-weight: 600;
  flex-shrink: 0;
`;

const RefereeInfo = styled.div`
  flex: 1;
`;

const RefereeName = styled.div`
  font-size: 13px;
  font-weight: 600;
  color: var(--color-text-primary);
`;

const RefereeSubtitle = styled.div`
  font-size: 11px;
  color: var(--color-text-tertiary);
  margin-top: 1px;
`;

const StatusBadge = styled.span<{ $bg: string; $color: string }>`
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 4px 10px;
  border-radius: 20px;
  font-size: 11px;
  font-weight: 500;
  background: ${p => p.$bg};
  color: ${p => p.$color};
  white-space: nowrap;
`;

const PulseDot = styled.span<{ $color: string }>`
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: ${p => p.$color};
  animation: pulse 1.5s infinite;

  @keyframes pulse {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.3; }
  }
`;

const ExpandIcon = styled.div`
  color: var(--color-text-tertiary);
  font-size: 14px;
`;

const ReferralBody = styled(motion.div)`
  border-top: 0.5px solid var(--color-border-tertiary);
  padding: 18px;
`;

const JourneyLabel = styled.div`
  font-size: 10px;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: var(--color-text-tertiary);
  margin-bottom: 16px;
  font-weight: 600;
`;

const JourneyTrack = styled.div`
  display: flex;
  align-items: flex-start;
  gap: 0;
  margin-bottom: 20px;
`;

const JourneyStep = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  flex: 1;
`;

const StepCircle = styled.div<{ $done?: boolean; $active?: boolean }>`
  width: 36px;
  height: 36px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 14px;
  border: 2px solid ${p =>
    p.$done ? 'var(--color-text-success)' :
    p.$active ? 'var(--color-text-warning)' :
    'var(--color-border-tertiary)'};
  background: ${p =>
    p.$done ? 'var(--color-background-success)' :
    p.$active ? 'var(--color-background-warning)' :
    'var(--color-background-secondary)'};
  color: ${p =>
    p.$done ? 'var(--color-text-success)' :
    p.$active ? 'var(--color-text-warning)' :
    'var(--color-text-tertiary)'};
  flex-shrink: 0;
`;

const StepConnector = styled.div<{ $done?: boolean }>`
  height: 2px;
  flex: 1;
  margin-top: 17px;
  background: ${p => p.$done ? 'var(--color-text-success)' : 'var(--color-border-tertiary)'};
  align-self: flex-start;
`;

const StepLabel = styled.div`
  font-size: 10px;
  text-align: center;
  color: var(--color-text-secondary);
  margin-top: 6px;
  line-height: 1.3;
`;

const StepDate = styled.div`
  font-size: 10px;
  text-align: center;
  color: var(--color-text-tertiary);
  margin-top: 2px;
`;

const DetailGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 12px;
  margin-top: 4px;
`;

const DetailItem = styled.div``;

const DL = styled.div`
  font-size: 11px;
  color: var(--color-text-tertiary);
  margin-bottom: 2px;
`;

const DV = styled.div<{ $color?: string }>`
  font-size: 13px;
  font-weight: 500;
  color: ${p => p.$color ?? 'var(--color-text-primary)'};
`;

const InfoBanner = styled.div<{ $status: string }>`
  margin-top: 14px;
  padding: 10px 14px;
  border-radius: 8px;
  font-size: 12px;
  line-height: 1.5;
  background: ${p =>
    p.$status === 'rewarded' ? 'var(--color-background-success)' :
    p.$status === 'expired'  ? 'var(--color-background-danger)' :
    p.$status === 'processing' ? 'var(--color-background-warning)' :
    'var(--color-background-info)'};
  color: ${p =>
    p.$status === 'rewarded' ? 'var(--color-text-success)' :
    p.$status === 'expired'  ? 'var(--color-text-danger)' :
    p.$status === 'processing' ? 'var(--color-text-warning)' :
    'var(--color-text-info)'};
  border-left: 3px solid currentColor;
`;

const EmptyState = styled.div`
  text-align: center;
  padding: 60px 20px;
  color: var(--color-text-tertiary);
  font-size: 14px;
`;

// --- Helpers ---
const initials = (name: string) => name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();
const avatarColors = [
  { bg: '#E6F1FB', color: '#185FA5' },
  { bg: '#E1F5EE', color: '#0F6E56' },
  { bg: '#FAEEDA', color: '#854F0B' },
  { bg: '#FBEAF0', color: '#993556' },
  { bg: '#EEEDFE', color: '#3C3489' },
];
const avatarColor = (name: string) => avatarColors[name.charCodeAt(0) % avatarColors.length];

const statusInfo = (referral: Referral) => {
  const map: Record<string, string> = {
    pending: `Waiting for ${referral.refereeName}'s first order. Referral expires in 30 days.`,
    processing: `Order ${referral.firstOrderId} is placed and awaiting delivery. The ₹${referral.rewardAmount} reward will be credited automatically once the army agent confirms delivery.`,
    rewarded: `₹${referral.rewardAmount} has been credited to your wallet. Referral complete!`,
    expired: `Referral expired — no order was placed within 30 days.`,
  };
  return map[referral.status] ?? '';
};

// --- Component ---
const SAMPLE_REFERRALS: Referral[] = [
  {
    id: 'ref-001', referrerId: 'HYDRA-1024', refereeId: 'uid-sneha', refereeCustomerId: 'HYDRA-1201',
    refereeName: 'Sneha Roy', referrerName: 'Arindam Ghosh', status: 'processing',
    codeUsed: 'HYDRA-AG24', rewardAmount: 37,
    downloadedAt: new Date('2025-03-20'), firstOrderId: 'HYD-4815',
    firstOrderPlacedAt: new Date('2025-03-23'), deliveredAt: null, creditedAt: null,
  },
  {
    id: 'ref-002', referrerId: 'HYDRA-1024', refereeId: 'uid-ritu', refereeCustomerId: 'HYDRA-1138',
    refereeName: 'Rajesh Bose', referrerName: 'Arindam Ghosh', status: 'rewarded',
    codeUsed: 'HYDRA-AG24', rewardAmount: 37,
    downloadedAt: new Date('2025-03-10'), firstOrderId: 'HYD-4300',
    firstOrderPlacedAt: new Date('2025-03-13'), deliveredAt: new Date('2025-03-15'), creditedAt: new Date('2025-03-15'),
  },
  {
    id: 'ref-003', referrerId: 'HYDRA-1024', refereeId: 'uid-sub', refereeCustomerId: 'HYDRA-1299',
    refereeName: 'Subhro Pal', referrerName: 'Arindam Ghosh', status: 'expired',
    codeUsed: 'HYDRA-AG24', rewardAmount: 37,
    downloadedAt: new Date('2025-02-01'), firstOrderId: null,
    firstOrderPlacedAt: null, deliveredAt: null, creditedAt: null,
  },
  {
    id: 'ref-004', referrerId: 'HYDRA-0311', refereeId: 'uid-priya', refereeCustomerId: 'HYDRA-0892',
    refereeName: 'Priya Sen', referrerName: 'Debjani Mitra', status: 'rewarded',
    codeUsed: 'HYDRA-DM11', rewardAmount: 37,
    downloadedAt: new Date('2025-02-03'), firstOrderId: 'HYD-4790',
    firstOrderPlacedAt: new Date('2025-02-05'), deliveredAt: new Date('2025-02-06'), creditedAt: new Date('2025-02-06'),
  },
  {
    id: 'ref-005', referrerId: 'HYDRA-1024', refereeId: 'uid-meera', refereeCustomerId: 'HYDRA-1350',
    refereeName: 'Meera Iyer', referrerName: 'Arindam Ghosh', status: 'pending',
    codeUsed: 'HYDRA-AG24', rewardAmount: 37,
    downloadedAt: new Date('2025-03-25'), firstOrderId: null,
    firstOrderPlacedAt: null, deliveredAt: null, creditedAt: null,
  },
];

export default function ReferralsPage() {
  const [referrals, setReferrals] = useState<Referral[]>(SAMPLE_REFERRALS);
  const [statusFilter, setStatusFilter] = useState('');
  const [search, setSearch] = useState('');
  const [expanded, setExpanded] = useState<string | null>(null);

  // Live Firestore subscription
  useEffect(() => {
    const constraints = [];
    if (statusFilter) constraints.push(where('status', '==', statusFilter));

    const unsub = subscribeToCollection(
      'referrals',
      (snap) => {
        const docs = snap.docs.map(d => ({ id: d.id, ...d.data() } as Referral));
        if (docs.length > 0) setReferrals(docs);
      },
      constraints
    );
    return () => unsub();
  }, [statusFilter]);

  const filtered = referrals.filter(r => {
    const q = search.toLowerCase();
    return !q ||
      r.refereeName.toLowerCase().includes(q) ||
      r.refereeCustomerId.toLowerCase().includes(q) ||
      r.referrerId.toLowerCase().includes(q) ||
      r.codeUsed.toLowerCase().includes(q);
  });

  const total     = referrals.length;
  const rewarded  = referrals.filter(r => r.status === 'rewarded').length;
  const inProcess = referrals.filter(r => r.status === 'processing').length;
  const pending   = referrals.filter(r => r.status === 'pending').length;
  const expired   = referrals.filter(r => r.status === 'expired').length;
  const walletOut = rewarded * 37;

  const toggle = (id: string) => setExpanded(expanded === id ? null : id);

  const getStepState = (ref: Referral) => ({
    downloaded: true,
    firstOrder: ref.status !== 'pending',
    delivered:  ref.status === 'rewarded',
    credited:   ref.status === 'rewarded',
  });

  return (
    <Page>
      <PageHeader>
        <div>
          <Title><FiGift /> Referrals</Title>
          <Subtitle>Track every referral from download to reward.</Subtitle>
        </div>
      </PageHeader>

      {/* Metrics */}
      <MetricsGrid>
        <MetricCard>
          <MetricLabel>Total referred</MetricLabel>
          <MetricValue>{total}</MetricValue>
          <MetricSub>All time</MetricSub>
        </MetricCard>
        <MetricCard>
          <MetricLabel>Rewarded</MetricLabel>
          <MetricValue $color="var(--color-text-success)">{rewarded}</MetricValue>
          <MetricSub>₹37 each</MetricSub>
        </MetricCard>
        <MetricCard>
          <MetricLabel>In processing</MetricLabel>
          <MetricValue $color="var(--color-text-warning)">{inProcess}</MetricValue>
          <MetricSub>Awaiting delivery</MetricSub>
        </MetricCard>
        <MetricCard>
          <MetricLabel>Pending</MetricLabel>
          <MetricValue>{pending}</MetricValue>
          <MetricSub>No order yet</MetricSub>
        </MetricCard>
        <MetricCard>
          <MetricLabel>Wallet credited</MetricLabel>
          <MetricValue $color="var(--color-text-success)">₹{walletOut}</MetricValue>
          <MetricSub>{rewarded} rewards fired</MetricSub>
        </MetricCard>
      </MetricsGrid>

      {/* Filters */}
      <FilterBar>
        <SearchWrapper>
          <SearchIcon />
          <SearchInput
            placeholder="Search referee, referrer, code..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </SearchWrapper>
        <FilterSelect value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
          <option value="">All statuses</option>
          <option value="pending">Pending</option>
          <option value="processing">In processing</option>
          <option value="rewarded">Rewarded</option>
          <option value="expired">Expired</option>
        </FilterSelect>
      </FilterBar>

      {/* List */}
      <ReferralList>
        {filtered.length === 0 && <EmptyState>No referrals found.</EmptyState>}
        {filtered.map(ref => {
          const cfg = STATUS_CONFIG[ref.status];
          const av  = avatarColor(ref.refereeName);
          const isOpen = expanded === ref.id;
          const steps = getStepState(ref);

          return (
            <ReferralCard key={ref.id} layout>
              <ReferralCardHead onClick={() => toggle(ref.id)}>
                <AvatarCircle $bg={av.bg} $color={av.color}>
                  {initials(ref.refereeName)}
                </AvatarCircle>

                <RefereeInfo>
                  <RefereeName>{ref.refereeName}</RefereeName>
                  <RefereeSubtitle>
                    {ref.refereeCustomerId} · Referred by {ref.referrerName ?? ref.referrerId} · Downloaded {fmt(ref.downloadedAt)}
                  </RefereeSubtitle>
                </RefereeInfo>

                <StatusBadge $bg={cfg.bg} $color={cfg.color}>
                  {(ref.status === 'processing') && <PulseDot $color={cfg.color} />}
                  {cfg.label}
                </StatusBadge>

                <ExpandIcon>{isOpen ? <FiChevronUp /> : <FiChevronDown />}</ExpandIcon>
              </ReferralCardHead>

              <AnimatePresence>
                {isOpen && (
                  <ReferralBody
                    key="body"
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.2 }}
                  >
                    <JourneyLabel>Referral Journey</JourneyLabel>

                    {/* 4-step timeline */}
                    <JourneyTrack>
                      {/* Step 1: Downloaded */}
                      <JourneyStep>
                        <StepCircle $done={steps.downloaded}>
                          {steps.downloaded ? <FiCheck size={14} /> : <FiUser size={13} />}
                        </StepCircle>
                        <StepLabel>App downloaded</StepLabel>
                        <StepDate>{fmt(ref.downloadedAt)}</StepDate>
                      </JourneyStep>

                      <StepConnector $done={steps.firstOrder} />

                      {/* Step 2: First order */}
                      <JourneyStep>
                        <StepCircle $done={steps.firstOrder} $active={steps.firstOrder && !steps.delivered}>
                          {steps.firstOrder
                            ? <FiCheck size={14} />
                            : <FiClock size={13} />}
                        </StepCircle>
                        <StepLabel>First order placed</StepLabel>
                        <StepDate>{fmt(ref.firstOrderPlacedAt)}</StepDate>
                      </JourneyStep>

                      <StepConnector $done={steps.delivered} />

                      {/* Step 3: Delivered */}
                      <JourneyStep>
                        <StepCircle $done={steps.delivered} $active={steps.firstOrder && !steps.delivered}>
                          {steps.delivered
                            ? <FiCheck size={14} />
                            : steps.firstOrder
                              ? <span style={{ fontSize: 10 }}>···</span>
                              : <FiClock size={13} />}
                        </StepCircle>
                        <StepLabel>Order delivered</StepLabel>
                        <StepDate>{fmt(ref.deliveredAt)}</StepDate>
                      </JourneyStep>

                      <StepConnector $done={steps.credited} />

                      {/* Step 4: Credited */}
                      <JourneyStep>
                        <StepCircle $done={steps.credited}>
                          {steps.credited ? <FiCheck size={14} /> : <FiClock size={13} />}
                        </StepCircle>
                        <StepLabel>₹{ref.rewardAmount} credited</StepLabel>
                        <StepDate>{fmt(ref.creditedAt)}</StepDate>
                      </JourneyStep>
                    </JourneyTrack>

                    {/* Detail grid */}
                    <DetailGrid>
                      <DetailItem>
                        <DL>Order placed</DL>
                        <DV>{ref.firstOrderId ?? '—'}</DV>
                      </DetailItem>
                      <DetailItem>
                        <DL>Delivery confirmed</DL>
                        <DV>{ref.status === 'processing' ? 'Pending' : ref.status === 'rewarded' ? fmt(ref.deliveredAt) : '—'}</DV>
                      </DetailItem>
                      <DetailItem>
                        <DL>Reward amount</DL>
                        <DV $color="var(--color-text-success)">₹{ref.rewardAmount}</DV>
                      </DetailItem>
                      <DetailItem>
                        <DL>Referral code</DL>
                        <DV style={{ fontFamily: 'monospace' }}>{ref.codeUsed}</DV>
                      </DetailItem>
                      <DetailItem>
                        <DL>Credit date</DL>
                        <DV>{fmt(ref.creditedAt)}</DV>
                      </DetailItem>
                      <DetailItem>
                        <DL>Status note</DL>
                        <DV style={{ fontSize: 12, color: 'var(--color-text-secondary)' }}>
                          {ref.status === 'processing' ? 'First order placed. Waiting for delivery.' :
                           ref.status === 'rewarded'   ? 'Fully rewarded.' :
                           ref.status === 'expired'    ? 'Expired — no order in 30 days.' :
                           'Waiting for first order.'}
                        </DV>
                      </DetailItem>
                    </DetailGrid>

                    {/* Banner */}
                    <InfoBanner $status={ref.status}>
                      {statusInfo(ref)}
                    </InfoBanner>
                  </ReferralBody>
                )}
              </AnimatePresence>
            </ReferralCard>
          );
        })}
      </ReferralList>
    </Page>
  );
}
