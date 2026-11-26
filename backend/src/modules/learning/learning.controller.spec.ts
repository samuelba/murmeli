import type { KidEntity } from '../kids/kid.entity';
import { LearningController } from './learning.controller';
import { ParentProgressController } from './parent/parent-progress.controller';
import type { ParentProgressService } from './parent/parent-progress.service';
import type { ProgressService } from './progress/progress.service';
import type { RunService } from './runs/run.service';

describe('LearningController', () => {
  const kid = { id: 'k1' } as KidEntity;
  const progress = { map: jest.fn().mockResolvedValue({ tracks: [] }) };
  const runs = {
    startLevel: jest.fn().mockResolvedValue('level'),
    startPractice: jest.fn().mockResolvedValue('practice'),
    answer: jest.fn().mockResolvedValue('answer'),
    finish: jest.fn().mockResolvedValue('finish'),
  };
  const controller = new LearningController(
    progress as unknown as ProgressService,
    runs as unknown as RunService,
  );

  it('delegates to the services with the current kid', async () => {
    await expect(controller.map(kid)).resolves.toEqual({ tracks: [] });
    await expect(controller.startLevel(kid, 'l1')).resolves.toBe('level');
    expect(runs.startLevel).toHaveBeenCalledWith(kid, 'l1');
    await expect(controller.startPractice(kid)).resolves.toBe('practice');
    await expect(
      controller.answer(kid, 'r1', { index: 2, answer: { value: 1 } }),
    ).resolves.toBe('answer');
    expect(runs.answer).toHaveBeenCalledWith(kid, 'r1', 2, { value: 1 });
    await expect(controller.finish(kid, 'r1')).resolves.toBe('finish');
  });
});

describe('ParentProgressController', () => {
  it('passes the signed-in parent and the kid id', async () => {
    const service = { forKid: jest.fn().mockResolvedValue('progress') };
    const controller = new ParentProgressController(
      service as unknown as ParentProgressService,
    );
    await expect(
      controller.forKid({ userId: 'u1', familyId: 'f1' }, 'k1'),
    ).resolves.toBe('progress');
    expect(service.forKid).toHaveBeenCalledWith('u1', 'k1');
  });
});
