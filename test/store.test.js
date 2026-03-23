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

  it("bulk creates multiple todos", () => {
    const store = new TodoStore();
    const todos = store.bulkCreate(["A", "B", "C"]);
    assert.strictEqual(todos.length, 3);
    assert.strictEqual(todos[0].title, "A");
    assert.strictEqual(todos[1].title, "B");
    assert.strictEqual(todos[2].title, "C");
    assert.strictEqual(store.getAll().length, 3);
  });

  it("bulk deletes multiple todos", () => {
    const store = new TodoStore();
    const a = store.create("A");
    const b = store.create("B");
    const result = store.bulkDelete([a.id, b.id]);
    assert.strictEqual(result.deleted, 2);
    assert.deepStrictEqual(result.notFound, []);
    assert.strictEqual(store.getAll().length, 0);
  });

  it("bulk delete reports not found ids", () => {
    const store = new TodoStore();
    const a = store.create("A");
    const result = store.bulkDelete([a.id, "999", "888"]);
    assert.strictEqual(result.deleted, 1);
    assert.deepStrictEqual(result.notFound, ["999", "888"]);
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
