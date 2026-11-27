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
- **Demos and generators:** each demo is generated in every locale of its track, and the result must show its `target`. Each generator is generated once per locale as a smoke test, so a runtime error becomes a validation issue.

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
| `times-table` | `rows` (e.g. [2, 5, 10]), `mode` product / missing-factor / row (Einmaleins-Reihe), `minFactor`/`maxFactor`, `commute`, `answerMode` (keypad by default) |
| `division-share` | `divisors` (number of plates), `minQuotient`/`maxQuotient`, `objects` (pictures with a plural) |
| `clock` | `steps` hour / half / quarter / five, `labels` words / digital / both, `choices` |
| `money-chf` | `mode` total / pay / compare, `currency` auto (CHF in de-CH, USD in en-US) / CHF / USD, `group` major (Franken, dollars) / minor (Rappen, cents), `minItems`/`maxItems`, `maxTotal` (in units of the group) |
| `trace-letter` | `letters` (A-Z, a-z, Ä Ö Ü ä ö ü, 0-9), `tolerance` (0.5-3), `strictOrder`, `strictDirection`, `showModel` |
| `listen-write` | `words` (pictures with a regular first sound), `extraTiles`, `case`, `maxLength` (2-6) |
| `sentence-picture` | `kind: position` (`subjects`, `objects`, `relations` on/under/next-to) or `kind: count` (`pictures`, `min`/`max` 2-5), `choices` |

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
| `carrier` | grapheme | `M wie Maus` (spoken "Em wie Maus") | `lexicon.carriers` / `digraphs` |

A carrier or digraph is a string, or `{text, speak}` when the TTS needs a spelling for the letter name
(`{text: "M wie Maus", speak: "Em wie Maus"}`). The screen shows `text`; the audio pipeline reads `speak`.
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

## Exercise runtime (generate, check, demos)

The backend generates and checks exercises with this code, and the frontend renders the payload types it defines. Both sides therefore work from the same shapes. Everything is deterministic for a given seed.

```ts
import { createRng, generateRun, generateDemo, parseAnswer, checkAnswer, toPublicExercise, randomSeed } from '@murmeli/content';

const runSeed = randomSeed();                                    // store it with the run (Redis)
const items = generateRun(level, runSeed, { locale, content });  // level.items items, solutions included
const publicItems = items.map(toPublicExercise);                // { index, type, prompt, payload } only
const parsed = parseAnswer(item.type, body.answer);             // zod answerSchema of the type
const result = parsed.success ? checkAnswer(item.solution, parsed.answer) : { correct: false };
// result: { correct: true } or { correct: false, hint: 'make-ten' }
```

- **Randomness:** `createRng(seed)` is mulberry32 with `int`, `bool`, `pick`, `shuffle` (returns a new array), `sample` (without replacement), `weighted` and `id`.
- **Seeds:** `itemSeed(runSeed, levelId, index)` gives each item its own seed, so any item can be replayed from `(runSeed, levelId, index)`. `generateItem` picks the generator by weight and retries a few times so that the same exercise does not come twice in a row.
- **Generated exercises:** `generateExercise(spec, rng, ctx)` returns `{ type, prompt, payload, solution, focus }`. `prompt` comes from `renderPrompt()`, so every speak segment is in the speakables list (a property test checks this). `solution` is `{ answer, hint }`, where `answer` is exactly the correct answer object; the backend reveals it after the second attempt. `focus` is the item asked about (a number, picture id, letter or relation) and is used internally for demos and to avoid repeats.
- **Checking:** `checkAnswer` compares the answer with `solution.answer` by deep equality and returns the hint of the instance when it is wrong.
- **Types:** `Payload<T>`, `Answer<T>` and `Solution<T>` per type id, plus `GeneratedExercise`, `PublicExercise`, `AnyAnswer` and `EXERCISE_RUNTIMES` (with `answerSchema` per type).
- **Choices:** every choice gets an id of 10 random base-36 characters, drawn from the rng. The ids are deterministic per seed but can't be guessed, and the choices are shuffled. Number choices are near the answer and never repeat.

**Demos.** `generateDemo(level, locale, content)` builds a deterministic instance from a seed derived from the level id, and returns the localized steps with it. If the demo has a `target`, the instance asks for it: a number (count, result, next number), a picture id (shape, pattern answer, syllables, word-picture, build-word or initial-sound picture) or a letter. Without a target, picture lists keep their order and the first entry is used. The narration can therefore name the pictures in the order the params list them. `toPublicDemo()` adds the `answer` so that Murmeli can show it.

**Hints.** The `HINTS` table holds short localized hint texts per `HintKey`, such as `touch-each`, `power-of-five`, `crocodile`, `make-ten`, `first-sound` and `clap-along`. They are part of the speakables output (`hint:<key>`).

### Payload shapes

| Type | Payload | Answer |
|---|---|---|
| count-objects | `arrangement`, `objects[{pictureId, x, y}]` (0-1 coordinates), `answerMode`, `choices?` | `{ value }` |
| number-recognition | `mode`, `representation` (`numeral` for hear), `pictureId?`, `choices[{id, value, label}]` | `{ value }` |
| ten-frame | `frame` 10 or 20, `cells: boolean[]` (row-major, 5 per row; the second frame starts at cell 10), `answerMode`, `choices?` | `{ value }` |
| compare | `mode`, `left`/`right`: `{ value }` (numbers) or `{ count, pictureId? }` (quantities) | `{ relation: lt\|gt\|eq }` |
| number-line | `mode`, `start`, `end`, `step`, `labels: number[]`, missing: `markedTick` (tick index) + `choices` | `{ value }` |
| add-sub | `op`, `a`, `b` (null if it is the unknown), `result` (null unless the operand is unknown), `manipulatives`, `pictureId?`, `answerMode`, `choices?` | `{ value }` |
| number-bond | `whole` (null if missing), `rows[{left, right}]` (null = blank), `representation` | `{ values }` in reading order (row by row; the whole comes last) |
| number-wall | `rows`, `cells[{id: "r<row>c<col>", row, col, value \| null}]` (row 0 is the base) | `{ values: { [cellId]: number } }` |
| sequence | numbers: `items: (number\|null)[]`, `answerMode`, `choices?`; pattern: `items[{pictureId}]`, `choices[{id, pictureId}]` | `{ value }` or `{ choiceId }` |
| shape-pick | `choices[{id, pictureId, scale, rotation}]` | `{ choiceId }` |
| letter-sound | `choices[{id, label}]` (label already in the display case) | `{ choiceId }` |
| initial-sound | `pictureId`, `choices[{id, label}]` | `{ choiceId }` |
| syllables | `pictureId`, `maxCount` (drum taps allowed), `word?` (only with `showWord`) | `{ count }` |
| word-picture | `word` (already in the display case), `syllables?`, `choices[{id, pictureId}]` | `{ choiceId }` |
| build-word | `pictureId`, `audio`, `length`, `tiles[{id, letter}]` (shuffled, plus `extraTiles` distractors) | `{ letters }`, case-sensitive and in order |
| times-table | `mode`, `a`, `b`, `product` (null for the unknown); row mode: `row`, `items` with a null gap | `{ value }` |
| division-share | `total`, `groups`, `pictureId`, `answerMode`, `choices?` | `{ value }` (per plate) |
| clock | `hour` (1-12), `minute` for the analog face, `choices[{id, label, digital?}]` | `{ choiceId }` |
| money-chf | total: `items[{denomination, label, kind, file}]`; pay: `amount` + `wallet` (one of each denomination); compare: `left`/`right` purses. Always `currency` and `group` | total `{ value }`, pay `{ coins: denominationId[] }` (any set with the right sum), compare `{ relation }` |
| trace-letter | `char`, `strokes` (model points, see below), `guides`, `showModel` | `{ strokes: [x, y][][] }` (max 6 strokes, 200 points each) |
| listen-write | `length`, `tiles[{id, letter}]` (no picture: the word is only heard; replay = play `prompt.speak` again) | `{ letters }` |
| sentence-picture | `sentence`, `choices[{id, scene}]` with scene `{kind: 'position', subject, relation, object}` or `{kind: 'count', pictureId, count}` | `{ choiceId }` |

**Checks that are not plain equality.** A solution can carry a JSON `rule` that `checkAnswer` uses instead of deep equality. `coin-sum` accepts any coins of the wallet whose values add up to the amount. `trace` scores the drawn strokes (see below). `solution.answer` is still a correct answer that can be shown: the greedy coin set, or the model strokes.

### Stroke format for tracing (`GLYPHS`)

- **Box and guides:** every glyph lives in a 0-100 box with y pointing down. The guide lines are in `GLYPH_GUIDES`: ascender and cap height 10, x-height 45, baseline 80, descender 100.
- **Shape:** a glyph is an ordered list of strokes (at most 6). Each stroke is a polyline `[x, y][]`. Curves are sampled into short segments every 15 degrees. The style is a simple school print close to Basisschrift: round letters start at the top right and go counter-clockwise, lines go top to bottom and left to right.
- **Start and direction:** the first point of a stroke is its start dot, and the point order is its direction. The array order is the stroke order. Dots (on i, j and umlauts) are tiny strokes and are judged as taps.
- **Rendering:** the frontend can draw the model faintly, put a numbered start dot at each stroke's first point, and animate each stroke along its points in order for the demo (`trace` action).
- **Scoring (`scoreTrace`):**
  1. Wrong stroke count gives the hint `stroke-count`.
  2. Each model and drawn stroke is resampled to 32 points by arc length, and their mean point distance is compared, both forward and reversed. A dot is compared by its centre, and the drawing may span at most 20 units.
  3. With `strictOrder: false`, the best matching of drawn to model strokes is used; otherwise the order must match, and the hint is `stroke-order` when another order would have passed.
  4. A stroke passes if its distance is at most `10 × tolerance`. If it only passes reversed and `strictDirection` is set, the hint is `start-at-dot`. Anything else gives `trace-slowly`.
- **What the tests show:** with `tolerance: 1`, tracing with ±3 units of wobble, an offset of up to 4 units and any point density passes for every glyph. Scribbles, and other letters with the same stroke count, fail.

**Money pictures.** `pictures/money/<denomination>.svg` are self-drawn generic coins and notes with the value written on them, with no national symbols. Denominations are listed in `DENOMINATIONS`: CHF 5, 10, 20 and 50 Rp, 1, 2 and 5 Fr. as coins, and 10 and 20 Fr. as notes. USD: 1, 5, 10 and 25¢ as coins, and $1, $5, $10 and $20 as bills. The validator checks that every denomination has a safe SVG.

**Clock phrasing.** `timeWords()` uses Swiss German school phrasing ("halb drei" = 2:30, "Viertel nach drei", "Viertel vor drei", "fünf vor halb vier"). American English uses "half past two", "quarter to three", "twenty-five past five". Digital labels look like `2:30`. Distractors include the typical confusions (the next or previous hour, mirrored minutes, and the "halb" trap).

**Sentences.** `sceneSentence()` builds "Die Maus ist auf dem Bett." (dative article from `article`), "The mouse is on the bed." and "Ich sehe drei Äpfel." / "I see three apples." from picture words. The frontend draws a scene from two pictures and a relation, or from N copies of one picture. All clock labels and sentences are listed by `npm run speakables` (sources `label:clock`, `label:sentence-picture`).

### API shapes and scoring (`api.ts`)

- **Types:** `StartRunResponse` (`{ runId, items, demoSeen, demo?, progress? }`, with `progress` as `RunItemProgress[]` only on a resumed run), `PracticeRunResponse` (the same shape), `AnswerRequest` / `AnswerRequestSchema`, `AnswerResponse` (`{ correct, attempt, hint?, solution? }`), `FinishRunResponse`, and `MapResponse` (tracks, then worlds with `state`, `stars` and `maxStars`, then levels with `state` and `stars`, plus the earned `badges` ids).
- **Shared logic:** `itemScore(correct, attempt)`, `runScore`, `starsFor(score, passRatio)` and `isPassed`, following contract section 3.
- **Constants:** `MAX_ATTEMPTS` and `DAILY_LIMIT_REACHED`.

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
| `math` (de-CH, en-US) | Zahlenwiese (KG1), Formenwald (KG1), Zahlenbach (KG2), Uhrenturm (KG2), Zehnerhütte (1), Plusbrücke (1), Rechenberg (1), Hundertergipfel (2), Märtplatz (2), Einmaleinsalp (2), Uhrenturm-Spitze (2) |
| `reading-de` (de-CH) | Lautwiese (KG2), Silbenwald (KG2), Buchstabenbach (1), Wörterhaus (1), Wörterwerkstatt (1), Schreibwiese (1), Hörwerkstatt (1), Satzgarten (1) |
| `reading-en` (en-US) | Sound Garden (KG2), Syllable Park (KG2), Blending Bay (1), Word Workshop (1), Tracing Trail (1), Listening Lab (1), Sentence Garden (1) |

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
| MA.3.A.1 | Time (clock) and money (uncertain) |
| D.4.A.1 | Handwriting (tracing) |
| D.2.B.1 | Reading sentences (uncertain; could be D.2.A.1) |
| D.1.A.1 | Phonological awareness: initial sounds, syllables |
| D.2.A.1 | Letter knowledge and reading words |
| D.5.E.1 | Building words / spelling (uncertain; could be D.4) |

They should be checked against the official text before the app claims alignment for a world. The English track uses US
Common Core Foundational Skills codes (e.g. RF.K.2d, RF.K.3a), also best effort.
