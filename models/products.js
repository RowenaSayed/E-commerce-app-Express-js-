const mongoose = require("mongoose");
const { Schema } = mongoose;

const ProductSchema = new Schema({
    // FR-A3: Product name (Arabic & English)
    seller: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    name: { 
        type: String, 
        required: true,
        trim: true,
        maxlength: [100, 'Name cannot exceed 100 characters']
    },
    nameAr: {
        type: String, 
        trim: true,
        maxlength: [100, 'Arabic Name cannot exceed 100 characters']
    },
    
    slug: { type: String, lowercase: true },

    description: {
        type: String,
        required: [true, 'Please provide description'],
        maxlength: [2000, 'Description cannot exceed 2000 characters']
    },
    descriptionAr: { 
        type: String,
        maxlength: [2000, 'Arabic Description cannot exceed 2000 characters']
    },
    
    category: {
        type: String,
        enum: ['Laptops', 'Desktops', 'Accessories', 'Components', 'Peripherals', 'Other'],
        required: true
    },
    subCategory: String,
    
    // FR-A3: Brand & SKU
    brand: String,
    sku: { type: String, unique: true, sparse: true }, // SKU must be unique

    // FR-A3: Product Condition
    condition: { 
        type: String, 
        enum: ["New", "Used", "Imported"], 
        required: true 
    },

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

    // FR-A3: Price & Stock
    price: { type: Number, required: true, min: 0 },
    discount: { type: Number, default: 0 },
    
    // FR-A8: Manage stock & Low stock alerts
    stockQuantity: { type: Number, required: true, default: 0, min: 0 },
    lowStockThreshold: { type: Number, default: 5 }, // الحد الأدنى للتنبيه
    
    sold: { type: Number, default: 0 },

    // FR-A3: Technical Specs
    technicalSpecs: {
        CPU: String,
        RAM: String,
        GPU: String,
        Storage: String,
        ScreenSize: String,
        OS: String,
        Color: String,
    },

    // FR-A3: Dimensions & Weight
    dimensions: {
        length: Number,
        width: Number,
        height: Number,
        unit: { type: String, default: 'cm' }
    },
    weight: {
        value: Number,
        unit: { type: String, default: 'kg' }
    },

    // FR-A3: Warranty
    warranty: {
        type: { type: String, enum: ["Manufacturer", "Seller", "Agent", "None"], default: "None" },
        duration: String,
        coverageDetails: String,
        serviceCenters: [String],
    },

    // FR-A3 & FR-A6: Multiple Images
    images: [String], 

    // FR-A9: Featured Products
    isFeatured: { type: Boolean, default: false }, 

    // FR-A7: Visibility
    visibility: { type: String, enum: ["Published", "Draft", "Hidden"], default: "Published" },

    // FR-A5: Soft Delete (Archive)
    isDeleted: { type: Boolean, default: false },
    deletedAt: { type: Date },

    // Ratings (System Managed)
    ratingsAverage: {
        type: Number,
        default: 4.5,
        min: [1, 'Rating must be above 1.0'],
        max: [5, 'Rating must be below 5.0'],
        set: val => Math.round(val * 10) / 10 
    },
    ratingsQuantity: {
        type: Number,
        default: 0
    }

}, { 
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
});

ProductSchema.index({ name: 'text', description: 'text', brand: 'text', sku: 'text' });

module.exports = mongoose.model("Product", ProductSchema);