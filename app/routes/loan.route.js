const express = require("express");
const router = express.Router();
const loanController = require("../controllers/loan.controller");
const auth = require("../middlewares/auth.middleware");



// tạo phiếu mượn
router.post("/", auth, loanController.borrow);

// trả sách
router.patch("/:id/return", auth, loanController.returnBook);

// LẤY TẤT CẢ MƯỢN + TRẢ (QUAN TRỌNG)
router.get("/", auth, loanController.listAll);

module.exports = router;

