# 🎯 Hệ Thống Điểm Thưởng (Bonus Point System)

## 📋 Tổng Quan

Hệ thống điểm thưởng cho phép khách hàng tích điểm khi thanh toán và sử dụng điểm hoặc hưởng giảm giá theo hạng thành viên.

## 🏆 Cơ Chế Hoạt Động

### 💰 Quy Đổi Điểm
- **Tích điểm**: 10,000 VNĐ = 1 điểm
- **Sử dụng điểm**: 1 điểm = 1,000 VNĐ giảm giá

### 🥇 Hạng Thành Viên & Giảm Giá
| Hạng | Điều Kiện | Giảm Giá |
|------|-----------|----------|
| 🥉 Đồng | 500 điểm | 5% |
| 🥈 Bạc | 1,000 điểm | 10% |
| 🥇 Vàng | 2,000 điểm | 15% |
| 💎 Bạch Kim | 5,000 điểm | 20% |
| 💎💎 Kim Cương | 10,000 điểm | 25% |

### 🎮 Luật Sử Dụng
- **Lựa chọn 1**: Tiêu điểm để giảm tiền trực tiếp
- **Lựa chọn 2**: Giữ điểm, dùng giảm giá theo hạng
- ❌ **KHÔNG thể**: Vừa tiêu điểm vừa dùng giảm giá hạng

## 🚀 API Endpoints

### 🎁 Bonus Endpoints (`/api/bonus`)

```typescript
// Xem thông tin điểm và hạng
GET /bonus/profile/:userId

// Lịch sử giao dịch điểm
GET /bonus/history/:userId?limit=50

// Tính toán giảm giá (preview)
POST /bonus/calculate-discount
{
  "userId": "string",
  "totalAmount": number,
  "usePoints": number?, // Số điểm muốn dùng
  "useTierDiscount": boolean? // Dùng giảm giá hạng
}

// Admin điều chỉnh điểm
POST /bonus/admin/adjust (ADMIN only)
{
  "userId": "string",
  "points": number, // + cộng điểm, - trừ điểm
  "reason": "string"
}

// Thông tin hệ thống (public)
GET /bonus/system-info
```

### 🧾 Order Endpoints (`/api/orders`)

```typescript
// Tính toán hóa đơn với bonus
POST /orders/calculate
{
  "customerId": "string",
  "items": [...],
  "subtotal": number,
  "bonusPointsToUse": number?, // Điểm muốn dùng
  "useTierDiscount": boolean?, // Dùng giảm giá hạng
  // ... other fields
}

// Tạo hóa đơn mới
POST /orders
{
  "customerId": "string",
  "items": [...],
  "subtotal": number,
  "bonusPointsToUse": number?,
  "useTierDiscount": boolean?,
  "paymentMethod": "CASH|BANK_TRANSFER|...",
  // ... other fields
}

// Hoàn thành thanh toán (tích điểm)
PATCH /orders/:id/complete-payment
```

## 💻 Workflow Frontend

### 1. Khi Tạo Hóa Đơn

```javascript
// Lấy thông tin customer
const customerInfo = await fetch(`/api/bonus/profile/${customerId}`);
// Response: { bonusPoints: 1500, membershipTier: "SILVER", ... }

// Hiển thị options cho customer:
// Option 1: Dùng điểm (1500 điểm = 1,500,000 VNĐ giảm)
// Option 2: Giữ điểm, giảm 10% theo hạng Bạc
```

### 2. Tính Toán Preview

```javascript
// Preview giảm giá khi customer chọn options
const preview = await fetch('/api/bonus/calculate-discount', {
  method: 'POST',
  body: JSON.stringify({
    userId: customerId,
    totalAmount: 500000,
    usePoints: 100, // Hoặc null nếu dùng tier discount
    useTierDiscount: false
  })
});

// Response:
{
  "pointsDiscount": 100000,     // 100 điểm = 100k
  "tierDiscount": 0,            // Không dùng tier
  "totalDiscount": 100000,      
  "finalAmount": 400000,        // 500k - 100k
  "canUsePoints": true,
  "maxUsablePoints": 500        // Tối đa dùng được
}
```

### 3. Tạo & Thanh Toán

```javascript
// Tạo hóa đơn
const order = await fetch('/api/orders', {
  method: 'POST', 
  body: JSON.stringify({
    customerId: "user-uuid",
    items: [...],
    subtotal: 500000,
    bonusPointsToUse: 100, // Customer chọn dùng 100 điểm
    useTierDiscount: false,
    paymentMethod: "CASH"
  })
});

// Hoàn thành thanh toán để tích điểm
await fetch(`/api/orders/${order.id}/complete-payment`, {
  method: 'PATCH'
});
// Hệ thống sẽ tự động tích điểm cho customer
```

## 🎯 Use Cases

### Khách Hạng Bạc (1,500 điểm, giảm 10%)
**Hóa đơn 500,000 VNĐ**

**Option 1: Dùng 100 điểm**
- Giảm: 100,000 VNĐ (từ điểm)
- Thanh toán: 400,000 VNĐ
- Tích thêm: 40 điểm (từ 400k)
- Điểm còn lại: 1,440 điểm

**Option 2: Giữ điểm, dùng giảm hạng**  
- Giảm: 50,000 VNĐ (10% hạng Bạc)
- Thanh toán: 450,000 VNĐ
- Tích thêm: 45 điểm (từ 450k)
- Điểm còn lại: 1,545 điểm

## 🔧 Setup & Testing

### 1. Chạy Migration
```bash
npm run prisma:migrate:dev
```

### 2. Tạo Demo Data (Optional)
```bash
npx tsx seed-bonus.ts
```

### 3. Test API
```bash
# Start server
npm run start:dev

# Test endpoints với Postman/Thunder Client
GET http://localhost:3000/api/bonus/system-info
```

## 🚨 Lưu Ý Quan Trọng

1. **Validation**: Luôn validate customer có đủ điểm trước khi redeem
2. **Transaction**: Dùng database transaction cho order + bonus operations  
3. **Tier Update**: Hạng được cập nhật tự động sau mỗi giao dịch
4. **History**: Tất cả thay đổi điểm đều được log trong `bonus_transactions`
5. **Security**: Chỉ admin và chính user mới xem được thông tin điểm

## 🔄 Migration Script
Đã tạo migration: `20260422044409_add_bonus_point_system`

Thêm:
- Enum `MembershipTier`, `BonusTransactionType`  
- Table `bonus_transactions`
- Fields trong `users`: `bonusPoints`, `membershipTier`
- Fields trong `orders`: `bonusPointsEarned`, `bonusPointsUsed`, etc.