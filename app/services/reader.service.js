// app/services/reader.service.js
const { ObjectId } = require("mongodb");
const bcrypt = require("bcryptjs");

class ReaderService {
  constructor(db) {
    this.collection = db.collection("readers");
    this.collection.createIndex({ code: 1 }, { unique: true }).catch(() => {});
    this.collection.createIndex({ fullName: "text" }).catch(() => {});
  }

  find(filter = {}) {
    return this.collection.find(filter).toArray();
  }

  findById(id) {
    return this.collection.findOne({ _id: new ObjectId(id) });
  }

  findByCode(code) {
    return this.collection.findOne({ code:code });
  }
  async create(payload) {
    // Mã hóa mật khẩu trước khi lưu
    // Nếu payload có password thì hash, không có thì để rỗng
    const passwordHash = payload.password ? await bcrypt.hash(payload.password, 10) : "";

    const doc = {
      code: payload.code,
      fullName: payload.fullName,
      gender: Number(payload.gender ?? 1),
      dob: payload.dob ? new Date(payload.dob) : null,
      address: payload.address ?? "",
      phone: payload.phone ?? "",
      
      // 👇 QUAN TRỌNG: Lưu mật khẩu đã mã hóa vào đây
      passwordHash: passwordHash, 
      
      createdAt: new Date(),
    };

    const { insertedId } = await this.collection.insertOne(doc);
    
    // Trả về kết quả (nhưng ẩn mật khẩu đi cho bảo mật)
    return this.collection.findOne({ _id: insertedId }, { projection: { passwordHash: 0 } });
  }

  async update(id, payload) {
    const $set = {};
    if (payload.fullName !== undefined) $set.fullName = payload.fullName;
    if (payload.gender !== undefined)   $set.gender = Number(payload.gender);
    if (payload.dob !== undefined)      $set.dob = payload.dob ? new Date(payload.dob) : null;
    if (payload.address !== undefined)  $set.address = payload.address;
    if (payload.phone !== undefined)    $set.phone = payload.phone;

    if (Object.keys($set).length === 0) return this.findById(id);

    const r = await this.collection.updateOne(
      { _id: new ObjectId(id) },
      { $set }
    );
    if (r.matchedCount === 0) return null;
    return this.findById(id);
  }

  delete(id) {
    return this.collection.deleteOne({ _id: new ObjectId(id) });
  }
}

module.exports = ReaderService;
