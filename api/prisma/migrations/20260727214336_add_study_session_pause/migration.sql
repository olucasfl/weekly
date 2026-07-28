-- AlterTable
ALTER TABLE "StudySession" ADD COLUMN     "pausedAt" TIMESTAMP(3),
ADD COLUMN     "totalPausedMs" INTEGER NOT NULL DEFAULT 0;
