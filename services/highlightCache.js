const mongoose = require('mongoose');
const Auction = require('../model/Auction');
const { isHighlighted } = require('../utils/highlight');

// How long the banner's listing is reused before it's looked up again
const CACHE_MS = 10_000;

let cached = null; // { lookup: Promise, expiresAt: number }

/**
 * The spotlighted listing for the banner at the top of most pages, or null
 * when nothing is spotlighted.
 *
 * The banner used to cost a database query on every request. Now one lookup
 * is reused for 10 seconds by every request in that time. Turning the
 * spotlight on or off, or deleting listings, clears it straight away with
 * clearHighlightCache(). A new bid can take up to 10 seconds to show.
 *
 * The promise itself is cached, so requests that arrive together share one
 * query, and a failed lookup is dropped so the next request tries again.
 */
function getHighlightedListing(now = Date.now()) {
    if (cached && cached.expiresAt > now) return cached.lookup;

    // trusted(): this $ne is the app's own, so the sanitizeFilter guard in
    // config/database.js lets it through
    const lookup = Auction.findOne({ highlightedAt: mongoose.trusted({ $ne: null }) })
        .select('title saleType price startingPrice currentBid status endsAt highlightedAt')
        .lean()
        .then((candidate) => (candidate && isHighlighted(candidate, new Date(now)) ? candidate : null));

    const entry = { lookup, expiresAt: now + CACHE_MS };
    cached = entry;
    lookup.catch(() => {
        if (cached === entry) cached = null;
    });

    return lookup;
}

function clearHighlightCache() {
    cached = null;
}

module.exports = { getHighlightedListing, clearHighlightCache, CACHE_MS };
