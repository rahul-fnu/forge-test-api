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

  it("filters by completed=true", () => {
    const store = new TodoStore();
    store.create("A");
    const b = store.create("B");
    store.update(b.id, { completed: true });
    const result = store.getAll(true);
    assert.strictEqual(result.length, 1);
    assert.strictEqual(result[0].title, "B");
  });

  it("filters by completed=false", () => {
    const store = new TodoStore();
    store.create("A");
    const b = store.create("B");
    store.update(b.id, { completed: true });
    const result = store.getAll(false);
    assert.strictEqual(result.length, 1);
    assert.strictEqual(result[0].title, "A");
  });

  it("returns all todos when no filter is provided", () => {
    const store = new TodoStore();
    store.create("A");
    const b = store.create("B");
    store.update(b.id, { completed: true });
    assert.strictEqual(store.getAll().length, 2);
  });

  it("deletes a todo", () => {
    const store = new TodoStore();
    const todo = store.create("Test");
    assert.ok(store.delete(todo.id));
    assert.strictEqual(store.getById(todo.id), undefined);
  });
});
