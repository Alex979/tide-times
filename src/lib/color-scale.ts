export type ColorStop = readonly [position: number, color: string];

export type CssColorSpace =
  | "oklab"
  | "oklch"
  | "lab"
  | "lch"
  | "srgb"
  | "srgb-linear"
  | "hsl";

/**
 * Builds a reusable function that maps numeric values to CSS `color-mix()`
 * strings across any number of `[position, color]` stops.
 *
 * Accepts any valid CSS color (hex, oklch, `var(--color-...)`, etc.).
 */
export function createCssColorScale(
  stops: readonly ColorStop[],
  colorSpace: CssColorSpace = "oklab",
): (value: number) => string {
  if (stops.length === 0) {
    throw new Error("createCssColorScale requires at least one color stop");
  }
  if (stops.some(([pos]) => !Number.isFinite(pos))) {
    throw new Error("createCssColorScale stop positions must be finite numbers");
  }

  const sorted = [...stops].sort((a, b) => a[0] - b[0]);

  return (value: number): string => {
    const first = sorted[0];
    const last = sorted[sorted.length - 1];

    if (Number.isNaN(value) || value <= first[0]) return first[1];
    if (value >= last[0]) return last[1];

    for (let i = 0; i < sorted.length - 1; i++) {
      const [startPos, startColor] = sorted[i];
      const [endPos, endColor] = sorted[i + 1];

      if (value <= endPos) {
        if (startColor === endColor) return startColor;
        if (value === endPos) return endColor;

        const formattedPct = (
          ((value - startPos) / (endPos - startPos)) *
          100
        ).toFixed(2);
        if (formattedPct === "0.00") return startColor;
        if (formattedPct === "100.00") return endColor;

        return `color-mix(in ${colorSpace}, ${endColor} ${formattedPct}%, ${startColor})`;
      }
    }

    return last[1];
  };
}
