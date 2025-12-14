const mongoose = require("mongoose");

const GovernateSchema = new mongoose.Schema(
    {
        name: { type: String, required: true, unique: true },
        fee: { type: Number, required: true },
        deliveryTime: { type: Number },
    },
    { timestamps: true }
);

module.exports = mongoose.model("Governate", GovernateSchema);
