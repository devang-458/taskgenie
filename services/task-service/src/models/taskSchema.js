import mongoose from "mongoose";

const taskSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: true,
      trim: true,
      maxlength: 200,
    },
    description: {
      type: String,
      trim: true,
      maxlength: 2000,
    },
    status: {
      type: String,
      enum: ["todo", "in_progress", "in_review", "completed", "cancelled"],
      default: "todo",
    },
    priority: {
      type: String,
      enum: ["low", "medium", "high", "urgent"],
      default: "medium",
    },
    assignedTo: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
      },
    ],
    createdBy: {
      type: String,
      required: true,
    },
    projectId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Project",
    },
    boardId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Board",
      required: true,
    },
    columnId: {
      type: String,
      required: true,
    },
    tags: [
      {
        type: String,
        trim: true,
        maxlength: 50,
      },
    ],
    dueDate: Date,
    startDate: Date,
    estimatedHours: {
      type: Number,
      min: 0,
      max: 1000,
    },
    actualHours: {
      type: Number,
      min: 0,
      max: 1000,
    },
    attactments: [
      {
        _id: { type: mongoose.Schema.Types.ObjectId, auto: true },
        filename: String,
        originalName: String,
        mimetype: String,
        size: Number,
        url: String,
        uploadedBy: String,
        uploadedAt: { type: Date, default: Date.now },
      },
    ],
    comments: [
      {
        _id: { type: mongoose.Schema.Types.ObjectId, auto: true },
        content: { type: String, required: true, maxlength: 1000 },
        author: { type: String, required: true },
        mentions: [String],
        createdAt: { type: Date, default: Date.now },
        updatedAt: { type: Date, default: Date.now },
        isAIGenerated: { type: Boolean, default: false },
      },
    ],
    aiSugesstions: [
      {
        _id: { type: mongoose.Schema.Types.ObjectId, auto: true },
        type: {
          type: String,
          enum: [
            "task_breakdown",
            "priority_adjustment",
            "due_date_suggestion",
            "similar_tasks",
            "resource_allocation",
            "bottleneck_detection",
          ],
        },
        content: String,
        confidence: { type: Number, min: 0, max: 1 },
        context: mongoose.Schema.Types.Mixed,
        appliedAt: Date,
        createdAt: { type: Date, default: Date.now },
      },
    ],
    dependencies: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Task",
      },
    ],
    subtasks: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Task",
      },
    ],
    position: {
      type: Number,
      default: 0,
    },
  },
  {
    timestamps: true,
  }
);


export const Task = mongoose.model('Task', taskSchema);