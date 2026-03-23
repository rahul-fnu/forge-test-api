import { describe, it } from "node:test";
import assert from "node:assert";
import { isTodo, isValidApiKey, DEFAULT_RATE_LIMIT, DEFAULT_PAGE_SIZE, API_VERSION } from "../dist/types.js";

describe("isTodo", () => {
  it("returns true for a valid todo", () => {
    assert.strictEqual(isTodo({
      id: "1",
      title: "Buy milk",
      completed: false,
      createdAt: "2026-01-01T00:00:00.000Z",
    }), true);
  });

  it("returns true for a todo with optional dueDate", () => {
    assert.strictEqual(isTodo({
      id: "1",
      title: "Buy milk",
      completed: false,
      createdAt: "2026-01-01T00:00:00.000Z",
      dueDate: "2026-12-31T00:00:00.000Z",
    }), true);
  });

  it("returns false for null", () => {
    assert.strictEqual(isTodo(null), false);
  });

  it("returns false for a string", () => {
    assert.strictEqual(isTodo("hello"), false);
  });

  it("returns false for missing id", () => {
    assert.strictEqual(isTodo({ title: "X", completed: false, createdAt: "2026-01-01" }), false);
  });

  it("returns false for wrong type of completed", () => {
    assert.strictEqual(isTodo({ id: "1", title: "X", completed: "yes", createdAt: "2026-01-01" }), false);
  });

  it("returns false for missing title", () => {
    assert.strictEqual(isTodo({ id: "1", completed: false, createdAt: "2026-01-01" }), false);
  });
});

describe("isValidApiKey", () => {
  it("returns true for a valid key", () => {
    assert.strictEqual(isValidApiKey("abcdefghijklmnop"), true);
  });

  it("returns true for key with dashes and underscores", () => {
    assert.strictEqual(isValidApiKey("abc_def-ghijklmnop"), true);
  });

  it("returns false for a short key", () => {
    assert.strictEqual(isValidApiKey("short"), false);
  });

  it("returns false for non-string", () => {
    assert.strictEqual(isValidApiKey(12345), false);
  });

  it("returns false for key with special characters", () => {
    assert.strictEqual(isValidApiKey("abcdefghijklmn!@"), false);
  });
});

describe("constants", () => {
  it("exports DEFAULT_RATE_LIMIT", () => {
    assert.strictEqual(DEFAULT_RATE_LIMIT, 100);
  });

  it("exports DEFAULT_PAGE_SIZE", () => {
    assert.strictEqual(DEFAULT_PAGE_SIZE, 20);
  });

  it("exports API_VERSION", () => {
    assert.strictEqual(API_VERSION, "v1");
  });
});
