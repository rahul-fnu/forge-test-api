import { describe, it } from "node:test";
import assert from "node:assert";
import { TodoStore } from "../dist/store.js";

describe("TodoStore", () => {
  it("creates a todo", () => {
    const store = new TodoStore();
    const todo = store.create("Buy milk");
    assert.strictEqual(todo.title, "Buy milk");
    assert.strictEqual(todo.completed, false);
    assert.ok(todo.id);
  });

  it("gets all todos", () => {
    const store = new TodoStore();
    store.create("A");
    store.create("B");
    assert.strictEqual(store.getAll().length, 2);
  });

  it("updates a todo", () => {
    const store = new TodoStore();
    const todo = store.create("Test");
    store.update(todo.id, { completed: true });
    assert.strictEqual(store.getById(todo.id)?.completed, true);
  });

  it("deletes a todo", () => {
    const store = new TodoStore();
    const todo = store.create("Test");
    assert.ok(store.delete(todo.id));
    assert.strictEqual(store.getById(todo.id), undefined);
  });
});
