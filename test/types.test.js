import { describe, it } from "node:test";
import assert from "node:assert";
import { isTodo, isValidApiKey, DEFAULT_RATE_LIMIT, DEFAULT_PAGE_SIZE, API_VERSION } from "../dist/types.js";

describe("isTodo", () => {
  it("returns true for a valid todo", () => {
    assert.strictEqual(
      isTodo({ id: "1", title: "Test", completed: false, createdAt: "2026-01-01T00:00:00.000Z" }),
      true
    );
  });

  it("returns true for a todo with optional dueDate", () => {
    assert.strictEqual(
      isTodo({ id: "1", title: "Test", completed: false, createdAt: "2026-01-01T00:00:00.000Z", dueDate: "2026-12-31" }),
      true
    );
  });

  it("returns false for null", () => {
    assert.strictEqual(isTodo(null), false);
  });

  it("returns false for non-object", () => {
    assert.strictEqual(isTodo("string"), false);
    assert.strictEqual(isTodo(42), false);
  });

  it("returns false when missing required fields", () => {
    assert.strictEqual(isTodo({ id: "1", title: "Test" }), false);
    assert.strictEqual(isTodo({ id: "1", completed: false, createdAt: "x" }), false);
  });

  it("returns false when fields have wrong types", () => {
    assert.strictEqual(isTodo({ id: 1, title: "T", completed: false, createdAt: "x" }), false);
    assert.strictEqual(isTodo({ id: "1", title: "T", completed: "no", createdAt: "x" }), false);
  });
});

describe("isValidApiKey", () => {
  it("returns true for a valid key", () => {
    assert.strictEqual(isValidApiKey("abcdefghijklmnop"), true);
  });

  it("allows underscores and hyphens", () => {
    assert.strictEqual(isValidApiKey("my_api-key_12345678"), true);
  });

  it("returns false for short keys", () => {
    assert.strictEqual(isValidApiKey("short"), false);
  });

  it("returns false for non-string", () => {
    assert.strictEqual(isValidApiKey(12345678901234567), false);
    assert.strictEqual(isValidApiKey(null), false);
  });

  it("returns false for keys with special characters", () => {
    assert.strictEqual(isValidApiKey("invalid key!@#$%^&"), false);
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
