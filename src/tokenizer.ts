export type Token =
  | { type: "number"; value: number }
  | { type: "op"; value: string }
  | { type: "paren"; value: "(" | ")" };

export function tokenize(expr: string): Token[] {
  const tokens: Token[] = [];
  let i = 0;

  while (i < expr.length) {
    if (expr[i] === " ") {
      i++;
      continue;
    }

    if (expr[i] === "(" || expr[i] === ")") {
      tokens.push({ type: "paren", value: expr[i] as "(" | ")" });
      i++;
      continue;
    }

    if (expr[i] === "*" && expr[i + 1] === "*") {
      tokens.push({ type: "op", value: "**" });
      i += 2;
      continue;
    }

    if ("+-*/%".includes(expr[i])) {
      tokens.push({ type: "op", value: expr[i] });
      i++;
      continue;
    }

    if (/\d/.test(expr[i]) || expr[i] === ".") {
      let num = "";
      while (i < expr.length && (/\d/.test(expr[i]) || expr[i] === ".")) {
        num += expr[i];
        i++;
      }
      tokens.push({ type: "number", value: parseFloat(num) });
      continue;
    }

    throw new Error(`Unexpected character: ${expr[i]}`);
  }

  return tokens;
}
