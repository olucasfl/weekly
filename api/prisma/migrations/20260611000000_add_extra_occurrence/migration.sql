CREATE TABLE "ExtraOccurrence" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "taskId" TEXT NOT NULL,
    "date" TEXT NOT NULL,
    CONSTRAINT "ExtraOccurrence_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ExtraOccurrence_userId_taskId_date_key" ON "ExtraOccurrence"("userId", "taskId", "date");
CREATE INDEX "ExtraOccurrence_userId_idx" ON "ExtraOccurrence"("userId");

ALTER TABLE "ExtraOccurrence" ADD CONSTRAINT "ExtraOccurrence_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "Task"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ExtraOccurrence" ADD CONSTRAINT "ExtraOccurrence_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
