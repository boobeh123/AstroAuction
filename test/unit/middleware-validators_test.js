const { matchedData } = require('express-validator');
const {
    formErrors,
    validateSignup,
    validateLogin,
    validateForgotPassword,
    validateResetPassword,
    validateListing,
} = require('../../middleware/validators');
const { mockRequest, runValidators } = require('./helpers-mocks');

/**
 * The account forms' server-side checks. The browser checks these fields
 * too, but a request doesn't have to come from the form, so the server
 * can't rely on it.
 */
async function check(chains, body) {
    const req = mockRequest({ body });
    await runValidators(chains, req);
    return { req, messages: formErrors(req).array().map((error) => error.msg) };
}

const validSignup = {
    email: 'newbidder@example.com',
    password: 'correct-horse',
    confirmPassword: 'correct-horse',
    agreeToTerms: 'yes',
};

describe('every account form needs the email as text', () => {
    // Express turns email[]=a&email[]=b into a list, and a JSON body can send
    // an object. Either one used to crash the handler with a 500 page.
    test.each([
        ['signup', validateSignup, validSignup],
        ['login', validateLogin, { password: 'correct-horse' }],
        ['forgot password', validateForgotPassword, {}],
    ])('the %s form answers a non-text email with a form error', async (_form, chains, otherFields) => {
        for (const email of [['a@example.com', 'b@example.com'], { $ne: '' }]) {
            const { messages } = await check(chains, { ...otherFields, email });

            expect(messages).toContain('Please enter a valid email address.');
        }
    });
});

describe('emails are cleaned up the same way as before', () => {
    // Existing accounts were stored with this exact clean-up. Changing it
    // would stop those people matching their own email at login.
    test('trimmed and lowercased, with the Gmail +tag removed but the dots kept', async () => {
        const { req, messages } = await check(validateLogin, {
            email: '  First.Last+promo@GMAIL.com ',
            password: 'correct-horse',
        });

        expect(messages).toEqual([]);
        expect(matchedData(req).email).toBe('first.last@gmail.com');
    });
});

describe('validateSignup', () => {
    test('accepts a complete form', async () => {
        const { messages } = await check(validateSignup, validSignup);

        expect(messages).toEqual([]);
    });

    test('requires the terms checkbox to be ticked', async () => {
        // An unticked checkbox isn't sent with the form at all
        const withoutTerms = { ...validSignup };
        delete withoutTerms.agreeToTerms;

        const { messages } = await check(validateSignup, withoutTerms);

        expect(messages).toEqual(['Please agree to the Terms of Use and Privacy Policy.']);
    });

    test('requires the two passwords to match', async () => {
        const { messages } = await check(validateSignup, { ...validSignup, confirmPassword: 'correct-horses' });

        expect(messages).toEqual(['Passwords do not match']);
    });

    test('keeps what was typed out of the error messages', async () => {
        // The messages are stored in the session until the next page shows
        // them, so a typed password must never be part of them.
        const { req } = await check(validateSignup, { ...validSignup, password: 'short1', confirmPassword: 'short1' });

        const errors = formErrors(req).array();

        expect(errors.length).toBeGreaterThan(0);
        errors.forEach((error) => expect(Object.keys(error)).toEqual(['msg']));
        expect(JSON.stringify(errors)).not.toContain('short1');
    });
});

describe('validateLogin', () => {
    test('requires a password', async () => {
        const { messages } = await check(validateLogin, { email: 'bidder@example.com', password: '' });

        expect(messages).toEqual(['Password cannot be blank.']);
    });
});

describe('validateResetPassword', () => {
    test('answers a non-text password with "Invalid request."', async () => {
        const { messages } = await check(validateResetPassword, {
            password: ['correct-horse'],
            confirmPassword: 'correct-horse',
        });

        expect(messages).toContain('Invalid request.');
    });

    test('accepts a matching pair of 8+ character passwords', async () => {
        const { messages } = await check(validateResetPassword, {
            password: 'correct-horse',
            confirmPassword: 'correct-horse',
        });

        expect(messages).toEqual([]);
    });
});

describe('validateListing', () => {
    const fixedPrice = {
        title: 'Koa wood bowl',
        description: 'Hand-turned bowl.',
        category: 'Art',
        saleType: 'fixed',
        price: '25',
    };

    test('accepts a complete fixed-price listing', async () => {
        const { messages } = await check(validateListing, fixedPrice);

        expect(messages).toEqual([]);
    });

    test("checks only the price fields for the listing's sale type", async () => {
        // A fixed-price form still sends the hidden auction fields
        const { messages } = await check(validateListing, { ...fixedPrice, startingPrice: '', durationDays: '' });

        expect(messages).toEqual([]);
    });

    test('reports every problem at once', async () => {
        const { messages } = await check(validateListing, {
            title: '',
            description: 'x'.repeat(2001),
            category: 'Spaceships',
            saleType: 'auction',
            startingPrice: '-5',
            minIncrement: 'abc',
            durationDays: '2',
            video: 'not a link',
        });

        expect(messages).toEqual([
            'Enter a title for your listing.',
            'Descriptions can be up to 2000 characters.',
            'Choose a category.',
            'Enter a valid starting price for your auction.',
            'Enter a valid minimum bid increment.',
            'Choose a valid auction duration.',
            'Enter a valid video link.',
        ]);
    });
});
