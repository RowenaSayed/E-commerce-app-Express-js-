require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const morgan = require('morgan');
const cors = require('cors');
const path = require('path');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const mongoSanitize = require('express-mongo-sanitize');
const xss = require('xss-clean');
const compression = require('compression');

// Custom Modules
const sessionMiddleware = require('./middleware/session');

// Routes Imports
const adminStatsRoutes = require('./routes/adminStats');
const userRoutes = require('./routes/users');
const productRoutes = require('./routes/products');
const categoryRoutes = require('./routes/category');
const promoRoutes = require('./routes/promos');
const reviewRoutes = require('./routes/reviews');
const wishlistRoutes = require('./routes/wishlist');
const cartRoutes = require('./routes/carts');
const orderRoutes = require('./routes/orders');
const ticketRoutes = require('./routes/tickets');
const faqRoutes = require('./routes/faq');

const app = express();
const PORT = process.env.PORT || 8000;

// 1. Security Headers
app.use(helmet());

// 2. Body Parsers (قراءة البيانات)
app.use(express.json({ limit: '10kb' })); 
app.use(express.urlencoded({ extended: true, limit: '10kb' })); 

// ============================================================
// 🔥 FIX: الحل الشامل (Nuclear Fix) لـ Node v24/v25 🔥
// هذا الكود يفك الحماية عن Query و Body و Params
// عشان مكتبات xss-clean و mongo-sanitize تشتغل غصب عنها
// ============================================================
app.use((req, res, next) => {
    ['query', 'params', 'body'].forEach((key) => {
        if (req[key] && typeof req[key] === 'object') {
            try {
                const temp = req[key]; // قراءة القيمة
                Object.defineProperty(req, key, {
                    value: temp,
                    writable: true,  // السماح بالكتابة والتعديل
                    enumerable: true,
                    configurable: true
                });
            } catch (e) {
                console.error(`Error fixing property ${key}:`, e);
            }
        }
    });
    next();
});
// ============================================================

// 3. Security & Sanitization (الآن سيعمل بدون مشاكل)
app.use(mongoSanitize()); 
app.use(xss()); 

// 4. Logging & CORS & Compression
app.use(morgan('dev'));
app.use(cors({ origin: true, credentials: true }));
app.use(compression());
app.set('trust proxy', 1);

// 5. Static & Session
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
app.use(sessionMiddleware);

// 6. Rate Limiting
const limiter = rateLimit({
    max: 100,
    windowMs: 15 * 60 * 1000,
    message: { status: 'error', message: 'Too many requests.' }
});
app.use('/api', limiter);

// 7. Routes
app.use('/api/users', userRoutes);
app.use('/api/products', productRoutes);
app.use('/api/cat', categoryRoutes);
app.use('/api/promos', promoRoutes);
app.use('/api/reviews', reviewRoutes);
app.use('/api/wishlist', wishlistRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/tickets', ticketRoutes);
app.use('/api/faq', faqRoutes);
app.use('/api/cart', cartRoutes);
app.use('/api/stats', adminStatsRoutes);

// 8. Global Error Handler
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(err.status || 500).json({
        success: false,
        message: err.message || 'Internal Server Error'
    });
});

// Database & Server
mongoose.connect(process.env.MONGO_URI)
    .then(() => {
        console.log('MongoDB Connected successfully');
        app.listen(PORT, () => {
            console.log(`Server is running on port ${PORT}`);
        });
    })
    .catch(err => console.error('Database connection error:', err));