const express = require('express');
const router = express.Router();
const { auth, authorize } = require('../middleware/auth');
const statsController = require('../controllers/adminStats');

router.use(auth, authorize(['admin'])); 

router.get('/metrics', statsController.getDashboardMetrics);

router.get('/reports/sales', statsController.generateSalesReports);

router.get('/reports/products/performance', statsController.getProductPerformance);

router.get('/insights/customers', statsController.getCustomerInsights);

router.get('/reports/sales/export', statsController.exportReport);

module.exports = router;