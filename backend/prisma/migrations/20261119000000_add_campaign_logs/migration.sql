-- CreateTable
CREATE TABLE "campaign_logs" (
    "id" TEXT NOT NULL,
    "upload_id" TEXT,
    "level" TEXT NOT NULL DEFAULT 'info',
    "event" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "meta" JSONB,
    "source" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "campaign_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "campaign_logs_upload_id_created_at_idx" ON "campaign_logs"("upload_id", "created_at");
CREATE INDEX "campaign_logs_created_at_idx" ON "campaign_logs"("created_at");
CREATE INDEX "campaign_logs_level_idx" ON "campaign_logs"("level");
