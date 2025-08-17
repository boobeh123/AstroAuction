/* @@ Using chatGPT STUDY to learn unit testing                                 @@ **
** @@ The comments ARE FROM ME attempting to Pseudocode what is even happening  @@ **
** @@                                                                           @@ */
const { validationResult } = require('express-validator');
// const { ensureLoginValidation } = require('../routes/main');
const { ensureLoginValidation } = require('../../routes/main');

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
    // A test method which checks the first index on an array. The element could be a string. The result compares the result string to the test string. If the input is blank, the first error message should be "__ is required"
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

// TODO: Email edge cases, password edge cases, script injection/check sanitization 

  /* 

  const runValidation = async (rules, data) => {
  const req = { body: data };   // fake Express request object
  for (let rule of rules) {
    await rule.run(req);        // express-validator rule attaches errors to req
  }
  return validationResult(req); // gathers all validation results into one object
};

Because we use mock data, we do not need to spin up the full Express server or Passport. We mock the req.body enough for unit testing validation


*/