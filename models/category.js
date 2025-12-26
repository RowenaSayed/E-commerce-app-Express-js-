const mongoose = require('mongoose');
const { Schema } = mongoose;

// ============================
// Category Schema
// ============================
const CategorySchema = new Schema(
    {
        name: {
            type: String,
            enum: [
                'Laptops',
                'Desktops',
                'Accessories',
                'Components',
                'Other'
            ],
            required: true,index : true
        },
        slug: {
            type: String,
            required: true,
            unique: true,
            lowercase: true,
            trim: true,
            index: true
        },

        parent_id: {
            type: Schema.Types.ObjectId,
            ref: 'Category', 
            default: null
        },

        image: {
            type: String,
            default: null
        }
    },
    { timestamps: true }
);

// ============================
// Export Model
// ============================
module.exports = mongoose.model('Category', CategorySchema);
