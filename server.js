const express = require('express');
const app = express();
const dotenv = require('dotenv');
const logger = require('morgan');
const connectDB = require('./config/db')
const methodOverride = require('method-override');
const session = require('express-session');
const MongoStore = require('connect-mongo')(session)
const mongoose = require('mongoose');
const passport = require('passport');

dotenv.config();

app.listen(process.env.PORT, ()=>{
    console.log('Server is running, you better catch it!')
})    