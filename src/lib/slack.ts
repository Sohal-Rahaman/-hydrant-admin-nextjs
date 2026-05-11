import { IncomingWebhook } from '@slack/webhook';

// Initialize the webhook instance
// We check if the webhook URL exists to avoid crashing if it is not set (e.g. in local development)
const webhookUrl = process.env.HYDRANT_SLACK_WEBHOOK;
const webhook = webhookUrl ? new IncomingWebhook(webhookUrl) : null;

// Global settings matching the roadmap
const ICON_EMOJI = ':water_drop:';
// Automatically try to use Next.js base URL or default to the production domain
const ADMIN_BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || 'https://admin.hydrant.com';

// Define the payload payload types explicitly for Type Safety
export interface NewOrderPayload {
  orderId: string | number;
  customerName: string;
  address: string;
  total: number;
  items: string; // e.g., "3 x 20L Hydrant Jars"
}

export interface NewUserPayload {
  userId: string | number;
  userName: string;
  email: string;
  phone: string;
  joinedAt: string;
}

export interface SupportTicketPayload {
  ticketId: string | number;
  userName: string;
  priority: string; // e.g., "High", "Low"
  subject: string;
  message: string;
}

/**
 * 🚰 Hydrant 2.0 Notification Service Manager
 * Allows native integration with Slack without relying on bash shells
 */
export const slackNotify = {
  
  /**
   * Triggers an alert when a new order is received
   */
  async newOrder(data: NewOrderPayload) {
    if (!webhook) {
      console.warn('⚠️ Slack Webhook not configured. Skipped newOrder notification.');
      return;
    }
    
    try {
      await webhook.send({
        channel: process.env.SLACK_CHANNEL_ID,
        icon_emoji: ICON_EMOJI,
        text: `🚰 New Order Received! (#${data.orderId})`,
        blocks: [
          {
            type: 'section',
            text: { type: 'mrkdwn', text: `🚰 *New Order Received!* (#${data.orderId})` }
          },
          {
            type: 'section',
            fields: [
              { type: 'mrkdwn', text: `*Customer:*\n${data.customerName}` },
              { type: 'mrkdwn', text: `*Delivery Address:*\n${data.address}` },
              { type: 'mrkdwn', text: `*Total:*\n₹${data.total}` },
              { type: 'mrkdwn', text: `*Items:*\n${data.items}` }
            ]
          },
          {
            type: 'actions',
            elements: [
              {
                type: 'button',
                text: { type: 'plain_text', text: 'View Order' },
                url: `${ADMIN_BASE_URL}/admin/orders` // Can append ?id=${data.orderId} depending on routing
              }
            ]
          }
        ]
      });
      console.log(`✅ Slack notification sent: new_order for ID ${data.orderId}`);
    } catch (error) {
      console.error('❌ Failed to send Slack new_order notification:', error);
    }
  },

  /**
   * Triggers an alert when a new user signs up in Hydrant
   */
  async newUser(data: NewUserPayload) {
    if (!webhook) {
      console.warn('⚠️ Slack Webhook not configured. Skipped newUser notification.');
      return;
    }

    try {
      await webhook.send({
        channel: process.env.SLACK_CHANNEL_ID,
        icon_emoji: ICON_EMOJI,
        text: `👤 New User Joined! (${data.userName})`,
        blocks: [
          {
            type: 'section',
            text: { type: 'mrkdwn', text: `👤 *New User Joined!* (${data.userName})` }
          },
          {
            type: 'section',
            fields: [
              { type: 'mrkdwn', text: `*Email:*\n${data.email}` },
              { type: 'mrkdwn', text: `*Phone:*\n${data.phone}` },
              { type: 'mrkdwn', text: `*Joined:*\n${data.joinedAt}` }
            ]
          },
          {
            type: 'actions',
            elements: [
              {
                type: 'button',
                text: { type: 'plain_text', text: 'View Profile' },
                url: `${ADMIN_BASE_URL}/admin/customers`
              }
            ]
          }
        ]
      });
      console.log(`✅ Slack notification sent: new_user for ID ${data.userId}`);
    } catch (error) {
      console.error('❌ Failed to send Slack new_user notification:', error);
    }
  },

  /**
   * Triggers an alert when a support ticket is filed
   */
  async supportTicket(data: SupportTicketPayload) {
    if (!webhook) {
      console.warn('⚠️ Slack Webhook not configured. Skipped supportTicket notification.');
      return;
    }

    try {
      await webhook.send({
        channel: process.env.SLACK_CHANNEL_ID,
        icon_emoji: ICON_EMOJI,
        text: `🎫 New Support Ticket! (#${data.ticketId})`,
        blocks: [
          {
            type: 'section',
            text: { type: 'mrkdwn', text: `🎫 *New Support Ticket!* (#${data.ticketId})` }
          },
          {
            type: 'section',
            fields: [
              { type: 'mrkdwn', text: `*User:*\n${data.userName}` },
              { type: 'mrkdwn', text: `*Priority:*\n${data.priority}` },
              { type: 'mrkdwn', text: `*Subject:*\n${data.subject}` }
            ]
          },
          {
            type: 'section',
            text: { type: 'mrkdwn', text: `*Message:*\n${data.message}` }
          },
          {
            type: 'actions',
            elements: [
              {
                type: 'button',
                text: { type: 'plain_text', text: 'Respond' },
                url: `${ADMIN_BASE_URL}/admin/support`
              }
            ]
          }
        ]
      });
      console.log(`✅ Slack notification sent: support_ticket for ID ${data.ticketId}`);
    } catch (error) {
      console.error('❌ Failed to send Slack support_ticket notification:', error);
    }
  }
};
