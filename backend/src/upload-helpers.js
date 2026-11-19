const { prisma } = require('./prisma');

// --- Helper: aggregate upload stats in ONE query ---
async function recountUploadStats(uploadId) {
  const [statusRows, deliveryRows] = await Promise.all([
    prisma.$queryRaw`
      SELECT
        COUNT(*)::int                                          AS "totalRows",
        COUNT(*) FILTER (WHERE status = 'valid')::int         AS "validEmails",
        COUNT(*) FILTER (WHERE status = 'invalid')::int       AS "invalidEmails",
        COUNT(*) FILTER (WHERE status = 'duplicate')::int     AS "duplicateEmails",
        COUNT(*) FILTER (WHERE status = 'unsubscribed')::int  AS "unsubscribedEmails"
      FROM contacts
      WHERE upload_id = ${uploadId}
    `,
    prisma.$queryRaw`
      SELECT
        COUNT(*) FILTER (WHERE delivery_status = 'sent')::int     AS "sentCount",
        COUNT(*) FILTER (WHERE delivery_status = 'failed')::int   AS "failedCount",
        COUNT(*) FILTER (WHERE delivery_status IN ('pending', 'sending'))::int AS "pendingCount",
        COUNT(*) FILTER (WHERE delivery_status = 'skipped')::int  AS "skippedCount",
        COUNT(*) FILTER (WHERE status = 'valid' AND delivery_status = 'idle')::int AS "notQueuedCount"
      FROM contacts
      WHERE upload_id = ${uploadId}
    `,
  ]);
  const d = deliveryRows[0];
  return {
    ...statusRows[0],
    ...d,
    totalCount: d.sentCount + d.failedCount + d.pendingCount + d.skippedCount,
  };
}

// Live delivery counters for an upload (never trusts the stored counters,
// which drift when contacts are edited/deleted or senders overlap).
const FINISHED = ['completed', 'completed_with_errors', 'failed'];

// Final status derived from the actual delivery counts.
function finishedStatusFor(c) {
  if (c.sentCount === 0 && c.failedCount > 0) return 'failed';
  if (c.failedCount > 0) return 'completed_with_errors';
  return 'completed';
}

// If currentStatus is a finished state, the returned object also carries a
// corrected `status` (e.g. failed contacts were deleted -> 'completed').
async function liveDeliveryCounts(uploadId, currentStatus) {
  const c = await recountUploadStats(uploadId);
  const statusFix = FINISHED.includes(currentStatus) && c.pendingCount === 0
    ? { status: finishedStatusFor(c) }
    : {};
  const pendingDisplay = c.pendingCount + c.notQueuedCount;
  return {
    ...statusFix,
    totalRows: c.totalRows,
    validEmails: c.validEmails,
    invalidEmails: c.invalidEmails,
    duplicateEmails: c.duplicateEmails,
    unsubscribedEmails: c.unsubscribedEmails,
    totalCount: c.totalCount + c.notQueuedCount,
    sentCount: c.sentCount,
    failedCount: c.failedCount,
    pendingCount: pendingDisplay,
    skippedCount: c.skippedCount,
  };
}

// --- Helper: finalize upload status once all contacts have a terminal delivery status ---
async function checkUploadCompletion(uploadId) {
  const upload = await prisma.upload.findUnique({ where: { id: uploadId } });
  if (!upload) return 'failed';

  const pendingCount = await prisma.contact.count({
    where: { uploadId, deliveryStatus: { in: ['pending', 'sending'] } },
  });

  if (pendingCount === 0) {
    const counts = await recountUploadStats(uploadId);
    let finalStatus = upload.status;
    if (upload.status === 'processing' || FINISHED.includes(upload.status)) {
      finalStatus = finishedStatusFor(counts);
    }
    await prisma.upload.update({
      where: { id: uploadId },
      data: {
        status: finalStatus,
        sentCount: counts.sentCount,
        failedCount: counts.failedCount,
        pendingCount: counts.pendingCount,
        skippedCount: counts.skippedCount,
        totalCount: counts.totalCount,
      },
    });
    return finalStatus;
  }
  return upload.status;
}

module.exports = { recountUploadStats, checkUploadCompletion, liveDeliveryCounts };
