/* @@ Using chatGPT STUDY to learn unit testing                                 @@ **
** @@ The comments ARE FROM ME attempting to Pseudocode what is even happening  @@ **
** @@                                                                           @@ */
const { validationResult } = require('express-validator');
// const { ensureLoginValidation } = require('../routes/main');
const { ensureLoginValidation } = require('../../middleware/auth');

// helper to run validators on fake input <- from chatgpt
// We have runValidation(), an async function with two paramters: rules and data
const runValidation = async (rules, data) => {
    // We are storing an object into a variable. The property name is body with a key-value pair of data. 
    // Data is an argument passed into runValidation(). Looking ahead, Data should be an object
    const req = { body: data };
    // Console logs to see what pops up -- have not seen what the console logs
    console.log(req);
    console.log(req.body);
    console.log(req.data);
    console.log(rules);
    // We iterate through rules. Rules is an argument passed into runValidation(). Looking ahead, we pass ensureLoginValidation, which is an array of functions
    for (let rule of rules) {
        // The rules argument will be an array of functions. We iterate through each function and pass in the rule? What is the rule? 
        // Console.logs to see what is the rule -- have not seen what console logs
        // console.log(rule)
        // console.log(rules)
        // A promise that resolves. If rule is a function, we are passing req into the function. req is an object containing fake input (login credentials)
        await rule.run(req);
    }
    // Return the validation result, which uses express-validator methods
    return validationResult(req);
};

// A test method which prints the condition: fails when input is empty
test('fails when email is blank', async () => {
    // The result is a promise that resolves. We are calling the runValidation() function and passing in 2 arguements: an array and an object
    const result = await runValidation(ensureLoginValidation, { email: '', password: 'secret' });
    // A test method which compares the result to the test result. If the result is empty, the test should evaluate as false? Not sure I understand. May need to see console logs
    expect(result.isEmpty()).toBe(false);
    // A test method which checks the first index on an array. The element could be a string. The result compares the result string to the test string. If the input is blank, the first error message should be "Enter a valid email" -- the previous test tested for username and I edited the test to test for emails. String was updated but not this comment
    expect(result.array()[0].msg).toBe('Enter a valid email');
});

// A test method which prints the condition: passes when email and password are valid? Does valid mean right format, but wrong credentials? 
test('passes when email and password are valid', async () => {
    // The result is a promise that resolves. We are calling the runValidation() function and passing in 2 arguments: an array and an object
    const result = await runValidation(ensureLoginValidation, { email: 'bob@example.com', password: 'secret' });
    // A test method which compares the result to the test result. If the result is empty, the test should evaluate as true-- meaning the input is blank. The above function sort of makes sense after reaching to this function
    expect(result.isEmpty()).toBe(true);
});


// Additional tests added in after pseudocode
// Covered 1 success edge case &&  3 failure cases (bad email, empty password, empty email)
test('fails when password is blank', async () => {
    const result = await runValidation(ensureLoginValidation, { email: 'bob@example.com', password: '' });
    expect(result.isEmpty()).toBe(false);
    expect(result.array()[0].msg).toBe('Password cannot be blank');
  });

  test('fails when email is not valid', async () => {
    const result = await runValidation(ensureLoginValidation, { email: 'not-an-email', password: 'secret' });
    expect(result.isEmpty()).toBe(false);
    expect(result.array()[0].msg).toBe('Enter a valid email');
  });

  /* 
Think of isEmpty() as "are there any validation errors?" rather than "is the input empty?"
isEmpty() does NOT check if the input is blank. Instead, it checks if the validation result contains any errors. 

// When validation passes (no errors):
const result = await runValidation(rules, validData);
result.isEmpty() // Output -> true (no validation errors)

// When validation fails (has errors):
const result = await runValidation(rules, invalidData);
result.isEmpty() // Output -> false (has validation errors) 

.trim() → remove leading/trailing whitespace (no accidental " bob@example.com ").
.escape() → ensures special characters (like < >) are HTML-escaped. Stops <script> injection into error messages.

Validation answers:
“Is this data allowed?”
Validation = does it meet rules? (correct email, password length)

Sanitization answers:
“If it is allowed, do we need to clean it up before storing or using it?”
Sanitization = even if valid, do we clean the data before saving or rendering?

When a failed test suite appears:
Do we change the code (the validator) or the test (the expected behavior)?

The procedure is:
Decide on intended behavior (business rule).
Make sure code + tests agree on that behavior.

Right now:
Code (ensureLoginValidation) → uses normalizeEmail() only → "BOB@example.com".
Test → expects everything lowercased → "bob@example.com".
That’s the mismatch.

If your app should treat all emails case-insensitively (which is 99% of login systems), then the test is correct. 
You should update ensureLoginValidation to return a lowercase string.
 */

test('trims whitespace from email', async () => {
  const result = await runValidation(ensureLoginValidation, { email: '   bob@example.com   ', password: 'password123' });
  expect(result.isEmpty()).toBe(true);
});

test('normalizes email to lowercase', async () => {
  const result = await runValidation(ensureLoginValidation, { email: 'BOB@EXAMPLE.COM', password: 'password123' });
  expect(result.isEmpty()).toBe(true);
});

test('rejects short password', async () => {
  const result = await runValidation(ensureLoginValidation, { email: 'bob@example.com', password: '1' });
  expect(result.isEmpty()).toBe(false);
  expect(result.array()[0].msg).toBe('Password must be at least 3 characters');
});

test('rejects overly long password', async () => {
  const result = await runValidation(ensureLoginValidation, { email: 'bob@example.com', password: 'a'.repeat(200) });
  expect(result.isEmpty()).toBe(false);
  expect(result.array()[0].msg).toBe('Password cannot be longer than 128 characters');
});

test('escapes potential XSS in password', async () => {
  const result = await runValidation(ensureLoginValidation, { email: 'bob@example.com', password: '<script>alert(1)</script>' });
  expect(result.isEmpty()).toBe(true);
});


// Tests I should be able to write from scratch
test('normalizes email by lowercasing entire address', async () => {
  const result = await runValidation(ensureLoginValidation, { email: 'BOB@EXAMPLE.COM', password: 'helloworld' });
  expect(result.isEmpty()).toBe(true)

})
test('normalizes email by lowercasing only domain', async () => {
  const result = await runValidation(ensureLoginValidation, { email: 'bob@EXAMPLE.COM', password: 'helloworld' });
  expect(result.isEmpty()).toBe(true);
})