// Block coding: Arduino blocks and a generator that turns them into real Arduino C++.
// Like Tinkercad's blocks, it adds pinMode(), #include lines and Serial.begin() by itself,
// so young kids can focus on what the program does.
import * as Blockly from 'blockly';

type Block = Blockly.Block;

const DIGITAL = [...Array.from({ length: 12 }, (_, i) => `${i + 2}`), 'A0', 'A1', 'A2', 'A3', 'A4', 'A5'].map((p) => [p, p]);
const PWM = ['3', '5', '6', '9', '10', '11'].map((p) => [`~${p}`, p]);
const ANALOG = ['A0', 'A1', 'A2', 'A3', 'A4', 'A5'].map((p) => [p, p]);

const C = {
  program: '#f59e0b',
  pins: '#2563eb',
  time: '#7c3aed',
  sound: '#db2777',
  motion: '#0d9488',
  serial: '#475569',
  sensors: '#059669',
  screen: '#0284c7',
  math: '#4f46e5',
};

const pin = (name = 'PIN', options = DIGITAL) => ({ type: 'field_dropdown', name, options });
const value = (name: string, check?: string) => ({ type: 'input_value', name, ...(check ? { check } : {}) });

let registered = false;
export function registerBlocks(): void {
  if (registered) return;
  registered = true;
  Blockly.common.defineBlocksWithJsonArray([
    {
      type: 'arduino_program',
      message0: '🚀 when the Arduino starts %1 %2',
      args0: [{ type: 'input_dummy' }, { type: 'input_statement', name: 'SETUP' }],
      message1: '🔁 repeat forever %1 %2',
      args1: [{ type: 'input_dummy' }, { type: 'input_statement', name: 'LOOP' }],
      colour: C.program,
      tooltip: 'Your program: what happens once at the start, and what repeats forever after that.',
    },
    {
      type: 'pin_write',
      message0: 'set pin %1 to %2',
      args0: [
        pin(),
        { type: 'field_dropdown', name: 'STATE', options: [['HIGH (on)', 'HIGH'], ['LOW (off)', 'LOW']] },
      ],
      previousStatement: null,
      nextStatement: null,
      colour: C.pins,
      tooltip: 'digitalWrite: switch a pin on (HIGH, 5 volts) or off (LOW, 0 volts).',
    },
    {
      type: 'pin_is',
      message0: 'pin %1 is %2',
      args0: [pin(), { type: 'field_dropdown', name: 'STATE', options: [['HIGH', 'HIGH'], ['LOW', 'LOW']] }],
      output: 'Boolean',
      colour: C.pins,
      tooltip: 'digitalRead: is this pin getting 5 volts (HIGH) or 0 volts (LOW)?',
    },
    {
      type: 'pin_pullup',
      message0: 'use the pull-up on pin %1',
      args0: [pin()],
      previousStatement: null,
      nextStatement: null,
      colour: C.pins,
      tooltip: 'INPUT_PULLUP: the pin reads HIGH unless something connects it to GND (like a joystick button).',
    },
    {
      type: 'analog_read',
      message0: 'analog pin %1',
      args0: [pin('PIN', ANALOG)],
      output: 'Number',
      colour: C.pins,
      tooltip: 'analogRead: a number from 0 (0 volts) to 1023 (5 volts).',
    },
    {
      type: 'analog_write',
      message0: 'set PWM pin %1 to %2',
      args0: [pin('PIN', PWM), value('VALUE', 'Number')],
      inputsInline: true,
      previousStatement: null,
      nextStatement: null,
      colour: C.pins,
      tooltip: 'analogWrite: 0 is off, 255 is fully on, anything in between is dimmer or slower.',
    },
    {
      type: 'wait_ms',
      message0: 'wait %1 milliseconds',
      args0: [value('MS', 'Number')],
      inputsInline: true,
      previousStatement: null,
      nextStatement: null,
      colour: C.time,
      tooltip: 'delay: 1000 milliseconds is one second.',
    },
    {
      type: 'wait_s',
      message0: 'wait %1 seconds',
      args0: [value('S', 'Number')],
      inputsInline: true,
      previousStatement: null,
      nextStatement: null,
      colour: C.time,
    },
    {
      type: 'millis',
      message0: 'milliseconds since the start',
      output: 'Number',
      colour: C.time,
      tooltip: 'millis: a clock that keeps counting while your program runs.',
    },
    {
      type: 'tone',
      message0: 'play %1 Hz on pin %2',
      args0: [value('FREQ', 'Number'), pin()],
      inputsInline: true,
      previousStatement: null,
      nextStatement: null,
      colour: C.sound,
      tooltip: 'tone: a high number is a high note. 440 Hz is the note A.',
    },
    {
      type: 'tone_for',
      message0: 'play %1 Hz on pin %2 for %3 ms',
      args0: [value('FREQ', 'Number'), pin(), value('MS', 'Number')],
      inputsInline: true,
      previousStatement: null,
      nextStatement: null,
      colour: C.sound,
    },
    {
      type: 'no_tone',
      message0: 'stop the sound on pin %1',
      args0: [pin()],
      previousStatement: null,
      nextStatement: null,
      colour: C.sound,
    },
    {
      type: 'servo_write',
      message0: 'turn the servo on pin %1 to %2 degrees',
      args0: [pin(), value('ANGLE', 'Number')],
      inputsInline: true,
      previousStatement: null,
      nextStatement: null,
      colour: C.motion,
      tooltip: 'Servo: turns to an exact angle between 0 and 180 degrees.',
    },
    {
      type: 'serial_print',
      message0: 'print %1 %2',
      args0: [value('VALUE'), { type: 'field_dropdown', name: 'NL', options: [['and start a new line', 'LN'], ['on the same line', 'SAME']] }],
      inputsInline: true,
      previousStatement: null,
      nextStatement: null,
      colour: C.serial,
      tooltip: 'Serial: show a message or a number in the Serial Monitor.',
    },
    {
      type: 'ultrasonic_cm',
      message0: 'distance in cm (TRIG pin %1, ECHO pin %2)',
      args0: [pin('TRIG'), pin('ECHO')],
      output: 'Number',
      colour: C.sensors,
      tooltip: 'HC-SR04: sends a sound ping and times the echo. 999 means nothing is in front.',
    },
    {
      type: 'dht_read',
      message0: '%1 from the DHT11 on pin %2',
      args0: [{ type: 'field_dropdown', name: 'WHAT', options: [['temperature (°C)', 'T'], ['humidity (%)', 'H']] }, pin()],
      output: 'Number',
      colour: C.sensors,
    },
    {
      type: 'lcd_print',
      message0: 'screen: write %1 at column %2 row %3',
      args0: [value('VALUE'), { type: 'field_number', name: 'COL', value: 0, min: 0, max: 15, precision: 1 }, { type: 'field_dropdown', name: 'ROW', options: [['0 (top)', '0'], ['1 (bottom)', '1']] }],
      inputsInline: true,
      previousStatement: null,
      nextStatement: null,
      colour: C.screen,
      tooltip: 'The I2C screen (address 0x27, SDA on A4, SCL on A5).',
    },
    {
      type: 'lcd_clear',
      message0: 'screen: clear',
      previousStatement: null,
      nextStatement: null,
      colour: C.screen,
    },
    {
      type: 'math_map',
      message0: 'map %1 from %2 - %3 to %4 - %5',
      args0: [value('VALUE', 'Number'), value('FROM_LOW', 'Number'), value('FROM_HIGH', 'Number'), value('TO_LOW', 'Number'), value('TO_HIGH', 'Number')],
      inputsInline: true,
      output: 'Number',
      colour: C.math,
      tooltip: 'map: turn a number from one range into another, e.g. 0-1023 into 0-255.',
    },
  ]);
}

// ------------------------------------------------------------------ toolbox
const num = (n: number) => ({ shadow: { type: 'math_number', fields: { NUM: n } } });

export const TOOLBOX = {
  kind: 'categoryToolbox',
  contents: [
    {
      kind: 'category',
      name: '🚀 Program',
      colour: C.program,
      contents: [{ kind: 'block', type: 'arduino_program' }],
    },
    {
      kind: 'category',
      name: '💡 Pins',
      colour: C.pins,
      contents: [
        { kind: 'block', type: 'pin_write' },
        { kind: 'block', type: 'pin_is' },
        { kind: 'block', type: 'analog_read' },
        { kind: 'block', type: 'analog_write', inputs: { VALUE: num(128) } },
        { kind: 'block', type: 'pin_pullup' },
      ],
    },
    {
      kind: 'category',
      name: '⏱ Time',
      colour: C.time,
      contents: [
        { kind: 'block', type: 'wait_s', inputs: { S: num(1) } },
        { kind: 'block', type: 'wait_ms', inputs: { MS: num(500) } },
        { kind: 'block', type: 'millis' },
      ],
    },
    {
      kind: 'category',
      name: '🔊 Sound',
      colour: C.sound,
      contents: [
        { kind: 'block', type: 'tone', inputs: { FREQ: num(440) } },
        { kind: 'block', type: 'tone_for', inputs: { FREQ: num(1000), MS: num(200) } },
        { kind: 'block', type: 'no_tone' },
      ],
    },
    {
      kind: 'category',
      name: '🦾 Servo',
      colour: C.motion,
      contents: [{ kind: 'block', type: 'servo_write', inputs: { ANGLE: num(90) } }],
    },
    {
      kind: 'category',
      name: '📏 Sensors',
      colour: C.sensors,
      contents: [{ kind: 'block', type: 'ultrasonic_cm' }, { kind: 'block', type: 'dht_read' }],
    },
    {
      kind: 'category',
      name: '📟 Screen',
      colour: C.screen,
      contents: [
        { kind: 'block', type: 'lcd_print', inputs: { VALUE: { shadow: { type: 'text', fields: { TEXT: 'Hello!' } } } } },
        { kind: 'block', type: 'lcd_clear' },
      ],
    },
    {
      kind: 'category',
      name: '💬 Serial',
      colour: C.serial,
      contents: [
        { kind: 'block', type: 'serial_print', inputs: { VALUE: { shadow: { type: 'text', fields: { TEXT: 'Hello!' } } } } },
        { kind: 'block', type: 'text' },
      ],
    },
    { kind: 'sep' },
    {
      kind: 'category',
      name: '❓ Logic',
      categorystyle: 'logic_category',
      contents: [
        { kind: 'block', type: 'controls_if' },
        { kind: 'block', type: 'controls_if', extraState: { hasElse: true } },
        { kind: 'block', type: 'logic_compare' },
        { kind: 'block', type: 'logic_operation' },
        { kind: 'block', type: 'logic_negate' },
        { kind: 'block', type: 'logic_boolean' },
      ],
    },
    {
      kind: 'category',
      name: '🔁 Loops',
      categorystyle: 'loop_category',
      contents: [
        { kind: 'block', type: 'controls_repeat_ext', inputs: { TIMES: num(10) } },
        { kind: 'block', type: 'controls_whileUntil' },
        { kind: 'block', type: 'controls_for', inputs: { FROM: num(1), TO: num(10), BY: num(1) } },
        { kind: 'block', type: 'controls_flow_statements' },
      ],
    },
    {
      kind: 'category',
      name: '🔢 Math',
      categorystyle: 'math_category',
      contents: [
        { kind: 'block', type: 'math_number' },
        { kind: 'block', type: 'math_arithmetic', inputs: { A: num(1), B: num(1) } },
        { kind: 'block', type: 'math_map', inputs: { FROM_LOW: num(0), FROM_HIGH: num(1023), TO_LOW: num(0), TO_HIGH: num(255) } },
        { kind: 'block', type: 'math_constrain', inputs: { LOW: num(0), HIGH: num(255) } },
        { kind: 'block', type: 'math_random_int', inputs: { FROM: num(1), TO: num(6) } },
        { kind: 'block', type: 'math_modulo', inputs: { DIVIDEND: num(10), DIVISOR: num(3) } },
      ],
    },
    { kind: 'category', name: '📦 Variables', categorystyle: 'variable_category', custom: 'VARIABLE' },
    { kind: 'category', name: '🧩 Functions', categorystyle: 'procedure_category', custom: 'PROCEDURE' },
  ],
};

/** A new, empty program. */
export const EMPTY_PROGRAM = {
  blocks: { languageVersion: 0, blocks: [{ type: 'arduino_program', x: 30, y: 30 }] },
};

// ------------------------------------------------------------------ the C++ generator
const O = {
  ATOMIC: 0,
  CALL: 1,
  UNARY: 2,
  MULTIPLICATIVE: 3,
  ADDITIVE: 4,
  RELATIONAL: 6,
  EQUALITY: 7,
  AND: 11,
  OR: 12,
  CONDITIONAL: 13,
  ASSIGNMENT: 14,
  NONE: 99,
};

const RESERVED =
  'setup,loop,if,else,for,while,do,break,continue,return,switch,case,default,int,long,float,double,char,bool,byte,void,const,unsigned,static,true,false,HIGH,LOW,INPUT,OUTPUT,INPUT_PULLUP,delay,millis,digitalWrite,digitalRead,analogRead,analogWrite,pinMode,tone,noTone,map,constrain,random,Serial,String,lcd,new,delete,class,struct,public,private,this,auto,goto,sizeof,volatile';

interface Ctx {
  includes: Set<string>;
  globals: Map<string, string>;
  setup: Map<string, string>;
  pinModes: Map<string, string>;
  helpers: Map<string, string>;
  functions: Map<string, string>;
}

class ArduinoGenerator extends Blockly.CodeGenerator {
  ctx: Ctx = newCtx();
  constructor() {
    super('Arduino');
    this.INDENT = '  ';
    this.addReservedWords(RESERVED);
  }
  init(ws: Blockly.Workspace): void {
    super.init(ws);
    this.ctx = newCtx();
    this.nameDB_ = new Blockly.Names(RESERVED);
    this.nameDB_.setVariableMap(ws.getVariableMap());
    this.nameDB_.populateVariables(ws);
    this.nameDB_.populateProcedures(ws);
    this.isInitialized = true;
  }
  scrub_(block: Block, code: string, thisOnly?: boolean): string {
    const next = block.nextConnection?.targetBlock();
    return thisOnly || !next ? code : code + this.blockToCode(next);
  }
  /** Set a pin's mode in setup(); an explicit pull-up always wins */
  usePin(pin: string, mode: 'OUTPUT' | 'INPUT' | 'INPUT_PULLUP'): void {
    const current = this.ctx.pinModes.get(pin);
    if (current === 'INPUT_PULLUP' || current === mode) return;
    if (current && mode === 'INPUT') return;
    this.ctx.pinModes.set(pin, mode);
  }
  serial(): void {
    this.ctx.setup.set('serial', 'Serial.begin(9600);');
  }
}

function newCtx(): Ctx {
  return { includes: new Set(), globals: new Map(), setup: new Map(), pinModes: new Map(), helpers: new Map(), functions: new Map() };
}

export const arduino = new ArduinoGenerator();
type G = ArduinoGenerator;
const f = arduino.forBlock as Record<string, (b: Block, g: G) => string | [string, number] | null>;

f.arduino_program = () => null;

f.pin_write = (b, g) => {
  const p = b.getFieldValue('PIN');
  g.usePin(p, 'OUTPUT');
  return `digitalWrite(${p}, ${b.getFieldValue('STATE')});\n`;
};
f.pin_is = (b, g) => {
  const p = b.getFieldValue('PIN');
  g.usePin(p, 'INPUT');
  return [`(digitalRead(${p}) == ${b.getFieldValue('STATE')})`, O.EQUALITY];
};
f.pin_pullup = (b, g) => {
  g.ctx.pinModes.set(b.getFieldValue('PIN'), 'INPUT_PULLUP');
  return '';
};
f.analog_read = (b) => [`analogRead(${b.getFieldValue('PIN')})`, O.CALL];
f.analog_write = (b, g) => {
  const p = b.getFieldValue('PIN');
  g.usePin(p, 'OUTPUT');
  return `analogWrite(${p}, ${g.valueToCode(b, 'VALUE', O.NONE) || '0'});\n`;
};
f.wait_ms = (b, g) => `delay(${g.valueToCode(b, 'MS', O.NONE) || '0'});\n`;
f.wait_s = (b, g) => `delay(${g.valueToCode(b, 'S', O.MULTIPLICATIVE) || '0'} * 1000);\n`;
f.millis = () => ['millis()', O.CALL];
f.tone = (b, g) => {
  const p = b.getFieldValue('PIN');
  g.usePin(p, 'OUTPUT');
  return `tone(${p}, ${g.valueToCode(b, 'FREQ', O.NONE) || '440'});\n`;
};
f.tone_for = (b, g) => {
  const p = b.getFieldValue('PIN');
  g.usePin(p, 'OUTPUT');
  return `tone(${p}, ${g.valueToCode(b, 'FREQ', O.NONE) || '440'}, ${g.valueToCode(b, 'MS', O.NONE) || '100'});\n`;
};
f.no_tone = (b) => `noTone(${b.getFieldValue('PIN')});\n`;
f.servo_write = (b, g) => {
  const p = b.getFieldValue('PIN');
  const name = `servo_${p}`;
  g.ctx.includes.add('Servo.h');
  g.ctx.globals.set(name, `Servo ${name};`);
  g.ctx.setup.set(name, `${name}.attach(${p});`);
  return `${name}.write(${g.valueToCode(b, 'ANGLE', O.NONE) || '90'});\n`;
};
f.serial_print = (b, g) => {
  g.serial();
  const v = g.valueToCode(b, 'VALUE', O.NONE) || '""';
  return `Serial.${b.getFieldValue('NL') === 'LN' ? 'println' : 'print'}(${v});\n`;
};
f.ultrasonic_cm = (b, g) => {
  const trig = b.getFieldValue('TRIG');
  const echo = b.getFieldValue('ECHO');
  g.usePin(trig, 'OUTPUT');
  g.usePin(echo, 'INPUT');
  g.ctx.helpers.set(
    'distance',
    `// Measures the distance with an HC-SR04 sensor (999 = nothing in front)
long distanceCm(int trig, int echo) {
  digitalWrite(trig, LOW);
  delayMicroseconds(2);
  digitalWrite(trig, HIGH);
  delayMicroseconds(10);
  digitalWrite(trig, LOW);
  long us = pulseIn(echo, HIGH, 30000);
  if (us == 0) return 999;
  return us / 58;
}`,
  );
  return [`distanceCm(${trig}, ${echo})`, O.CALL];
};
f.dht_read = (b, g) => {
  const p = b.getFieldValue('PIN');
  const name = `dht_${p}`;
  g.ctx.includes.add('DHT.h');
  g.ctx.globals.set(name, `DHT ${name}(${p}, DHT11);`);
  g.ctx.setup.set(name, `${name}.begin();`);
  return [`${name}.${b.getFieldValue('WHAT') === 'T' ? 'readTemperature' : 'readHumidity'}()`, O.CALL];
};
function useLcd(g: G) {
  g.ctx.includes.add('Wire.h');
  g.ctx.includes.add('LiquidCrystal_I2C.h');
  g.ctx.globals.set('lcd', 'LiquidCrystal_I2C lcd(0x27, 16, 2);');
  g.ctx.setup.set('lcd', 'lcd.init();\n  lcd.backlight();');
}
f.lcd_print = (b, g) => {
  useLcd(g);
  return `lcd.setCursor(${b.getFieldValue('COL')}, ${b.getFieldValue('ROW')});\nlcd.print(${g.valueToCode(b, 'VALUE', O.NONE) || '""'});\n`;
};
f.lcd_clear = (_b, g) => {
  useLcd(g);
  return 'lcd.clear();\n';
};
f.math_map = (b, g) => {
  const v = (n: string, d: string) => g.valueToCode(b, n, O.NONE) || d;
  return [`map(${v('VALUE', '0')}, ${v('FROM_LOW', '0')}, ${v('FROM_HIGH', '1023')}, ${v('TO_LOW', '0')}, ${v('TO_HIGH', '255')})`, O.CALL];
};

// ---- standard Blockly blocks, in C++
f.controls_if = (b, g) => {
  let n = 0;
  let code = '';
  do {
    const cond = g.valueToCode(b, `IF${n}`, O.NONE) || 'false';
    code += `${n > 0 ? ' else ' : ''}if (${cond}) {\n${g.statementToCode(b, `DO${n}`)}}`;
    n++;
  } while (b.getInput(`IF${n}`));
  if (b.getInput('ELSE')) code += ` else {\n${g.statementToCode(b, 'ELSE')}}`;
  return code + '\n';
};
const COMPARE: Record<string, string> = { EQ: '==', NEQ: '!=', LT: '<', LTE: '<=', GT: '>', GTE: '>=' };
f.logic_compare = (b, g) => {
  const op = COMPARE[b.getFieldValue('OP')];
  const order = op === '==' || op === '!=' ? O.EQUALITY : O.RELATIONAL;
  return [`${g.valueToCode(b, 'A', order) || '0'} ${op} ${g.valueToCode(b, 'B', order) || '0'}`, order];
};
f.logic_operation = (b, g) => {
  const and = b.getFieldValue('OP') === 'AND';
  const order = and ? O.AND : O.OR;
  return [`${g.valueToCode(b, 'A', order) || 'false'} ${and ? '&&' : '||'} ${g.valueToCode(b, 'B', order) || 'false'}`, order];
};
f.logic_negate = (b, g) => [`!${g.valueToCode(b, 'BOOL', O.UNARY) || 'true'}`, O.UNARY];
f.logic_boolean = (b) => [b.getFieldValue('BOOL') === 'TRUE' ? 'true' : 'false', O.ATOMIC];
f.controls_repeat_ext = (b, g) => {
  const times = g.valueToCode(b, 'TIMES', O.ASSIGNMENT) || '0';
  const i = g.nameDB_!.getDistinctName('count', 'VARIABLE');
  return `for (int ${i} = 0; ${i} < ${times}; ${i}++) {\n${g.statementToCode(b, 'DO')}}\n`;
};
f.controls_whileUntil = (b, g) => {
  let cond = g.valueToCode(b, 'BOOL', b.getFieldValue('MODE') === 'UNTIL' ? O.UNARY : O.NONE) || 'false';
  if (b.getFieldValue('MODE') === 'UNTIL') cond = `!${cond}`;
  return `while (${cond}) {\n${g.statementToCode(b, 'DO')}}\n`;
};
f.controls_for = (b, g) => {
  const v = g.getVariableName(b.getFieldValue('VAR'));
  const from = g.valueToCode(b, 'FROM', O.ASSIGNMENT) || '0';
  const to = g.valueToCode(b, 'TO', O.ASSIGNMENT) || '0';
  const by = g.valueToCode(b, 'BY', O.ASSIGNMENT) || '1';
  const down = Number(from) > Number(to);
  const step = Math.abs(Number(by)) || 1;
  return `for (${v} = ${from}; ${v} ${down ? '>=' : '<='} ${to}; ${v} ${down ? '-' : '+'}= ${isNaN(Number(by)) ? by : step}) {\n${g.statementToCode(b, 'DO')}}\n`;
};
f.controls_flow_statements = (b) => (b.getFieldValue('FLOW') === 'BREAK' ? 'break;\n' : 'continue;\n');
f.math_number = (b) => {
  const n = Number(b.getFieldValue('NUM'));
  return [String(n), n < 0 ? O.UNARY : O.ATOMIC];
};
const ARITH: Record<string, [string, number]> = {
  ADD: [' + ', O.ADDITIVE],
  MINUS: [' - ', O.ADDITIVE],
  MULTIPLY: [' * ', O.MULTIPLICATIVE],
  DIVIDE: [' / ', O.MULTIPLICATIVE],
};
f.math_arithmetic = (b, g) => {
  const op = b.getFieldValue('OP');
  if (op === 'POWER') return [`pow(${g.valueToCode(b, 'A', O.NONE) || '0'}, ${g.valueToCode(b, 'B', O.NONE) || '0'})`, O.CALL];
  const [sym, order] = ARITH[op];
  return [`${g.valueToCode(b, 'A', order) || '0'}${sym}${g.valueToCode(b, 'B', order - 0.5) || '0'}`, order];
};
f.math_modulo = (b, g) => [`${g.valueToCode(b, 'DIVIDEND', O.MULTIPLICATIVE) || '0'} % ${g.valueToCode(b, 'DIVISOR', O.MULTIPLICATIVE) || '1'}`, O.MULTIPLICATIVE];
f.math_constrain = (b, g) => [`constrain(${g.valueToCode(b, 'VALUE', O.NONE) || '0'}, ${g.valueToCode(b, 'LOW', O.NONE) || '0'}, ${g.valueToCode(b, 'HIGH', O.NONE) || '0'})`, O.CALL];
f.math_random_int = (b, g) => [`random(${g.valueToCode(b, 'FROM', O.NONE) || '0'}, ${g.valueToCode(b, 'TO', O.ADDITIVE) || '0'} + 1)`, O.CALL];
f.text = (b) => [`"${String(b.getFieldValue('TEXT')).replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`, O.ATOMIC];
f.variables_get = (b, g) => [g.getVariableName(b.getFieldValue('VAR')), O.ATOMIC];
f.variables_set = (b, g) => `${g.getVariableName(b.getFieldValue('VAR'))} = ${g.valueToCode(b, 'VALUE', O.ASSIGNMENT) || '0'};\n`;
f.math_change = (b, g) => `${g.getVariableName(b.getFieldValue('VAR'))} += ${g.valueToCode(b, 'DELTA', O.ADDITIVE) || '1'};\n`;

function procedure(b: Block, g: G, returns: boolean) {
  const name = g.getProcedureName(b.getFieldValue('NAME'));
  const vars = (b as unknown as { getVars(): string[] }).getVars?.() ?? [];
  const args = vars.map((v) => `long ${g.getVariableName(v)}`).join(', ');
  const body = g.statementToCode(b, 'STACK');
  const ret = returns ? g.valueToCode(b, 'RETURN', O.NONE) : '';
  const code = `${returns ? 'long' : 'void'} ${name}(${args}) {\n${body}${ret ? `  return ${ret};\n` : ''}}`;
  g.ctx.functions.set(name, code);
  return null;
}
f.procedures_defnoreturn = (b, g) => procedure(b, g, false);
f.procedures_defreturn = (b, g) => procedure(b, g, true);
function call(b: Block, g: G) {
  const name = g.getProcedureName(b.getFieldValue('NAME'));
  const vars = (b as unknown as { getVars(): string[] }).getVars?.() ?? [];
  const args = vars.map((_, i) => g.valueToCode(b, `ARG${i}`, O.NONE) || '0').join(', ');
  return `${name}(${args})`;
}
f.procedures_callnoreturn = (b, g) => `${call(b, g)};\n`;
f.procedures_callreturn = (b, g) => [call(b, g), O.CALL];
f.procedures_ifreturn = (b, g) => {
  const cond = g.valueToCode(b, 'CONDITION', O.NONE) || 'false';
  const hasValue = (b as unknown as { hasReturnValue_?: boolean }).hasReturnValue_;
  return `if (${cond}) {\n  return${hasValue ? ` ${g.valueToCode(b, 'VALUE', O.NONE) || '0'}` : ''};\n}\n`;
};

/** Variables holding decimals (temperatures, divisions...) become float, the rest long. */
function variableType(ws: Blockly.Workspace, id: string): string {
  const decimal = (b: Block | null): boolean => {
    if (!b) return false;
    if (b.type === 'dht_read') return true;
    if (b.type === 'math_number') return !Number.isInteger(Number(b.getFieldValue('NUM')));
    if (b.type === 'math_arithmetic' && b.getFieldValue('OP') === 'DIVIDE') return true;
    return b.getChildren(false).some(decimal);
  };
  for (const b of ws.getAllBlocks(false)) {
    if ((b.type === 'variables_set' || b.type === 'math_change') && b.getFieldValue('VAR') === id) {
      if (decimal(b.getInputTargetBlock(b.type === 'variables_set' ? 'VALUE' : 'DELTA'))) return 'float';
    }
  }
  return 'long';
}

/** Turn a block workspace into a complete Arduino sketch. */
export function generateArduino(ws: Blockly.Workspace): string {
  registerBlocks();
  const g = arduino;
  g.init(ws);
  const tops = ws.getTopBlocks(true);
  for (const b of tops) if (b.type.startsWith('procedures_def')) g.blockToCode(b);
  const program = tops.find((b) => b.type === 'arduino_program');
  const setupBody = program ? g.statementToCode(program, 'SETUP') : '';
  const loopBody = program ? g.statementToCode(program, 'LOOP') : '';
  const { ctx } = g;

  const vars = ws
    .getVariableMap()
    .getAllVariables()
    .filter((v) => !ws.getAllBlocks(false).some((b) => b.type.startsWith('procedures_def') && ((b as unknown as { getVars(): string[] }).getVars?.() ?? []).includes(v.getName())))
    .map((v) => `${variableType(ws, v.getId())} ${g.getVariableName(v.getId())} = 0;`);

  const autoSetup = [...ctx.setup.values(), ...[...ctx.pinModes].map(([p, m]) => `pinMode(${p}, ${m});`)];
  const parts: string[] = ['// Made with blocks in Circuit World'];
  if (ctx.includes.size) parts.push([...ctx.includes].map((i) => `#include <${i}>`).join('\n'));
  const globals = [...ctx.globals.values(), ...vars];
  if (globals.length) parts.push(globals.join('\n'));
  for (const h of ctx.helpers.values()) parts.push(h);
  for (const fn of ctx.functions.values()) parts.push(fn);
  parts.push(`void setup() {\n${autoSetup.map((l) => `  ${l}\n`).join('')}${setupBody}}`);
  parts.push(`void loop() {\n${loopBody}}`);
  return parts.join('\n\n') + '\n';
}

/** Generate code from a saved workspace (used by the tests and when switching boards). */
export function generateFromJson(json: object): string {
  registerBlocks();
  const ws = new Blockly.Workspace();
  try {
    Blockly.serialization.workspaces.load(json, ws);
    return generateArduino(ws);
  } finally {
    ws.dispose();
  }
}
