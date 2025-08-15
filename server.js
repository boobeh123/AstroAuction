const express = require('express');
const app = express();
const dotenv = require('dotenv');
const logger = require('morgan');
const connectDB = require('./config/db')
const methodOverride = require('method-override');
const session = require('express-session');
const MongoStore = require('connect-mongo');
const mongoose = require('mongoose');
const passport = require('passport');
const mainRoutes = require('./routes/main');
const flash = require('connect-flash');
const auctionRoutes = require('./routes/auction');

require('dotenv').config({path: './config/.env'})

// Passport config
require('./config/passport')(passport);

connectDB();
app.set('view engine', 'ejs');
app.use(express.static('public'));
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(logger('dev'));
//Use forms for put / delete
app.use(methodOverride("_method"));
// Sessions
app.use(
    session({
        secret: process.env.SESSION_SECRET,
        resave: false,
        saveUninitialized: false,
        store: MongoStore.create({
            mongoUrl: process.env.DB_STRING,
        })
    })
  )

app.use(flash());

// Flash available to all Views
app.use((req, res, next) => {
    res.locals.success = req.flash('success');
    res.locals.errors = req.flash('errors');
    res.locals.error = req.flash('error');
    next();
});

// Passport middleware
app.use(passport.initialize())
app.use(passport.session())

app.use('/', mainRoutes);
app.use('/auction', auctionRoutes);

app.listen(process.env.PORT, ()=>{
    console.log('Server is running, you better catch it!')
})    