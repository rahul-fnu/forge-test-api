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

  it("replaces a todo", () => {
    const store = new TodoStore();
    const todo = store.create("Test");
    const replaced = store.replace(todo.id, "Replaced", true);
    assert.strictEqual(replaced.title, "Replaced");
    assert.strictEqual(replaced.completed, true);
  });

  it("replace defaults completed to false", () => {
    const store = new TodoStore();
    const todo = store.create("Test");
    store.update(todo.id, { completed: true });
    const replaced = store.replace(todo.id, "New Title");
    assert.strictEqual(replaced.title, "New Title");
    assert.strictEqual(replaced.completed, false);
  });

  it("replace returns undefined for missing id", () => {
    const store = new TodoStore();
    assert.strictEqual(store.replace("999", "Nope"), undefined);
  });

  it("deletes a todo", () => {
    const store = new TodoStore();
    const todo = store.create("Test");
    assert.ok(store.delete(todo.id));
    assert.strictEqual(store.getById(todo.id), undefined);
  });

  it("creates a todo with a due date", () => {
    const store = new TodoStore();
    const dueDate = "2026-12-31T00:00:00.000Z";
    const todo = store.create("With due date", dueDate);
    assert.strictEqual(todo.dueDate, dueDate);
  });

  it("updates dueDate on a todo", () => {
    const store = new TodoStore();
    const todo = store.create("Test");
    const dueDate = "2026-06-01T00:00:00.000Z";
    store.update(todo.id, { dueDate });
    assert.strictEqual(store.getById(todo.id)?.dueDate, dueDate);
  });

  it("returns overdue todos", () => {
    const store = new TodoStore();
    store.create("Past due", "2020-01-01T00:00:00.000Z");
    store.create("Future due", "2099-01-01T00:00:00.000Z");
    store.create("No due date");
    const completed = store.create("Completed past due", "2020-01-01T00:00:00.000Z");
    store.update(completed.id, { completed: true });

    const overdue = store.getOverdue();
    assert.strictEqual(overdue.length, 1);
    assert.strictEqual(overdue[0].title, "Past due");
  });
});
