const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const ApiError = require("../api-error");
const { getClient, getDb } = require("../../utils/mongodb.util"); 
const EmployeeService = require("../services/employee.service");
const ReaderService = require("../services/reader.service");

const JWT_SECRET = "dev-secret";
const JWT_EXPIRES = "7d";

// 1. Đăng ký
exports.register = async (req, res, next) => {
    res.json({ message: "Register handler" });
};

// 2. Đăng nhập
exports.login = async (req, res, next) => {
    try {
        const { code, password } = req.body;
        if (!code || !password) return next(new ApiError(400, "Thiếu code/password"));

        await getClient();
        const db = getDb();
        const empSvc = new EmployeeService(db);
        const readerSvc = new ReaderService(db);

        let user = null;
        let role = "";

        // Tìm trong bảng Nhân viên
        const emp = await empSvc.findByCode(code);
        if (emp && await bcrypt.compare(password, emp.passwordHash)) {
            user = emp;
            role = emp.role || "staff";
        }

        // Nếu không thấy, tìm trong bảng Độc giả
        if (!user) {
            const reader = await readerSvc.findByCode(code);
            if (reader && await bcrypt.compare(password, reader.passwordHash)) {
                user = reader;
                role = "reader";
            }
        }

        if (!user) return next(new ApiError(401, "Sai tài khoản hoặc mật khẩu"));

        // Tạo token
        const token = jwt.sign(
            { sub: user._id, code: user.code, role: role },
            JWT_SECRET,
            { expiresIn: JWT_EXPIRES }
        );

        res.json({
            token,
            user: { ...user, role }
        });
    } catch (e) {
        next(new ApiError(500, e.message));
    }
};

// 3. Lấy thông tin User (Me)
exports.me = async (req, res, next) => {
    try {
        const { code, role } = req.user; // Lấy từ middleware verifyToken
        await getClient();
        const db = getDb();
        let userFull = null;

        if (role === 'reader') {
            const svc = new ReaderService(db);
            userFull = await svc.findByCode(code);
        } else {
            const svc = new EmployeeService(db);
            userFull = await svc.findByCode(code);
        }

        // Trả về thông tin gộp từ Token và Database
        res.json({
            user: { ...req.user, ...(userFull || {}) }
        });
    } catch (e) {
        res.json({ user: req.user });
    }
};

// 4. CẬP NHẬT HỒ SƠ (Hàm này bạn đang thiếu nên bị lỗi)

exports.updateProfile = async (req, res, next) => {
    try {
        // 1. Lấy password từ req.body
        const { fullName, phone, address, gender, dob, password } = req.body; 
        const { sub, role } = req.user; 

        await getClient();
        const db = getDb();
        
        // 2. Tạo object chứa dữ liệu cần update
        const updateData = {};

        if (fullName && fullName.trim() !== "") updateData.fullName = fullName;
        if (phone && phone.trim() !== "") updateData.phone = phone;
        if (address && address.trim() !== "") updateData.address = address;
        if (dob && dob.trim() !== "") updateData.dob = dob;
        if (gender !== undefined && gender !== null) updateData.gender = gender;

        if (password && password.trim() !== "") {
            const salt = await bcrypt.genSalt(10);
            updateData.passwordHash = await bcrypt.hash(password, salt); 
        }

        let updatedUser = null;
        
        // 3. Gọi Service để lưu xuống Database
        if (role === 'reader') {
            const svc = new ReaderService(db);
            // Service sẽ nhận updateData (có chứa passwordHash) để lưu
            updatedUser = await svc.update(sub, updateData); 
        } else {
            const svc = new EmployeeService(db);
            updatedUser = await svc.update(sub, updateData);
        }

        // ... (phần trả về response giữ nguyên) ...
        if (!updatedUser) return next(new ApiError(404, "Không tìm thấy user"));
        res.json({ message: "Cập nhật thành công", user: updatedUser });

    } catch (error) {
        next(new ApiError(500, error.message));
    }
};