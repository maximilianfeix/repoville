/**
 * Viewer-side colour grade for the browser city ("architectural model" look).
 *
 * Minecraft block colours are saturated and every language theme brings its own,
 * so a large city showed sandstone, sky-blue glass, lime roofs and red brick all
 * at once. The grade keeps each block's hue (language themes stay recognisable)
 * but compresses chroma and value in OKLCh so a frame reads as three material
 * families: pale stone, darker roofs (see the roof term in main.ts) and muted
 * planting. Fire stays untouched. Only the viewer is affected: the palette that
 * goes into .schem / .litematic / world exports does not change.
 */
import { hexLin, lchToLin, linToOklab, toSrgb } from './pixeltex.js';

/** Light sources and churn markers: never graded. */
const KEEP = /(^|:)(fire|soul_fire|campfire|soul_campfire|lava|lantern|soul_lantern|glowstone|shroomlight|end_rod)$/;
/** Moss is a metric (a year without commits): it stays a little greener than lawns. */
const MOSS = /moss/;
const PLANT = /leaves|grass_block|vine|poppy|dandelion|azalea|wart_block|chorus|fern|short_grass|bush/;
const GLASS = /glass/;
const WATER = /water/;

const DEG = Math.PI / 180;
const STONE_HUE = 75 * DEG; // warm grey-beige
const PLANT_HUE = 128 * DEG; // sage
const GLASS_HUE = 235 * DEG; // cool grey-blue

function toward(h: number, target: number, t: number): number {
  const d = Math.atan2(Math.sin(target - h), Math.cos(target - h));
  return h + d * t;
}

function pack(lin: [number, number, number]): number {
  const c = lin.map((v) => Math.round(255 * toSrgb(Math.min(1, Math.max(0, v)))));
  return (c[0]! << 16) | (c[1]! << 8) | c[2]!;
}

export function gradeColor(state: string, hex: number): number {
  const name = state.replace(/\[.*$/, '');
  if (KEEP.test(name)) return hex;
  const [L, a, b] = linToOklab(...hexLin(hex));
  const C = Math.hypot(a, b);
  let h = Math.atan2(b, a);
  const grey = C < 0.012;
  let L2: number, C2: number;
  if (MOSS.test(name)) {
    L2 = 0.3 + 0.55 * L;
    C2 = Math.min(C * 0.5, 0.045);
    h = toward(h, PLANT_HUE, 0.4);
  } else if (PLANT.test(name)) {
    // Lawns and trees: quiet sage, a touch darker than the stone so streets and plots read.
    L2 = 0.3 + 0.52 * L;
    C2 = Math.min(C * 0.36, 0.034);
    h = toward(h, PLANT_HUE, 0.5);
  } else if (GLASS.test(name)) {
    // Windows sit inside the wall family: a slightly cool, mid grey.
    L2 = 0.5 + 0.28 * L;
    C2 = grey ? 0.012 : Math.min(C * 0.25, 0.02);
    if (grey) h = GLASS_HUE;
  } else if (WATER.test(name)) {
    L2 = 0.46 + 0.3 * L;
    C2 = Math.min(C * 0.35, 0.04);
  } else {
    // Stone, wood, brick, concrete, terracotta: pale and low-chroma, order of values kept
    // so cracks, trim and roads still read against walls.
    L2 = 0.27 + 0.67 * L;
    C2 = Math.min(C * 0.4, 0.022 + 0.03 * L);
    h = grey ? STONE_HUE : toward(h, STONE_HUE, 0.2);
    if (grey) C2 = 0.008; // a hint of warmth on neutral greys
  }
  return pack(lchToLin(Math.min(0.96, L2), C2, h));
}

export function gradePalette(states: string[], colors: number[]): number[] {
  return colors.map((c, i) => gradeColor(states[i] ?? '', c));
}
