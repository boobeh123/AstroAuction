## Description
A web page for Lost And Found & the companies web application, AstroAuction-- an in house community marketplace 

Lost And Found webpage - https://astroauction.netlify.app/

AstroAuction web app - https://astroauction.up.railway.app/


## Features
* Static webpage deployed with Netlify
* Responsive to mobile viewports
* Accessible to screen readers / Semantic HTML & ARIA
* SEO Meta tags
* WebP image format
* Server with database and authentication
* CRUD opeartions
* User profiles & profile pictures

## Optimizations
* Design/develop landing on `/auction` route
  * ~~Attach a user to listings~~
  * Detailed listing page
  * A scrolling red banner which is displayed to all users
    * May need to research how
  * Embed a video player which represents a livestream or an anchor href to the livestream?
    * May need to research if allowed/TOS
* ~~Design/develop landing & functionality on `/profile` route~~
  * Administrator control panel
    * To moderate the listings/images from users
  * ~~Profile picture uploads~~
* ~~Add forms after `/signup` redirection~~
* ~~CRUD operations (post auctions/listings/delete auctions)~~
* ~~Auction schema~~
* Nodemailer for contact form
* ~~Multer/cloudinary~~
* Unit tests
* Integration tests
* E2E tests

## Technologies
<img src="https://profilinator.rishav.dev/skills-assets/html5-original-wordmark.svg" alt="HTML5" height="50" /><img src="https://profilinator.rishav.dev/skills-assets/css3-original-wordmark.svg" alt="CSS3" height="50" /><img src="https://profilinator.rishav.dev/skills-assets/javascript-original.svg" alt="JavaScript" height="40" />

## Version History
# 🛠️ AstroAuction Patch 0.9.017
📅 **Release Date:** January 27th, 2026

## 📢 Developer's Notes 

- Bug: Guest-users who attempted to create a listing received error 500
  - Fix: Dynamically render two forms, which determines if you are a guest or user
- Removed a few font awesome icons from buttons
- Add terms of use text content
- Styling to mobile/tablet viewports
- I used the `:has()` CSS pseudo-class to conditionally style elements. I can apply styles to an element based on whether it contains a specific child element. For example:
  - `body:has(.auction-page)` means to 'apply styles to the `<body>` tag only when it contains an element with the class of `auction-page`.'

  ---------------------------------------------------------------------------------------------------------------------------
# 🛠️ AstroAuction Patch 0.9.016
📅 **Release Date:** January 26th, 2026

## 📢 Developer's Notes - Timeline can restore

- Added a landing page for `/terms` and will use Termly for this
- Optimized middleware for DRY code
- Styled the navigation partial & `/auction` route
- I accidentally deleted all my local changes with `git restore .` 
  - Right-clicking a file, then opening a timeline saved my day

---------------------------------------------------------------------------------------------------------------------------
# 🛠️ AstroAuction Patch 0.9.015
📅 **Release Date:** January 19th, 2026

## 📢 Developer's Notes - Delete profile

- Registered users can now delete their profile
  - ~~The listings the user posts do not delete when the profile is deleted~~
    - ~~You must delete your listings then your profile if you want to ensure data is lost~~
  - All data (listings & profile pic) IS deleted when deleting a profile

---------------------------------------------------------------------------------------------------------------------------
# 🛠️ AstroAuction Patch 0.9.014
📅 **Release Date:** January 18th, 2026

## 📢 Developer's Notes 

- A favicon now renders on browser tabs
- Refactored accessibility on the frontend 
- Flash messages has icons & an animation

---------------------------------------------------------------------------------------------------------------------------
# 🛠️ AstroAuction Patch 0.9.013
📅 **Release Date:** January 17th, 2026

## 📢 Developer's Notes 

- The landing page to update user personal information has been styled 
- Our header partial now can determine which page a user is on and render buttons dynamically.
  - Our header partial has been deleted & split into 3 different partials
    - head, nav, footer

---------------------------------------------------------------------------------------------------------------------------
# 🛠️ AstroAuction Patch 0.9.012
📅 **Release Date:** January 15th, 2026

## 📢 Developer's Notes 

- A button has been added to every listing, which I intend to render the seller's profile, more details to the listing, and a comment section
  - I haven't built a comment section before, but I wondered if I could build my own "social media" network/website. Perfect time to learn
- The edit profile page has been styled

---------------------------------------------------------------------------------------------------------------------------
# 🛠️ AstroAuction Patch 0.9.011
📅 **Release Date:** January 12th, 2026

## 📢 Developer's Notes - Onboarding Flow

- New accounts are now given some direction after registration

---------------------------------------------------------------------------------------------------------------------------
# 🛠️ AstroAuction Patch 0.9.010
📅 **Release Date:** January 8th, 2026

## 📢 Developer's Notes

- Auction listings now show the image you upload

Jan 9th:
- Added status codes to `try/catch` blocks and render `500.ejs` instead of `404.ejs`
- Created landing pages for status code responses
---------------------------------------------------------------------------------------------------------------------------
# 🛠️ AstroAuction Patch 0.9.009
📅 **Release Date:** January 7th, 2026

## 📢 Developer's Notes

- Users who create listings can delete their own listing
- Unregistered users are now defined as `null` vs `undefined`
  - Explicitly passing this value allows EJS templating & conditionals to have less errors with rendering
---------------------------------------------------------------------------------------------------------------------------
# 🛠️ AstroAuction Patch 0.9.008
📅 **Release Date:** January 6th, 2026

## 📢 Developer's Notes

- Update `getAuction` & `postAuction` methods
  - Our header partial now displays logged in users on `/auction` route
  - User profile pictures and first name now displays on `/auction` route
  - Creating a listing now stores user id into the database
- Update `uploadProfilePicture` method
  - If the user already has a picture uploaded, 
    - The previous picture is deleted & the new picture is stored and displayed
    - I do not want to keep your data and the code reflects this
- Update to our Auction Schema
  - My first time structuring relational data with MongoDB
    - The `populate()` method used in our `postAuction` method explicitly passes in user images & first name
      - Sensitive fields like email, password, etc. are not included and the code reflects this
- Render referenced data & remove video player from `/auction` route
  - User profile picture & first name now show on listing
  - Video player will return along with detailed listing info
    - A modal or new route could be used here

---------------------------------------------------------------------------------------------------------------------------
# 🛠️ AstroAuction Patch 0.9.007
📅 **Release Date:** January 2nd, 2026

## 📢 Developer's Notes - **Render images dynamically, Updating personal info, Bug fix with signup/auth**

- AstroAuction Authentication now uses `Passport.js` Local strategy to sign up and log in.
  - Previous auth was generated slop. I'm sorry for being so lazy.
    - I referenced `Passport.js` documentation to implement authentication properly with this update.
  - `Passport.js ensureAuth` is being used to protect routes. 
- The `/profile` route now displays your profile picture if one is uploaded, otherwise a placeholder image is shown
  - Data is rendered if you update your information
- The `/profile/edit` route now allows you to update your personal information
  - This personal information will be displayed on listing cards within the `/auction` route

---------------------------------------------------------------------------------------------------------------------------
# 🛠️ AstroAuction Patch 0.9.006 — PFP
📅 **Release Date:** January 2nd, 2026

## 📢 Developer's Notes - **Backend functionality on `/profile`**

- File uploads (image only) are now supported
  - Uploading an image will be stored into cloudinary
    - This applies to your profile picture 
    - This is also how images from your listings/auction/items will be stored
  - Currently images are uploaded, but not rendered on the (View) profile page
    - Will be added

---------------------------------------------------------------------------------------------------------------------------
# 🛠️ AstroAuction Patch 0.9.005 — Dissect Da Slop++
📅 **Release Date:** December 27th, 2025

## 📢 Developer's Notes - **Optimize `/auction` page, versioning numbers**

- Move `Profile` button into the header partial
  - Visible to logged in users
- Cleanup HTML within `auction.ejs`
  - All of it was slop
    - Should be slightly more digestable now
- Rename several rules to use kebab case
- Instead of `0.9d` I will use `0.9.005` and yes I scrolled all the way down to determine which patch/update contained a change worth a version number

---------------------------------------------------------------------------------------------------------------------------
# 🛠️ AstroAuction Patch 0.9d — Backend until we're done
📅 **Release Date:** December 26th, 2025

## 📢 Developer's Notes - **Personal update, User profiles, styling `/auction` route**

![wya](watdoing.gif)
- Render landing page for user profiles & everything behind it
  - Add `/profile` route 
  - Add `profileController` methods 
    - Add GET Request 
  - Add two properties to `User` schema
    - This will be used to store user avatars/profile pictures
  - Render landing page on `/profile`
- Render dynamic data on `/auction` route
  - Logged in users will see their email displayed within the header as the default
    - This can be changed to render name or username instead of email
- Style landing page on `/auction`
  - Add header partial to landing page on `/auction`

---------------------------------------------------------------------------------------------------------------------------
# 🛠️ AstroAuction Patch 0.9c — C.R.-no .U.D yet
📅 **Release Date:** December 22nd, 2025

## 📢 Developer's Notes - **Backend functionality testing**

- Registered users (& temporarily all users ) can create listings
  - Defined the Auction Schema
  - Added a form
  - Add a POST request to the `/auction` route
  - Add `postAuction` method
- Data can now be displayed dynamically - listings created from registered users are visible to all users
  - Update `getAuction` method to dynamically render data from the database
  - Use EJS templating to iterate through the data

---------------------------------------------------------------------------------------------------------------------------
# 🛠️ AstroAuction Patch 0.9b — I'm Back from the mist
📅 **Release Date:** December 18th, 2025

## 📢 Developer's Notes - **Frontend changes to static landing page**

- I needed a break and this is fun again
  - The real fun will be reading my code from half a year ago
    - Muscle memory is very real & I'll be ok

---------------------------------------------------------------------------------------------------------------------------
# 🛠️ AstroAuction Patch 0.9a — Not quite a MVP yet - Plans for '/auction' page
📅 **Release Date:** August 16th, 2025

## 📢 Developer's Notes - **Destroy sessions, Optimize SVG, Unit tests, Plans for '/auction' route**

- The core logout functionality worked, but did not destroy the session
  - Ideally you want to destroy the session to optimize for security
    - We optimized
- The SVGs used on our login and signup animated indefinitely and uses your CPU to render
  - I updated the animation to occur 1 time and stop
    - I considered using webGL for animations/backgrounds since it uses the GPU to render
      - Advised this is like using a rocket to fly to the grocery store
      - I still would like to try webGL to render a background someday
- I want to approach this project differently
  - I'll dive deep vs wide on how the web application functions
    - Since this project is intended to be used in a business, I must have my ducks in a row
  - I am conducting experimentation on my functionalities 
    - Unit testing our authentication to ensure no sneaky weird business can slip through
      - Validating and sanitizing every input & especially inputs that gets stored in our database
  - Still need to test the '/signup' route (& the several endpoints that the '/auction' route will have. rip future me)
- If you're reading this, you have uncovered the scrolls from which it is written
  - The auction page will have a "staging" area
    - This area will contain a livestream from the business owner
      - The business owner has hinted it could be Facebook live, or instagram, or tiktok?
    - The business owner hinted to look toward eBay Live
  - The auction page will have dynamic posts
    - These posts can be created from registered users & is not hard-coded in HTML
  - The auction page will have a profile area
    - Will also serve as an admin control panel but dynamically rendered? 
      - May need to lookup best practices & why/whynot it should be on a separate protected route or if dynamically rendered is fine?

---------------------------------------------------------------------------------------------------------------------------
# 🛠️ AstroAuction Patch 0.9 — Users can logout
📅 **Release Date:** August 15th, 2025

## 📢 Developer's Notes - **Rendering dynamic data, Logout functionality, Redirecting protected routes**

- I forgot how to render data from the database onto a web page
  - The moment I saw the code to do it, I remembered how to do it
    - Understanding > Memorization
- The login/signup buttons are now dynamically rendered
  - The website can determine whether you are a guest or a registered user and displays content accordingly
    - If you are a registered user, you will see a different button
- If you try to access the '/login' or '/signup' routes as registered user, you will be redirected
  - You could always log out and create a new account, but the point is to protect the routes through redirection
---------------------------------------------------------------------------------------------------------------------------
# 🛠️ AstroAuction Patch 0.8 — Users can login
📅 **Release Date:** August 14th, 2025

## 📢 Developer's Notes - **Login page enabled, Validate login credentials, Render auction page**

- I used Passport.js and localStrategy for authentication. I thought I could use the code from a previous project. Nope
  - Mongoose no longer accepts callbacks
    - Code must use async/await 
- The landing page on the '/auction' route now renders to both guest & authenticated users
  - Interacting may require authentication, but looking should work for both
    - Nothing to interact with atm, only text on a page
---------------------------------------------------------------------------------------------------------------------------
# 🛠️ AstroAuction Patch 0.7 — Validation & Flash
📅 **Release Date:** August 11th, 2025

## 📢 Developer's Notes - **Validating POST requests & displaying notifications**

- After enabling authentication, there was 0 response for user experience
  - I used express-validator to display messages during signup
    - These messages appear near the inputs and display tool tips on how to fill out the form
  - I used connect-flash to display success & error notifications during signup
    - These notifications appear near the header and display popups explaining why your account was not created

---------------------------------------------------------------------------------------------------------------------------
# 🛠️ AstroAuction Patch 0.6 — Signup page & authentication
📅 **Release Date:** August 10th, 2025

## 📢 Developer's Notes - **Add form to signup page, Enable authentication**

- I didn't get too much done and copied the same design from our login page on to the signup page
  - I would like to create differences between the two if I do not use a completely different design
    - I figured I should get the functionality of authentication going before worrying about styling
- The barebones of passport/localStrategy works and accounts can now be created
  - The email and password you type into this form will be saved into a database
    - There's no verification on the email so you could use notarealemail@noteven.com and your account will be created
---------------------------------------------------------------------------------------------------------------------------
# 🛠️ AstroAuction Patch 0.5 — Backend stuff
📅 **Release Date:** August 9th, 2025

## 📢 Developer's Notes - **Connect to MongoDB, Define UserSchema, Passport & localStrategy, Render Views, free SVG generator**

- I've been slacking on these notes because sometimes I write things unrelated to the project. I also write things related to the project.
  - I don't know who reads this, but hello
- I ran into a couple of errors when connecting to MongoDB with Mongoose
  - connect-mongo no longer needs a session argument passed in
  - using the new keyword on MongoStore results in a TypeError
    - `MongoStore.Create({})` must be used instead
      - I probably have to update my other full stack apps
- Added two GET routes on `/login` & `/signup`
  - Only renders a hello world for now
- I've been getting AI to create SVGs for me and stumbled across a collection of free SVG generators
  - https://www.fffuel.co/
    - I generated some Star SVGs from this website and used it on our login and signup page
      - I played around with translate(x, y) to move the SVGs across the background
- Rendered a form with inputs for the login page
  - It's purely frontend, the POST route for postLogin is not wired up with passport/localStrategy yet
---------------------------------------------------------------------------------------------------------------------------
# 🛠️ AstroAuction Patch 0.4 — Migrate from Netlify to Railway
📅 **Release Date:** August 7th & 8th, 2025

## 📢 Developer's Notes - **Install dependencies, Wire up backend, Render Views, Deploy to Railway **

- Heard ChatGPT-5 was FREE for a week
  - "DO YOU HAVE ANY IDEA HOW MUCH THIS IS WORTH"
---------------------------------------------------------------------------------------------------------------------------
# 🛠️ AstroAuction Patch 0.3 — Brain storming
📅 **Release Date:** August 6th, 2025

---

## 📢 Developer's Notes - **Styling changes & Meta tag updates**

- Added some padding changes and update to our meta tags
---------------------------------------------------------------------------------------------------------------------------
# 🛠️ AstroAuction Patch 0.2 — Hero section
📅 **Release Date:** August 4th, 2025

---

## 📢 Developer's Notes - **Hero section & image, etc**

- The business owner provided the hero image and a few others
---------------------------------------------------------------------------------------------------------------------------
# 🛠️ AstroAuction Patch 0.1 — Initial Commit
📅 **Release Date:** July 30th & August 4th, 2025

---

## 📢 Developer's Notes - **Meta tags, organizing stylesheets, creating navigation**

- I had to work late on Friday & come in on Saturday (August 1st & 2nd)
  - Not an excuse, but I will have signifcantly more free time this week than the previous week
---------------------------------------------------------------------------------------------------------------------------
