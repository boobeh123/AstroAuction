jest.mock('../../model/Auction');

const Auction = require('../../model/Auction');
const { getHighlightedListing, clearHighlightCache, CACHE_MS } = require('../../services/highlightCache');
const { mockQuery } = require('./helpers-mocks');

/**
 * The spotlight banner shows on almost every page. Its listing used to be
 * looked up on every request; now the lookup is reused for a few seconds.
 */
const NOW = new Date('2026-10-11T08:00:00Z').getTime();
const SPOTLIGHT = { _id: 'lamp', title: 'Koa rocking chair', highlightedAt: new Date(NOW - 60 * 1000) };

beforeEach(() => {
    jest.clearAllMocks();
    clearHighlightCache();
    Auction.findOne.mockReturnValue(mockQuery(SPOTLIGHT));
});

test('finds the spotlighted listing', async () => {
    await expect(getHighlightedListing(NOW)).resolves.toEqual(SPOTLIGHT);
});

// The highlight fades on its own after 12 hours (utils/highlight.js)
test('answers null once the highlight has faded', async () => {
    Auction.findOne.mockReturnValue(mockQuery({ ...SPOTLIGHT, highlightedAt: new Date(NOW - 13 * 60 * 60 * 1000) }));

    await expect(getHighlightedListing(NOW)).resolves.toBeNull();
});

test('reuses the lookup for 10 seconds', async () => {
    await getHighlightedListing(NOW);
    await getHighlightedListing(NOW + CACHE_MS - 1);

    expect(CACHE_MS).toBe(10_000);
    expect(Auction.findOne).toHaveBeenCalledTimes(1);
});

test('looks it up again once the 10 seconds are up', async () => {
    await getHighlightedListing(NOW);
    await getHighlightedListing(NOW + CACHE_MS);

    expect(Auction.findOne).toHaveBeenCalledTimes(2);
});

test('looks it up again after the cache is cleared', async () => {
    await getHighlightedListing(NOW);
    clearHighlightCache();
    await getHighlightedListing(NOW + 1);

    expect(Auction.findOne).toHaveBeenCalledTimes(2);
});

// Requests that arrive at the same moment share one database query
test('requests that arrive together share one lookup', async () => {
    await Promise.all([getHighlightedListing(NOW), getHighlightedListing(NOW), getHighlightedListing(NOW)]);

    expect(Auction.findOne).toHaveBeenCalledTimes(1);
});

test("doesn't keep a failed lookup", async () => {
    const failing = mockQuery(null);
    failing.then = (resolve, reject) => Promise.reject(new Error('database down')).then(resolve, reject);
    Auction.findOne.mockReturnValueOnce(failing);

    await expect(getHighlightedListing(NOW)).rejects.toThrow('database down');
    await expect(getHighlightedListing(NOW + 1)).resolves.toEqual(SPOTLIGHT);
    expect(Auction.findOne).toHaveBeenCalledTimes(2);
});
