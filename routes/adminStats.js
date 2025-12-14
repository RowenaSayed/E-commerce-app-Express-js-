const express = require('express');
const router = express.Router();
const { auth, authorize } = require('../middleware/auth');
const statsController = require('../controllers/adminStats');

// Middleware لحماية جميع مسارات الإحصائيات للأدمن فقط
router.use(auth, authorize(['admin'])); 

// FR-A33: جلب مقاييس الداشبورد الرئيسية
router.get('/metrics', statsController.getDashboardMetrics);

// FR-A34 & FR-A35: تقارير المبيعات مع خيارات التصدير
// GET /api/stats/reports/sales?dateFrom=...&category=...&exportFormat=csv
router.get('/reports/sales', statsController.generateSalesReports);

// FR-A36: تقارير أداء المنتج
router.get('/reports/products/performance', statsController.getProductPerformance);

// FR-A37: رؤى العملاء
router.get('/insights/customers', statsController.getCustomerInsights);

// يمكنك إضافة مسار منفصل لتصدير CSV/PDF إذا لزم الأمر، لكن generateSalesReports تعالج التصدير
router.get('/reports/sales/export', statsController.exportReport);

module.exports = router;