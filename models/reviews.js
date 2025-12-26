const mongoose = require("mongoose");
const Product = require("./products"); 

const ReviewSchema = new mongoose.Schema({
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    product: { type: mongoose.Schema.Types.ObjectId, ref: "Product", required: true },
    
    rating: { type: Number, min: 1, max: 5, required: true },
    
    comment: { type: String, trim: true, maxlength: 1000 },
    
    verifiedPurchase: { type: Boolean, default: false },
    
    productCondition: { type: String, enum: ["New", "Used", "Imported"] },
    
    helpfulVoters: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
    helpfulCount: { type: Number, default: 0 }

}, { timestamps: true });

ReviewSchema.index({ product: 1, user: 1 }, { unique: true });

ReviewSchema.statics.calcAverageRatings = async function(productId) {
    const stats = await this.aggregate([
        { $match: { product: productId } },
        {
            $group: {
                _id: '$product',
                nRating: { $sum: 1 }, 
                avgRating: { $avg: '$rating' } 
            }
        }
    ]);

    if (stats.length > 0) {
        await Product.findByIdAndUpdate(productId, {
            ratingsQuantity: stats[0].nRating,
            ratingsAverage: Math.round(stats[0].avgRating * 10) / 10 
        });
    } else {
        await Product.findByIdAndUpdate(productId, {
            ratingsQuantity: 0,
            ratingsAverage: 0 
        });
    }
};

ReviewSchema.post('save', function() {
    this.constructor.calcAverageRatings(this.product);
});

ReviewSchema.post(/^findOneAnd/, async function(doc) {
    if (doc) {
        await doc.constructor.calcAverageRatings(doc.product);
    }
});

module.exports = mongoose.model("Review", ReviewSchema);