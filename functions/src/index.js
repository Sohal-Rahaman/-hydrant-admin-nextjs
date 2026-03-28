const functions = require('firebase-functions');
const { updateDashboardStats, initializeDashboardStats } = require('./dashboard-stats');
const referrals = require('./referrals');

// Dashboard functions
exports.updateDashboardStats = updateDashboardStats;
exports.initializeDashboardStats = initializeDashboardStats;

// Referral system functions
exports.onOrderCreated = referrals.onOrderCreated;
exports.onOrderDelivered = referrals.onOrderDelivered;
exports.onOrderStatusChange = referrals.onOrderStatusChange;
exports.dailyReferralExpiry = referrals.dailyReferralExpiry;

// Example function to test deployment
exports.helloWorld = functions.https.onRequest((request, response) => {
  response.send("Hello from Firebase!");
});