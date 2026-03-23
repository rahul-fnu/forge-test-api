import { createServer } from "node:http";
import { TodoStore } from "./store.js";
import { createRouter } from "./router.js";
import { compose, requestId, timing, errorHandler, bodyParser } from "./middleware.js";
import { authMiddleware } from "./auth.js";

const store = new TodoStore();
const port = parseInt(process.env.PORT ?? "3000");
const startTime = Date.now();

const app = compose(requestId, timing, errorHandler, authMiddleware, bodyParser, createRouter(store, startTime));

const server = createServer(app);

server.listen(port, () => {
  console.log(`Todo API running on http://localhost:${port}`);
});

export { server };
