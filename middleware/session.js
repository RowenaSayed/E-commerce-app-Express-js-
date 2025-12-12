const session = require('express-session');
const { MongoStore } = require('connect-mongo');
const mongoose = require('mongoose');

const sessionMiddleware = session({
    secret: process.env.SESSION_SECRET || 'defaultsecret',
    resave: false,
    saveUninitialized: false,
    store: MongoStore.create({ mongoUrl: process.env.MONGO_URI }),
    cookie: {
        maxAge: 1000 * 60 * 60 * 24 * 7,
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production'
    }
});
module.exports = sessionMiddleware;