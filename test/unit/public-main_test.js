/**
 * @jest-environment jsdom
 */

/**
 * Client-side tests for public/js/main.js.
 *
 * main.js is a plain browser script, not a module: it captures its DOM
 * selectors in top-level consts the moment it loads. That has one consequence
 * that shapes this whole file — the DOM has to exist *before* main.js is
 * required, and the module registry has to be reset between tests so the
 * selectors are re-captured against each fresh document. Hence
 * jest.resetModules() and the loadMainJs() helper rather than a single
 * require at the top.
 */

function loadMainJs() {
    jest.resetModules();
    return require('../../public/js/main.js');
}

describe('formatTimeRemaining', () => {
    let formatTimeRemaining;

    beforeAll(() => {
        document.body.innerHTML = '';
        ({ formatTimeRemaining } = loadMainJs());
    });

    test('reports days and hours when more than a day remains', () => {
        const threeDaysFourHours = (3 * 86400 + 4 * 3600) * 1000;
        expect(formatTimeRemaining(threeDaysFourHours)).toBe('3d 4h');
    });

    test('drops to hours and minutes inside a day', () => {
        const fourHoursTwelveMinutes = (4 * 3600 + 12 * 60) * 1000;
        expect(formatTimeRemaining(fourHoursTwelveMinutes)).toBe('4h 12m');
    });

    // The granularity shift is the point: seconds are noise on a three-day
    // auction and essential in the last minute.
    test('drops to minutes and seconds inside an hour', () => {
        const twelveMinutesNineSeconds = (12 * 60 + 9) * 1000;
        expect(formatTimeRemaining(twelveMinutesNineSeconds)).toBe('12m 9s');
    });

    test('shows bare seconds in the final minute', () => {
        expect(formatTimeRemaining(9 * 1000)).toBe('9s');
        expect(formatTimeRemaining(1 * 1000)).toBe('1s');
    });

    test('reports Ended at and past zero', () => {
        expect(formatTimeRemaining(0)).toBe('Ended');
        expect(formatTimeRemaining(-5000)).toBe('Ended');
    });

    test('handles exact boundaries without rolling over incorrectly', () => {
        expect(formatTimeRemaining(86400 * 1000)).toBe('1d 0h');
        expect(formatTimeRemaining(3600 * 1000)).toBe('1h 0m');
        expect(formatTimeRemaining(60 * 1000)).toBe('1m 0s');
    });

    test('truncates rather than rounding up a partial second', () => {
        // 9.9s must not display as 10s — a countdown that shows a number
        // higher than the time actually left is worse than one that lags.
        expect(formatTimeRemaining(9900)).toBe('9s');
    });
});

describe('mobile nav toggle', () => {
    function setupNav() {
        document.body.innerHTML = `
            <button type="button" id="nav-toggle" aria-expanded="false" aria-label="Open menu">
                <span class="nav-toggle-bar"></span>
            </button>
            <div class="nav-actions" id="nav-actions">
                <a href="/auction">Listings</a>
                <button type="button" id="open-create-listing-btn">Create Listing</button>
            </div>
        `;
        loadMainJs();

        return {
            toggle: document.getElementById('nav-toggle'),
            actions: document.getElementById('nav-actions'),
        };
    }

    test('opens on click and reflects state in aria-expanded', () => {
        const { toggle, actions } = setupNav();

        expect(actions.classList.contains('is-open')).toBe(false);

        toggle.click();

        expect(actions.classList.contains('is-open')).toBe(true);
        // Screen readers announce the button's state from this attribute, so
        // it has to track the visual state, not just look right.
        expect(toggle.getAttribute('aria-expanded')).toBe('true');
        expect(toggle.getAttribute('aria-label')).toBe('Close menu');
    });

    test('closes on a second click', () => {
        const { toggle, actions } = setupNav();

        toggle.click();
        toggle.click();

        expect(actions.classList.contains('is-open')).toBe(false);
        expect(toggle.getAttribute('aria-expanded')).toBe('false');
        expect(toggle.getAttribute('aria-label')).toBe('Open menu');
    });

    test('closes on Escape', () => {
        const { toggle, actions } = setupNav();

        toggle.click();
        expect(actions.classList.contains('is-open')).toBe(true);

        document.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));

        expect(actions.classList.contains('is-open')).toBe(false);
    });

    test('closes when clicking outside the menu', () => {
        const { toggle, actions } = setupNav();
        toggle.click();

        document.body.click();

        expect(actions.classList.contains('is-open')).toBe(false);
    });

    // Without this, tapping Create Listing on a phone would leave the nav
    // dropdown open underneath the modal it opens.
    test('closes when a button inside the menu is clicked', () => {
        const { toggle, actions } = setupNav();
        toggle.click();

        document.getElementById('open-create-listing-btn').click();

        expect(actions.classList.contains('is-open')).toBe(false);
    });

    test('closes if the viewport grows past the mobile breakpoint', () => {
        const { toggle, actions } = setupNav();
        toggle.click();

        window.innerWidth = 1200;
        window.dispatchEvent(new window.Event('resize'));

        expect(actions.classList.contains('is-open')).toBe(false);
    });
});

describe('countdown ticker', () => {
    beforeEach(() => {
        jest.useFakeTimers();
    });

    afterEach(() => {
        jest.useRealTimers();
    });

    function setupCountdown(msFromNow) {
        const endsAt = new Date(Date.now() + msFromNow).toISOString();
        document.body.innerHTML = `<span class="countdown-value" data-ends-at="${endsAt}">&mdash;</span>`;
        loadMainJs();
        return document.querySelector('.countdown-value');
    }

    test('renders immediately on load rather than waiting a full second', () => {
        const el = setupCountdown(4 * 3600 * 1000);

        // If the first paint waited for the interval, every page would show a
        // placeholder dash for a second before the real value appeared.
        expect(el.textContent).not.toBe('—');
        expect(el.textContent).toMatch(/^3h 59m$|^4h 0m$/);
    });

    test('updates on each tick', () => {
        const el = setupCountdown(65 * 1000);
        const initial = el.textContent;

        jest.advanceTimersByTime(5000);

        expect(el.textContent).not.toBe(initial);
    });

    test('marks the final hour as urgent', () => {
        const el = setupCountdown(30 * 60 * 1000);

        expect(el.classList.contains('is-urgent')).toBe(true);
        expect(el.classList.contains('is-ended')).toBe(false);
    });

    test('does not mark a distant auction as urgent', () => {
        const el = setupCountdown(5 * 3600 * 1000);

        expect(el.classList.contains('is-urgent')).toBe(false);
    });

    test('switches to ended once the clock passes zero', () => {
        const el = setupCountdown(2000);

        jest.advanceTimersByTime(3000);

        expect(el.textContent).toBe('Ended');
        expect(el.classList.contains('is-ended')).toBe(true);
        expect(el.classList.contains('is-urgent')).toBe(false);
    });

    test('ignores an unparseable end date instead of rendering NaN', () => {
        document.body.innerHTML = '<span class="countdown-value" data-ends-at="not-a-date">—</span>';
        loadMainJs();

        const el = document.querySelector('.countdown-value');
        expect(el.textContent).toBe('—');
    });
});

describe('sale type toggle', () => {
    function setupSaleType() {
        document.body.innerHTML = `
            <input type="radio" name="saleType" id="sale-fixed" value="fixed" checked>
            <input type="radio" name="saleType" id="sale-auction" value="auction">
            <div class="sale-fields" id="fixed-price-fields">
                <input type="number" id="modal-price-input" name="price">
            </div>
            <div class="sale-fields" id="auction-fields" hidden>
                <input type="number" id="modal-starting-price-input" name="startingPrice">
            </div>
        `;
        loadMainJs();

        return {
            fixedRadio: document.getElementById('sale-fixed'),
            auctionRadio: document.getElementById('sale-auction'),
            fixedFields: document.getElementById('fixed-price-fields'),
            auctionFields: document.getElementById('auction-fields'),
            priceInput: document.getElementById('modal-price-input'),
            startingPriceInput: document.getElementById('modal-starting-price-input'),
        };
    }

    test('sets required correctly on load, before any interaction', () => {
        const { priceInput, startingPriceInput } = setupSaleType();

        expect(priceInput.required).toBe(true);
        expect(startingPriceInput.required).toBe(false);
    });

    test('swaps visible fields when auction is selected', () => {
        const { auctionRadio, fixedFields, auctionFields } = setupSaleType();

        auctionRadio.checked = true;
        auctionRadio.dispatchEvent(new window.Event('change'));

        expect(fixedFields.hidden).toBe(true);
        expect(auctionFields.hidden).toBe(false);
    });

    // This is the reason `required` is managed in JS rather than the HTML.
    // A hidden input that is still required blocks submission with a
    // validation message the browser cannot display, because it cannot focus
    // an invisible element — the form just silently refuses to submit.
    test('moves the required flag off whichever field group is hidden', () => {
        const { auctionRadio, fixedRadio, priceInput, startingPriceInput } = setupSaleType();

        auctionRadio.checked = true;
        auctionRadio.dispatchEvent(new window.Event('change'));

        expect(priceInput.required).toBe(false);
        expect(startingPriceInput.required).toBe(true);

        fixedRadio.checked = true;
        auctionRadio.checked = false;
        fixedRadio.dispatchEvent(new window.Event('change'));

        expect(priceInput.required).toBe(true);
        expect(startingPriceInput.required).toBe(false);
    });

    test('never leaves a hidden field marked required', () => {
        const { auctionRadio, fixedFields, auctionFields, priceInput, startingPriceInput } = setupSaleType();

        auctionRadio.checked = true;
        auctionRadio.dispatchEvent(new window.Event('change'));

        const hiddenRequired = [
            fixedFields.hidden && priceInput.required,
            auctionFields.hidden && startingPriceInput.required,
        ];

        expect(hiddenRequired).toEqual([false, false]);
    });
});

describe('defensive guards', () => {
    // Every page loads this one file. On a page with none of these elements —
    // the login page, say — main.js must do nothing rather than throw, or the
    // error kills every other listener registered after it.
    test('loads without error on a page containing none of its elements', () => {
        document.body.innerHTML = '<p>Nothing to wire up here.</p>';

        expect(() => loadMainJs()).not.toThrow();
    });

    test('loads without error on an empty document', () => {
        document.body.innerHTML = '';

        expect(() => loadMainJs()).not.toThrow();
    });
});
