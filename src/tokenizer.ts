export type Token =
  | { type: "number"; value: number }
  | { type: "op"; value: string }
  | { type: "lparen" }
  | { type: "rparen" };

export function tokenize(expr: string): Token[] {
  const tokens: Token[] = [];
  let i = 0;

  while (i < expr.length) {
    const ch = expr[i];

    if (ch === " ") {
      i++;
      continue;
    }

    if (ch >= "0" && ch <= "9" || ch === ".") {
      let num = "";
      while (i < expr.length && (expr[i] >= "0" && expr[i] <= "9" || expr[i] === ".")) {
        num += expr[i++];
      }
      tokens.push({ type: "number", value: parseFloat(num) });
      continue;
    }

    if ("+-*/%".includes(ch)) {
      tokens.push({ type: "op", value: ch });
      i++;
      continue;
    }

    if (ch === "(") {
      tokens.push({ type: "lparen" });
      i++;
      continue;
    }

    if (ch === ")") {
      tokens.push({ type: "rparen" });
      i++;
      continue;
    }

    throw new Error(`Unexpected character: ${ch}`);
  }

  return tokens;
}
