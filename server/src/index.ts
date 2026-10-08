import "dotenv/config";
import express from "express";
import cors from "cors";
import { authRouter } from "./routes/auth";
import { projectsRouter, workersRouter } from "./routes/projects";
import { workOrdersRouter } from "./routes/workOrders";
import { timeRouter } from "./routes/time";
import { logsRouter, materialsRouter } from "./routes/logs";
import path from "path";
import { photosRouter } from "./routes/photos";

const app = express();
app.use(cors());
app.use(express.json());

app.get("/health", (_req, res) => {
  res.json({ ok: true });
});

app.use("/auth", authRouter);
app.use("/projects", projectsRouter);
app.use("/workers", workersRouter);
app.use("/work-orders", workOrdersRouter);
app.use("/time", timeRouter);
app.use("/logs", logsRouter);
app.use("/materials", materialsRouter);
app.use("/photos", photosRouter);
app.use("/uploads", express.static(path.join(process.cwd(), "uploads")));

app.listen(3000, () => {
  console.log("Server on http://localhost:3000");
});