const functions = require('firebase-functions');
const { updateDashboardStats, initializeDashboardStats } = require('./dashboard-stats');

// Export all functions
exports.updateDashboardStats = updateDashboardStats;
exports.initializeDashboardStats = initializeDashboardStats;

// Example function to test deployment
exports.helloWorld = functions.https.onRequest((request, response) => {
  response.send("Hello from Firebase!");
});