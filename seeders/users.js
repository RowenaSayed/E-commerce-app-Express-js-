require("dotenv").config();
const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const User = require("../models/users");

const users = [
    {phone:"0100001", name: "Rwyntsyd3", email: "rwyntsyd3@gmail.com", password: "123456", role: "buyer" },
    {phone:"01000012", name: "Sydrwynt", email: "sydrwynt@gmail.com", password: "123456", role: "buyer" },
    {phone:"010000123", name: "AdminUser", email: "admin@gmail.com", password: "123456", role: "admin" },
    {phone:"0100001234", name: "SupportUser", email: "support@gmail.com", password: "123456", role: "support" },
    {phone:"01000012345", name: "SellerOne", email: "seller1@gmail.com", password: "123456", role: "seller" },
    {phone:"010000123456", name: "SellerTwo", email: "seller2@gmail.com", password: "123456", role: "seller" },
    {phone:"0100001234567", name: "BuyerOne", email: "buyer1@gmail.com", password: "123456", role: "buyer" },
    {phone:"01000012345678", name: "BuyerTwo", email: "buyer2@gmail.com", password: "123456", role: "buyer" },
    {phone:"010000123456789", name: "SupportTwo", email: "support2@gmail.com", password: "123456", role: "support" },
    {phone:"01000012345678910", name: "AdminTwo", email: "admin2@gmail.com", password: "123456", role: "admin" },
];
const seedUsers = async () => {
  try {
      await mongoose.connect(process.env.MONGO_URI);
     console.log("DB connected");

      await User.deleteMany();
        console.log("Old users deleted");

        for (const userData of users) {
            const hashedPassword = await bcrypt.hash(userData.password, 10);
            await User.create({
                ...userData,
                password: hashedPassword,
                isEmailVerified: true
            });
            console.log(`User ${userData.email} created`);
        }

        console.log("Users seeding finished");
        process.exit();
    } catch (error) {
        console.error(error);
        process.exit(1);
    }
};

seedUsers();
