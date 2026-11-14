# Hệ thống quản lý kho WinKids (phiên bản 2 – chạy trên máy hoặc trên Vercel)

Web bám theo các màn hình Figma của nhóm (UC 1 – UC 10). Cùng một bộ code chạy được 2 kiểu:

| | Chạy trên máy | Chạy trên Vercel |
|---|---|---|
| Cơ sở dữ liệu | file `winkids.db` (tự tạo lần đầu) | Turso (SQLite trên mạng) |
| Ai vào được | máy đó + thiết bị cùng Wi-Fi | bất kỳ ai có link và tài khoản |
| Cách chạy | bấm đúp `start-windows.bat` | đưa lên GitHub → Vercel tự chạy |

Web tự nhận biết: có biến môi trường `TURSO_DATABASE_URL` và `TURSO_AUTH_TOKEN` thì dùng Turso, không có thì dùng file `winkids.db`.

## Chạy trên máy (không cần biết code)
1. Cài **Node.js** bản LTS (22 trở lên) tại https://nodejs.org.
2. Bấm đúp `start-windows.bat` (Mac: `start-mac.command`). Trình duyệt tự mở http://localhost:3000.
3. Muốn tắt: đóng cửa sổ đen (hoặc Ctrl + C).

## Đưa lên Vercel
Xem file hướng dẫn chi tiết đi kèm. Tóm tắt:
1. Tạo database trên **Turso** → lấy địa chỉ (`libsql://...`) và mã truy cập (token).
2. Đưa toàn bộ thư mục này lên **GitHub** (KHÔNG đưa file `winkids.db`).
3. Trên **Vercel**: Import repo → thêm 2 biến `TURSO_DATABASE_URL`, `TURSO_AUTH_TOKEN` → Deploy.
4. Lần mở đầu tiên, web tự tạo bảng và dữ liệu mẫu trên Turso.

## Tài khoản mẫu (mật khẩu đều là `123456` – nhớ đổi khi đưa lên mạng)
| Vai trò | Tên đăng nhập | Họ tên |
|---|---|---|
| Quản lý | 0905100001 | Bá Minh |
| Nhân viên | 0905100002 | Nguyễn Văn A |
| Nhân viên | 0905100003 | Trần Thị B |
| Chưa phân quyền | 0905100004 | Lê Văn C |

Đổi mật khẩu: bấm tên mình ở góc trên bên phải › **Đổi mật khẩu**.

## Cấu trúc thư mục
```
public/        giao diện (index.html, app.js, style.css, logo.png)
api/index.js   cửa vào cho Vercel (gọi server.js)
server.js      máy chủ + toàn bộ API (đăng nhập, phân quyền, nghiệp vụ kho)
db.js          cơ sở dữ liệu: tạo bảng, dữ liệu mẫu, kết nối SQLite/Turso
vercel.json    cấu hình Vercel
package.json   thông tin dự án (Node 22)
uploads/       ảnh cũ của bản 1 (bản 2 lưu ảnh thẳng trong cơ sở dữ liệu)
WinKid_Database.sql  script SQL Server dùng trong báo cáo (web không dùng khi chạy)
```

## Dữ liệu
- Ảnh hóa đơn/minh chứng được thu nhỏ trên trình duyệt rồi lưu trong cơ sở dữ liệu.
- Giờ giấc luôn theo giờ Việt Nam (UTC+7).
- Làm lại dữ liệu từ đầu (trên máy): tắt web, xóa `winkids.db`, chạy lại.
