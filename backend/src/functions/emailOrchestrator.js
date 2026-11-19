const df = require('durable-functions');

// How many pending contacts to pull from the DB per query -- just a query
// page size. Sends are always sequential with a random delay between each.
const FETCH_PAGE_SIZE = parseInt(process.env.EMAIL_BATCH_SIZE || '25', 10);

// Every activity is retried. Previously a single transient failure (DB
// connection blip, host restart mid-activity) threw out of the generator,
// the orchestration went to "Failed", and the campaign silently stopped with
// contacts left in 'pending' forever.
const retry = new df.RetryOptions(5000, 5);
retry.backoffCoefficient = 2;
retry.maxRetryIntervalInMilliseconds = 60000;

function* log(context, uploadId, level, event, message, meta) {
  try {
    yield context.df.callActivity('logCampaignActivity', { uploadId, level, event, message, meta });
  } catch (_e) {
    // logging must never stop the campaign
  }
}

function* emailOrchestrator(context) {
  const input = context.df.getInput() || {};
  const { uploadId, templateId, scheduledAt } = input;

  if (scheduledAt) {
    yield* log(context, uploadId, 'info', 'scheduled_wait', `Waiting until ${scheduledAt}`);
    yield context.df.createTimer(new Date(scheduledAt));
  }

  yield* log(context, uploadId, 'info', 'orchestrator_start', `Orchestration ${context.df.instanceId} running`);

  let totalSent = 0;
  let totalFailed = 0;

  try {
    const contacts = yield context.df.callActivityWithRetry('getPendingContactsActivity', retry, {
      uploadId,
      batchSize: FETCH_PAGE_SIZE,
    });

    if (!contacts || contacts.length === 0) {
      yield* log(context, uploadId, 'info', 'orchestrator_done', 'No pending contacts left. Campaign finished.');
      return { uploadId, status: 'completed' };
    }

    for (let i = 0; i < contacts.length; i++) {
      const result = yield context.df.callActivityWithRetry('sendEmailActivity', retry, {
        uploadId,
        templateId,
        contact: contacts[i],
      });
      if (result && result.stop) {
        yield* log(context, uploadId, 'warn', 'orchestrator_stop', 'Campaign no longer active, stopping');
        return { uploadId, totalSent, totalFailed, status: 'stopped' };
      }
      if (result && result.sent) totalSent++;
      else if (!(result && result.skipped)) totalFailed++;

      const isLastOverall = i === contacts.length - 1 && contacts.length < FETCH_PAGE_SIZE;
      if (!isLastOverall) {
        const delayMs = yield context.df.callActivity('getRandomDelayActivity');
        // currentUtcDateTime is replay-safe; Date.now() is not.
        const fireAt = new Date(context.df.currentUtcDateTime.getTime() + delayMs);
        yield context.df.createTimer(fireAt);
      }
    }

    yield* log(context, uploadId, 'info', 'page_complete', `Page of ${contacts.length} done: sent=${totalSent} failed=${totalFailed}`);

    if (contacts.length < FETCH_PAGE_SIZE) {
      yield* log(context, uploadId, 'info', 'orchestrator_done', 'Last page processed. Campaign finished.');
      return { uploadId, totalSent, totalFailed, status: 'completed' };
    }
  } catch (err) {
    yield* log(context, uploadId, 'error', 'orchestrator_failed',
      `Orchestration crashed after retries: ${err && err.message ? err.message : String(err)}. Use "Resume sending" on the campaign.`);
    throw err;
  }

  // Restart with a fresh history for the next page. Replaying hundreds of
  // send/timer events per step on a 700+ list slows the host down a lot.
  context.df.continueAsNew({ uploadId, templateId });
  return undefined;
}

df.app.orchestration('emailOrchestrator', emailOrchestrator);

module.exports = { emailOrchestrator };
