-- A worker can have at most one running time entry (endedAt IS NULL).
-- Prisma cannot express partial indexes in schema.prisma, so it lives only in SQL.
CREATE UNIQUE INDEX "TimeEntry_one_running_per_user" ON "TimeEntry"("userId") WHERE "endedAt" IS NULL;
