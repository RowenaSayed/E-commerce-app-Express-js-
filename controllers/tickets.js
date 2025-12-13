const Ticket = require('../models/tickets');
// تأكدي من مسار ملف الإيميل الصحيح
const { sendTicketStatusEmail } = require('../utilities/email'); 

// 1. Create Ticket
const createTicket = async (req, res) => {
    try {
        const user = req.user; // مستخرج من التوكن عبر middleware

        // التحقق من المصادقة (لضمان وجود user id)
        if (!user || (!user._id && !user.id)) {
            return res.status(401).json({ message: "Authentication required." });
        }
        
        const userId = user._id || user.id;

        const { 
            subject, message, orderNumber, category, 
            name, email, phone 
        } = req.body;

        // التحقق من البيانات المطلوبة (FR-CS1)
        if (!subject || !message || !name || !email || !phone) {
            return res.status(400).json({ message: "All fields (subject, message, name, email, phone) are required" });
        }

        // ==========================================================
        // 👇👇 منطق توليد رقم التذكرة يدويًا هنا (New Logic) 👇👇
        // ==========================================================
        const prefix = "TCK";
        const random = Math.floor(1000 + Math.random() * 9000); // 4 أرقام عشوائية
        const timestamp = Date.now().toString().slice(-4);      // آخر 4 أرقام من الوقت
        const generatedTicketNumber = `${prefix}-${timestamp}-${random}`;
        // مثال: TCK-8329-1023
        // ==========================================================

        const newTicket = new Ticket({
            user: userId,
            ticketNumber: generatedTicketNumber, // 👈 إرسال الرقم المولد
            
            contactDetails: {
                name, email, phone
            },
            subject,
            message,
            orderNumber: orderNumber || null,
            category: category || "Other", // FR-CS3
            status: 'Open'
        });

        await newTicket.save();
        
        res.status(201).json({ message: "Ticket created successfully", ticket: newTicket });
    } catch (err) {
        console.error("Create Ticket Error:", err);
        res.status(500).json({ message: "Server error", error: err.message });
    }
};

// ... (باقي الدوال: getTickets, getTicketById, updateTicket, addResponse, deleteTicket كما هي في الكود السابق الخاص بك، لا تحتاج لتغيير جوهري إلا التأكد من استخدام userId بأمان كما فعلنا في Orders)

// 2. Get Tickets (مع تأمين استخراج الـ ID)
const getTickets = async (req, res) => {
    try {
        const userId = req.user._id || req.user.id;
        let tickets;
        
        if (req.user.role === "admin" || req.user.role === "support") {
            tickets = await Ticket.find()
                .populate('user', 'name email')
                .populate('assignedTo', 'name')
                .sort({ createdAt: -1 });
        } else {
            tickets = await Ticket.find({ user: userId }) 
                .populate('assignedTo', 'name')
                .sort({ createdAt: -1 });
        }
        res.json(tickets);
    } catch (err) {
        res.status(500).json({ message: "Server error", error: err.message });
    }
};

// 3. Get Ticket By ID (مع تأمين استخراج الـ ID)
const getTicketById = async (req, res) => {
    try {
        const userId = (req.user._id || req.user.id).toString();

        const ticket = await Ticket.findById(req.params.id)
            .populate('user', 'name email phone')
            .populate('assignedTo', 'name')
            .populate('responses.sender', 'name role');

        if (!ticket) return res.status(404).json({ message: "Ticket not found" });

        const isOwner = ticket.user._id.toString() === userId;
        const isAdminOrSupport = req.user.role === "admin" || req.user.role === "support";

        if (!isAdminOrSupport && !isOwner) {
            return res.status(403).json({ message: "Access denied" });
        }
        res.json(ticket);
    } catch (err) {
        res.status(500).json({ message: "Server error", error: err.message });
    }
};

// 4. Update Ticket (Admin/Support Only) - FR-CS6 Notification Logic Included
const updateTicket = async (req, res) => {
    try {
        const ticket = await Ticket.findById(req.params.id);
        if (!ticket) return res.status(404).json({ message: "Ticket not found" });

        if (req.user.role !== "admin" && req.user.role !== "support") {
            return res.status(403).json({ message: "Access denied." });
        }

        const allowedUpdates = ["status", "assignedTo", "category"];
        const oldStatus = ticket.status;

        allowedUpdates.forEach(field => {
            if (req.body[field] !== undefined) {
                ticket.set(field, req.body[field]);
            }
        });

        const statusChanged = oldStatus !== ticket.status;

        // التحقق من صحة البيانات قبل الحفظ
        try {
            await ticket.validate();
        } catch (validationErr) {
             return res.status(400).json({ message: "Validation Error", errors: validationErr.errors });
        }

        await ticket.save();

        // FR-CS6: Notify user on status change
        if (statusChanged) {
            // نتأكد أن دالة الإيميل مستوردة وموجودة لتجنب انهيار السيرفر
            if (typeof sendTicketStatusEmail === 'function') {
                try {
                    await sendTicketStatusEmail(
                        ticket.contactDetails.email, 
                        ticket.contactDetails.name, 
                        ticket.ticketNumber, // استخدام الرقم المولد الجديد
                        ticket.status
                    );
                } catch (emailErr) {
                    console.error("Email notification failed:", emailErr.message);
                    // لا نوقف الرد على العميل إذا فشل الإيميل
                }
            }
        }
        
        res.json({ message: "Ticket updated successfully", ticket });
    } catch (err) {
        res.status(500).json({ message: "Server error", error: err.message });
    }
};

// 5. Add Response (FR-CS2 support)
const addResponse = async (req, res) => {
    try {
        const ticket = await Ticket.findById(req.params.id);
        if (!ticket) return res.status(404).json({ message: "Ticket not found" });

        const user = req.user;
        const userId = user._id || user.id;
        const { message } = req.body;
        
        if (!message) return res.status(400).json({ message: "Message is required" });

        let senderRole = user.role; 
        // fallback للرتب غير المعروفة
        if (!["admin", "support", "seller", "buyer"].includes(senderRole)) {
            senderRole = "buyer";
        }

        ticket.responses.push({ 
            sender: userId, 
            role: senderRole, 
            message 
        });

        // تحديث الحالة تلقائيًا بناءً على من رد
        const isStaff = ["support", "admin", "seller"].includes(user.role);

        if (isStaff) {
            if (ticket.status !== "Closed") ticket.status = "Waiting for Customer Response";
        } else {
            // العميل هو الذي رد
            if (ticket.status !== "Closed") ticket.status = "In Progress";
        }

        await ticket.save();
        res.json({ message: "Response added", ticket });
    } catch (err) {
        res.status(500).json({ message: "Server error", error: err.message });
    }
};

// 6. Delete Ticket
const deleteTicket = async (req, res) => {
    try {
        const ticket = await Ticket.findById(req.params.id);
        if (!ticket) return res.status(404).json({ message: "Ticket not found" });

        const userId = (req.user._id || req.user.id).toString();
        const isOwner = ticket.user.toString() === userId; 

        if (req.user.role !== "admin" && !isOwner) {
            return res.status(403).json({ message: "Access denied" });
        }

        await ticket.deleteOne();
        res.json({ message: "Ticket deleted successfully" });
    } catch (err) {
        res.status(500).json({ message: "Server error", error: err.message });
    }
};

module.exports = {
    createTicket,
    getTickets,
    getTicketById,
    updateTicket,
    addResponse,
    deleteTicket
};