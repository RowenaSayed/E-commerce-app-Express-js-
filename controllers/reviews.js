const Review = require('../models/reviews');
const Product = require('../models/products');
const Order = require('../models/orders');


const createReview = async (req, res) => {
    try {
        const user = req.user;
        if (!user) return res.status(401).json({ message: "Authentication required" });

        if (user.role !== 'buyer') {
            return res.status(403).json({ 
                message: "Permission Denied: Only buyers can leave reviews. Sellers and Admins are not allowed." 
            });
        }

        const userId = user._id || user.id;
        const { product, rating, comment, productCondition } = req.body;

        if (!product || !rating || !productCondition) {
            return res.status(400).json({ message: "Product, rating, and condition are required" });
        }

        const hasBought = await Order.findOne({ 
            user: userId, 
            "items.product": product,
            status: "Delivered" 
        });

        if (!hasBought) {
            return res.status(403).json({ 
                message: "You can only review products you have purchased and received (Delivered)." 
            });
        }

        const newReview = await Review.create({
            product,
            user: userId,
            rating,
            comment: comment || '',
            productCondition, 
            verifiedPurchase: true
        });

        res.status(201).json({ message: "Review added successfully!", review: newReview });

    } catch (error) {
        if (error.code === 11000) {
            return res.status(400).json({ message: "You have already reviewed this product." });
        }
        res.status(500).json({ message: 'Server Error', error: error.message });
    }
};

const getAllReviews = async (req, res) => {
    try {
        const { product, rating, condition, sort, verified,user } = req.query;
        const filterObj = {};

        if (product) filterObj.product = product;
        if (rating) filterObj.rating = rating;
        if (condition) filterObj.productCondition = condition;
        if(user) filterObj.user=user
        if (verified === 'true') filterObj.verifiedPurchase = true;

        let sortStr = '-createdAt';
        if (sort === 'highest') sortStr = '-rating';
        if (sort === 'lowest') sortStr = 'rating';
        if (sort === 'helpful') sortStr = '-helpfulCount';

        const reviews = await Review.find(filterObj)
            .sort(sortStr)
            .populate('user', 'name') 
            .populate('product', 'name');

        res.status(200).json({ count: reviews.length, reviews });
    } catch (error) {
        res.status(500).json({ message: 'Server Error', error: error.message });
    }
};

const markReviewHelpful = async (req, res) => {
    try {
        const review = await Review.findById(req.params.id);
        if (!review) return res.status(404).json({ message: "Review not found" });

        const userId = req.user._id || req.user.id;

        if (review.user.toString() === userId.toString()) {
            return res.status(400).json({ message: "You cannot vote on your own review" });
        }

        const isVoted = review.helpfulVoters.includes(userId);

        if (isVoted) {
            review.helpfulVoters.pull(userId);
            review.helpfulCount = Math.max(0, review.helpfulCount - 1);
        } else {
            review.helpfulVoters.push(userId);
            review.helpfulCount += 1;
        }

        await review.save();
        res.status(200).json({ message: isVoted ? "Vote removed" : "Marked as helpful", helpfulCount: review.helpfulCount });
    } catch (error) {
        res.status(500).json({ message: "Server Error", error: error.message });
    }
};

const deleteReview = async (req, res) => {
    try {
        const userId = (req.user._id || req.user.id).toString();
        const userRole = req.user.role;

        const review = await Review.findById(req.params.id);
        if (!review) return res.status(404).json({ message: "Review not found" });

        const isOwner = review.user.toString() === userId;
        const isAdmin = userRole === 'admin';

        if (!isAdmin && !isOwner) {
            return res.status(403).json({ message: "Access Denied. You can only delete your own reviews." });
        }

        await Review.findByIdAndDelete(req.params.id);
        
        res.status(200).json({ message: "Review deleted successfully" });

    } catch (error) {
        res.status(500).json({ message: "Server Error", error: error.message });
    }
};

module.exports = { createReview, getAllReviews, markReviewHelpful, deleteReview };