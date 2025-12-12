const mongoose = require("mongoose");
const { Schema } = mongoose;

const ProductSchema = new Schema({
    seller: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    name: { type: String, required: true },
    description: String,
    category: {
        type: String,
        enum: ['Laptops', 'Desktops', 'Accessories', 'Components', 'Peripherals', 'Other'],
        required: true
    },
    subCategory: String,
    brand: String,
    sku: String,

    condition: { type: String, enum: ["New", "Used", "Imported"], required: true },

    price: { type: Number, required: true },
    stockQuantity: { type: Number, default: 0 },

    usedDetails: {
        deviceConditionDescription: String,
        previousUsageDuration: String,
        manufacturingYear: Number,
        refurbishmentNotes: String,
        signsOfWear: String
    },

    importedDetails: {
        countryOfOrigin: String,
        importDate: Date,
        internationalWarranty: Boolean,
        compatibilityNotes: String
    },

    technicalSpecs: {
        CPU: String,
        RAM: String,
        GPU: String,
        Storage: String,
        ScreenSize: String,
    },

    warranty: {
        type: { type: String, enum: ["Manufacturer", "Seller", "Agent"] },
        duration: String,
        coverageDetails: String,
        serviceCenters: [String],
    },

    images: [String],
    isFeatured: { type: Boolean, default: false },
    visibility: { type: String, enum: ["Published", "Draft", "Hidden"], default: "Published" },

}, { timestamps: true });

module.exports = mongoose.model("Product", ProductSchema);