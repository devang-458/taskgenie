import express from "express";
import extractUser from "../middleware/extractUser.middleware.js";
import { getCacheKey, invalidateCache, redis } from "../utils/cache.js";
import { Task } from "../models/taskSchema.js";
import { Board } from "../models/boardSchema.js";
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

// Get single task
router.get("/tasks/:id", extractUser, async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.userId;

    const task = await Task.findOne({
      _id: id,
      $or: [{ createdBy: userId }, { assignedTo: userId }],
    })
      .populate("dependencies", "title status priority")
      .populate("subtasks", "title status priority");

    if (!task) {
      return res.status(404).json({
        success: false,
        error: "Tasks not found",
      });
    }

    res.json({
      success: true,
      data: { task },
    });
  } catch (err) {
    console.error("Get task error", err);
    res.status(500).json({
      success: false,
      error: "Failed to fetch task",
    });
  }
});

router.post("/tasks", extractUser, async (req, res) => {
  try {
    const {
      title,
      description,
      status = "todo",
      priority = "medium",
      assignedTo = [],
      boardId,
      columnId,
      projectId,
      tags = [],
      dueDate,
      startDate,
      estimatedHours,
    } = req.body;

    const userId = req.user.userId;

    // Validate required fields
    if (!title || !boardId || !columnId) {
      return res.status(400).json({
        success: false,
        error: "Title, boardId, and columnId are required",
      });
    }

    // Verify user has access to the board
    const board = await Board.findOne({
      _id: boardId,
      $or: [{ ownerId: userId }, { "collaborators.userId": userId }],
    });

    if (!board) {
      return res.status(404).json({
        success: false,
        error: "Board not found or access denied",
      });
    }

    // Check if column exists
    const column = board.columns.find((col) => col._id.toString() === columnId);
    if (!column) {
      return res.status(400).json({
        success: false,
        error: "Invalid column ID",
      });
    }

    // Get next position in column
    const maxPosition = await Task.findOne(
      { boardId, columnId },
      { position: 1 },
      { sort: { position: -1 } }
    );
    const position = maxPosition ? maxPosition.position + 1 : 0;

    // Create task
    const task = new Task({
      title: title.trim(),
      description: description?.trim(),
      status,
      priority,
      assignedTo,
      createdBy: userId,
      boardId,
      columnId,
      projectId,
      tags: tags.map((tag) => tag.trim()).filter(Boolean),
      dueDate: dueDate ? new Date(dueDate) : undefined,
      startDate: startDate ? new Date(startDate) : undefined,
      estimatedHours,
      position,
    });

    await task.save();

    // Update board's column
    await Board.updateOne(
      { _id: boardId, "columns._id": columnId },
      { $push: { "columns.$.taskIds": task._id } }
    );

    // Invalidate caches
    await invalidateCache([
      getCacheKey("tasks", userId, "*"),
      getCacheKey("board", boardId),
      getCacheKey("analytics", userId),
    ]);

    res.status(201).json({
      success: true,
      message: "Task created successfully",
      data: { task },
    });
  } catch (error) {
    console.error("Create task error:", error);
    res.status(500).json({
      success: false,
      error: "Failed to create task",
    });
  }
});

// Delete Task
router.delete("/tasks/:id", extractUser, async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.userId;

    const task = await Task.findOne({
      _id: id,
      createdBy: userId, // only creator can delete
    });

    if (!task) {
      return res.status(404).json({
        success: false,
        error: "Task not found or permission denied",
      });
    }

    // Remove from board column
    await Board.updateOne(
      { _id: task.boardId, "columns._id": task.id },
      { $pull: { "columns.$.tasksIds": task._id } }
    );

    // Delete task
    await Task.findByIdAndDelete(id);

    // Invalidate caches
    await invalidateCache([
      getCacheKey("tasks", userId, "*"),
      getCacheKey("board", task.boardId),
      getCacheKey("analytics", userId),
    ]);
    res.json({
      success: true,
      message: "Task deleted successfully",
    });
  } catch (error) {
    console.error("Delete task error:", error);
    res.status(500).json({
      success: false,
      error: "Failed to delete task",
    });
  }
});

// Add commecnt to task
router.post("/tasks/:id/comments", extractUser, async (req, res) => {
  try {
    const { id } = req.params;
    const { content, mentions = [] } = req.body;
    const userId = req.user.userId;

    if (!content || !content.trim().length === 0) {
      return res.status(400).json({
        success: false,
        error: "Comment content is required",
      });
    }

    // Find task and verify access
    const task = await Task.findOne({
      _id: id,
      $or: [{ createdBy: userId }, { assignedTo: userId }],
    });

    if (!task) {
      return res.status(404).json({
        success: false,
        error: "Tasks not found",
      });
    }

    // Add comment
    const comment = {
      content: content.trim(),
      author: userId,
      mentions: mentions.filter(Boolean),
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    task.comments.push(comment);
    await task.save();

    res.status(201).json({
      success: true,
      message: "Comment added successfully",
      data: { comment: task.comments[task.comments.length - 1] },
    });
  } catch (error) {
    console.error("Add comment error:", error);
    res.status(500).json({
      success: false,
      error: "Failed to add comment",
    });
  }
});

export default router;
