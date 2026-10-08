import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  const hash = await bcrypt.hash("noah123", 10);

  const vodja = await prisma.user.upsert({
    where: { email: "janez@noah.si" },
    update: {},
    create: { name: "Janez Novak", email: "janez@noah.si", passwordHash: hash, role: "VODJA" },
  });
  const marko = await prisma.user.upsert({
    where: { email: "marko@noah.si" },
    update: {},
    create: { name: "Marko Kovač", email: "marko@noah.si", passwordHash: hash, role: "DELAVEC" },
  });
  await prisma.user.upsert({
    where: { email: "luka@noah.si" },
    update: {},
    create: { name: "Luka Horvat", email: "luka@noah.si", passwordHash: hash, role: "DELAVEC" },
  });

  let projects = await prisma.project.findMany();
  if (projects.length === 0) {
    for (const name of ["Hiša Novak", "Hiša Müller", "Hiša Kovač"]) {
      await prisma.project.create({ data: { name, location: "Maribor" } });
    }
    projects = await prisma.project.findMany();
  }
  const novak = projects.find((p) => p.name === "Hiša Novak")!;

  await prisma.workOrder.upsert({
    where: { number: "2026-00125" },
    update: {},
    create: {
      number: "2026-00125",
      projectId: novak.id,
      workerId: marko.id,
      managerId: vodja.id,
      description: "Montaža zunanjih stenskih elementov na severni strani objekta.",
      plannedQty: 8,
      plannedUnit: "kos",
      plannedHours: 8,
      dueDate: new Date(),
      materials: {
        create: [
          { name: "stenski elementi" },
          { name: "vijaki" },
          { name: "tesnilni material" },
        ],
      },
    },
  });
}

main().finally(() => prisma.$disconnect());