# Curriculum and progression

## Lehrplan 21, Zyklus 1
The Swiss Lehrplan 21 groups the two kindergarten years and the 1st and 2nd class into Zyklus 1. That is the range Murmeli covers, from no prior knowledge to the end of 2nd class.

Murmeli is **aligned with** Lehrplan 21, not affiliated with it or endorsed by it. Each skill carries a reference to a Lehrplan 21 competency (for example `MA.1.A.1`) to show where it fits. The references are a best effort and informational only; some are marked as uncertain in the content notes and still need to be checked against the official text. The English phonics track follows the US order of teaching letters and uses US Common Core Foundational Skills codes (for example `RF.K.2d`) instead.

German texts use Swiss spelling ("ss" instead of the sharp s) and Swiss words where kids use them (Velo, Ballon). Math uses the Swiss teaching tools: Zehnerfeld and Zwanzigerfeld, Zahlenhaus, Rechenmauer and Zahlenstrahl.

## Tracks and worlds
A **track** is a subject. A kid only sees the tracks of their learning language:

| Track | Languages | Content |
|---|---|---|
| `math` (Mathematik / Math) | de-CH and en-US | shared by both languages |
| `reading-de` (Lesen und Schreiben) | de-CH | sounds and letters in the order of the initial-sound charts used in Swiss schools, syllables, reading and building words |
| `reading-en` (Reading and Phonics) | en-US | phonics in the order s a t p i n m d g o c k e u r h b f l j v w x y z qu, syllables, reading and spelling short words |

Each track is a trail of **worlds**, and each world has 6 to 8 **levels**. Every level practices one skill with a mix of exercise types. The tables below are generated from `content/tracks/*/worlds/*.yaml`. "Class" is the class a world is meant for and drives the [start-class placement](#start-class-placement).

### math

| # | World | Class | Opens after | Levels | Skills | Exercise types | Reference |
|---|---|---|---|---|---|---|---|
| 1 | Zahlenwiese (Number Meadow) | KG1 | open from the start | 7 | Counting to 5; Counting to 10; Numbers to 10 | `count-objects`, `number-recognition` | MA.1.A.1 |
| 2 | Formenwald (Shape Forest) | KG1 | open from the start | 7 | Recognizing shapes; Continuing patterns | `shape-pick`, `sequence` | MA.2.A.1, MA.2.B.1 |
| 3 | Zahlenbach (Number Brook) | KG2 | Zahlenwiese | 7 | Comparing amounts and numbers; Counting on and back; Number line to 20 | `compare`, `sequence`, `number-line` | MA.1.A.1, MA.1.C.1 |
| 4 | Zehnerhütte (Ten Hut) | 1st | Zahlenbach | 7 | Ten-frame and twenty-frame; Number bonds to 10 | `ten-frame`, `number-bond` | MA.1.C.1, MA.1.B.1 |
| 5 | Plusbrücke (Plus Bridge) | 1st | Zehnerhütte | 7 | Adding within 10; Subtracting within 10 | `add-sub` | MA.1.A.2 |
| 6 | Rechenberg (Calculation Mountain) | 1st | Plusbrücke | 8 | Adding and subtracting within 20; Crossing ten; Number walls | `add-sub`, `number-wall` | MA.1.A.2, MA.1.B.1 |
| 7 | Hundertergipfel (Hundred Peak) | 2nd | Rechenberg | 8 | Numbers to 100; Adding and subtracting tens; Adding and subtracting within 100 | `sequence`, `number-line`, `number-recognition`, `compare`, `add-sub`, `number-wall` | MA.1.A.1, MA.1.A.2 |

The Zehnerhütte (structured quantities and splitting numbers) comes before the Plusbrücke, because the addition strategies of the 1st class build on them.

### reading-de

| # | World | Class | Opens after | Levels | Skills | Exercise types | Reference |
|---|---|---|---|---|---|---|---|
| 1 | Lautwiese | KG2 | open from the start | 8 | Erste Buchstaben erkennen; Anlaute hören | `letter-sound`, `initial-sound` | D.2.A.1, D.1.A.1 |
| 2 | Silbenwald | KG2 | Lautwiese | 6 | Silben klatschen: kurze Wörter; Silben klatschen: lange Wörter | `syllables` | D.1.A.1 |
| 3 | Buchstabenbach | 1st | Silbenwald | 8 | Weitere Buchstaben erkennen; Weitere Anlaute hören; Buchstabengruppen: Sch, Ei, Au | `letter-sound`, `initial-sound` | D.2.A.1, D.1.A.1 |
| 4 | Wörterhaus | 1st | Buchstabenbach | 6 | Wörter in Grossbuchstaben lesen; Einfache Wörter lesen | `word-picture` | D.2.A.1 |
| 5 | Wörterwerkstatt | 1st | Wörterhaus | 6 | Gehörte Wörter mit Buchstaben bauen; Wörter zum Bild bauen | `build-word` | D.5.E.1 |

### reading-en

| # | World | Class | Opens after | Levels | Skills | Exercise types | Reference |
|---|---|---|---|---|---|---|---|
| 1 | Sound Garden | KG2 | open from the start | 8 | Letter sounds; First sounds in words | `letter-sound`, `initial-sound` | RF.K.3a, RF.K.2d |
| 2 | Syllable Park | KG2 | Sound Garden | 6 | Syllables: short words; Syllables: long words | `syllables` | RF.K.2b |
| 3 | Blending Bay | 1st | Syllable Park | 6 | Read short words; Tell similar words apart | `word-picture` | RF.1.3b, RF.K.3d |
| 4 | Word Workshop | 1st | Blending Bay | 6 | Spell words you hear; Spell words for a picture | `build-word` | L.K.2d |

**Not there yet:** the reading tracks end in the 1st class, and the math track reaches the 2nd class with numbers to 100. Times tables, the clock, money (CHF and USD), handwriting (letter tracing in Basisschrift), dictation and reading sentences are planned.

### Exercise types
| Type | What the kid does |
|---|---|
| `count-objects` | counts pictures and taps the matching number |
| `number-recognition` | hears a number, or sees dots, fingers or a ten-frame, and taps the number |
| `ten-frame` | reads a quantity from a Zehnerfeld or Zwanzigerfeld |
| `compare` | taps <, > or = between two numbers or quantities |
| `number-line` | finds or places a number on a Zahlenstrahl |
| `add-sub` | solves an addition or subtraction, sometimes with pictures or a ten-frame |
| `number-bond` | fills in the missing part of a Zahlenhaus |
| `number-wall` | fills in the empty bricks of a Rechenmauer |
| `sequence` | finds the next or missing number, or continues a picture pattern |
| `shape-pick` | taps the named shape |
| `letter-sound` | hears a sound ("M wie Maus") and taps the letter |
| `initial-sound` | sees a picture, hears the word and taps its first letter (Anlaut) |
| `syllables` | hears a word and taps the drum once per syllable |
| `word-picture` | reads a word and taps the matching picture |
| `build-word` | builds a word from letter tiles, for a picture or a spoken word |

Every exercise is generated fresh from rules in the content files, so replaying a level gives new exercises. The server generates the exercises and checks the answers; the browser never gets the solutions in advance.

## How a level works
1. **Demo ("Zeig mir"):** the first time a kid opens a level, Murmeli plays through one example step by step.
2. **Round:** a level has a fixed number of exercises, usually 6. Each exercise allows 2 tries. After a wrong first try, the kid gets a hint (for example "A full row is five. Count on from five." or "Make ten first.") and tries again. After a second wrong try, the right answer is shown.
3. **Score:** right on the first try counts 1, right on the second try 0.5, otherwise 0. The round's score is the average.
4. **Stars:**

   | Stars | Score |
   |---|---|
   | 3 | 100% |
   | 2 | at least the level's pass ratio (80% unless the level sets another) |
   | 1 | at least 50% |
   | 0 | below 50% |

   A level is **passed** with 2 or more stars. Murmeli keeps the best result of each level, so stars never go down.

## Unlocking
- In a world, the first level is open as soon as the world is, and each following level opens when the one before it is passed.
- A world opens when every world it requires (the "Opens after" column) is **completed**, meaning all its levels are passed. Worlds that require nothing are open from the start, like the Formenwald next to the Zahlenwiese.
- A passed level stays passed.

### Start-class placement
Each kid profile has a starting level: Kindergarten 1, Kindergarten 2, 1st class or 2nd class. Worlds meant for an earlier class are marked as **skipped**: all their levels are open, and they count as completed for the worlds that require them. Skipped worlds can still be played, but don't have to be.

For example, a kid starting in the 1st class finds the Zahlenwiese, the Formenwald and the Zahlenbach skipped, and the Zehnerhütte open. In German reading, the Lautwiese and the Silbenwald are skipped and the Buchstabenbach is open.

To check content without playing through the trail, a test instance can set `LEARNING_UNLOCK_ALL=true`, which opens every world and level for every kid (see [Configuration](../reference/configuration.md)). The parent view and practice then treat every level as open too, and no "new world" celebration appears, because nothing is locked. It is refused in production.

## Mastery and practice
Murmeli tracks a **mastery** value per skill, from 0 to 1. The first round of a skill sets it to that round's score; after that, each round moves it 30% of the way towards the new score. Only skills with at least one answer in the round are updated, so stopping early doesn't hurt.

Repetition follows a Leitner box system with intervals of 1, 2, 4, 8 and 16 days. A round with a score of at least 80% moves the skill one box up, so it comes back later; a score below 50% moves it back to the first box.

**Practice** ("Üben") builds a round of 8 to 10 exercises from up to 3 skills of the open levels, in this order:
1. skills that are due for repetition, the most overdue first,
2. skills not played yet,
3. the weakest skills.

The exercises of the chosen skills are interleaved. Practice updates mastery and learning time, but never the stars on the map.

## Badges and time
- Murmeli records four badges: the first passed level, the first completed world, 5 levels with 3 stars, and the first practice round. Badges are never taken away, and nothing depends on streaks. Kids see them on the badge shelf of the trail map, and parents on the progress page.
- The time spent answering is added up per day (in `APP_TIMEZONE`) for the [daily learning time](../usage/parents.md#the-daily-learning-time). Each answer counts at most 5 minutes, so a kid who walks away doesn't use up the limit.

## Adding content
The curriculum is YAML in `content/tracks/`, validated by a schema when the backend starts and in CI. To add or change worlds, levels or pictures, see [content/README.md](../../../content/README.md).
