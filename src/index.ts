import { createServer, IncomingMessage, ServerResponse } from "node:http";
import { TodoStore } from "./store.js";
import { router } from "./router.js";
import { withLogging } from "./middleware.js";

const store = new TodoStore();
const port = parseInt(process.env.PORT ?? "3000");

const handler = withLogging((req: IncomingMessage, res: ServerResponse) => {
  router(req, res, store);
});

const server = createServer(handler);

server.listen(port, () => {
  console.log(`Todo API running on http://localhost:${port}`);
});

export { server };
