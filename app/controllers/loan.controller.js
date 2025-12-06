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


exports.getHistoryByUserId = async (req, res, next) => {
    try {
        const { userId } = req.params;
        
       

        // Kiểm tra tính hợp lệ của ID
        if (!userId || !ObjectId.isValid(userId)) {
            console.log("ID không hợp lệ");
            return next(new ApiError(400, "ID người dùng không hợp lệ"));
        }

        // --- KHỞI TẠO SERVICE ĐÚNG CÁCH ---
        
        await getClient(); 
        const loanService = new LoanService(getDb()); 
        
        
        const documents = await loanService.findByReaderId(userId);

        
        return res.send(documents);
    } catch (error) {
       
        return next(new ApiError(500, "Lỗi Server: " + error.message));
    }
};

exports.delete = async (req, res, next) => {
    try {
        const { id } = req.params;
        if (!ObjectId.isValid(id)) {
            return next(new ApiError(400, "ID phiếu mượn không hợp lệ"));
        }

        // 1. Kết nối Database chuẩn
        await getClient();
        const loanService = new LoanService(getDb());

        // 2. Gọi service
        const deleted = await loanService.delete(id);
        
        if (!deleted) return next(new ApiError(404, "Không tìm thấy phiếu mượn"));
        return res.send({ message: "Đã hủy phiếu thành công" });
    } catch (error) {
        return next(new ApiError(500, "Lỗi khi hủy phiếu: " + error.message));
    }
};

exports.update = async (req, res, next) => {
    try {
        // 1. Kiểm tra ID hợp lệ
        const { id } = req.params;
        if (!ObjectId.isValid(id)) {
            return next(new ApiError(400, "ID phiếu mượn không hợp lệ"));
        }

        // 2. Kiểm tra dữ liệu gửi lên
        if (Object.keys(req.body).length === 0) {
            return next(new ApiError(400, "Dữ liệu cập nhật không được để trống"));
        }

        // 3. Khởi tạo Service
        await getClient();
        const loanService = new LoanService(getDb());

        // 4. Gọi hàm update trong service
        const updatedDoc = await loanService.update(id, req.body);

        if (!updatedDoc) {
            return next(new ApiError(404, "Không tìm thấy phiếu mượn để cập nhật"));
        }

        return res.send({ message: "Cập nhật thành công", document: updatedDoc });
    } catch (error) {
        return next(new ApiError(500, "Lỗi khi cập nhật phiếu mượn: " + error.message));
    }
};