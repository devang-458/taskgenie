import Redis from "redis"

// Redis client for caching
export const redis = Redis.createClient({
  url: process.env.REDIS_URL || "redis://localhost:6379",
});

redis.on("error", (err) => console.log("Redis Client Error", err));

export const getCacheKey = (prefix, ...args) =>
  `taskgenie:${prefix}:${args.join(":")}`;

export const invalidateCache = async (patterns) => {
  for (const pattern of patterns) {
    await redis.del(pattern);
  }
};

