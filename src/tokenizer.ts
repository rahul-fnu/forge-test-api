export type TokenType =
  | "NUMBER"
  | "PLUS"
  | "MINUS"
  | "STAR"
  | "SLASH"
  | "CARET"
  | "LPAREN"
  | "RPAREN"
  | "IDENT"
  | "EQUALS"
  | "SEMICOLON"
  | "EOF";

export interface Token {
  type: TokenType;
  value: string;
}

export function tokenize(input: string): Token[] {
  const tokens: Token[] = [];
  let i = 0;

  while (i < input.length) {
    const ch = input[i];

    if (ch === " " || ch === "\t") {
      i++;
      continue;
    }

    if (ch >= "0" && ch <= "9" || ch === ".") {
      let num = "";
      while (i < input.length && (input[i] >= "0" && input[i] <= "9" || input[i] === ".")) {
        num += input[i++];
      }
      tokens.push({ type: "NUMBER", value: num });
      continue;
    }

    if ((ch >= "a" && ch <= "z") || (ch >= "A" && ch <= "Z") || ch === "_") {
      let name = "";
      while (
        i < input.length &&
        ((input[i] >= "a" && input[i] <= "z") ||
          (input[i] >= "A" && input[i] <= "Z") ||
          (input[i] >= "0" && input[i] <= "9") ||
          input[i] === "_")
      ) {
        name += input[i++];
      }
      tokens.push({ type: "IDENT", value: name });
      continue;
    }

    switch (ch) {
      case "+": tokens.push({ type: "PLUS", value: ch }); break;
      case "-": tokens.push({ type: "MINUS", value: ch }); break;
      case "*": tokens.push({ type: "STAR", value: ch }); break;
      case "/": tokens.push({ type: "SLASH", value: ch }); break;
      case "^": tokens.push({ type: "CARET", value: ch }); break;
      case "(": tokens.push({ type: "LPAREN", value: ch }); break;
      case ")": tokens.push({ type: "RPAREN", value: ch }); break;
      case "=": tokens.push({ type: "EQUALS", value: ch }); break;
      case ";": tokens.push({ type: "SEMICOLON", value: ch }); break;
      default:
        throw new Error(`Unexpected character: ${ch}`);
    }
    i++;
  }

  tokens.push({ type: "EOF", value: "" });
  return tokens;
}
