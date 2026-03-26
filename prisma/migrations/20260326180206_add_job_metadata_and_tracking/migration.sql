-- AlterTable
ALTER TABLE "crawl_jobs" ADD COLUMN     "resultMetadata" JSONB,
ADD COLUMN     "requestMetadata" JSONB,
ADD COLUMN     "correlationId" TEXT,
ADD COLUMN     "duration" INTEGER,
ADD COLUMN     "pagesProcessed" INTEGER,
ADD COLUMN     "apiCallsCount" INTEGER,
ADD COLUMN     "tokensUsed" INTEGER,
ADD COLUMN     "failureReason" TEXT,
ADD COLUMN     "attemptCount" INTEGER NOT NULL DEFAULT 1;

-- CreateIndex
CREATE UNIQUE INDEX "crawl_jobs_correlationId_key" ON "crawl_jobs"("correlationId");

-- CreateIndex
CREATE INDEX "crawl_jobs_correlationId_idx" ON "crawl_jobs"("correlationId");
