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
    const tok = peek();
    if (!tok) throw new Error("Unexpected end of expression");

    if (tok.type === "paren" && tok.value === "(") {
      consume();
      const val = parseAddSub();
      const closing = consume();
      if (!closing || closing.type !== "paren" || closing.value !== ")") {
        throw new Error("Expected closing parenthesis");
      }
      return val;
    }

    if (tok.type === "number") {
      consume();
      return tok.value;
    }

    throw new Error(`Unexpected token: ${JSON.stringify(tok)}`);
  }

  function parseExponent(): number {
    let base = parsePrimary();
    if (peek()?.type === "op" && peek()?.value === "**") {
      consume();
      const exp = parseExponent();
      base = base ** exp;
    }
    return base;
  }

  function parseMulDiv(): number {
    let left = parseExponent();
    while (peek()?.type === "op" && ("*/%".includes(peek()!.value as string))) {
      const op = consume().value;
      const right = parseExponent();
      if (op === "*") left *= right;
      else if (op === "/") left /= right;
      else if (op === "%") left %= right;
    }
    return left;
  }

  function parseAddSub(): number {
    let left = parseMulDiv();
    while (peek()?.type === "op" && "+-".includes(peek()!.value as string)) {
      const op = consume().value;
      const right = parseMulDiv();
      if (op === "+") left += right;
      else left -= right;
    }
    return left;
  }

  const result = parseAddSub();
  if (pos < tokens.length) {
    throw new Error(`Unexpected token at position ${pos}`);
  }
  return result;
}
