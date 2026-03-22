const admin = require('firebase-admin');
const path = require('path');

const serviceAccountPath = path.resolve(
  process.env.FIREBASE_SERVICE_ACCOUNT_KEY || './config/firebase-service-account.json'
);
const serviceAccount = require(serviceAccountPath);
const configuredProjectId = process.env.FIREBASE_PROJECT_ID || serviceAccount.project_id;

if (process.env.FIREBASE_PROJECT_ID && serviceAccount.project_id && process.env.FIREBASE_PROJECT_ID !== serviceAccount.project_id) {
  throw new Error(
    `[Firebase] Project ID mismatch: FIREBASE_PROJECT_ID=${process.env.FIREBASE_PROJECT_ID} but service account project_id=${serviceAccount.project_id}.` +
      ' Update the deployed secret file or FIREBASE_PROJECT_ID so they match.'
  );
}

if (!serviceAccount.client_email || !serviceAccount.private_key) {
  throw new Error('[Firebase] Invalid service account file: missing client_email or private_key.');
}

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    projectId: configuredProjectId,
  });

  console.log('[Firebase] Admin initialized', {
    projectId: configuredProjectId,
    clientEmail: serviceAccount.client_email,
    keyPath: serviceAccountPath,
  });
}

module.exports = admin;
