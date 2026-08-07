// Duplicate-member-rejecting raw JSON parsing for the interaction approval
// draft package. Standard JSON.parse silently keeps the last duplicate
// member, which would let a hostile document smuggle a second "decision" or
// authority field past review; this parser fails closed instead.

export function parseDraftApprovalJson(text, label = 'draft approval JSON') {
  if (typeof text !== 'string') {
    throw new TypeError(`${label}: JSON source must be a string`);
  }

  let offset = 0;

  function syntax(message) {
    throw new SyntaxError(`${label}: ${message} at offset ${offset}`);
  }

  function skipWhitespace() {
    while (offset < text.length && /[\t\n\r ]/u.test(text[offset])) offset += 1;
  }

  function parseString() {
    if (text[offset] !== '"') syntax('expected a JSON string');
    const start = offset;
    offset += 1;
    while (offset < text.length) {
      const code = text.charCodeAt(offset);
      if (text[offset] === '"') {
        offset += 1;
        return JSON.parse(text.slice(start, offset));
      }
      if (text[offset] === '\\') {
        offset += 1;
        if (offset >= text.length) syntax('unterminated escape sequence');
        const escape = text[offset];
        if (escape === 'u') {
          const digits = text.slice(offset + 1, offset + 5);
          if (!/^[0-9a-fA-F]{4}$/u.test(digits)) syntax('invalid Unicode escape');
          offset += 5;
          continue;
        }
        if (!/["\\/bfnrt]/u.test(escape)) syntax('invalid string escape');
        offset += 1;
        continue;
      }
      if (code < 0x20) syntax('unescaped control character in string');
      offset += 1;
    }
    syntax('unterminated JSON string');
  }

  function parseNumber() {
    const match = text.slice(offset).match(
      /^-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?/u,
    );
    if (match === null) syntax('invalid JSON number');
    offset += match[0].length;
    const value = Number(match[0]);
    if (!Number.isFinite(value)) syntax('non-finite JSON number');
    return value;
  }

  function parseValue() {
    skipWhitespace();
    const token = text[offset];
    if (token === '{') return parseObject();
    if (token === '[') return parseArray();
    if (token === '"') return parseString();
    if (token === '-' || /[0-9]/u.test(token ?? '')) return parseNumber();
    for (const [literal, value] of [
      ['true', true],
      ['false', false],
      ['null', null],
    ]) {
      if (text.startsWith(literal, offset)) {
        offset += literal.length;
        return value;
      }
    }
    syntax('unexpected JSON token');
  }

  function parseArray() {
    const values = [];
    offset += 1;
    skipWhitespace();
    if (text[offset] === ']') {
      offset += 1;
      return values;
    }
    while (true) {
      values.push(parseValue());
      skipWhitespace();
      if (text[offset] === ']') {
        offset += 1;
        return values;
      }
      if (text[offset] !== ',') syntax('expected comma or closing bracket');
      offset += 1;
    }
  }

  function parseObject() {
    const value = {};
    const members = new Set();
    offset += 1;
    skipWhitespace();
    if (text[offset] === '}') {
      offset += 1;
      return value;
    }
    while (true) {
      skipWhitespace();
      const key = parseString();
      if (members.has(key)) syntax(`duplicate JSON member ${JSON.stringify(key)}`);
      members.add(key);
      skipWhitespace();
      if (text[offset] !== ':') syntax('expected colon after JSON member');
      offset += 1;
      const memberValue = parseValue();
      Object.defineProperty(value, key, {
        value: memberValue,
        enumerable: true,
        configurable: true,
        writable: true,
      });
      skipWhitespace();
      if (text[offset] === '}') {
        offset += 1;
        return value;
      }
      if (text[offset] !== ',') syntax('expected comma or closing brace');
      offset += 1;
    }
  }

  skipWhitespace();
  const result = parseValue();
  skipWhitespace();
  if (offset !== text.length) syntax('unexpected trailing JSON content');
  return result;
}
