// The Arduino course (Levels 1-3) that the missions follow. Each mission lists the
// sessions it practises in `mission.course`, e.g. ['L1S3'].

export interface CourseSession {
  id: string;
  level: number;
  session: number;
  title: string;
  /** Shown when no mission covers the session yet */
  note?: string;
}

const s = (level: number, session: number, title: string, note?: string): CourseSession => ({ id: `L${level}S${session}`, level, session, title, note });

export const COURSE: CourseSession[] = [
  s(1, 1, 'Foundations of Electronics', 'Voltage, current and polarity show up in the Circuit Helper: every LED needs a full loop to GND, and it warns about short circuits and reversed power.'),
  s(1, 2, 'Introduction to Arduino Boards'),
  s(1, 3, 'Digital Output'),
  s(1, 4, 'Analog Inputs & Outputs'),
  s(1, 5, 'Buzzer and Sound'),
  s(1, 6, 'Push-Button Input'),
  s(1, 7, 'Digital Input: Sensors'),
  s(1, 8, 'Arduino IDE and C++ Basics'),
  s(1, 9, 'C++ Variables and Data Types'),
  s(1, 10, 'Conditionals and Operators'),
  s(1, 11, 'Loops in C++'),
  s(1, 12, 'Functions and Servo Motors'),
  s(2, 1, 'Introduction to Sensors & Binary Numbers'),
  s(2, 2, 'Seven-Segment Displays'),
  s(2, 3, 'Light Sensors (LDR & IR)'),
  s(2, 4, 'Proximity & Distance Sensors (Ultrasonic)'),
  s(2, 5, 'DC Motors & H-Bridge (L293D)'),
  s(2, 6, 'Soil Moisture Sensors'),
  s(2, 7, 'Temperature & Humidity Sensors'),
  s(2, 8, 'LCD Displays'),
  s(2, 9, 'Keypads & Input Systems'),
  s(2, 10, 'Advanced Sensors & Applications'),
  s(3, 1, 'Communication & Protocols (UART)'),
  s(3, 2, 'I2C Protocol & Sensor Integration'),
  s(3, 3, 'SPI Protocol'),
  s(3, 4, 'PWM (Pulse Width Modulation)'),
  s(3, 5, 'EEPROM & Data Storage'),
  s(3, 6, 'Interrupts'),
  s(3, 7, 'Joystick & Servo Control'),
  s(3, 8, 'Graduation Project'),
];

export const courseSession = (id: string) => COURSE.find((c) => c.id === id);

/** Short label like "L1 · S3" */
export const courseTag = (id: string) => {
  const c = courseSession(id);
  return c ? `L${c.level} · S${c.session}` : id;
};
