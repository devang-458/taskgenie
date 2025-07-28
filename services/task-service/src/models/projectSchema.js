import mongoose from "mongoose";

const projectSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true,
    maxlength: 100
  },
  description: {
    type: String,
    trim: true,
    maxlength: 1000
  },
  ownerId: {
    type: String, // User ID from auth service
    required: true
  },
  teamMembers: [{
    type: String // User IDs from auth service
  }],
  boards: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Board'
  }],
  status: {
    type: String,
    enum: ['planning', 'active', 'on_hold', 'completed', 'cancelled'],
    default: 'planning'
  },
  startDate: Date,
  endDate: Date,
  budget: {
    type: Number,
    min: 0
  }
}, {
  timestamps: true
});

export const Project = mongoose.model('Project', projectSchema);