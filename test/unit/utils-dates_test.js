const fs = require('fs');
const path = require('path');
const { formatDate, STORE_TIME_ZONE } = require('../../utils/dates');

/**
 * The store and its customers are in Hawaii, but Railway runs the server in
 * UTC, where a plain toLocaleDateString() shows tomorrow's date for anything
 * posted after 2 PM Hawaii time. These pass whatever timezone the machine
 * running them is in.
 */
describe('formatDate', () => {
    test("uses the store's timezone", () => {
        expect(STORE_TIME_ZONE).toBe('Pacific/Honolulu');
    });

    // 1:30 AM UTC on Oct 13 is 3:30 PM on Oct 12 in Hawaii
    test('an afternoon in Hawaii shows that day, not the UTC day', () => {
        expect(formatDate(new Date('2026-10-13T01:30:00Z'))).toBe('10/12/2026');
    });

    // Midnight in Hawaii is 10 AM UTC
    test('the day changes at midnight in Hawaii', () => {
        expect(formatDate(new Date('2026-10-13T09:59:00Z'))).toBe('10/12/2026');
        expect(formatDate(new Date('2026-10-13T10:00:00Z'))).toBe('10/13/2026');
    });

    test('takes a Date or a date string', () => {
        expect(formatDate('2026-10-13T01:30:00Z')).toBe('10/12/2026');
    });

    test('passes other formatting options through', () => {
        expect(formatDate(new Date('2026-01-01T03:00:00Z'), { month: 'short', year: 'numeric' })).toBe('Dec 2025');
        expect(formatDate(new Date('2026-10-13T01:30:00Z'), { year: 'numeric', month: 'long', day: 'numeric' })).toBe('October 12, 2026');
    });
});

// Every date a view shows goes through formatDate, so none can slip back to
// the server's timezone
test('no view formats a date with toLocaleDateString or the like', () => {
    const viewsDir = path.join(__dirname, '../../views');
    const views = fs.readdirSync(viewsDir, { recursive: true }).filter((file) => file.endsWith('.ejs'));
    const offenders = views.filter((file) => /toLocale[A-Za-z]*String\(/.test(fs.readFileSync(path.join(viewsDir, file), 'utf8')));

    expect(views.length).toBeGreaterThan(10);
    expect(offenders).toEqual([]);
});
