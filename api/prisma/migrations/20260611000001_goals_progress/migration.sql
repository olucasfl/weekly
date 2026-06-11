ALTER TABLE "Goal" ADD COLUMN IF NOT EXISTS "weekStart" TEXT;
ALTER TABLE "Goal" ALTER COLUMN "target" SET DEFAULT 1;

-- Drop old columns no longer used
ALTER TABLE "Goal" DROP COLUMN IF EXISTS "period";
ALTER TABLE "Goal" DROP COLUMN IF EXISTS "kind";

CREATE TABLE "GoalProgress" (
    "id"        TEXT    NOT NULL,
    "userId"    TEXT    NOT NULL,
    "goalId"    TEXT    NOT NULL,
    "weekStart" TEXT    NOT NULL,
    "count"     INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "GoalProgress_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "GoalProgress_userId_goalId_weekStart_key" ON "GoalProgress"("userId", "goalId", "weekStart");
CREATE INDEX "GoalProgress_userId_weekStart_idx" ON "GoalProgress"("userId", "weekStart");

ALTER TABLE "GoalProgress" ADD CONSTRAINT "GoalProgress_goalId_fkey" FOREIGN KEY ("goalId") REFERENCES "Goal"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "GoalProgress" ADD CONSTRAINT "GoalProgress_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
