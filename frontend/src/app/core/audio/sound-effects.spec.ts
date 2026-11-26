import { TestBed } from '@angular/core/testing';
import { KID, provideAppTesting } from '../../../testing/app-testing';
import { AuthService } from '../auth/auth.service';
import { AUDIO_CONTEXT_FACTORY, EFFECTS, SoundEffects } from './sound-effects';

function fakeContext(state: AudioContextState = 'running') {
  const param = () => ({
    setValueAtTime: vi.fn(),
    exponentialRampToValueAtTime: vi.fn(),
  });
  const oscillators: { frequency: ReturnType<typeof param>; start: unknown; stop: unknown }[] = [];
  const context = {
    state,
    currentTime: 1,
    destination: {},
    resume: vi.fn(() => Promise.resolve()),
    close: vi.fn(() => Promise.resolve()),
    createGain: () => {
      const gain = { gain: param(), connect: vi.fn((target: unknown) => target) };
      return gain;
    },
    createOscillator: () => {
      const oscillator = {
        type: 'sine',
        frequency: param(),
        connect: vi.fn((target: unknown) => target),
        start: vi.fn(),
        stop: vi.fn(),
      };
      oscillators.push(oscillator);
      return oscillator;
    },
  };
  return { context, oscillators };
}

describe('SoundEffects', () => {
  function setup(factory: () => unknown) {
    TestBed.configureTestingModule({
      providers: [...provideAppTesting(), { provide: AUDIO_CONTEXT_FACTORY, useValue: factory }],
    });
    return TestBed.inject(SoundEffects);
  }

  it('plays each note of an effect with an oscillator', () => {
    const { context, oscillators } = fakeContext('suspended');
    const factory = vi.fn(() => context);
    const effects = setup(factory);
    effects.play('correct');
    effects.play('complete');

    expect(factory).toHaveBeenCalledTimes(1);
    expect(context.resume).toHaveBeenCalled();
    expect(oscillators).toHaveLength(EFFECTS.correct.length + EFFECTS.complete.length);
    expect(oscillators[0]!.frequency.setValueAtTime).toHaveBeenCalledWith(523.25, 1.01);
  });

  it('wakes the audio context on the first tap and plays the locked sound', () => {
    const { context, oscillators } = fakeContext('suspended');
    const effects = setup(() => context);
    document.dispatchEvent(new Event('pointerdown'));
    expect(context.resume).toHaveBeenCalled();
    effects.play('locked');
    expect(oscillators).toHaveLength(2);
  });

  it('stays silent when the kid turned sound off', () => {
    const { context, oscillators } = fakeContext();
    const effects = setup(() => context);
    TestBed.inject(AuthService).setActiveKid({ ...KID, soundEnabled: false });
    effects.play('wrong');
    expect(oscillators).toHaveLength(0);
  });

  it('copes without Web Audio', () => {
    const effects = setup(() => {
      throw new Error('no audio');
    });
    expect(() => effects.play('star')).not.toThrow();
    const none = TestBed.inject(SoundEffects);
    expect(none.enabled()).toBe(true);
  });
});
