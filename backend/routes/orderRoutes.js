
import express from "express";
import authMiddleware from "../middleware/authMiddleware.js";
import {
    checkout,
    getMyOrders
} from "../controllers/orderController.js";

const router = express.Router();

router.post("/checkout", authMiddleware, checkout);
router.get("/my", authMiddleware, getMyOrders);

export default router;
