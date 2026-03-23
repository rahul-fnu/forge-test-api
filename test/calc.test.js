import { describe, it } from "node:test";
import assert from "node:assert";
import { tokenize } from "../dist/tokenizer.js";
import { evaluate } from "../dist/evaluator.js";

describe("Tokenizer", () => {
  it("recognizes % as an operator", () => {
    const tokens = tokenize("10 % 3");
    assert.deepStrictEqual(tokens, [
      { type: "number", value: 10 },
      { type: "op", value: "%" },
      { type: "number", value: 3 },
    ]);
  });
});

describe("Evaluator", () => {
  it("evaluates basic arithmetic", () => {
    assert.strictEqual(evaluate("2 + 3"), 5);
    assert.strictEqual(evaluate("10 - 4"), 6);
    assert.strictEqual(evaluate("3 * 4"), 12);
    assert.strictEqual(evaluate("15 / 3"), 5);
  });

  it("evaluates modulo", () => {
    assert.strictEqual(evaluate("10 % 3"), 1);
    assert.strictEqual(evaluate("7 % 2"), 1);
  });

  it("gives modulo same precedence as * and /", () => {
    assert.strictEqual(evaluate("2 + 10 % 3"), 3);
    assert.strictEqual(evaluate("10 % 3 * 2"), 2);
  });

  it("handles parentheses", () => {
    assert.strictEqual(evaluate("(2 + 3) * 4"), 20);
    assert.strictEqual(evaluate("(10 + 2) % 5"), 2);
  });
});
