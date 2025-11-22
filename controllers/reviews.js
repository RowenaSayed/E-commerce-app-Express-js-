const Review = require('../models/reviews');
const Product = require('../models/products');

const createReview = async (req, res) => {
    try {
        const user = req.user;
        if (!user) return res.status(401).json({ message: "Authentication required" });

        const { product, rating, comment } = req.body;
        if (!product || !rating) return res.status(400).json({ message: "Product and rating are required" });

        const productExists = await Product.findById(product);
        if (!productExists) return res.status(404).json({ message: "Product not found" });

        const newReview = await Review.create({
            product,
            user: user._id,
            rating,
            comment: comment || ''
        });

        res.status(201).json({ message: "Review added successfully!", review: newReview });

    } catch (error) {
        res.status(500).json({ message: 'Server Error', error });
    }
};

const getAllReviews = async (req, res) => {
    try {
        const reviews = await Review.find()
            .populate('product')
            .populate('user', 'name email');
        res.status(200).json({ reviews });
    } catch (error) {
        res.status(500).json({ message: 'Server Error', error });
    }
};

const deleteReview = async (req, res) => {
    try {
        const user = req.user;
        if (!user || user.role !== 'admin') return res.status(403).json({ message: "Only admin can delete reviews" });

        const review = await Review.findByIdAndDelete(req.params.id);
        if (!review) return res.status(404).json({ message: "Review not found" });

        res.status(200).json({ message: "Review deleted successfully" });
    } catch (error) {
        res.status(500).json({ message: "Server Error", error });
    }
};

module.exports = {
    createReview,
    getAllReviews,
    deleteReview
};
