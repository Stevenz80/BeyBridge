export const REVIEW_REPLY_MIN = 2;
export const REVIEW_REPLY_MAX = 1000;

export function normalizeReviewReply(text: string): string {
  return text.replace(/\r\n?/g, '\n').trim().replace(/\n(?:[\t ]*\n){2,}/g, '\n\n');
}

export function validateReviewReply(text: string): string | null {
  // PostgreSQL char_length counts Unicode code points, not UTF-16 code units.
  const length = Array.from(normalizeReviewReply(text)).length;
  if (length < REVIEW_REPLY_MIN) return 'Use at least 2 characters for your reply.';
  if (length > REVIEW_REPLY_MAX) return 'Keep your reply within 1000 characters.';
  return null;
}

export type ReviewReplyRow = { body: string; created_at: string; updated_at: string };

export function mapReviewReply(row?: ReviewReplyRow | ReviewReplyRow[] | null) {
  const reply = Array.isArray(row) ? row[0] : row;
  return reply ? { body: reply.body, createdAt: reply.created_at, updatedAt: reply.updated_at } : null;
}
