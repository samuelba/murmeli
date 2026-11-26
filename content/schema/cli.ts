import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { formatIssue } from './issues.ts';
import { CONTENT_ROOT, validateContent } from './load.ts';
import { LocaleSchema } from './locale.ts';
import { collectSpeakables } from './speakables.ts';
import { contentStats, formatStats } from './stats.ts';

export interface CliIo {
  out(line: string): void;
  err(line: string): void;
}

const USAGE = `Usage: node schema/cli.ts <command> [options]

Commands:
  validate                     Validate all content; exit 1 and list every issue on failure.
  stats [--json]               Count tracks, worlds, levels and skills per track and grade.
  speakables --locale <loc> [--json]
                               Print every string a kid can hear in that locale.

Options:
  --root <dir>                 Content root (default: the package folder).`;

interface Args {
  command?: string;
  root: string;
  locale?: string;
  json: boolean;
}

function parseArgs(argv: readonly string[]): Args | string {
  const args: Args = { root: CONTENT_ROOT, json: false };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--json') {
      args.json = true;
    } else if (arg === '--root' || arg === '--locale') {
      const value = argv[i + 1];
      if (value === undefined) {
        return `${arg} needs a value`;
      }
      if (arg === '--root') {
        args.root = path.resolve(value);
      } else {
        args.locale = value;
      }
      i += 1;
    } else if (arg?.startsWith('--')) {
      return `unknown option ${arg}`;
    } else if (args.command === undefined) {
      args.command = arg;
    } else {
      return `unexpected argument ${arg}`;
    }
  }
  return args;
}

const defaultIo: CliIo = {
  out: (line) => console.log(line),
  err: (line) => console.error(line),
};

export function runCli(argv: readonly string[], io: CliIo = defaultIo): number {
  const args = parseArgs(argv);
  if (typeof args === 'string') {
    io.err(`${args}\n\n${USAGE}`);
    return 2;
  }
  if (args.command === undefined || args.command === 'help') {
    io.out(USAGE);
    return args.command === undefined ? 2 : 0;
  }
  if (!['validate', 'stats', 'speakables'].includes(args.command)) {
    io.err(`unknown command ${args.command}\n\n${USAGE}`);
    return 2;
  }
  const locale = LocaleSchema.safeParse(args.locale);
  if (args.command === 'speakables' && !locale.success) {
    io.err(`speakables needs --locale ${LocaleSchema.options.join('|')}`);
    return 2;
  }
  const result = validateContent(args.root);
  if (result.content === undefined) {
    result.issues.forEach((issue) => io.err(formatIssue(issue)));
    io.err(`\n${result.issues.length} content issue(s) found.`);
    return 1;
  }
  const content = result.content;
  if (args.command === 'validate') {
    const stats = contentStats(content).totals;
    io.out(
      `Content OK: ${stats.tracks} tracks, ${stats.worlds} worlds, ${stats.levels} levels, ${stats.pictures} pictures.`,
    );
  } else if (args.command === 'stats') {
    const stats = contentStats(content);
    io.out(args.json ? JSON.stringify(stats, null, 2) : formatStats(stats));
  } else if (locale.success) {
    const speakables = collectSpeakables(content, locale.data);
    if (args.json) {
      io.out(JSON.stringify(speakables, null, 2));
    } else {
      speakables.forEach((s) =>
        io.out(s.speak === undefined ? s.text : `${s.text}\t${s.speak}`),
      );
    }
  }
  return 0;
}

if (
  process.argv[1] !== undefined &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  process.exitCode = runCli(process.argv.slice(2));
}
