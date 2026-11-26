export type {
  Content,
  ContentIndex,
  LevelRef,
  SkillRef,
  WorldRef,
} from './content.ts';
export { answerMode, initialSoundPictures, range } from './exercises/common.ts';
export {
  cleanSegment,
  frameOf,
  frameSlots,
  parseTemplate,
  PROMPT_FRAME_SEGMENTS,
  PROMPT_FRAMES,
  renderPrompt,
  resolveSlot,
  SLOT_KINDS,
  speakSegments,
  staticSegments,
} from './exercises/frames.ts';
export type {
  Prompt,
  PromptContent,
  SpeakSegment,
  TemplatePart,
} from './exercises/frames.ts';
export * from './exercises/literacy.ts';
export * from './exercises/math.ts';
export {
  EXERCISE_PARAMS_SCHEMAS,
  EXERCISE_TYPE_IDS,
  EXERCISE_TYPES,
  exerciseTypeDef,
  isExerciseTypeId,
  parseExerciseParams,
} from './exercises/registry.ts';
export type {
  ExerciseParams,
  ExerciseParamsInput,
  ExerciseParamsSchema,
  ExerciseSpec,
  ExerciseTypeId,
  ParseParamsResult,
} from './exercises/registry.ts';
export type * from './exercises/types.ts';
export { deepFreeze } from './freeze.ts';
export type { DeepReadonly } from './freeze.ts';
export {
  GRAPHEME,
  GraphemeSchema,
  PictureIdSchema,
  SKILL_ID,
  SLUG,
  SlugSchema,
} from './ids.ts';
export { ContentValidationError, formatIssue, formatPath } from './issues.ts';
export type { ContentIssue, PathSegment } from './issues.ts';
export { carrierFor, FEEDBACK_KINDS, LexiconSchema } from './lexicon.ts';
export type { Lexicon } from './lexicon.ts';
export { CONTENT_ROOT, loadContent, validateContent } from './load.ts';
export type { ValidationResult } from './load.ts';
export {
  containsEszett,
  LocaleSchema,
  LOCALES,
  LocalizedTextSchema,
  missingLocales,
} from './locale.ts';
export type { Locale, LocalizedText } from './locale.ts';
export {
  ArticleSchema,
  FirstSoundSchema,
  PictureCatalogSchema,
  PictureSchema,
} from './pictures.ts';
export type {
  Article,
  FirstSound,
  Picture,
  PictureCatalog,
  PictureField,
} from './pictures.ts';
export { collectSpeakables } from './speakables.ts';
export type { Speakable } from './speakables.ts';
export { contentStats, formatStats } from './stats.ts';
export type { ContentStats, TrackStats, WorldStats } from './stats.ts';
export { checkSvg } from './svg.ts';
export {
  DemoActionSchema,
  DemoStepSchema,
  GRADES,
  GradeSchema,
  gradeRank,
  HIGHLIGHT_TARGETS,
  RawLevelSchema,
  RawWorldSchema,
  SkillSchema,
  TrackSchema,
} from './world.ts';
export type {
  Demo,
  DemoAction,
  DemoStep,
  Generator,
  Grade,
  Level,
  Skill,
  Track,
  World,
} from './world.ts';
