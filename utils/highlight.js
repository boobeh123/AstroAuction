// A fixed window rather than a manual-only toggle with no backstop: if the
// business owner forgets to turn a highlight off after the stream ends, it
// fades on its own instead of staying stuck on some listing indefinitely.
const HIGHLIGHT_DURATION_MS = 12 * 60 * 60 * 1000;

// Derived from a single timestamp rather than paired with a separate boolean
// flag — a highlightedAt-plus-isHighlighted pair could disagree with itself
// (cleared timestamp, stale true flag, or vice versa). One field, one source
// of truth, same approach as isAuctionLive deriving from endsAt.
function isHighlighted(listing, now = new Date()) {
    if (!listing.highlightedAt) return false;
    return now.getTime() - new Date(listing.highlightedAt).getTime() < HIGHLIGHT_DURATION_MS;
}

module.exports = { isHighlighted, HIGHLIGHT_DURATION_MS };
