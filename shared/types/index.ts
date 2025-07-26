export interface User {
  _id: string;
  email: string;
  username: string;
  firstName: string;
  lastName: string;
  avatar?: string;
  preferences: UserPreferences;
  subscription: SubscriptionTier;
  createdAt: Date;
  updatedAt: Date;
}

export interface UserPreferences {
  theme: "light" | "dark" | "system";
  notification: {
    email: boolean;
    push: boolean;
    taskDeadlines: boolean;
    collaborationUpdates: boolean;
  };
  aiAssistance: {
    autoSuggestion: boolean;
    smartPrioritization: boolean;
    contextualHelp: boolean;
  };
}

export enum SubscriptionTier {
  FREE = "free",
  PRO = "pro",
  ENTERPRISE = "enterprise",
}

export interface Task {
  _id: string;
  title: string;
  description?: string;
  status: TaskStatus;
  priority: TaskPriority;
  assignedTo?: string[]; // User IDs
  createdBy: string; // User ID
  projectId?: string;
  boardId: string;
  columnId?: string;
  tags: string[];
  dueDate?: Date;
  startDate?: Date;
  estimatedHours?: number;
  actualHours?: number;
  attachments: TaskAttachment[];
  comments: TaskComment[];
  aiSuggestion?: AISuggestion[];
  dependencies: string[];
  subtasks: string[];
  position: number;
  createdAt: Date;
  updatedAt: Date;
}

export enum TaskStatus {
  TODO = "todo",
  IN_PROGRESS = "in_progress",
  IN_REVIEW = "in_review",
  COMPLETED = "completed",
  CANCELLED = "cencelled",
}

export enum TaskPriority {
  LOW = "low",
  MEDIUM = "medium",
  HIGH = "high",
  URGENT = "urgent",
}

export interface TaskAttachment {
  _id: string;
  filename: string;
  originalName: string;
  mimetype: string;
  size: number;
  url: string;
  uploadedBy: string;
  uploadedAt: Date;
}

export interface TaskComment {
  _id: string;
  content: string;
  author: string; // User ID
  mentions: string[]; // User IDs
  createdAt: Date;
  updatedAt: Date;
  isAIGenerated?: boolean;
}

export interface Board {
  _id: string;
  name: string;
  description?: string;
  projectId?: string;
  ownerId: string;
  collaborators: BoardCollaborator[];
  columns: BoardColumn[];
  settings: BoardSettings;
  createdAt: Date;
  updatedAt: Date;
}

export interface BoardColumn {
  _id: string;
  name: string;
  color: string;
  position: number;
  wipLimit?: number;
  taskIds: string[];
}

export interface BoardCollaborator {
  userId: string;
  role: CollaboratorRole;
  permissions: CollaboratorPermissions;
  invitedAt: Date;
  acceptedAt?: Date;
}

export enum CollaboratorRole {
  OWNER = "owner",
  ADMIN = "admin",
  MEMBER = "member",
  VIEWER = "viewer",
}

export interface CollaboratorPermissions {
  canCreateTasks: boolean;
  canEditTasks: boolean;
  canDeleteTasks: boolean;
  canManageBoard: boolean;
  canInviteUsers: boolean;
}

export interface BoardSettings {
  isPublic: boolean;
  allowComments: boolean;
  enableAI: boolean;
  autoArchiveCompleted: boolean;
  emailNotifications: boolean;
}

export interface Project {
  _id: string;
  name: string;
  description?: string;
  ownerId: string;
  teamMembers: string;
  boards: string[];
  status: ProjectStatus;
  startDate?: Date;
  endDate?: Date;
  budget?: number;
  createdAt: Date;
  updatedAt: Date;
}

export enum ProjectStatus {
  PLANNING = "planning",
  ACTIVE = "active",
  ON_HOLD = "on_hold",
  COMPLETED = "completed",
  CANCELLED = "cancelled",
}

export interface AISuggestion {
  _id: string;
  type: AISuggestionType;
  content: string;
  confidence: number;
  context: AIContext;
  appliedAt?: Date;
  creatdAt: Date;
}

export enum AISuggestionType {
  TASK_BREAKDOWN = "task_breakdown",
  PRIORITY_ADJUSTMENT = "priority_adjustment",
  DUE_DATE_SUGGESTION = "due_date_suggestion",
  SIMILAR_TASKS = "similar_tasks",
  RESOURCE_ALLOCATION = "resource_allocation",
  BOTTLENECK_DETECTION = "bottleneck_detection",
}

export interface AIContext {
  taskId?: string;
  boardId?: string;
  projectId?: string;
  userId: string;
  metadata: Record<string, any>;
}

export interface WebSocketMessage {
  type: WebSocketMessageType;
  payload: any;
  userId?: string;
  boardId?: string;
  timestamp: Date;
}

export enum WebSocketMessageType {
  TASK_CREATED = "task_created",
  TASK_UPDATED = "task_updated",
  TASK_DELETED = "task_deleted",
  TASK_MOVED = "task_moved",
  COMMENT_ADDED = "comment_added",
  USER_JOINED = "user_joined",
  USER_LEFT = "user_left",
  TYPING_START = "typing_start",
  TYPING_END = "typing_end",
  BOARD_UPDATED = "board_updated",
  AI_SUGGESTION = "ai_suggestion",
}

export interface APIResponse<T = any> {
  success: boolean;
  data?: T;
  message?: string;
  error?: string;
  meta?: {
    total?: number;
    page?: number;
    limit?: number;
    hasMore?: boolean;
  };
}

export interface PaginationQuery {
  page?: number;
  limit?: number;
  sortBy?: string;
  sortOrder?: "asc" | "desc";
  search?: string;
}

export interface LoginCredentials {
  email: string;
  password: string;
}

export interface RegisterCredentails extends LoginCredentials {
  username: string;
  firstName: string;
  lastName: string;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

export interface JWTPayLoad {
  userId: string;
  email: string;
  username: string;
  iat: number;
  exp: number;
}

export interface ValidationError {
  field: string;
  message: string;
  value?: any;
}

export interface AppError extends Error {
  statusCode: number;
  isOperational: boolean;
  validationErrors?: ValidationError[];
}

export interface ServiceRequest {
  headers: Record<string, string>;
  user?: User;
  body: any;
  query: Record<string, any>;
  params: Record<string, any>;
}

export interface ServiceResponse<T = any> {
  statusCode: number;
  data?: T;
  message?: string;
  error?: string;
}

export interface TaskAnalytics {
  totalTasks: number;
  completedTasks: number;
  completionRate: number;
  averageCompletionTime: number;
  tasksByStatus: Record<TaskStatus, number>;
  tasksByPriority: Record<TaskPriority, number>;
  upcomingDeadlines: Task[];
  overdueTasks: Task[];
}

export interface UserActivity {
  userId: string;
  action: string;
  entityType: string;
  entityId: string;
  timestamp: Date;
  metadata?: Record<string, any>;
}