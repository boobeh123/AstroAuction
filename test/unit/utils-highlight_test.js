const { isHighlighted, HIGHLIGHT_DURATION_MS } = require('../../utils/highlight');

/**
 * The whole point of this module is that "is this listing highlighted right
 * now" is *derived* from one timestamp rather than stored as its own boolean.
 *
 * That matters because there is no sweeper clearing expired highlights the
 * way there is for auctions closing — by design. A document can and will sit
 * in the database with a stale, non-null highlightedAt long after the window
 * has passed. isHighlighted() is the only thing standing between that stale
 * value and a banner announcing a listing that stopped being live hours ago.
 */

const HOUR = 60 * 60 * 1000;

describe('HIGHLIGHT_DURATION_MS', () => {
    test('is twelve hours', () => {
        expect(HIGHLIGHT_DURATION_MS).toBe(12 * HOUR);
    });
});

describe('isHighlighted', () => {
    test('a listing highlighted moments ago is highlighted', () => {
        expect(isHighlighted({ highlightedAt: new Date() })).toBe(true);
    });

    test('a listing highlighted an hour ago is still highlighted', () => {
        expect(isHighlighted({ highlightedAt: new Date(Date.now() - HOUR) })).toBe(true);
    });

    test('a listing highlighted eleven hours ago is still highlighted', () => {
        expect(isHighlighted({ highlightedAt: new Date(Date.now() - 11 * HOUR) })).toBe(true);
    });

    // The 12-hour fallback. If the business owner forgets to toggle it off
    // after a stream, this is what stops a listing glowing indefinitely.
    test('a listing highlighted thirteen hours ago has expired', () => {
        expect(isHighlighted({ highlightedAt: new Date(Date.now() - 13 * HOUR) })).toBe(false);
    });

    test('null highlightedAt is not highlighted', () => {
        expect(isHighlighted({ highlightedAt: null })).toBe(false);
    });

    // A listing that has never been highlighted has no such field at all,
    // which must behave identically to an explicit null.
    test('a missing highlightedAt field is not highlighted', () => {
        expect(isHighlighted({})).toBe(false);
    });

    test('accepts an injected clock so the window is testable without waiting', () => {
        const listing = { highlightedAt: new Date('2026-01-01T00:00:00Z') };

        expect(isHighlighted(listing, new Date('2026-01-01T06:00:00Z'))).toBe(true);
        expect(isHighlighted(listing, new Date('2026-01-01T18:00:00Z'))).toBe(false);
    });

    test('the boundary is exclusive — exactly twelve hours has expired', () => {
        const start = new Date('2026-01-01T00:00:00Z');
        const listing = { highlightedAt: start };

        const oneMsBefore = new Date(start.getTime() + HIGHLIGHT_DURATION_MS - 1);
        const exactly = new Date(start.getTime() + HIGHLIGHT_DURATION_MS);

        expect(isHighlighted(listing, oneMsBefore)).toBe(true);
        expect(isHighlighted(listing, exactly)).toBe(false);
    });

    // Mongoose hands back a Date, but a lean() result deserialised from JSON
    // somewhere else in the stack could be a string. Both must work, since
    // the banner middleware and the grid view both call this.
    test('accepts an ISO string as well as a Date object', () => {
        const iso = new Date(Date.now() - HOUR).toISOString();

        expect(isHighlighted({ highlightedAt: iso })).toBe(true);
    });

    // Clock skew between the app server and whatever set the timestamp could
    // produce this. A future timestamp is within the window by the maths, and
    // treating it as highlighted is the safe reading — it will expire on its
    // own rather than sticking.
    test('a future timestamp is treated as highlighted', () => {
        expect(isHighlighted({ highlightedAt: new Date(Date.now() + HOUR) })).toBe(true);
    });
});
