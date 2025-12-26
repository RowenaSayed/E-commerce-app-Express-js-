const nodemailer = require("nodemailer");

const transporter = nodemailer.createTransport({
    host: process.env.EMAIL_HOST,
    port: process.env.EMAIL_PORT,
    secure: false,
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
    },
});

const sendEmail = async (options) => {
    try {
        const mailOptions = {
            from: `"E-Commerce App" <${process.env.EMAIL_USER}>`,
            to: options.email,
            subject: options.subject,
            text: options.message,
            html: options.html,
        };

        await transporter.sendMail(mailOptions);
        console.log(`✅ Email sent to: ${options.email} | Subject: ${options.subject}`);
    } catch (error) {
        console.error("❌ Error sending email:", error.message);
    }
};

const sendResetPasswordEmail = async (email, token) => {
    const resetURL = `http://localhost:4200/reset-password/${token}`;
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

const sendWelcomeEmail = async (email, name, verificationToken) => {
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

const sendOrderConfirmationEmail = async (email, name, orderNumber, totalAmount) => {
    try {
        const mailOptions = {
            from: `Your E-commerce <${process.env.SMTP_EMAIL}>`,
            to: email,
            subject: `🎉 تأكيد طلبك رقم: ${orderNumber}`,
            html: `
                <div style="font-family: Arial, sans-serif; line-height: 1.6;">
                    <h2>عزيزي/عزيزتي ${name},</h2>
                    <p>نحن سعداء لتأكيد استلام طلبك! جميع تفاصيل طلبك موضحة أدناه:</p>
                    
                    <p style="font-size: 1.1em; font-weight: bold;">رقم الطلب: ${orderNumber}</p>
                    <p style="font-size: 1.1em; color: #4CAF50;">المبلغ الإجمالي: ${totalAmount.toFixed(2)} EGP</p>
                    
                    <p>سيتم معالجة طلبك قريباً. يمكنك متابعة حالة الطلب عبر حسابك.</p>
                    <p>شكراً لتسوقك معنا!</p>
                    <p>فريق دعم ${process.env.APP_NAME || 'المتجر الإلكتروني'}</p>
                </div>
            `,
        };

        const info = await transporter.sendMail(mailOptions);
        console.log(`Order confirmation email sent to ${email}: ${info.messageId}`);
    } catch (error) {
        console.error(`Error sending order confirmation email to ${email}:`, error);
    }
};

const sendStatusUpdateEmail = async (email, name, status) => {
    const loginURL = "http://localhost:8000/api/users/login";
    const isApproved = status === 'approved';
    const subject = isApproved ? 'Your Account has been Approved! 🎉' : 'Update regarding your account application';

    const message = isApproved
        ? `Hello ${name},\n\nGreat news! Your account has been reviewed and approved. You can now log in and start using the platform.`
        : `Hello ${name},\n\nWe regret to inform you that your account application has been rejected at this time. If you have questions, please contact our support team.`;

    const html = `
        <div style="font-family: sans-serif; padding: 20px; border: 1px solid #eee;">
            <h2>Hello ${name},</h2>
            <p>${isApproved ? 'Your account has been <b>Approved</b>! ✅' : 'Your account status has been updated.'}</p>
            <p>${message}</p>
            ${isApproved ? `<a href="${loginURL}" style="background: #28a745; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">Login Now</a>` : ''}
            <br><br>
            <p>Best regards,<br>The Admin Team</p>
        </div>
    `;

    try {
        await transporter.sendMail({
            from: process.env.EMAIL_USER,
            to: email,
            subject: subject,
            text: message,
            html: html
        });
        console.log(`Status email sent to ${email}`);
    } catch (error) {
        console.error("Error sending status email:", error);
    }
};

module.exports = {
    sendResetPasswordEmail,
    sendTicketStatusEmail,
    sendOrderStatusEmail,
    sendWelcomeEmail,
    sendOrderConfirmationEmail,
    sendStatusUpdateEmail
};