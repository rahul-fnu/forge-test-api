import { describe, it } from "node:test";
import assert from "node:assert";
import { tokenize } from "../dist/tokenizer.js";
import { evaluate } from "../dist/evaluator.js";

describe("Tokenizer", () => {
  it("recognizes ** as a single operator", () => {
    const tokens = tokenize("2 ** 3");
    assert.deepStrictEqual(tokens, [
      { type: "number", value: 2 },
      { type: "op", value: "**" },
      { type: "number", value: 3 },
    ]);
  });

  it("distinguishes * from **", () => {
    const tokens = tokenize("2 * 3 ** 4");
    const ops = tokens.filter((t) => t.type === "op").map((t) => t.value);
    assert.deepStrictEqual(ops, ["*", "**"]);
  });
});

describe("Evaluator", () => {
  it("evaluates basic arithmetic", () => {
    assert.strictEqual(evaluate("2 + 3"), 5);
    assert.strictEqual(evaluate("10 - 4"), 6);
    assert.strictEqual(evaluate("3 * 4"), 12);
    assert.strictEqual(evaluate("8 / 2"), 4);
  });

  it("evaluates 2 ** 3 = 8", () => {
    assert.strictEqual(evaluate("2 ** 3"), 8);
  });

  it("evaluates 3 ** 2 = 9", () => {
    assert.strictEqual(evaluate("3 ** 2"), 9);
  });

  it("** has higher precedence than * and /", () => {
    assert.strictEqual(evaluate("2 * 3 ** 2"), 18);
    assert.strictEqual(evaluate("27 / 3 ** 3"), 1);
  });

  it("** is right-associative: 2 ** 3 ** 2 = 512", () => {
    assert.strictEqual(evaluate("2 ** 3 ** 2"), 512);
  });

  it("handles parentheses with **", () => {
    assert.strictEqual(evaluate("(2 ** 3) ** 2"), 64);
  });
});
