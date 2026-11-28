/** Hand angles in degrees, clockwise from 12. The hour hand moves on with the minutes. */
export function handAngles(hour: number, minute: number): { hour: number; minute: number } {
  return { hour: ((hour % 12) + minute / 60) * 30, minute: (minute % 60) * 6 };
}

/** How many numbers the minute hand has passed in five-minute steps (0 on the twelve). */
export function fiveMinuteSteps(minute: number): number {
  return Math.floor((minute % 60) / 5);
}
