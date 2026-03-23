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

  it("searches todos by title substring (case-insensitive)", () => {
    const store = new TodoStore();
    store.create("Buy milk");
    store.create("Buy eggs");
    store.create("Read book");
    const results = store.search("buy");
    assert.strictEqual(results.length, 2);
  });

  it("returns empty array when search has no matches", () => {
    const store = new TodoStore();
    store.create("Buy milk");
    assert.strictEqual(store.search("xyz").length, 0);
  });
});
