jest.mock('../../controller/authController');

const express = require('express');
const request = require('supertest');
const authController = require('../../controller/authController');

/**
 * Logging out changes state, so it has to be a POST. As a plain GET link,
 * any other website could log people out with something like
 * <img src="https://astroauction.up.railway.app/logout">, because browsers
 * send the login cookie along with requests like that.
 *
 * The controller is mocked to a bare 200 response, so a failure here can
 * only mean the route wiring is wrong.
 */
function buildApp() {
    const app = express();
    app.use(express.urlencoded({ extended: false }));

    // Stands in for Passport and connect-flash
    app.use((req, res, next) => {
        req.isAuthenticated = () => true;
        req.user = { id: '507f1f77bcf86cd799439013' };
        req.flash = () => {};
        next();
    });

    app.use('/', require('../../routes/authRoutes'));
    return app;
}

beforeEach(() => {
    jest.clearAllMocks();

    Object.keys(authController).forEach((handler) => {
        authController[handler].mockImplementation((req, res) => res.status(200).send('ok'));
    });
});

test('POST /logout reaches postLogout', async () => {
    await request(buildApp()).post('/logout').expect(200);

    expect(authController.postLogout).toHaveBeenCalled();
});

test('GET /logout no longer logs anyone out', async () => {
    await request(buildApp()).get('/logout').expect(404);

    Object.values(authController).forEach((handler) => expect(handler).not.toHaveBeenCalled());
});
