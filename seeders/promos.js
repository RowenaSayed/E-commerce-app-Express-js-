// seeders/promos.js
const mongoose = require("mongoose");
const Promotion = require("../models/promos");
require("dotenv").config();

const seedPromos = async () => {
    try {
        await mongoose.connect(process.env.MONGO_URI);

        console.log("Connected to MongoDB");

        await Promotion.deleteMany({});
        console.log("Old promos deleted");
        const admins = await mongoose.connection.collection('users').find({ role: 'admin' }).toArray();
        if (admins.length === 0) {
            throw new Error("No admin users found. Please create an admin user first.");
        }
        const promos = [
            {
                code: "WELCOME10",
                type: "Percentage",
                value: 10,
                minPurchase: 50,
                startDate: new Date(),
                endDate: new Date(new Date().setMonth(new Date().getMonth() + 1)),
                usageLimitPerUser: 1,
                totalUsageLimit: 100,
                createdBy:admins[0]._id
            },
            {
                code: "FLAT50",
                type: "Fixed",
                value: 50,
                minPurchase: 200,
                startDate: new Date(),
                endDate: new Date(new Date().setMonth(new Date().getMonth() + 2)),
                createdBy: admins[0]._id
            },
            {
                code: "FREESHIP",
                type: "FreeShipping",
                value: 0,
                startDate: new Date(),
                endDate: new Date(new Date().setMonth(new Date().getMonth() + 1)),
                createdBy: "64f123abc123abc123abc123"
            },
            {
                code: "BUY2GET1",
                type: "BuyXGetY",
                value: 1,
                startDate: new Date(),
                endDate: new Date(new Date().setMonth(new Date().getMonth() + 1)),
                createdBy: admins[0]._id
            }
        ];

        const created = await Promotion.insertMany(promos);
        console.log(`${created.length} promos created successfully`);

        process.exit();
    } catch (err) {
        console.error("Seeder error:", err);
        process.exit(1);
    }
};

seedPromos();
