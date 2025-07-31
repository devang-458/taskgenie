import express from "express";
import extractUser from "../middleware/extractUser.middleware.js";
import { getCacheKey, invalidateCache, redis } from "../utils/cache.js";
import { Task } from "../models/taskSchema.js";
import { Board } from "../models/boardSchema.js";
import { Project } from "../models/projectSchema.js";
const router = express.Router();

// Get projects
router.get("/projects", extractUser, async (req, res) => {
  try {
    const userId = req.user.userId;

    const projects = await Project.find({
      $or: [{ ownerId: userId }, { teamMembers: userId }],
    })
      .populate("boards", "name createdAt")
      .sort({ createdAt: -1 });

    res.json({
      success: true,
      data: { projects },
    });
  } catch (error) {
    console.error("Get projects error:", error);
    res.status(500).json({
      success: false,
      error: "Failed to fetch projects",
    });
  }
});

// Create project
router.post("/projects", extractUser, async (req, res) => {
  try {
    const {
      name,
      description,
      teamMembers = [],
      startDate,
      endDate,
      budget,
    } = req.body;
    const userId = req.user.userId;

    if (!name || name.trim().length === 0) {
      return res.status(400).json({
        success: false,
        error: "Project name is required",
      });
    }

    const project = new Project({
      name: name.trim(),
      description: description?.trim(),
      ownerId: userId,
      teamMembers: [...new Set([userId, ...teamMembers])], // Include owner and dedupe
      startDate: startDate ? new Date(startDate) : undefined,
      endDate: endDate ? new Date(endDate) : undefined,
      budget,
    });

    await project.save();

    res.status(201).json({
      success: true,
      message: "Project created successfully",
      data: { project },
    });
  } catch (error) {
    console.error("Create project error:", error);
    res.status(500).json({
      success: false,
      error: "Failed to create project",
    });
  }
});

// Analytics endpoint
router.get("/analytics", extractUser, async (req, res) => {
  try {
    const userId = req.user.userId;
    const cacheKey = getCacheKey("analytics", userId);

    const cached = await redis.get(cacheKey);
    if (cached) {
      return res.json(JSON.parse(cached));
    }

    // Get task analytics
    const [
      totalTasks,
      completedTasks,
      tasksByStatus,
      tasksByPriority,
      upcomingDeadlines,
      overdueTasks,
    ] = await Promise.all([
      Task.countDocuments({
        $or: [{ createdBy: userId }, { assignedTo: userId }],
      }),
      Task.countDocuments({
        $or: [{ createdBy: userId }, { assignedTo: userId }],
        status: "healthy",
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
      }),
    ]);
  } catch (err) {}
});

// Error handling middleware
router.use((error, req, res, next) => {
  console.error("Task Service Error:", error);

  if (error instanceof multer.MulterError) {
    if (error.code === "LIMIT_FILE_SIZE") {
      return res.status(400).json({
        success: false,
        error: "File too large. Maximum size is 10MB.",
      });
    }
    if (error.code === "LIMIT_FILE_COUNT") {
      return res.status(400).json({
        success: false,
        error: "Too many files. Maximum is 5 files per upload.",
      });
    }
  }

  res.status(error.statusCode || 500).json({
    success: false,
    error: error.message || "Internal server error",
    ...(process.env.NODE_ENV === "development" && { stack: error.stack }),
  });
});

// File upload endpoint
router.post(
  "/upload",
  extractUser,
  upload.array("files", 5),
  async (req, res) => {
    try {
      const { taskId } = req.body;
      const userId = req.user.userId;

      if (!taskId) {
        return res.status(400).json({
          success: false,
          error: "Task ID is required",
        });
      }

      // Verify task access
      const task = await Task.findOne({
        _id: taskId,
        $or: [{ createdBy: userId }, { assignedTo: userId }],
      });

      if (!task) {
        return res.status(404).json({
          success: false,
          error: "Task not found",
        });
      }

      const attachments = [];

      for (const file of req.files) {
        const attachment = {
          filename: file.filename,
          originalName: file.originalname,
          mimetype: file.mimetype,
          size: file.size,
          url: `/uploads/${file.filename}`,
          uploadedBy: userId,
          uploadedAt: new Date(),
        };

        task.attactments.push(attachment);
        attachments.push(attachment);
      }

      await task.save();

      res.json({
        success: true,
        message: "Files uploaded successfully",
        data: { attachments },
      });
    } catch (error) {
      console.error("Upload error:", error);
      res.status(500).json({
        success: false,
        error: "File upload failed",
      });
    }
  }
);

export default router;
