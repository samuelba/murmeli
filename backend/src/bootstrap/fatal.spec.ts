import { exitOnFatal } from './fatal';

describe('exitOnFatal', () => {
  it('prints the stack and exits with 1', () => {
    const write = jest.fn();
    const exit = jest.fn();
    const error = new Error('Invalid environment configuration');

    exitOnFatal(error, write, exit);

    expect(write).toHaveBeenCalledWith(
      expect.stringContaining('Invalid environment configuration'),
    );
    expect(exit).toHaveBeenCalledWith(1);
  });

  it('describes non-errors', () => {
    const write = jest.fn();

    exitOnFatal('boom', write, jest.fn());

    expect(write).toHaveBeenCalledWith(expect.stringContaining('boom'));
  });
});
