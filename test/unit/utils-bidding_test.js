const {
    round2,
    parseMoney,
    minimumNextBid,
    isAuctionLive,
    formatMoney,
    DURATION_CHOICES,
} = require('../../utils/bidding');

describe('round2', () => {
    // These are the reason round2 exists. Binary floating point can't
    // represent most decimal fractions exactly, so money arithmetic drifts.
    // The bid filter compares `currentBid <= amount - minIncrement`; if that
    // subtraction produced 100.00000000000001 instead of 100, a legitimate
    // bid would be silently rejected.
    test('keeps money subtraction exact', () => {
        expect(round2(100.10 - 0.10)).toBe(100);
        expect(round2(1.10 - 0.10)).toBe(1);
    });

    test('keeps money addition exact', () => {
        expect(round2(0.1 + 0.2)).toBe(0.3);
        expect(round2(100.10 + 0.10)).toBe(100.2);
    });

    test('rounds a half cent up', () => {
        expect(round2(1.005)).toBe(1.01);
        expect(round2(2.675)).toBe(2.68);
    });

    test('leaves whole numbers alone', () => {
        expect(round2(100)).toBe(100);
        expect(round2(0)).toBe(0);
    });
});

describe('parseMoney', () => {
    test('accepts decimal strings from form input', () => {
        expect(parseMoney('12.34')).toBe(12.34);
        expect(parseMoney('0.01')).toBe(0.01);
    });

    test('accepts numbers as well as strings', () => {
        expect(parseMoney(50)).toBe(50);
    });

    test('rounds beyond two decimals', () => {
        expect(parseMoney('12.349')).toBe(12.35);
    });

    test('rejects empty and non-numeric input', () => {
        expect(parseMoney('')).toBeNull();
        expect(parseMoney('   ')).toBeNull();
        expect(parseMoney('abc')).toBeNull();
    });

    test('rejects zero and negative amounts', () => {
        expect(parseMoney('0')).toBeNull();
        expect(parseMoney('-5')).toBeNull();
    });

    test('rejects Infinity and NaN', () => {
        expect(parseMoney('Infinity')).toBeNull();
        expect(parseMoney('NaN')).toBeNull();
    });

    // A crafted request can send `amount[$gt]=0`, which Express parses into
    // an object. Without the typeof guard this would reach Mongoose and throw
    // a CastError, surfacing as a 500 page instead of a validation message.
    test('rejects objects (the NoSQL injection shape)', () => {
        expect(parseMoney({ $gt: 0 })).toBeNull();
        expect(parseMoney(['100'])).toBeNull();
        expect(parseMoney(null)).toBeNull();
        expect(parseMoney(undefined)).toBeNull();
    });
});

describe('minimumNextBid', () => {
    test('uses the starting price when there are no bids', () => {
        expect(minimumNextBid({ currentBid: null, startingPrice: 25, minIncrement: 1 })).toBe(25);
    });

    // Legacy or partially-formed documents may lack the field entirely rather
    // than holding null, so both have to behave the same way.
    test('treats a missing currentBid field the same as null', () => {
        expect(minimumNextBid({ startingPrice: 25, minIncrement: 1 })).toBe(25);
    });

    test('adds the increment once a bid exists', () => {
        expect(minimumNextBid({ currentBid: 100, minIncrement: 5 })).toBe(105);
    });

    test('keeps fractional increments exact', () => {
        expect(minimumNextBid({ currentBid: 100.10, minIncrement: 0.10 })).toBe(100.2);
    });

    test('falls back to an increment of 1 when none is set', () => {
        expect(minimumNextBid({ currentBid: 100 })).toBe(101);
    });
});

describe('isAuctionLive', () => {
    const future = new Date(Date.now() + 3_600_000);
    const past = new Date(Date.now() - 1_000);

    test('open auction with time remaining is live', () => {
        expect(isAuctionLive({ saleType: 'auction', status: 'open', endsAt: future })).toBe(true);
    });

    test('open auction past its end time is not live', () => {
        expect(isAuctionLive({ saleType: 'auction', status: 'open', endsAt: past })).toBe(false);
    });

    test('closed auction is not live even with time remaining', () => {
        expect(isAuctionLive({ saleType: 'auction', status: 'ended', endsAt: future })).toBe(false);
    });

    test('fixed-price listing is never live', () => {
        expect(isAuctionLive({ saleType: 'fixed', status: 'open', endsAt: future })).toBe(false);
    });

    test('auction with no end date is not live', () => {
        expect(isAuctionLive({ saleType: 'auction', status: 'open', endsAt: null })).toBe(false);
    });

    test('accepts an injected clock so time-based logic is testable', () => {
        const listing = { saleType: 'auction', status: 'open', endsAt: new Date('2030-01-01') };
        expect(isAuctionLive(listing, new Date('2029-12-31'))).toBe(true);
        expect(isAuctionLive(listing, new Date('2030-01-02'))).toBe(false);
    });
});

describe('formatMoney', () => {
    test('always shows two decimal places', () => {
        expect(formatMoney(5)).toBe('$5.00');
        expect(formatMoney(5.5)).toBe('$5.50');
        expect(formatMoney(1234.5)).toBe('$1234.50');
    });

    test('returns null for absent values so views can branch on it', () => {
        expect(formatMoney(null)).toBeNull();
        expect(formatMoney(undefined)).toBeNull();
    });
});

describe('DURATION_CHOICES', () => {
    // postAuction validates submitted durations against this list, so a
    // tampered form value can't create an auction lasting ten years.
    test('is a non-empty list of positive whole days', () => {
        expect(DURATION_CHOICES.length).toBeGreaterThan(0);
        DURATION_CHOICES.forEach((days) => {
            expect(Number.isInteger(days)).toBe(true);
            expect(days).toBeGreaterThan(0);
        });
    });
});
