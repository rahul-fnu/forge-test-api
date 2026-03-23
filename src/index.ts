import { createServer, IncomingMessage, ServerResponse } from "node:http";
import { TodoStore } from "./store.js";
import { router } from "./router.js";

const store = new TodoStore();
const port = parseInt(process.env.PORT ?? "3000");

const server = createServer((req: IncomingMessage, res: ServerResponse) => {
  router(req, res, store);
});

server.listen(port, () => {
  console.log(`Todo API running on http://localhost:${port}`);
});

export { server };
