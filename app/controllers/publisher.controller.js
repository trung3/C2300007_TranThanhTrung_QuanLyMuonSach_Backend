// app/controllers/publisher.controller.js
const { ObjectId } = require("mongodb");
const ApiError = require("../api-error");
const { getClient, getDb } = require("../../utils/mongodb.util");
const PublisherService = require("../services/publisher.service");

exports.create = async (req, res, next) => {
  try {
    if (!req.body?.code || !req.body?.name) {
      return next(new ApiError(400, "code và name là bắt buộc"));
    }
    await getClient();
    const service = new PublisherService(getDb());
    const data = await service.create(req.body);
    res.status(201).json(data);
  } catch (e) {
    if (e?.code === 11000) return next(new ApiError(409, "code đã tồn tại"));
    next(new ApiError(500, e.message || "Không tạo được nhà xuất bản"));
  }
};

exports.findAll = async (_req, res, next) => {
  try {
    await getClient();
    const service = new PublisherService(getDb());
    res.json(await service.find({}));
  } catch {
    next(new ApiError(500, "Không lấy được danh sách NXB"));
  }
};

exports.findOne = async (req, res, next) => {
  try {
    await getClient();
    const service = new PublisherService(getDb());
    const item = await service.findById(req.params.id);
    if (!item) return next(new ApiError(404, "Không tìm thấy NXB"));
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
const service = new PublisherService(getDb());
const updated = await service.update(id, req.body);
if (!updated) {
  console.log("Không tìm thấy theo _id:", id);
  return next(new ApiError(404, "Không tìm thấy NXB"));
}
res.json(updated);
  } catch (e) {
    next(new ApiError(400, e.message || "Cập nhật thất bại"));
  }
};

exports.remove = async (req, res, next) => {
  try {
    await getClient();
    const service = new PublisherService(getDb());
    const r = await service.delete(req.params.id);
    if (!r.deletedCount) return next(new ApiError(404, "Không tìm thấy NXB"));
    res.json({ deleted: true });
  } catch {
    next(new ApiError(400, "Xóa thất bại"));
  }
};
