const Ticket = require('../models/tickets'); 
const { sendTicketStatusEmail } = require('../utilities/email');   

// 1. Create Ticket
const createTicket = async (req, res) => {
    try {
        // 1. الحصول على ID المستخدم من التوكن
        const userId = req.user.id; 

        console.log("User making request:", req.user); 

        // التحقق من المصادقة (رغم أن الـ auth middleware يقوم بذلك، لكن للضمان)
        if (!req.user) {
            return res.status(401).json({ message: "Authentication required. Please login first." });
        }

        const { 
            subject, message, orderNumber, category, 
            name, email, phone 
        } = req.body;

        // التحقق من البيانات المطلوبة
        if (!subject || !message || !name || !email || !phone) {
            return res.status(400).json({ message: "All fields (subject, message, name, email, phone) are required" });
        }

        const newTicket = new Ticket({
            user: userId, // ✅ استخدام userId (req.user.id)
            
            contactDetails: {
                name, email, phone
            },
            subject,
            message,
            orderNumber: orderNumber || null,
            // تأكد أن category الممررة من الـ body مطابقة للـ enum
            category: category || "Other", 
            status: 'Open'
        });

        await newTicket.save();
        
        res.status(201).json({ message: "Ticket created successfully", ticket: newTicket });
    } catch (err) {
        console.error("Create Ticket Error:", err);
        res.status(500).json({ message: "Server error", error: err.message });
    }
};

// 2. Get Tickets
const getTickets = async (req, res) => {
    try {
        let tickets;
        // الأدمن والدعم يرون كل التذاكر
        if (req.user.role === "admin" || req.user.role === "support") {
            tickets = await Ticket.find()
                .populate('user', 'name email')
                .populate('assignedTo', 'name')
                .sort({ createdAt: -1 });
        } else {
            // العميل يرى تذاكره فقط
            tickets = await Ticket.find({ user: req.user.id }) // ✅ تصحيح: استخدام req.user.id
                .populate('assignedTo', 'name')
                .sort({ createdAt: -1 });
        }
        res.json(tickets);
    } catch (err) {
        res.status(500).json({ message: "Server error", error: err.message });
    }
};

// 3. Get Ticket By ID
const getTicketById = async (req, res) => {
    try {
        const ticket = await Ticket.findById(req.params.id)
            .populate('user', 'name email phone')
            .populate('assignedTo', 'name')
            .populate('responses.sender', 'name role');

        if (!ticket) return res.status(404).json({ message: "Ticket not found" });

        // التحقق من الصلاحية: (مالك التذكرة أو Admin/Support)
        const isOwner = ticket.user._id.toString() === req.user.id.toString(); // ✅ تصحيح: استخدام req.user.id
        const isAdminOrSupport = req.user.role === "admin" || req.user.role === "support";

        if (!isAdminOrSupport && !isOwner) {
            return res.status(403).json({ message: "Access denied" });
        }
        res.json(ticket);
    } catch (err) {
        res.status(500).json({ message: "Server error", error: err.message });
    }
};

// 4. Update Ticket (Status or Assign)
// 4. Update Ticket (Status or Assign)
// 4. Update Ticket (Status or Assign)
const updateTicket = async (req, res) => {
    try {
        const ticket = await Ticket.findById(req.params.id);
        if (!ticket) return res.status(404).json({ message: "Ticket not found" });

        // الحماية: فقط الدعم والأدمن
        if (req.user.role !== "admin" && req.user.role !== "support") {
            return res.status(403).json({ message: "Access denied." });
        }

        const allowedUpdates = ["status", "assignedTo", "category"];
        const oldStatus = ticket.status; // 🛑 1. نلتقط الحالة القديمة قبل التعديل

        allowedUpdates.forEach(field => {
            if (req.body[field] !== undefined) {
                // 🛑 2. نستخدم set() لتطبيق التعديلات (هذه الطريقة أكثر أمانًا)
                // بدلاً من ticket[field] = req.body[field];
                ticket.set(field, req.body[field]);
            }
        });

        const statusChanged = oldStatus !== ticket.status; // 🛑 3. نقارن الحالة القديمة بالجديدة

        // 🛑 4. تشغيل التحقق يدوياً قبل الحفظ (لإظهار خطأ validation إن وجد)
        await ticket.validate(); 
        
        await ticket.save(); // 5. الحفظ الفعلي

        if (statusChanged && sendTicketStatusEmail) {
            await sendTicketStatusEmail(
                ticket.contactDetails.email, // إيميل العميل
                ticket.contactDetails.name,  // اسم العميل
                ticket._id,                 // استخدام ID Mongoose
                ticket.status                // الحالة الجديدة
            );
        }
        
        res.json({ message: "Ticket updated successfully", ticket });
    } catch (err) {
        // 🛑 تحسين معالجة الأخطاء لإظهار خطأ الـ Validation بوضوح
        console.error("Update Ticket Error:", err);
        
        // التحقق من نوع الخطأ: إذا كان خطأ Mongoose Validation
        if (err.name === 'ValidationError') {
            // نُرجع خطأ 400 ونعرض تفاصيل خطأ الـ Validation
            return res.status(400).json({ message: "Validation Error: Data is invalid.", errors: err.errors });
        }
        // لأي خطأ آخر (مثل خطأ في الاتصال بالسيرفر)
        res.status(500).json({ message: "Server error", error: err.message });
    }
};
// 5. Add Response
const addResponse = async (req, res) => {
    try {
        const ticket = await Ticket.findById(req.params.id);
        if (!ticket) return res.status(404).json({ message: "Ticket not found" });

        const user = req.user;
        const { message } = req.body;
        
        if (!message) return res.status(400).json({ message: "Message is required" });

        // ✅ تصحيح: توحيد الأسماء لتطابق الأحرف الصغيرة في الـ Schema
        let senderRole = user.role; 
        
        // إذا لم يكن الدور أحد الأدوار المعرفة، يُعتبر buyer
        if (!["admin", "support", "seller", "buyer"].includes(senderRole)) {
            senderRole = "buyer";
        }

        // إضافة الرد
        ticket.responses.push({ 
            sender: user.id, 
            role: senderRole, 
            message 
        });

        // تحديث الحالة تلقائياً
        const isStaff = user.role === "support" || user.role === "admin" || user.role === "seller";

        if (isStaff) {
            if (ticket.status !== "Closed") ticket.status = "Waiting for Customer Response";
        } else {
            // العميل يرد
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

        // التحقق من الصلاحية: (Admin أو مالك التذكرة)
        const isOwner = ticket.user.toString() === req.user.id.toString(); 

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