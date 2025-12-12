const mongoose = require("mongoose");
const { Schema } = mongoose;

const TicketSchema = new Schema({
    // FR-CS4: رقم تذكرة فريد ومقروء
    ticketNumber: { type: String, unique: true },

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

    // FR-CS3: التصنيفات (تأكدي أن الفرونت إند يرسل نفس النصوص بالضبط)
    category: { 
        type: String, 
        enum: [
            "Order Inquiry", 
            "Product Inquiry", 
            "Payment Issue", 
            "Technical Issue", 
            "Return/Refund Request", 
            "Other"
        ],
        required: true,
        default: "Other"
    },

    // FR-CS5: حالة التذكرة
    status: { 
        type: String, 
        enum: [
            "Open", 
            "In Progress", 
            "Waiting for Customer Response", 
            "Resolved", 
            "Closed"
        ], 
        default: "Open" 
    },

    // الموظف المسؤل عن التذكرة
    assignedTo: { type: Schema.Types.ObjectId, ref: "User" },

    // تاريخ المحادثة
    responses: [
        {
            sender: { type: Schema.Types.ObjectId, ref: "User" }, 
            role: { type: String, enum: ["Customer", "Support", "Admin"], required: true }, 
            message: String,
            date: { type: Date, default: Date.now },
        },
    ],
}, { timestamps: true });

// إنشاء رقم تذكرة تلقائي قبل الحفظ
TicketSchema.pre("save", async function (next) {
    const ticket = this;

    // لو التذكرة لها رقم بالفعل، لا تفعل شيئاً
    if (ticket.ticketNumber) return next();

    // التنسيق: TKT-وقت-عشوائي (مثال: TKT-852930-1024)
    const prefix = "TKT";
    const timestamp = Date.now().toString().slice(-6); 
    const random = Math.floor(1000 + Math.random() * 9000); 
    
    ticket.ticketNumber = `${prefix}-${timestamp}-${random}`;

    next();
});

module.exports = mongoose.model("Ticket", TicketSchema);