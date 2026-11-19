const { prisma } = require('./prisma');

const SOURCE = process.env.FUNCTIONS_WORKER_RUNTIME ? 'azure' : (process.env.VERCEL ? 'vercel' : 'local');

// Write one campaign activity row. Never throws — logging must not be the
// thing that breaks a send loop.
async function logCampaign(uploadId, level, event, message, meta) {
  const line = `[campaign ${uploadId || '-'}] [${level}] ${event}: ${message}`;
  if (level === 'error') console.error(line); else if (level === 'warn') console.warn(line); else console.log(line);
  try {
    await prisma.campaignLog.create({
      data: {
        uploadId: uploadId || null,
        level,
        event,
        message: String(message).slice(0, 4000),
        meta: meta === undefined ? undefined : JSON.parse(JSON.stringify(meta)),
        source: SOURCE,
      },
    });
  } catch (err) {
    console.error(`[campaign-log write failed] ${err.message}`);
  }
}

// Retry a DB operation a few times — transient pooler/connection errors
// (Supabase "too many connections", P1001, etc.) were able to kill a whole
// campaign before.
async function withDbRetry(fn, label, attempts = 4) {
  let lastErr;
  for (let i = 0; i < attempts; i++) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      console.warn(`[db retry ${i + 1}/${attempts}] ${label}: ${err.message}`);
      await new Promise((r) => setTimeout(r, 1000 * (i + 1)));
    }
  }
  throw lastErr;
}

module.exports = { logCampaign, withDbRetry };
