const mongoose = require('mongoose');
const { Schema } = mongoose;


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
            required: true
        },
        slug: {
            type: String,
            required: true,
            unique: true,
            lowercase: true,
            trim: true
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


module.exports = mongoose.model('Category', CategorySchema);
