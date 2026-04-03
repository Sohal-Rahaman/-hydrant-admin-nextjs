import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { db } from './firebase';

export type ActivityAction = 
  | 'ORDER_PLACED' 
  | 'ORDER_DELIVERED' 
  | 'ORDER_CANCELLED' 
  | 'WALLET_UPDATED' 
  | 'JAR_UPDATED' 
  | 'USER_DELETED' 
  | 'PAYMENT_RECEIVED' 
  | 'ROLE_UPDATED' 
  | 'BULK_PARTNER_ASSIGNMENT'
  | 'ARMY_MEMBER_ADDED'
  | 'ARMY_MEMBER_UPDATED'
  | 'ARMY_MEMBER_DELETED'
  | 'AUTO_DISPATCH_TRIGGERED'
  | 'SYSTEM_ALERT'
  | 'ORDER_EDITED_BY_ADMIN'
  | 'USER_EDITED_BY_ADMIN'
  | 'OTHER';

export interface LogActivityParams {
  action: ActivityAction;
  actor: 'ADMIN' | 'USER' | 'SYSTEM';
  actorName: string;
  actorId: string;
  details: string;
  targetId?: string;
  metadata?: any;
}

/**
 * Logs an activity to the admin_activities collection for the global activity feed.
 */
export const logActivity = async (params: LogActivityParams) => {
  try {
    const activityRef = collection(db, 'admin_activities');
    await addDoc(activityRef, {
      ...params,
      timestamp: serverTimestamp(),
    });
    console.log(`[ACTIVITY LOGGED] ${params.action}: ${params.details}`);
  } catch (error) {
    console.error('Failed to log activity:', error);
  }
};
