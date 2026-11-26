import { HealthController } from './health.controller';
import type { HealthService, ReadinessReport } from './health.service';

function controller(report: ReadinessReport): HealthController {
  return new HealthController({
    readiness: jest.fn().mockResolvedValue(report),
  } as unknown as HealthService);
}

describe('HealthController', () => {
  const ready: ReadinessReport = {
    status: 'ok',
    checks: { database: 'up', redis: 'up' },
  };

  it('reports liveness without touching dependencies', () => {
    expect(controller(ready).liveness()).toEqual({ status: 'ok' });
  });

  it('returns the report with the default status when ready', async () => {
    const res = { status: jest.fn() };

    await expect(controller(ready).readiness(res)).resolves.toBe(ready);
    expect(res.status).not.toHaveBeenCalled();
  });

  it('answers 503 with the report when not ready', async () => {
    const notReady: ReadinessReport = {
      status: 'error',
      checks: { database: 'down', redis: 'up' },
    };
    const res = { status: jest.fn() };

    await expect(controller(notReady).readiness(res)).resolves.toBe(notReady);
    expect(res.status).toHaveBeenCalledWith(503);
  });
});
