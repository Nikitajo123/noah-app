import "dotenv/config";
import express from "express";
import cors from "cors";
import path from "path";
import fs from "fs";
import { authRouter } from "./routes/auth";
import { projectsRouter, workersRouter } from "./routes/projects";
import { workOrdersRouter } from "./routes/workOrders";
import { timeRouter } from "./routes/time";
import { logsRouter, materialsRouter } from "./routes/logs";
import { photosRouter } from "./routes/photos";
import { overviewRouter, reportsRouter } from "./routes/reports";
import { usersRouter } from "./routes/admin";

const app = express();
app.use(cors());
app.use(express.json());

app.get("/health", (_req, res) => {
  res.json({ ok: true });
});

const api = express.Router();
api.use("/auth", authRouter);
api.use("/projects", projectsRouter);
api.use("/workers", workersRouter);
api.use("/users", usersRouter);
api.use("/work-orders", workOrdersRouter);
api.use("/time", timeRouter);
api.use("/logs", logsRouter);
api.use("/materials", materialsRouter);
api.use("/photos", photosRouter);
api.use("/overview", overviewRouter);
api.use("/reports", reportsRouter);
app.use("/api", api);

const clientDist = path.resolve(__dirname, "../../client/dist");
if (fs.existsSync(clientDist)) {
  app.use(express.static(clientDist));
  app.use((req, res, next) => {
    if (req.method !== "GET" || req.path.startsWith("/api/")) return next();
    res.sendFile(path.join(clientDist, "index.html"));
  });
}

const port = Number(process.env.PORT) || 3000;
app.listen(port, () => {
  console.log(`Server on http://localhost:${port}`);
});