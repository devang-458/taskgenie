import express from "express";
import extractUser from "../middleware/extractUser.middleware";
import { getCacheKey, redis } from "../utils/cache";
import { Task } from "../models/taskSchema";
const router = express.Router();

router.get("/tasks", extractUser, async (req, res) => {
  try {
    const {
      page = 1,
      limit = 20,
      status,
      priority,
      assignee,
      boardId,
      projectId,
      search,
      sortBy = "createdAt",
      sortOrder = "desc",
    } = req.query;

    const userId = req.user.userId;
    const cacheKey = getCacheKey("tasks", userId, JSON.stringify(req.query));

    // Check cache first
    const cached = await redis.get(cacheKey);
    if (cached) {
      return res.json(JSON.parse(cached));
    }

    // Build query
    const query = {
      $or: [{ createdBy: userId }, { assignedTo: userId }],
    };

    if (status) query.status = status;
    if (priority) query.priority = priority;
    if (assignee) query.assignedTo = assignee;
    if (boardId) query.boardId = boardId;
    if (projectId) query.projectId = projectId;
    if (search) {
      query.$text = { $search: search };
    }

    // Execute query with pagination
    const skip = (parseInt(page) - 1) * parseInt(limit);
    const sortObj = { [sortBy]: sortOrder === "desc" ? -1 : 1 };

    const [tasks, total] = await Promise.all([
      Task.find(query)
        .sort(sortObj)
        .skip(skip)
        .limit(parseInt(limit))
        .populate("dependencies", "title status")
        .populate("subtasks", "title status"),
      Task.countDocuments(query),
    ]);

    const response = {
      success: true,
      data: {
        tasks,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          pages: Math.ceil(total / parseInt(limit)),
          hasMore: skip + tasks.length < total,
        },
      },
    };

    // Cache for 5 minutes
    await redis.set(cacheKey, JSON.stringify(response), "EX", 300);
    res.json(response);
  } catch (error) {
    console.error("Get tasks error:", error);
    res.status(500).json({
      success: false,
      error: "Failed to fetch tasks",
    });
  }
});

export default router;
