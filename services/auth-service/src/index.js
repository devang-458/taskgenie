import express from "express";
import mongoose from "mongoose";
import authRoutes from "./routes/auth.routes.js";
import dotenv from "dotenv";
dotenv.config({ path: "../.env" });
console.log("PORT", process.env.PORT);

const app = express();
const PORT = process.env.PORT || 4001;
// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use("/api/auth", authRoutes);

// MongoDB connection
await mongoose
  .connect(process.env.MONGODB_URL || "mongodb://localhost:27017/taskgenie_dev")
  .then(() => console.log("Auth Service connected to MongoDB"))
  .catch((err) => console.error("MongoDB connection error:", err));

app.listen(PORT, () => {
  console.log(`✅ Auth Server is running on port ${PORT}`);
});
