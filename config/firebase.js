const admin = require('firebase-admin');
const fs = require('fs');
const path = require('path');

const defaultServiceAccountPath =
  process.env.NODE_ENV === 'production'
    ? '/etc/secrets/firebase-service-account.json'
    : './config/firebase-service-account.json';

const serviceAccountPath = path.resolve(
  process.env.FIREBASE_SERVICE_ACCOUNT_KEY || defaultServiceAccountPath
);

const parseServiceAccountFromEnv = () => {
  const rawJson = process.env.BACKEND_FIREBASE_SERVICE_ACCOUNT_JSON;
  if (!rawJson) return null;

  try {
    return JSON.parse(rawJson);
  } catch (err) {
    throw new Error('[Firebase] BACKEND_FIREBASE_SERVICE_ACCOUNT_JSON is not valid JSON.');
  }
};

const loadServiceAccountFromFile = () => {
  if (!fs.existsSync(serviceAccountPath)) {
    return null;
  }

  try {
    // eslint-disable-next-line import/no-dynamic-require, global-require
    return require(serviceAccountPath);
  } catch (err) {
    throw new Error(`[Firebase] Failed to read service account file at ${serviceAccountPath}: ${err.message}`);
  }
};

const serviceAccount = parseServiceAccountFromEnv() || loadServiceAccountFromFile();

if (!serviceAccount) {
  throw new Error(
    '[Firebase] Service account not found. Set BACKEND_FIREBASE_SERVICE_ACCOUNT_JSON or set FIREBASE_SERVICE_ACCOUNT_KEY to a valid file path (Render secret files are typically mounted at /etc/secrets/...).'
  );
}
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
