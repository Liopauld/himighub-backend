const nodemailer = require('nodemailer');
const dns = require('dns').promises;
const fs = require('fs').promises;
const path = require('path');

const hasSmtpConfig = Boolean(
  process.env.SMTP_HOST &&
  process.env.SMTP_PORT &&
  process.env.SMTP_USER &&
  process.env.SMTP_PASS
);

const hasResendConfig = Boolean(process.env.RESEND_API_KEY);
const rawBrevoApiKey = String(process.env.BREVO_API_KEY || '').trim();
const brevoKeyLooksLikeSmtpKey = /^xsmtp/i.test(rawBrevoApiKey);
const hasBrevoConfig = Boolean(rawBrevoApiKey) && !brevoKeyLooksLikeSmtpKey;

if (brevoKeyLooksLikeSmtpKey) {
  console.warn('[Email] BREVO_API_KEY appears to be an SMTP key (xsmtp...). Skipping Brevo API provider and relying on SMTP fallback.');
}

const preferredProvider = String(process.env.EMAIL_PROVIDER || 'auto').trim().toLowerCase();

console.log('[Email] Provider config', {
  preferredProvider,
  brevoConfigured: hasBrevoConfig,
  smtpConfigured: hasSmtpConfig,
  resendConfigured: hasResendConfig,
});

let transporter = null;
let transporterPromise = null;

const buildTransportConfig = async ({ port, secure } = {}) => {
  const smtpHost = process.env.SMTP_HOST;
  const forceIpv4 = String(process.env.SMTP_FORCE_IPV4 || 'true') === 'true';
  let resolvedHost = smtpHost;

  if (forceIpv4) {
    try {
      const lookup = await dns.lookup(smtpHost, { family: 4 });
      resolvedHost = lookup.address || smtpHost;
    } catch (err) {
      console.warn('[Email] IPv4 lookup failed, using original SMTP host:', err?.message || err);
    }
  }

  const config = {
    host: resolvedHost,
    port: Number(port ?? process.env.SMTP_PORT),
    secure: typeof secure === 'boolean' ? secure : String(process.env.SMTP_SECURE || 'false') === 'true',
    connectionTimeout: Number(process.env.SMTP_CONNECTION_TIMEOUT_MS || 10000),
    greetingTimeout: Number(process.env.SMTP_GREETING_TIMEOUT_MS || 10000),
    socketTimeout: Number(process.env.SMTP_SOCKET_TIMEOUT_MS || 20000),
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  };

  if (resolvedHost !== smtpHost) {
    config.tls = { ...(config.tls || {}), servername: smtpHost };
  }

  return config;
};

const getTransporter = async () => {
  if (!hasSmtpConfig) return null;
  if (transporter) return transporter;
  if (transporterPromise) return transporterPromise;

  transporterPromise = (async () => {
    const config = await buildTransportConfig();
    transporter = nodemailer.createTransport(config);
    return transporter;
  })();

  return transporterPromise;
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

const sendViaResend = async ({ to, subject, text, html }) => {
  if (!hasResendConfig) {
    throw new Error('Resend fallback not configured (missing RESEND_API_KEY).');
  }

  const from = process.env.RESEND_FROM || getFromAddress();
  const payload = {
    from,
    to: Array.isArray(to) ? to : [to],
    subject,
    html: html || `<pre>${String(text || '').replace(/</g, '&lt;')}</pre>`,
    text: text || undefined,
  };

  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Resend API failed (${response.status}): ${errText}`);
  }
};

const getBrevoSender = () => {
  const fromAddress = getFromAddress();
  const explicitEmail = String(process.env.BREVO_FROM_EMAIL || '').trim();
  const explicitName = String(process.env.BREVO_FROM_NAME || '').trim();

  if (explicitEmail) {
    return {
      email: explicitEmail,
      name: explicitName || 'HIMIGHUB',
    };
  }

  const bracketMatch = fromAddress.match(/^(.*)<([^>]+)>$/);
  if (bracketMatch) {
    const name = String(bracketMatch[1] || '').trim() || 'HIMIGHUB';
    const email = String(bracketMatch[2] || '').trim();
    if (email) {
      return { email, name };
    }
  }

  const plainEmailMatch = fromAddress.match(/^[^\s@]+@[^\s@]+\.[^\s@]+$/);
  if (plainEmailMatch) {
    return { email: fromAddress.trim(), name: 'HIMIGHUB' };
  }

  return null;
};

const toBase64 = async (item) => {
  if (item == null) return '';
  if (Buffer.isBuffer(item)) return item.toString('base64');
  if (typeof item === 'string') return Buffer.from(item).toString('base64');
  if (item instanceof Uint8Array) return Buffer.from(item).toString('base64');
  return '';
};

const mapAttachmentsForBrevo = async (attachments = []) => {
  const inlineImage = [];
  const attachment = [];

  for (const file of attachments) {
    try {
      const filename = file?.filename || 'attachment';
      const hasCid = Boolean(file?.cid);
      let contentBase64 = '';

      if (file?.path) {
        const absolutePath = path.isAbsolute(file.path)
          ? file.path
          : path.resolve(process.cwd(), file.path);
        const binary = await fs.readFile(absolutePath);
        contentBase64 = binary.toString('base64');
      } else if (file?.content) {
        contentBase64 = await toBase64(file.content);
      }

      if (!contentBase64) continue;

      const mapped = {
        name: filename,
        content: contentBase64,
      };

      if (hasCid) {
        inlineImage.push(mapped);
      } else {
        attachment.push(mapped);
      }
    } catch (err) {
      console.warn('[Email] Failed to map attachment for Brevo:', file?.filename || 'unknown', err?.message || err);
    }
  }

  return { inlineImage, attachment };
};

const sendViaBrevo = async ({ to, subject, text, html, attachments = [] }) => {
  if (!hasBrevoConfig) {
    throw new Error('Brevo is not configured (missing BREVO_API_KEY).');
  }

  const sender = getBrevoSender();
  if (!sender?.email) {
    throw new Error('Brevo sender email is missing. Set BREVO_FROM_EMAIL or SMTP_FROM/SMTP_USER.');
  }

  const toList = (Array.isArray(to) ? to : [to])
    .filter(Boolean)
    .map((email) => ({ email: String(email).trim() }));

  if (toList.length === 0) {
    throw new Error('Brevo send failed: no recipient provided.');
  }

  const mappedAttachments = await mapAttachmentsForBrevo(attachments);
  const payload = {
    sender,
    to: toList,
    subject,
    htmlContent: html || undefined,
    textContent: text || undefined,
  };

  if (mappedAttachments.inlineImage.length > 0) {
    payload.inlineImage = mappedAttachments.inlineImage;
  }
  if (mappedAttachments.attachment.length > 0) {
    payload.attachment = mappedAttachments.attachment;
  }

  const response = await fetch('https://api.brevo.com/v3/smtp/email', {
    method: 'POST',
    headers: {
      'api-key': process.env.BREVO_API_KEY,
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Brevo API failed (${response.status}): ${errText}`);
  }
};

const sendEmail = async ({ to, subject, text, html, attachments = [] }) => {
  const wantsBrevo = preferredProvider === 'brevo' || (preferredProvider === 'auto' && hasBrevoConfig);

  if (wantsBrevo) {
    try {
      await sendViaBrevo({ to, subject, text, html, attachments });
      return { skipped: false, provider: 'brevo' };
    } catch (brevoErr) {
      console.warn('[Email] Brevo API failed, attempting fallback', {
        code: brevoErr?.code,
        message: brevoErr?.message || brevoErr,
        smtpConfigured: hasSmtpConfig,
        resendConfigured: hasResendConfig,
      });

      const txFallback = await getTransporter();
      if (txFallback) {
        const fallbackPayload = {
          from: getFromAddress(),
          to,
          subject,
          text,
          html,
          attachments,
        };
        await txFallback.sendMail(fallbackPayload);
        return { skipped: false, provider: 'smtp' };
      }

      if (hasResendConfig) {
        await sendViaResend({ to, subject, text, html });
        return { skipped: false, provider: 'resend' };
      }

      throw brevoErr;
    }
  }

  const tx = await getTransporter();
  if (!tx) {
    const missing = ['SMTP_HOST', 'SMTP_PORT', 'SMTP_USER', 'SMTP_PASS']
      .filter((key) => !process.env[key]);
    console.warn('[Email] SMTP not configured. Skipping email:', {
      subject,
      to,
      missing,
    });
    if (hasResendConfig) {
      await sendViaResend({ to, subject, text, html });
      return { skipped: false, provider: 'resend' };
    }
    return { skipped: true };
  }

  const payload = {
    from: getFromAddress(),
    to,
    subject,
    text,
    html,
    attachments,
  };

  try {
    await tx.sendMail(payload);
  } catch (err) {
    const code = String(err?.code || '').toUpperCase();
    const message = String(err?.message || '').toLowerCase();
    const isTimeoutLike = code === 'ETIMEDOUT' || code === 'ESOCKET' || code === 'ENETUNREACH' || message.includes('timeout');

    if (!isTimeoutLike) {
      throw err;
    }

    // Retry once with alternate SMTP mode (465 <-> 587) for provider/network compatibility.
    const primaryPort = Number(process.env.SMTP_PORT);
    const fallbackPort = Number(process.env.SMTP_FALLBACK_PORT || (primaryPort === 465 ? 587 : 465));
    const fallbackSecure =
      String(process.env.SMTP_FALLBACK_SECURE || '').trim() !== ''
        ? String(process.env.SMTP_FALLBACK_SECURE).toLowerCase() === 'true'
        : fallbackPort === 465;

    console.warn('[Email] Primary SMTP failed, attempting fallback', {
      code,
      message: err?.message,
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT),
      fallbackPort,
      fallbackSecure,
      resendConfigured: hasResendConfig,
    });

    const retryConfig = await buildTransportConfig({ port: fallbackPort, secure: fallbackSecure });
    const retryTransporter = nodemailer.createTransport(retryConfig);

    try {
      await retryTransporter.sendMail(payload);
    } catch (retryErr) {
      if (hasBrevoConfig) {
        console.warn('[Email] SMTP fallback failed, attempting Brevo API fallback');
        await sendViaBrevo({ to, subject, text, html, attachments });
        return { skipped: false, provider: 'brevo' };
      }

      if (hasResendConfig) {
        console.warn('[Email] SMTP fallback failed, attempting Resend API fallback');
        await sendViaResend({ to, subject, text, html });
        return { skipped: false, provider: 'resend' };
      }

      console.warn('[Email] SMTP fallback failed and Resend is not configured:', {
        code: retryErr?.code,
        message: retryErr?.message || retryErr,
        fallbackHost: process.env.SMTP_HOST,
        fallbackPort,
      });
      throw retryErr;
    }
  }

  return { skipped: false, provider: 'smtp' };
};

module.exports = { sendEmail };