const functions = require('firebase-functions/v1');
const admin = require('firebase-admin');

// Note: Set this via: firebase functions:config:set slack.webhook_url="https://hooks.slack.com/services/..."
// Defensive check for config to prevent initialization crash
let SLACK_WEBHOOK_URL = '';
try {
  const config = functions.config();
  if (config.slack && config.slack.webhook_url) {
    SLACK_WEBHOOK_URL = config.slack.webhook_url;
  }
} catch (e) {
  console.warn('Slack config not found, using default fallback.');
}

/**
 * Sends a rich block message to Slack
 * @param {Array} blocks - Slack Block Kit array
 */
async function sendSlackMessage(blocks) {
  try {
    // Node 18+ has native fetch
    const response = await fetch(SLACK_WEBHOOK_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ channel: 'C0AS1EQF6ET', blocks })
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Slack API error:', errorText);
    }
  } catch (error) {
    console.error('Error sending Slack notification:', error);
  }
}

/**
 * Formats a key-value section for Slack
 */
function section(text) {
  return {
    type: 'section',
    text: { type: 'mrkdwn', text }
  };
}

/**
 * Notify when a new user joins
 */
async function notifyUserSignup(userData) {
  const blocks = [
    {
      type: 'header',
      text: { type: 'plain_text', text: '👤 New Hydrant User Joined' }
    },
    section(`*ID:* ${userData.customerId || 'PENDING'}\n*Phone:* ${userData.phone}\n*Status:* ${userData.isLegacy ? 'Legacy' : 'Pro Trial'}`),
    {
      type: 'context',
      elements: [{ type: 'mrkdwn', text: `Registered at: ${new Date().toLocaleString()}` }]
    }
  ];
  await sendSlackMessage(blocks);
}

/**
 * Notify when an order is placed/updated
 */
async function notifyOrderUpdate(orderData, userData, title = '📦 New Order Received') {
  const blocks = [
    {
      type: 'header',
      text: { type: 'plain_text', text: title }
    },
    section([
      `*Order ID:* \`${orderData.id}\``,
      `*Customer:* ${userData.customerId} (${userData.phone})`,
      `*Quantity:* ${orderData.qty} Jars`,
      `*Slot:* ${orderData.deliverySlot || 'Not Specified'}`,
      `*Amount:* ₹${orderData.amount}`,
      `*Payment:* ${orderData.paymentMethod.toUpperCase()}`,
      `*Wallet Balance:* ₹${userData.walletBalance}`
    ].join('\n')),
    {
      type: 'actions',
      elements: [
        {
          type: 'button',
          text: { type: 'plain_text', text: 'View in Admin' },
          url: `https://admin.hydrant.co.in/admin/orders?orderId=${orderData.id}`,
          style: 'primary'
        }
      ]
    }
  ];
  await sendSlackMessage(blocks);
}

const { onDocumentCreated, onDocumentUpdated } = require('firebase-functions/v2/firestore');

/**
 * Background Trigger: Notify Slack on New Order (Gen 2)
 */
const onNewOrderReceivedAlert = onDocumentCreated({ document: 'orders/{orderId}', region: 'us-central1' }, async (event) => {
    const after = event.data.data();
    if (!after) return null;
    const orderId = event.params.orderId;

    const db = admin.firestore();
    const userDoc = await db.collection('users').doc(after.userId).get();
    const userData = userDoc.data() || {};
    const customerId = userData.customerId || userData.displayName || 'N/A';
    const phone = userData.phone || 'N/A';

    const blocks = [
      {
        type: 'header',
        text: { type: 'plain_text', text: `🚰 New Order Placed! (#${orderId})` }
      },
      section([
        `*Customer:* ${customerId} (${phone})`,
        `*Items:* ${after.qty || 1} Jars`,
        `*Status:* \`${(after.status || 'pending').toUpperCase()}\``,
        `*Payment:* ${(after.paymentMethod || 'wallet').toUpperCase()}`,
        `*Address:* ${after.address || userData.address || 'N/A'}`
      ].join('\n')),
      {
        type: 'actions',
        elements: [
          {
            type: 'button',
            text: { type: 'plain_text', text: 'View Details' },
            url: `https://admin.hydrant.co.in/admin/orders?orderId=${orderId}`
          }
        ]
      }
    ];

    await sendSlackMessage(blocks);
    return null;
});

/**
 * Background Trigger: Notify Slack on New User Join (Gen 2)
 */
const onNewUserJoinAlert = onDocumentCreated({ document: 'users/{userId}', region: 'us-central1' }, async (event) => {
    const after = event.data.data();
    if (!after) return null;
    const userId = event.params.userId;

    const blocks = [
      {
        type: 'header',
        text: { type: 'plain_text', text: '👤 New Hydrant User Joined' }
      },
      section([
        `*Customer:* ${after.displayName || 'Guest User'}`,
        `*Phone:* ${after.phone || 'N/A'}`,
        `*Wallet Balance:* ₹${after.walletBalance || 0}`,
        `*Status:* ${after.isLegacy ? 'Legacy' : 'Pro Subscription Ready'}`
      ].join('\n')),
      {
        type: 'actions',
        elements: [
          {
            type: 'button',
            text: { type: 'plain_text', text: 'View Profile' },
            url: `https://admin.hydrant.co.in/admin/customers?userId=${userId}`
          }
        ]
      }
    ];

    await sendSlackMessage(blocks);
    return null;
});

/**
 * Background Trigger: Notify Slack on Support Message (Gen 2)
 */
const onNewSupportTicketAlert = onDocumentCreated({ document: 'contact_messages/{msgId}', region: 'us-central1' }, async (event) => {
    const after = event.data.data();
    if (!after) return null;
    const msgId = event.params.msgId;

    const blocks = [
      {
        type: 'header',
        text: { type: 'plain_text', text: '🎫 New Support Ticket Received' }
      },
      section([
        `*From:* ${after.name} (${after.phone || after.email || 'No contact provided'})`,
        `*Subject:* *${after.subject || 'No Subject'}*`,
        `*Message Preview:*`,
        `_${after.message ? (after.message.length > 200 ? after.message.substring(0, 197) + '...' : after.message) : 'No message content'}_`
      ].join('\n')),
      {
        type: 'actions',
        elements: [
          {
            type: 'button',
            text: { type: 'plain_text', text: 'Reply to Ticket' },
            url: `https://admin.hydrant.co.in/admin/support?msgId=${msgId}`,
            style: 'primary'
          }
        ]
      }
    ];

    await sendSlackMessage(blocks);
    return null;
});

/**
 * Background Trigger: Notify Slack on Order Status Updates (Gen 2)
 */
const onOrderUpdate = onDocumentUpdated({ document: 'orders/{orderId}', region: 'us-central1' }, async (event) => {
    if (!event.data) return null;
    const before = event.data.before.data();
    const after = event.data.after.data();
    const orderId = event.params.orderId;

    if (before.status === after.status) return null;

    const db = admin.firestore();
    const userDoc = await db.collection('users').doc(after.userId).get();
    const userData = userDoc.data() || {};
    const customerId = userData.customerId || 'N/A';
    const phone = userData.phone || 'N/A';
    const walletBalance = userData.walletBalance || userData.wallet_balance || 0;

    let emoji = '🔄';
    let color = '#3B82F6'; // Blue

    if (after.status === 'delivered' || after.status === 'completed') {
      emoji = '✅';
      color = '#10B981'; // Green
    } else if (after.status === 'cancelled' || after.status === 'canceled') {
      emoji = '❌';
      color = '#EF4444'; // Red
    }

    const blocks = [
      {
        type: 'header',
        text: { type: 'plain_text', text: `${emoji} Order Status Updated: ${after.status.toUpperCase()}` }
      },
      section([
        `*Order ID:* \`${orderId}\``,
        `*Customer:* ${customerId} (${phone})`,
        `*Items:* ${after.qty} Jars`,
        `*New Status:* \`${after.status.toUpperCase()}\``,
        `*Wallet Balance:* ₹${walletBalance}`
      ].join('\n')),
      {
        type: 'actions',
        elements: [
          {
            type: 'button',
            text: { type: 'plain_text', text: 'View Details' },
            url: `https://admin.hydrant.co.in/admin/orders?orderId=${orderId}`
          }
        ]
      }
    ];

    await sendSlackMessage(blocks);
    return null;
  });

module.exports = {
  sendSlackMessage,
  notifyUserSignup,
  notifyOrderUpdate,
  onOrderUpdate,
  onOrderCreatedSlack: onNewOrderReceivedAlert,
  onNewUserJoinAlert,
  onNewSupportTicketAlert
};
