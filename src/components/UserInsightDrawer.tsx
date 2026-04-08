import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FiX, FiPhone, FiMessageCircle, FiMail, FiBox, FiDollarSign, FiClock, FiUser, FiActivity, FiEdit3, FiSave, FiAlertCircle, FiCheck } from 'react-icons/fi';
import { updateDocument } from '@/lib/firebase';
import { logActivity } from '@/lib/activityLogger';

interface UserInsightDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  user: any; 
}

const formatDateSafe = (dateVal: any) => {
  if (!dateVal) return 'NEVER';
  const ts = typeof dateVal === 'number' ? dateVal : 
             typeof dateVal === 'string' ? new Date(dateVal).getTime() : 
             dateVal.toDate ? dateVal.toDate().getTime() : 
             dateVal instanceof Date ? dateVal.getTime() : 0;
  if (!ts) return 'NEVER';
  return new Date(ts).toLocaleDateString('en-IN', { 
    day: '2-digit', 
    month: 'short', 
    year: 'numeric' 
  }).toUpperCase();
};

export default function UserInsightDrawer({ isOpen, onClose, user }: UserInsightDrawerProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [walletBalance, setWalletBalance] = useState<number>(0);
  const [jarsOccupied, setJarsOccupied] = useState<number>(0);
  const [isSaving, setIsSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'idle'|'success'|'error'>('idle');

  useEffect(() => {
    if (user) {
      setWalletBalance(user.wallet_balance ?? 0);
      setJarsOccupied(user.jars_occupied ?? user.jarHold ?? 0);
      setIsEditing(false);
      setSaveStatus('idle');
    }
  }, [user]);

  if (!user) return null;

  const name = user.full_name || user.name || `${user.firstName || ''} ${user.lastName || ''}`.trim() || 'UNKNOWN_ENTITY';
  const phone = user.phone || user.phoneNumber || 'NO_PHONE';
  const waPhone = phone.replace(/[^\d]/g, '').startsWith('91') ? phone.replace(/[^\d]/g, '') : '91' + phone.replace(/[^\d]/g, '');

  const handleUpdate = async () => {
    setIsSaving(true);
    setSaveStatus('idle');
    try {
      await updateDocument('users', user.id, {
        wallet_balance: Number(walletBalance),
        jars_occupied: Number(jarsOccupied)
      });
      
      await logActivity({
        action: 'USER_EDITED_BY_ADMIN',
        actor: 'ADMIN',
        actorName: 'Admin',
        actorId: 'admin_panel',
        details: `Manual adjustment for ${name} (ID: ${user.id}). Wallet: ${walletBalance}, Jars: ${jarsOccupied}`,
        targetId: user.id
      });

      setSaveStatus('success');
      setIsEditing(false);
      setTimeout(() => setSaveStatus('idle'), 3000);
    } catch (error) {
      console.error('Update failed:', error);
      setSaveStatus('error');
    } finally {
      setIsSaving(false);
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
            className="fixed inset-0 bg-black/80 backdrop-blur-md z-[100]"
            onClick={onClose}
          />
          <motion.div
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 30, stiffness: 300, mass: 0.8 }}
            className="fixed top-0 right-0 h-full w-full max-w-lg bg-[#050505] border-l border-zinc-900 shadow-[0_0_100px_rgba(0,0,0,1)] z-[101] overflow-y-auto flex flex-col font-sans"
          >
            {/* Header */}
            <div className="p-8 border-b border-zinc-900 flex justify-between items-center bg-black/50 backdrop-blur-xl sticky top-0 z-[102]">
              <div>
                <h2 className="text-[10px] font-black text-cyan-400 uppercase tracking-[0.3em]">Tactical Entity Insight</h2>
                <div className="text-[10px] text-zinc-600 font-mono mt-1 uppercase">ID_STRING: {user.customerId || user.id}</div>
              </div>
              <button 
                onClick={onClose} 
                className="p-3 bg-zinc-950 hover:bg-zinc-900 rounded text-zinc-500 hover:text-white transition-all border border-zinc-900"
              >
                <FiX size={18} />
              </button>
            </div>
            
            <div className="p-8 flex-1 flex flex-col gap-10">
              {/* Entity Header */}
              <div className="flex items-start gap-6">
                <div className="w-20 h-20 rounded bg-zinc-950 border-2 border-zinc-900 flex items-center justify-center text-3xl font-bold text-white relative shadow-[0_0_20px_rgba(34,211,238,0.05)]">
                   <span className="absolute -top-1 -left-1 w-2 h-2 bg-cyan-400"></span>
                   <span className="absolute -bottom-1 -right-1 w-2 h-2 bg-cyan-400"></span>
                   {name.charAt(0).toUpperCase()}
                </div>
                <div className="pt-2">
                  <h3 className="text-3xl font-black text-white tracking-tighter uppercase leading-none">{name}</h3>
                  <div className="mt-3 flex items-center gap-2">
                    <span className="px-2 py-0.5 bg-cyan-400/10 text-cyan-400 text-[9px] font-black uppercase tracking-widest border border-cyan-400/20">Operational Asset</span>
                    <span className="w-1.5 h-1.5 bg-cyan-400 rounded-full animate-pulse shadow-[0_0_10px_rgba(34,211,238,0.5)]"></span>
                  </div>
                </div>
              </div>

              {/* Secure Comms Link */}
              <div className="grid grid-cols-2 gap-3">
                <a 
                  href={`https://wa.me/${waPhone}`} 
                  target="_blank" 
                  rel="noreferrer" 
                  className="flex items-center justify-center gap-3 py-4 bg-zinc-950 text-zinc-400 hover:bg-lime-400 hover:text-black border border-zinc-900 hover:border-lime-400 rounded text-[11px] font-black uppercase tracking-widest transition-all"
                >
                  <FiMessageCircle size={14} /> Open Signal
                </a>
                <a 
                  href={`tel:${phone}`} 
                  className="flex items-center justify-center gap-3 py-4 bg-zinc-950 text-zinc-400 hover:bg-cyan-400 hover:text-black border border-zinc-900 hover:border-cyan-400 rounded text-[11px] font-black uppercase tracking-widest transition-all"
                >
                  <FiPhone size={14} /> Voice Link
                </a>
              </div>

              {/* Operational Metrics - Editable */}
              <div>
                 <div className="text-[10px] text-zinc-600 font-black uppercase tracking-[0.2em] mb-4 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <FiActivity className="text-cyan-400" /> Operational Metrics
                    </div>
                    {isEditing ? (
                      <div className="flex gap-2">
                        <button 
                          onClick={() => setIsEditing(false)}
                          className="text-[9px] text-zinc-500 hover:text-white uppercase font-black tracking-widest"
                        >
                          Cancel
                        </button>
                        <button 
                          onClick={handleUpdate}
                          disabled={isSaving}
                          className="text-[9px] text-lime-400 hover:text-lime-300 uppercase font-black tracking-widest flex items-center gap-1"
                        >
                          {isSaving ? 'Processing...' : <><FiSave /> Commit Changes</>}
                        </button>
                      </div>
                    ) : (
                      <button 
                        onClick={() => setIsEditing(true)}
                        className="text-[9px] text-cyan-400 hover:text-cyan-300 uppercase font-black tracking-widest flex items-center gap-1"
                      >
                        <FiEdit3 /> Adjust Metrics
                      </button>
                    )}
                 </div>

                 {saveStatus === 'success' && (
                   <div className="mb-4 p-3 bg-lime-400/10 border border-lime-400/20 rounded flex items-center gap-3 text-lime-400 text-[10px] font-bold uppercase tracking-widest">
                     <FiCheck className="text-sm" /> Records Synchronized Successfully
                   </div>
                 )}
                 
                 {saveStatus === 'error' && (
                   <div className="mb-4 p-3 bg-red-400/10 border border-red-400/20 rounded flex items-center gap-3 text-red-500 text-[10px] font-bold uppercase tracking-widest">
                     <FiAlertCircle className="text-sm" /> Operational Failure: Sync Error
                   </div>
                 )}

                 <div className="grid grid-cols-2 gap-px bg-zinc-900 border border-zinc-900 overflow-hidden rounded bg-zinc-900 shadow-xl">
                    <div className="bg-black p-6">
                       <div className="text-zinc-600 text-[9px] font-black uppercase tracking-widest mb-3 font-mono">WALLET_BAL</div>
                       {isEditing ? (
                         <div className="flex items-center gap-2 bg-zinc-950 px-3 py-2 rounded border border-zinc-800">
                           <span className="text-zinc-600 font-mono text-sm">₹</span>
                           <input 
                             type="number" 
                             value={walletBalance}
                             onChange={(e) => setWalletBalance(Number(e.target.value))}
                             className="bg-transparent border-none outline-none text-xl font-black text-lime-400 font-mono w-full"
                             autoFocus
                           />
                         </div>
                       ) : (
                         <div className="flex items-baseline gap-1">
                           <div className={`text-2xl font-black ${walletBalance < 0 ? 'text-red-500' : 'text-lime-400'} font-mono tracking-tighter`}>₹{walletBalance.toLocaleString()}</div>
                         </div>
                       )}
                    </div>
                    <div className="bg-black p-6">
                       <div className="text-zinc-600 text-[9px] font-black uppercase tracking-widest mb-3 font-mono">ASSET_HOLD</div>
                       {isEditing ? (
                         <div className="flex items-center gap-2 bg-zinc-950 px-3 py-2 rounded border border-zinc-800">
                           <input 
                             type="number" 
                             value={jarsOccupied}
                             onChange={(e) => setJarsOccupied(Number(e.target.value))}
                             className="bg-transparent border-none outline-none text-xl font-black text-cyan-400 font-mono w-full text-center"
                           />
                         </div>
                       ) : (
                         <div className="text-2xl font-black text-cyan-400 font-mono tracking-tighter">{jarsOccupied} JARS</div>
                       )}
                    </div>
                    
                    {/* Read-only LTV Metrics */}
                    <div className="bg-[#080808] p-6 opacity-60">
                       <div className="text-zinc-600 text-[9px] font-black uppercase tracking-widest mb-2 font-mono">LTV_SUMMARY</div>
                       <div className="text-2xl font-black text-zinc-400 font-mono tracking-tighter">₹{user.__ltv?.toLocaleString() || 0}</div>
                    </div>
                    <div className="bg-[#080808] p-6 opacity-60">
                       <div className="text-zinc-600 text-[9px] font-black uppercase tracking-widest mb-2 font-mono">ORDER_VOL</div>
                       <div className="text-2xl font-black text-zinc-400 font-mono tracking-tighter">{user.__totalOrders || 0}</div>
                    </div>
                 </div>
              </div>

              {/* Intelligence Log */}
              <div className="flex flex-col gap-6">
                <div className="text-[10px] text-zinc-600 font-black uppercase tracking-[0.2em] flex items-center gap-2">
                    <FiClock className="text-cyan-400" /> Chronological Core Data
                </div>
                
                <div className="space-y-4">
                  {[
                    { label: 'Network Alias', value: user.email || 'GHOST_USER', icon: <FiMail /> },
                    { label: 'Origin Date', value: formatDateSafe(user.createdAt), icon: <FiUser /> },
                    { label: 'Last Signal', value: formatDateSafe(user.lastOrderDate), icon: <FiClock /> }
                  ].map((row, idx) => (
                    <div key={idx} className="flex items-center justify-between group p-3 bg-zinc-950/50 rounded border border-transparent hover:border-zinc-900 transition-all">
                      <div className="flex items-center gap-4">
                        <div className="text-zinc-700 group-hover:text-cyan-400 transition-colors">{row.icon}</div>
                        <div className="text-[9px] text-zinc-600 font-black uppercase tracking-widest font-mono">{row.label}</div>
                      </div>
                      <div className="text-[11px] font-mono text-zinc-400 group-hover:text-white transition-colors">{row.value}</div>
                    </div>
                  ))}
                </div>
              </div>

            </div>

            {/* Footer / Authority Check */}
            <div className="p-8 border-t border-zinc-900 bg-black/80">
               <div className="flex items-center justify-between">
                  <div className="text-[8px] text-zinc-700 font-black uppercase tracking-[0.2em]">Hydrant Terminal Intelligence Node</div>
                  <div className="flex items-center gap-2">
                     <div className="w-1.5 h-1.5 bg-lime-400 rounded-full shadow-[0_0_8px_rgba(163,230,53,0.5)]"></div>
                     <span className="text-[8px] text-lime-400 font-mono font-bold">SECURE_UPLINK_READY</span>
                  </div>
               </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
