import { nbt, type Tag } from './nbt.js';

/** 1.21.5 (DataVersion 4325) stores sign text as text components instead of JSON strings. */
export const SIGN_COMPONENT_NBT_SINCE = 4325;

export function signText(line: string, dataVersion: number): Tag {
  return nbt.string(dataVersion >= SIGN_COMPONENT_NBT_SINCE ? line : JSON.stringify(line));
}

/** Block entity payload for a standing sign (without id/x/y/z). */
export function signBlockEntityData(lines: string[], dataVersion: number): Tag {
  const four = [0, 1, 2, 3].map((i) => (lines[i] ?? '').slice(0, 15));
  const side = (msgs: string[]) =>
    nbt.compound({
      has_glowing_text: nbt.byte(0),
      color: nbt.string('black'),
      messages: nbt.list('string', msgs.map((l) => signText(l, dataVersion))),
    });
  return nbt.compound({
    front_text: side(four),
    back_text: side(['', '', '', '']),
    is_waxed: nbt.byte(0),
  });
}
