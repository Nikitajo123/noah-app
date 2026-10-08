import "dotenv/config";
import express from "express";
import cors from "cors";
import { authRouter } from "./routes/auth";
import { projectsRouter, workersRouter } from "./routes/projects";
import { workOrdersRouter } from "./routes/workOrders";

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

app.listen(3000, () => {
  console.log("Server on http://localhost:3000");
});