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

  it("paginates with default page", () => {
    const store = new TodoStore();
    for (let i = 0; i < 15; i++) store.create(`Todo ${i}`);
    const page = store.getPage(10);
    assert.strictEqual(page.data.length, 10);
    assert.strictEqual(page.hasMore, true);
    assert.ok(page.cursor);
  });

  it("paginates with cursor navigation", () => {
    const store = new TodoStore();
    for (let i = 0; i < 5; i++) store.create(`Todo ${i}`);
    const page1 = store.getPage(3);
    assert.strictEqual(page1.data.length, 3);
    assert.strictEqual(page1.hasMore, true);
    const page2 = store.getPage(3, page1.cursor);
    assert.strictEqual(page2.data.length, 2);
    assert.strictEqual(page2.hasMore, false);
    assert.strictEqual(page2.data[0].title, "Todo 3");
  });

  it("returns empty results for pagination", () => {
    const store = new TodoStore();
    const page = store.getPage(10);
    assert.strictEqual(page.data.length, 0);
    assert.strictEqual(page.cursor, null);
    assert.strictEqual(page.hasMore, false);
  });

  it("paginates with limit=1", () => {
    const store = new TodoStore();
    store.create("A");
    store.create("B");
    store.create("C");
    const p1 = store.getPage(1);
    assert.strictEqual(p1.data.length, 1);
    assert.strictEqual(p1.data[0].title, "A");
    assert.strictEqual(p1.hasMore, true);
    const p2 = store.getPage(1, p1.cursor);
    assert.strictEqual(p2.data[0].title, "B");
    assert.strictEqual(p2.hasMore, true);
    const p3 = store.getPage(1, p2.cursor);
    assert.strictEqual(p3.data[0].title, "C");
    assert.strictEqual(p3.hasMore, false);
  });

  it("returns empty for invalid cursor", () => {
    const store = new TodoStore();
    store.create("A");
    const page = store.getPage(10, "nonexistent");
    assert.strictEqual(page.data.length, 0);
    assert.strictEqual(page.hasMore, false);
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
