# @murmeli/content

The Murmeli curriculum as data, plus the TypeScript package that validates it. The backend loads the content and gets the
params schema of each exercise type from here. CI validates it, and the offline TTS pipeline lists every
speakable string with it. The contract this package implements is `docs/internal/learning-engine.md` (sections 1, 2, 5
and 6).

```
content/
  schema/                    TypeScript source: zod schemas, exercise type registry, loader, CLI
  test/                      node:test suites (run directly on the .ts sources)
  tracks/<track>/track.yaml
  tracks/<track>/worlds/NN-<slug>.yaml
  pictures.yaml              picture catalog: id -> file, words, article, plural, syllables, first sound
  pictures/                  SVGs (Noto Emoji subset + Murmeli shapes), LICENSE, NOTICE.md
  lexicon/<locale>.yaml      numbers 0-100, operators, letters, carrier phrases, feedback phrases ...
  dist/                      build output (gitignored)
```

## Commands

```bash
npm ci
npm run validate                          # exit 1 and list every issue (file + path + message)
npm run stats                             # worlds, levels and skills per track and grade (--json)
npm run speakables -- --locale de-CH      # every string a kid can hear (--json for the pipeline)
npm test                                  # all tests
npm run test:cov                          # tests with coverage, fails below 80 %
npm run test:cjs                          # build, then require() the package from CommonJS
npm run lint && npm run format:check && npm run typecheck
npm run build                             # dist/*.js + .d.ts
```

Node 24 runs the TypeScript sources directly (type stripping), so `validate`, `stats`, `speakables` and the tests
need no build step. The code only uses erasable TypeScript syntax and imports with `.ts` extensions;
`tsc` rewrites them to `.js` in `dist/`.

## Using the package

The package is ESM (`"type": "module"`). The CommonJS NestJS backend loads it with `require()` of ESM, which works on Node 24
because nothing in it uses top-level `await`. TypeScript with `module: nodenext` types it correctly from CommonJS.
Jest needs `--experimental-vm-modules` to `require()` it, which the backend's test scripts already pass.

```ts
import { loadContent, parseExerciseParams, renderPrompt, EXERCISE_PARAMS_SCHEMAS } from '@murmeli/content';

const content = loadContent();                  // throws ContentValidationError with all issues
const level = content.index.levels['math-zahlenwiese-01']!.level;
const prompt = renderPrompt(content, 'count-objects', 'main', 'de-CH', { object: 'apple' });
// { text: 'Wie viele Äpfel siehst du?', speak: ['Wie viele', 'Äpfel', 'siehst du?'] }
```

Main exports:

| Export | What it does |
|---|---|
| `loadContent(root?)` | Reads, validates and cross-validates everything. Returns deeply frozen `Content` (`tracks` with worlds sorted by `order`, `pictures`, `lexicons`, `index.{worlds,levels,skills}`), or throws `ContentValidationError` (`.issues`). |
| `validateContent(root?)` | Same, but never throws. Returns `{ issues, content? }`. |
| `CONTENT_ROOT` | This package's folder (the default root). |
| `EXERCISE_TYPES`, `EXERCISE_TYPE_IDS`, `EXERCISE_PARAMS_SCHEMAS` | The registry. Each type has `paramsSchema`, `frames`, `requirements()`, `issues()` and `frameUses()`. |
| `parseExerciseParams(type, raw, { minDistinct? })` | zod parse plus the semantic checks of the type. Returns `{ success, spec }` with defaults applied, or `{ success: false, issues }`. |
| `ExerciseParams<'add-sub'>`, `ExerciseSpec`, `Generator`, `Level`, `World`, `Track`, `Picture`, `Lexicon` ... | Types inferred from the schemas. |
| `enumerateAddSub`, `crossesTen`, `bondCount`, `initialSoundPictures` | Helpers that generators can reuse. Validation uses the same functions. |
| `PROMPT_FRAMES`, `PROMPT_FRAME_SEGMENTS`, `speakSegments`, `renderPrompt`, `resolveSlot` | Prompt frames and the segment model (see below). |
| `collectSpeakables(content, locale)` | Every speakable string with its sources (and `speak` when the spoken form differs, e.g. `7` -> `sieben`). |
| `contentStats`, `checkSvg`, `containsEszett`, all zod schemas | Building blocks. |

## Content model

- **Track** (`track.yaml`): `id` (must match the folder), `order`, `locales`, `title`, `icon`.
- **World** (`worlds/NN-slug.yaml`, and `order` must equal `NN`): `id`, `grade` (`KG1`, `KG2`, `1`, `2`; never decreasing
  within a track), `requires` (world ids), `title`, `scene`, `skills`, `levels`.
- **Skill**: dotted `id`, `title`, and a reference: `lp21` (Lehrplan 21 code, e.g. `MA.1.A.2`) or `ccss` (US Common Core,
  used by the English phonics track).
- **Level**: `id` (`<world-id>-NN`), `title`, `skill`, `items` (3-20, default 6), `passRatio` (default 0.8), `demo`, and
  `generators` (`{ type, weight, params }`).
- **Demo** ("Zeig mir"): `exercise: { type, params }`, an optional `target` (the answer the demo shows: a number, picture id or letter
  that appears in the params), and 2-4 `steps`. Each step has `say` (localized) and one `action`: `highlight: <target>`,
  `countAlong`, `hop`, `clap`, `placeTiles`, `fillBlank` or `tapAnswer`. Demo params may describe a single instance
  (`a: { min: 2, max: 2 }`), because demos are checked with `minDistinct: 1`. When the params pin the instance, generators
  should keep the given picture order, so the narration matches what is on screen.
- **LocalizedText**: `{ de-CH?, en-US? }`. It needs every locale of its track, and de-CH never contains the sharp s.

### Validation rules

The validator reports every problem at once, as `file: path: message`:

- **Schemas:** unknown keys are errors (strict objects), and all values are checked against their zod schema.
- **Ids:** track, world, level and skill ids are unique across all content. Level ids start with their world id.
- **Requirements:** each `requires` entry points to an existing world, never itself, and has no cycles. A required world in the same track has a lower `order`.
- **Skills:** each level's skill is defined in its world, and every skill is used by at least one level.
- **Exercises:** generator and demo params are valid for their type, including feasibility, e.g. an add-sub setting must allow at
  least 3 distinct problems, and `choices` can't exceed the options.
- **Pictures and letters:** referenced pictures exist and have the fields needed in **every locale of the track** (word, plural for counting,
  syllables, regular first sound, article for `der Kreis`). Letters have a carrier phrase in the lexicon. Every
  prompt slot value can be spoken in each locale.
- **Picture catalog:** the file is `<id>.svg` and exists, and no SVG is left unlisted. German words are capitalized and have an article. English words are lowercase.
  Syllables spell the word, and the word starts with its first-sound grapheme.
- **SVG safety:** downloaded SVGs are untrusted. Each must have an `<svg>` root and must not contain a DOCTYPE, entities,
  `<script>`, `<foreignObject>`, embedding or link elements, event handler attributes, `javascript:` or `data:` URLs,
  `@import`, or any `href`/`url()` that is not a `#fragment`. Files are limited to 256 KB.
- **Sharp s:** a raw-text scan of every YAML file, plus the LocalizedText check.

## Exercise types

| Type | Key params |
|---|---|
| `count-objects` | `min`/`max` (0-20), `objects` (pictures with a plural), `arrangement` line/dice/scattered/ten-frame, `choices`, `answerMode` |
| `number-recognition` | `min`/`max` (0-100), `mode` hear (tap the numeral) or match-quantity, `representation` dots/ten-frame/fingers/objects |
| `ten-frame` | `min`/`max`, `frame` 10 or 20, `fill` ordered (Kraft der Fünf) or scattered |
| `compare` | `mode` quantities (max 10) or numbers, `min`/`max`, `allowEqual`, `maxDifference` |
| `number-line` | `mode` place or missing, `start`/`end`, `step` 1/2/5/10 (4-20 steps), `labels` all/ends/tens/none |
| `add-sub` | `operations`, `max`, optional `a`/`b` ranges, `aMultipleOf`/`bMultipleOf` (1 or 10), `crossTen` never/allowed/always (carry/borrow), `allowZero`, `unknown` result/operand, `manipulatives` none/objects/ten-frame/twenty-frame |
| `number-bond` | `min`/`max` of the whole, `rows` (floors of the Zahlenhaus), `missing` part/whole/mixed, `allowZero`, `representation` |
| `number-wall` | `rows` 2 or 3, `max` (top brick), `blanks`, `blankPosition` top (adding only) or any (needs subtraction) |
| `sequence` | `kind: numbers` (`min`, `max`, `step`, `direction`, `length`, `ask` next/before/missing) or `kind: pattern` (`pictures`, `unit` AB/AAB/ABB/ABC/AABB) |
| `shape-pick` | `shapes` (pictures tagged `shape`), `choices`, `varySize`, `varyRotation` |
| `letter-sound` | `letters` (targets), `distractors`, `choices`, `display` upper/lower/pair |
| `initial-sound` | `letters` (targets with at least one regular picture), `distractors`, optional `pictures` pool, `choices` |
| `syllables` | `pictures` (with syllables), `maxSyllables`, `showWord` |
| `word-picture` | `words` (picture ids), `choices`, `case` upper/natural, `showSyllables` |
| `build-word` | `words`, `extraTiles`, `audio` (say the word) or picture only, `case`, `maxLength` |

Graphemes are written capitalized (`M`, `Sch`, `Ei`, `Sh`). The display case is a param.

## Prompt frames and audio segments

Prompts are assembled from pre-rendered clips, never synthesized at runtime. Each exercise type defines its frames in
`PROMPT_FRAMES`, a `speak` template per locale plus an optional `display` template:

```
count-objects.main   de-CH "Wie viele {plural:object} siehst du?"    en-US "How many {plural:object} do you see?"
letter-sound.main    de-CH speak "Hör gut zu: {carrier:target}. Welcher Buchstabe passt?"
                           display "Welcher Buchstabe passt?"        (the screen must not give the answer away)
```

A placeholder is `{kind:name}`. The kind decides where the words come from, so every possible value is enumerable:

| Kind | Value | Text | Comes from |
|---|---|---|---|
| `number` | 0-100 | `"7"` (spoken "sieben") | `lexicon.numbers` |
| `word` / `plural` | picture id | `Maus` / `Äpfel` | `pictures.yaml` |
| `the-word` | picture id | `der Kreis` / `the circle` | article + word |
| `carrier` | grapheme | `M wie Maus` | `lexicon.carriers` / `digraphs` |
| `letter` | grapheme | `M` (spoken "Em") | `lexicon.letters` |

`speakSegments()` splits a template at its placeholders. Text pieces are trimmed, leading punctuation is dropped, and pieces
without letters or digits are left out. `"Wie viel ist {number:a} plus {number:b}?"` becomes
`["Wie viel ist", {a}, "plus", {b}]` (precomputed in `PROMPT_FRAME_SEGMENTS`). `renderPrompt()` fills the slots and returns
`{ text, speak }`. `speak` is the list of manifest texts that the player plays one after the other.

Each type's `frameUses(params, ctx)` returns the frames a generator with those params can use, with all possible values for each
slot (`add-sub` enumerates its actual problems). `collectSpeakables()` combines that for every generator and demo with
track, world and level titles, demo sentences and the lexicon. The validator checks that every slot value resolves, and a
test renders prompts from all real generators and asserts that each segment is in the speakables list. A generator
that uses `renderPrompt()` can therefore only produce clips that are on the list.

**For the TTS pipeline:** use `npm run speakables -- --locale <locale> --json` as the source of truth
(`[{ text, speak?, sources }]`). Its generic YAML extractor only sees mappings with both `de-CH` and `en-US`, so it misses
everything in the single-locale reading tracks and all prompt segments, which live in TypeScript. `lexicon/*.yaml` is a
superset of `tools/audio/lexicon/*.yaml` (same keys and texts). It starts with `speak: false` so that the generic
extractor skips it, while the lexicon extractor reads it unchanged.

## How to

**Add a level:** append it to the world's `levels` with the id `<world-id>-NN`, a skill of that world, a demo with 2-4 short
steps, and at least one generator. Run `npm run validate`.

**Add a world:** create `tracks/<track>/worlds/NN-slug.yaml` with `order: NN`, a grade not lower than the previous world,
`requires` (usually the previous world), skills with `lp21`/`ccss` references, and 5-8 levels. Titles and `say` need every
locale of the track.

**Add a picture:**
1. Download the SVG into `pictures/<id>.svg` (Noto: `2D/svg/emoji_u<codepoint>.svg` at the pinned commit), or draw one.
   Strip editor metadata if `npm run validate` reports the file as unsafe, and note any change in `pictures/NOTICE.md`.
2. Add an entry to `pictures.yaml`: `file`, `source`, `tags`, `words`, `article` (German), `plural` (only for things kids
   count), `syllables`, `firstSound` (`grapheme`, `phoneme`, `regular: false` when the spelling or the name is ambiguous,
   e.g. Vogel /f/, owl, giraffe).
3. Only add words you are sure a 4-8 year old uses for that picture (Swiss Standard German: Velo, Ballon, Fuss).

**Add an exercise type:** define it with `defineExerciseType` in `schema/exercises/`, register it in `registry.ts`, and
add accept/reject cases to `test/exercises.test.ts`. The backend generator and the frontend component must follow, as described in the contract.

## Pictures and licensing

`pictures/` holds a curated subset of 105 **Noto Emoji** SVGs (Apache-2.0, © Google). The full license text is in `pictures/LICENSE`,
and the attribution and the list of modified files are in `pictures/NOTICE.md`. Downloads are pinned to commit
`9411589157168199e31fab898cb64ea633b6b81a`. The four `shape-*` pictures were drawn for Murmeli. The frontend serves the SVGs
(the contract places them in `frontend/public/pictures/`) by copying them from here. This folder is the source of truth.

## Curriculum

| Track | Worlds (grade) |
|---|---|
| `math` (de-CH, en-US) | Zahlenwiese (KG1), Formenwald (KG1), Zahlenbach (KG2), Zehnerhütte (1), Plusbrücke (1), Rechenberg (1), Hundertergipfel (2) |
| `reading-de` (de-CH) | Lautwiese (KG2), Silbenwald (KG2), Buchstabenbach (1), Wörterhaus (1), Wörterwerkstatt (1) |
| `reading-en` (en-US) | Sound Garden (KG2), Syllable Park (KG2), Blending Bay (1), Word Workshop (1) |

The Zehnerhütte (ten-frame and Zahlenhaus) comes before the Plusbrücke, because structured quantities and splitting
numbers are the basis of the addition strategies taught in 1st class. Formenwald has no `requires`, so it is open from the start.

**Lehrplan 21 references are best effort ("aligned with", not official).** Codes used:

| Code | Used for |
|---|---|
| MA.1.A.1 | Counting, reading and ordering numbers |
| MA.1.A.2 | Adding and subtracting |
| MA.1.B.1 | Number relations: number bonds, number walls |
| MA.1.C.1 | Representations: ten-frame, number line |
| MA.2.A.1 | Shapes |
| MA.2.B.1 | Picture patterns (uncertain; could also be MA.1.B.1) |
| D.1.A.1 | Phonological awareness: initial sounds, syllables |
| D.2.A.1 | Letter knowledge and reading words |
| D.5.E.1 | Building words / spelling (uncertain; could be D.4) |

They should be checked against the official text before the app claims alignment for a world. The English track uses US
Common Core Foundational Skills codes (e.g. RF.K.2d, RF.K.3a), also best effort.
