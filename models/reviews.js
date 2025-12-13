const mongoose = require("mongoose");
const Product = require("./products"); // استدعاء مودل المنتجات لتحديثه

const ReviewSchema = new mongoose.Schema({
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    product: { type: mongoose.Schema.Types.ObjectId, ref: "Product", required: true },
    
    // FR-R2: 5-star rating system
    rating: { type: Number, min: 1, max: 5, required: true },
    
    comment: { type: String, trim: true, maxlength: 1000 },
    
    // FR-R1: Verified purchase flag
    verifiedPurchase: { type: Boolean, default: false },
    
    // FR-R5: Filter by Condition
    productCondition: { type: String, enum: ["New", "Used", "Imported"], required: true },
    
    // FR-R6: Helpful voting system
    helpfulVoters: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
    helpfulCount: { type: Number, default: 0 }

}, { timestamps: true });

// FR-R8: Prevent multiple reviews per user per product
ReviewSchema.index({ product: 1, user: 1 }, { unique: true });

// FR-R3 & FR-R4: Static method to calculate average rating
ReviewSchema.statics.calcAverageRatings = async function(productId) {
    const stats = await this.aggregate([
        { $match: { product: productId } },
        {
            $group: {
                _id: '$product',
                nRating: { $sum: 1 }, // Total Reviews
                avgRating: { $avg: '$rating' } // Average Rating
            }
        }
    ]);

    if (stats.length > 0) {
        await Product.findByIdAndUpdate(productId, {
            ratingsQuantity: stats[0].nRating,
            ratingsAverage: Math.round(stats[0].avgRating * 10) / 10 // تقريب لرقم عشري واحد
        });
    } else {
        // إذا تم حذف كل الريفيوهات، نرجع للصفر
        await Product.findByIdAndUpdate(productId, {
            ratingsQuantity: 0,
            ratingsAverage: 0 // أو 4.5 كقيمة افتراضية حسب البيزنس
        });
    }
};

// تشغيل الحساب بعد الحفظ (Create/Update)
ReviewSchema.post('save', function() {
    // this points to current review
    this.constructor.calcAverageRatings(this.product);
});

// تشغيل الحساب بعد الحذف (Delete)
// ملاحظة: في النسخ الحديثة من Mongoose نستخدم post('findOneAndDelete') للـ Query Middleware
ReviewSchema.post(/^findOneAnd/, async function(doc) {
    if (doc) {
        await doc.constructor.calcAverageRatings(doc.product);
    }
});

module.exports = mongoose.model("Review", ReviewSchema);