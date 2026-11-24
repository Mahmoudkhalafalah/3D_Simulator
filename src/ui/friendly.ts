// Turns scary compiler messages into friendly explanations for kids.

export interface Diagnostic {
  line: number;
  column: number;
  severity: 'error' | 'warning';
  message: string;
}

export interface FriendlyDiagnostic extends Diagnostic {
  /** Which Arduino the code belongs to (two-Arduino missions) */
  board?: number;
  friendly: string;
}

const KNOWN_WORDS = [
  'pinMode', 'digitalWrite', 'digitalRead', 'analogRead', 'analogWrite', 'delay', 'delayMicroseconds',
  'millis', 'micros', 'tone', 'noTone', 'pulseIn', 'map', 'constrain', 'random', 'Serial', 'println', 'print',
  'begin', 'HIGH', 'LOW', 'INPUT', 'OUTPUT', 'INPUT_PULLUP', 'Servo', 'attach', 'write', 'setup', 'loop',
  'int', 'long', 'float', 'bool', 'boolean', 'void', 'const', 'true', 'false', 'if', 'else', 'while', 'for',
];

function distance(a: string, b: string): number {
  const dp = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)]);
  for (let j = 1; j <= b.length; j++) dp[0][j] = j;
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      dp[i][j] = Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    }
  }
  return dp[a.length][b.length];
}

function suggest(word: string): string | null {
  const exactCase = KNOWN_WORDS.find((k) => k.toLowerCase() === word.toLowerCase());
  if (exactCase) return exactCase;
  let best: string | null = null;
  let bestD = 3;
  for (const k of KNOWN_WORDS) {
    const d = distance(word, k);
    if (d < bestD) {
      bestD = d;
      best = k;
    }
  }
  return best;
}

export function explain(d: Diagnostic): string {
  const m = d.message;
  let match: RegExpMatchArray | null;

  if (m === 'PATH_TOO_LONG') {
    return 'The Circuit World folder is buried too deep inside other folders, so the compiler cannot find its files. Move the folder somewhere short, like C:\\CircuitWorld, and start it again.';
  }
  if (m === 'TOOLCHAIN_MISSING') {
    return 'The Arduino compiler is not installed yet. Close Circuit World, run "npm run setup" (or start.bat) once, then try again.';
  }
  if ((match = m.match(/expected '([;,)}\]])' before/)) || (match = m.match(/expected '([;,)}\]])' at end of input/))) {
    const ch = match[1];
    const names: Record<string, string> = { ';': 'semicolon ;', ',': 'comma ,', ')': 'closing bracket )', '}': 'closing curly bracket }', ']': 'closing square bracket ]' };
    const where = ch === ';' ? ` Look at the end of line ${d.line - 1 > 0 ? d.line - 1 : d.line} or line ${d.line}.` : '';
    return `A ${names[ch]} is missing.${where}${ch === ';' ? ' Every instruction ends with a ;' : ''}`;
  }
  if ((match = m.match(/'(\w+)' was not declared in this scope/))) {
    const word = match[1];
    const s = suggest(word);
    if (s && s !== word) return `I don't know what "${word}" means. Did you mean "${s}"? Capital letters matter!`;
    return `I don't know what "${word}" is. Check the spelling, or create it first (for example: int ${word} = 0;).`;
  }
  if ((match = m.match(/'(\w+)' does not name a type/))) {
    const s = suggest(match[1]);
    return `"${match[1]}" is not something I recognise here.${s && s !== match[1] ? ` Did you mean "${s}"?` : ''} Code outside setup() and loop() can only create variables or functions.`;
  }
  if (/expected '}' at end of input/.test(m) || /expected declaration before '}'/.test(m)) {
    return 'Your curly brackets { } don\'t match. Every { needs a } to close it.';
  }
  if (/expected unqualified-id before/.test(m)) {
    return 'Something is in the wrong place. Check for an extra } or code outside of setup() / loop().';
  }
  if (/expected primary-expression before/.test(m)) {
    return 'Something is missing in this line, like a number or a name. Check the brackets and symbols.';
  }
  if (/undefined reference to setup/.test(m)) return 'Every Arduino program needs a void setup() { } part.';
  if (/undefined reference to loop/.test(m)) return 'Every Arduino program needs a void loop() { } part.';
  if ((match = m.match(/redefinition of '(.+?)'/))) return `"${match[1]}" is created twice. Give each thing a different name or remove one.`;
  if (/stray '\\(\d+)' in program/.test(m) || /stray '.*' in program/.test(m)) {
    return 'There is a strange character here. Did you paste text with fancy quotes “ ” or a special symbol? Type it again with normal keys.';
  }
  if (/No such file or directory/.test(m)) return 'That library is not installed. Check the spelling in #include.';
  if (/too few arguments to function/.test(m)) return 'This function needs more information inside its ( ). Check how many values it needs.';
  if (/too many arguments to function/.test(m)) return 'You gave this function too many values inside its ( ).';
  if (/missing terminating " character/.test(m)) return 'A text in quotes " " is missing its closing quote ".';
  if (/lvalue required/.test(m)) return 'You can only store a value in a variable. Did you mean == (compare) instead of = (store)?';
  if (/suggest parentheses around assignment/.test(m)) return 'Did you mean == to compare? A single = changes the value instead.';
  if (/invalid conversion/.test(m)) return 'This value is the wrong kind (type) for where it is used.';
  return m;
}

export function friendly(diags: Diagnostic[]): FriendlyDiagnostic[] {
  const seen = new Set<string>();
  return diags
    .filter((d) => {
      const k = `${d.line}:${d.message}`;
      if (seen.has(k)) return false;
      seen.add(k);
      return true;
    })
    .map((d) => ({ ...d, friendly: explain(d) }));
}
