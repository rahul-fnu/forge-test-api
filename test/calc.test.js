import { describe, it } from "node:test";
import assert from "node:assert";
import { tokenize } from "../dist/tokenizer.js";
import { evaluate } from "../dist/evaluator.js";

describe("Tokenizer", () => {
  it("tokenizes identifiers and symbols", () => {
    const tokens = tokenize("x=5; y=3");
    const types = tokens.map((t) => t.type);
    assert.deepStrictEqual(types, [
      "IDENT", "EQUALS", "NUMBER", "SEMICOLON",
      "IDENT", "EQUALS", "NUMBER", "EOF",
    ]);
  });

  it("tokenizes multi-letter identifiers", () => {
    const tokens = tokenize("foo + bar");
    assert.strictEqual(tokens[0].type, "IDENT");
    assert.strictEqual(tokens[0].value, "foo");
    assert.strictEqual(tokens[2].type, "IDENT");
    assert.strictEqual(tokens[2].value, "bar");
  });
});

describe("Evaluator", () => {
  it("evaluates basic arithmetic", () => {
    assert.strictEqual(evaluate("2+3"), 5);
    assert.strictEqual(evaluate("10-4"), 6);
    assert.strictEqual(evaluate("3*4"), 12);
    assert.strictEqual(evaluate("8/2"), 4);
  });

  it("evaluates exponentiation", () => {
    assert.strictEqual(evaluate("2^3"), 8);
    assert.strictEqual(evaluate("2^2^3"), 256); // right-associative: 2^(2^3)
  });

  it("evaluates parenthesized expressions", () => {
    assert.strictEqual(evaluate("(2+3)*4"), 20);
  });

  it("assigns and uses a variable", () => {
    assert.strictEqual(evaluate("x=5; x*2+1"), 11);
  });

  it("supports multiple variable assignments", () => {
    assert.strictEqual(evaluate("x=5; y=3; x+y"), 8);
  });

  it("supports variable in complex expression", () => {
    assert.strictEqual(evaluate("a=2; b=3; a^b + b*a"), 14);
  });

  it("throws on undefined variable", () => {
    assert.throws(() => evaluate("x+1"), /Undefined variable: x/);
  });

  it("returns last expression value", () => {
    assert.strictEqual(evaluate("x=10; y=20; x+y"), 30);
  });

  it("handles unary minus", () => {
    assert.strictEqual(evaluate("-3+5"), 2);
  });
});
