const { validationResult } = require('express-validator');
const { ensureLoginValidation } = require('../../middleware/auth');

const runValidation = async (rules, data) => {
    const req = { body: data };
    for (let rule of rules) {
        await rule.run(req);
    }
    return validationResult(req);
};

describe("ensureLoginValidation is used for POST requests on the /login route (/routes/main)", () => {
  describe('valid cases', () => {
    it("accepts request when both credentials are valid", async () => {
      const result = await runValidation(ensureLoginValidation, { email: 'bob@example.com', password: 'secret' });
      expect(result.isEmpty()).toBe(true);
    });

    it("accepts requests when email has surrounding whitespace", async () => {
      const result = await runValidation(ensureLoginValidation, { email: '   bob@example.com   ', password: 'password123' });
      expect(result.isEmpty()).toBe(true);
    });

    it("accepts request when email is uppercase", async () => {
      const result = await runValidation(ensureLoginValidation, { email: 'BOB@EXAMPLE.COM', password: 'password123' });
      expect(result.isEmpty()).toBe(true);
    });

    it(`accepts request when password contains with HTML entities`, async () => {
      const result = await runValidation(ensureLoginValidation, { email: 'bob@example.com', password: '<script>alert(1)</script>' });
      expect(result.isEmpty()).toBe(true);
    });
  
    it(`accepts request when email domain is lowercase`, async () => {
      const result = await runValidation(ensureLoginValidation, { email: 'bob@EXAMPLE.COM', password: 'helloworld' });
      expect(result.isEmpty()).toBe(true);
    });
  })

  describe('invalid cases', () => {
    it("rejects request when email is blank", async () => {
          const result = await runValidation(ensureLoginValidation, { email: '', password: 'secret' });
          expect(result.isEmpty()).toBe(false);
          expect(result.array()[0].msg).toBe('Enter a valid email');
    });
  
    it("rejects request when password is blank", async () => {
      const result = await runValidation(ensureLoginValidation, { email: 'bob@example.com', password: '' });
      expect(result.isEmpty()).toBe(false);
      expect(result.array()[0].msg).toBe('Password cannot be blank');
    });
  
    it("rejects request when email format is invalid", async () => {
      const result = await runValidation(ensureLoginValidation, { email: 'not-an-email', password: 'secret' });
      expect(result.isEmpty()).toBe(false);
      expect(result.array()[0].msg).toBe('Enter a valid email');
    });
  
    it("rejects request when password is shorter than 3 characters", async () => {
      const result = await runValidation(ensureLoginValidation, { email: 'bob@example.com', password: '1' });
      expect(result.isEmpty()).toBe(false);
      expect(result.array()[0].msg).toBe('Password must be at least 3 characters');
    });
  
    it("rejects request when password is longer than 128 characters", async () => {
      const result = await runValidation(ensureLoginValidation, { email: 'bob@example.com', password: 'helloworld'.repeat(13) });
      expect(result.isEmpty()).toBe(false);
      expect(result.array()[0].msg).toBe('Password cannot be longer than 128 characters');
    });

  })
  
});