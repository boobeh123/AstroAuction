// The store and its customers are in Hawaii, but the server runs in UTC on
// Railway, where a plain toLocaleDateString() shows tomorrow's date for
// anything after 2 PM Hawaii time. Views format every date through
// formatDate, which server.js puts on app.locals.
const STORE_TIME_ZONE = 'Pacific/Honolulu';

// A date as the store sees it: 10/12/2026 by default, or in whatever format
// the options ask for, such as { month: 'short', year: 'numeric' }
function formatDate(value, options = {}) {
    return new Date(value).toLocaleDateString('en-US', { timeZone: STORE_TIME_ZONE, ...options });
}

module.exports = { formatDate, STORE_TIME_ZONE };
