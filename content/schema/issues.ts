import type { z } from 'zod';

export type PathSegment = string | number;

export interface ContentIssue {
  readonly file: string;
  readonly path: string;
  readonly message: string;
}

export function formatPath(path: readonly PropertyKey[]): string {
  return path.reduce<string>((acc, segment) => {
    if (typeof segment === 'number') {
      return `${acc}[${segment}]`;
    }
    const key = String(segment);
    return acc === '' ? key : `${acc}.${key}`;
  }, '');
}

export function formatIssue(issue: ContentIssue): string {
  return issue.path === ''
    ? `${issue.file}: ${issue.message}`
    : `${issue.file}: ${issue.path}: ${issue.message}`;
}

export function zodIssues(
  file: string,
  error: z.ZodError,
  prefix: readonly PathSegment[] = [],
): ContentIssue[] {
  return error.issues.map((issue) => ({
    file,
    path: formatPath([...prefix, ...issue.path]),
    message: issue.message,
  }));
}

export class ContentValidationError extends Error {
  readonly issues: readonly ContentIssue[];

  constructor(issues: readonly ContentIssue[]) {
    super(
      `Content is invalid (${issues.length} issue${issues.length === 1 ? '' : 's'}):\n` +
        issues.map((issue) => `  ${formatIssue(issue)}`).join('\n'),
    );
    this.name = 'ContentValidationError';
    this.issues = issues;
  }
}
