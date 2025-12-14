require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const path = require('path');
const sessionMiddleware = require('./middleware/session');
// const upload = require('./utilities/fileUpload');   
const app = express();
const PORT = process.env.PORT || 8000;

// إعداد CORS و session
app.set('trust proxy', 1);
app.use(cors({
    origin: true,
    credentials: true
}));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
app.use(express.json());
app.use(sessionMiddleware);

// Import routes
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

// Use routes
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

// Test route
app.get('/test-session', (req, res) => {
    if (!req.session.views) req.session.views = 0;
    req.session.views++;
    res.json({ views: req.session.views, sessionID: req.sessionID, session: req.session });
});

mongoose.connect(process.env.MONGO_URI)
    .then(() => {
        console.log('MongoDB Connected successfully');
        app.listen(PORT, () => {
            console.log(`Server is running on port ${PORT}`);
        });
    })
    .catch(err => console.error('Database connection error:', err));
