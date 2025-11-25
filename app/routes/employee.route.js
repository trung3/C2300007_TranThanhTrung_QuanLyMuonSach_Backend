const express = require("express");
const router = express.Router();
const ctrl = require("../controllers/employee.controller");
const auth = require("../middlewares/auth.middleware");
const authorize = require("../middlewares/authorize.middleware"); // ở dưới

// chỉ admin được quản lý nhân viên
router.get("/", auth, authorize("admin"), ctrl.findAll);
router.get("/:id", auth, authorize("admin"), ctrl.findOne);
router.post("/", auth, authorize("admin"), ctrl.create);
router.put("/:id", auth, authorize("admin"), ctrl.update);
router.delete("/:id", auth, authorize("admin"), ctrl.remove);

module.exports = router;
