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
    name: { type: String, required: true, trim: true, index: true },
    email: {
        type: String,
        required: true,
        unique: true,
        lowercase: true,
        trim: true
    },
    phone: { type: String, sparse: true, unique: true },
    password: {
        type: String,
        required: function () {
            return !this.socialAccounts.googleId && !this.socialAccounts.facebookId;
        }
    },
    role: { type: String, enum: ['admin', 'support', 'buyer', 'seller'], default: 'buyer', index: true },
    profilePicture: String,
    addresses: [AddressSchema],
    socialAccounts: {
        googleId: { type: String, unique: true, sparse: true },
        facebookId: { type: String, unique: true, sparse: true },
        profileUrl: String
    },
    isEmailVerified: { type: Boolean, default: false },
    isPhoneVerified: { type: Boolean, default: false },
    verificationToken: String,
    verificationTokenExpires: Date,
    passwordResetToken: String,
    passwordResetExpires: Date,
    twoFactorEnabled: { type: Boolean, default: false },
    twoFactorMethod: {
        type: String,
        enum: ['app', 'sms', 'email'],
        default: 'email'
    },
    accountStatus: {
        type: String,
        enum: ['pending', 'approved', 'rejected'],
        default: function () {
            return (this.role === 'buyer') ? 'approved' : 'pending';
        }
    },
    twoFactorSecret: String,
    twoFactorRecoveryCodes: [String],
    isBanned: { type: Boolean, default: false },
    notificationPreferences: {
        email: { type: Boolean, default: true },
        sms: { type: Boolean, default: true },
        whatsapp: { type: Boolean, default: true },
    },
}, { timestamps: true });

module.exports = mongoose.model("User", UserSchema);