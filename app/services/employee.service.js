const { ObjectId } = require("mongodb");
const bcrypt = require("bcryptjs");

class EmployeeService {
  constructor(db) {
    this.col = db.collection("employees");
    this.col.createIndex({ code: 1 }, { unique: true }).catch(() => {});
  }

  findByCode(code) { return this.col.findOne({ code }); }

  // 1. Thêm phone và address vào tham số nhận vào (cho phép nhận giá trị rỗng nếu không có)
  async create({ code, fullName, password, role = "staff", phone = "", address = "" }) {
    const passwordHash = await bcrypt.hash(password, 10);
    
    // 2. Thêm phone và address vào object doc để lưu xuống DB
    const doc = { 
        code, 
        fullName, 
        passwordHash, 
        role, 
        phone,  
        address, 
        createdAt: new Date() 
    };
    
    const { insertedId } = await this.col.insertOne(doc);
    return this.col.findOne({ _id: insertedId }, { projection: { passwordHash: 0 } });
  }
}

module.exports = EmployeeService;