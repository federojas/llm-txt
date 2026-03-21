-- CreateEnum
CREATE TYPE "JobStatus" AS ENUM ('PENDING', 'PROCESSING', 'COMPLETED', 'FAILED');

-- CreateTable
CREATE TABLE "crawl_jobs" (
    "id" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "preset" TEXT NOT NULL,
    "status" "JobStatus" NOT NULL DEFAULT 'PENDING',
    "result" JSONB,
    "error" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "crawl_jobs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "crawl_jobs_status_createdAt_idx" ON "crawl_jobs"("status", "createdAt");

-- CreateIndex
CREATE INDEX "crawl_jobs_createdAt_idx" ON "crawl_jobs"("createdAt");

-- CreateIndex
CREATE INDEX "crawl_jobs_url_idx" ON "crawl_jobs"("url");
