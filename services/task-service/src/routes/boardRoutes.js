import express from "express";
import extractUser from "../middleware/extractUser.middleware.js";
import { getCacheKey, invalidateCache, redis } from "../utils/cache.js";
import { Task } from "../models/taskSchema.js";
import { Board } from "../models/boardSchema.js";
import { Project } from "../models/projectSchema.js";
const router = express.Router();

router.get("/boards", async (req, res) => {
  try {
    const userId = req.user.userId;
    const { projectId } = req.query;

    const query = {
      $or: [{ ownerId: userId }, { "collaborators.userId": userId }],
    };

    if (projectId) {
      query.projectId = projectId;
    }

    const boards = await Board.find(query)
      .populate("projectId", "name status")
      .sort({ createdAt: -1 });

    res.json({
      success: true,
      data: { boards },
    });
  } catch (error) {
    console.error("Get boards error:", error);
    res.status(500).json({
      success: false,
      error: "Failed to fetch boards",
    });
  }
});

// Get single board with tasks
router.get("/boards/:id", extractUser, async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.userId;

    const cacheKey = getCacheKey("board", id);
    const cached = await redis.get(cacheKey);

    if (cached) {
      const board = JSON.parse(cached);
      // varify user still has access
      const hasAccess =
        board.ownerId === userId ||
        board.collaborators.some((c) => c.userId === userId);

      if (hasAccess) {
        return res.json({
          success: true,
          data: { board },
        });
      }
    }

    // Find board and verify access
    const board = await Board.findOne({
      _id: id,
      $or: [{ userId: userId }, { "collaborators.userId": userId }],
    }).populate("projectId", "name status");

    if (!board) {
      return res.status(404).json({
        success: false,
        error: "Board not found",
      });
    }

    // Get all tasks for this board
    const tasks = await Task.find({ boardId: id })
      .populate("assignedTo", "username avatar")
      .populate("dependencies", "title status")
      .sort({ position: 1 });

    // Organize tasks by columns
    const boardWithTasks = {
      ...board.toObject(),
      columns: board.columns.map((column) => ({
        ...column.toObject(),
        tasks: tasks.filter((task) => task.columnId === column._id.toString()),
      })),
    };

    // Cache for 2 minutes
    await redis.set(cacheKey, JSON.stringify(boardWithTasks), "EX", 120);

    res.json({
      success: true,
      data: { board: boardWithTasks },
    });
  } catch (error) {
    console.error("Get board error:", error);
    res.status(500).json({
      success: false,
      error: "Failed to fetch board",
    });
  }
});

// Create board
router.post("/boards", extractUser, async (req, res) => {
  try {
    const { name, description, projectId } = req.body;
    const userId = req.user.userId;

    if (!name || name.trim().length === 0) {
      return res.status(400).json({
        success: false,
        error: "Board name is required",
      });
    }

    // Verify project access if projectId provided
    if (projectId) {
      const project = await Project.findOne({
        _id: projectId,
        $or: [{ ownerId: userId }, { teamMembers: userId }],
      });

      if (!project) {
        return res.status(404).json({
          success: false,
          error: "Project not found or access denied",
        });
      }
    }

    // Create board with default columns
    const board = new Board({
      name: name.trim(),
      description: description?.trim(),
      projectId,
      ownerId: userId,
      columns: [
        { name: "To Do", color: "#6366f1", position: 0, taskIds: [] },
        { name: "In Progress", color: "#f59e0b", position: 1, taskIds: [] },
        { name: "Done", color: "#10b981", position: 2, taskIds: [] },
      ],
    });

    await board.save();

    // Add board to project if projectId provided
    if (projectId) {
      await Project.updateOne(
        { _id: projectId },
        { $push: { boards: board._id } }
      );
    }

    res.status(201).json({
      success: true,
      message: "Board created successfully",
      data: { board },
    });
  } catch (error) {
    console.error("Create board error:", error);
    res.status(500).json({
      success: false,
      error: "Failed to create board",
    });
  }
});

// Update board
router.put("/boards/:id", extractUser, async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.userId;
    const updates = req.body;

    // Find board and verify access
    const board = await Board.findOne({
      _id: id,
      $or: [
        { ownerId: userId },
        {
          "collaborators.userId": userId,
          "collaborators.permissions.canManageBoard": true,
        },
      ],
    });

    if (!board) {
      return res.status(404).json({
        success: false,
        error: "Board not found or insufficient permissions",
      });
    }

    // Filter allowed updates
    const allowedUpdates = ["name", "description", "settings", "columns"];
    const filteredUpdates = {};

    for (const key of allowedUpdates) {
      if (updates[key] !== undefined) {
        filteredUpdates[key] = updates[key];
      }
    }

    // Update board
    Object.assign(board, filteredUpdates);
    await board.save();

    // Invalidate cache
    await redis.del(getCacheKey("board", id));

    res.json({
      success: true,
      message: "Board updated successfully",
      data: { board },
    });
  } catch (error) {
    console.error("Update board error:", error);
    res.status(500).json({
      success: false,
      error: "Failed to update board",
    });
  }
});

// Delete board
router.delete("/boards/:id", extractUser, async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.userId;

    const board = await Board.findOne({
      _id: id,
      ownerId: userId, // Only owner can delete
    });

    if (!board) {
      return res.status(404).json({
        success: false,
        error: "Board not found or permission denied",
      });
    }

    // Delete all tasks in the board
    await Task.deleteMany({ boardId: id });

    // Remove board from project
    if (board.projectId) {
      await Project.updateOne(
        { _id: board.projectId },
        { $pull: { boards: board._id } }
      );
    }

    // Delete board
    await Board.findByIdAndDelete(id);

    // Invalidate caches
    await invalidateCache([
      getCacheKey("board", id),
      getCacheKey("tasks", userId, "*"),
      getCacheKey("analytics", userId),
    ]);

    res.json({
      success: true,
      message: "Board deleted successfully",
    });
  } catch (error) {
    console.error("Delete board error:", error);
    res.status(500).json({
      success: false,
      error: "Failed to delete board",
    });
  }
});
export default router;
