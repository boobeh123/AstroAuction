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
    },
    displayName: {
      type: String,
      default: ''
    },
    onboardingComplete: {
      type: Boolean,
      default: false
    },
    emailVerified: {
      type: Boolean,
      default: false
    },
    verificationToken: {
      type: String,
    },
    verificationTokenExpires: {
      type: Date,
    },
    passwordResetToken: {
      type: String,
    },
    passwordResetExpires: {
      type: Date,
    },
    role: {
      type: String,
      default: 'user',
    },
    tutorialStep: {
      type: Number,
      default: 0,
    },
},
    { timestamps: true }
)

// Cost factor for new password hashes. Each step up doubles the work needed
// to crack a stolen hash. Existing hashes keep working at their old cost,
// because bcrypt stores the cost inside each hash.
const BCRYPT_COST = 12

// Password hash middleware.
 UserSchema.pre('save', function save(next) {
  const user = this
  if (!user.isModified('password')) { return next() }
  bcrypt.genSalt(BCRYPT_COST, (err, salt) => {
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