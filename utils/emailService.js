const nodemailer = require('nodemailer');

const hasSmtpConfig = Boolean(
  process.env.SMTP_HOST &&
  process.env.SMTP_PORT &&
  process.env.SMTP_USER &&
  process.env.SMTP_PASS
);

let transporter = null;

const getTransporter = () => {
  if (!hasSmtpConfig) return null;
  if (transporter) return transporter;

  transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT),
    secure: String(process.env.SMTP_SECURE || 'false') === 'true',
    family: 4,
    connectionTimeout: Number(process.env.SMTP_CONNECTION_TIMEOUT_MS || 10000),
    greetingTimeout: Number(process.env.SMTP_GREETING_TIMEOUT_MS || 10000),
    socketTimeout: Number(process.env.SMTP_SOCKET_TIMEOUT_MS || 20000),
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });

  return transporter;
};

const getFromAddress = () => {
  const smtpUser = process.env.SMTP_USER || '';
  const configuredFrom = process.env.SMTP_FROM;

  if (!configuredFrom) {
    return smtpUser ? `HIMIGHUB <${smtpUser}>` : 'HIMIGHUB';
  }

  // If an old brand name was left in env, force consistent HIMIGHUB sender branding.
  if (/mobileessence/i.test(configuredFrom)) {
    const emailMatch = configuredFrom.match(/<([^>]+)>/);
    const email = emailMatch?.[1] || smtpUser;
    return email ? `HIMIGHUB <${email}>` : 'HIMIGHUB';
  }

  return configuredFrom;
};

const sendEmail = async ({ to, subject, text, html, attachments = [] }) => {
  const tx = getTransporter();
  if (!tx) {
    const missing = ['SMTP_HOST', 'SMTP_PORT', 'SMTP_USER', 'SMTP_PASS']
      .filter((key) => !process.env[key]);
    console.warn('[Email] SMTP not configured. Skipping email:', {
      subject,
      to,
      missing,
    });
    return { skipped: true };
  }

  await tx.sendMail({
    from: getFromAddress(),
    to,
    subject,
    text,
    html,
    attachments,
  });

  return { skipped: false };
};

module.exports = { sendEmail };