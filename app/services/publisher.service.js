// app/services/publisher.service.js
const { ObjectId } = require("mongodb");


class PublisherService {
  constructor(db) {
    this.collection = db.collection("publishers");
    // Tạo index unique cho "code"
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
      code: payload.code,
      name: payload.name,
      address: payload.address ?? "",
      createdAt: new Date(),
    };
    const result = await this.collection.insertOne(doc);
    return await this.findById(result.insertedId);
  }

  async update(id, payload) {
   const filter = { _id: new ObjectId(id) };
   const $set = {};
if (payload.code !== undefined)   $set.code = payload.code;
if (payload.name !== undefined)  $set.name = payload.name;
if (payload.address !== undefined)   $set.address = payload.address;
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

module.exports = PublisherService;
