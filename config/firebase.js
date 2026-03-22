const admin = require('firebase-admin');
const path = require('path');

const serviceAccountPath = path.resolve(
  process.env.FIREBASE_SERVICE_ACCOUNT_KEY || './config/firebase-service-account.json'
);
const serviceAccount = require(serviceAccountPath);
const configuredProjectId = process.env.FIREBASE_PROJECT_ID || serviceAccount.project_id;

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    projectId: configuredProjectId,
  });
}

module.exports = admin;
