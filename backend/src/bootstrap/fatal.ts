import { errorMessage } from '../common/errors/error-message';

export type Exit = (code: number) => void;

/**
 * Last resort for startup failures: the pino logger may not be attached yet,
 * so the error goes straight to stderr before the process exits.
 */
export function exitOnFatal(
  error: unknown,
  write: (text: string) => void = (text) => process.stderr.write(text),
  exit: Exit = (code) => process.exit(code),
): void {
  const detail =
    error instanceof Error && error.stack ? error.stack : errorMessage(error);
  write(`Fatal: the backend failed to start.\n${detail}\n`);
  exit(1);
}
