import { prisma } from "./db";

export async function isAssigned(workOrderId: string, userId: string) {
  const link = await prisma.workOrderWorker.findUnique({
    where: { workOrderId_userId: { workOrderId, userId } },
  });
  return !!link;
}