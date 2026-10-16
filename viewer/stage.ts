/**
 * The backdrop the city sits on, in one place: the page background (src/write/html.ts),
 * the distance fog and the Photo export (viewer/main.ts) all read it from here.
 * Day is the site's paper, like a model on a worktable; night is ink. Flat, no vignette.
 */
export const STAGE = {
  day: { stops: ['#F6F3EC', '#F6F3EC', '#F6F3EC'], fog: 0xf6f3ec },
  night: { stops: ['#101410', '#101410', '#101410'], fog: 0x101410 },
} as const;

/** CSS for the page background behind the canvas (a radial gradient only when the stops differ). */
export function stageCss(): string {
  const g = (s: readonly string[]) => (s.every((c) => c === s[0]) ? s[0]! : `radial-gradient(120% 95% at 50% 32%,${s[0]} 0%,${s[1]} 55%,${s[2]} 100%)`);
  return `body:not(.night){background:${g(STAGE.day.stops)}}\nbody.night{background:${g(STAGE.night.stops)}!important}`;
}
