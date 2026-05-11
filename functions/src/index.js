// 1. Initialize Firebase Admin SDK first
const admin = require('firebase-admin');
if (!admin.apps.length) {
  admin.initializeApp();
}

const functions = require('firebase-functions/v1');
const { updateDashboardStats, initializeDashboardStats } = require('./dashboard-stats');
const referrals = require('./referrals');
const proModel = require('./pro-model');
const slackNotify = require('./slack-notify');
exports.updateDashboardStats = updateDashboardStats;
exports.initializeDashboardStats = initializeDashboardStats;

// Referral system functions
exports.onOrderCreated = referrals.onOrderCreated;
exports.onOrderDelivered = referrals.onOrderDelivered;
exports.onOrderStatusChange = referrals.onOrderStatusChange;
exports.dailyReferralExpiry = referrals.dailyReferralExpiry;

// Hydrant 2.O Pro Model functions
exports.onUserCreate = proModel.onUserCreate;
exports.syncUserAuthDetails = proModel.syncUserAuthDetails;
exports.placeOrder = proModel.placeOrder;
exports.assignJar = proModel.assignJar;
exports.returnJar = proModel.returnJar;
exports.expireTrials = proModel.expireTrials;
exports.resetMonthlyJars = proModel.resetMonthlyJars;
exports.enrollPro = proModel.enrollPro;
exports.razorpayWebhook = proModel.razorpayWebhook;
exports.chargeOverdueJar = proModel.chargeOverdueJar;
exports.onOrderUpdateSlack = slackNotify.onOrderUpdate;
exports.onNewOrderAlert = slackNotify.onOrderCreatedSlack;
exports.onNewUserJoinAlert = slackNotify.onNewUserJoinAlert;
exports.onNewSupportTicketAlert = slackNotify.onNewSupportTicketAlert;

// Example function to test deployment
exports.helloWorld = functions.https.onRequest((request, response) => {
  response.send("Hello from Firebase!");
});