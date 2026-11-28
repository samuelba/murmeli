import { Logger } from '@nestjs/common';
import type { RunState } from './run-state';
import {
  ACTIVE_RUN_KEY_PREFIX,
  RESTORE_SCRIPT,
  RUN_KEY_PREFIX,
  RunStore,
  START_SCRIPT,
  TAKE_SCRIPT,
  UPDATE_SCRIPT,
} from './run-store';

const state = {
  v: 3,
  runId: 'r1',
  kidId: 'k1',
  levelId: 'l1',
  mode: 'level',
  topicId: null,
  practice: null,
  locale: 'de-CH',
  seed: 1,
  startedAt: 0,
  lastAt: 0,
  activeMs: 0,
  items: [],
} as unknown as RunState;
const raw = JSON.stringify(state);

function store(redis: { eval?: jest.Mock; get?: jest.Mock }) {
  return {
    redis,
    runs: new RunStore({
      eval: redis.eval ?? jest.fn(),
      get: redis.get ?? jest.fn(),
    }),
  };
}

describe('RunStore', () => {
  afterEach(() => jest.restoreAllMocks());

  it('starts a run as the kid’s only active run and returns the replaced one', async () => {
    const previous = { ...state, runId: 'r0' };
    const { redis, runs } = store({
      eval: jest.fn().mockResolvedValue(JSON.stringify(previous)),
    });

    await expect(runs.start(state)).resolves.toEqual(previous);
    expect(redis.eval).toHaveBeenCalledWith(
      START_SCRIPT,
      2,
      `${ACTIVE_RUN_KEY_PREFIX}k1`,
      `${RUN_KEY_PREFIX}r1`,
      'r1',
      raw,
      7200,
      RUN_KEY_PREFIX,
    );
  });

  it('returns null when no run was replaced', async () => {
    const { runs } = store({ eval: jest.fn().mockResolvedValue(null) });
    await expect(runs.start(state)).resolves.toBeNull();
  });

  it('reads a run and keeps the raw JSON for compare-and-set', async () => {
    const { redis, runs } = store({ get: jest.fn().mockResolvedValue(raw) });
    await expect(runs.get('r1')).resolves.toEqual({ state, raw });
    expect(redis.get).toHaveBeenCalledWith(`${RUN_KEY_PREFIX}r1`);
  });

  it('treats missing, corrupt or foreign values as no run', async () => {
    for (const value of [
      null,
      'not json',
      '{"v":3}',
      'null',
      '{"v":3,"kidId":"k1","runId":"r1"}',
      '{"v":2,"kidId":"k1","runId":"r1","locale":"de-CH","items":[]}',
      '{"v":3,"kidId":"k1","runId":"r1","items":[]}',
      '{"v":3,"kidId":"k1","runId":"r1","locale":"de-CH","items":[{}]}',
    ]) {
      const { runs } = store({ get: jest.fn().mockResolvedValue(value) });
      await expect(runs.get('r1')).resolves.toBeNull();
    }
  });

  it('finds the kid’s active run', async () => {
    const get = jest.fn((key: string) =>
      Promise.resolve(key === `${ACTIVE_RUN_KEY_PREFIX}k1` ? 'r1' : raw),
    );
    const { runs } = store({ get });
    await expect(runs.activeOf('k1')).resolves.toEqual({ state, raw });
    expect(get).toHaveBeenCalledWith(`${RUN_KEY_PREFIX}r1`);
  });

  it('has no active run without a pointer or once it is gone', async () => {
    const { runs } = store({ get: jest.fn().mockResolvedValue(null) });
    await expect(runs.activeOf('k1')).resolves.toBeNull();
    const { runs: dangling } = store({
      get: jest.fn().mockResolvedValueOnce('r1').mockResolvedValueOnce(null),
    });
    await expect(dangling.activeOf('k1')).resolves.toBeNull();
  });

  it('updates and takes runs only when they are unchanged', async () => {
    const { redis, runs } = store({
      eval: jest.fn().mockResolvedValueOnce(1).mockResolvedValueOnce(0),
    });
    const next = { ...state, activeMs: 5 };
    await expect(runs.update({ state, raw }, next)).resolves.toBe(true);
    expect(redis.eval).toHaveBeenLastCalledWith(
      UPDATE_SCRIPT,
      1,
      `${RUN_KEY_PREFIX}r1`,
      raw,
      JSON.stringify(next),
    );
    await expect(runs.take({ state, raw })).resolves.toBe(false);
    expect(redis.eval).toHaveBeenLastCalledWith(
      TAKE_SCRIPT,
      2,
      `${RUN_KEY_PREFIX}r1`,
      `${ACTIVE_RUN_KEY_PREFIX}k1`,
      raw,
      'r1',
    );
  });

  it('restores a taken run only if nothing replaced it', async () => {
    const { redis, runs } = store({
      eval: jest.fn().mockResolvedValueOnce(1).mockResolvedValueOnce(0),
    });
    await expect(runs.restore({ state, raw })).resolves.toBe(true);
    expect(redis.eval).toHaveBeenLastCalledWith(
      RESTORE_SCRIPT,
      2,
      `${RUN_KEY_PREFIX}r1`,
      `${ACTIVE_RUN_KEY_PREFIX}k1`,
      raw,
      'r1',
      7200,
    );
    await expect(runs.restore({ state, raw })).resolves.toBe(false);
  });

  it('answers 503 when Redis is down', async () => {
    jest.spyOn(Logger.prototype, 'error').mockImplementation();
    const { runs } = store({
      get: jest.fn().mockRejectedValue(new Error('ECONNREFUSED')),
    });
    await expect(runs.get('r1')).rejects.toMatchObject({
      status: 503,
      response: { errorCode: 'RUN_STORE_UNAVAILABLE' },
    });
  });
});
