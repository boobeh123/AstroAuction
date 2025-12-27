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

## Optimizations
* Design/develop landing on `/auction` route
* Design/develop landing & functionality on `/profile` route
  * Administrator control panel
* Add forms after `/signup` redirection
* CRUD operations (post auctions/listings)
* ~~Auction schema~~
* Nodemailer for contact form
* Multer/cloudinary
* Unit tests
* Integration tests
* E2E tests

## Technologies
<img src="https://profilinator.rishav.dev/skills-assets/html5-original-wordmark.svg" alt="HTML5" height="50" /><img src="https://profilinator.rishav.dev/skills-assets/css3-original-wordmark.svg" alt="CSS3" height="50" /><img src="https://profilinator.rishav.dev/skills-assets/javascript-original.svg" alt="JavaScript" height="40" />

## Version History
# 🛠️ AstroAuction Patch 0.9d — Backend until we're done
📅 **Release Date:** December 26th, 2025

## 📢 Developer's Notes - **User profiles**
![wya](watdoing.gif)
- Render landing page for user profiles & everything behind it

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
