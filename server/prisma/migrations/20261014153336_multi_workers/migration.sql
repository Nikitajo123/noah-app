-- CreateTable
CREATE TABLE "WorkOrderWorker" (
    "workOrderId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,

    CONSTRAINT "WorkOrderWorker_pkey" PRIMARY KEY ("workOrderId","userId")
);

-- Keep the existing single worker of every order
INSERT INTO "WorkOrderWorker" ("workOrderId", "userId")
SELECT "id", "workerId" FROM "WorkOrder";

-- DropForeignKey
ALTER TABLE "WorkOrder" DROP CONSTRAINT "WorkOrder_workerId_fkey";

-- AlterTable
ALTER TABLE "WorkOrder" DROP COLUMN "workerId";

-- AddForeignKey
ALTER TABLE "WorkOrderWorker" ADD CONSTRAINT "WorkOrderWorker_workOrderId_fkey" FOREIGN KEY ("workOrderId") REFERENCES "WorkOrder"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkOrderWorker" ADD CONSTRAINT "WorkOrderWorker_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;