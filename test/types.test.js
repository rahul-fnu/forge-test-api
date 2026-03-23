import { describe, it } from "node:test";
import assert from "node:assert";
import { isTodo, isValidApiKey, DEFAULT_RATE_LIMIT, DEFAULT_PAGE_SIZE, API_VERSION } from "../dist/types.js";

describe("isTodo", () => {
  it("returns true for a valid todo object", () => {
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

  it("returns false for a string", () => {
    assert.strictEqual(isTodo("not a todo"), false);
  });

  it("returns false when id is missing", () => {
    assert.strictEqual(isTodo({ title: "Test", completed: false, createdAt: "2026-01-01" }), false);
  });

  it("returns false when title is not a string", () => {
    assert.strictEqual(isTodo({ id: "1", title: 123, completed: false, createdAt: "2026-01-01" }), false);
  });

  it("returns false when completed is not a boolean", () => {
    assert.strictEqual(isTodo({ id: "1", title: "Test", completed: "yes", createdAt: "2026-01-01" }), false);
  });
});

describe("isValidApiKey", () => {
  it("returns true for a valid key", () => {
    assert.strictEqual(isValidApiKey("abcdefghijklmnop"), true);
  });

  it("returns true for a key with allowed characters", () => {
    assert.strictEqual(isValidApiKey("abc_DEF-123_ghijklmn"), true);
  });

  it("returns false for a short key", () => {
    assert.strictEqual(isValidApiKey("short"), false);
  });

  it("returns false for a key with invalid characters", () => {
    assert.strictEqual(isValidApiKey("invalid key!@#$%^&"), false);
  });

  it("returns false for non-string input", () => {
    assert.strictEqual(isValidApiKey(12345), false);
  });

  it("returns false for null", () => {
    assert.strictEqual(isValidApiKey(null), false);
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
