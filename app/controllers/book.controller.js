// app/controllers/book.controller.js
const { ObjectId } = require("mongodb"); 
const ApiError = require("../api-error");
const { getClient, getDb } = require("../../utils/mongodb.util");
const BookService = require("../services/book.service");

exports.create = async (req, res, next) => {
  try {
    if (!req.body?.code || !req.body?.title) {
      return next(new ApiError(400, "code và title là bắt buộc"));
    }
    await getClient();
    const service = new BookService(getDb());
    const data = await service.create(req.body);
    res.status(201).json(data);
  } catch (e) {
    if (e?.code === 11000) return next(new ApiError(409, "code sách đã tồn tại"));
    next(new ApiError(500, e.message || "Không tạo được sách"));
  }
};

exports.findAll = async (req, res, next) => {
  try {
    await getClient();
    const service = new BookService(getDb());
    const { title, code } = req.query;
    const filter = {};
    if (title) filter.title = { $regex: title, $options: "i" };
    if (code) filter.code = code;
    res.json(await service.find(filter));
  } catch {
    next(new ApiError(500, "Không lấy được danh sách sách"));
  }
};

exports.findOne = async (req, res, next) => {
  try {
    await getClient();
    const service = new BookService(getDb());
    const item = await service.findById(req.params.id);
    if (!item) return next(new ApiError(404, "Không tìm thấy sách"));
    res.json(item);
  } catch {
    next(new ApiError(400, "ID không hợp lệ"));
  }
};
exports.update = async (req, res, next) => {
  try {
    const id = req.params.id;
    if (!ObjectId.isValid(id)) {
      return next(new ApiError(400, "ID không hợp lệ"));
    }
    
    await getClient();
    const service = new BookService(getDb());
    const updated = await service.update(id, req.body);
    if (!updated) {
      console.log("Không tìm thấy theo _id:", id);
      return next(new ApiError(404, "Không tìm thấy sách"));
    }
    res.json(updated);
  } catch (e) {
    next(new ApiError(400, e.message || "Cập nhật sách thất bại"));
  }
};


exports.remove = async (req, res, next) => {
  try {
    await getClient();
    const service = new BookService(getDb());
    const r = await service.delete(req.params.id);
    if (!r.deletedCount) return next(new ApiError(404, "Không tìm thấy sách"));
    res.json({ deleted: true });
  } catch {
    next(new ApiError(400, "Xóa sách thất bại"));
  }
};
