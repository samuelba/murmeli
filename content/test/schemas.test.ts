import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  checkSvg,
  containsEszett,
  DemoActionSchema,
  GradeSchema,
  LocalizedTextSchema,
  missingLocales,
  PictureSchema,
  SkillSchema,
  TrackSchema,
} from '../schema/index.ts';
import { deepFreeze } from '../schema/freeze.ts';
import { formatIssue, formatPath } from '../schema/issues.ts';

const SHARP_S = 'ß';

describe('LocalizedText', () => {
  it('accepts partial locale maps', () => {
    assert.ok(LocalizedTextSchema.safeParse({ 'de-CH': 'Strasse' }).success);
    assert.ok(LocalizedTextSchema.safeParse({ 'en-US': 'Street' }).success);
  });

  it('rejects the sharp s in de-CH', () => {
    const result = LocalizedTextSchema.safeParse({
      'de-CH': `Stra${SHARP_S}e`,
    });
    assert.equal(result.success, false);
    assert.match(result.error.issues[0]!.message, /ss/);
  });

  it('rejects empty maps, empty strings and unknown locales', () => {
    assert.equal(LocalizedTextSchema.safeParse({}).success, false);
    assert.equal(
      LocalizedTextSchema.safeParse({ 'de-CH': '  ' }).success,
      false,
    );
    assert.equal(
      LocalizedTextSchema.safeParse({ 'fr-CH': 'Rue' }).success,
      false,
    );
  });

  it('reports missing locales', () => {
    assert.deepEqual(missingLocales({ 'de-CH': 'Hallo' }, ['de-CH', 'en-US']), [
      'en-US',
    ]);
  });

  it('detects both sharp s forms', () => {
    assert.ok(containsEszett(SHARP_S));
    assert.ok(containsEszett('ẞ'));
    assert.equal(containsEszett('gross'), false);
  });
});

describe('Track, skill and demo schemas', () => {
  const track = {
    id: 'math',
    order: 1,
    locales: ['de-CH'],
    title: { 'de-CH': 'Mathe' },
    icon: 'math',
  };

  it('accepts a valid track', () => {
    assert.ok(TrackSchema.safeParse(track).success);
  });

  it('rejects duplicate locales, bad ids and unknown keys', () => {
    assert.equal(
      TrackSchema.safeParse({ ...track, locales: ['de-CH', 'de-CH'] }).success,
      false,
    );
    assert.equal(
      TrackSchema.safeParse({ ...track, id: 'Math' }).success,
      false,
    );
    assert.equal(TrackSchema.safeParse({ ...track, extra: 1 }).success, false);
  });

  it('coerces numeric grades and rejects unknown ones', () => {
    assert.equal(GradeSchema.parse(1), '1');
    assert.equal(GradeSchema.parse('KG2'), 'KG2');
    assert.equal(GradeSchema.safeParse(3).success, false);
  });

  it('requires an lp21 or ccss reference on skills', () => {
    const skill = { id: 'math.count', title: { 'de-CH': 'Zählen' } };
    assert.equal(SkillSchema.safeParse(skill).success, false);
    assert.ok(SkillSchema.safeParse({ ...skill, lp21: 'MA.1.A.1' }).success);
    assert.ok(SkillSchema.safeParse({ ...skill, ccss: 'RF.K.3a' }).success);
    assert.equal(
      SkillSchema.safeParse({ ...skill, lp21: 'MA1A1' }).success,
      false,
    );
  });

  it('accepts exactly one demo action', () => {
    assert.ok(DemoActionSchema.safeParse({ tapAnswer: true }).success);
    assert.ok(DemoActionSchema.safeParse({ highlight: 'objects' }).success);
    assert.equal(DemoActionSchema.safeParse({}).success, false);
    assert.equal(
      DemoActionSchema.safeParse({ tapAnswer: true, clap: true }).success,
      false,
    );
    assert.equal(
      DemoActionSchema.safeParse({ highlight: 'nowhere' }).success,
      false,
    );
  });
});

describe('Picture schema', () => {
  const picture = {
    file: 'apple.svg',
    source: { set: 'noto-emoji', codepoint: '1f34e' },
    tags: ['fruit'],
    words: { 'de-CH': 'Apfel', 'en-US': 'apple' },
    article: 'der',
    firstSound: { 'de-CH': { grapheme: 'A', phoneme: 'a' } },
  };

  it('accepts a picture and fills defaults', () => {
    const parsed = PictureSchema.parse(picture);
    assert.equal(parsed.firstSound['de-CH']?.regular, true);
    assert.deepEqual(parsed.plural, {});
  });

  it('rejects bad files, articles, codepoints and graphemes', () => {
    assert.equal(
      PictureSchema.safeParse({ ...picture, file: 'apple.png' }).success,
      false,
    );
    assert.equal(
      PictureSchema.safeParse({ ...picture, article: 'den' }).success,
      false,
    );
    assert.equal(
      PictureSchema.safeParse({
        ...picture,
        source: { set: 'noto-emoji', codepoint: 'apple' },
      }).success,
      false,
    );
    assert.equal(
      PictureSchema.safeParse({
        ...picture,
        firstSound: { 'de-CH': { grapheme: 'sch', phoneme: 'x' } },
      }).success,
      false,
    );
  });
});

describe('checkSvg', () => {
  const ok =
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1 1"><use xlink:href="#a"/><path fill="url(#g)"/></svg>';

  it('accepts a plain SVG with internal references', () => {
    assert.deepEqual(checkSvg(ok), []);
  });

  it('rejects scripts, handlers, entities and external references', () => {
    const cases = [
      '<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>',
      '<svg xmlns="http://www.w3.org/2000/svg" onload="x()"></svg>',
      '<!DOCTYPE svg [<!ENTITY a "b">]><svg xmlns="http://www.w3.org/2000/svg"></svg>',
      '<svg xmlns="http://www.w3.org/2000/svg"><use href="https://evil.example/x.svg#a"/></svg>',
      '<svg xmlns="http://www.w3.org/2000/svg"><rect style="fill:url(https://x/y)"/></svg>',
      '<svg xmlns="http://www.w3.org/2000/svg"><foreignObject/></svg>',
      '<svg xmlns="http://www.w3.org/2000/svg"><image href="data:image/png;base64,AA"/></svg>',
      '<svg></svg>',
    ];
    for (const svg of cases) {
      assert.ok(checkSvg(svg).length > 0, svg);
    }
  });

  it('rejects oversized files', () => {
    const big = ok.replace(
      '</svg>',
      `<!-- ${'x'.repeat(300 * 1024)} --></svg>`,
    );
    assert.ok(checkSvg(big).some((p) => p.includes('larger')));
  });
});

describe('helpers', () => {
  it('formats paths and issues', () => {
    assert.equal(
      formatPath(['levels', 2, 'params', 'max']),
      'levels[2].params.max',
    );
    assert.equal(
      formatIssue({ file: 'a.yaml', path: '', message: 'bad' }),
      'a.yaml: bad',
    );
    assert.equal(
      formatIssue({ file: 'a.yaml', path: 'x', message: 'bad' }),
      'a.yaml: x: bad',
    );
  });

  it('deep freezes nested data', () => {
    const frozen = deepFreeze({ a: { b: [1, { c: 2 }] } });
    assert.ok(Object.isFrozen(frozen.a.b[1]));
  });
});
