const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");
const ApiError = require("../api-error");
const { getClient, getDb } = require("../../utils/mongodb.util");
const EmployeeService = require("../services/employee.service");
// 👇 1. Import thêm ReaderService
const ReaderService = require("../services/reader.service");

const JWT_SECRET = "dev-secret";
const JWT_EXPIRES = "7d";

// ĐĂNG KÝ NHÂN VIÊN (Giữ nguyên hoặc dùng để tạo admin ban đầu)
exports.register = async (req, res, next) => {
  try {
    const { code, fullName, password, role } = req.body || {};
    if (!code || !fullName || !password) {
      return next(new ApiError(400, "Thiếu code/fullName/password"));
    }
    await getClient();
    const svc = new EmployeeService(getDb());
    const existed = await svc.findByCode(code);
    if (existed) return next(new ApiError(409, "Nhân viên đã tồn tại"));
    
    const emp = await svc.create({ code, fullName, password, role });
    res.status(201).json(emp);
  } catch (e) {
    next(new ApiError(500, e.message || "Lỗi tạo nhân viên"));
  }
};

// ĐĂNG NHẬP (SỬA LẠI ĐỂ CHECK CẢ 2 BẢNG)
exports.login = async (req, res, next) => {
  try {
    const { code, password } = req.body || {};
    if (!code || !password) {
      return next(new ApiError(400, "Thiếu code/password"));
    }

    await getClient();
    const db = getDb();
    const empSvc = new EmployeeService(db);
    const readerSvc = new ReaderService(db); // Khởi tạo Reader Service

    let user = null;
    let role = "";

    // --- BƯỚC 1: Tìm trong bảng NHÂN VIÊN ---
    const emp = await empSvc.findByCode(code);
    if (emp) {
      const isMatch = await bcrypt.compare(password, emp.passwordHash);
      if (isMatch) {
        user = emp;
        role = emp.role || "staff"; // Lấy role từ DB (admin/staff)
      }
    }

    // --- BƯỚC 2: Nếu chưa tìm thấy NV, tìm trong bảng ĐỘC GIẢ ---
    if (!user) {
      // Lưu ý: Đảm bảo ReaderService có hàm findByCode (xem hướng dẫn bên dưới)
      const reader = await readerSvc.findByCode(code); 
      if (reader) {
        const isMatch = await bcrypt.compare(password, reader.passwordHash);
        if (isMatch) {
          user = reader;
          role = "reader"; // 👈 Gán cứng role là độc giả
        }
      }
    }

    // --- BƯỚC 3: Kiểm tra kết quả ---
    if (!user) {
      return next(new ApiError(401, "Sai tài khoản hoặc mật khẩu"));
    }

    // --- BƯỚC 4: Tạo token và trả về kết quả ---
    const token = jwt.sign(
      { sub: user._id, code: user.code, role: role }, 
      JWT_SECRET, 
      { expiresIn: JWT_EXPIRES }
    );

    // 👇 Trả về cả token VÀ thông tin user (để frontend check role)
    res.json({ 
        token,
        user: {
            _id: user._id,
            code: user.code,
            fullName: user.fullName,
            role: role // <--- Quan trọng
        }
    });

  } catch (e) {
    next(new ApiError(500, e.message || "Đăng nhập thất bại"));
  }
};

exports.me = async (req, res) => {
  res.json({ user: req.user });
};