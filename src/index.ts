import { createServer } from "node:http";
import { TodoStore } from "./store.js";
import { createRouter } from "./router.js";
import { compose, requestId, timing, errorHandler, bodyParser } from "./middleware.js";
import { authMiddleware } from "./auth.js";
import { WebhookManager } from "./webhooks.js";
import { corsMiddleware } from "./cors.js";
import { RequestRecorder, recordingMiddleware } from "./replay.js";
import { RequestLogger, loggingMiddleware } from "./logger.js";

const store = new TodoStore();
const webhookManager = new WebhookManager();
const recorder = new RequestRecorder();
const logger = new RequestLogger();
const port = parseInt(process.env.PORT ?? "3000");
const startTime = Date.now();

const app = compose(corsMiddleware, requestId, timing, errorHandler, authMiddleware, bodyParser, loggingMiddleware(logger), recordingMiddleware(recorder), createRouter(store, startTime, webhookManager, logger, recorder));

const server = createServer(app);

server.listen(port, () => {
  console.log(`Todo API running on http://localhost:${port}`);
});

export { server };
