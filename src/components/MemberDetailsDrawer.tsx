'use client';

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  FiX, FiPhone, FiMessageCircle, FiBox, FiDollarSign, 
  FiClock, FiUser, FiActivity, FiArrowRight, 
  FiShield, FiInfo, FiTrendingUp, FiAlertCircle 
} from 'react-icons/fi';
import { updateDocument, Jar, subscribeToCollection, adminManualEnrollPro } from '@/lib/firebase';
import { where } from 'firebase/firestore';

interface MemberDetailsDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  member: any; // MergedMember type
  onRefresh?: () => void;
}

const formatDateSafe = (dateVal: any) => {
  if (!dateVal) return 'N/A';
  const ts = typeof dateVal === 'number' ? dateVal : 
             typeof dateVal === 'string' ? new Date(dateVal).getTime() : 
             dateVal.toDate ? dateVal.toDate().getTime() : 
             dateVal instanceof Date ? dateVal.getTime() : 0;
  if (!ts) return 'N/A';
  return new Date(ts).toLocaleDateString('en-IN', { 
    day: '2-digit', 
    month: 'short', 
    year: 'numeric' 
  });
};

const PRO_PLANS = {
  lite: { id: 'lite', name: 'Standard', maxJars: 7 },
  pro: { id: 'pro', name: 'Smart', maxJars: 15 },
  proMax: { id: 'proMax', name: 'Unlimited', maxJars: 999999 }
};

export default function MemberDetailsDrawer({ isOpen, onClose, member }: MemberDetailsDrawerProps) {
  const [heldJars, setHeldJars] = useState<Jar[]>([]);
  const [isEnrolling, setIsEnrolling] = useState(false);
  const [enrollStatus, setEnrollStatus] = useState<'idle'|'success'|'error'>('idle');
  const [selectedPlan, setSelectedPlan] = useState('pro');
  const [activeTab, setActiveTab] = useState<'overview' | 'history'>('overview');
  const [activityLogs, setActivityLogs] = useState<any[]>([]);
  const [isChangingPlan, setIsChangingPlan] = useState(false);

  useEffect(() => {
    if (member?.userId && isOpen) {
      // 1. Subscribe to Jars
      const unsubJars = subscribeToCollection('jars', (snapshot) => {
        const jarsData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Jar));
        setHeldJars(jarsData);
      }, [where('currentOwnerId', '==', member.userId)]);

      // 2. Subscribe to Activity Logs
      const unsubLogs = subscribeToCollection('pro_activity_logs', (snapshot) => {
        const logs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        // Sort by timestamp desc
        setActivityLogs(logs.sort((a: any, b: any) => (b.timestamp?.seconds || 0) - (a.timestamp?.seconds || 0)));
      }, [where('userId', '==', member.userId)]);
      
      return () => { unsubJars(); unsubLogs(); };
    }
  }, [member, isOpen]);

  if (!member) return null;

  const user = member.user || {};
  const name = user.full_name || user.name || 'ANONYMOUS_ENTITY';
  const phone = user.phone || 'NO_PHONE';
  const waPhone = phone.replace(/[^\d]/g, '').startsWith('91') ? phone.replace(/[^\d]/g, '') : '91' + phone.replace(/[^\d]/g, '');

  const handleManualEnroll = async () => {
    if (!confirm(`Are you sure you want to manually enroll this user into the ${selectedPlan.toUpperCase()} plan?`)) return;
    setIsEnrolling(true);
    setEnrollStatus('idle');
    try {
      await adminManualEnrollPro({
        targetUserId: member.userId,
        planId: selectedPlan
      });
      setEnrollStatus('success');
      setTimeout(() => setEnrollStatus('idle'), 3000);
    } catch (error) {
      console.error('Enrollment failed:', error);
      setEnrollStatus('error');
    } finally {
      setIsEnrolling(false);
    }
  };

  const handleAddRefillCredit = async () => {
    if (!confirm(`Are you sure you want to add 1 Refill Credit? This will reduce the user's monthly usage count by 1.`)) return;
    try {
      await updateDocument('pro_memberships', member.id, {
        proJarsUsedThisMonth: Math.max(0, member.proJarsUsedThisMonth - 1)
      });
      // Add a manual activity log from client for immediate feedback
      await addDocument('pro_activity_logs', {
        userId: member.userId,
        type: 'ADMIN_OVERRIDE',
        details: {
          action: 'REFILL_CREDIT_ADDED',
          amount: 1,
          adminId: 'ADMIN_SESSION' // TODO: Get actual admin ID
        },
        timestamp: new Date()
      });
      alert('Refill credit added successfully.');
    } catch (error) {
      console.error('Error adding credit:', error);
      alert('Error adding credit. Please try again.');
    }
  };

  const handleChangePlan = async () => {
    if (!confirm(`Switch user to ${selectedPlan.toUpperCase()} plan?`)) return;
    setIsChangingPlan(true);
    try {
      // In a real app, this would call a cloud function
      // For now, update directly to show result
      await updateDocument('pro_memberships', member.id, {
        proPlanId: selectedPlan,
        updatedAt: new Date()
      });
      await updateDocument('users', member.userId, {
        proPlanId: selectedPlan
      });
      await addDocument('pro_activity_logs', {
        userId: member.userId,
        type: 'PLAN_CHANGE',
        details: {
          oldPlanId: member.proPlanId,
          newPlanId: selectedPlan,
          adminId: 'ADMIN_SESSION'
        },
        timestamp: new Date()
      });
      alert('Plan updated successfully.');
    } catch (error) {
      console.error('Error changing plan:', error);
      alert('Error changing plan.');
    } finally {
      setIsChangingPlan(false);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/70 backdrop-blur-sm z-[100]"
            onClick={onClose}
          />
          <motion.div
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
            className="fixed top-0 right-0 h-full w-full max-w-md bg-zinc-950 border-l border-zinc-800 shadow-2xl z-[101] overflow-y-auto flex flex-col"
          >
            {/* Header & Tabs */}
            <div className="border-b border-zinc-900 bg-zinc-950/50 backdrop-blur-md sticky top-0 z-[102]">
              <div className="p-6 flex justify-between items-center">
                <div>
                  <h2 className="text-[10px] font-black text-emerald-400 uppercase tracking-widest leading-none mb-1">Subscriber Intel</h2>
                  <p className="text-[10px] text-zinc-500 font-mono uppercase">{member.proId || 'PRO_ID_PENDING'}</p>
                </div>
                <button 
                  onClick={onClose} 
                  className="p-2 hover:bg-zinc-900 rounded-full text-zinc-500 hover:text-white transition-all"
                >
                  <FiX size={20} />
                </button>
              </div>
              
              <div className="flex px-6 gap-6">
                <button 
                  onClick={() => setActiveTab('overview')}
                  className={`pb-3 text-[10px] font-black uppercase tracking-widest transition-all border-b-2 ${activeTab === 'overview' ? 'text-white border-emerald-500' : 'text-zinc-600 border-transparent'}`}
                >
                  Overview
                </button>
                <button 
                  onClick={() => setActiveTab('history')}
                  className={`pb-3 text-[10px] font-black uppercase tracking-widest transition-all border-b-2 ${activeTab === 'history' ? 'text-white border-emerald-500' : 'text-zinc-600 border-transparent'}`}
                >
                  History (Audit)
                </button>
              </div>
            </div>
            
            <div className="p-6 space-y-8 flex-1">
              {activeTab === 'overview' ? (
                <>
                  {/* Identity Block */}
                  <div className="flex items-center gap-4">
                    <div className="w-16 h-16 bg-zinc-900 border border-emerald-500/30 flex items-center justify-center text-2xl font-bold text-white shadow-[0_0_15px_rgba(16,185,129,0.1)]">
                       {name.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <h3 className="text-xl font-bold text-white tracking-tight">{name}</h3>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-[10px] font-mono text-zinc-500">USER_ID: {user.customerId || 'N/A'}</span>
                        <span className={`px-1.5 py-0.5 rounded-[2px] text-[8px] font-black uppercase tracking-tighter ${member.proStatus === 'active' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-red-500/20 text-red-500'}`}>
                          {member.proStatus}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Action Grid */}
                  <div className="grid grid-cols-2 gap-2">
                    <a href={`https://wa.me/${waPhone}`} target="_blank" className="flex items-center justify-center gap-2 py-3 bg-zinc-900 border border-zinc-800 rounded-[2px] text-[10px] font-bold uppercase text-zinc-400 hover:text-emerald-400 hover:border-emerald-400/30 transition-all">
                      <FiMessageCircle size={14} /> WhatsApp
                    </a>
                    <a href={`tel:${phone}`} className="flex items-center justify-center gap-2 py-3 bg-zinc-900 border border-zinc-800 rounded-[2px] text-[10px] font-bold uppercase text-zinc-400 hover:text-emerald-400 hover:border-emerald-400/30 transition-all">
                      <FiPhone size={14} /> Call Now
                    </a>
                  </div>

                  {/* Membership Metrics */}
                  <div className="space-y-4">
                    <div className="text-[10px] font-black text-zinc-600 uppercase tracking-widest flex items-center gap-2">
                      <FiActivity className="text-emerald-400" /> Plan Performance
                    </div>
                    
                    <div className="grid grid-cols-2 gap-3">
                      <div className="bg-zinc-900 p-4 border border-zinc-800 rounded-[2px]">
                        <div className="flex justify-between items-start mb-1">
                          <div className="text-[9px] text-zinc-500 uppercase font-black">Monthly Usage</div>
                          <button onClick={handleAddRefillCredit} className="text-[8px] bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 px-1.5 py-0.5 rounded hover:bg-emerald-500/20 transition-colors">
                            + ADD CREDIT
                          </button>
                        </div>
                        <div className="text-2xl font-mono text-white font-bold">
                          {member.proJarsUsedThisMonth} 
                          <span className="text-sm text-zinc-600 font-normal">
                            / {PRO_PLANS[member.proPlanId as keyof typeof PRO_PLANS]?.maxJars === 999999 ? '∞' : (PRO_PLANS[member.proPlanId as keyof typeof PRO_PLANS]?.maxJars || '∞')} Refills
                          </span>
                        </div>
                      </div>
                      <div className="bg-zinc-900 p-4 border border-zinc-800 rounded-[2px]">
                        <div className="text-[9px] text-zinc-500 uppercase font-black mb-1">Wallet Credit</div>
                        <div className="text-2xl font-mono text-emerald-400 font-bold">₹{user.walletBalance || user.wallet_balance || 0}</div>
                      </div>
                    </div>
                  </div>

                  {/* Detailed Info */}
                  <div className="space-y-3 pt-2">
                    <div className="text-[10px] font-black text-zinc-600 uppercase tracking-widest flex items-center gap-2 mb-2">
                      <FiInfo className="text-emerald-400" /> Administrative Data
                    </div>
                    {[
                      { label: "Full Phone", value: phone, icon: <FiPhone /> },
                      { label: "Membership ID", value: member.proId || 'N/A', icon: <FiShield /> },
                      { label: "Customer ID", value: user.customerId || 'N/A', icon: <FiUser /> },
                      { label: "Next Renewal", value: formatDateSafe(member.proPeriodEnd || member.proTrialEnd), icon: <FiClock /> },
                      { label: "Account Type", value: user.isLegacy ? "Legacy" : "Pro New", icon: <FiTrendingUp /> }
                    ].map((item, i) => (
                      <div key={i} className="flex justify-between items-center p-3 border border-zinc-900/50 hover:bg-zinc-900/30 transition-all rounded-[2px]">
                        <div className="flex items-center gap-3">
                          <span className="text-zinc-600 text-sm">{item.icon}</span>
                          <span className="text-[10px] text-zinc-500 uppercase font-bold">{item.label}</span>
                        </div>
                        <span className="text-[11px] font-mono text-zinc-300">{item.value}</span>
                      </div>
                    ))}
                  </div>

                  {/* Manual Override Section */}
                  <div className="space-y-4 pt-2">
                    <div className="text-[10px] font-black text-zinc-600 uppercase tracking-widest flex items-center gap-2">
                      <FiShield className="text-emerald-400" /> Executive Override
                    </div>
                    
                    <div className="p-4 bg-zinc-900/50 border border-zinc-900 border-dashed rounded-[2px] space-y-4">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] text-zinc-400 font-bold uppercase">Manual Plan Activation / Change</span>
                        <select 
                          value={selectedPlan}
                          onChange={(e) => setSelectedPlan(e.target.value)}
                          className="bg-black border border-zinc-800 text-[10px] text-emerald-400 font-bold px-2 py-1 outline-none"
                        >
                          <option value="lite">STANDARD (₹15)</option>
                          <option value="pro">SMART (₹30)</option>
                          <option value="proMax">UNLIMITED (₹55)</option>
                        </select>
                      </div>
                      
                      <button 
                        onClick={member.proPlanId ? handleChangePlan : handleManualEnroll}
                        disabled={isEnrolling || isChangingPlan}
                        className="w-full py-2 bg-emerald-600 hover:bg-emerald-500 disabled:bg-zinc-800 text-white text-[10px] font-black uppercase tracking-widest rounded-[2px] transition-all flex items-center justify-center gap-2"
                      >
                        {(isEnrolling || isChangingPlan) ? 'Processing...' : enrollStatus === 'success' ? 'Updated Successfully' : member.proPlanId ? 'Change Tier' : 'Activate Membership'}
                        {(enrollStatus === 'success') && <FiShield />}
                        {enrollStatus === 'error' && <FiAlertCircle className="text-red-400" />}
                      </button>
                    </div>
                  </div>

                  {/* Asset Tracking */}
                  <div className="space-y-4 pt-2">
                     <div className="flex justify-between items-center">
                        <div className="text-[10px] font-black text-zinc-600 uppercase tracking-widest flex items-center gap-2">
                          <FiBox className="text-emerald-400" /> Active Inventory
                        </div>
                        <span className="text-[9px] bg-emerald-500/10 text-emerald-400 px-2 py-0.5 rounded border border-emerald-500/20">{heldJars.length} Bottles Held</span>
                     </div>
                     
                     {heldJars.length > 0 ? (
                       <div className="space-y-2">
                         {heldJars.map(jar => (
                           <div key={jar.id} className="flex justify-between items-center p-3 bg-zinc-900 border border-zinc-800 rounded-[2px]">
                             <span className="text-[10px] font-mono font-bold text-white">{jar.id}</span>
                             <span className="text-[9px] text-zinc-500 font-medium">SCAN_REQ_IN: 24H</span>
                           </div>
                         ))}
                       </div>
                     ) : (
                       <div className="p-4 border border-zinc-900 border-dashed text-center text-[10px] text-zinc-600 font-mono">
                         NO_ASSETS_DETECTED_IN_FIELD
                       </div>
                     )}
                  </div>
                </>
              ) : (
                <div className="space-y-6">
                  <div className="text-[10px] font-black text-zinc-600 uppercase tracking-widest flex items-center gap-2 mb-4">
                    <FiClock className="text-emerald-400" /> Audit Timeline (BI Engine)
                  </div>
                  
                  {activityLogs.length > 0 ? (
                    <div className="relative pl-6 space-y-8 before:absolute before:left-[11px] before:top-2 before:bottom-2 before:w-[1px] before:bg-zinc-800">
                      {activityLogs.map((log, idx) => (
                        <div key={idx} className="relative">
                          <div className={`absolute -left-[19px] top-1.5 w-2 h-2 rounded-full border-2 border-zinc-950 z-10 ${
                            log.type === 'PAYMENT_SUCCESS' ? 'bg-emerald-400' : 
                            log.type === 'PLAN_CHANGE' ? 'bg-purple-400' :
                            log.type === 'ADMIN_OVERRIDE' ? 'bg-amber-400' : 'bg-zinc-500'
                          }`}></div>
                          
                          <div className="bg-zinc-900/30 p-3 border border-zinc-900 rounded-[2px]">
                            <div className="flex justify-between items-start mb-2">
                              <span className="text-[9px] font-black text-white uppercase tracking-tighter">{log.type.replace(/_/g, ' ')}</span>
                              <span className="text-[8px] text-zinc-600 font-mono">{formatDateSafe(log.timestamp)}</span>
                            </div>
                            
                            <div className="space-y-1">
                              {Object.entries(log.details || {}).map(([key, val]: [string, any]) => (
                                <div key={key} className="flex gap-2">
                                  <span className="text-[8px] text-zinc-500 font-bold uppercase w-16">{key}:</span>
                                  <span className="text-[8px] text-zinc-400 font-mono break-all">{JSON.stringify(val)}</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="p-12 text-center text-zinc-700 font-mono text-[10px] border border-dashed border-zinc-900">
                      NO_AUDIT_TRAIL_FOUND
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="p-6 border-t border-zinc-900 bg-zinc-950 px-8">
              <div className="flex justify-between items-center opacity-40">
                <span className="text-[8px] font-black uppercase text-zinc-600">Terminal Node: ALPHA-2</span>
                <div className="flex items-center gap-1">
                   <div className="w-1 h-1 bg-emerald-400 rounded-full"></div>
                   <span className="text-[8px] text-emerald-400 font-bold">READY</span>
                </div>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
