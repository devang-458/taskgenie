import mongoose from "mongoose";

const boardSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
      maxlength: 100,
    },
    description: {
      type: String,
      trim: true,
      maxlength: 500,
    },
    projectId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Project",
    },
    ownerId: {
      type: String,
      required: true,
    },
    collaborators: [
      {
        userId: { type: String, required: true },
        role: {
          type: String,
          enum: ["owner", "admin", "member", "viewer"],
          default: "member",
        },
        permissions: {
          canCreateTasks: { type: Boolean, default: true },
          canEditTasks: { type: Boolean, default: true },
          canDeleteTasks: { type: Boolean, default: false },
          canManageBoard: { type: Boolean, default: false },
          canInviteUsers: { type: Boolean, default: false },
        },
        invitedAt: { type: Date, default: Date.now },
        acceptedAt: Date,
      },
    ],
    columns: [
      {
        _id: { type: mongoose.Schema.Types.ObjectId, auto: true },
        name: { type: String, required: true, trim: true, maxlength: 50 },
        color: { type: String, default: "#6366f1" },
        position: { type: Number, required: true },
        wipLimit: { type: Number, min: 1, max: 100 },
        taskIds: [{ type: mongoose.Schema.Types.ObjectId, ref: "Task" }],
      },
    ],
    settings: {
      isPublic: { type: Boolean, default: false },
      allowComments: { type: Boolean, default: true },
      enableAI: { type: Boolean, default: true },
      autoArchiveCompleted: { type: Boolean, default: false },
      emailNotifications: { type: Boolean, default: true },
    },
  },
  {
    timestamps: true,
  }
);


export const Board = mongoose.model('Board', boardSchema);