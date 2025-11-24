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

  async borrow({ bookId, readerId, employeeId, borrowDate }) {
    const _bookId = new ObjectId(bookId);
    const _readerId = new ObjectId(readerId);
    const _employeeId = employeeId ? new ObjectId(employeeId) : null;

    const book = await this.books.findOne({ _id: _bookId });
    if (!book) throw new Error("Không tìm thấy sách");

    const reader = await this.readers.findOne({ _id: _readerId });
    if (!reader) throw new Error("Không tìm thấy độc giả");

    const borrowed = await this.currentBorrowedCount(_bookId);
    const qty = Number(book.qty ?? 0);
    if (borrowed >= qty) throw new Error("Sách đã hết");

    const loanDoc = {
      bookId: _bookId,
      readerId: _readerId,
      createdBy: _employeeId,
      borrowDate: borrowDate ? new Date(borrowDate) : new Date(),
      returnDate: null,
      status: "borrowing",
      createdAt: new Date(),
    };

    const { insertedId } = await this.loans.insertOne(loanDoc);
    return this.findById(insertedId);
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
