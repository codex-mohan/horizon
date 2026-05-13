/**
 * Load Test Script
 * Simulates concurrent users hitting the Horizon API.
 *
 * Usage: bun run scripts/load-test.ts
 */

const CONFIG = {
  baseUrl: process.env.BASE_URL || "http://localhost:3001",
  concurrentUsers: Number(process.env.CONCURRENT_USERS || 10),
  requestsPerUser: Number(process.env.REQUESTS_PER_USER || 5),
  delayBetweenRequestsMs: Number(process.env.DELAY_MS || 1000),
};

interface LoadTestResult {
  userId: number;
  requestId: number;
  status: number;
  durationMs: number;
  error?: string;
}

async function runUser(userId: number): Promise<LoadTestResult[]> {
  const results: LoadTestResult[] = [];

  for (let i = 0; i < CONFIG.requestsPerUser; i++) {
    const start = performance.now();
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 10000);

      const res = await fetch(`${CONFIG.baseUrl}/health`, {
        signal: controller.signal,
      });

      clearTimeout(timeout);

      results.push({
        userId,
        requestId: i,
        status: res.status,
        durationMs: Math.round(performance.now() - start),
      });
    } catch (err) {
      results.push({
        userId,
        requestId: i,
        status: 0,
        durationMs: Math.round(performance.now() - start),
        error: err instanceof Error ? err.message : String(err),
      });
    }

    if (i < CONFIG.requestsPerUser - 1) {
      await new Promise((r) => setTimeout(r, CONFIG.delayBetweenRequestsMs));
    }
  }

  return results;
}

async function main() {
  console.log("🚀 Horizon Load Test\n");
  console.log(`Configuration:`);
  console.log(`  Base URL: ${CONFIG.baseUrl}`);
  console.log(`  Concurrent Users: ${CONFIG.concurrentUsers}`);
  console.log(`  Requests per User: ${CONFIG.requestsPerUser}`);
  console.log(`  Delay between requests: ${CONFIG.delayBetweenRequestsMs}ms\n`);

  const startTime = performance.now();
  const allResults = await Promise.all(
    Array.from({ length: CONFIG.concurrentUsers }, (_, i) => runUser(i))
  );
  const totalDuration = Math.round(performance.now() - startTime);

  const flatResults = allResults.flat();
  const successful = flatResults.filter((r) => r.status === 200);
  const failed = flatResults.filter((r) => r.status !== 200);
  const avgDuration = Math.round(
    flatResults.reduce((sum, r) => sum + r.durationMs, 0) / flatResults.length
  );
  const minDuration = Math.min(...flatResults.map((r) => r.durationMs));
  const maxDuration = Math.max(...flatResults.map((r) => r.durationMs));

  console.log("Results:");
  console.log(`  Total requests: ${flatResults.length}`);
  console.log(`  Successful: ${successful.length} (${Math.round((successful.length / flatResults.length) * 100)}%)`);
  console.log(`  Failed: ${failed.length}`);
  console.log(`  Total duration: ${totalDuration}ms`);
  console.log(`  Avg response time: ${avgDuration}ms`);
  console.log(`  Min response time: ${minDuration}ms`);
  console.log(`  Max response time: ${maxDuration}ms`);
  console.log(`  Requests/sec: ${Math.round(flatResults.length / (totalDuration / 1000))}`);

  if (failed.length > 0) {
    console.log("\nFailed requests:");
    for (const f of failed.slice(0, 10)) {
      console.log(`  User ${f.userId}, Req ${f.requestId}: ${f.error || `HTTP ${f.status}`}`);
    }
  }

  console.log("\n✅ Load test complete");
}

main();
