// services/gateway/src/index.js
// API Gateway - Routes requests to appropriate microservices

const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const morgan = require("morgan");
const rateLimit = require("express-rate-limit");
const { createProxyMiddleware } = require("http-proxy-middleware");
const jwt = require("jsonwebtoken");
const Redis = require("redis");

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

// Service URLs
const services = {
  auth: process.env.AUTH_SERVICE_URL || "http://localhost:4001",
  tasks: process.env.TASK_SERVICE_URL || "http://localhost:4002",
  ai: process.env.AI_SERVICE_URL || "http://localhost:4003",
  users: process.env.USER_SERVICE_URL || "http://localhost:4004",
  realtime: process.env.REALTIME_SERVICE_URL || "http://localhost:4005",
};

// Proxy configuration
const createProxy = (target, pathRewrite = {}) => {
  return createProxyMiddleware({
    target,
    changeOrigin: true,
    pathRewrite,
    onProxyReq: (proxyReq, req, res) => {
      // Forward user information to services
      if (req.user) {
        proxyReq.setHeader("X-User-ID", req.user.userId);
        proxyReq.setHeader("X-User-Email", req.user.email);
        proxyReq.setHeader("X-User-Username", req.user.username);
      }

      // Forward original IP
      const originalIp = req.ip || req.connection.remoteAddress;
      proxyReq.setHeader("X-Forwarded-For", originalIp);
    },
    onError: (err, req, res) => {
      console.error("Proxy Error:", err.message);
      res.status(500).json({
        success: false,
        error: "Service temporarily unavailable",
      });
    },
  });
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

// Routes

// Authentication routes (no auth required)
app.use(
  "/api/auth",
  createProxy(services.auth, {
    "^/api/auth": "",
  })
);

// User routes (mixed auth requirements)
app.use(
  "/api/users/profile",
  authenticateToken,
  createProxy(services.users, {
    "^/api/users": "",
  })
);

app.use(
  "/api/users/public",
  optionalAuth,
  createProxy(services.users, {
    "^/api/users/public": "/public",
  })
);

// Task routes (auth required)
app.use(
  "/api/tasks",
  authenticateToken,
  createProxy(services.tasks, {
    "^/api/tasks": "",
  })
);

app.use(
  "/api/boards",
  authenticateToken,
  createProxy(services.tasks, {
    "^/api/boards": "/boards",
  })
);

app.use(
  "/api/projects",
  authenticateToken,
  createProxy(services.tasks, {
    "^/api/projects": "/projects",
  })
);

// AI routes (auth required)
app.use(
  "/api/ai",
  authenticateToken,
  createProxy(services.ai, {
    "^/api/ai": "",
  })
);

// Analytics routes (auth required)
app.use(
  "/api/analytics",
  authenticateToken,
  createProxy(services.tasks, {
    "^/api/analytics": "/analytics",
  })
);

// File upload routes (auth required)
app.use(
  "/api/upload",
  authenticateToken,
  createProxy(services.tasks, {
    "^/api/upload": "/upload",
  })
);

// WebSocket proxy for real-time features
app.use(
  "/socket.io",
  createProxy(services.realtime, {
    "^/socket.io": "/socket.io",
  })
);

// API documentation route
app.get("/api/docs", (req, res) => {
  res.json({
    success: true,
    data: {
      name: "TaskGenie API Gateway",
      version: "1.0.0",
      description: "API Gateway for TaskGenie microservices",
      endpoints: {
        auth: {
          "POST /api/auth/register": "User registration",
          "POST /api/auth/login": "User login",
          "POST /api/auth/logout": "User logout",
          "POST /api/auth/refresh": "Refresh access token",
          "POST /api/auth/forgot-password": "Password reset request",
          "POST /api/auth/reset-password": "Password reset confirmation",
        },
        users: {
          "GET /api/users/profile": "Get user profile",
          "PUT /api/users/profile": "Update user profile",
          "GET /api/users/public/:id": "Get public user info",
        },
        tasks: {
          "GET /api/tasks": "Get user tasks",
          "POST /api/tasks": "Create new task",
          "GET /api/tasks/:id": "Get task details",
          "PUT /api/tasks/:id": "Update task",
          "DELETE /api/tasks/:id": "Delete task",
        },
        boards: {
          "GET /api/boards": "Get user boards",
          "POST /api/boards": "Create new board",
          "GET /api/boards/:id": "Get board details",
          "PUT /api/boards/:id": "Update board",
          "DELETE /api/boards/:id": "Delete board",
        },
        ai: {
          "POST /api/ai/suggestions": "Get AI task suggestions",
          "POST /api/ai/summarize": "Summarize tasks or project",
          "POST /api/ai/prioritize": "AI-powered task prioritization",
        },
      },
    },
  });
});

// Catch-all for undefined routes
app.all('/{*any}', (req, res, next) => {
  res.status(404).json({
    success: false,
    error: "Route not found",
    path: req.originalUrl,
  });
});

// Global error handler
app.use((error, req, res, next) => {
  console.error("Gateway Error:", error);

  res.status(error.statusCode || 500).json({
    success: false,
    error: error.message || "Internal server error",
    ...(process.env.NODE_ENV === "development" && { stack: error.stack }),
  });
});

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
