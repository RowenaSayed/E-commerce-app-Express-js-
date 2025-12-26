// seeders/reviews.js
const mongoose = require("mongoose");
const Review = require("../models/reviews");
const Product = require("../models/products");
const User = require("../models/users");
require("dotenv").config();

const randomComment = [
    "Excellent product!",
    "Very satisfied with the quality.",
    "Could be better.",
    "Not worth the price.",
    "Highly recommended!",
    "Average product.",
    "Will buy again.",
    "Delivery was late.",
    "Amazing experience!",
    "Does exactly what it says."
];

const seedReviews = async () => {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        console.log("Connected to MongoDB");

        // مسح الريفيوهات القديمة
        await Review.deleteMany({});
        console.log("Old reviews deleted");

        // جلب المستخدمين والمنتجات
        const users = await User.find({ role: "buyer" });
        const products = await Product.find().limit(3);

        if (users.length === 0 || products.length === 0) {
            console.log("No users or products found. Add some first!");
            process.exit();
        }

        const reviewsData = [];

        products.forEach(product => {
            const shuffledUsers = users.sort(() => 0.5 - Math.random()); // خلط المستخدمين
            // لكل منتج، نضيف لكل مستخدم مرة واحدة فقط
            shuffledUsers.slice(0, Math.min(15, users.length)).forEach(user => {
                const randomRating = Math.floor(Math.random() * 5) + 1;
                const randomCommentIndex = Math.floor(Math.random() * randomComment.length);
                const randomCondition = ["New", "Used", "Imported"][Math.floor(Math.random() * 3)];

                reviewsData.push({
                    user: user._id,
                    product: product._id,
                    rating: randomRating,
                    comment: randomComment[randomCommentIndex],
                    verifiedPurchase: true,
                    productCondition: randomCondition
                });
            });
        });


        const created = await Review.insertMany(reviewsData);
        console.log(`${created.length} reviews created successfully`);

        process.exit();
    } catch (err) {
        console.error("Seeder error:", err);
        process.exit(1);
    }
};

seedReviews();
