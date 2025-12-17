const Review = require('../models/reviews');
const Product = require('../models/products');
const Order = require('../models/orders');

// 1. Create Review (Strict Logic)
// المسموح له فقط: Buyer (بشرط الشراء)
// الممنوعين: Admin, Seller, Support
const createReview = async (req, res) => {
    try {
        const user = req.user;
        if (!user) return res.status(401).json({ message: "Authentication required" });

        // 🛑 1. التحقق من الرتبة (Role Check)
        // بنمنع أي حد غير الـ "buyer" إنه يكتب ريفيو
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

        // 🛑 2. التحقق من الشراء الفعلي (Verified Purchase Check)
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

        // 3. الإنشاء
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

// 2. Get All Reviews (Public) - زي ما هي
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
            .populate('user', 'name') // نعرض اسم اليوزر بس
            .populate('product', 'name');

        res.status(200).json({ count: reviews.length, reviews });
    } catch (error) {
        res.status(500).json({ message: 'Server Error', error: error.message });
    }
};

// 3. Mark Review Helpful (Buyer Only)
// ممكن نسمح للأدمن يعمل لايك عادي، بس السيلر لأ (اختياري، هنا فتحتها لليوزر والأدمن)
const markReviewHelpful = async (req, res) => {
    try {
        const review = await Review.findById(req.params.id);
        if (!review) return res.status(404).json({ message: "Review not found" });

        const userId = req.user._id || req.user.id;

        // منع المستخدم من التصويت لنفسه
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

// 4. Delete Review (Updated Logic)
// المسموح لهم:
// أ) Admin (حذف أي ريفيو مسيء)
// ب) Review Owner (حذف ريفيو كتبه بنفسه)
const deleteReview = async (req, res) => {
    try {
        const userId = (req.user._id || req.user.id).toString();
        const userRole = req.user.role;

        const review = await Review.findById(req.params.id);
        if (!review) return res.status(404).json({ message: "Review not found" });

        // التحقق من الصلاحية
        const isOwner = review.user.toString() === userId;
        const isAdmin = userRole === 'admin';

        if (!isAdmin && !isOwner) {
            return res.status(403).json({ message: "Access Denied. You can only delete your own reviews." });
        }

        await Review.findByIdAndDelete(req.params.id);
        
        // المودل هيحدث متوسط التقييمات تلقائياً
        res.status(200).json({ message: "Review deleted successfully" });

    } catch (error) {
        res.status(500).json({ message: "Server Error", error: error.message });
    }
};

module.exports = { createReview, getAllReviews, markReviewHelpful, deleteReview };