/**
 * Small, safe expression evaluator for the declarative per-problem JSON
 * schemas under lib/jev/problems/*.json (see max-finding.json).
 *
 * Deliberately NOT a general eval() — only arithmetic, comparison, logical
 * operators, array indexing/`.length`, and state-variable lookups. A `$`
 * prefix on a variable (e.g. `$currentIndex`) is purely documentation for
 * schema authors ("this reads current state") and is stripped before
 * parsing; `$currentIndex` and `currentIndex` evaluate identically.
 */

type ExprValue = number | boolean | null | number[];
type Scope = Record<string, unknown>;

type Token =
  | { kind: "num"; value: number }
  | { kind: "ident"; value: string }
  | { kind: "op"; value: string }
  | { kind: "eof" };

const OPERATORS = ["<=", ">=", "==", "!=", "&&", "||", "+", "-", "*", "/", "<", ">", "!", "(", ")", "[", "]", "."];

function tokenize(expr: string): Token[] {
  const src = expr.replace(/\$/g, "");
  const tokens: Token[] = [];
  let i = 0;
  while (i < src.length) {
    const ch = src[i];
    if (/\s/.test(ch)) {
      i++;
      continue;
    }
    if (/[0-9]/.test(ch)) {
      let j = i;
      while (j < src.length && /[0-9.]/.test(src[j])) j++;
      tokens.push({ kind: "num", value: Number(src.slice(i, j)) });
      i = j;
      continue;
    }
    if (/[a-zA-Z_]/.test(ch)) {
      let j = i;
      while (j < src.length && /[a-zA-Z0-9_]/.test(src[j])) j++;
      tokens.push({ kind: "ident", value: src.slice(i, j) });
      i = j;
      continue;
    }
    const two = src.slice(i, i + 2);
    if (["<=", ">=", "==", "!=", "&&", "||"].includes(two)) {
      tokens.push({ kind: "op", value: two });
      i += 2;
      continue;
    }
    if (OPERATORS.includes(ch)) {
      tokens.push({ kind: "op", value: ch });
      i++;
      continue;
    }
    throw new Error(`effectEngine: unexpected character '${ch}' in expression: ${expr}`);
  }
  tokens.push({ kind: "eof" });
  return tokens;
}

class Parser {
  private pos = 0;
  constructor(
    private tokens: Token[],
    private scope: Scope
  ) {}

  private peek(): Token {
    return this.tokens[this.pos];
  }
  private next(): Token {
    return this.tokens[this.pos++];
  }
  /** The current token's operator string, or null if it isn't an "op" token. */
  private peekOp(): string | null {
    const t = this.peek();
    return t.kind === "op" ? t.value : null;
  }
  /** Consumes and returns the current op token's value; throws if it isn't one. */
  private takeOp(): string {
    const t = this.next();
    if (t.kind !== "op") throw new Error("effectEngine: expected an operator");
    return t.value;
  }
  private expectOp(op: string) {
    const value = this.takeOp();
    if (value !== op) throw new Error(`effectEngine: expected '${op}'`);
  }

  parse(): ExprValue {
    const v = this.parseOr();
    if (this.peek().kind !== "eof") {
      throw new Error("effectEngine: unexpected trailing tokens");
    }
    return v;
  }

  private parseOr(): ExprValue {
    let left = this.parseAnd();
    while (this.peekOp() === "||") {
      this.next();
      const right = this.parseAnd();
      left = Boolean(left) || Boolean(right);
    }
    return left;
  }

  private parseAnd(): ExprValue {
    let left = this.parseEquality();
    while (this.peekOp() === "&&") {
      this.next();
      const right = this.parseEquality();
      left = Boolean(left) && Boolean(right);
    }
    return left;
  }

  private parseEquality(): ExprValue {
    let left = this.parseRelational();
    while (this.peekOp() === "==" || this.peekOp() === "!=") {
      const op = this.takeOp();
      const right = this.parseRelational();
      left = op === "==" ? left === right : left !== right;
    }
    return left;
  }

  private parseRelational(): ExprValue {
    let left = this.parseAdditive();
    while (["<", "<=", ">", ">="].includes(this.peekOp() ?? "")) {
      const op = this.takeOp();
      const right = this.parseAdditive();
      const l = Number(left);
      const r = Number(right);
      left = op === "<" ? l < r : op === "<=" ? l <= r : op === ">" ? l > r : l >= r;
    }
    return left;
  }

  private parseAdditive(): ExprValue {
    let left = this.parseMultiplicative();
    while (this.peekOp() === "+" || this.peekOp() === "-") {
      const op = this.takeOp();
      const right = this.parseMultiplicative();
      left = op === "+" ? Number(left) + Number(right) : Number(left) - Number(right);
    }
    return left;
  }

  private parseMultiplicative(): ExprValue {
    let left = this.parseUnary();
    while (this.peekOp() === "*" || this.peekOp() === "/") {
      const op = this.takeOp();
      const right = this.parseUnary();
      left = op === "*" ? Number(left) * Number(right) : Number(left) / Number(right);
    }
    return left;
  }

  private parseUnary(): ExprValue {
    if (this.peekOp() === "!") {
      this.next();
      return !this.parseUnary();
    }
    if (this.peekOp() === "-") {
      this.next();
      return -Number(this.parseUnary());
    }
    return this.parsePostfix();
  }

  private parsePostfix(): ExprValue {
    let value = this.parsePrimary();
    for (;;) {
      if (this.peekOp() === "[") {
        this.next();
        const index = this.parseOr();
        this.expectOp("]");
        if (!Array.isArray(value)) throw new Error("effectEngine: indexing a non-array value");
        value = value[Number(index)] ?? null;
        continue;
      }
      if (this.peekOp() === ".") {
        this.next();
        const prop = this.next();
        if (prop.kind !== "ident") throw new Error("effectEngine: expected property name after '.'");
        if (prop.value === "length") {
          if (!Array.isArray(value)) throw new Error("effectEngine: .length on a non-array value");
          value = value.length;
          continue;
        }
        throw new Error(`effectEngine: unsupported property '.${prop.value}'`);
      }
      break;
    }
    return value;
  }

  private parsePrimary(): ExprValue {
    const t = this.next();
    if (t.kind === "num") return t.value;
    if (t.kind === "ident") {
      if (t.value === "null") return null;
      if (t.value === "true") return true;
      if (t.value === "false") return false;
      if (!(t.value in this.scope)) {
        throw new Error(`effectEngine: unknown identifier '${t.value}'`);
      }
      return this.scope[t.value] as ExprValue;
    }
    if (t.kind === "op" && t.value === "(") {
      const v = this.parseOr();
      this.expectOp(")");
      return v;
    }
    throw new Error("effectEngine: unexpected token in expression");
  }
}

/** Evaluate a schema expression (e.g. "$currentIndex < numbers.length - 1") against a state scope. */
export function evaluateExpr(expr: string, scope: Scope): ExprValue {
  return new Parser(tokenize(expr), scope).parse();
}

/**
 * Apply a `{ set: { field: expr, ... } }` effect, returning a new state
 * object. Operates on a plain Scope — callers with a concrete state type
 * (e.g. AlgorithmExecutionState) cast in/out at the call site, since a typed
 * interface has no index signature TypeScript can check against.
 */
export function applySet(state: Scope, setMap: Record<string, string>): Scope {
  const next = { ...state };
  for (const [field, expr] of Object.entries(setMap)) {
    next[field] = evaluateExpr(expr, state);
  }
  return next;
}

/**
 * Apply a `{ conditionalSet: { if: expr, then: { field: expr } } }` effect.
 * Returns the (possibly unchanged) next state plus whether the condition held,
 * so callers can render logTemplate's {{condResult}}.
 */
export function applyConditionalSet(
  state: Scope,
  conditionalSet: { if: string; then: Record<string, string> }
): { state: Scope; condResult: boolean } {
  const condResult = Boolean(evaluateExpr(conditionalSet.if, state));
  if (!condResult) return { state, condResult };
  return { state: applySet(state, conditionalSet.then), condResult };
}

/** Render a `{{field}}` log template against a context object (state + extra computed fields). */
export function renderTemplate(template: string, context: Scope): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_, key: string) => {
    const value = context[key];
    return value === null || value === undefined ? "" : String(value);
  });
}
