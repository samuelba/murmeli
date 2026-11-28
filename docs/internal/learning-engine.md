# Learning engine and content contract (milestone 3)

Three components share this contract: `content/` (the data), `backend/src/modules/learning` (generation, checking and progress), and `frontend/src/app/learn` (the player). Change all three together.

## 1. Content layout
```
content/
  schema/                 zod schemas + loader + validator CLI (TypeScript, used by backend + CI)
  tracks/<track-id>/track.yaml
  tracks/<track-id>/worlds/<NN>-<slug>.yaml
  pictures.yaml           picture catalog: id → { file, words: { de-CH, en-US } }
```
**Tracks:**
- `math` is shared and has both `locales: [de-CH, en-US]`.
- `reading-de` has `locales: [de-CH]`. It follows the initial-sound chart order used in schools, and its handwriting reference is Basisschrift.
- `reading-en` has `locales: [en-US]` and follows the phonics order s a t p i n m d g o c k e u r h b f l j v w x y z qu.
- A kid only sees the tracks that include their `language`.

**`LocalizedText`:** `{ de-CH?: string, en-US?: string }`. It must have a value for every locale the track lists, and de-CH values may not contain ß. The validator enforces both.

### `track.yaml`
```yaml
id: math
order: 1
locales: [de-CH, en-US]
title: { de-CH: Mathematik, en-US: Math }
icon: math            # brand icon id
```

### `worlds/NN-slug.yaml`
```yaml
id: math-zahlenwiese             # globally unique, stable forever (progress references it)
order: 1
grade: KG1                       # KG1 | KG2 | 1 | 2 – used for start-class placement
requires: []                     # world ids that must be completed first
title: { de-CH: Zahlenwiese, en-US: Number Meadow }
scene: meadow                    # landscape on the trail map, see SCENES in frontend/src/app/learn/map/scene.ts
skills:
  - id: math.count.to5           # stable; mastery is tracked per skill
    lp21: MA.1.A.1               # Lehrplan 21 competency reference (informational)
    title: { de-CH: Zählen bis 5, en-US: Counting to 5 }
levels:
  - id: math-zahlenwiese-01      # stable
    title: { de-CH: Zählen bis 3, en-US: Counting to 3 }
    skill: math.count.to5
    items: 6                     # exercises per run
    passRatio: 0.8               # ≥ → 2 stars (level passed); 1.0 → 3 stars; ≥0.5 → 1 star
    demo:                        # "Zeig mir": an animated walk-through before the first run
      exercise: { type: count-objects, params: { min: 2, max: 2, objects: [apple] } }
      steps:
        - say: { de-CH: "Schau, hier sind Äpfel.", en-US: "Look, here are some apples." }
          action: { highlight: objects }
        - say: { de-CH: "Wir zählen: eins, zwei.", en-US: "Let's count: one, two." }
          action: { countAlong: true }
        - say: { de-CH: "Es sind zwei. Tippe auf die Zwei!", en-US: "There are two. Tap the two!" }
          action: { tapAnswer: true }
    generators:                  # weighted mix; params validated by the exercise type's schema
      - { type: count-objects, weight: 1, params: { min: 1, max: 3, objects: [apple, star, ball] } }
```

## 2. Exercise types
Each exercise type is a pair: a backend module (`params` schema, `generate`, `check`) and a frontend component that renders it. Type ids are kebab-case.

```ts
interface ExerciseType<P, Payload, Answer, Solution> {
  id: string
  paramsSchema: ZodType<P>
  generate(rng: Rng, params: P, locale: Locale): { prompt: Prompt; payload: Payload; solution: Solution }
  check(solution: Solution, answer: Answer): { correct: boolean; hint?: HintKey }
  answerSchema: ZodType<Answer>          // validates what the client sends
}
interface Prompt {
  text: string                           // already localized, shown on screen
  speak: string[]                        // segments played in order; each is a manifest text (see §5)
}
```
**Extensions agreed during content authoring:**
- A demo may set `target`, the answer it shows.
- A demo exercise may pin a single instance. Generators still need at least 3 distinct problems.
- Prompts are rendered with `renderPrompt()` from `@murmeli/content`, which returns `{ text, speak[] }`. Every possible segment can be listed with `npm run speakables -- --json`.

**Runtime implementation:** the generators, the checkers and all payload, answer and API types live in `@murmeli/content` (`schema/runtime/`, `schema/api.ts`). The backend generates and checks with them, and the frontend imports only the types.
- **Solution:** `Solution = { answer, hint }`. `AnswerResponse.solution` reveals `answer`.
- **Answer details:**
  - `sequence` answers `{ value }` for number sequences and `{ choiceId }` for patterns.
  - `number-wall` cell ids are positional (`r<row>c<col>`).
  - `number-bond` values go row by row, with the whole last.
  - `build-word` compares letters case-sensitively and in order.
- **Additions to the response shapes:** `StartRunResponse.demo?` carries the demo instance, its revealed answer and the localized steps. `MapWorld` has `stars` and `maxStars`.
- **Hidden answers on screen:** the displayed text never gives the answer away. For example, number-recognition in "hear" mode shows "Welche Zahl hörst du?", and syllables doesn't show the word. The spoken prompt is unchanged.

**Determinism:** `rng` is a seeded PRNG (mulberry32) passed in by the caller, so a run can be replayed from `(seed, levelId)`. **Security:** solutions stay on the server, and the client gets only `prompt` and `payload`.

**Variety:** `exerciseKey(exercise)` (`runtime/variety.ts`) hashes what the kid sees as one question: the type, the spoken prompt, and the payload without random ids, positions, rotation, scale, distractor `choices` and tile order. `generateRun` and `generatePracticeItem` (both via `generateVaried`) retry an item up to 12 times with derived seeds until its key is new to the run; when the pool is too small they take one that was not among the last two items and has a new focus. Each `GeneratedItem` carries `key` and `source: { levelId, generator, seed, topic? }`, and `regenerateExercise(levels, source, options)` makes the very same exercise again (used for the mistakes asked again later).

**First set of types (milestone 3/4):**

| id | Track | What the kid does | Answer |
|---|---|---|---|
| `count-objects` | math | Counts pictures and taps the matching number | `{ value: number }` |
| `number-recognition` | math | Hears or sees a number and taps it among choices | `{ value }` |
| `ten-frame` | math | Reads a quantity from a Zehnerfeld or Zwanzigerfeld and taps it | `{ value }` |
| `compare` | math | Two quantities: taps the side with more, or "the same". Two numbers: taps <, > or =, drawn as a crocodile | `{ relation: "lt"\|"gt"\|"eq" }`, left to right (tapping the left side sends `gt`) |
| `number-line` | math | Finds or places a number on a number line | `{ value }` |
| `add-sub` | math | Solves a + b or a − b, with optional objects or a ten-frame | `{ value }` |
| `number-bond` | math | Fills the missing part in a Zahlenhaus | `{ values: number[] }` |
| `number-wall` | math | Fills empty bricks in a Rechenmauer | `{ values: Record<cellId, number> }` |
| `sequence` | math | Says what comes next (numbers or patterns) | `{ value }` or `{ choiceId }` |
| `shape-pick` | math | Taps the named shape | `{ choiceId }` |
| `letter-sound` | literacy | Hears a sound and taps the letter | `{ choiceId }` |
| `initial-sound` | literacy | Sees a picture, hears the word, and taps its first letter (Anlaut) | `{ choiceId }` |
| `syllables` | literacy | Hears a word and taps the drum once per syllable | `{ count }` |
| `word-picture` | literacy | Reads a word and taps the matching picture | `{ choiceId }` |
| `build-word` | literacy | Builds a word from letter tiles for a picture or audio | `{ letters: string[] }` |

**Later:** `trace-letter` (canvas tracing in Basisschrift, milestone 5), `clock`, `money-chf`, `times-table`, `listen-write`, `sentence-question`.

**Choices:** every multiple-choice payload carries `choices: { id, label?, pictureId?, value? }[]`, in shuffled order. Choice ids are random per instance, so they can't be guessed.

## 3. Runs, scoring, unlocking
1. **Start a run:** `POST /api/learn/levels/:levelId/runs` (KidGuard) returns `{ runId, items: [{ index, type, prompt, payload }], demoSeen }`.
   - The run state (seed, locale, solutions, the public items, attempts, and per item its `key`, `source`, practice `topic` and `tier`, the step on the topic's ladder) lives in Redis under `run:<runId>` with a 2h TTL from the start. Only one run per kid is active at a time; starting a run of another level (or practice topic) replaces it.
   - **Resume:** if the kid's active run is for the same level (or the same practice topic, or "Murmeli wählt") and the kid's current language, starting it again returns that run instead: the same `runId` and items, `demoSeen: true`, and `progress: [{ attempts, correct }]` per item. The daily limit is checked first, as for a new run. A stored run with an exercise type the server no longer knows is replaced by a new one. Run states before `v: 3` (the practice ground) are no longer read, so a run that is in progress during the upgrade is lost once. The frontend continues at the first open item (on its second try if one was used), or finishes the run when every item is done. So a reload, a closed app or **Stop** followed by the same level does not start over.
2. **Answer:** `POST /api/learn/runs/:runId/answers` with `{ index, answer }` returns `{ correct, attempt, hint?, solution? }`.
   - A kid gets 2 attempts per item.
   - After a wrong first attempt the response carries a `hint`, a key that the frontend shows as a step-by-step hint.
   - After the second attempt, `solution` is revealed so it can be shown gently.
   - In a practice run, a missed item (both attempts wrong) is appended once more at the end of the run and returned as `repeat` (`again: 'repeat'`, at most 2 per run, never a repeat of a repeat). Repeats count as learning time, but not for the score, mastery or the topic rating.
   - Every answer is also persisted to the `attempts` table.
3. **Finish:** `POST /api/learn/runs/:runId/finish` returns `{ score, stars, passed, unlocked: { levels: string[], worlds: string[] }, newBadges: string[] }`.
   - Item score: 1 if correct on the first try, 0.5 if correct on the second, 0 otherwise. `score` is the mean.
   - Stars: 3 if score = 1, 2 if score ≥ passRatio, 1 if score ≥ 0.5, else 0. `passed` = stars ≥ 2.
   - `level_progress` keeps the best stars and score. Every run updates the skill mastery, and keeps every item not right on the first try as a mistake to ask again (§9). A practice run also returns `practice: { topics: [{ id, title, levelBefore, level, maxLevel }], reviewsSolved, reviewsSaved }`.
4. **Unlocking:**
   - The first level of a world unlocks when every world in its `requires` list is completed (all levels passed). The levels after it unlock in order, each once the one before it is passed.
   - **Start-class placement:** worlds whose `grade` is below the kid's `startClass` count as completed for `requires`, and all their levels are unlocked. They are still playable but don't need to be played.
   - **Testing flag:** with `LEARNING_UNLOCK_ALL=true`, `ProgressService.statesOf` turns every `locked` state into `unlocked`. This affects the map, `levelAccess`, practice and the parent view. `unlocked` in the finish response stays empty, and `passed`, stars and badges work as usual. `validateEnv` refuses the flag in production.
5. **Practice:** `GET /api/learn/practice` lists the practice ground, and `POST /api/learn/practice/runs` with `{ topic? }` starts a run on one topic, or "Murmeli wählt" without a topic. Both are described in §9. Practice runs update mastery and the topic rating, but not stars.
6. **Mastery:** after each run, mastery = 0.7·previous + 0.3·run score. Spacing uses Leitner boxes with intervals of 1, 2, 4, 8 and 16 days. A skill moves up a box if the score is at least 0.8 and back to box 1 if it is below 0.5.
7. **Read endpoints:**
   - `GET /api/learn/map` (KidGuard) returns the tracks, then worlds, then levels, each with its state (`locked`, `unlocked`, `passed` or `skipped`) and stars, all localized for the kid, plus `badges`: the ids of the kid's earned badges (oldest first).
   - `GET /api/parent/kids/:id/progress` (ParentGate) gives the parent dashboard data.
8. **Time limit:** `daily_activity` adds up the run durations. When `dailyLimitMinutes` is reached, starting a run returns `403 DAILY_LIMIT_REACHED`, and the frontend shows the sleeping marmot.

## 4. Database (milestone 3 migration)
| Table | Columns |
|---|---|
| `level_progress` | `(kid_id, level_id)` PK, `stars` smallint, `best_score` real, `runs` int, `first_passed_at`, `updated_at` |
| `skill_mastery` | `(kid_id, skill_id)` PK, `mastery` real, `box` smallint, `next_review_at`, `updated_at` |
| `attempts` | `id`, `kid_id`, `run_id`, `level_id` (null in practice), `skill_id`, `exercise_type`, `item_index`, `attempt` smallint, `correct` bool, `duration_ms` int, `mode` (`level` or `practice`), `created_at`. Indexed on `(kid_id, created_at)`. |
| `daily_activity` | `(kid_id, day date)` PK, `seconds` int, `runs` int |
| `kid_badges` | `(kid_id, badge_id)` PK, `earned_at` |
| `practice_topic_progress` | `(kid_id, topic_id)` PK, `rating` double, `path_step` smallint, `runs`, `items`, `first_try` int, `accuracy` double (null until practiced), `demo_seen_at`, `last_practiced_at`, `updated_at` |
| `practice_daily` | `(kid_id, topic_id, day date)` PK, `items`, `first_try` int. Indexed on `(kid_id, day)`. |
| `practice_reviews` | `id`, `kid_id`, `topic_id`, `locale`, `item_key` (unique per kid), `level_id`, `generator` smallint, `seed` bigint, `source_topic`, `tier`, `box` 0–2, `misses`, `due_at`, `created_at`, `updated_at`. Indexed on `(kid_id, topic_id, due_at)`. |

Every kid foreign key has `ON DELETE CASCADE`. Content ids are stored as text and are not foreign keys, because the content lives in files.

## 5. Audio lookup
- The TTS pipeline writes `manifest.json`, which maps each text to an Opus file for every locale (see `tools/audio`).
- The frontend loads the manifest for the kid's locale once and builds a map from text to file.
- `prompt.speak` is a list of segments that already exist in the manifest. Generators build prompts from the lexicon frames and numbers, for example `["Wie viel ist", "7", "plus", "5", "?"]`. The frontend plays the segments back to back, with a 120 ms gap between them.
- If a segment has no clip, the player shows the text, quietly skips the audio and logs it in dev mode. There is no speech-synthesis fallback in production.
- The `content` validator lists every `say` and prompt frame so the TTS `extract` step can find them.

## 6. Pictures
`content/pictures.yaml` maps picture ids (`apple`, `mouse`, `sun`…) to SVG files in `content/pictures/`, plus the word for each picture in every locale. The frontend copies the SVGs into `public/pictures/` with a sync script, the same way it copies the brand assets. Literacy exercises take their words from there. The first pictures are a curated subset of **Noto Emoji** SVGs (Apache-2.0), self-hosted, with the license file shipped next to them. Custom illustrations can replace them later.

## 7. Backend decisions (milestone 3)
- **Errors:**
  - Starting a run: `403 LEVEL_LOCKED`, `404 LEVEL_NOT_FOUND` (also for a level in another language's track), `403 DAILY_LIMIT_REACHED`.
  - Practice: `409 NOTHING_TO_PRACTICE` (no open topic), `404 TOPIC_NOT_FOUND` (a topic the kid's tracks don't train), `403 TOPIC_LOCKED`. An unknown topic id is a `400 VALIDATION_FAILED` from the DTO.
  - Answers: `409 ITEM_DONE`, and `409 RUN_BUSY` for a concurrent duplicate answer.
  - Unknown, finished or foreign runs: `404 RUN_NOT_FOUND`.
  - Run starts and answers are limited per kid. Going over the limit returns `429 LEARN_RATE_LIMITED` with `Retry-After`.
- **Demo seen:** stored in `level_progress.demo_seen_at` (levels) or `practice_topic_progress.demo_seen_at` (practice topics) and set when a run starts. Level runs and topic runs always include `demo`, and `demoSeen` means it was seen before this run. The frontend auto-plays the demo only when `demoSeen` is false.
- **Redis keys:** `murmeli:run:<runId>` and `murmeli:run-active:<kidId>`. If saving a finish fails, the run is restored so the finish can be retried.
- **Mastery:**
  - The first run sets mastery to its score; later runs use the 0.7/0.3 average.
  - A new skill starts in Leitner box 1.
  - Only skills with at least one answer are updated, so leaving early doesn't count against the kid.
- **Practice:**
  - Topics, steps, mistakes and "Murmeli wählt" are described in §9. A topic run has 10 items (plus up to 2 repeats), a mix 9 to 12.
  - Finishing a practice run returns feedback stars (against a pass ratio of 0.8) with `passed: false`, and never stores stars.
- **Time:**
  - Answer durations are measured on the server, capped at 5 minutes per answer and 86,400 seconds per day.
  - The day boundary uses `APP_TIMEZONE`, default Europe/Zurich.
  - The daily limit is only checked when a run starts or is resumed, not on answers.
- **Badges:** `first-level`, `first-world`, `star-collector` (5 levels with 3 stars) and `first-practice`.
- **Parent progress:** `GET /api/parent/kids/:id/progress` returns `ParentProgressResponse`, defined in `backend/src/modules/learning/parent/parent-progress.types.ts`. It should move into `content/schema/api.ts` once the parent dashboard uses it.
- **Database:**
  - `best_score` and `mastery` are `double precision`.
  - `attempts` is append-only for the runtime role, with a unique key on `(run_id, item_index, attempt)`.
  - Attempts older than `ATTEMPTS_RETENTION_DAYS` (default 365) are deleted in batches. Progress views never read `attempts`.
  - `NOTHING_TO_PRACTICE` only happens when no open level has a generator, which valid content rules out.

## 8. Milestone 5 additions (content runtime)
- **New types:**
  - `times-table` and `division-share`.
  - `clock`, with Swiss phrasing ("halb drei" = 2:30, "Viertel nach/vor") and digital labels like `2:30`.
  - `money-chf`: its `currency` is `auto`, which means CHF for de-CH and USD for en-US.
  - `trace-letter`, with stroke data in a 0–100 box. The format is in content/README.md.
  - `listen-write` and `sentence-picture`.
- **`Solution.rule`:** optional, either `coin-sum` or `trace`. `checkAnswer` then evaluates the answer instead of comparing it exactly. Any coin set with the right sum is correct, and tracing is scored with tolerance.
- **Hints:** 10 new keys (for example `stroke-count`, `stroke-order`, `start-at-dot`, `trace-slowly`).
- **Speakables:** a type can list extra speakable strings (clock times, sentences).
- **Demos:** new actions `trace` and `placeCoins`. New highlight targets: clock, money, plates, sentence and canvas.
- **Validation:** the validator generates every demo in each locale of its track and checks it shows its `target`. It also runs every generator once.

## 9. Practice ground
- **Topics** (`content/schema/practice/topics.ts`): 24 topic ids, each with a localized title (a speakable). `narrowSpec(spec, topic)` returns the part of a generator that trains a topic: a mixed `add-sub` generator is split into its plus and minus parts, `sequence` is `sequence` (numbers) or `patterns` (pictures), every other type maps to one topic. `topicOfExercise` classifies a generated item.
- **Ladders** (`practice/ladder.ts`): `practiceLadders(tracks)` gives each topic its steps, one per level that trains it, in track, world and level order. `practiceDemoLevel(ladder, step)` picks the nearest level at or below the step whose demo needs no narrowing; the validator requires one per topic and track, and smoke-generates every narrowed generator.
- **Reach** (`backend/.../practice/adaptive.ts`): a topic is `open` once a level of it is open, and reaches `PRACTICE_AHEAD_STEPS` (2) more steps in open worlds or the worlds just ahead (locked worlds whose `requires` are all open). Without an open step it is `ahead` when its first steps lie in such worlds, else `locked`.
- **Rating:** a float per kid and topic, its integer part is the step. A new topic starts at the highest passed step + 0.5; when the trail passes a higher step later (`path_step` grew), the rating is lifted to it. After a run, `rating += K · Σ(score − expected)` over the scored items, where `score` is 1 for a first-try answer and 0 otherwise (second tries don't count as partial credit), with `expected = σ(1.4 + 1.5 · (rating − tier − 0.5))` (0.8 in the middle of the own step) and `K` 0.8 for the first 2 runs, then 0.4; clamped to `[0, maxStep + 0.99]`. `accuracy` is a 0.7/0.3 average of the first-try ratio.
- **Topic run:** 10 items. Up to 3 due mistakes of the topic, then `planSteps`: one warm-up from the step below (from step 2 up), the own step, and 1–3 stretch items from the next step (more the higher the fraction of the rating), spread towards the end. Mistakes are interleaved, never first. `practice` in the response is `{ topic, level, maxLevel }` (1-based).
- **"Murmeli wählt":** the 3 open topics with the highest `mixPriority` (3 per due mistake up to 9, staleness up to 2 after 7 days, weakness `2 · (1 − accuracy)`, 1 for never practiced, plus a seeded jitter up to 0.75), 9 new items at each topic's own step, round-robin (`ceil(9 / topics)` rounds, so fewer open topics get more items each), plus up to 3 due mistakes of any open topic. No demo; `practice` is `{ topic: null, level: 0, maxLevel: 0 }`. The finish counts every answered topic in `practice_daily`, but rates (and counts a run for) only topics with at least one new item; a topic seen only through due mistakes keeps its rating and is not listed in `practice.topics`. A resumed run rebuilds `practice` and the demo from the stored start values, without planning.
- **Mistakes** (`practice_reviews`): every scored item (level or practice) answered right on the first try moves an existing, due mistake with its key up a box (due again after 1, then 3 days; the third right answer deletes it). Every scored item not right on the first try is upserted with box 0, due now, `misses + 1`. Only the kid's current language is served; at most 20 per topic and language are kept (the most recently changed, ordered by `clock_timestamp()` so two finishes that waited on the kid lock keep the later mistakes). A mistake whose regenerated exercise no longer has its key (the content changed) or whose level left the kid's tracks is deleted when it would be served. If making it again throws, the error is logged and the mistake is kept (`regenerateExercise` throws generator errors and returns undefined only for a missing level or generator). A review's tier is re-read from the current ladder.
- **Parent view:** `practice: { topics, days }` in `ParentProgressResponse`: per topic practiced or with open mistakes the step, all-time and 14-day counts, the last practice and up to 5 open mistakes as `{ question, answer, misses, dueAt }` (`spokenQuestion` and `answerText` from the content package), plus 14 days of practice counts.
