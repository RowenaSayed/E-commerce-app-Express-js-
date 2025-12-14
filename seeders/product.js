require("dotenv").config();
const mongoose = require("mongoose");
const Product = require("../models/products");
const User = require("../models/users");

const seedProducts = async () => {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        console.log("DB connected");

        await Product.deleteMany();
        console.log("Old products deleted");

        const sellers = await User.find({ role: "seller" });

        if (!sellers.length) {
            throw new Error("No sellers found, seed users first");
        }

        const products = [
            // 🔹 NEW PRODUCT
            {
                name: "Dell Inspiron 15",
                description: "15.6 inch laptop suitable for office and study",
                category: "Laptops",
                subCategory: "Business",
                brand: "Dell",
                sku: "DELL-INSP-15-001",
                condition: "New",
                price: 18500,
                discount: 10,
                stockQuantity: 12,
                lowStockThreshold: 3,
                seller: sellers[0]._id,
                technicalSpecs: {
                    CPU: "Intel Core i5 11th Gen",
                    RAM: "16GB",
                    Storage: "512GB SSD",
                    GPU: "Intel Iris Xe",
                    OS: "Windows 11",
                    Color: "Silver",
                },
                dimensions: {
                    length: 36,
                    width: 24,
                    height: 1.9,
                    unit: "cm",
                },
                weight: {
                    value: 1.8,
                    unit: "kg",
                },
                warranty: {
                    type: "Manufacturer",
                    duration: "1 Year",
                    coverageDetails: "Hardware defects only",
                },
                visibility: "Published",
            },

            // 🔹 USED PRODUCT
            {
                name: "HP EliteBook 840 G5",
                description: "Used business laptop in very good condition",
                category: "Laptops",
                brand: "HP",
                sku: "HP-840G5-USED-01",
                condition: "Used",
                price: 12000,
                stockQuantity: 5,
                seller: sellers[1]?._id || sellers[0]._id,
                usedDetails: {
                    deviceConditionDescription: "Very good condition, minor scratches",
                    previousUsageDuration: "2 years",
                    manufacturingYear: 2019,
                    refurbishmentNotes: "New battery installed",
                    signsOfWear: "Light scratches on cover",
                },
                technicalSpecs: {
                    CPU: "Intel Core i7 8th Gen",
                    RAM: "16GB",
                    Storage: "512GB SSD",
                    OS: "Windows 10 Pro",
                },
                visibility: "Published",
            },

            // 🔹 IMPORTED PRODUCT
            {
                name: "MacBook Pro 14",
                description: "Imported MacBook Pro with US layout",
                category: "Laptops",
                brand: "Apple",
                sku: "MBP14-IMPORTED-01",
                condition: "Imported",
                price: 72000,
                stockQuantity: 3,
                seller: sellers[0]._id,
                importedDetails: {
                    countryOfOrigin: "USA",
                    importDate: new Date("2024-02-15"),
                    internationalWarranty: true,
                    compatibilityNotes: "US keyboard layout",
                },
                technicalSpecs: {
                    CPU: "Apple M1 Pro",
                    RAM: "16GB",
                    Storage: "1TB SSD",
                    OS: "macOS",
                },
                visibility: "Published",
            },
        ];

        await Product.insertMany(products);
        console.log("Products seeded successfully");

        process.exit();
    } catch (error) {
        console.error("Seeder error:", error);
        process.exit(1);
    }
};

seedProducts();
