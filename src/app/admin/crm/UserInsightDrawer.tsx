import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FiX, FiPhone, FiMessageCircle, FiMail, FiBox, FiDollarSign, FiClock } from 'react-icons/fi';

interface UserInsightDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  user: any; 
}

const formatDateSafe = (dateVal: any) => {
  if (!dateVal) return 'Never';
  const ts = typeof dateVal === 'number' ? dateVal : 
             typeof dateVal === 'string' ? new Date(dateVal).getTime() : 
             dateVal.toDate ? dateVal.toDate().getTime() : 
             dateVal instanceof Date ? dateVal.getTime() : 0;
  if (!ts) return 'Never';
  return new Date(ts).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
};

export default function UserInsightDrawer({ isOpen, onClose, user }: UserInsightDrawerProps) {
  if (!user) return null;

  const name = user.full_name || user.name || `${user.firstName || ''} ${user.lastName || ''}`.trim() || 'Unknown';
  const phone = user.phone || user.phoneNumber || '';
  const waPhone = phone.replace(/[^\d]/g, '').startsWith('91') ? phone.replace(/[^\d]/g, '') : '91' + phone.replace(/[^\d]/g, '');

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100]"
            onClick={onClose}
          />
          <motion.div
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
            className="fixed top-0 right-0 h-full w-full max-w-md bg-[#0d131f] border-l border-emerald-500/20 shadow-2xl z-[101] overflow-y-auto flex flex-col"
          >
            <div className="p-6 border-b border-emerald-500/10 flex justify-between items-center bg-[#0d131f] sticky top-0 z-[102]">
              <h2 className="text-xl font-bold text-white">Insight Profile</h2>
              <button onClick={onClose} className="p-2 bg-white/5 hover:bg-white/10 rounded-full text-gray-400 hover:text-white transition-colors">
                <FiX className="text-xl" />
              </button>
            </div>
            
            <div className="p-6 flex-1 flex flex-col gap-6">
              {/* Header Info */}
              <div className="flex items-center gap-4">
                <div className="w-16 h-16 rounded-full bg-gradient-to-br from-emerald-400 to-teal-600 flex items-center justify-center text-2xl font-bold text-white shadow-lg shadow-emerald-500/20">
                  {name.charAt(0).toUpperCase()}
                </div>
                <div>
                  <h3 className="text-xl font-bold text-white mb-1">{name}</h3>
                  <p className="text-sm text-emerald-400 font-mono">{user.customerId || user.id}</p>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="grid grid-cols-2 gap-3">
                <a href={`https://wa.me/${waPhone}`} target="_blank" rel="noreferrer" className="flex items-center justify-center gap-2 py-3 bg-[#25D366]/10 text-[#25D366] hover:bg-[#25D366]/20 border border-[#25D366]/20 rounded-xl font-medium transition-all">
                  <FiMessageCircle /> WhatsApp
                </a>
                <a href={`tel:${phone}`} className="flex items-center justify-center gap-2 py-3 bg-blue-500/10 text-blue-400 hover:bg-blue-500/20 border border-blue-500/20 rounded-xl font-medium transition-all">
                  <FiPhone /> Call Direct
                </a>
              </div>

              {/* Metrics Grid */}
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-[#151f32] p-4 rounded-xl border border-emerald-500/10">
                  <div className="flex items-center gap-2 text-emerald-400 mb-2 font-medium">
                    <FiDollarSign /> LTV
                  </div>
                  <div className="text-2xl font-bold text-white">₹{user.__ltv?.toLocaleString() || 0}</div>
                  <div className="text-[10px] text-gray-500 mt-1 uppercase">Lifetime Value</div>
                </div>
                <div className="bg-[#151f32] p-4 rounded-xl border border-emerald-500/10">
                  <div className="flex items-center gap-2 text-emerald-400 mb-2 font-medium">
                    <FiBox /> Volume
                  </div>
                  <div className="text-2xl font-bold text-white">{user.__totalOrders || 0}</div>
                  <div className="text-[10px] text-gray-500 mt-1 uppercase">Total Orders</div>
                </div>
                <div className="bg-[#151f32] p-4 rounded-xl border border-orange-500/10">
                  <div className="flex items-center gap-2 text-orange-400 mb-2 font-medium">
                    <FiDollarSign /> Wallet
                  </div>
                  <div className="text-2xl font-bold text-white">₹{user.wallet_balance || 0}</div>
                  <div className="text-[10px] text-gray-500 mt-1 uppercase">Available Balance</div>
                </div>
                <div className="bg-[#151f32] p-4 rounded-xl border border-orange-500/10">
                  <div className="flex items-center gap-2 text-orange-400 mb-2 font-medium">
                    <FiBox /> Jars
                  </div>
                  <div className="text-2xl font-bold text-white">{user.jars_occupied || user.jarHold || 0}</div>
                  <div className="text-[10px] text-gray-500 mt-1 uppercase">Currently Retained</div>
                </div>
              </div>

              {/* Additional Details */}
              <div className="bg-[#151f32] border border-white/5 rounded-xl p-5 mt-2 flex flex-col gap-4">
                <div>
                  <div className="text-xs text-gray-500 uppercase tracking-widest font-semibold mb-1">Email Address</div>
                  <div className="text-sm text-gray-300 flex items-center gap-2">
                    <FiMail className="text-gray-500"/> {user.email || 'No email provided'}
                  </div>
                </div>
                <div>
                  <div className="text-xs text-gray-500 uppercase tracking-widest font-semibold mb-1">Account Created</div>
                  <div className="text-sm text-gray-300 flex items-center gap-2">
                    <FiClock className="text-gray-500"/> {formatDateSafe(user.createdAt)}
                  </div>
                </div>
                <div>
                  <div className="text-xs text-gray-500 uppercase tracking-widest font-semibold mb-1">Last Order Date</div>
                  <div className="text-sm text-gray-300 flex items-center gap-2">
                    <FiClock className="text-gray-500"/> {formatDateSafe(user.lastOrderDate)}
                  </div>
                </div>
              </div>

            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
