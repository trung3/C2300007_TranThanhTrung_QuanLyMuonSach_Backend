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

    // --- LOGIC CHẶN MỚI ---

    // A. Kiểm tra trùng: Đã mượn (borrowing) HOẶC Đang chờ duyệt (pending)
    // 👉 SỬA Ở ĐÂY: Dùng $in để check nhiều trạng thái
    const duplicate = await this.loans.findOne({
        readerId: _readerId,
        bookId: _bookId,
        status: { $in: ["borrowing", "pending"] } 
    });

    if (duplicate) {
        // Thông báo lỗi chi tiết hơn
        if(duplicate.status === 'pending') {
            throw new Error(`Bạn đã gửi yêu cầu mượn cuốn "${book.title}" rồi, vui lòng chờ duyệt.`);
        } else {
            throw new Error(`Bạn đang giữ cuốn "${book.title}" (chưa trả), không thể mượn thêm.`);
        }
    } else {
        console.log("✅ Check trùng: OK (Chưa giữ cuốn này)");
    }

    // B. Kiểm tra số lượng (Quota): Tính tổng cả sách đang giữ và đang chờ
    const MAX_BOOKS = 5; 
    const currentCount = await this.loans.countDocuments({
        readerId: _readerId,
        status: { $in: ["borrowing", "pending"] } // 👉 SỬA Ở ĐÂY: Tính cả sách đang pending vào giới hạn
    });

    console.log(`ℹ️ Đang giữ/chờ: ${currentCount} cuốn | Giới hạn: ${MAX_BOOKS}`);

    if (currentCount >= MAX_BOOKS) {
        throw new Error(`Bạn chỉ được mượn tối đa ${MAX_BOOKS} cuốn. Bạn đang có ${currentCount} yêu cầu (bao gồm đang mượn và chờ duyệt).`);
    }

    // --- HẾT LOGIC CHẶN ---

    // 2. Kiểm tra kho (Giữ nguyên)
    // Lưu ý: Logic này chỉ tính sách ĐANG MƯỢN, nếu muốn chặt chẽ hơn
    // bạn cũng nên trừ đi số lượng đang nằm trong các phiếu pending.
    // Tuy nhiên, logic cơ bản dưới đây vẫn ổn.
    const borrowedCount = await this.currentBorrowedCount(_bookId);
    const qty = Number(book.qty ?? 0);
    
    if (borrowedCount >= qty) {
        throw new Error("Sách đã hết hàng.");
    }

    // 3. Tạo phiếu mượn
    const loanDoc = {
        bookId: _bookId,
        readerId: _readerId,
        createdBy: _employeeId,
        borrowDate: borrowDate ? new Date(borrowDate) : new Date(),
        returnDate: null,
        status: "pending", 
        createdAt: new Date(),
    };

    const result = await this.loans.insertOne(loanDoc);
  
    // Cập nhật kho (Trừ số lượng)
    await this.books.updateOne(
        { _id: _bookId },
        { $inc: { qty: -1 } } 
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
  
 
 
    // 2. HÀM DELETE (HỦY PHIẾU + TRẢ LẠI SỐ LƯỢNG)
    async delete(id) {
        const filter = {
            _id: ObjectId.isValid(id) ? new ObjectId(id) : null,
        };

        if (!filter._id) return false;

        // BƯỚC 1: Tìm thông tin phiếu mượn trước khi xóa (để lấy bookId)
        const loan = await this.loans.findOne(filter);
        
        // Nếu không tìm thấy phiếu thì dừng
        if (!loan) return false;

        // BƯỚC 2: Trả lại số lượng sách (Cộng thêm 1)
        if (loan.bookId) {
            // Chuyển đổi bookId sang ObjectId nếu cần
            const bookId = ObjectId.isValid(loan.bookId) ? new ObjectId(loan.bookId) : null;
            
            if (bookId) {
                await this.books.updateOne(
                    { _id: bookId },
                    { $inc: { qty: 1 } } // $inc là lệnh tăng giá trị
                );
            }
        }

        // BƯỚC 3: Tiến hành xóa phiếu mượn
        const result = await this.loans.deleteOne(filter);

        return result.deletedCount > 0;
    }
    
    async findByReaderId(readerId) {
        return await this.loans.aggregate([
            {
                $match: { 
                    // Lưu ý: Trong Database bạn lưu là 'readerId' hay 'userId'?
                    // Dựa vào code hàm borrow cũ của bạn, bạn dùng 'readerId'.
                    readerId: new ObjectId(readerId) 
                }
            },
            {
                $lookup: {
                    from: "books",          // Tên collection SÁCH trong MongoDB
                    localField: "bookId",   // Tên trường ID sách trong collection LOANS
                    foreignField: "_id",    // Tên trường ID trong collection BOOKS
                    as: "bookDetails"
                }
            },
            {
                $unwind: {
                    path: "$bookDetails",
                    preserveNullAndEmptyArrays: true
                }
            },
            {
                $addFields: {
                    // Gán đè bookId bằng thông tin chi tiết để Frontend đọc được
                    bookId: "$bookDetails"
                }
            },
            {
                $project: {
                    bookDetails: 0 // Xóa trường thừa
                }
            },
            {
                $sort: { borrowDate: -1 } // Sắp xếp mới nhất lên đầu
            }
        ]).toArray();
    }
    async update(id, payload) {
        const filter = {
            _id: ObjectId.isValid(id) ? new ObjectId(id) : null,
        };
        const currentLoan = await this.loans.findOne(filter);
        if (!currentLoan) return false;
        // Tạo dữ liệu để update
        const updateData = {
            $set: {
                status: payload.status, // Cập nhật trạng thái (pending -> borrowing -> returned)
            }
        };
        // 2. LOGIC TRẢ SỐ LƯỢNG (Chỉ Backend mới được làm việc này)
    if (payload.status === 'returned') {
        updateData.$set.returnDate = new Date(); // Gán ngày trả

        // Kiểm tra: Nếu trước đó chưa trả thì mới cộng số lượng
        if (currentLoan.status !== 'returned' && currentLoan.bookId) {
            const bookId = ObjectId.isValid(currentLoan.bookId) 
                            ? new ObjectId(currentLoan.bookId) 
                            : currentLoan.bookId;
            
            // 👇 LỆNH QUAN TRỌNG NHẤT: Tăng quantity trong bảng books lên 1
            await this.books.updateOne(
                { _id: bookId },
                { $inc: { qty: 1 } } 
            );
        }
    }

        // LOGIC TỰ ĐỘNG:
        // Nếu chuyển sang trạng thái "returned" (Đã trả) -> Tự động điền ngày trả thực tế là hôm nay
        if (payload.status === 'returned') {
            updateData.$set.returnDate = new Date(); // Lưu ngày giờ hiện tại
        }
        
        // Nếu chuyển sang "borrowing" (Duyệt) -> Có thể update lại ngày mượn nếu muốn (tùy chọn)
        // if (payload.status === 'borrowing') { updateData.$set.borrowDate = new Date(); }

        const result = await this.loans.findOneAndUpdate(
            filter,
            updateData,
            { returnDocument: "after" } // Trả về document mới sau khi sửa
        );

        return result; 
    }
}


module.exports = LoanService;
