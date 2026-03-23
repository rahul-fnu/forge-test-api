import { createServer } from "node:http";
import { TodoStore } from "./store.js";
import { createRouter } from "./router.js";
import { compose, requestId, timing, errorHandler, bodyParser } from "./middleware.js";
import { auth } from "./auth.js";
import { RateLimiter, createRateLimitMiddleware } from "./rate-limiter.js";

const store = new TodoStore();
const port = parseInt(process.env.PORT ?? "3000");
const limiter = new RateLimiter();

const app = compose(requestId, timing, errorHandler, bodyParser, auth, createRateLimitMiddleware(limiter), createRouter(store));

const server = createServer(app);

server.listen(port, () => {
  console.log(`Todo API running on http://localhost:${port}`);
});

export { server };
