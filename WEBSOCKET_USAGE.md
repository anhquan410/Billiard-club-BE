# WebSocket Events Documentation

## Kết nối WebSocket

Backend WebSocket server chạy trên cùng port với HTTP server (mặc định: 3000).

Frontend có thể kết nối WebSocket tại: `ws://localhost:3000` (hoặc domain thực)

## Events Frontend cần lắng nghe

### 1. `tableStarted` - Khi có bàn được bật
```typescript
interface TableStartedEvent {
  tableId: string;
  tableNumber: number;
  status: "OCCUPIED";
  sessionId: string;
}
```

**Sử dụng:**
```javascript
socket.on('tableStarted', (data) => {
  console.log(`Bàn ${data.tableNumber} đã được bật`);
  // Cập nhật UI: đổi màu bàn từ xanh (AVAILABLE) sang đỏ (OCCUPIED)
  updateTableUI(data.tableId, 'OCCUPIED');
});
```

### 2. `tableEnded` - Khi có bàn được tắt
```typescript
interface TableEndedEvent {
  tableId: string;
  tableNumber: number;
  status: "AVAILABLE";
}
```

**Sử dụng:**
```javascript
socket.on('tableEnded', (data) => {
  console.log(`Bàn ${data.tableNumber} đã được tắt`);
  // Cập nhật UI: đổi màu bàn từ đỏ (OCCUPIED) về xanh (AVAILABLE)
  updateTableUI(data.tableId, 'AVAILABLE');
});
```

### 3. `tableStatusChanged` - Khi có thay đổi trạng thái bàn bất kỳ
```typescript
interface TableStatusChangeEvent {
  tableId: string;
  tableNumber: number;
  status: "AVAILABLE" | "OCCUPIED" | "MAINTENANCE";
  sessionId?: string;
}
```

## Ví dụ kết nối từ Frontend (JavaScript/TypeScript)

```javascript
import { io } from 'socket.io-client';

// Kết nối WebSocket
const socket = io('http://localhost:3000');

// Lắng nghe sự kiện kết nối thành công
socket.on('connect', () => {
  console.log('WebSocket connected:', socket.id);
});

// Lắng nghe sự kiện bàn được bật
socket.on('tableStarted', (data) => {
  updateTableStatus(data.tableId, 'OCCUPIED', data.sessionId);
});

// Lắng nghe sự kiện bàn được tắt  
socket.on('tableEnded', (data) => {
  updateTableStatus(data.tableId, 'AVAILABLE');
});

// Hàm cập nhật UI
function updateTableStatus(tableId, status, sessionId = null) {
  const tableElement = document.getElementById(`table-${tableId}`);
  if (tableElement) {
    if (status === 'OCCUPIED') {
      tableElement.classList.remove('table-available');
      tableElement.classList.add('table-occupied');
    } else if (status === 'AVAILABLE') {
      tableElement.classList.remove('table-occupied');
      tableElement.classList.add('table-available');
    }
  }
}
```

## CSS Ví dụ cho màu sắc bàn

```css
.table-available {
  background-color: #4CAF50; /* Xanh lá - bàn trống */
  color: white;
}

.table-occupied {
  background-color: #f44336; /* Đỏ - bàn có khách */
  color: white;
}

.table-maintenance {
  background-color: #ff9800; /* Cam - bảo trì */
  color: white;
}
```

## Lưu ý

- Tất cả client đang kết nối sẽ nhận được events cùng lúc
- Không cần gửi request để nhận updates, chỉ cần lắng nghe events
- Events được emit tự động khi có thao tác bật/tắt bàn thành công
- Đảm bảo frontend xử lý lỗi kết nối WebSocket và tự động reconnect nếu cần