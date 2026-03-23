import { Token, tokenize } from "./tokenizer.js";

class Parser {
  private tokens: Token[];
  private pos = 0;
  private env: Map<string, number>;

  constructor(tokens: Token[], env: Map<string, number>) {
    this.tokens = tokens;
    this.env = env;
  }

  private peek(): Token {
    return this.tokens[this.pos];
  }

  private advance(): Token {
    return this.tokens[this.pos++];
  }

  private expect(type: string): Token {
    const tok = this.advance();
    if (tok.type !== type) {
      throw new Error(`Expected ${type} but got ${tok.type}`);
    }
    return tok;
  }

  // statement: IDENT '=' expr | expr
  parseStatement(): number {
    if (
      this.peek().type === "IDENT" &&
      this.pos + 1 < this.tokens.length &&
      this.tokens[this.pos + 1].type === "EQUALS"
    ) {
      const name = this.advance().value;
      this.advance(); // consume '='
      const value = this.parseExpr();
      this.env.set(name, value);
      return value;
    }
    return this.parseExpr();
  }

  // expr: term (('+' | '-') term)*
  parseExpr(): number {
    let left = this.parseTerm();
    while (this.peek().type === "PLUS" || this.peek().type === "MINUS") {
      const op = this.advance();
      const right = this.parseTerm();
      left = op.type === "PLUS" ? left + right : left - right;
    }
    return left;
  }

  // term: exponent (('*' | '/') exponent)*
  parseTerm(): number {
    let left = this.parseExponent();
    while (this.peek().type === "STAR" || this.peek().type === "SLASH") {
      const op = this.advance();
      const right = this.parseExponent();
      left = op.type === "STAR" ? left * right : left / right;
    }
    return left;
  }

  // exponent: unary ('^' exponent)?  (right-associative)
  parseExponent(): number {
    const base = this.parseUnary();
    if (this.peek().type === "CARET") {
      this.advance();
      const exp = this.parseExponent();
      return Math.pow(base, exp);
    }
    return base;
  }

  // unary: ('-' | '+') unary | primary
  parseUnary(): number {
    if (this.peek().type === "MINUS") {
      this.advance();
      return -this.parseUnary();
    }
    if (this.peek().type === "PLUS") {
      this.advance();
      return this.parseUnary();
    }
    return this.parsePrimary();
  }

  // primary: NUMBER | IDENT | '(' expr ')'
  parsePrimary(): number {
    const tok = this.peek();

    if (tok.type === "NUMBER") {
      this.advance();
      return parseFloat(tok.value);
    }

    if (tok.type === "IDENT") {
      this.advance();
      const val = this.env.get(tok.value);
      if (val === undefined) {
        throw new Error(`Undefined variable: ${tok.value}`);
      }
      return val;
    }

    if (tok.type === "LPAREN") {
      this.advance();
      const val = this.parseExpr();
      this.expect("RPAREN");
      return val;
    }

    throw new Error(`Unexpected token: ${tok.type}`);
  }

  // program: statement (';' statement)* EOF
  parseProgram(): number {
    let result = this.parseStatement();
    while (this.peek().type === "SEMICOLON") {
      this.advance();
      if (this.peek().type === "EOF") break;
      result = this.parseStatement();
    }
    this.expect("EOF");
    return result;
  }
}

export function evaluate(input: string): number {
  const tokens = tokenize(input);
  const env = new Map<string, number>();
  const parser = new Parser(tokens, env);
  return parser.parseProgram();
}
