import Redis from "redis";

const redis = Redis.createClient({
  url: process.env.REDIS_URL || "redis://localhost:6379",
});

redis.on("error", (err) => console.error("Redis Client Error", err));

await redis.connect();
export default redis;