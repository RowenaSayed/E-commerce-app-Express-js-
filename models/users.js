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
    // --- المعلومات الأساسية ---
    name: { type: String, required: true, trim: true },
    email: { 
        type: String, 
        required: true, 
        unique: true, 
        lowercase: true, 
        trim: true 
    },
    phone: { type: String, sparse: true, unique: true }, // sparse: يسمح بالتكرار للقيم null (في حال سجل بجوجل ولم يدخل رقم هاتف)

    // --- كلمة المرور (Conditional Requirement) ---
    // كلمة المرور مطلوبة فقط إذا لم يكن المستخدم مسجلاً عبر السوشيال ميديا
    password: { 
        type: String, 
        required: function() {
            return !this.socialAccounts.googleId && !this.socialAccounts.facebookId;
        } 
    },

    role: { type: String, enum: ['admin', 'support', 'buyer','seller'], default: 'buyer' },
    profilePicture: String,
    addresses: [AddressSchema],

    // --- Social Login (Google & Facebook) ---
    socialAccounts: {
        googleId: { type: String, unique: true, sparse: true },
        facebookId: { type: String, unique: true, sparse: true },
        // نحتفظ بصورة البروفايل القادمة من السوشيال ميديا إذا احتجنا
        profileUrl: String 
    },

    // --- التحقق من الحساب (Verification) ---
    isEmailVerified: { type: Boolean, default: false },
    isPhoneVerified: { type: Boolean, default: false },
    
    // Tokens for Email/Phone Verification
    verificationToken: String,
    verificationTokenExpires: Date,

    // --- استعادة كلمة المرور ---
    passwordResetToken: String,
    passwordResetExpires: Date,

    // --- Multi-Factor Authentication (2FA) ---
    twoFactorEnabled: { type: Boolean, default: false },
    
    // نوع الـ 2FA المفضل (تطبيق مثل Google Authenticator أو رسالة SMS)
    twoFactorMethod: { 
        type: String, 
        enum: ['app', 'sms', 'email'], 
        default: 'email' 
    },
    
    // السر الخاص بتطبيقات المصادقة (TOTP Secret)
    twoFactorSecret: String, 
    
    // أكواد احتياطية للدخول في حال ضياع الهاتف (Backup Codes)
    twoFactorRecoveryCodes: [String],

    // Notification Preferences
    notificationPreferences: {
        email: { type: Boolean, default: true },
        sms: { type: Boolean, default: true },
        whatsapp: { type: Boolean, default: true },
    },
}, { timestamps: true });

module.exports = mongoose.model("User", UserSchema);