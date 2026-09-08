type DomKeyboardEventLike = {
  code: string;
  key: string;
  location?: number;
};

const ANDROID_KEY_CODES_BY_DOM_CODE: Record<string, number> = {
  Backquote: 68,
  Backslash: 73,
  Backspace: 67,
  BracketLeft: 71,
  BracketRight: 72,
  Comma: 55,
  Delete: 112,
  End: 123,
  Enter: 66,
  Equal: 70,
  Escape: 111,
  F1: 131,
  F2: 132,
  F3: 133,
  F4: 134,
  F5: 135,
  F6: 136,
  F7: 137,
  F8: 138,
  F9: 139,
  F10: 140,
  F11: 141,
  F12: 142,
  Home: 122,
  Insert: 124,
  Minus: 69,
  PageDown: 93,
  PageUp: 92,
  Period: 56,
  Quote: 75,
  Semicolon: 74,
  Slash: 76,
  Space: 62,
  Tab: 61,
  ArrowDown: 20,
  ArrowLeft: 21,
  ArrowRight: 22,
  ArrowUp: 19,
  AltLeft: 57,
  AltRight: 58,
  ControlLeft: 113,
  ControlRight: 114,
  MetaLeft: 117,
  MetaRight: 118,
  ShiftLeft: 59,
  ShiftRight: 60,
};

for (let index = 0; index < 10; index += 1) {
  ANDROID_KEY_CODES_BY_DOM_CODE[`Digit${index}`] = index === 0 ? 7 : 7 + index;
  ANDROID_KEY_CODES_BY_DOM_CODE[`Numpad${index}`] = 144 + index;
}

for (let index = 0; index < 26; index += 1) {
  ANDROID_KEY_CODES_BY_DOM_CODE[`Key${String.fromCharCode(65 + index)}`] = 29 + index;
}

const MODIFIER_DOM_CODES = [
  "AltLeft",
  "AltRight",
  "ControlLeft",
  "ControlRight",
  "MetaLeft",
  "MetaRight",
  "ShiftLeft",
  "ShiftRight",
];

// 修饰键的 Android keycode（含左右两侧）。被控端会忽略没有按下记录的释放，
// 所以清理这些键时要先补一次按下，让被控端把记录建回来。
export const REMOTE_MODIFIER_KEY_CODES: ReadonlySet<number> = new Set(
  MODIFIER_DOM_CODES.map((code) => ANDROID_KEY_CODES_BY_DOM_CODE[code]),
);

export function toAndroidKeyCodeFromDomEvent(event: DomKeyboardEventLike): string | number {
  return ANDROID_KEY_CODES_BY_DOM_CODE[event.code] ?? event.key;
}
