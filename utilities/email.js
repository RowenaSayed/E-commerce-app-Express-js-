// utils/emailService.js
const nodemailer = require("nodemailer");

// إعداد الناقل (Transporter)
// يفضل وضع هذه القيم في ملف .env
const transporter = nodemailer.createTransport({
    service: "gmail", // أو استخدم host/port لمزود آخر
    auth: {
        user: process.env.EMAIL_USER, // إيميل الدعم الفني
        pass: process.env.EMAIL_PASS, // كلمة المرور (أو App Password)
    },
});

/**
 * دالة لإرسال إشعار بتغير حالة التذكرة
 */
const sendStatusChangeEmail = async (toEmail, userName, ticketNumber, newStatus) => {
    try {
        const mailOptions = {
            from: `"Support Team" <${process.env.EMAIL_USER}>`,
            to: toEmail,
            subject: `Update on Ticket #${ticketNumber}`,
            html: `
                <h3>Hello ${userName},</h3>
                <p>The status of your support ticket (<strong>#${ticketNumber}</strong>) has been updated.</p>
                <p><strong>New Status:</strong> <span style="color: blue;">${newStatus}</span></p>
                <p>You can check the details by logging into your account.</p>
                <br>
                <p>Best Regards,<br>Support Team</p>
            `,
        };

        await transporter.sendMail(mailOptions);
        console.log(`Email sent to ${toEmail} regarding ticket ${ticketNumber}`);
    } catch (error) {
        console.error("Error sending email:", error);
        // لا نوقف السيرفر إذا فشل الإيميل، فقط نسجل الخطأ
    }
};

module.exports = { sendStatusChangeEmail };