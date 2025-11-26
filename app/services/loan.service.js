const { ObjectId } = require("mongodb");

class LoanService {
  constructor(db) {
    this.loans = db.collection("loans");
    this.books = db.collection("books");
    this.readers = db.collection("readers");

    // index
    this.loans.createIndex({ readerId: 1, status: 1 }).catch(() => {});
    this.loans.createIndex({ bookId: 1, status: 1 }).catch(() => {});
  }
  

  async find(filter = {}) {
    return this.loans.find(filter).toArray();
  }

  async findById(id) {
    return this.loans.findOne({ _id: new ObjectId(id) });
  }

  async currentBorrowedCount(bookId) {
    return this.loans.countDocuments({
      bookId: new ObjectId(bookId),
      status: "borrowing",
    });
  }

  // ============================
  //          MƯỢN SÁCH
  // ============================
  // ✅ HÀM FIX LỖI: Chuyển đổi toàn bộ ObjectId trong tài liệu sang chuỗi JSON an toàn
// Đảm bảo import ObjectId ở đầu file

async borrow({ bookId, readerId, employeeId, borrowDate }) {
    console.log(`\n--- 🔍 BẮT ĐẦU KIỂM TRA MƯỢN [${bookId}] ---`);
    
    const _bookId = new ObjectId(bookId);
    const _readerId = new ObjectId(readerId);
    const _employeeId = employeeId ? new ObjectId(employeeId) : null;

    // 1. Kiểm tra Sách & Độc giả
    const book = await this.books.findOne({ _id: _bookId });
    if (!book) throw new Error("Không tìm thấy sách");
    
    const reader = await this.readers.findOne({ _id: _readerId });
    if (!reader) throw new Error("Không tìm thấy độc giả");

    // --- LOGIC CHẶN MỚI (Dùng status: "borrowing") ---

    // A. Kiểm tra trùng (User đang mượn cuốn này chưa trả)
    const duplicate = await this.loans.findOne({
        readerId: _readerId,
        bookId: _bookId,
        status: "borrowing" // <--- ĐÚNG VỚI CSDL CỦA BẠN
    });

    if (duplicate) {
        console.log("❌ CHẶN: Phát hiện đang mượn trùng cuốn này!");
        throw new Error(`Bạn đang mượn cuốn "${book.title}" (chưa trả).`);
    } else {
        console.log("✅ Check trùng: OK (Chưa giữ cuốn này)");
    }

    // B. Kiểm tra số lượng (Quota)
    const MAX_BOOKS = 5; // Giới hạn 3 cuốn
    const currentCount = await this.loans.countDocuments({
        readerId: _readerId,
        status: "borrowing"
    });

    console.log(`ℹ️ Đang giữ: ${currentCount} cuốn | Giới hạn: ${MAX_BOOKS}`);

    if (currentCount >= MAX_BOOKS) {
        console.log("❌ CHẶN: Quá số lượng cho phép!");
        throw new Error(`Bạn chỉ được mượn tối đa ${MAX_BOOKS} cuốn. Bạn đang giữ ${currentCount} cuốn.`);
    }

    // --- HẾT LOGIC CHẶN ---

    // 2. Kiểm tra kho
    const borrowedCount = await this.currentBorrowedCount(_bookId);
    const qty = Number(book.qty ?? 0);
    
    if (borrowedCount >= qty) {
        console.log("❌ CHẶN: Hết sách trong kho!");
        throw new Error("Sách đã hết hàng.");
    }

    // 3. Tạo phiếu mượn
    const loanDoc = {
        bookId: _bookId,
        readerId: _readerId,
        createdBy: _employeeId,
        borrowDate: borrowDate ? new Date(borrowDate) : new Date(),
        returnDate: null,
        status: "borrowing", // <--- Ghi đúng status này vào DB
        createdAt: new Date(),
    };

    const result = await this.loans.insertOne(loanDoc);
    // 👇 THÊM ĐOẠN NÀY ĐỂ TRỪ SỐ LƯỢNG 👇
    await this.books.updateOne(
        { _id: _bookId },
        { $inc: { qty: -1 } } // $inc -1 nghĩa là giảm qty đi 1 đơn vị
    );
    console.log("✅ TẠO PHIẾU MƯỢN THÀNH CÔNG:", result.insertedId);
    
    return this.findById(result.insertedId);
}
  
  // ============================
  //          TRẢ SÁCH
  // ============================
  async returnLoan(loanId) {
    const r = await this.loans.findOneAndUpdate(
      { _id: new ObjectId(loanId), status: "borrowing" },
      { $set: { status: "returned", returnDate: new Date() } },
      { returnDocument: "after" }
    );
    // 👇 THÊM ĐOẠN NÀY ĐỂ CỘNG SỐ LƯỢNG LẠI 👇
    if (updateResult) { // Nếu cập nhật phiếu thành công
        await this.books.updateOne(
            { _id: loan.bookId }, // Lấy ID sách từ phiếu mượn
            { $inc: { qty: 1 } }  // $inc 1 nghĩa là cộng thêm 1
        );
        console.log("✅ Đã trả sách và hoàn lại kho.");
    }
    return r.value;
  }

  // ============================
  //     LẤY TẤT CẢ (MƯỢN + TRẢ)
  // ============================
  listAll() {
    return this.loans
      .aggregate([
        {
          $lookup: {
            from: "books",
            localField: "bookId",
            foreignField: "_id",
            as: "book"
          }
        },
        {
          $lookup: {
            from: "readers",
            localField: "readerId",
            foreignField: "_id",
            as: "reader"
          }
        },
        { $unwind: "$book" },
        { $unwind: "$reader" },

        {
          $addFields: {
            statusText: {
              $cond: [
                { $eq: ["$status", "borrowing"] },
                "Đang mượn",
                "Đã trả"
              ]
            }
          }
        },

        {
          $project: {
            _id: { $toString: "$_id" },
            readerName: "$reader.fullName",
            bookTitle: "$book.title",
            borrowDate: 1,
            returnDate: 1,
            status: 1,
            statusText: 1
          }
        },

        { $sort: { borrowDate: -1 } }
      ])
      .toArray();
  }
}

module.exports = LoanService;
