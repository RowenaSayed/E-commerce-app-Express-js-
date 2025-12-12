const crypto = require('crypto');
const User = require('../models/users'); 
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const { sendStatusChangeEmail } = require('../utilities/email');
const secret = process.env.JWT_SECRET;

const sanitizeUser = (user) => {
    const userObj = user.toObject();
    delete userObj.password;
    delete userObj.twoFactorSecret;
    delete userObj.twoFactorRecoveryCodes;
    delete userObj.verificationToken;
    delete userObj.resetPasswordToken;
    delete userObj.resetPasswordExpires;
    return userObj;
};

// 1. Create User (Updated for Hashing & Verification)
const createUser = async (req, res) => {
    try {
        const { name, email, phone, password, role } = req.body;
        
        // التحقق من البيانات
        if (!name || !email || !password) {
            return res.status(400).json({ message: 'Name, email, and password are required' });
        }

        // التحقق من عدم التكرار
        const existingUser = await User.findOne({ $or: [{ email }, { phone }] });
        if (existingUser) {
            return res.status(400).json({ message: 'Email or Phone already exists' });
        }

        // تشفير كلمة المرور
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);

        // إنشاء توكن للتحقق من الإيميل
        const verificationToken = crypto.randomBytes(32).toString('hex');

        const newUser = new User({
            name,
            email,
            phone,
            password: hashedPassword,
            role: role || 'buyer',
            isEmailVerified: true, // جعلته مفعلاً تلقائياً للتسهيل حالياً
            verificationToken, 
            verificationTokenExpires: Date.now() + 24 * 60 * 60 * 1000 // صالح لمدة 24 ساعة
        });

        await newUser.save();

        // تم إيقاف إرسال الإيميل مؤقتاً لتجنب توقف السيرفر
        // await sendEmail(newUser.email, verificationToken); 

        res.status(201).json({ 
            message: 'User created successfully.', 
            userId: newUser._id 
        });

    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server Error', error: error.message });
    }
};

// 2. Login (Updated for 2FA & Verification Check)
const login = async (req, res) => {
    try {
        const { email, password } = req.body;
        if (!email || !password) return res.status(400).json({ message: 'Email and password are required' });

        const user = await User.findOne({ email });
        if (!user) return res.status(404).json({ message: 'User not found' });

        // إذا كان مسجلاً بجوجل فقط وليس لديه باسورد
        if (!user.password) {
            return res.status(400).json({ message: 'Please login using your social account' });
        }

        // التحقق من الباسورد
        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) return res.status(400).json({ message: 'Invalid password' });

        // التحقق من تفعيل الإيميل
        if (!user.isEmailVerified) {
            return res.status(403).json({ message: 'Please verify your email address first.' });
        }

        // (2FA Logic) التحقق من المصادقة الثنائية
        if (user.twoFactorEnabled) {
            return res.status(200).json({ 
                message: '2FA Verification Required', 
                require2FA: true, 
                userId: user._id,
                method: user.twoFactorMethod 
            });
        }

        // إذا كل شيء تمام، نرسل التوكن
        const token = jwt.sign({ id: user._id, role: user.role }, secret, { expiresIn: '1d' });
        res.status(200).json({ message: 'Login successful', token, user: sanitizeUser(user) });

    } catch (error) {
        res.status(500).json({ message: 'Server Error', error: error.message });
    }
};

// 3. Get User
const getUserById = async (req, res) => {
    try {
        const user = await User.findById(req.params.id)
            .select('-password -twoFactorSecret -twoFactorRecoveryCodes -verificationToken');
            
        if (!user) return res.status(404).json({ message: 'User not found' });
        res.status(200).json({ user });
    } catch (error) {
        res.status(500).json({ message: 'Server Error', error });
    }
};

// 4. Update User
const updateUserById = async (req, res) => {
    try {
        const { password, role, ...updateData } = req.body;
        const user = await User.findByIdAndUpdate(req.params.id, updateData, { new: true })
            .select('-password -twoFactorSecret');
            
        if (!user) return res.status(404).json({ message: 'User not found' });
        res.status(200).json({ message: 'User updated successfully', user });
    } catch (error) {
        res.status(500).json({ message: 'Server Error', error });
    }
};

// 5. Delete User
const deleteUserById = async (req, res) => {
    try {
        const user = await User.findByIdAndDelete(req.params.id);
        if (!user) return res.status(404).json({ message: 'User not found' });
        res.status(200).json({ message: 'User deleted successfully' });
    } catch (error) {
        res.status(500).json({ message: 'Server Error', error });
    }
};

// 6. List Users
const listUsers = async (req, res) => {
    try {
        const users = await User.find().select('-password -twoFactorSecret -verificationToken');
        res.status(200).json({ users });
    } catch (error) {
        res.status(500).json({ message: 'Server Error', error });
    }
};

// 7. Social Login
const socialLogin = async (req, res) => {
    try {
        const { email, googleId, facebookId, name, profilePicture } = req.body;
        
        let user = await User.findOne({ email });
        
        if (user) {
            if (googleId && !user.socialAccounts?.googleId) {
                user.socialAccounts = { ...user.socialAccounts, googleId };
            }
            await user.save();
        } else {
            user = new User({
                name, 
                email, 
                isEmailVerified: true,
                profilePicture,
                socialAccounts: { googleId, facebookId },
                role: 'buyer'
            });
            await user.save();
        }

        if (user.twoFactorEnabled) {
            return res.status(200).json({ message: '2FA Required', require2FA: true, userId: user._id });
        }

        const token = jwt.sign({ id: user._id, role: user.role }, secret, { expiresIn: '1d' });
        res.status(200).json({ message: 'Social Login successful', token, user: sanitizeUser(user) });
    } catch (error) {
        res.status(500).json({ message: 'Server Error', error: error.message });
    }
};

// 8. Verify 2FA
const verify2FA = async (req, res) => {
    const { userId, code } = req.body;
    try {
        const user = await User.findById(userId);
        if (!user) return res.status(404).json({ message: 'User not found' });

        const isValid = true; // Placeholder for real logic

        if (!isValid) return res.status(400).json({ message: 'Invalid OTP Code' });

        const token = jwt.sign({ id: user._id, role: user.role }, secret, { expiresIn: '1d' });
        res.status(200).json({ message: 'Login complete', token, user: sanitizeUser(user) });
    } catch (error) {
        res.status(500).json({ message: 'Server Error', error: error.message });
    }
};

// 9. Forgot Password
const forgotPassword = async (req, res) => {
    try {
        const { email } = req.body;
        const user = await User.findOne({ email });

        if (!user) {
            return res.status(404).json({ message: 'User not found with this email' });
        }

        // إنشاء توكن
        const resetToken = crypto.randomBytes(32).toString('hex');
        
        // تشفير وحفظ التوكن
        user.resetPasswordToken = crypto.createHash('sha256').update(resetToken).digest('hex');
        
        // صلاحية التوكن (ساعة واحدة = 3600000 مللي ثانية)
        user.resetPasswordExpires = Date.now() + 3600000; 

        await user.save();

        
        // await sendEmail({
        //     email: user.email,
        //     subject: 'Password Reset Token',
        //     message: `Your token is: ${resetToken}`
        // });
        

        res.status(200).json({ 
            message: 'Email sent successfully (Simulated)', 
            resetToken: resetToken // نرجعه هنا للتجربة
        });

    } catch (error) {
        res.status(500).json({ message: 'Server Error', error: error.message });
    }
};

// 10. Reset Password

const resetPassword = async (req, res) => {
    try {
        const { token } = req.params; 
        const { password } = req.body;

        // 1. تنظيف التوكن من أي مسافات زيادة (مهم جداً)
        const cleanToken = token.trim();

        console.log("------------------------------------------------");
        console.log("1. التوكن اللي وصل من الرابط:", cleanToken);

        // 2. تشفير التوكن عشان نقارنه بالداتابيز
        const hashedToken = crypto.createHash('sha256').update(cleanToken).digest('hex');
        console.log("2. التوكن بعد التشفير:", hashedToken);

        // 3. البحث عن المستخدم (من غير شرط الوقت الأول عشان نتأكد)
        const userExists = await User.findOne({ resetPasswordToken: hashedToken });
        
        if (!userExists) {
            console.log("❌ المصيبة هنا: السيرفر مش لاقي التوكن ده في الداتابيز أصلاً!");
            return res.status(400).json({ message: 'Invalid token (Not found in DB)' });
        }

        console.log("✅ تمام! التوكن موجود في الداتابيز.");
        console.log("3. وقت الانتهاء المسجل:", userExists.resetPasswordExpires);
        console.log("4. الوقت الحالي:", Date.now());

        // 4. التأكد من الوقت
        if (userExists.resetPasswordExpires < Date.now()) {
            console.log("❌ التوكن موجود بس انتهت صلاحيته (Expired)");
            return res.status(400).json({ message: 'Token expired' });
        }

        // --- لو وصلنا هنا يبقى كله تمام ---
        const salt = await bcrypt.genSalt(10);
        userExists.password = await bcrypt.hash(password, salt);

        userExists.resetPasswordToken = undefined;
        userExists.resetPasswordExpires = undefined;

        await userExists.save();
        console.log("🎉 تم تغيير الباسورد بنجاح!");

        res.status(200).json({ message: 'Password reset successful. You can now login.' });

    } catch (error) {
        console.error("Server Error:", error);
        res.status(500).json({ message: 'Server Error', error: error.message });
    }
};

module.exports = {
    createUser,
    login,
    getUserById,
    updateUserById,
    deleteUserById,
    listUsers,
    socialLogin, 
    verify2FA,
    forgotPassword,
    resetPassword
};