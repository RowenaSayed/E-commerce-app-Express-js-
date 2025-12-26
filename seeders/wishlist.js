const mongoose = require("mongoose");
require("dotenv").config();

const User = require("../models/users");
const Product = require("../models/products");
const Wishlist = require("../models/wishlist");

async function seedWishlist() {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        console.log("db connected");

        await Wishlist.deleteMany();
        console.log("old wishlists deleted");

        const users = await User.find().limit(5);
        const products = await Product.find();

        if (!users.length || !products.length) {
            console.log("no users or products found");
            return;
        }

        const wishlists = users.map(user => {
            const randomProducts = products
                .sort(() => 0.5 - Math.random())
                .slice(0, 3)
                .map(p => p._id);

            return {
                user_id: user._id,
                product_ids: randomProducts
            };
        });

        await Wishlist.insertMany(wishlists);
        console.log("wishlist seeded successfully");

        process.exit();
    } catch (err) {
        console.error("wishlist seeder error:", err);
        process.exit(1);
    }
}

seedWishlist();
