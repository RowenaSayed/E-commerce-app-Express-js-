const mongoose = require("mongoose");
const { Schema } = mongoose;

const TicketSchema = new Schema({
    // تم حذف ticketNumber هنا
    
    // FR-CS2: ربط التذكرة بالمستخدم (صاحب المشكلة)
    user: { type: Schema.Types.ObjectId, ref: "User", required: true },

    // FR-CS1: تفاصيل الاتصال (يتم حفظها كنسخة ثابتة وقت الإنشاء)
    contactDetails: {
        name: { type: String, required: true },
        email: { type: String, required: true },
        phone: { type: String, required: true }
    },

    subject: { type: String, required: true },
    message: { type: String, required: true },
    
    // FR-CS1: رقم الطلب (اختياري)
    orderNumber: { type: String, required: false }, 

    // FR-CS3: التصنيفات
    category: { 
        type: String, 
        enum: [
            "Order Inquiry", "Product Inquiry", "Payment Issue", 
            "Technical Issue", "Return/Refund Request", "Other"
        ],
        required: true,
        default: "Other"
    },

    // FR-CS5: حالة التذكرة
    status: { 
        type: String, 
        enum: [
            "Open", "In Progress", "Waiting for Customer Response", 
            "Resolved", "Closed"
        ], 
        default: "Open" 
    },

    // الموظف المسؤل عن التذكرة
    assignedTo: { type: Schema.Types.ObjectId, ref: "User" },

    // تاريخ المحادثة
    responses: [
        {
            sender: { type: Schema.Types.ObjectId, ref: "User" }, 
            // ✅ تصحيح: توحيد الأدوار بأحرف صغيرة لتجنب أخطاء Validation
            role: { type: String, enum: ["buyer", "support", "admin","seller"], required: true }, 
            message: String,
            date: { type: Date, default: Date.now },
        },
    ],
}, { timestamps: true });

// ❌ تم حذف TicketSchema.pre("save", ...) بالكامل

module.exports = mongoose.model("Ticket", TicketSchema);