import { createApp } from "./app.js";
import { createLogger, printBanner } from "./lib/logger.js";

const logger = createLogger("Relay");
const port = Number(process.env.PORT || 3001);

const app = createApp();

const server = Bun.serve({
  port,
  fetch: app.fetch,
});

printBanner(port);
logger.info("Relay is live and listening");
logger.info("Database connected");

process.on("SIGINT", () => {
  console.log("");
  logger.info("Shutting down gracefully — see you soon");
  server.stop();
  process.exit(0);
});
