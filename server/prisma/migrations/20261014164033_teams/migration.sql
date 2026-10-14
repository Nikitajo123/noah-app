-- AlterTable
ALTER TABLE "User" ADD COLUMN     "teamId" TEXT;

-- CreateTable
CREATE TABLE "Team" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "foremanId" TEXT NOT NULL,

    CONSTRAINT "Team_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TeamReport" (
    "id" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "status" "ReportStatus" NOT NULL DEFAULT 'OSNUTEK',
    "summary" TEXT,
    "submittedAt" TIMESTAMP(3),
    "submittedById" TEXT,

    CONSTRAINT "TeamReport_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Team_name_key" ON "Team"("name");

-- CreateIndex
CREATE UNIQUE INDEX "TeamReport_teamId_date_key" ON "TeamReport"("teamId", "date");

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Team" ADD CONSTRAINT "Team_foremanId_fkey" FOREIGN KEY ("foremanId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TeamReport" ADD CONSTRAINT "TeamReport_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TeamReport" ADD CONSTRAINT "TeamReport_submittedById_fkey" FOREIGN KEY ("submittedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
