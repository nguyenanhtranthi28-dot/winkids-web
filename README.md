# Hệ thống quản lý kho WinKids

🔗 **Web đã triển khai:** https://winkids-web.vercel.app

## Giới thiệu

WinKids là khu vui chơi trẻ em kết hợp quán cà phê. Hiện quán quản lý nguyên vật liệu bằng sổ tay và Excel nên khó kiểm soát số tồn, hàng nhập thiếu hoặc lỗi, và việc xuất kho của nhân viên.

Hệ thống quản lý kho WinKids là ứng dụng web giúp **quản lý** và **nhân viên** cùng làm việc trên một dữ liệu: lập phiếu nhập và phiếu xuất, theo dõi tồn kho theo thời gian thực, nhận cảnh báo khi nguyên vật liệu sắp hết, quản lý nhà cung cấp và đơn đặt hàng, xem báo cáo. Yêu cầu được xây dựng từ buổi phỏng vấn quản lý quán (anh Bá Minh).

## Chức năng theo use case

| Use case | Chức năng | Người dùng |
|---|---|---|
| UC 1 | Đăng nhập (tên đăng nhập là số điện thoại), đổi mật khẩu | Quản lý, Nhân viên |
| UC 2 | Tra cứu thông tin nguyên vật liệu, lọc theo danh mục và kho | Quản lý, Nhân viên |
| UC 3 | Kiểm tra hàng nhập theo đơn đặt hàng, lập phiếu nhập, ghi nhận hàng lỗi/thiếu kèm ảnh minh chứng | Nhân viên |
| UC 4 | Lập phiếu xuất kho, xử lý khi thiếu hàng | Nhân viên |
| UC 5 | Xem lịch sử nhập kho và xuất kho | Quản lý, Nhân viên |
| UC 6 | Kiểm tra và xác nhận phiếu nhập/xuất, theo dõi tồn kho theo thời gian thực, cảnh báo tự động khi dưới mức tối thiểu | Quản lý |
| UC 7 | Quản lý đơn đặt hàng (tạo, sửa, xuất file, soạn Gmail gửi nhà cung cấp) và thông tin nhà cung cấp | Quản lý |
| UC 8 | Quản lý danh mục hàng hóa (thêm, sửa, xóa loại sản phẩm) | Quản lý |
| UC 9 | Báo cáo nhập, xuất, tồn kho kèm biểu đồ theo ngày/tuần/tháng/năm; lịch sử chỉnh sửa; xuất file Excel/PDF | Quản lý |
| UC 10 | Tạo tài khoản và phân quyền | Quản lý |

Một số quy tắc nghiệp vụ chính:
- Tồn kho chỉ thay đổi sau khi **quản lý xác nhận** phiếu nhập/xuất.
- Xuất kho trừ theo **lô gần hết hạn trước** (FEFO).
- Hệ thống tự sinh cảnh báo khi nguyên vật liệu xuống dưới mức tối thiểu.
- Mọi thao tác quan trọng đều được ghi vào **nhật ký**: người thực hiện, thời gian, nội dung.

## Công nghệ

| Thành phần | Công nghệ |
|---|---|
| Giao diện | HTML, CSS, JavaScript (thiết kế theo bản Figma của nhóm) |
| Máy chủ | Node.js, chạy dưới dạng Vercel Functions |
| Cơ sở dữ liệu | SQLite, lưu trên dịch vụ đám mây **Turso** (máy chủ Singapore) |
| Triển khai | **Vercel**: tự động cập nhật mỗi khi code trên GitHub thay đổi |

```
Trình duyệt ──▶ Vercel (giao diện + API) ──▶ Turso (cơ sở dữ liệu SQLite)
```

Cấu trúc bảng giống với script `WinKid_Database.sql` (SQL Server) trong báo cáo.

## Cấu trúc thư mục

```
public/            Giao diện: index.html, app.js, style.css, logo.png
api/index.js       Điểm vào của Vercel, chuyển yêu cầu cho server.js
server.js          Toàn bộ API: đăng nhập, phân quyền, nghiệp vụ kho, báo cáo
db.js              Tạo bảng, dữ liệu mẫu, kết nối cơ sở dữ liệu
vercel.json        Cấu hình triển khai trên Vercel
package.json       Thông tin dự án (Node.js 22)
WinKid_Database.sql  Script tạo cơ sở dữ liệu (SQL Server) dùng trong báo cáo
```

## Triển khai

Web được triển khai trên Vercel, kết nối tới cơ sở dữ liệu Turso qua 2 biến môi trường khai báo trong Vercel:

- `TURSO_DATABASE_URL`: địa chỉ cơ sở dữ liệu
- `TURSO_AUTH_TOKEN`: mã truy cập (giữ bí mật, không đưa lên GitHub)

Ở lần chạy đầu tiên, hệ thống tự tạo bảng và dữ liệu mẫu. Ảnh hóa đơn và ảnh minh chứng được thu nhỏ trên trình duyệt rồi lưu trong cơ sở dữ liệu. Thời gian luôn theo giờ Việt Nam (UTC+7).

## Tài khoản dùng thử

Đăng nhập tại https://winkids-web.vercel.app

| Vai trò | Tên đăng nhập (số điện thoại) | Mật khẩu |
|---|---|---|
| Quản lý | 0905100001 | 123456 |
| Nhân viên | 0905100002 | 123456 |

## Thành viên

| Họ và tên | Phụ trách |
|---|---|
| (Trần Thị Nguyên ANh | UC 3, UC 7, UC 10 |
| (Nguyễn Thị Ngân) | UC 1, UC 4, UC 8 |
| (Dịu Hiền ) | UC 5, UC 6, UC 9 |
| (Lê Thanh Đan Thục) | UC 1, UC 2|
