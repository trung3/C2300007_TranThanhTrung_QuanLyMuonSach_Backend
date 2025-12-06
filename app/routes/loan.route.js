const express = require("express");
const router = express.Router();
const loanController = require("../controllers/loan.controller");
const auth = require("../middlewares/auth.middleware");



// tạo phiếu mượn
router.post("/", auth, loanController.borrow);

// trả sách
router.patch("/:id/return", auth, loanController.returnBook);

// LẤY TẤT CẢ MƯỢN + TRẢ
router.get("/", auth, loanController.listAll);

// Lấy lịch sử mượn của riêng một độc giả

router.get("/user/:userId", auth, loanController.getHistoryByUserId);
// 1. Route PUT: Để Duyệt đơn (status: pending -> borrowing)
router.put("/:id", auth, loanController.update); 

// 2. Route DELETE: Để Hủy phiếu mượn
router.delete("/:id", auth, loanController.delete);
module.exports = router;

