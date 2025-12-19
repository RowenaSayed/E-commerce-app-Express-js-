const User = require('../models/users'); 
const Cart = require('../models/carts');
const Governate = require('../models/governates');
const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const { sendResetPasswordEmail } = require('../utilities/email');
const { sendWelcomeEmail } = require('../utilities/email');
const { sendStatusUpdateEmail } = require('../utilities/email');
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
            isEmailVerified: false, // جعلته مفعلاً تلقائياً للتسهيل حالياً
            verificationToken, 
            verificationTokenExpires: Date.now() + 24 * 60 * 60 * 1000 // صالح لمدة 24 ساعة
        });

        await newUser.save();

        // تم إيقاف إرسال الإيميل مؤقتاً لتجنب توقف السيرفر
        await sendWelcomeEmail(newUser.email, newUser.name ,verificationToken); 

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

        if (!user.password) {
            return res.status(400).json({ message: 'Please login using your social account' });
        }

        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) return res.status(400).json({ message: 'Invalid password' });

                // داخل دالة login في controllers/users.js (بعد التأكد من كلمة المرور)
        
            if (!user.isEmailVerified) {
            return res.status(403).json({ message: 'Please verify your email address first.' });
        }
        if (user.role !== 'buyer'&& user.role !=='admin') {
    if (user.accountStatus === 'pending') {
        return res.status(403).json({ 
            message: 'Your account is pending admin approval. Only buyers can log in immediately.' 
        });
    }
    if (user.accountStatus === 'rejected') {
        return res.status(403).json({ 
            message: 'Your staff/seller application has been rejected. Please contact administration.' 
        });
    }
}

        if (user.twoFactorEnabled) {
            return res.status(200).json({
                message: '2FA Verification Required',
                require2FA: true,
                userId: user._id,
                method: user.twoFactorMethod
            });
        }

        // Merge Guest Cart
        const guestCart = await Cart.findOne({ sessionId: req.sessionID });
        const userCart = await Cart.findOne({ user: user._id });

        if (guestCart) {
            if (userCart) {
                guestCart.items.forEach(gItem => {
                    const index = userCart.items.findIndex(uItem => uItem.product.toString() === gItem.product.toString());
                    if (index > -1) {
                        userCart.items[index].quantity += gItem.quantity;
                    } else {
                        userCart.items.push(gItem);
                    }
                });
                await userCart.save();
                await Cart.deleteOne({ _id: guestCart._id });
            } else {
                guestCart.user = user._id;
                guestCart.sessionId = undefined;
                await guestCart.save();
            }
        }

        // Issue JWT token
        const token = jwt.sign({ id: user._id, role: user.role }, secret, { expiresIn: '1d' });

        res.status(200).json({
            message: 'Login successful',
            token,
            user: sanitizeUser(user)
        });

    } catch (error) {
        res.status(500).json({ message: 'Server Error', error: error.message });
    }
};

// GET /api/users?role=seller
const getUsers = async (req, res) => {
    try {
        const { role } = req.query;

        const filter = {};
        if (role) filter.role = role;

        const users = await User.find(filter)
        .select('-password -twoFactorSecret -twoFactorRecoveryCodes -verificationToken');

        res.status(200).json({
        success: true,
        users
        });
    } catch (error) {
        res.status(500).json({ message: 'Server Error', error });
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
const updateUser = async (req, res) => {
    try {
const { password, role, accountStatus, isBanned, ...updateData } = req.body;    
        const userId = req.user.id;

            if (password) {
            const salt = await bcrypt.genSalt(10);
            updateData.password = await bcrypt.hash(password, salt);
        }

        if (req.file) {
            updateData.profilePicture = req.file.path;
        }
        if (req.file) {
            updateData.profilePicture = req.file.path;
        }
        
        const updatedUser = await User.findByIdAndUpdate(
            userId,
            updateData,
            { new: true }
        ).select('-password -twoFactorSecret');

        if (!updatedUser)
            return res.status(404).json({ message: 'User not found' });

        res.status(200).json({
            message: 'User updated successfully',
            user: updatedUser
        });
    } catch (error) {
        res.status(500).json({ message: 'Server Error', error: error.message });
    }
};
//updateUserById for admin to update any user
const updateUserById = async (req, res) => {
    try {
        const { password, ...updateData } = req.body;
        if (req.user.role !== 'admin') {
            return res.status(403).json({ message: 'Forbidden: Admins only' });
        }   
        const userId = req.params.id;
        if (req.file) {
            updateData.profilePicture = req.file.path;
        }       

        const updatedUser = await User.findByIdAndUpdate(
            userId,
            updateData,
            { new: true }
        ).select('-password -twoFactorSecret');     
        if (!updatedUser)
            return res.status(404).json({ message: 'User not found' });
        res.status(200).json({      
            message: 'User updated successfully',
            user: updatedUser
        });
    }
    catch (error) {
        res.status(500).json({ message: 'Server Error', error: error.message });
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


const forgotPassword = async (req, res) => {
    try {
        const { email } = req.body;

        const user = await User.findOne({ email });

        if (!user) {
            return res.status(200).json({
                message: 'If email exists, reset link will be sent'
            });
        }

        const resetToken = crypto.randomBytes(32).toString('hex');

        user.passwordResetToken = crypto
            .createHash('sha256')
            .update(resetToken)
            .digest('hex');

        user.passwordResetExpires = Date.now() + 15 * 60 * 1000;

        await user.save();

        await sendResetPasswordEmail(user.email, resetToken);

        res.status(200).json({
            message: 'Reset password link sent to email'
        });

    } catch (error) {
        res.status(500).json({
            message: 'Server Error',
            error: error.message
        });
    }
};

const resetPassword = async (req, res) => {
    try {
        const { token } = req.params;
        const { password } = req.body;

        if (!password) {
            return res.status(400).json({ message: 'Password is required' });
        }

        const hashedToken = crypto
            .createHash('sha256')
            .update(token)
            .digest('hex');

        const user = await User.findOne({
            passwordResetToken: hashedToken,
            passwordResetExpires: { $gt: Date.now() }
        });

        if (!user) {
            return res.status(400).json({
                message: 'Invalid or expired token'
            });
        }

        const salt = await bcrypt.genSalt(10);
        user.password = await bcrypt.hash(password, salt);

        user.passwordResetToken = undefined;
        user.passwordResetExpires = undefined;

        await user.save();

        res.status(200).json({
            message: 'Password reset successful. You can now login.'
        });

    } catch (error) {
        res.status(500).json({
            message: 'Server Error',
            error: error.message
        });
    }
};


const verifyEmail = async (req, res) => {
    try {
        const { token } = req.params;

        // البحث عن المستخدم بالتوكن (والتأكد أن الوقت لم ينتهِ)
        const user = await User.findOne({
            verificationToken: token,
            verificationTokenExpires: { $gt: Date.now() }
        });

        if (!user) {
            return res.status(400).json({ message: 'Invalid or expired verification token' });
        }

        // تفعيل الحساب وتنظيف التوكن
        user.isEmailVerified = true;
        user.verificationToken = undefined;
        user.verificationTokenExpires = undefined;

        await user.save();

        // هنا ممكن نرجعه صفحة HTML حلوة تقول "تم التفعيل"
        res.status(200).send(`
            <h1 style="color: green; text-align: center;">Email Verified Successfully! ✅</h1>
            <p style="text-align: center;">You can now login to your account.</p>
        `);

    } catch (error) {
        res.status(500).json({ message: 'Server Error', error: error.message });
    }
};
const toggleBanUser = async (req, res) => {
    try {
        const user = await User.findById(req.params.id);
        if (!user) return res.status(404).json({ message: "User not found" });

        if (user.role === 'admin') {
            return res.status(403).json({ message: "Cannot ban an admin" });
        }

        user.isBanned = !user.isBanned; // عكس الحالة
        await user.save();

        res.json({ 
            message: user.isBanned ? "User has been banned" : "User has been unbanned", 
            isBanned: user.isBanned 
        });
    } catch (err) {
        res.status(500).json({ message: "Server Error" });
    }
};
// في controllers/users.js
const reviewUserStatus = async (req, res) => {
    try {
        const { status } = req.body; // 'approved' or 'rejected'
        const userId = req.params.id;

        if (!['approved', 'rejected'].includes(status)) {
            return res.status(400).json({ message: 'Invalid status' });
        }

        const user = await User.findByIdAndUpdate(
            userId, 
            { accountStatus: status }, 
            { new: true }
        );

        if (!user) return res.status(404).json({ message: "User not found" });

        // هنا يمكن إرسال إيميل للمستخدم لإبلاغه بالقرار
        await sendStatusUpdateEmail(user.email, user.name, status);

        res.json({ message: `User status updated to ${status}`, user:sanitizeUser(user) });
    } catch (err) {
        console.error("Error in reviewUserStatus:", err.message);
        res.status(500).json({ message: "Server Error" });
    }
};

const addNewAddress = async (req, res) => {
    try {
        if (!req.user) {
            return res.status(401).json({ message: "Authentication required" });
        }

        const {
            label,
            street,
            city,
            governorate,
            zipCode,
            isDefault = false
        } = req.body;

        // Validate required fields based on your AddressSchema
        if (!label || !['Home', 'Work', 'Other'].includes(label)) {
            return res.status(400).json({
                message: "Valid label is required (Home, Work, or Other)"
            });
        }

        if (!street || !city || !governorate) {
            return res.status(400).json({
                message: "Street, city, and governorate are required"
            });
        }

        // Verify governate exists in database
        const governateInfo = await Governate.findOne({ name: governorate });
        if (!governateInfo) {
            return res.status(400).json({
                message: "Invalid governorate. Please select from available governorates.",
                availableGovernorates: (await Governate.find().select('name')).map(g => g.name)
            });
        }

        const user = await User.findById(req.user.id);
        if (isDefault === true || isDefault === 'true') {
            user.addresses.forEach(addr => {
                addr.isDefault = false;
            });
        }
        // Create new address object matching your schema
        const newAddress = {
            label,
            street,
            city,
            governorate,
            zipCode: zipCode || "",
            isDefault: isDefault === true || isDefault === 'true' 
        };

        // If this is default, unset other defaults
        if (isDefault && user.addresses.length > 0) {
            user.addresses.forEach(addr => {
                addr.isDefault = false;
            });
        }

        user.addresses.push(newAddress);
        await user.save();

        res.status(201).json({
            message: "Address added successfully",
            address: newAddress,
            totalAddresses: user.addresses.length
        });

    } catch (err) {
        res.status(500).json({ message: "Server error" });
    }
};

const updateAddress = async (req, res) => {
    try {
        if (!req.user) {
            return res.status(401).json({ message: "Authentication required" });
        }

        const { addressId } = req.params;
        const updates = req.body;

        if (!addressId) {
            return res.status(400).json({ message: "Address ID is required" });
        }

        // Validate governorate if being updated
        if (updates.governorate) {
            const governateInfo = await Governate.findOne({ name: updates.governorate });
            if (!governateInfo) {
                return res.status(400).json({
                    message: "Invalid governorate"
                });
            }
        }

        const user = await User.findById(req.user.id);

        // Find the address index
        const addressIndex = user.addresses.findIndex(addr => addr._id.toString() === addressId);

        if (addressIndex === -1) {
            return res.status(404).json({ message: "Address not found" });
        }


        // If setting as default, unset other defaults
        if (updates.isDefault === true) {
            user.addresses.forEach(addr => {
                addr.isDefault = false;
            });
            updates.isDefault = true;
        }

        // Update the address
        user.addresses[addressIndex] = {
            ...user.addresses[addressIndex].toObject(),
            ...updates
        };

        await user.save();

        res.json({
            message: "Address updated successfully",
            address: user.addresses[addressIndex]
        });

    } catch (err) {
        res.status(500).json({ message: "Server error" });
    }
};

const deleteAddress = async (req, res) => {
    try {
        if (!req.user) {
            return res.status(401).json({ message: "Authentication required" });
        }

        const { addressId } = req.params;

        if (!addressId) {
            return res.status(400).json({ message: "Address ID is required" });
        }

        const user = await User.findById(req.user.id);

        // Filter out the address to delete
        const initialLength = user.addresses.length;
        user.addresses = user.addresses.filter(addr => addr._id.toString() !== addressId);

        if (user.addresses.length === initialLength) {
            return res.status(404).json({ message: "Address not found" });
        }

        await user.save();

        res.json({
            message: "Address deleted successfully",
            remainingAddresses: user.addresses.length
        });

    } catch (err) {
        res.status(500).json({ message: "Server error" });
    }
};
const getSavedAddresses = async (req, res) => {
    try {
        if (!req.user) {
            return res.status(401).json({ message: "Authentication required" });
        }

        const user = await User.findById(req.user.id).select('addresses');

        if (!user || !user.addresses || user.addresses.length === 0) {
            return res.json({
                addresses: [],
                message: "No saved addresses found"
            });
        }

        // Find default address
        const defaultAddress = user.addresses.find(addr => addr.isDefault);

        res.json({
            addresses: user.addresses,
            defaultAddress: defaultAddress || null,
            count: user.addresses.length
        });

    } catch (err) {
        res.status(500).json({ message: "Server error" });
    }
};


const updateSellerStatus = async (req, res) => {
    try {
        const { id } = req.params;
        const { action } = req.body;
        const user = await User.findById(id);

        if (!user) {
        return res.status(404).json({ success: false, message: 'User not found' });
        }

        if (user.role !== 'seller') {
        return res.status(400).json({ success: false, message: 'This user is not a seller' });
        }

        switch (action) {
        case 'approve':
            user.accountStatus = 'approved';
            user.isBanned = false; // فقط عند الموافقة
            break;
        case 'reject':
            user.accountStatus = 'rejected';
            // لا تمسح isBanned
            break;
        case 'ban':
            user.isBanned = true;
            break;
        case 'unban':
            user.isBanned = false;
            break;
        default:
            return res.status(400).json({ success: false, message: 'Invalid action' });
        }

        await user.save();

        res.status(200).json({
        success: true,
        message: `Seller status updated to ${action}`,
        user
        });

    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
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
    resetPassword,
    verifyEmail,
    toggleBanUser,
    updateUser,
    reviewUserStatus,
    addNewAddress,
    updateAddress,
    deleteAddress,
    getSavedAddresses,
    updateSellerStatus,getUsers
};