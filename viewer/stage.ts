/**
 * The backdrop the city sits on, in one place: the page background (src/write/html.ts),
 * the distance fog and the Photo export (viewer/main.ts) all read it from here.
 * Day is a quiet warm grey, like a model on a worktable; night is a dark ink.
 */
export const STAGE = {
  day: { stops: ['#bfb9ae', '#afa99e', '#979084'], fog: 0xb3ada2 },
  night: { stops: ['#232830', '#16191f', '#0d0f12'], fog: 0x1a1d23 },
} as const;

/** CSS for the page background behind the canvas (radial vignette, centre slightly lighter). */
export function stageCss(): string {
  const g = (s: readonly string[]) => `radial-gradient(120% 95% at 50% 32%,${s[0]} 0%,${s[1]} 55%,${s[2]} 100%)`;
  return `body:not(.night){background:${g(STAGE.day.stops)}}\nbody.night{background:${g(STAGE.night.stops)}!important}`;
}
