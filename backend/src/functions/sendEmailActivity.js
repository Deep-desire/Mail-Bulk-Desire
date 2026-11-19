const df = require('durable-functions');
const crypto = require('crypto');
const { prisma } = require('../prisma');
const { sendEmail } = require('../email');
const { renderTemplate } = require('../templates-service');
const { checkUploadCompletion } = require('../upload-helpers');
const { logCampaign, withDbRetry } = require('../campaign-log');

async function sendEmailActivity(input, context) {
  const { uploadId, templateId, contact } = input;

  // Idempotency: this activity is retried by the orchestrator, so never
  // re-send to a contact that is no longer pending (e.g. the email went out
  // but a later DB write failed on the previous attempt).
  const current = await withDbRetry(
    () => prisma.contact.findUnique({ where: { id: contact.id }, select: { deliveryStatus: true } }),
    'load contact'
  );
  if (!current || current.deliveryStatus !== 'pending') {
    await logCampaign(uploadId, 'info', 'skip_not_pending', `${contact.email} is '${current ? current.deliveryStatus : 'deleted'}', skipping`);
    return { sent: false, contactId: contact.id, skipped: true };
  }

  // Campaign may have been cancelled/reset from the UI.
  const upload = await withDbRetry(
    () => prisma.upload.findUnique({ where: { id: uploadId }, select: { status: true } }),
    'load upload'
  );
  if (!upload || (upload.status !== 'processing' && upload.status !== 'scheduled')) {
    await logCampaign(uploadId, 'warn', 'campaign_not_active', `Upload status is '${upload ? upload.status : 'deleted'}', not sending to ${contact.email}`);
    return { sent: false, contactId: contact.id, stop: true };
  }

  const template = await withDbRetry(() => prisma.template.findUnique({ where: { id: templateId } }), 'load template');
  if (!template) {
    await logCampaign(uploadId, 'error', 'template_missing', `Template ${templateId} not found`);
    return { sent: false, contactId: contact.id, stop: true };
  }

  const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
  const token = crypto
    .createHash('sha256')
    .update(contact.email + 'desire-unsubscribe-salt')
    .digest('hex')
    .substring(0, 32);
  const unsubscribeLink = `${frontendUrl}/unsubscribe/${token}`;

  const rendered = renderTemplate(
    { id: template.id, subject: template.subject, htmlBody: template.htmlBody, plainTextBody: template.plainTextBody },
    { name: contact.name, email: contact.email, unsubscribeLink }
  );

  let sent = false;
  let lastError = null;
  let deliveryProvider = null;
  const started = Date.now();

  for (let attempt = 0; attempt < 3 && !sent; attempt++) {
    try {
      const result = await sendEmail({ to: contact.email, subject: rendered.subject, html: rendered.html, text: rendered.text });
      sent = true;
      deliveryProvider = result.provider;
      if (result.providerErrors && result.providerErrors.length) {
        await logCampaign(uploadId, 'warn', 'provider_fallback',
          `Sent to ${contact.email} via ${result.provider} after other providers failed`,
          { providerErrors: result.providerErrors });
      }
    } catch (err) {
      lastError = err;
      await logCampaign(uploadId, 'warn', 'send_attempt_failed',
        `Attempt ${attempt + 1}/3 failed for ${contact.email}: ${err.message}`,
        { providerErrors: err.providerErrors });
      if (attempt < 2) await new Promise((r) => setTimeout(r, 2000));
    }
  }

  await withDbRetry(() => prisma.contact.update({
    where: { id: contact.id },
    data: {
      deliveryStatus: sent ? 'sent' : 'failed',
      deliveryError: sent ? null : ((lastError && lastError.message) || 'Failed to deliver email'),
      deliveryProvider,
      sentAt: new Date(),
    },
  }), 'update contact');

  await withDbRetry(() => prisma.upload.update({
    where: { id: uploadId },
    data: {
      sentCount: sent ? { increment: 1 } : undefined,
      failedCount: !sent ? { increment: 1 } : undefined,
      pendingCount: { decrement: 1 },
    },
  }), 'update upload counters');

  await logCampaign(uploadId, sent ? 'info' : 'error', sent ? 'send_ok' : 'send_failed',
    sent
      ? `Sent to ${contact.email} via ${deliveryProvider} (${Date.now() - started}ms)`
      : `Gave up on ${contact.email}: ${lastError && lastError.message}`);

  await withDbRetry(() => checkUploadCompletion(uploadId), 'check completion');

  return { sent, contactId: contact.id };
}

df.app.activity('sendEmailActivity', { handler: sendEmailActivity });

module.exports = { sendEmailActivity };
