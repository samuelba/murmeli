import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { after, describe, it } from 'node:test';
import { runCli } from '../schema/cli.ts';
import { baseData, removeFixture, writeFixture } from './fixture.ts';

function run(...argv: string[]): { code: number; out: string; err: string } {
  const out: string[] = [];
  const err: string[] = [];
  const code = runCli(argv, {
    out: (l) => out.push(l),
    err: (l) => err.push(l),
  });
  return { code, out: out.join('\n'), err: err.join('\n') };
}

const roots: string[] = [];
after(() => roots.forEach(removeFixture));

describe('cli', () => {
  it('validates the real content', () => {
    const result = run('validate');
    assert.equal(result.code, 0);
    assert.match(result.out, /Content OK: 3 tracks/);
  });

  it('exits 1 and lists every issue', () => {
    const data = baseData();
    data.track['icon'] = 'Bad Icon';
    const root = writeFixture(data);
    roots.push(root);
    fs.writeFileSync(path.join(root, 'pictures', 'stray.svg'), '<svg/>');
    const result = run('validate', '--root', root);
    assert.equal(result.code, 1);
    assert.match(result.err, /track\.yaml: icon/);
    assert.match(result.err, /stray\.svg/);
    assert.match(result.err, /2 content issue\(s\) found/);
  });

  it('prints stats as text and JSON', () => {
    assert.match(run('stats').out, /by grade/);
    const json = JSON.parse(run('stats', '--json').out) as {
      totals: { tracks: number };
    };
    assert.equal(json.totals.tracks, 3);
  });

  it('prints speakables per locale', () => {
    const text = run('speakables', '--locale', 'de-CH');
    assert.equal(text.code, 0);
    assert.match(text.out, /^Wie viele$/m);
    assert.match(text.out, /^7\tsieben$/m);
    const json = JSON.parse(
      run('speakables', '--locale', 'en-US', '--json').out,
    ) as { text: string }[];
    assert.ok(json.some((s) => s.text === 'How many'));
  });

  it('rejects bad usage', () => {
    assert.equal(run().code, 2);
    assert.equal(run('help').code, 0);
    assert.equal(run('dance').code, 2);
    assert.equal(run('speakables').code, 2);
    assert.equal(run('speakables', '--locale', 'fr-CH').code, 2);
    assert.equal(run('validate', '--root').code, 2);
    assert.equal(run('validate', '--verbose').code, 2);
    assert.equal(run('validate', 'extra').code, 2);
  });
});
