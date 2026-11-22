import type { CheckApi, Mission } from '../types';

const RAIL_POWER: [string, string][] = [
  ['uno:5V', 'rail:P0'],
  ['uno:GND1', 'rail:N0'],
];

/** The last complete line printed on the Serial Monitor. */
function lastLine(serial: string): string {
  const lines = serial.split(/\r?\n/);
  lines.pop(); // the line being printed right now may be unfinished
  for (let i = lines.length - 1; i >= 0; i--) if (lines[i].trim()) return lines[i];
  return '';
}
const numbers = (text: string) => (text.match(/-?\d+(?:\.\d+)?/g) ?? []).map(Number);
const near = (list: number[], value: number, tol: number) => list.some((n) => Math.abs(n - value) <= tol);
const lcdRow = (c: CheckApi, id: string, row: number) => c.dev(id).lines[row] ?? '';

const rgb = (c: CheckApi, id: string) => {
  const [r = 0, g = 0, b = 0] = c.dev(id).levels;
  return { r, g, b };
};
const traffic = (c: CheckApi) => {
  const [r = 0, y = 0, g = 0] = c.dev('soilLight').levels;
  return { red: r > 0.5, yellow: y > 0.5, green: g > 0.5 };
};

const SOIL_WIRES: [string, string][] = [
  ['soilSensor:VCC', 'uno:5V'],
  ['soilSensor:GND', 'uno:GND1'],
  ['soilSensor:AO', 'uno:A0'],
];
const DHT_ON_RAIL: [string, string][] = [
  ['weather:VCC', 'rail:P2'],
  ['weather:GND', 'rail:N2'],
  ['weather:DATA', 'uno:D7'],
];

const BED_VIEW = { position: [-6, 4.5, 8] as [number, number, number], target: [-3.5, 0.6, 1.8] as [number, number, number] };
const STATION_VIEW = { position: [-1.0, 2.4, 3.2] as [number, number, number], target: [-1.2, 1.45, -2.3] as [number, number, number] };
const GREENHOUSE_VIEW = { position: [6, 5.5, 8] as [number, number, number], target: [3.5, 1.2, -0.8] as [number, number, number] };

export const GARDEN_MISSIONS: Mission[] = [
  {
    id: 'thirstyPlant',
    title: 'Is My Plant Thirsty?',
    emoji: '🌱',
    course: ['L2S6'],
    story: 'The tomato plant cannot tell you when it needs water - but a soil moisture sensor can! Read it and show how wet the soil is, from 0% (dry) to 100% (wet).',
    steps: [
      'Wire the soil sensor: V → 5V, G → GND, A → A0.',
      'Run the code and open the Serial Monitor. Dry soil gives a BIG number, wet soil a smaller one.',
      'Calibrate: dry air reads about 1023 and a glass of water about 300. Use map() to turn that into 0-100%.',
      'Water the plant and watch the percentage go up!',
    ],
    devices: ['soilSensor'],
    controls: ['water', 'dry', 'temperature'],
    setup: { moisture: 0.15 },
    view: BED_VIEW,
    starterCode: `// Is my plant thirsty? Read the soil moisture sensor.

const int SOIL = A0;   // the sensor's A (analog) pin

void setup() {
  Serial.begin(9600);
}

void loop() {
  int raw = analogRead(SOIL);   // dry soil: big number, wet soil: smaller number
  Serial.println(raw);

  // TODO: turn raw into a percentage with map(raw, 1023, 300, 0, 100)
  //       and print it with a % sign, for example "Moisture: 45%"
  delay(500);
}
`,
    solutionCode: `// Is my plant thirsty? Read the soil moisture sensor.

const int SOIL = A0;   // the sensor's A (analog) pin

void setup() {
  Serial.begin(9600);
}

void loop() {
  int raw = analogRead(SOIL);   // dry soil: big number, wet soil: smaller number

  // Calibration: dry air reads about 1023, a glass of water about 300
  int percent = map(raw, 1023, 300, 0, 100);
  percent = constrain(percent, 0, 100);

  Serial.print("Moisture: ");
  Serial.print(percent);
  Serial.println("%");
  delay(500);
}
`,
    solutionWires: SOIL_WIRES,
    hints: [
      'Open the Serial Monitor tab under the code to see the numbers.',
      'map(raw, 1023, 300, 0, 100) turns 1023 (dry) into 0 and 300 (wet) into 100. Notice the first range goes DOWN!',
      'Print the % sign with Serial.println("%"); after printing the number.',
    ],
    objectives: [
      { text: 'Print the sensor reading in the Serial Monitor', check: (c) => c.world.serial.split('\n').filter((l: string) => /\d/.test(l)).length >= 3 },
      {
        text: 'Show the moisture in % (dry soil: low, wet soil: high)',
        check: (c) => {
          const m = lastLine(c.world.serial).match(/(-?\d+(?:\.\d+)?)\s*%/);
          if (!m) return false;
          const real = c.world.moisture * 100;
          if (Math.abs(Number(m[1]) - real) <= 12) {
            if (real < 35) c.mem.dry = true;
            if (real > 60) c.mem.wet = true;
          }
          return !!(c.mem.dry && c.mem.wet);
        },
      },
    ],
  },
  {
    id: 'soilLight',
    title: 'Moisture Traffic Light',
    emoji: '🚦',
    course: ['L2S6'],
    story: 'Grandma wants to see from the kitchen window if the garden needs water. Show it with a traffic light: red = dry, yellow = a bit damp, green = nice and wet.',
    steps: [
      'Soil sensor: V → 5V, G → GND1, A → A0.',
      'Traffic light: R → 12, Y → 11, G → 10, − → GND2.',
      'Under 30% → red. 30% to 60% → yellow. Over 60% → green.',
      'Run it, then water the plant one cup at a time.',
    ],
    devices: ['soilSensor', 'soilLight'],
    controls: ['water', 'dry'],
    setup: { moisture: 0.15 },
    view: BED_VIEW,
    starterCode: `// Moisture traffic light: red = dry, yellow = damp, green = wet.

const int SOIL = A0;
const int RED = 12;
const int YELLOW = 11;
const int GREEN = 10;

void showLight(int r, int y, int g) {
  digitalWrite(RED, r);
  digitalWrite(YELLOW, y);
  digitalWrite(GREEN, g);
}

void setup() {
  pinMode(RED, OUTPUT);
  pinMode(YELLOW, OUTPUT);
  pinMode(GREEN, OUTPUT);
}

void loop() {
  int percent = map(analogRead(SOIL), 1023, 300, 0, 100);
  percent = constrain(percent, 0, 100);

  if (percent < 30) {
    showLight(HIGH, LOW, LOW);   // dry: red
  }
  // TODO: else if ... yellow between 30 and 60
  // TODO: else ... green above 60
  delay(200);
}
`,
    solutionCode: `// Moisture traffic light: red = dry, yellow = damp, green = wet.

const int SOIL = A0;
const int RED = 12;
const int YELLOW = 11;
const int GREEN = 10;

void showLight(int r, int y, int g) {
  digitalWrite(RED, r);
  digitalWrite(YELLOW, y);
  digitalWrite(GREEN, g);
}

void setup() {
  pinMode(RED, OUTPUT);
  pinMode(YELLOW, OUTPUT);
  pinMode(GREEN, OUTPUT);
}

void loop() {
  int percent = map(analogRead(SOIL), 1023, 300, 0, 100);
  percent = constrain(percent, 0, 100);

  if (percent < 30) {
    showLight(HIGH, LOW, LOW);   // dry: red
  } else if (percent < 60) {
    showLight(LOW, HIGH, LOW);   // a bit damp: yellow
  } else {
    showLight(LOW, LOW, HIGH);   // nice and wet: green
  }
  delay(200);
}
`,
    solutionWires: [...SOIL_WIRES, ['soilLight:RED', 'uno:D12'], ['soilLight:YEL', 'uno:D11'], ['soilLight:GRN', 'uno:D10'], ['soilLight:GND', 'uno:GND2']],
    hints: [
      'An if / else if / else ladder picks exactly one of the three colours.',
      'The first true condition wins: check "< 30" first, then "< 60", and "else" catches everything above.',
      'Each colour call must turn the other two OFF, otherwise two lights could stay on.',
    ],
    objectives: [
      { text: 'Dry soil: red light', check: (c) => c.held(c.world.moisture < 0.28 && traffic(c).red && !traffic(c).yellow && !traffic(c).green, 1) },
      { text: 'A bit damp: yellow light', check: (c) => c.held(c.world.moisture > 0.33 && c.world.moisture < 0.57 && traffic(c).yellow && !traffic(c).red && !traffic(c).green, 1) },
      { text: 'Nice and wet: green light', check: (c) => c.held(c.world.moisture > 0.63 && traffic(c).green && !traffic(c).red && !traffic(c).yellow, 1) },
    ],
  },
  {
    id: 'autoWater',
    title: 'Automatic Watering',
    emoji: '💧',
    course: ['L2S6'],
    story: 'The family is going on holiday for two weeks. Build a watering system: when the soil gets dry, a relay switches the water pump on - and off again before the bed turns into a swamp.',
    steps: [
      'Power rail: Arduino 5V → red + rail, GND → blue - rail.',
      'Soil sensor: V → + rail, G → - rail, A → A0.',
      'Pump relay: G → - rail, V → + rail, I → pin 7.',
      'Pump ON below 30%, OFF above 70%. Then watch the sun dry the soil!',
    ],
    devices: ['soilSensor', 'pump'],
    controls: ['water', 'dry', 'temperature'],
    setup: { moisture: 0.5, dryRate: 0.03, temperature: 26 },
    view: BED_VIEW,
    starterCode: `// Automatic watering: switch the pump on when the soil is dry.

const int SOIL = A0;
const int PUMP = 7;    // the relay that switches the water pump

void setup() {
  Serial.begin(9600);
  pinMode(PUMP, OUTPUT);
}

void loop() {
  int percent = map(analogRead(SOIL), 1023, 300, 0, 100);
  percent = constrain(percent, 0, 100);
  Serial.println(percent);

  if (percent < 30) {
    digitalWrite(PUMP, HIGH);   // too dry: start watering
  }
  // TODO: stop the pump when the soil is wet enough (above 70%)
  delay(200);
}
`,
    solutionCode: `// Automatic watering: switch the pump on when the soil is dry.

const int SOIL = A0;
const int PUMP = 7;    // the relay that switches the water pump

void setup() {
  Serial.begin(9600);
  pinMode(PUMP, OUTPUT);
}

void loop() {
  int percent = map(analogRead(SOIL), 1023, 300, 0, 100);
  percent = constrain(percent, 0, 100);
  Serial.println(percent);

  if (percent < 30) {
    digitalWrite(PUMP, HIGH);   // too dry: start watering
  }
  if (percent > 70) {
    digitalWrite(PUMP, LOW);    // wet enough: stop
  }
  delay(200);
}
`,
    solutionWires: [
      ...RAIL_POWER,
      ['soilSensor:VCC', 'rail:P2'],
      ['soilSensor:GND', 'rail:N2'],
      ['soilSensor:AO', 'uno:A0'],
      ['pump:GND', 'rail:N6'],
      ['pump:VCC', 'rail:P6'],
      ['pump:IN', 'uno:D7'],
    ],
    hints: [
      'A relay is a switch that the Arduino clicks on and off. The pump gets its power through it.',
      'Why two different numbers (30 and 70)? If you used one number, the pump would flick on and off all the time.',
      'Watch the Serial Monitor: does the moisture ever go above 95%? Then the pump runs too long!',
    ],
    objectives: [
      { text: 'The pump starts when the soil is dry', check: (c) => c.world.moisture < 0.34 && c.dev('pump').on },
      { text: 'The pump stops when the soil is wet', check: (c) => c.world.moisture > 0.6 && !c.dev('pump').on },
      { text: 'The plant stays happy for 15 seconds', check: (c) => c.held(c.world.moisture > 0.2 && c.world.moisture < 0.9, 15) },
    ],
  },
  {
    id: 'weatherStation',
    title: 'Weather Station',
    emoji: '🌡️',
    course: ['L2S7'],
    story: 'Gardeners keep a weather diary. Use a DHT11 sensor to measure the temperature AND the air humidity, and write them in the Serial Monitor every two seconds.',
    steps: [
      'Wire the DHT11: S → pin 7, V → 5V, − → GND.',
      'The DHT library does the hard work: dht.readTemperature() and dht.readHumidity().',
      'Print both values on one line, then change the weather with the sliders.',
    ],
    devices: ['weather'],
    controls: ['temperature', 'humidity'],
    setup: { temperature: 22, humidity: 50 },
    view: STATION_VIEW,
    starterCode: `// Weather station: temperature and humidity with a DHT11.
#include <DHT.h>

DHT dht(7, DHT11);   // the sensor is on pin 7

void setup() {
  Serial.begin(9600);
  dht.begin();
}

void loop() {
  float t = dht.readTemperature();   // degrees Celsius
  // TODO: read the humidity with dht.readHumidity()

  Serial.print("Temperature: ");
  Serial.print(t);
  Serial.println(" C");
  // TODO: also print the humidity in %

  delay(2000);   // the DHT11 needs 2 seconds between readings
}
`,
    solutionCode: `// Weather station: temperature and humidity with a DHT11.
#include <DHT.h>

DHT dht(7, DHT11);   // the sensor is on pin 7

void setup() {
  Serial.begin(9600);
  dht.begin();
}

void loop() {
  float t = dht.readTemperature();   // degrees Celsius
  float h = dht.readHumidity();      // % of water vapour in the air

  if (isnan(t) || isnan(h)) {        // isnan = "is not a number": the reading failed
    Serial.println("Sensor error!");
  } else {
    Serial.print("Temperature: ");
    Serial.print(t);
    Serial.print(" C   Humidity: ");
    Serial.print(h);
    Serial.println(" %");
  }
  delay(2000);   // the DHT11 needs 2 seconds between readings
}
`,
    solutionWires: [
      ['weather:DATA', 'uno:D7'],
      ['weather:VCC', 'uno:5V'],
      ['weather:GND', 'uno:GND1'],
    ],
    hints: [
      'float variables can hold numbers with a decimal point, like 23.5.',
      'If a reading fails, the library returns NAN ("not a number"). isnan() checks for that.',
      'The DHT11 is slow: asking more often than every 2 seconds just gives you the old value again.',
    ],
    objectives: [
      { text: 'Print the temperature', check: (c) => near(numbers(lastLine(c.world.serial)), c.world.temperature, 1.1) },
      { text: 'Print the humidity too', check: (c) => near(numbers(lastLine(c.world.serial)), c.world.temperature, 1.1) && near(numbers(lastLine(c.world.serial)), c.world.humidity, 2.1) },
      {
        text: 'The readings follow the weather',
        check: (c) => c.world.temperature > 28 && near(numbers(lastLine(c.world.serial)), c.world.temperature, 1.1) && near(numbers(lastLine(c.world.serial)), c.world.humidity, 2.1),
      },
    ],
  },
  {
    id: 'gardenScreen',
    title: 'Garden Screen',
    emoji: '📟',
    course: ['L2S8'],
    story: 'Nobody carries a laptop into the garden. Put the temperature and humidity on a real screen: a 16x2 LCD on the weather station.',
    steps: [
      'Power rail: Arduino 5V → red + rail, GND → blue - rail.',
      'DHT11: S → pin 7, V → + rail, − → - rail.',
      'LCD: G → - rail, V → + rail, RS → 12, E → 11, D4 → 5, D5 → 4, D6 → 3, D7 → 2.',
      'lcd.setCursor(column, row) picks where to write. Rows are 0 (top) and 1 (bottom).',
    ],
    devices: ['weather', 'gardenLcd'],
    controls: ['temperature', 'humidity'],
    setup: { temperature: 22, humidity: 50 },
    view: STATION_VIEW,
    starterCode: `// Garden screen: show the weather on a 16x2 LCD.
#include <LiquidCrystal.h>
#include <DHT.h>

LiquidCrystal lcd(12, 11, 5, 4, 3, 2);   // RS, E, D4, D5, D6, D7
DHT dht(7, DHT11);

void setup() {
  lcd.begin(16, 2);    // 16 columns, 2 rows
  dht.begin();
  lcd.print("Hello garden!");
}

void loop() {
  float t = dht.readTemperature();
  float h = dht.readHumidity();

  // TODO: top row: "Temp: 22.0 C"
  // TODO: bottom row: "Humidity: 50%"
  // Use lcd.clear(), lcd.setCursor(0, 0) and lcd.print(...)

  delay(2000);
}
`,
    solutionCode: `// Garden screen: show the weather on a 16x2 LCD.
#include <LiquidCrystal.h>
#include <DHT.h>

LiquidCrystal lcd(12, 11, 5, 4, 3, 2);   // RS, E, D4, D5, D6, D7
DHT dht(7, DHT11);

void setup() {
  lcd.begin(16, 2);    // 16 columns, 2 rows
  dht.begin();
  lcd.print("Hello garden!");
  delay(1000);
}

void loop() {
  float t = dht.readTemperature();
  float h = dht.readHumidity();

  lcd.clear();
  lcd.setCursor(0, 0);         // column 0, top row
  lcd.print("Temp: ");
  lcd.print(t, 1);             // 1 digit after the decimal point
  lcd.print((char)223);        // the degree sign
  lcd.print("C");

  lcd.setCursor(0, 1);         // column 0, bottom row
  lcd.print("Humidity: ");
  lcd.print(h, 0);
  lcd.print("%");

  delay(2000);
}
`,
    solutionWires: [
      ...RAIL_POWER,
      ...DHT_ON_RAIL,
      ['gardenLcd:GND', 'rail:N8'],
      ['gardenLcd:VCC', 'rail:P8'],
      ['gardenLcd:RS', 'uno:D12'],
      ['gardenLcd:E', 'uno:D11'],
      ['gardenLcd:D4', 'uno:D5'],
      ['gardenLcd:D5', 'uno:D4'],
      ['gardenLcd:D6', 'uno:D3'],
      ['gardenLcd:D7', 'uno:D2'],
    ],
    hints: [
      'The LCD needs 6 data wires: RS and E tell it what is coming, D4-D7 carry the letters 4 bits at a time.',
      'lcd.clear() wipes the screen. Without it, old letters stay behind when a number gets shorter.',
      '(char)223 prints the ° degree sign on these screens.',
    ],
    objectives: [
      { text: 'Write something on the screen', check: (c) => lcdRow(c, 'gardenLcd', 0).trim().length > 0 },
      { text: 'Show the temperature on the top row', check: (c) => c.held(near(numbers(lcdRow(c, 'gardenLcd', 0)), c.world.temperature, 1.1), 0.5) },
      { text: 'Show the humidity on the bottom row', check: (c) => c.held(near(numbers(lcdRow(c, 'gardenLcd', 1)), c.world.humidity, 2.1), 0.5) },
      {
        text: 'The screen updates when the weather changes',
        check: (c) => c.world.temperature > 28 && near(numbers(lcdRow(c, 'gardenLcd', 0)), c.world.temperature, 1.1) && near(numbers(lcdRow(c, 'gardenLcd', 1)), c.world.humidity, 2.1),
      },
    ],
  },
  {
    id: 'greenhouseScreen',
    title: 'Greenhouse Screen (I2C)',
    emoji: '🖥️',
    course: ['L3S2'],
    story: 'The greenhouse screen has an I2C backpack: instead of 6 data wires it needs only two, SDA and SCL. Show the greenhouse climate on it.',
    steps: [
      'Power rail: Arduino 5V → red + rail, GND → blue - rail.',
      'DHT11: S → pin 7, V → + rail, − → - rail.',
      'I2C screen: G → - rail, V → + rail, SDA → A4, SCL → A5.',
      'The screen lives at I2C address 0x27. Start it with lcd.init() and lcd.backlight().',
    ],
    devices: ['weather', 'greenhouseLcd'],
    controls: ['temperature', 'humidity'],
    setup: { temperature: 21, humidity: 65 },
    view: GREENHOUSE_VIEW,
    starterCode: `// Greenhouse screen with an I2C LCD: only 4 wires!
#include <Wire.h>
#include <LiquidCrystal_I2C.h>
#include <DHT.h>

LiquidCrystal_I2C lcd(0x27, 16, 2);   // address 0x27, 16 columns, 2 rows
DHT dht(7, DHT11);

void setup() {
  // TODO: start the screen with lcd.init() and switch on lcd.backlight()
  dht.begin();
}

void loop() {
  float t = dht.readTemperature();
  float h = dht.readHumidity();
  // TODO: show t on the top row and h on the bottom row
  delay(2000);
}
`,
    solutionCode: `// Greenhouse screen with an I2C LCD: only 4 wires!
#include <Wire.h>
#include <LiquidCrystal_I2C.h>
#include <DHT.h>

LiquidCrystal_I2C lcd(0x27, 16, 2);   // address 0x27, 16 columns, 2 rows
DHT dht(7, DHT11);

void setup() {
  lcd.init();
  lcd.backlight();
  dht.begin();
}

void loop() {
  float t = dht.readTemperature();
  float h = dht.readHumidity();

  lcd.clear();
  if (isnan(t) || isnan(h)) {     // check the reading before showing it
    lcd.print("Sensor error!");
  } else {
    lcd.setCursor(0, 0);
    lcd.print("Greenhouse ");
    lcd.print(t, 0);
    lcd.print((char)223);
    lcd.print("C");
    lcd.setCursor(0, 1);
    lcd.print("Humidity   ");
    lcd.print(h, 0);
    lcd.print("%");
  }
  delay(2000);
}
`,
    solutionWires: [
      ...RAIL_POWER,
      ...DHT_ON_RAIL,
      ['greenhouseLcd:GND', 'rail:N8'],
      ['greenhouseLcd:VCC', 'rail:P8'],
      ['greenhouseLcd:SDA', 'uno:A4'],
      ['greenhouseLcd:SCL', 'uno:A5'],
    ],
    hints: [
      'I2C is a bus: many devices can share the same two wires. Each one has its own address, like a house number.',
      'SDA (data) always goes to A4 and SCL (clock) to A5 on an Arduino Uno.',
      'If the screen stays dark, did you call lcd.backlight()?',
    ],
    objectives: [
      { text: 'Backlight on and text on the screen', check: (c) => !!c.dev('greenhouseLcd').display?.backlight && lcdRow(c, 'greenhouseLcd', 0).trim().length > 0 },
      { text: 'Show the temperature', check: (c) => c.held(near(numbers(lcdRow(c, 'greenhouseLcd', 0) + ' ' + lcdRow(c, 'greenhouseLcd', 1)), c.world.temperature, 1.1), 0.5) },
      { text: 'Show the humidity', check: (c) => c.held(near(numbers(lcdRow(c, 'greenhouseLcd', 0) + ' ' + lcdRow(c, 'greenhouseLcd', 1)), c.world.humidity, 2.1), 0.5) },
    ],
  },
  {
    id: 'heatAlert',
    title: 'Heat Alert',
    emoji: '🔥',
    course: ['L3S2', 'L1S4'],
    story: 'Seedlings die if the greenhouse gets too cold or too hot. Make an alert light that mixes colours: blue when cool, green when just right, red and beeping when it is too hot.',
    steps: [
      'DHT11: S → pin 7, V → 5V, − → GND1.',
      'RGB LED: R → 9, G → 10, B → 6, − → GND2 (all PWM ~ pins).',
      'Alarm buzzer: G → GND3, S → pin 8.',
      'Below 18 °C: blue. 18-28 °C: green. Above 28 °C: red + beep.',
    ],
    devices: ['weather', 'alertLight', 'alarm'],
    controls: ['temperature'],
    setup: { temperature: 15 },
    view: GREENHOUSE_VIEW,
    starterCode: `// Heat alert: blue = cool, green = just right, red + beep = too hot.
#include <DHT.h>

DHT dht(7, DHT11);
const int R = 9;      // RGB LED colours (PWM pins)
const int G = 10;
const int B = 6;
const int ALARM = 8;

// Mix a colour: each part from 0 (off) to 255 (full)
void color(int r, int g, int b) {
  analogWrite(R, r);
  analogWrite(G, g);
  analogWrite(B, b);
}

void setup() {
  dht.begin();
  pinMode(ALARM, OUTPUT);
}

void loop() {
  float t = dht.readTemperature();
  if (t < 18) {
    color(0, 0, 255);          // cool: blue
  } else {
    color(0, 255, 0);          // just right: green
  }
  // TODO: above 28 degrees: red light and a beep with tone(ALARM, 1500, 200)
  delay(500);
}
`,
    solutionCode: `// Heat alert: blue = cool, green = just right, red + beep = too hot.
#include <DHT.h>

DHT dht(7, DHT11);
const int R = 9;      // RGB LED colours (PWM pins)
const int G = 10;
const int B = 6;
const int ALARM = 8;

// Mix a colour: each part from 0 (off) to 255 (full)
void color(int r, int g, int b) {
  analogWrite(R, r);
  analogWrite(G, g);
  analogWrite(B, b);
}

void setup() {
  dht.begin();
  pinMode(ALARM, OUTPUT);
}

void loop() {
  float t = dht.readTemperature();
  if (t < 18) {
    color(0, 0, 255);          // cool: blue
    noTone(ALARM);
  } else if (t <= 28) {
    color(0, 255, 0);          // just right: green
    noTone(ALARM);
  } else {
    color(255, 0, 0);          // too hot: red
    tone(ALARM, 1500, 200);    // short beep
  }
  delay(500);
}
`,
    solutionWires: [
      ['weather:DATA', 'uno:D7'],
      ['weather:VCC', 'uno:5V'],
      ['weather:GND', 'uno:GND1'],
      ['alertLight:RED', 'uno:D9'],
      ['alertLight:GRN', 'uno:D10'],
      ['alertLight:BLU', 'uno:D6'],
      ['alertLight:GND', 'uno:GND2'],
      ['alarm:GND', 'uno:GND3'],
      ['alarm:SIG', 'uno:D8'],
    ],
    hints: [
      'An RGB LED is three LEDs in one. color(255, 0, 255) mixes red and blue into purple!',
      'Use if / else if / else so exactly one colour is chosen.',
      'tone(ALARM, 1500, 200) beeps for 200 ms and stops by itself. Real-world gotcha: tone() borrows timer 2, so PWM on pins 3 and 11 stops working while it plays. That is why blue is on pin 6!',
    ],
    objectives: [
      { text: 'Cool (below 18 °C): blue light', check: (c) => c.held(c.world.temperature < 18 && rgb(c, 'alertLight').b > 0.6 && rgb(c, 'alertLight').r < 0.2 && rgb(c, 'alertLight').g < 0.2, 1) },
      { text: 'Just right: green light', check: (c) => c.held(c.world.temperature >= 18 && c.world.temperature <= 28 && rgb(c, 'alertLight').g > 0.6 && rgb(c, 'alertLight').r < 0.2 && rgb(c, 'alertLight').b < 0.2, 1) },
      { text: 'Too hot (above 28 °C): red light', check: (c) => c.held(c.world.temperature > 28 && rgb(c, 'alertLight').r > 0.6 && rgb(c, 'alertLight').g < 0.2 && rgb(c, 'alertLight').b < 0.2, 1) },
      { text: 'Too hot: the alarm beeps', check: (c) => c.count(c.world.temperature > 28 && c.dev('alarm').freq > 0) >= 2 },
    ],
  },
  {
    id: 'greenhouseRoof',
    title: 'Greenhouse Roof',
    emoji: '🪟',
    course: ['L2S5'],
    story: 'On sunny days the greenhouse gets far too hot. A DC motor opens the roof window - but an Arduino pin is too weak to drive a motor, so an L293D motor driver does the heavy lifting.',
    steps: [
      'Power rail: Arduino 5V → red + rail, GND → blue - rail.',
      'Motor driver: G → - rail, V → + rail, EN → pin 5, I1 → pin 4, I2 → pin 3.',
      'Open button: G → - rail, V → + rail, S → pin 8. Close button: same, S → pin 7.',
      'IN1 HIGH + IN2 LOW = open. IN1 LOW + IN2 HIGH = close. Both LOW = stop.',
    ],
    devices: ['roofMotor', 'openButton', 'closeButton'],
    controls: ['temperature'],
    setup: { temperature: 31 },
    view: GREENHOUSE_VIEW,
    starterCode: `// Greenhouse roof: an L293D motor driver turns the motor both ways.

const int EN = 5;          // speed (PWM)
const int IN1 = 4;         // direction pins
const int IN2 = 3;
const int OPEN_BTN = 8;
const int CLOSE_BTN = 7;

void setup() {
  pinMode(EN, OUTPUT);
  pinMode(IN1, OUTPUT);
  pinMode(IN2, OUTPUT);
  pinMode(OPEN_BTN, INPUT);
  pinMode(CLOSE_BTN, INPUT);
  analogWrite(EN, 200);    // motor speed: 0-255
}

void loop() {
  if (digitalRead(OPEN_BTN) == HIGH) {
    digitalWrite(IN1, HIGH);   // turn one way: open
    digitalWrite(IN2, LOW);
  }
  // TODO: CLOSE button: turn the other way (IN1 LOW, IN2 HIGH)
  // TODO: no button pressed: stop the motor (both LOW)
}
`,
    solutionCode: `// Greenhouse roof: an L293D motor driver turns the motor both ways.

const int EN = 5;          // speed (PWM)
const int IN1 = 4;         // direction pins
const int IN2 = 3;
const int OPEN_BTN = 8;
const int CLOSE_BTN = 7;

void setup() {
  pinMode(EN, OUTPUT);
  pinMode(IN1, OUTPUT);
  pinMode(IN2, OUTPUT);
  pinMode(OPEN_BTN, INPUT);
  pinMode(CLOSE_BTN, INPUT);
  analogWrite(EN, 200);    // motor speed: 0-255
}

void loop() {
  if (digitalRead(OPEN_BTN) == HIGH) {
    digitalWrite(IN1, HIGH);   // turn one way: open
    digitalWrite(IN2, LOW);
  } else if (digitalRead(CLOSE_BTN) == HIGH) {
    digitalWrite(IN1, LOW);    // turn the other way: close
    digitalWrite(IN2, HIGH);
  } else {
    digitalWrite(IN1, LOW);    // stop
    digitalWrite(IN2, LOW);
  }
}
`,
    solutionWires: [
      ...RAIL_POWER,
      ['roofMotor:GND', 'rail:N2'],
      ['roofMotor:VCC', 'rail:P2'],
      ['roofMotor:EN', 'uno:D5'],
      ['roofMotor:IN1', 'uno:D4'],
      ['roofMotor:IN2', 'uno:D3'],
      ['openButton:GND', 'rail:N7'],
      ['openButton:VCC', 'rail:P7'],
      ['openButton:SIG', 'uno:D8'],
      ['closeButton:GND', 'rail:N11'],
      ['closeButton:VCC', 'rail:P11'],
      ['closeButton:SIG', 'uno:D7'],
    ],
    hints: [
      'An H-bridge (like the L293D) can push current through the motor in either direction. That is how it reverses.',
      'EN is the speed: analogWrite(EN, 255) is full speed, 0 is stopped.',
      'Hold the buttons in the 3D greenhouse or on the workbench. Let go and the motor must stop!',
    ],
    objectives: [
      { text: 'Hold OPEN: the roof opens', check: (c) => c.world.roof > 0.6 },
      { text: 'Let go: the motor stops', check: (c) => c.held(!c.world.pressed.openButton && !c.world.pressed.closeButton && Math.abs(c.dev('roofMotor').speed) < 0.05, 1) },
      { text: 'Hold CLOSE: the roof closes again', check: (c) => c.world.roof < 0.1 && c.dev('roofMotor').speed < 0 },
    ],
  },
  {
    id: 'growLight',
    title: 'Purple Grow Light',
    emoji: '💜',
    course: ['L1S4', 'L2S3'],
    story: 'Plants grow best with red and blue light, so real greenhouse lamps glow purple! Switch on a purple grow light when it gets dark outside.',
    steps: [
      'Light sensor: G → GND1, V → 5V, A → A0.',
      'RGB grow light: R → 9, G → 10, B → 11, − → GND2.',
      'When analogRead(A0) is low (dark), mix red and blue to make purple.',
      'Slide the time to the evening and watch the greenhouse.',
    ],
    devices: ['growSensor', 'growLight'],
    controls: ['time'],
    setup: { hour: 12 },
    view: GREENHOUSE_VIEW,
    starterCode: `// Purple grow light: switch on when it gets dark.

const int SENSOR = A0;
const int R = 9;
const int G = 10;
const int B = 11;

void setup() {
  pinMode(R, OUTPUT);
  pinMode(G, OUTPUT);
  pinMode(B, OUTPUT);
}

void loop() {
  int light = analogRead(SENSOR);   // 0 = dark, 1023 = bright
  if (light < 400) {
    analogWrite(R, 255);            // TODO: add blue to make purple
  } else {
    analogWrite(R, 0);              // TODO: switch everything off
  }
  delay(200);
}
`,
    solutionCode: `// Purple grow light: switch on when it gets dark.

const int SENSOR = A0;
const int R = 9;
const int G = 10;
const int B = 11;

void setup() {
  pinMode(R, OUTPUT);
  pinMode(G, OUTPUT);
  pinMode(B, OUTPUT);
}

void loop() {
  int light = analogRead(SENSOR);   // 0 = dark, 1023 = bright
  if (light < 400) {
    analogWrite(R, 255);            // red + blue = purple
    analogWrite(G, 0);
    analogWrite(B, 200);
  } else {
    analogWrite(R, 0);              // daytime: off
    analogWrite(G, 0);
    analogWrite(B, 0);
  }
  delay(200);
}
`,
    solutionWires: [
      ['growSensor:GND', 'uno:GND1'],
      ['growSensor:VCC', 'uno:5V'],
      ['growSensor:AO', 'uno:A0'],
      ['growLight:RED', 'uno:D9'],
      ['growLight:GRN', 'uno:D10'],
      ['growLight:BLU', 'uno:D11'],
      ['growLight:GND', 'uno:GND2'],
    ],
    hints: [
      'Light colours add up: red + blue = purple (magenta), red + green = yellow, all three = white.',
      'analogWrite(pin, 0..255) sets how much of each colour you add.',
      'Remember to switch ALL colours off in the daytime.',
    ],
    objectives: [
      { text: 'Daytime: the grow light is off', check: (c) => c.held(c.world.daylight > 0.7 && Math.max(rgb(c, 'growLight').r, rgb(c, 'growLight').g, rgb(c, 'growLight').b) < 0.1, 1.5) },
      { text: 'Night: purple light (red + blue)', check: (c) => c.held(c.world.daylight < 0.1 && rgb(c, 'growLight').r > 0.6 && rgb(c, 'growLight').b > 0.5 && rgb(c, 'growLight').g < 0.2, 1.5) },
    ],
  },
  {
    id: 'free',
    title: 'Free Play: Your Garden',
    emoji: '🏡',
    story: 'All the garden gadgets are on your workbench. Build the smartest garden in town: automatic watering, a weather screen, a roof that opens itself when it is hot...',
    steps: ['Pick the gadgets you want and wire them up.', 'Write your own program and Run it.', 'Use the sliders and buttons to change the weather and water the plant.'],
    devices: ['soilSensor', 'soilLight', 'pump', 'weather', 'gardenLcd', 'greenhouseLcd', 'alertLight', 'alarm', 'roofMotor', 'openButton', 'closeButton', 'growSensor', 'growLight'],
    controls: ['time', 'temperature', 'humidity', 'water', 'dry'],
    starterCode: `// Free play: build your own smart garden!

void setup() {
  Serial.begin(9600);
}

void loop() {

}
`,
    solutionCode: `// Example: the roof opens by itself when the greenhouse is too hot.
#include <DHT.h>

DHT dht(7, DHT11);
const int EN = 5;
const int IN1 = 4;
const int IN2 = 3;

void setup() {
  dht.begin();
  pinMode(EN, OUTPUT);
  pinMode(IN1, OUTPUT);
  pinMode(IN2, OUTPUT);
  analogWrite(EN, 200);
}

void loop() {
  float t = dht.readTemperature();
  if (t > 28) {                 // too hot: open
    digitalWrite(IN1, HIGH);
    digitalWrite(IN2, LOW);
  } else if (t < 22) {          // cool enough: close
    digitalWrite(IN1, LOW);
    digitalWrite(IN2, HIGH);
  }
  delay(4000);                  // run the motor for a while
  digitalWrite(IN1, LOW);
  digitalWrite(IN2, LOW);
}
`,
    solutionWires: [],
    hints: ['Look at the earlier missions for wiring ideas.', 'Use the power rail when several modules need 5V.'],
    objectives: [],
  },
];
