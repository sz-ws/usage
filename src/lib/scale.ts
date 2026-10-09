/** Round axis values (1, 2 or 5 times a power of ten) from 0 up to at least `max`. */
export function niceTicks(max: number, target = 4): number[] {
  if (!(max > 0)) return [0];
  const rough = max / target;
  const magnitude = 10 ** Math.floor(Math.log10(rough));
  const step = ([1, 2, 5, 10].find((factor) => factor * magnitude >= rough) ?? 10) * magnitude;
  // The last tick is the top of the axis, so it has to reach the maximum.
  const count = Math.ceil(max / step - 1e-9);
  return Array.from({ length: count + 1 }, (_, index) => index * step);
}
