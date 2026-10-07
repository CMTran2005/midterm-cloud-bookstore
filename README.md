# Ứng Dụng Quản Lý Sách Trên Điện Toán Đám Mây (Cloud Bookstore)

Dự án kiểm tra giữa kì môn **Điện toán đám mây** đáp ứng 3 tiêu chí:
1. **Bảo mật phân quyền (Least Privilege)** trên MongoDB Atlas (Tách biệt luồng Đọc/Ghi).
2. **Khả năng chịu tải phân tán (Stateless Architecture)** với Session tập trung trên MongoDB Atlas.
3. **Quy trình DevOps chuẩn** (Quản lý Git phân nhánh feature, Merge Node và triển khai PaaS trên Render).

---

## Thông Tin Sinh Viên
- **Họ và tên:** Trần Châu Minh
- **MSSV:** 23IT166
- **Database:** `DB_23IT166`
- **Tiền tố mã sản phẩm bắt buộc (3 số cuối MSSV):** `166` (Ví dụ: `166-BK01`)
- **Mức thuế VAT động áp dụng:** `VAT = (Chữ số cuối MSSV + 4)% = (6 + 4)% = 10%`

---

## Yêu cầu Hệ thống & Biến Môi trường (.env)

Tạo file `.env` tại thư mục gốc với cấu trúc:

```env
PORT=3000
MONGODB_READ_URI=mongodb+srv://read23IT166:<PASSWORD>@vkucluster.lae8ukg.mongodb.net/DB_23IT166?appName=VkuCluster
MONGODB_WRITE_URI=mongodb+srv://write23IT166:<PASSWORD>@vkucluster.lae8ukg.mongodb.net/DB_23IT166?appName=VkuCluster
SESSION_SECRET=super_secret_session_key
MSSV=23IT166
HOTEN=Trần Châu Minh
```

> **Lưu ý:**
> - Tài khoản `read23IT166` chỉ được cấp quyền `read` trên database `DB_23IT166`.
> - Tài khoản `write23IT166` được cấp quyền `readWrite` trên database `DB_23IT166`.
> - Cần mở **Network Access** trên MongoDB Atlas cho IP `0.0.0.0/0` để cho phép kết nối từ máy tính và cloud hosting (Render).

---

## Kiến trúc Hệ thống

1. **Đa luồng kết nối CSDL (Least Privilege):**
   - Ứng dụng tạo 2 connection Mongoose độc lập: `readConnection` và `writeConnection`.
   - Mọi truy vấn xem danh sách sách (`GET /`) chỉ đi qua `readConnection`.
   - Mọi thao tác thêm sách mới (`POST /books/add`) chỉ đi qua `writeConnection`.
2. **Stateless Session (Cloud Session Store):**
   - Sử dụng `express-session` kết hợp với `connect-mongo`.
   - Phiên làm việc (Session) không lưu trong RAM máy chủ mà được ghi tập trung xuống Cloud MongoDB Atlas (`sessions` collection) bằng `writeConnection`.
   - Giúp ứng dụng dễ dàng Scale Out (Auto-scaling đa máy chủ) mà không lo mất session của người dùng.
3. **Thuật toán Cá nhân hóa:**
   - Kiểm tra tiền tố mã sản phẩm: Bắt buộc bắt đầu bằng `166`. Nếu sai sẽ từ chối thêm và báo lỗi.
   - Tính toán VAT động: Giá sau thuế = `Giá gốc * 1.1` (10% VAT). Giá sau thuế được lưu trữ trực tiếp vào CSDL và render ra giao diện Handlebars.
   - Footer trang web hiển thị đầy đủ: Họ tên, MSSV và mức VAT áp dụng.
