import express from "express";
import { createProxy } from "../utils/createProxy.js";
import { services } from "../utils/services.js";
import { authenticateToken, optionalAuth } from "../middleware/auth.middleware.js";

const router = express.Router();

// Auth
router.use("/auth", createProxy(services.auth, { "^/api/auth": "" }));

// Users
router.use(
  "/users/profile",
  authenticateToken,
  createProxy(services.users, { "^/api/users": "" })
);
router.use(
  "/users/public",
  optionalAuth,
  createProxy(services.users, { "^/api/users/public": "/public" })
);

// Tasks
router.use(
  "/tasks",
  authenticateToken,
  createProxy(services.tasks, { "^/api/tasks": "" })
);
router.use(
  "/boards",
  authenticateToken,
  createProxy(services.tasks, { "^/api/boards": "/boards" })
);
router.use(
  "/projects",
  authenticateToken,
  createProxy(services.tasks, { "^/api/projects": "/projects" })
);

// AI
router.use(
  "/ai",
  authenticateToken,
  createProxy(services.ai, { "^/api/ai": "" })
);

// Analytics
router.use(
  "/analytics",
  authenticateToken,
  createProxy(services.tasks, { "^/api/analytics": "/analytics" })
);

// Upload
router.use(
  "/upload",
  authenticateToken,
  createProxy(services.tasks, { "^/api/upload": "/upload" })
);

// WebSocket
router.use(
  "/socket.io",
  createProxy(services.realtime, { "^/socket.io": "/socket.io" })
);

// Docs
router.get("/docs", (req, res) => {
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
router.all('/{*any}', (req, res) => {
  res.status(404).json({
    success: false,
    error: "Route not found",
    path: req.originalUrl,
  });
});

export default router;
