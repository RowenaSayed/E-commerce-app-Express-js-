require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const dotenv = require('dotenv');
const cors = require('cors');
const path = require('path');
const sessionMiddleware = require('./middleware/session');



const app = express();
app.use(sessionMiddleware)
const PORT = process.env.PORT || 8000;

mongoose.connect(process.env.MONGO_URI)
    .then(() => console.log("MongoDB connected"))
    .catch(err => console.error("MongoDB connection error:", err));

app.use(cors());
app.use(express.json());

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
const faqRoutes=require('./routes/faq')
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
mongoose.connect(process.env.MONGO_URI)
    .then(() => {
        console.log('MongoDB Connected successfully');
        
        const PORT = process.env.PORT || 8000;
        app.listen(PORT, () => {
            console.log(`Server is running on port ${PORT}`);
        });
    })
    .catch((err) => {
        console.error('Database connection error:', err);
    });