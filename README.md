## Description
Astro Auction is both a web application to assist with live sale tactics & a static webpage for Lost And Found, a local business in Wahiawa that reuses and repurposes items and offers them at discount. 

Phase 2~3 of the Web application is deployed live on Railway and is under development: https://astroauction.up.railway.app/

Phase 1 of the Website is deployed live on Netlify: https://astroauction.netlify.app/ (use Railway, this link was deployed for a static/landing page)

## Features
* Static webpage deployed with Netlify
* Responsive to mobile viewports
* Accessible to screen readers / Semantic HTML & ARIA
* SEO Meta tags
<!-- * Functional Contact Form  -->
* WebP image format
* Backend (db/auth in progress)

## Optimizations
* Backend + Database
* Several schemas
* Authentication
* Nodemailer
* Multer/cloudinary

## Technologies
<img src="https://profilinator.rishav.dev/skills-assets/html5-original-wordmark.svg" alt="HTML5" height="50" /><img src="https://profilinator.rishav.dev/skills-assets/css3-original-wordmark.svg" alt="CSS3" height="50" /><img src="https://profilinator.rishav.dev/skills-assets/javascript-original.svg" alt="JavaScript" height="40" />

## Version History
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
