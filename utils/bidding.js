// Money is stored as a plain Number (a BSON double) rounded to 2 decimals.
// See the note in the delivery message: storing integer cents is the more
// rigorous approach, but it touches every read/write/display path, so this
// codebase normalises through round2() at every boundary instead.
function round2(value) {
    return Math.round((value + Number.EPSILON) * 100) / 100;
}

// Parses user-supplied money input. Returns null for anything that isn't a
// usable positive amount, so callers can branch on null instead of trying to
// spot NaN downstream.
function parseMoney(raw) {
    if (typeof raw !== 'string' && typeof raw !== 'number') return null;
    const parsed = Number.parseFloat(raw);
    if (!Number.isFinite(parsed) || parsed <= 0) return null;
    return round2(parsed);
}

// The smallest bid this listing will currently accept.
// Works on lean() objects, which is why it's a plain function rather than a
// schema method — lean() documents have no methods attached.
function minimumNextBid(listing) {
    if (listing.currentBid === null || listing.currentBid === undefined) {
        return round2(listing.startingPrice || 0);
    }
    return round2(listing.currentBid + (listing.minIncrement || 1));
}

// "Live" means: it's an auction, it hasn't been closed, and its clock hasn't
// run out. Views use this to decide between showing a bid form or a result.
function isAuctionLive(listing, now = new Date()) {
    return listing.saleType === 'auction'
        && listing.status === 'open'
        && Boolean(listing.endsAt)
        && new Date(listing.endsAt) > now;
}

function formatMoney(value) {
    if (value === null || value === undefined) return null;
    return `$${round2(value).toFixed(2)}`;
}

// Preset durations instead of a datetime picker — a <select> of day counts
// sidesteps timezone parsing entirely, since endsAt is computed server-side.
const DURATION_CHOICES = [1, 3, 5, 7, 10];

module.exports = {
    round2,
    parseMoney,
    minimumNextBid,
    isAuctionLive,
    formatMoney,
    DURATION_CHOICES,
};
