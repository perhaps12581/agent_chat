import Redis from "ioredis";

const globalForRedis = globalThis as unknown as { redis: Redis };

export const redis =
  globalForRedis.redis ||
  new Redis(process.env.REDIS_URL || "redis://localhost:6379", {
    lazyConnect: true,
    maxRetriesPerRequest: 2,
    enableOfflineQueue: false,
    retryStrategy(times) {
      if (times > 3) return null;
      return Math.min(times * 100, 1000);
    },
  });

if (process.env.NODE_ENV !== "production") globalForRedis.redis = redis;

// 通用安全缓存读取辅助函数 (Redis 异常时自动降级走 DB，绝不中断业务)
export async function cacheGet<T>(key: string): Promise<T | null> {
  try {
    const val = await redis.get(key);
    if (!val) return null;
    return JSON.parse(val) as T;
  } catch (err) {
    console.warn(`[Redis Cache GET Fail: ${key}]`, (err as Error).message);
    return null;
  }
}

// 通用安全缓存写入辅助函数
export async function cacheSet(key: string, value: unknown, ttlSeconds = 60): Promise<void> {
  try {
    const str = JSON.stringify(value);
    await redis.setex(key, ttlSeconds, str);
  } catch (err) {
    console.warn(`[Redis Cache SET Fail: ${key}]`, (err as Error).message);
  }
}

// 缓存清除辅助函数 (支持单键或批量通配键)
export async function cacheDel(...keys: string[]): Promise<void> {
  try {
    if (keys.length > 0) {
      await redis.del(...keys);
    }
  } catch (err) {
    console.warn(`[Redis Cache DEL Fail]`, (err as Error).message);
  }
}

// 缓存键规范
export const CacheKeys = {
  conversations: "chat:conversations",
  messages: (convId: string) => `chat:conv:${convId}:messages`,
  agents: "chat:agents",
};
