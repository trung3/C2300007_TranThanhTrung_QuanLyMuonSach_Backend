const { ObjectId } = require("mongodb");
const ApiError = require("../api-error");
const { getClient, getDb } = require("../../utils/mongodb.util");
const LoanService = require("../services/loan.service");

function stringifyDoc(doc) {
  if (!doc) return doc;
  return JSON.parse(JSON.stringify(doc));
}
exports.borrow = async (req, res, next) => {
  try {
    const { bookId, readerId } = req.body || {};
    // 1. Validation cơ bản
    if (!bookId || !readerId) {
      return next(new ApiError(400, "Thiếu bookId hoặc readerId"));
    }
    // 2. Validation ObjectId
    if (!ObjectId.isValid(bookId) || !ObjectId.isValid(readerId)) {
      return next(new ApiError(400, "ID sách hoặc độc giả không hợp lệ"));
    }
    
    await getClient();
    const service = new LoanService(getDb());
    
    const doc = await service.borrow({
      ...req.body,
      employeeId: req.user?.sub, 
    });
    
    // 3. Áp dụng FIX lỗi ObjectId is not defined
    res.status(201).json(stringifyDoc(doc)); 
  } catch (e) {
    next(new ApiError(400, e.message || "Mượn sách thất bại"));
  }
};
// app/controllers/loan.controller.js

// ...
exports.returnBook = async (req, res, next) => {
  try {
    const { id } = req.params;
    if (!ObjectId.isValid(id)) return next(new ApiError(400, "ID không hợp lệ"));

    await getClient();
    const service = new LoanService(getDb());
    const doc = await service.returnLoan(id);
    
    // SỬA: Thay 404 bằng 400 cho lỗi nghiệp vụ
    // if (!doc) {
    //   return next(new ApiError(400, "Phiếu mượn không tồn tại hoặc đã trả")); 
    // }
    
    res.json(doc);
  } catch (e) {
    next(new ApiError(400, e.message || "Trả sách thất bại"));
  }
};
// ...

// LẤY TẤT CẢ MƯỢN + TRẢ
exports.listAll = async (_req, res, next) => {
  try {
    await getClient();
    const service = new LoanService(getDb());
    const items = await service.listAll();
    res.json(items);
  } catch (e) {
    next(new ApiError(500, "Không lấy được danh sách mượn – trả"));
  }
};
