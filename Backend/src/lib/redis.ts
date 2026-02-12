import IORedis from "ioredis";

const redis = new IORedis(process.env.REDIS_URL!, {
  maxRetriesPerRequest: null,
});

redis.on("connect", () => {
  console.log("✅ Redis connected (cache)");
});

redis.on("error", (err) => {
  console.error("❌ Redis error", err);
});

export default redis;
