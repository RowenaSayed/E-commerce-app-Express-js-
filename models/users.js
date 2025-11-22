const mongoose = require("mongoose");
const { Schema } = mongoose;

const AddressSchema = new Schema({
    label: { type: String, enum: ["Home", "Work", "Other"], required: true },
    street: String,
    city: String,
    governorate: String,
    zipCode: String,
    isDefault: { type: Boolean, default: false },
});

const UserSchema = new Schema({
    name: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    phone: { type: String, required: true, unique: true },
    role:{type:String,required:true,enum:['admin','support','buyer']},
    password: { type: String, required: true },
    profilePicture: String,
    addresses: [AddressSchema],
    twoFactorEnabled: { type: Boolean, default: false },
    socialAccounts: {
        google: String,
        facebook: String,
    },
    notificationPreferences: {
        email: { type: Boolean, default: true },
        sms: { type: Boolean, default: true },
        whatsapp: { type: Boolean, default: true },
    },
}, { timestamps: true });

module.exports = mongoose.model("User", UserSchema);
