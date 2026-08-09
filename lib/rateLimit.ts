import Redis from 'ioredis';

let redis: Redis | null = null;
try {
  if (process.env.REDIS_URL) {
    redis = new Redis(process.env.REDIS_URL, {
      maxRetriesPerRequest: 1,
      lazyConnect: true,
    });
    redis.on('error', () => {
      // In-memory fallback
    });
  }
} catch {
  // Ignore
}

// In-memory sliding window store fallback
const inMemoryHits = new Map<string, number[]>();

/**
 * Sliding window rate limiter
 */
export async function checkRateLimit(
  key: string,
  limit: number,
  windowSeconds = 60
): Promise<{ success: boolean; limit: number; remaining: number; reset: number }> {
  const now = Date.now();
  const windowMs = windowSeconds * 1000;
  const clearBefore = now - windowMs;

  if (redis) {
    try {
      const redisKey = `ratelimit:${key}`;
      const multi = redis.multi();
      multi.zremrangebyscore(redisKey, 0, clearBefore);
      multi.zadd(redisKey, now, `${now}-${Math.random()}`);
      multi.zcard(redisKey);
      multi.expire(redisKey, windowSeconds);

      const results = await multi.exec();
      const count = (results?.[2]?.[1] as number) || 1;

      return {
        success: count <= limit,
        limit,
        remaining: Math.max(0, limit - count),
        reset: Math.ceil((now + windowMs) / 1000),
      };
    } catch {
      // Fall through to in-memory
    }
  }

  // In-memory sliding window
  const timestamps = inMemoryHits.get(key) || [];
  const validTimestamps = timestamps.filter((t) => t > clearBefore);
  validTimestamps.push(now);
  inMemoryHits.set(key, validTimestamps);

  const count = validTimestamps.length;
  return {
    success: count <= limit,
    limit,
    remaining: Math.max(0, limit - count),
    reset: Math.ceil((now + windowMs) / 1000),
  };
}
