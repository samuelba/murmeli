export interface MailMessage {
  readonly ID: string;
  readonly Subject: string;
  readonly Text: string;
  readonly HTML: string;
}

interface SearchResult {
  readonly messages: readonly { ID: string; Subject: string }[];
}

const POLL_MS = 100;
const TIMEOUT_MS = 10_000;

function mailpitUrl(): string {
  const url = process.env.MAILPIT_URL;
  if (!url) {
    throw new Error('MAILPIT_URL is not set');
  }
  return url;
}

async function getJson<T>(path: string): Promise<T> {
  const response = await fetch(`${mailpitUrl()}${path}`);
  if (!response.ok) {
    throw new Error(`Mailpit ${path} answered ${response.status}`);
  }
  return (await response.json()) as T;
}

async function search(to: string): Promise<SearchResult['messages']> {
  const query = encodeURIComponent(`to:"${to}"`);
  return (await getJson<SearchResult>(`/api/v1/search?query=${query}`))
    .messages;
}

/**
 * Waits until `to` has received `count` messages and returns the newest one
 * whose subject matches.
 */
export async function waitForMail(
  to: string,
  subject: RegExp = /./,
  count = 1,
): Promise<MailMessage> {
  const deadline = Date.now() + TIMEOUT_MS;
  while (Date.now() < deadline) {
    const matching = (await search(to)).filter((m) => subject.test(m.Subject));
    if (matching.length >= count) {
      return getJson<MailMessage>(`/api/v1/message/${matching[0].ID}`);
    }
    await new Promise((resolve) => setTimeout(resolve, POLL_MS));
  }
  throw new Error(`No mail matching ${String(subject)} reached ${to}`);
}

export async function mailCount(to: string): Promise<number> {
  return (await search(to)).length;
}

export function tokenFrom(message: MailMessage, path: string): string {
  const match = new RegExp(`/${path}[?/](?:token=)?([A-Za-z0-9_-]+)`).exec(
    message.Text,
  );
  if (!match) {
    throw new Error(`No ${path} link in mail "${message.Subject}"`);
  }
  return match[1];
}
