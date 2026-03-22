const fs = require('fs');
const path = require('path');

const formatCurrency = (value = 0) => `P${Number(value || 0).toFixed(2)}`;

const GEMINI_LOGO_PATH = path.resolve(__dirname, '../../Gemini_Generated_Image_spmqrpspmqrpspmq.png');
const LOGO_CID = 'himighub-logo';
const LOGO_FALLBACK_URL = 'https://i.imgur.com/8Q5g6l7.png';

const getLogoAsset = () => {
  if (fs.existsSync(GEMINI_LOGO_PATH)) {
    return {
      src: `cid:${LOGO_CID}`,
      attachments: [
        {
          filename: 'himighub-logo.png',
          path: GEMINI_LOGO_PATH,
          cid: LOGO_CID,
        },
      ],
    };
  }

  return {
    src: LOGO_FALLBACK_URL,
    attachments: [],
  };
};

const baseTemplate = ({ title, subtitle, content, logoSrc }) => `
<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${title}</title>
  </head>
  <body style="margin:0;padding:0;background-color:#F5F5F0;font-family:'Montserrat', 'Helvetica Neue', Helvetica, Arial, sans-serif;color:#2D3748;line-height:1.6;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="padding:40px 16px;background-color:#F5F5F0;">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 10px 25px rgba(0,0,0,0.05);border:1px solid #E2E8F0;">
            <tr>
              <td style="background:linear-gradient(135deg, #1A202C 0%, #2D3748 100%);color:#ffffff;padding:40px 32px;text-align:center;">
                <img src="${logoSrc}" alt="HIMIGHUB Logo" style="height: 56px; margin-bottom: 20px; object-fit: contain; filter: drop-shadow(0 4px 6px rgba(0,0,0,0.3));" />
                <h1 style="margin:0;font-size:28px;letter-spacing:1px;font-weight:800;text-transform:uppercase;">HIMIGHUB</h1>
                <p style="margin:8px 0 0;font-size:15px;color:#A0AEC0;letter-spacing:0.5px;">${subtitle}</p>
              </td>
            </tr>
            <tr>
              <td style="padding:40px 32px;background:#ffffff;">
                ${content}
              </td>
            </tr>
            <tr>
              <td style="padding:24px 32px;background:#F7FAFC;color:#718096;font-size:12px;text-align:center;border-top:1px solid #E2E8F0;">
                <p style="margin:0 0 8px;"><strong>HIMIGHUB</strong> &bull; Premier Musical Instruments & Gear</p>
                <p style="margin:0;">&copy; ${new Date().getFullYear()} HIMIGHUB. All rights reserved.</p>
                <p style="margin:8px 0 0;font-size:11px;color:#A0AEC0;">This is an automated message. Please do not reply.</p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>
`;

const buildOrderReceiptEmail = ({ customerName, order }) => {
  const orderId = order?._id?.toString?.() || '';
  const shortId = orderId.slice(-6).toUpperCase();
  const items = Array.isArray(order?.items) ? order.items : [];
  const itemsRows = items
    .map(
      (item) => `
      <tr>
        <td style="padding:16px;border-bottom:1px solid #E2E8F0;color:#2D3748;font-size:14px;font-weight:600;">${item.name || 'Instrument'}</td>
        <td style="padding:16px;border-bottom:1px solid #E2E8F0;text-align:center;color:#4A5568;font-size:14px;">${item.quantity || 1}</td>
        <td style="padding:16px;border-bottom:1px solid #E2E8F0;text-align:right;color:#2D3748;font-size:14px;font-weight:600;">${formatCurrency((item.price || 0) * (item.quantity || 1))}</td>
      </tr>
    `
    )
    .join('');

  const shipping = order?.shippingAddress || {};
  const logoAsset = getLogoAsset();

  const html = baseTemplate({
    title: `Order Receipt #${shortId}`,
    subtitle: `Receipt for Order #${shortId}`,
    logoSrc: logoAsset.src,
    content: `
      <p style="margin:0 0 16px;font-size:16px;">Hello <strong style="color:#1A202C;">${customerName || 'Music Enthusiast'}</strong>,</p>
      <p style="margin:0 0 24px;color:#4A5568;font-size:15px;line-height:1.6;">Thank you for your purchase from HIMIGHUB! We're thrilled to equip you with your new gear. Below are the details of your order.</p>

      <div style="background:#F7FAFC;border:1px solid #E2E8F0;border-radius:12px;overflow:hidden;margin-bottom:24px;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
          <tr style="background:#EDF2F7;">
            <th align="left" style="padding:16px;font-size:13px;font-weight:700;color:#4A5568;text-transform:uppercase;letter-spacing:0.5px;">Item</th>
            <th align="center" style="padding:16px;font-size:13px;font-weight:700;color:#4A5568;text-transform:uppercase;letter-spacing:0.5px;">Qty</th>
            <th align="right" style="padding:16px;font-size:13px;font-weight:700;color:#4A5568;text-transform:uppercase;letter-spacing:0.5px;">Subtotal</th>
          </tr>
          ${itemsRows}
        </table>
      </div>

      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-left:auto;width:100%;max-width:300px;margin-bottom:32px;">
        <tr><td style="padding:6px 0;color:#718096;font-size:14px;">Subtotal</td><td style="padding:6px 0;text-align:right;font-size:14px;">${formatCurrency(order?.itemsPrice)}</td></tr>
        <tr><td style="padding:6px 0;color:#718096;font-size:14px;">Shipping</td><td style="padding:6px 0;text-align:right;font-size:14px;">${formatCurrency(order?.shippingPrice)}</td></tr>
        <tr><td style="padding:6px 0;color:#E53E3E;font-size:14px;">Discount</td><td style="padding:6px 0;text-align:right;color:#E53E3E;font-size:14px;">-${formatCurrency(order?.discountApplied)}</td></tr>
        <tr>
          <td style="padding:12px 0 0;font-weight:800;font-size:18px;color:#1A202C;border-top:2px solid #E2E8F0;margin-top:6px;">Total</td>
          <td style="padding:12px 0 0;text-align:right;font-weight:800;font-size:18px;color:#1A202C;border-top:2px solid #E2E8F0;margin-top:6px;">${formatCurrency(order?.totalPrice)}</td>
        </tr>
      </table>

      <div style="padding:20px;border:1px solid #E2E8F0;border-radius:12px;background:#ffffff;border-left:4px solid #F6AD55;">
        <h3 style="margin:0 0 10px;font-size:15px;color:#2D3748;font-weight:700;text-transform:uppercase;letter-spacing:0.5px;">Shipping Destination</h3>
        <p style="margin:0;color:#4A5568;font-size:14px;line-height:1.5;">
          ${shipping.street || ''}<br>
          ${shipping.city || ''}, ${shipping.state || ''} ${shipping.zip || ''}<br>
          ${shipping.country || ''}
        </p>
      </div>
    `,
  });

  const text = `Order Receipt #${shortId}\n\nHi ${customerName || 'Music Enthusiast'},\nThank you for choosing HIMIGHUB! Your receipt is attached in this email body.\nTotal: ${formatCurrency(order?.totalPrice)}.`;

  return {
    subject: `HIMIGHUB Receipt - Order #${shortId}`,
    text,
    html,
    attachments: logoAsset.attachments,
  };
};

const buildOrderStatusEmail = ({ customerName, order, status }) => {
  const orderId = order?._id?.toString?.() || '';
  const shortId = orderId.slice(-6).toUpperCase();

  const logoAsset = getLogoAsset();

  const html = baseTemplate({
    title: `Order #${shortId} Status Updated`,
    subtitle: `Update on your recent purchase`,
    logoSrc: logoAsset.src,
    content: `
      <p style="margin:0 0 16px;font-size:16px;">Hello <strong style="color:#1A202C;">${customerName || 'Music Enthusiast'}</strong>,</p>
      <p style="margin:0 0 24px;color:#4A5568;font-size:15px;">The status for your order <strong>#${shortId}</strong> has been updated.</p>
      
      <div style="text-align:center;padding:32px 20px;background:#F7FAFC;border:1px solid #E2E8F0;border-radius:12px;margin-bottom:24px;">
        <span style="display:block;font-size:13px;color:#718096;text-transform:uppercase;letter-spacing:1px;margin-bottom:12px;">Current Status</span>
        <div style="display:inline-block;padding:12px 24px;border-radius:8px;background:linear-gradient(135deg, #F6AD55 0%, #DD6B20 100%);color:#ffffff;font-size:18px;font-weight:800;letter-spacing:0.5px;text-transform:uppercase;box-shadow:0 4px 6px rgba(221, 107, 32, 0.2);">${status}</div>
      </div>

      <p style="margin:0;color:#4A5568;font-size:15px;text-align:center;">Order total: <strong style="color:#1A202C;">${formatCurrency(order?.totalPrice)}</strong></p>
      <p style="margin:24px 0 0;color:#718096;font-size:14px;text-align:center;">If you have any questions, feel free to reply to this email.</p>
    `,
  });

  const text = `Hi ${customerName || 'Music Enthusiast'}, your order #${shortId} is now ${status}.`;

  return {
    subject: `Order #${shortId} Status Updated`,
    text,
    html,
    attachments: logoAsset.attachments,
  };
};

module.exports = {
  buildOrderReceiptEmail,
  buildOrderStatusEmail,
};