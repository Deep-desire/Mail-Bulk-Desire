const { app } = require('@azure/functions');
const df = require('durable-functions');

require('./emailOrchestrator');
require('./getPendingContactsActivity');
require('./sendEmailActivity');
require('./getRandomDelayActivity');
require('./logCampaignActivity');

const ACTIVE = ['Running', 'Pending', 'ContinuedAsNew'];

async function starterHandler(request, context) {
  const client = df.getClient(context);

  let body = {};
  try {
    body = (await request.json()) || {};
  } catch (_e) {
    body = {};
  }

  const { uploadId, templateId, scheduledAt } = body;
  if (!uploadId || !templateId) {
    return { status: 400, jsonBody: { error: 'uploadId and templateId are required' } };
  }

  // ONE orchestration per campaign: fixed instance id. If it is already
  // running, return it instead of starting a second sender (double-clicking
  // "Resume" used to start several parallel senders = duplicate emails).
  const instanceId = `campaign-${uploadId}`;
  const existing = await client.getStatus(instanceId).catch(() => null);
  if (existing && ACTIVE.includes(existing.runtimeStatus)) {
    context.log(`Orchestration '${instanceId}' already ${existing.runtimeStatus}; not starting another.`);
    return client.createCheckStatusResponse(request, instanceId);
  }

  await client.startNew('emailOrchestrator', { instanceId, input: { uploadId, templateId, scheduledAt } });
  context.log(`Started orchestration '${instanceId}' for Upload '${uploadId}'.`);

  return client.createCheckStatusResponse(request, instanceId);
}

app.http('startEmailOrchestration', {
  route: 'start-email-orchestration',
  methods: ['POST'],
  authLevel: 'function',
  extraInputs: [df.input.durableClient()],
  handler: starterHandler,
});

module.exports = { starterHandler };
