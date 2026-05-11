'use client';

import { useState } from 'react';
import { enrollPro, setDocument, auth, db, generateProId } from '@/lib/firebase';
import { serverTimestamp, doc, getDoc } from 'firebase/firestore';
import { FiCheck, FiStar, FiZap, FiShield } from 'react-icons/fi';
import { motion } from 'framer-motion';

const plans = [
  { 
    id: 'lite', 
    name: 'Lite', 
    fee: 15, 
    maxJars: 10, 
    pricePerJar: 37,
    overageFee: 40,
    icon: <FiCheck className="w-5 h-5 text-[#A3E635]" />,
    color: 'from-zinc-800 to-zinc-900',
    borderColor: 'border-zinc-800'
  },
  { 
    id: 'pro', 
    name: 'Pro', 
    fee: 35, 
    maxJars: 25, 
    pricePerJar: 37,
    overageFee: 40,
    icon: <FiZap className="w-5 h-5 text-[#00E5FF]" />,
    color: 'from-slate-800 to-zinc-900',
    borderColor: 'border-[#00E5FF]/30',
    popular: true
  },
  { 
    id: 'proMax', 
    name: 'Pro Max', 
    fee: 55, 
    maxJars: 999999, 
    pricePerJar: 37,
    overageFee: 0,
    icon: <FiStar className="w-5 h-5 text-[#FBBF24]" />,
    color: 'from-amber-900/20 to-zinc-900',
    borderColor: 'border-[#FBBF24]/30'
  }
];

export default function ProPlans({ 
  onEnrolled, 
  isAdminMode = false 
}: { 
  onEnrolled?: () => void,
  isAdminMode?: boolean 
}) {
  const [loading, setLoading] = useState<string | null>(null);

  const enroll = async (planId: string) => {
    setLoading(planId);
    try {
      if (isAdminMode) {
        // Simulation Logic: Skip Razorpay, Update Firestore directly
        const uid = auth.currentUser?.uid;
        if (!uid) throw new Error('No user logged in to simulate enrollment');

        const periodEnd = new Date();
        periodEnd.setMonth(periodEnd.getMonth() + 1);

        // Fetch user or generate new customerId if missing
        const userDoc = await getDoc(doc(db, 'users', uid));
        const userData = userDoc.exists() ? userDoc.data() : {};
        const customerId = userData.customerId || `HYDRA-${Math.floor(Math.random() * 9000 + 1000)}`;
        
        const proId = generateProId(planId, customerId);

        // use setDocument with merge:true to create doc if missing (for legacy admins)
        await setDocument('pro_memberships', uid, {
          userId: uid,
          proId,
          proPlanId: planId,
          proStatus: 'active',
          proPeriodEnd: periodEnd,
          proJarsUsedThisMonth: 0,
          proTrialEnd: null,
          updatedAt: serverTimestamp()
        });

        // Ensure user has the customerId too if it was generated
        if (!userData.customerId) {
          await setDocument('users', uid, { customerId });
        }

        alert(`SIMULATION SUCCESS: Activated ${planId} for admin user.`);
        if (onEnrolled) onEnrolled();
      } else {
        const result: any = await enrollPro({ planId });
        if (result.data?.shortUrl) {
          // Redirect to Razorpay subscription checkout
          window.location.href = result.data.shortUrl;
        } else if (onEnrolled) {
          onEnrolled();
        }
      }
    } catch (err: any) {
      alert(`Enrollment failed: ${err.message}`);
    } finally {
      setLoading(null);
    }
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 p-4">
      {plans.map((p) => (
        <motion.div 
          whileHover={{ scale: 1.02 }}
          key={p.id} 
          className={`relative bg-gradient-to-b ${p.color} border ${p.borderColor} rounded-xl p-6 flex flex-col`}
          style={{ borderRadius: '2px' }} // Industrial Precision adherence
        >
          {p.popular && (
            <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-[#00E5FF] text-black text-xs font-bold px-3 py-1 uppercase tracking-wider" style={{ borderRadius: '2px' }}>
              Most Popular
            </div>
          )}
          
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 bg-black/40 rounded-lg">
              {p.icon}
            </div>
            <h3 className="text-xl font-bold text-white">{p.name}</h3>
          </div>

          <div className="mb-6">
            <div className="flex items-end gap-1">
              <span className="text-4xl font-mono-technical font-bold text-white">₹{p.fee}</span>
              <span className="text-zinc-400 mb-1">/ month</span>
            </div>
          </div>

          <ul className="flex-1 space-y-3 mb-8">
            <li className="flex items-center gap-2 text-zinc-300">
              <FiShield className="text-[#00E5FF] w-4 h-4" />
              <span>Up to <strong>{p.maxJars}</strong> jars</span>
            </li>
            <li className="flex items-center gap-2 text-zinc-300">
              <FiShield className="text-[#00E5FF] w-4 h-4" />
              <span><strong>₹{p.pricePerJar}</strong> flat per jar</span>
            </li>
            <li className="flex items-center gap-2 text-zinc-300">
              <FiShield className="text-[#00E5FF] w-4 h-4" />
              <span>No ₹200 initial deposit</span>
            </li>
          </ul>

          <button 
            onClick={() => enroll(p.id)} 
            disabled={loading !== null} 
            className="w-full bg-[#00E5FF]/10 text-[#00E5FF] hover:bg-[#00E5FF] hover:text-black border border-[#00E5FF]/50 transition-all font-semibold py-3 flex justify-center items-center gap-2 disabled:opacity-50 uppercase tracking-widest text-xs"
            style={{ borderRadius: '2px' }}
          >
            {loading === p.id ? (
              <span className="animate-pulse">Processing...</span>
            ) : (
              isAdminMode ? `Simulate ${p.name}` : 'Choose Plan'
            )}
          </button>
        </motion.div>
      ))}
    </div>
  );
}
