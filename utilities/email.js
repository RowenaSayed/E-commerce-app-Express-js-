const nodemailer = require("nodemailer");

// 1. إعداد الناقل (Transporter) - ثابت لكل الدوال
const transporter = nodemailer.createTransport({
    host: process.env.EMAIL_HOST,
    port: process.env.EMAIL_PORT,
    secure: false, 
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
    },
});

/**
 * الدالة الجوكر (The Core Function)
 * دي اللي بتقوم بعملية الإرسال الفعلية لأي غرض
 */
const sendEmail = async (options) => {
    try {
        const mailOptions = {
            from: `"E-Commerce App" <${process.env.EMAIL_USER}>`,
            to: options.email,
            subject: options.subject,
            text: options.message, // النص العادي (احتياطي)
            html: options.html,    // التصميم (الألوان والخطوط)
        };

        await transporter.sendMail(mailOptions);
        console.log(`✅ Email sent to: ${options.email} | Subject: ${options.subject}`);
    } catch (error) {
        console.error("❌ Error sending email:", error.message);
    }
};

// ============================================================
// دوال القوالب (Templates) - كل واحدة بتهندل حالة مختلفة
// ============================================================

// 1. إيميل استعادة كلمة المرور (Forgot Password)
const sendResetPasswordEmail = async (email, token) => {
    const resetURL = `http://localhost:3000/reset-password/${token}`; // رابط الفرونت إند
    
    const message = `You requested a password reset. Click here: ${resetURL}`;
    const html = `
        <div style="font-family: Arial, sans-serif; padding: 20px;">
            <h2>Password Reset Request</h2>
            <p>You requested to reset your password. Please click the button below:</p>
            <a href="${resetURL}" style="background-color: #4CAF50; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">Reset Password</a>
            <p>If you didn't request this, please ignore this email.</p>
        </div>
    `;

    await sendEmail({ email, subject: 'Password Reset Token', message, html });
};

// 2. إيميل تحديث حالة التذكرة (Ticket Status)
const sendTicketStatusEmail = async (email, name, ticketNumber, status) => {
    const message = `Hello ${name}, your ticket #${ticketNumber} is now ${status}.`;
    const html = `
        <div style="font-family: Arial, sans-serif; padding: 20px; border: 1px solid #ddd;">
            <h3 style="color: #333;">Support Ticket Update</h3>
            <p>Hello <strong>${name}</strong>,</p>
            <p>Your ticket (<strong>#${ticketNumber}</strong>) status has been updated.</p>
            <p>New Status: <span style="color: blue; font-weight: bold;">${status}</span></p>
            <br>
            <p>Best Regards,<br>Support Team</p>
        </div>
    `;

    await sendEmail({ email, subject: `Update on Ticket #${ticketNumber}`, message, html });
};

// 3. إيميل تحديث حالة الطلب (Order Status) - للأوردرات
const sendOrderStatusEmail = async (email, name, orderNumber, status) => {
    const message = `Hello ${name}, your order #${orderNumber} is now ${status}.`;
    const html = `
        <div style="font-family: Arial, sans-serif; padding: 20px; background-color: #f9f9f9;">
            <h3 style="color: #2c3e50;">Order Status Update</h3>
            <p>Hi <strong>${name}</strong>,</p>
            <p>Great news! The status of your order (<strong>#${orderNumber}</strong>) has changed to:</p>
            <h2 style="color: #27ae60;">${status}</h2>
            <p>Thank you for shopping with us!</p>
        </div>
    `;

    await sendEmail({ email, subject: `Order #${orderNumber} Update`, message, html });
};

// 4. إيميل تفعيل الحساب / الترحيب (Welcome)
const sendWelcomeEmail = async (email, name, verificationToken) => {
    // رابط التفعيل (هيروح على الباك اند أو الفرونت اند حسب تصميمك)
    // هنا خليته يروح على الباك اند مباشرة للتجربة
    const verifyURL = `http://localhost:8000/api/users/verify/${verificationToken}`;

    const message = `Welcome ${name}! Please verify your email by clicking: ${verifyURL}`;
    
    const html = `
        <div style="font-family: Arial, sans-serif; text-align: center; padding: 20px;">
            <h1 style="color: #4CAF50;">Welcome to E-Commerce App! 🎉</h1>
            <p>Hi <strong>${name}</strong>,</p>
            <p>We're excited to have you on board. Please verify your email address to get full access.</p>
            
            <a href="${verifyURL}" style="display: inline-block; background-color: #4CAF50; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; font-weight: bold; margin: 20px 0;">Verify My Account</a>
            
            <p style="color: #777; font-size: 12px;">If the button doesn't work, copy this link:<br>${verifyURL}</p>
        </div>
    `;

    await sendEmail({ 
        email, 
        subject: 'Welcome! Please verify your email', 
        message, 
        html 
    });
};
// تصدير كل الدوال عشان نستخدمها في الكنترولرز المختلفة
module.exports = { 
    sendResetPasswordEmail, 
    sendTicketStatusEmail, 
    sendOrderStatusEmail,
    sendWelcomeEmail
};