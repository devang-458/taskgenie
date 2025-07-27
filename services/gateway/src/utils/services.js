export const services = {
  auth: process.env.AUTH_SERVICE_URL || "http://localhost:4001",
  tasks: process.env.TASK_SERVICE_URL || "http://localhost:4002",
  ai: process.env.AI_SERVICE_URL || "http://localhost:4003",
  users: process.env.USER_SERVICE_URL || "http://localhost:4004",
  realtime: process.env.REALTIME_SERVICE_URL || "http://localhost:4005",
};
