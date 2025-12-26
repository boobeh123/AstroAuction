const bcrypt = require('bcrypt')
const mongoose = require('mongoose')

const UserSchema = new mongoose.Schema({
    email: { 
        type: String,
        unique: true,
        required: true,
        lowercase: true,
        trim: true 
    },
    password: {
        type: String,
        required: true
    },
    agreeToTerms: {
        type: Boolean,
        required: true,
        default: false
    },
    image: { 
      type: String
    },
    cloudinaryId: { 
      type: String
    }
},
    { timestamps: true }
)

// Password hash middleware.
 UserSchema.pre('save', function save(next) {
  const user = this
  if (!user.isModified('password')) { return next() }
  bcrypt.genSalt(10, (err, salt) => {
    if (err) { return next(err) }
    bcrypt.hash(user.password, salt, (err, hash) => {
      if (err) { return next(err) }
      user.password = hash
      next()
    })
  })
})

// Helper method for validating user's password.
UserSchema.methods.comparePassword = function comparePassword(candidatePassword, cb) {
  bcrypt.compare(candidatePassword, this.password, (err, isMatch) => {
    cb(err, isMatch)
  })
}

module.exports = mongoose.model('User', UserSchema)