import type { Locale } from '../locale.ts';

export const HINTS = {
  'touch-each': {
    'de-CH': 'Tippe beim Zählen jedes Bild einmal an.',
    'en-US': 'Touch each picture once while you count.',
  },
  'count-dots': {
    'de-CH': 'Zähle die Punkte langsam.',
    'en-US': 'Count the dots slowly.',
  },
  'listen-again': {
    'de-CH': 'Hör nochmal gut zu.',
    'en-US': 'Listen again carefully.',
  },
  'power-of-five': {
    'de-CH': 'Eine volle Reihe sind fünf. Zähle von fünf weiter.',
    'en-US': 'A full row is five. Count on from five.',
  },
  'match-pairs': {
    'de-CH': 'Mach Paare: eins links, eins rechts.',
    'en-US': 'Make pairs: one on the left, one on the right.',
  },
  crocodile: {
    'de-CH': 'Das Krokodil frisst immer die grössere Zahl.',
    'en-US': 'The crocodile always eats the greater number.',
  },
  'count-the-steps': {
    'de-CH': 'Zähle die Striche vom Anfang an.',
    'en-US': 'Count the marks from the start.',
  },
  'look-at-neighbors': {
    'de-CH': 'Schau die Nachbarzahlen an.',
    'en-US': 'Look at the numbers next to it.',
  },
  'count-on': {
    'de-CH': 'Merke dir die erste Zahl und zähle weiter.',
    'en-US': 'Keep the first number in your head and count on.',
  },
  'count-back': {
    'de-CH': 'Merke dir die erste Zahl und zähle zurück.',
    'en-US': 'Keep the first number in your head and count back.',
  },
  'make-ten': {
    'de-CH': 'Mach zuerst die Zehn voll.',
    'en-US': 'Make ten first.',
  },
  'parts-make-whole': {
    'de-CH': 'Die zwei Zahlen unten sind zusammen die Zahl im Dach.',
    'en-US': 'The two numbers below make the number in the roof.',
  },
  'add-the-two-below': {
    'de-CH': 'Zwei Steine nebeneinander sind zusammen der Stein darüber.',
    'en-US': 'Two bricks side by side make the brick on top.',
  },
  'subtract-from-above': {
    'de-CH': 'Rechne minus: der Stein oben minus sein Nachbar.',
    'en-US': 'Subtract: the brick on top minus its neighbor.',
  },
  'look-at-the-steps': {
    'de-CH': 'Wie gross sind die Schritte? Mach den nächsten Schritt.',
    'en-US': 'How big are the steps? Take the next step.',
  },
  'say-the-pattern': {
    'de-CH': 'Sag das Muster laut.',
    'en-US': 'Say the pattern out loud.',
  },
  'count-corners': {
    'de-CH': 'Zähle die Ecken.',
    'en-US': 'Count the corners.',
  },
  'listen-to-the-sound': {
    'de-CH': 'Hör den Laut nochmal und schau die Buchstaben genau an.',
    'en-US': 'Listen to the sound again and look closely at the letters.',
  },
  'first-sound': {
    'de-CH': 'Sprich das Wort langsam. Was hörst du ganz am Anfang?',
    'en-US': 'Say the word slowly. What do you hear at the very beginning?',
  },
  'clap-along': {
    'de-CH': 'Sprich das Wort und klatsche bei jeder Silbe.',
    'en-US': 'Say the word and clap for each syllable.',
  },
  'read-sound-by-sound': {
    'de-CH': 'Lies Laut für Laut und schleife die Laute zusammen.',
    'en-US': 'Read sound by sound, then blend the sounds.',
  },
  'say-the-word-slowly': {
    'de-CH': 'Sprich das Wort langsam. Welchen Laut hörst du zuerst?',
    'en-US': 'Say the word slowly. Which sound comes first?',
  },
} as const satisfies Record<string, Readonly<Record<Locale, string>>>;

export type HintKey = keyof typeof HINTS;
export const HINT_KEYS = Object.keys(HINTS) as HintKey[];
