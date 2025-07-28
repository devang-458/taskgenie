import express from "express";
import mongoose from "mongoose";
import tasksRoute from "./routes/taskRoute.js";
import { redis } from "./utils/cache.js";

const app = express();
const PORT = process.env.PORT || 4002;

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use("/api/", tasksRoute);

(async () => {
  try {
    await redis.connect();
    console.log("Redis connected");

    await mongoose.connect(
      process.env.MONGODB_URL || "mongodb://localhost:27017/taskgenie_dev"
    );
    console.log("MongoDB connected");

    app.listen(PORT, () => {
      console.log(`Task Server is running on PORT ${PORT}`);
    });
  } catch (err) {
    console.error("Startup Error:", err);
    process.exit(1);
  }
})();

app.listen(PORT, () => {
  console.log(`Task Server is running on PORT ${PORT}`);
});
