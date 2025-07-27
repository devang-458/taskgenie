
import express from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import rateLimit from "express-rate-limit";
import jwt from "jsonwebtoken";
import Redis from "redis";
import dotenv from "dotenv"
import { services } from "./utils/services.js";
import Routers from "./routes/auth.routes.js";
dotenv.config({ path: "../.env" });

const app = express();
const PORT = process.env.PORT || 4000;

// Redis client for caching and rate limiting
const redis = Redis.createClient({
  url: process.env.REDIS_URL || "redis://localhost:6379",
});

redis.on("error", (err) => console.log("Redis Client Error", err));
redis.connect();

// Middleware
app.use(helmet());
app.use(
  cors({
    origin: process.env.CORS_ORIGIN || "http://localhost:3000",
    credentials: true,
  })
);
app.use(morgan("combined"));
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true }));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: "Too many requests from this IP, please try again later.",
  standardHeaders: true,
  legacyHeaders: false,
});
app.use(limiter);

// Authentication middleware
const authenticateToken = async (req, res, next) => {
  const authHeader = req.headers["authorization"];
  const token = authHeader && authHeader.split(" ")[1];

  if (!token) {
    return res.status(401).json({
      success: false,
      error: "Access token required",
    });
  }

  try {
    // Check if token is blacklisted
    const isBlacklisted = await redis.get(`blacklist:${token}`);
    if (isBlacklisted) {
      return res.status(401).json({
        success: false,
        error: "Token has been revoked",
      });
    }

    const decoded = jwt.verify(
      token,
      process.env.JWT_SECRET || "dev-jwt-secret-key"
    );
    req.user = decoded;
    next();
  } catch (error) {
    return res.status(403).json({
      success: false,
      error: "Invalid or expired token",
    });
  }
};

// Optional auth middleware (for public endpoints that benefit from user context)
const optionalAuth = async (req, res, next) => {
  const authHeader = req.headers["authorization"];
  const token = authHeader && authHeader.split(" ")[1];

  if (token) {
    try {
      const isBlacklisted = await redis.get(`blacklist:${token}`);
      if (!isBlacklisted) {
        const decoded = jwt.verify(
          token,
          process.env.JWT_SECRET || "dev-jwt-secret-key"
        );
        req.user = decoded;
      }
    } catch (error) {
      // Continue without user context
    }
  }
  next();
};


// Health check endpoint
app.get("/health", async (req, res) => {
  try {
    // Check Redis connection
    await redis.ping();

    res.json({
      success: true,
      data: {
        status: "healthy",
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        services: {
          redis: "connected",
          gateway: "running",
        },
      },
    });
  } catch (error) {
    res.status(503).json({
      success: false,
      error: "Service unhealthy",
      details: error.message,
    });
  }
});

app.use("/api", Routers)

// Graceful shutdown
process.on("SIGTERM", async () => {
  console.log("SIGTERM received. Shutting down gracefully...");

  try {
    await redis.quit();
    process.exit(0);
  } catch (error) {
    console.error("Error during shutdown:", error);
    process.exit(1);
  }
});

app.listen(PORT, () => {
  console.log(`🚀 TaskGenie API Gateway running on port ${PORT}`);
  console.log(`📋 Environment: ${process.env.NODE_ENV || "development"}`);
  console.log(`🔗 Service URLs:`, services);
});
