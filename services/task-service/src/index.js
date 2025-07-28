import express from "express";
import mongoose from "mongoose";
import path from "path";
import fs from "fs/promises";
import tasksRoute from "./routes/taskRoute"
import { redis } from "./utils/cache";

const app = express();
const PORT = process.env.PORT || 4002;

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use("api/task", tasksRoute)

// Redis
redis.connect();

// MongoDb connection
mongoose
  .connect(process.env.MONGODB_URL || "mongodb://localhost:27017/taskgenie_dev")
  .then(() => console.log("Task Service connnected to MongoDb"))
  .catch((err) => console.error("MongoDB connection error", err));

app.listen(PORT, () => {
  console.log(`Task Server is running on PORT ${PORT}`);
});

