import redis from "../config/redis.js";

export const healthCheck = async (req, res) => {
  try {
    await redis.ping();
    res.json({
      success: true,
      data: {
        status: "healthy",
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
      },
    });
  } catch (err) {
    res.status(503).json({
      success: false,
      error: "Service unhealthy",
      details: err.message,
    });
  }
};
