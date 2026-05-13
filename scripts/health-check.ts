/**
 * Health Check Script
 * Validates all Horizon services are running and healthy.
 *
 * Usage: bun run scripts/health-check.ts
 */

const CHECKS = [
  { name: "Web Frontend", url: "http://localhost:3000", optional: true },
  { name: "Relay API", url: "http://localhost:3001/health" },
  { name: "Prometheus", url: "http://localhost:9090/-/healthy" },
  { name: "Grafana", url: "http://localhost:3002/api/health" },
];

async function checkService(name: string, url: string): Promise<boolean> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);
    const res = await fetch(url, { signal: controller.signal });
    clearTimeout(timeout);

    if (res.ok) {
      console.log(`✅ ${name} is healthy`);
      return true;
    }
    console.log(`❌ ${name} returned status ${res.status}`);
    return false;
  } catch (err) {
    console.log(`❌ ${name} is unreachable: ${err instanceof Error ? err.message : String(err)}`);
    return false;
  }
}

async function checkPostgres(): Promise<boolean> {
  try {
    const { db } = await import("../apps/relay/src/db/index.js");
    const result = await db.execute("SELECT 1");
    console.log(`✅ PostgreSQL is connected`);
    return true;
  } catch (err) {
    console.log(`❌ PostgreSQL connection failed: ${err instanceof Error ? err.message : String(err)}`);
    return false;
  }
}

async function checkRedis(): Promise<boolean> {
  try {
    const { redis } = await import("../apps/relay/src/lib/redis.js");
    await redis.ping();
    console.log(`✅ Redis is connected`);
    return true;
  } catch (err) {
    console.log(`❌ Redis connection failed: ${err instanceof Error ? err.message : String(err)}`);
    return false;
  }
}

async function main() {
  console.log("🔍 Horizon Health Check\n");

  let allHealthy = true;

  for (const check of CHECKS) {
    const healthy = await checkService(check.name, check.url);
    if (!healthy && !check.optional) allHealthy = false;
  }

  const pgHealthy = await checkPostgres();
  if (!pgHealthy) allHealthy = false;

  const redisHealthy = await checkRedis();
  if (!redisHealthy) allHealthy = false;

  console.log("");
  if (allHealthy) {
    console.log("🎉 All services are healthy!");
    process.exit(0);
  } else {
    console.log("⚠️ Some services are unhealthy");
    process.exit(1);
  }
}

main();
