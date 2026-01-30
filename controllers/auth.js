const passport = require('passport')
const validator = require('validator')
const User = require('../models/User')
// const Contact = require('../models/Contact');
const nodemailer = require('nodemailer');
const { createTransporter } = require('../config/mailer');

module.exports = {

    getLogin: async (req, res) => {

      try {
        if (req.user) {
          return res.redirect('/auction')
        } else {
          res.render('login.ejs');
        }
    } catch(err) {
        console.error(err)
        res.status(500).render('500.ejs');
      }
    },

    getSignup: async (req, res) => {

      try {
        if (req.user) {
          return res.redirect('/auction')
        } else {
          res.render('signup.ejs');
        }
    } catch(err) {
        console.error(err)
        res.status(500).render('500.ejs');
      }

    },

    postSignup: async (req, res, next) => {
      console.log('Nodemailer config - debugging:', {
        user: process.env.EMAIL_NAME,
        hasPassword: !!process.env.EMAIL_PASSWORD
      });
      const validationErrors = []
      if (!validator.isEmail(req.body.email)) validationErrors.push({ msg: 'Please enter a valid email address.' })
      if (!validator.isLength(req.body.password, { min: 3 })) validationErrors.push({ msg: 'Password must be at least 8 characters long' })
      if (req.body.password !== req.body.confirmPassword) validationErrors.push({ msg: 'Passwords do not match' })
    
      if (validationErrors.length) {
        req.flash('errors', validationErrors)
        return res.redirect('../signup')
      }
      req.body.email = validator.normalizeEmail(req.body.email, { gmail_remove_dots: false })

      try {
        const existingUser = await User.findOne({ email: req.body.email })
        if (existingUser) {
          req.flash('errors', {msg: "Account with that email address or username already exists."})
          return res.redirect('/signup')
        }

        const user = new User({
          role: 'User',
          email: req.body.email,
          password: req.body.password,
          agreeToTerms: req.body.agreeToTerms,
          displayName: '',
          image: '',
          cloudinaryId: '',
          onboardingComplete: false,
          emailVerified: false,
        })

        await user.save()
        req.login(user, async function(err) {
          if (err) { return next(err); }
          

          try {
            const transporter = createTransporter();
    
            const mailOptions = {
              from: `Astro Auction ${process.env.EMAIL_NAME}`,
              to: user.email,
              subject: 'Welcome to Astro Auction - Please verify your email',
              html: `
              <!DOCTYPE html>
              <html>
              <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <title>Welcome to Astro Auction</title>
                <style>
                  body {
                    background: #f5f7fa;
                    margin: 0;
                    padding: 0;
                    font-family: 'Roboto', Arial, sans-serif;
                  }
                  .email-container {
                    max-width: 480px;
                    margin: 2rem auto;
                    background: #fff;
                    border-radius: 12px;
                    box-shadow: 0 4px 24px rgba(102,126,234,0.10);
                    padding: 2rem 1.5rem;
                  }
                  .header {
                    color: #185a9d;
                    font-size: 1.5rem;
                    font-weight: 700;
                    margin-bottom: 1rem;
                    text-align: center;
                  }
                  .content {
                    color: #333;
                    font-size: 1.1rem;
                    margin-bottom: 1.5rem;
                  }
                  .message {
                    background: #f1f8e9;
                    border-left: 4px solid #43cea2;
                    padding: 1rem;
                    margin: 1.5rem 0;
                    font-style: italic;
                    color: #2e7d32;
                  }
                  .footer {
                    color: #888;
                    font-size: 0.95rem;
                    text-align: center;
                    margin-top: 2rem;
                  }
                  @media only screen and (max-width: 600px) {
                    .email-container {
                      padding: 1rem 0.5rem;
                    }
                    .header {
                      font-size: 1.2rem;
                    }
                    .content {
                      font-size: 1rem;
                    }
                  }
                </style>
              </head>
            <body>
              <div class="email-container">
                <div class="header">Thank you for joining Astro Auction!</div>
                <div class="content">
                <p>Hello</p>
                <p>We're excited to have you join our local marketplace community!</p>
                <p>If you have any questions, feel free to reach out to us.</p>
                </div>
              <div class="footer">
                Best regards,<br>
                The Astro Auction Team<br>
                <a href="https://astroauction.up.railway.app/" style="color:#185a9d;text-decoration:none;">Astroauction</a>
              </div>
              <div style="margin-top:2rem; text-align:center;">
                <a href="https://x.com/boobeh123" style="margin:0 8px; display:inline-block;" title="X" target="_blank">
                  <img src="https://cdn.jsdelivr.net/gh/simple-icons/simple-icons/icons/x.svg" alt="X" width="28" height="28" style="vertical-align:middle; border-radius:50%;">
                </a>
                <a href="https://github.com/boobeh123/" style="margin:0 8px; display:inline-block;" title="GitHub" target="_blank">
                  <img src="https://cdn.jsdelivr.net/gh/simple-icons/simple-icons/icons/github.svg" alt="GitHub" width="28" height="28" style="vertical-align:middle; border-radius:50%;">
                </a>
                <a href="https://bobby-asakawa.netlify.app/" style="margin:0 8px; display:inline-block;" title="Portfolio" target="_blank">
                  <img src="https://cdn.jsdelivr.net/gh/simple-icons/simple-icons/icons/internetarchive.svg" alt="Portfolio" width="28" height="28" style="vertical-align:middle; border-radius:50%;">
                </a>
              </div>
              <div style="color:#aaa; font-size:0.95rem; margin-top:1.5rem; text-align:center;">
                You are receiving this email because you contacted Astro Auction via our website.<br>
                If you did not make this request, you can safely ignore this email.
              </div>
              </div>
            </body>
              </html>
              `
            };
          
            await transporter.sendMail(mailOptions);
            console.log('Welcome email sent to:', user.email);
          } catch (err) {
            console.error('Failed to send welcome email:', err.message);
          }

          res.redirect('/onboard');
        });
      } catch(err) {
        return next(err)
      }
    },

    postLogin: async (req, res, next) => {
      const validationErrors = []
      if (!validator.isEmail(req.body.email)) validationErrors.push({ msg: 'Please enter a valid email address.' })
      if (validator.isEmpty(req.body.password)) validationErrors.push({ msg: 'Password cannot be blank.' })
  
      if (validationErrors.length) {
        req.flash('errors', info.message)
        return res.redirect('/login')
      }
      
      req.body.email = validator.normalizeEmail(req.body.email, { gmail_remove_dots: false })
  
      passport.authenticate('local', (err, user, info) => {
        if (err) { return next(err) }
        if (!user) {
          req.flash('errors', info.message)
          return res.redirect('/login')
        }
        req.logIn(user, (err) => {
          if (err) { return next(err) }
          req.flash('success', 'Success! You are logged in.')
          res.redirect(req.session.returnTo || '/auction')
      })
    })(req, res, next)
  },

      getLogout: async (req, res) => {

        try {
          req.logout((err) => {
              if (err) {
                  console.error('Logout error:', err);
                  req.flash('errors', 'Error during logout');
                  return res.redirect('/');
              }
              
              req.session.destroy((err) => {
                  if (err) {
                      console.error('Session destruction error:', err);
                      return res.redirect('/');
                  }
  
                  req.user = null;
                  res.clearCookie('connect.sid');
                  res.redirect('/');
              });
          });

        } catch(err) {
            console.error(err)
            res.status(500).render('500.ejs');
          }
        
    }

}