// app/services/book.service.js
const { ObjectId } = require("mongodb");

class BookService {
  constructor(db) {
    this.collection = db.collection("books");
    this.collection.createIndex({ code: 1 }, { unique: true }).catch(() => {});
  }

  find(filter = {}) {
    return this.collection.find(filter).toArray();
  }

  findById(id) {
    return this.collection.findOne({ _id: new ObjectId(id) });
  }

  async create(payload) {
    const doc = {
      code: payload.code,                   // unique, bắt buộc
      title: payload.title,                 // bắt buộc
      author: payload.author ?? "",
      price: Number(payload.price ?? 0),
      qty: Number(payload.qty ?? 0),
      publisherId: payload.publisherId ? new ObjectId(payload.publisherId) : null,
      language: payload.language ?? "vi",
      yearOfPublication: payload.yearOfPublication ?? "",
      image: payload.image ?? "",           // ✅ thêm cột hình (URL)
      createdAt: new Date(),
    };
    const { insertedId } = await this.collection.insertOne(doc);
    return this.findById(insertedId);
  }
async update(id, payload) {
  const filter = { _id: new ObjectId(id) };

  // build $set chỉ với field có gửi lên
  const $set = {};
  if (payload.title !== undefined)   $set.title = payload.title;
  if (payload.author !== undefined)  $set.author = payload.author;
  if (payload.price !== undefined)   $set.price = Number(payload.price);
  if (payload.qty !== undefined)     $set.qty = Number(payload.qty);
  if (payload.publisherId !== undefined) $set.publisherId =
      payload.publisherId ? new ObjectId(payload.publisherId) : null;
  if (payload.language !== undefined) $set.language = payload.language;
  if (payload.yearOfPublication !== undefined) $set.yearOfPublication = payload.yearOfPublication;
  if( payload.image !== undefined)    $set.image = payload.image;
  // nếu không có gì để set thì trả luôn bản ghi hiện tại
  if (Object.keys($set).length === 0) {
    return this.findById(id);
  }

  // debug (tạm)
  // console.log("BOOK UPDATE filter:", filter, "$set:", $set);

  const r = await this.collection.updateOne(filter, { $set });
  if (r.matchedCount === 0) return null;        // => 404
  // trả lại bản ghi sau update
  return this.findById(id);
}                                    
  delete(id) {
    return this.collection.deleteOne({ _id: new ObjectId(id) });
  }
}

module.exports = BookService;
