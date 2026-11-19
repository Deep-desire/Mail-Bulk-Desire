const df = require('durable-functions');
const { logCampaign } = require('../campaign-log');

// Orchestrators must not do I/O directly, so they log through this activity.
async function logCampaignActivity(input) {
  const { uploadId, level, event, message, meta } = input || {};
  await logCampaign(uploadId, level || 'info', event || 'orchestrator', message || '', meta);
  return true;
}

df.app.activity('logCampaignActivity', { handler: logCampaignActivity });

module.exports = { logCampaignActivity };
