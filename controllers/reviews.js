const Review = require('../models/reviews');
const Product = require('../models/products');
const Order = require('../models/orders'); // You will need this for FR-R1 check

// 1. Create Review
// Handles FR-R1 (Verified), FR-R2 (Rating), FR-R8 (Unique check)
const createReview = async (req, res) => {
    try {
        const user = req.user;
        if (!user) return res.status(401).json({ message: "Authentication required" });

        // Added productCondition to destructuring as it is now required in Schema
        const { product, rating, comment, productCondition } = req.body;

        if (!product || !rating || !productCondition) {
            return res.status(400).json({ message: "Product, rating, and product condition are required" });
        }

        const productExists = await Product.findById(product);
        if (!productExists) return res.status(404).json({ message: "Product not found" });

        // Logic for FR-R1 (Verified Purchase) - Optional implementation
        const hasBought = await Order.findOne({ user: user._id, "items.product": product });
        const verifiedPurchase = !!hasBought; 

        const newReview = await Review.create({
            product,
            user: user._id,
            rating,
            comment: comment || '',
            productCondition, // Required for FR-R5 filtering
            verifiedPurchase: false // Set to true if you implement the Order check above
        });

        res.status(201).json({ message: "Review added successfully!", review: newReview });

    } catch (error) {
        // FR-R8: Handle Duplicate Review Error (MongoDB code 11000)
        if (error.code === 11000) {
            return res.status(400).json({ message: "You have already reviewed this product." });
        }
        res.status(500).json({ message: 'Server Error', error: error.message });
    }
};

// 2. Get All Reviews (With Filters & Sort)
// Handles FR-R5 (Filter), FR-R7 (Sort), FR-R4 (Total Count implied)
const getAllReviews = async (req, res) => {
    try {
        const { product, rating, condition, sort, verified } = req.query;

        // --- Build Filter Object (FR-R5) ---
        const filterObj = {};
        
        // Filter by specific product (Mandatory for product details page)
        if (product) filterObj.product = product;
        
        // Filter by Star Rating
        if (rating) filterObj.rating = rating;
        
        // Filter by Condition (New/Used/Imported)
        if (condition) filterObj.productCondition = condition;
        
        // Filter by Verified Purchase Only
        if (verified === 'true') filterObj.verifiedPurchase = true;

        // --- Build Sort Logic (FR-R7) ---
        let sortStr;
        switch (sort) {
            case 'recent':
                sortStr = '-createdAt'; // Most recent first
                break;
            case 'oldest':
                sortStr = 'createdAt';
                break;
            case 'highest':
                sortStr = '-rating'; // Highest stars first
                break;
            case 'lowest':
                sortStr = 'rating';  // Lowest stars first
                break;
            case 'helpful':
                sortStr = '-helpfulCount'; // Most helpful first
                break;
            default:
                sortStr = '-createdAt'; // Default
        }

        const reviews = await Review.find(filterObj)
            .sort(sortStr)
            .populate('user', 'name email') // Only get necessary user fields
            .populate('product', 'name');   // Optional: populate product name

        res.status(200).json({ 
            count: reviews.length, // FR-R4
            reviews 
        });

    } catch (error) {
        res.status(500).json({ message: 'Server Error', error: error.message });
    }
};

// 3. Delete Review
// Handles Admin check and updates Product stats
const deleteReview = async (req, res) => {
    try {
        const user = req.user;
        // Basic Role Check
        if (!user || user.role !== 'admin') {
            return res.status(403).json({ message: "Only admin can delete reviews" });
        }

        const reviewId = req.params.id;
        
        // Find first to get product ID (needed for re-calculating average)
        const review = await Review.findById(reviewId);
        if (!review) return res.status(404).json({ message: "Review not found" });

        await Review.findByIdAndDelete(reviewId);

        // Update the average rating on the Product Model (FR-R3)
        // This calls the static function we defined in the Schema step
        await Review.calcAverageRatings(review.product);

        res.status(200).json({ message: "Review deleted successfully" });

    } catch (error) {
        res.status(500).json({ message: "Server Error", error: error.message });
    }
};

module.exports = {
    createReview,
    getAllReviews,
    deleteReview
};