import { Token, tokenize } from "./tokenizer.js";

export function evaluate(expr: string): number {
  const tokens = tokenize(expr);
  let pos = 0;

  function peek(): Token | undefined {
    return tokens[pos];
  }

  function consume(): Token {
    return tokens[pos++];
  }

  function parsePrimary(): number {
    const token = peek();
    if (!token) throw new Error("Unexpected end of expression");

    if (token.type === "number") {
      consume();
      return token.value;
    }

    if (token.type === "lparen") {
      consume();
      const result = parseAddSub();
      const closing = consume();
      if (!closing || closing.type !== "rparen") {
        throw new Error("Expected closing parenthesis");
      }
      return result;
    }

    throw new Error(`Unexpected token: ${JSON.stringify(token)}`);
  }

  function parseMulDivMod(): number {
    let left = parsePrimary();
    while (peek()?.type === "op" && (peek() as Token & { value: string }).value.match(/^[*/%]$/)) {
      const op = (consume() as Token & { value: string }).value;
      const right = parsePrimary();
      if (op === "*") left = left * right;
      else if (op === "/") left = left / right;
      else left = left % right;
    }
    return left;
  }

  function parseAddSub(): number {
    let left = parseMulDivMod();
    while (peek()?.type === "op" && (peek() as Token & { value: string }).value.match(/^[+-]$/)) {
      const op = (consume() as Token & { value: string }).value;
      const right = parseMulDivMod();
      if (op === "+") left = left + right;
      else left = left - right;
    }
    return left;
  }

  const result = parseAddSub();
  if (pos < tokens.length) {
    throw new Error("Unexpected token after expression");
  }
  return result;
}
