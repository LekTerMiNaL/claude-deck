/** Live-poll interval. A test seam lets e2e speed up the second poll. */
export function pollMs(): number {
  const override = (globalThis as { __CLAUDE_DECK_POLL_MS__?: number }).__CLAUDE_DECK_POLL_MS__;
  return typeof override === "number" && override > 0 ? override : 5000;
}
