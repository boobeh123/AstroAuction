const mongoose = require('mongoose')

// Treat query operators like $ne or $gt that arrive in request data as plain
// values, so a request can't turn "find this email" into "find any email" by
// sending { "$ne": "" } where an email belongs. Operators the app writes on
// purpose are wrapped in mongoose.trusted() so this guard leaves them alone.
mongoose.set('sanitizeFilter', true)

// Connects once and returns the driver's client, which the session store
// shares instead of opening a second connection. The timeouts make a
// connection attempt fail after 10 seconds instead of hanging when the
// database can't be reached.
const connectDB = async () => {
  const conn = await mongoose.connect(process.env.DB_STRING, {
    serverSelectionTimeoutMS: 10_000,
    connectTimeoutMS: 10_000,
  })

  console.log(`MongoDB Connected: ${conn.connection.host}`)

  return conn.connection.getClient()
}

module.exports = connectDB
