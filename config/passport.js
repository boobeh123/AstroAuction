const LocalStrategy = require('passport-local').Strategy
const mongoose = require('mongoose')
const User = require('../models/User')

module.exports = function (passport) {
  passport.use(new LocalStrategy({ usernameField: 'email' }, async (email, password, done) => {
    try {
      const user = await User.findOne({ email: email.toLowerCase() })
      if (!user) return done(null, false, { message: 'Invalid email or password.' })

      const isMatch = await new Promise((resolve, reject) => {
        user.comparePassword(password, (err, ok) => {
          if (err) return reject(err)
          return resolve(ok)
        })
      })

      if (!isMatch) return done(null, false, { message: 'Invalid email or password.' })
      return done(null, user)
    } catch (error) {
      return done(error)
    }
  }))
  

  passport.serializeUser((user, done) => {
    done(null, user.id)
  })

  passport.deserializeUser(async (id, done) => {
    try {
      const user = await User.findById(id)
      done(null, user)
    } catch (err) {
      done(err)
    }
})
}