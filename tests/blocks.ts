// Block programs used by the tests: a blink program and one that uses every block category.

const n = (NUM: number) => ({ block: { type: 'math_number', fields: { NUM } } });
const t = (TEXT: string) => ({ block: { type: 'text', fields: { TEXT } } });
/** Chain statement blocks: each one's "next" is the following block. */
function chain(...blocks: Record<string, unknown>[]): { block: Record<string, unknown> } {
  const [first, ...rest] = blocks;
  return { block: rest.length ? { ...first, next: chain(...rest) } : first };
}
const program = (setup: { block: unknown } | undefined, loop: { block: unknown }, extra: unknown[] = [], variables: unknown[] = []) => ({
  blocks: { languageVersion: 0, blocks: [{ type: 'arduino_program', x: 0, y: 0, inputs: { ...(setup ? { SETUP: setup } : {}), LOOP: loop } }, ...extra] },
  ...(variables.length ? { variables } : {}),
});

export const BLINK_BLOCKS = program(
  undefined,
  chain(
    { type: 'pin_write', fields: { PIN: '13', STATE: 'HIGH' } },
    { type: 'wait_s', inputs: { S: n(1) } },
    { type: 'pin_write', fields: { PIN: '13', STATE: 'LOW' } },
    { type: 'wait_s', inputs: { S: n(1) } },
  ),
);

/** Uses every category: pins, time, sound, servo, sensors, screen, serial, logic, loops, math, variables, functions. */
export const EVERYTHING_BLOCKS = program(
  chain(
    { type: 'pin_pullup', fields: { PIN: '2' } },
    { type: 'variables_set', fields: { VAR: { id: 'v1' } }, inputs: { VALUE: n(0) } },
    { type: 'lcd_print', fields: { COL: 0, ROW: '0' }, inputs: { VALUE: t('Hello "lab"!') } },
  ),
  chain(
    { type: 'variables_set', fields: { VAR: { id: 'v2' } }, inputs: { VALUE: { block: { type: 'dht_read', fields: { WHAT: 'T', PIN: '7' } } } } },
    {
      type: 'controls_if',
      extraState: { hasElse: true },
      inputs: {
        IF0: {
          block: {
            type: 'logic_operation',
            fields: { OP: 'AND' },
            inputs: {
              A: { block: { type: 'pin_is', fields: { PIN: '2', STATE: 'LOW' } } },
              B: { block: { type: 'logic_compare', fields: { OP: 'LT' }, inputs: { A: { block: { type: 'ultrasonic_cm', fields: { TRIG: '6', ECHO: '5' } } }, B: n(30) } } },
            },
          },
        },
        DO0: chain({ type: 'tone_for', fields: { PIN: '8' }, inputs: { FREQ: n(1000), MS: n(100) } }, { type: 'procedures_callnoreturn', extraState: { name: 'wave' } }),
        ELSE: chain({ type: 'no_tone', fields: { PIN: '8' } }),
      },
    },
    {
      type: 'analog_write',
      fields: { PIN: '9' },
      inputs: { VALUE: { block: { type: 'math_map', inputs: { VALUE: { block: { type: 'analog_read', fields: { PIN: 'A0' } } }, FROM_LOW: n(0), FROM_HIGH: n(1023), TO_LOW: n(0), TO_HIGH: n(255) } } } },
    },
    { type: 'math_change', fields: { VAR: { id: 'v1' } }, inputs: { DELTA: n(1) } },
    {
      type: 'controls_repeat_ext',
      inputs: { TIMES: n(3), DO: chain({ type: 'serial_print', fields: { NL: 'SAME' }, inputs: { VALUE: { block: { type: 'variables_get', fields: { VAR: { id: 'v1' } } } } } }) },
    },
    { type: 'serial_print', fields: { NL: 'LN' }, inputs: { VALUE: { block: { type: 'math_arithmetic', fields: { OP: 'DIVIDE' }, inputs: { A: { block: { type: 'variables_get', fields: { VAR: { id: 'v2' } } } }, B: n(2) } } } } },
    { type: 'lcd_print', fields: { COL: 0, ROW: '1' }, inputs: { VALUE: { block: { type: 'variables_get', fields: { VAR: { id: 'v2' } } } } } },
    { type: 'wait_ms', inputs: { MS: { block: { type: 'math_random_int', inputs: { FROM: n(100), TO: n(200) } } } } },
  ),
  [
    {
      type: 'procedures_defnoreturn',
      x: 400,
      y: 0,
      fields: { NAME: 'wave' },
      inputs: { STACK: chain({ type: 'servo_write', fields: { PIN: '10' }, inputs: { ANGLE: n(0) } }, { type: 'wait_ms', inputs: { MS: n(300) } }, { type: 'servo_write', fields: { PIN: '10' }, inputs: { ANGLE: n(90) } }) },
    },
  ],
  [
    { name: 'count', id: 'v1' },
    { name: 'temperature', id: 'v2' },
  ],
);
