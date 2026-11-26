import type { Env } from './env.schema';

export const SECRET_MIN_LENGTH = 32;
const MIN_DISTINCT_CHARACTERS = 10;

export const PLACEHOLDER_MARKERS: readonly string[] = [
  'change-me',
  'changeme',
  'dev-only',
  'ci-only',
  'example',
  'sample',
  'placeholder',
];

export const SECRET_NAMES = [
  'JWT_SECRET',
  'ENCRYPTION_KEY',
  'ALTCHA_HMAC_KEY',
] as const;

type SecretName = (typeof SECRET_NAMES)[number];

const GENERATE_HINT = 'Generate one with: openssl rand -base64 48';

/**
 * @returns why the secret is unsafe, or null when it looks fine
 */
export function findSecretWeakness(
  name: string,
  secret: string,
): string | null {
  const lower = secret.toLowerCase();
  if (PLACEHOLDER_MARKERS.some((marker) => lower.includes(marker))) {
    return `${name} looks like a placeholder value. ${GENERATE_HINT}`;
  }
  if (secret.length < SECRET_MIN_LENGTH) {
    return `${name} is shorter than ${SECRET_MIN_LENGTH} characters. ${GENERATE_HINT}`;
  }
  if (new Set(secret).size < MIN_DISTINCT_CHARACTERS) {
    return `${name} has too few distinct characters to be random. ${GENERATE_HINT}`;
  }
  return null;
}

function findReusedSecrets(env: Pick<Env, SecretName>): string[] {
  return SECRET_NAMES.flatMap((first, index) =>
    SECRET_NAMES.slice(index + 1)
      .filter((second) => env[first] === env[second])
      .map((second) => `${first} and ${second} must be different secrets.`),
  );
}

export function findSecretProblems(
  env: Pick<Env, SecretName>,
): readonly string[] {
  const weaknesses = SECRET_NAMES.map((name) =>
    findSecretWeakness(name, env[name]),
  ).filter((problem): problem is string => problem !== null);
  return [...weaknesses, ...findReusedSecrets(env)];
}
