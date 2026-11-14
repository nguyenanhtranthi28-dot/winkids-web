/* =====================================================================
   CƠ SỞ DỮ LIỆU HỆ THỐNG QUẢN LÝ KHO WINKIDS
   Hệ quản trị: Microsoft SQL Server
   Dựa trên: mục 5.1.2 "Chuẩn hóa các bảng" trong báo cáo nhóm
             + dữ liệu hiển thị trên các màn hình Figma đã hoàn thiện
   Quy ước:  tên bảng và tên cột giữ đúng như báo cáo (camelCase)
   ===================================================================== */

IF DB_ID(N'WinKids') IS NOT NULL
BEGIN
    ALTER DATABASE WinKids SET SINGLE_USER WITH ROLLBACK IMMEDIATE;
    DROP DATABASE WinKids;
END
GO
CREATE DATABASE WinKids;
GO
USE WinKids;
GO

/* =====================================================================
   1. TÀI KHOẢN VÀ PHÂN QUYỀN  (UC 1, UC 10.1, UC 10.2)
   ===================================================================== */

-- Tên đăng nhập là số điện thoại của tài khoản (BR02 – UC_1)
CREATE TABLE TaiKhoan (
    maTaiKhoan   VARCHAR(20)    NOT NULL,
    hoTen        NVARCHAR(100)  NOT NULL,
    soDienThoai  VARCHAR(15)    NOT NULL,
    matKhau      VARCHAR(255)   NOT NULL,          -- lưu chuỗi đã mã hóa
    ngayTao      DATE           NOT NULL DEFAULT CAST(GETDATE() AS DATE),
    trangThai    VARCHAR(20)    NOT NULL DEFAULT 'HoatDong',
    CONSTRAINT PK_TaiKhoan PRIMARY KEY (maTaiKhoan),
    CONSTRAINT UQ_TaiKhoan_SDT UNIQUE (soDienThoai),
    CONSTRAINT CK_TaiKhoan_TrangThai CHECK (trangThai IN ('HoatDong','NgungHoatDong'))
);

CREATE TABLE PhanQuyen (
    maPhanQuyen   VARCHAR(20)    NOT NULL,
    tenPhanQuyen  NVARCHAR(50)   NOT NULL,
    moTa          NVARCHAR(255)  NULL,
    CONSTRAINT PK_PhanQuyen PRIMARY KEY (maPhanQuyen)
);

-- Tài khoản chưa có dòng nào ở bảng này = "Chưa phân quyền" (UC 10.1)
CREATE TABLE TaiKhoan_PhanQuyen (
    maTaiKhoan   VARCHAR(20) NOT NULL,
    maPhanQuyen  VARCHAR(20) NOT NULL,
    CONSTRAINT PK_TaiKhoan_PhanQuyen PRIMARY KEY (maTaiKhoan, maPhanQuyen),
    CONSTRAINT FK_TKPQ_TaiKhoan  FOREIGN KEY (maTaiKhoan)  REFERENCES TaiKhoan(maTaiKhoan),
    CONSTRAINT FK_TKPQ_PhanQuyen FOREIGN KEY (maPhanQuyen) REFERENCES PhanQuyen(maPhanQuyen)
);

/* =====================================================================
   2. DANH MỤC, KHO, NGUYÊN LIỆU  (UC 2, UC 8)
   ===================================================================== */

CREATE TABLE DanhMuc (
    maDanhMuc   VARCHAR(20)    NOT NULL,
    tenDanhMuc  NVARCHAR(100)  NOT NULL,
    moTa        NVARCHAR(255)  NULL,
    CONSTRAINT PK_DanhMuc PRIMARY KEY (maDanhMuc),
    CONSTRAINT UQ_DanhMuc_Ten UNIQUE (tenDanhMuc)
);

-- Bộ lọc "Kho" ở UC 2.2: Kho lạnh, Kho khô
CREATE TABLE Kho (
    maKho   VARCHAR(20)   NOT NULL,
    tenKho  NVARCHAR(50)  NOT NULL,
    CONSTRAINT PK_Kho PRIMARY KEY (maKho),
    CONSTRAINT UQ_Kho_Ten UNIQUE (tenKho)
);

-- Màn hình UC 8 gọi là "loại sản phẩm" (mã NL-xxx)
CREATE TABLE NguyenLieu (
    maNguyenLieu   VARCHAR(20)    NOT NULL,
    tenNguyenLieu  NVARCHAR(150)  NOT NULL,
    donViTinh      NVARCHAR(30)   NOT NULL,
    moTa           NVARCHAR(255)  NULL,
    soLuongTon     INT            NOT NULL DEFAULT 0,   -- = tổng soLuongCon của các lô
    mucToiThieu    INT            NOT NULL DEFAULT 3,
    mucToiDa       INT            NOT NULL DEFAULT 5,
    trangThai      VARCHAR(20)    NOT NULL DEFAULT 'DangSuDung',
    maDanhMuc      VARCHAR(20)    NOT NULL,
    maKho          VARCHAR(20)    NOT NULL,
    CONSTRAINT PK_NguyenLieu PRIMARY KEY (maNguyenLieu),
    CONSTRAINT UQ_NguyenLieu_Ten UNIQUE (tenNguyenLieu),
    CONSTRAINT CK_NguyenLieu_Ton CHECK (soLuongTon >= 0),
    CONSTRAINT CK_NguyenLieu_Muc CHECK (mucToiThieu >= 0 AND mucToiDa >= mucToiThieu),
    CONSTRAINT CK_NguyenLieu_TrangThai CHECK (trangThai IN ('DangSuDung','NgungSuDung')),
    CONSTRAINT FK_NguyenLieu_DanhMuc FOREIGN KEY (maDanhMuc) REFERENCES DanhMuc(maDanhMuc),
    CONSTRAINT FK_NguyenLieu_Kho     FOREIGN KEY (maKho)     REFERENCES Kho(maKho)
);

/* =====================================================================
   3. NHÀ CUNG CẤP VÀ ĐƠN ĐẶT HÀNG  (UC 7)
   ===================================================================== */

CREATE TABLE NhaCungCap (
    maNCC        VARCHAR(20)    NOT NULL,
    tenNCC       NVARCHAR(150)  NOT NULL,
    soDienThoai  VARCHAR(15)    NOT NULL,
    diaChi       NVARCHAR(255)  NULL,
    trangThai    VARCHAR(20)    NOT NULL DEFAULT 'DangHopTac',
    CONSTRAINT PK_NhaCungCap PRIMARY KEY (maNCC),
    CONSTRAINT UQ_NCC_Ten UNIQUE (tenNCC),
    CONSTRAINT UQ_NCC_SDT UNIQUE (soDienThoai),
    CONSTRAINT CK_NCC_TrangThai CHECK (trangThai IN ('DangHopTac','NgungHopTac'))
);

-- Mỗi đơn chỉ gửi cho một nhà cung cấp; trạng thái: Chờ đặt hàng → Đã đặt hàng → Đã hoàn tất
CREATE TABLE DonDatHang (
    maDonHang    VARCHAR(30)    NOT NULL,
    ngayDat      DATETIME       NOT NULL DEFAULT GETDATE(),
    trangThai    VARCHAR(30)    NOT NULL DEFAULT 'ChoDatHang',
    ghiChu       NVARCHAR(255)  NULL,
    maNCC        VARCHAR(20)    NOT NULL,
    maNguoiLap   VARCHAR(20)    NOT NULL,
    CONSTRAINT PK_DonDatHang PRIMARY KEY (maDonHang),
    CONSTRAINT CK_DDH_TrangThai CHECK (trangThai IN ('ChoDatHang','DaDatHang','DaHoanTat')),
    CONSTRAINT FK_DDH_NCC      FOREIGN KEY (maNCC)      REFERENCES NhaCungCap(maNCC),
    CONSTRAINT FK_DDH_NguoiLap FOREIGN KEY (maNguoiLap) REFERENCES TaiKhoan(maTaiKhoan)
);

CREATE TABLE ChiTietDonDatHang (
    maDonHang     VARCHAR(30)    NOT NULL,
    maNguyenLieu  VARCHAR(20)    NOT NULL,
    soLuongDat    INT            NOT NULL,
    ghiChu        NVARCHAR(150)  NULL,
    CONSTRAINT PK_ChiTietDonDatHang PRIMARY KEY (maDonHang, maNguyenLieu),
    CONSTRAINT CK_CTDDH_SL CHECK (soLuongDat > 0),
    CONSTRAINT FK_CTDDH_DDH FOREIGN KEY (maDonHang)    REFERENCES DonDatHang(maDonHang),
    CONSTRAINT FK_CTDDH_NL  FOREIGN KEY (maNguyenLieu) REFERENCES NguyenLieu(maNguyenLieu)
);

/* =====================================================================
   4. NHẬP KHO  (UC 3.1 – 3.5)
   ===================================================================== */

CREATE TABLE PhieuNhapKho (
    maPhieuNhap    VARCHAR(30)    NOT NULL,
    ngayNhap       DATETIME       NOT NULL DEFAULT GETDATE(),
    hinhAnhHoaDon  VARCHAR(255)   NULL,          -- ảnh hóa đơn chụp/tải lên (≤ 5 MB)
    trangThai      VARCHAR(30)    NOT NULL DEFAULT 'ChoXacNhan', -- UC 6.1: Chờ xác nhận / Chờ xử lý (có sai lệch) / Đã xác nhận
    ngayDuyet      DATETIME       NULL,          -- thời điểm quản lý xác nhận (UC 6.1)
    ghiChu         NVARCHAR(255)  NULL,
    maDonHang      VARCHAR(30)    NULL,
    maNguoiLap     VARCHAR(20)    NOT NULL,
    maNguoiDuyet   VARCHAR(20)    NULL,
    CONSTRAINT PK_PhieuNhapKho PRIMARY KEY (maPhieuNhap),
    CONSTRAINT CK_PNK_TrangThai CHECK (trangThai IN ('ChoXacNhan','ChoXuLy','DaXacNhan')),
    CONSTRAINT FK_PNK_DDH       FOREIGN KEY (maDonHang)    REFERENCES DonDatHang(maDonHang),
    CONSTRAINT FK_PNK_NguoiLap  FOREIGN KEY (maNguoiLap)   REFERENCES TaiKhoan(maTaiKhoan),
    CONSTRAINT FK_PNK_NguoiDuyet FOREIGN KEY (maNguoiDuyet) REFERENCES TaiKhoan(maTaiKhoan)
);

-- Đối chiếu hóa đơn (UC 3.2): SL trên hóa đơn × tỷ lệ quy đổi so với SL thực nhận
CREATE TABLE ChiTietPhieuNhap (
    maPhieuNhap      VARCHAR(30)    NOT NULL,
    maNguyenLieu     VARCHAR(20)    NOT NULL,
    soLuongThucNhan  INT            NOT NULL,
    soLuongHoaDon    INT            NULL,
    donViTinhHoaDon  NVARCHAR(30)   NULL,
    tyLeQuyDoi       DECIMAL(10,2)  NOT NULL DEFAULT 1.00,
    CONSTRAINT PK_ChiTietPhieuNhap PRIMARY KEY (maPhieuNhap, maNguyenLieu),
    CONSTRAINT CK_CTPN_SL CHECK (soLuongThucNhan >= 0),
    CONSTRAINT CK_CTPN_TyLe CHECK (tyLeQuyDoi > 0),
    CONSTRAINT FK_CTPN_PNK FOREIGN KEY (maPhieuNhap)  REFERENCES PhieuNhapKho(maPhieuNhap),
    CONSTRAINT FK_CTPN_NL  FOREIGN KEY (maNguyenLieu) REFERENCES NguyenLieu(maNguyenLieu)
);

-- Lô hàng và hạn sử dụng (UC 3.3); (maPhieuNhap, maNguyenLieu) trỏ về một dòng phiếu nhập
CREATE TABLE LoHang (
    maLo          VARCHAR(30)  NOT NULL,
    soLo          VARCHAR(50)  NOT NULL,
    ngaySanXuat   DATE         NOT NULL,
    hanSuDung     DATE         NOT NULL,
    soLuongNhap   INT          NOT NULL,
    soLuongCon    INT          NOT NULL,
    maPhieuNhap   VARCHAR(30)  NOT NULL,
    maNguyenLieu  VARCHAR(20)  NOT NULL,
    CONSTRAINT PK_LoHang PRIMARY KEY (maLo),
    CONSTRAINT CK_LoHang_Ngay CHECK (hanSuDung > ngaySanXuat),
    CONSTRAINT CK_LoHang_SL CHECK (soLuongNhap > 0 AND soLuongCon BETWEEN 0 AND soLuongNhap),
    CONSTRAINT FK_LoHang_CTPN FOREIGN KEY (maPhieuNhap, maNguyenLieu)
        REFERENCES ChiTietPhieuNhap(maPhieuNhap, maNguyenLieu)
);

-- Ghi nhận sai lệch hàng nhập (UC 3.4)
CREATE TABLE SaiLechHangNhap (
    maSaiLech       VARCHAR(30)  NOT NULL,
    soLuongSaiLech  INT          NOT NULL,
    lyDo            VARCHAR(50)  NOT NULL,
    ngayGhiNhan     DATETIME     NOT NULL DEFAULT GETDATE(),
    maPhieuNhap     VARCHAR(30)  NOT NULL,
    maNguyenLieu    VARCHAR(20)  NOT NULL,
    CONSTRAINT PK_SaiLechHangNhap PRIMARY KEY (maSaiLech),
    CONSTRAINT CK_SLHN_SL CHECK (soLuongSaiLech > 0),
    CONSTRAINT CK_SLHN_LyDo CHECK (lyDo IN ('GiaoThieu','GiaoSaiMatHang','HuHong','CanHanHetHan')),
    CONSTRAINT FK_SLHN_CTPN FOREIGN KEY (maPhieuNhap, maNguyenLieu)
        REFERENCES ChiTietPhieuNhap(maPhieuNhap, maNguyenLieu)
);

-- Ảnh minh chứng (UC 3.5) – một sai lệch có thể có nhiều ảnh (tách bảng theo 1NF)
CREATE TABLE AnhMinhChung (
    maAnh      VARCHAR(30)   NOT NULL,
    duongDan   VARCHAR(255)  NOT NULL,
    maSaiLech  VARCHAR(30)   NOT NULL,
    CONSTRAINT PK_AnhMinhChung PRIMARY KEY (maAnh),
    CONSTRAINT FK_AMC_SaiLech FOREIGN KEY (maSaiLech) REFERENCES SaiLechHangNhap(maSaiLech)
);

/* =====================================================================
   5. XUẤT KHO  (UC 4.1, 4.2)
   ===================================================================== */

CREATE TABLE PhieuXuatKho (
    maPhieuXuat   VARCHAR(30)    NOT NULL,
    ngayXuat      DATETIME       NOT NULL DEFAULT GETDATE(),
    lyDoXuat      NVARCHAR(100)  NOT NULL,       -- Ca bán hàng / Xuất hủy (hết hạn, hư hỏng) / Dùng nội bộ, mẫu thử
    trangThai     VARCHAR(30)    NOT NULL DEFAULT 'ChoXacNhan', -- UC 6.2: Chờ xác nhận / Đã xác nhận; UC 4.2: Chờ bổ sung hàng
    ngayDuyet     DATETIME       NULL,          -- thời điểm quản lý xác nhận (UC 6.2)
    ghiChu        NVARCHAR(255)  NULL,
    maNguoiLap    VARCHAR(20)    NOT NULL,
    maNguoiDuyet  VARCHAR(20)    NULL,
    CONSTRAINT PK_PhieuXuatKho PRIMARY KEY (maPhieuXuat),
    CONSTRAINT CK_PXK_TrangThai CHECK (trangThai IN ('ChoXacNhan','DaXacNhan','ChoBoSungHang')),
    CONSTRAINT FK_PXK_NguoiLap   FOREIGN KEY (maNguoiLap)   REFERENCES TaiKhoan(maTaiKhoan),
    CONSTRAINT FK_PXK_NguoiDuyet FOREIGN KEY (maNguoiDuyet) REFERENCES TaiKhoan(maTaiKhoan)
);

-- Thiếu hàng xử lý theo từng nguyên liệu (UC 4.2): trangThai = Đủ / Thiếu – lấy phần còn lại / Chờ bổ sung
CREATE TABLE ChiTietPhieuXuat (
    maPhieuXuat      VARCHAR(30)  NOT NULL,
    maNguyenLieu     VARCHAR(20)  NOT NULL,
    soLuongYeuCau    INT          NOT NULL,
    soLuongThucXuat  INT          NOT NULL DEFAULT 0,
    trangThai        VARCHAR(30)  NOT NULL DEFAULT 'Du',
    CONSTRAINT PK_ChiTietPhieuXuat PRIMARY KEY (maPhieuXuat, maNguyenLieu),
    CONSTRAINT CK_CTPX_SL CHECK (soLuongYeuCau > 0 AND soLuongThucXuat BETWEEN 0 AND soLuongYeuCau),
    CONSTRAINT CK_CTPX_TrangThai CHECK (trangThai IN ('Du','LayPhanConLai','ChoBoSung')),
    CONSTRAINT FK_CTPX_PXK FOREIGN KEY (maPhieuXuat)  REFERENCES PhieuXuatKho(maPhieuXuat),
    CONSTRAINT FK_CTPX_NL  FOREIGN KEY (maNguyenLieu) REFERENCES NguyenLieu(maNguyenLieu)
);

/* =====================================================================
   6. CẢNH BÁO VÀ NHẬT KÝ
   ===================================================================== */

CREATE TABLE CanhBaoTonKho (
    maCanhBao        VARCHAR(30)    NOT NULL,
    thoiGianCanhBao  DATETIME       NOT NULL DEFAULT GETDATE(),
    soLuongHienTai   INT            NOT NULL,
    noiDung          NVARCHAR(255)  NOT NULL,
    trangThai        VARCHAR(20)    NOT NULL DEFAULT 'ChoQuanLyXem',
    maNguyenLieu     VARCHAR(20)    NOT NULL,
    CONSTRAINT PK_CanhBaoTonKho PRIMARY KEY (maCanhBao),
    CONSTRAINT CK_CBTK_TrangThai CHECK (trangThai IN ('ChoQuanLyXem','DaXem')),
    CONSTRAINT FK_CBTK_NL FOREIGN KEY (maNguyenLieu) REFERENCES NguyenLieu(maNguyenLieu)
);

CREATE TABLE NhatKyHeThong (
    maNhatKy        VARCHAR(30)    NOT NULL,
    thoiGian        DATETIME       NOT NULL DEFAULT GETDATE(),
    hanhDong        VARCHAR(50)    NOT NULL,
    bangDuLieu      VARCHAR(50)    NOT NULL,
    banGhiId        VARCHAR(50)    NOT NULL,
    noiDungChiTiet  NVARCHAR(500)  NOT NULL,
    maTaiKhoan      VARCHAR(20)    NOT NULL,
    CONSTRAINT PK_NhatKyHeThong PRIMARY KEY (maNhatKy),
    CONSTRAINT CK_NKHT_HanhDong CHECK (hanhDong IN ('Them','Sua','Xoa','XacNhan','DangNhap','DangXuat')),
    CONSTRAINT FK_NKHT_TaiKhoan FOREIGN KEY (maTaiKhoan) REFERENCES TaiKhoan(maTaiKhoan)
);
GO

/* =====================================================================
   7. DỮ LIỆU MẪU – lấy đúng dữ liệu đang hiển thị trên các màn hình Figma
   ===================================================================== */

-- UC 10.1 / 10.2: danh sách tài khoản
INSERT INTO PhanQuyen VALUES
('QuanLy',   N'Quản lý',   N'Toàn quyền: hàng hóa, nhà cung cấp, đơn đặt hàng, báo cáo, tài khoản'),
('NhanVien', N'Nhân viên', N'Chỉ dùng chức năng Nhập kho, Xuất kho, Tồn kho');

INSERT INTO TaiKhoan (maTaiKhoan, hoTen, soDienThoai, matKhau, ngayTao) VALUES
('TK001', N'Bá Minh',      '0905100001', '$2b$10$hashQuanLy',   '2026-10-01'),
('TK002', N'Nguyễn Văn A', '0905100002', '$2b$10$hashNhanVienA', '2026-10-01'),
('TK003', N'Trần Thị B',   '0905100003', '$2b$10$hashNhanVienB', '2026-10-15'),
('TK004', N'Lê Văn C',     '0905100004', '$2b$10$hashNhanVienC', '2026-11-03');

INSERT INTO TaiKhoan_PhanQuyen VALUES
('TK001','QuanLy'), ('TK002','NhanVien'), ('TK003','NhanVien'),
('TK004','NhanVien');   -- được gán ở UC 10.2 (trước đó là "Chưa phân quyền")

-- UC 2.2: bộ lọc danh mục và kho
INSERT INTO DanhMuc VALUES
('DM01', N'Sữa',         NULL),
('DM02', N'Mứt & Syrup', NULL),
('DM03', N'Đường',       NULL),
('DM04', N'Bột',         NULL),
('DM05', N'Topping',     NULL);

INSERT INTO Kho VALUES ('K01', N'Kho lạnh'), ('K02', N'Kho khô');

-- UC 2.1 + UC 8: danh sách nguyên liệu (mã NL-xxx)
INSERT INTO NguyenLieu (maNguyenLieu, tenNguyenLieu, donViTinh, moTa, soLuongTon, maDanhMuc, maKho) VALUES
('NL-001', N'Sữa tươi không đường', N'hộp',  N'Sữa tươi dùng pha chế đồ uống',          120, 'DM01', 'K01'),
('NL-002', N'Mứt dâu tây',          N'kg',   N'Mứt dùng pha chế trà trái cây',           80, 'DM02', 'K01'),
('NL-003', N'Đường cát trắng',      N'kg',   N'Đường dùng pha chế và nấu syrup',        150, 'DM03', 'K02'),
('NL-004', N'Bột mì số 8',          N'kg',   N'Bột dùng làm bánh',                      120, 'DM04', 'K02'),
('NL-005', N'Syrup đào',            N'chai', N'Siro đào dùng pha chế trà trái cây',      24, 'DM02', 'K02'),
('NL-006', N'Sữa đặc có đường',     N'hộp',  N'Sữa đặc dùng pha chế cà phê, trà sữa',    36, 'DM01', 'K02'),
('NL-007', N'Sữa tươi có đường',    N'hộp',  N'Sữa tươi có đường dùng pha chế',          45, 'DM01', 'K01'),
('NL-008', N'Bột mì đa dụng',       N'kg',   N'Bột mì dùng làm bánh',                    45, 'DM04', 'K02'),
('NL-009', N'Bột cacao',            N'kg',   N'Bột cacao pha chế',                        3, 'DM04', 'K02'),
('NL-010', N'Trân châu đen',        N'gói',  N'Topping trà sữa',                          6, 'DM05', 'K02');

-- UC 7.2 – 7.4: nhà cung cấp
INSERT INTO NhaCungCap (maNCC, tenNCC, soDienThoai, diaChi) VALUES
('NCC001', N'Nhân Em',   '0905111222', N'Hải Châu, Đà Nẵng'),
('NCC002', N'Nhật Minh', '0905333444', N'Thanh Khê, Đà Nẵng'),
('NCC003', N'Minh Phát', '0935555666', N'Liên Chiểu, Đà Nẵng');

-- UC 7.1: đơn đặt hàng
INSERT INTO DonDatHang (maDonHang, ngayDat, trangThai, maNCC, maNguoiLap) VALUES
('DH-0012', '2026-10-24', 'DaHoanTat', 'NCC001', 'TK001'),
('DH-0013', '2026-10-28', 'DaHoanTat', 'NCC001', 'TK001'),
('DH-0014', '2026-11-03', 'DaDatHang', 'NCC002', 'TK001'),
('DH-0015', '2026-11-06', 'ChoDatHang','NCC001', 'TK001');

INSERT INTO ChiTietDonDatHang VALUES
('DH-0012','NL-001', 2, N'Đặt theo thùng (1 thùng = 24 hộp)'),
('DH-0012','NL-009', 5, NULL),
('DH-0012','NL-010', 6, NULL),
('DH-0013','NL-002', 4, NULL),
('DH-0014','NL-003', 2, NULL),
('DH-0015','NL-006', 3, NULL),
('DH-0015','NL-002', 4, NULL),
('DH-0015','NL-009', 2, NULL);

-- UC 3.1 – 3.5: phiếu nhập PN-0031 từ đơn DH-0012
INSERT INTO PhieuNhapKho (maPhieuNhap, ngayNhap, hinhAnhHoaDon, trangThai, ngayDuyet, maDonHang, maNguoiLap, maNguoiDuyet) VALUES
('PN-0029', '2026-10-27', NULL,                     'DaXacNhan', '2026-10-27 16:00', 'DH-0013', 'TK002', 'TK001'),
('PN-0030', '2026-10-29', NULL,                     'ChoXacNhan', NULL,              'DH-0014', 'TK002', NULL),
('PN-0031', '2026-11-03', '/uploads/hd/HD-0458.jpg','ChoXuLy',    NULL,              'DH-0012', 'TK002', NULL);

INSERT INTO ChiTietPhieuNhap VALUES
('PN-0029','NL-002', 4, 4, N'kg',   1.00),
('PN-0030','NL-003', 2, 2, N'kg',   1.00),
('PN-0031','NL-001',48, 2, N'thùng',24.00),   -- 2 thùng × 24 = 48 hộp
('PN-0031','NL-009', 4, 5, N'kg',   1.00),    -- thiếu 1 kg
('PN-0031','NL-010', 6, 6, N'gói',  1.00);

INSERT INTO LoHang VALUES
('LO-0001','L2311','2026-10-15','2027-01-15',48,48,'PN-0031','NL-001'),
('LO-0002','L2312','2026-09-20','2027-03-20', 4, 3,'PN-0031','NL-009'),
('LO-0003','L2313','2026-10-01','2027-04-01', 6, 6,'PN-0031','NL-010'),
('LO-0004','L2290','2026-09-01','2027-09-01', 4, 4,'PN-0029','NL-002');

INSERT INTO SaiLechHangNhap (maSaiLech, soLuongSaiLech, lyDo, ngayGhiNhan, maPhieuNhap, maNguyenLieu) VALUES
('SL-0001', 1, 'GiaoThieu', '2026-11-03', 'PN-0031', 'NL-009');

INSERT INTO AnhMinhChung VALUES
('ANH-0001','/uploads/sailech/IMG_0421.jpg','SL-0001');

-- UC 4.1 – 4.2: phiếu xuất kho
INSERT INTO PhieuXuatKho (maPhieuXuat, ngayXuat, lyDoXuat, trangThai, ngayDuyet, maNguoiLap, maNguoiDuyet) VALUES
('PX-0006','2026-10-29', N'Ca bán hàng',                 'DaXacNhan', '2026-10-29 18:00', 'TK004', 'TK001'),
('PX-0007','2026-10-30', N'Dùng nội bộ / mẫu thử',       'DaXacNhan', '2026-10-30 18:00', 'TK002', 'TK001'),
('PX-0008','2026-10-31', N'Xuất hủy (hết hạn / hư hỏng)','DaXacNhan', '2026-10-31 18:00', 'TK003', 'TK001'),
('PX-0009','2026-11-01', N'Ca bán hàng',                 'DaXacNhan', '2026-11-01 18:00', 'TK002', 'TK001'),
('PX-0010','2026-11-02', N'Ca bán hàng',                 'ChoXacNhan', NULL,              'TK002', NULL);

INSERT INTO ChiTietPhieuXuat VALUES
('PX-0010','NL-001', 50, 30, 'LayPhanConLai'),   -- UC 4.2: thiếu 20 hộp, chọn lấy số lượng còn lại
('PX-0010','NL-002', 30, 30, 'Du'),
('PX-0009','NL-003',  2,  2, 'Du'),
('PX-0008','NL-005',  1,  1, 'Du'),
('PX-0006','NL-001', 10, 10, 'Du'),
('PX-0007','NL-007',  2,  2, 'Du');

-- Cảnh báo tồn kho dưới mức tối thiểu (mặc định 3)
INSERT INTO CanhBaoTonKho (maCanhBao, thoiGianCanhBao, soLuongHienTai, noiDung, maNguyenLieu) VALUES
('CB-0001','2026-11-05 08:00', 3, N'Cảnh báo có nguyên liệu sắp hết: Bột cacao', 'NL-009');

INSERT INTO NhatKyHeThong VALUES
('NK-0001','2026-11-03 09:15','XacNhan','PhieuNhapKho','PN-0031',N'Xác nhận số lượng thực nhận phiếu PN-0031','TK002'),
('NK-0002','2026-11-03 09:20','Them','SaiLechHangNhap','SL-0001',N'Ghi nhận thiếu 1 kg Bột cacao','TK002'),
('NK-0003','2026-11-03 10:05','Sua','TaiKhoan_PhanQuyen','TK004',N'Gán quyền Nhân viên cho Lê Văn C','TK001');
GO

/* =====================================================================
   8. VIEW HỖ TRỢ MÀN HÌNH
   ===================================================================== */

-- UC 2.1 / 2.2: tra cứu nguyên liệu theo danh mục và kho
CREATE VIEW vw_TraCuuNguyenLieu AS
SELECT nl.maNguyenLieu, nl.tenNguyenLieu, dm.tenDanhMuc, k.tenKho,
       nl.soLuongTon, nl.donViTinh
FROM NguyenLieu nl
JOIN DanhMuc dm ON dm.maDanhMuc = nl.maDanhMuc
JOIN Kho k      ON k.maKho      = nl.maKho
WHERE nl.trangThai = 'DangSuDung';
GO

-- UC 7.1: gợi ý số lượng đặt = mức tối đa − tồn hiện tại cho nguyên liệu dưới mức tối thiểu
CREATE VIEW vw_DeXuatDatHang AS
SELECT maNguyenLieu, tenNguyenLieu, donViTinh, soLuongTon,
       mucToiDa - soLuongTon AS soLuongDeXuat
FROM NguyenLieu
WHERE soLuongTon < mucToiThieu AND trangThai = 'DangSuDung';
GO

-- UC 10.1: danh sách tài khoản kèm quyền ("Chưa phân quyền" khi chưa gán)
CREATE VIEW vw_DanhSachTaiKhoan AS
SELECT tk.maTaiKhoan, tk.hoTen, tk.soDienThoai, tk.ngayTao,
       ISNULL(pq.tenPhanQuyen, N'Chưa phân quyền') AS quyen
FROM TaiKhoan tk
LEFT JOIN TaiKhoan_PhanQuyen tp ON tp.maTaiKhoan = tk.maTaiKhoan
LEFT JOIN PhanQuyen pq          ON pq.maPhanQuyen = tp.maPhanQuyen;
GO

/* =====================================================================
   9. BỔ SUNG CHO UC 5, UC 6, UC 9 (theo Figma và đặc tả use case)
   ===================================================================== */

-- UC 5.1: lịch sử nhập kho – chỉ gồm phiếu đã được quản lý xác nhận (BR08 – UC 6.1)
CREATE VIEW vw_LichSuNhapKho AS
SELECT pn.maPhieuNhap AS maPhieu, pn.ngayNhap, nl.tenNguyenLieu,
       ct.soLuongThucNhan AS soLuong, nl.donViTinh
FROM PhieuNhapKho pn
JOIN ChiTietPhieuNhap ct ON ct.maPhieuNhap = pn.maPhieuNhap
JOIN NguyenLieu nl       ON nl.maNguyenLieu = ct.maNguyenLieu
WHERE pn.trangThai = 'DaXacNhan';
GO

-- UC 5.2: lịch sử xuất kho – chỉ gồm phiếu xuất đã được quản lý xác nhận (BR04)
CREATE VIEW vw_LichSuXuatKho AS
SELECT px.maPhieuXuat AS maPhieu, px.ngayXuat, nl.tenNguyenLieu,
       ct.soLuongThucXuat AS soLuong, nl.donViTinh
FROM PhieuXuatKho px
JOIN ChiTietPhieuXuat ct ON ct.maPhieuXuat = px.maPhieuXuat
JOIN NguyenLieu nl       ON nl.maNguyenLieu = ct.maNguyenLieu
WHERE px.trangThai = 'DaXacNhan';
GO

-- UC 6.1: danh sách phiếu nhập chờ kiểm tra (Chờ xác nhận / Chờ xử lý)
CREATE VIEW vw_PhieuNhapChoKiemTra AS
SELECT pn.maPhieuNhap, pn.ngayNhap AS ngayLap, tk.hoTen AS nguoiLap, pn.trangThai,
       pn.hinhAnhHoaDon,
       (SELECT COUNT(*) FROM SaiLechHangNhap s WHERE s.maPhieuNhap = pn.maPhieuNhap) AS soSaiLech
FROM PhieuNhapKho pn
JOIN TaiKhoan tk ON tk.maTaiKhoan = pn.maNguoiLap
WHERE pn.trangThai IN ('ChoXacNhan','ChoXuLy');
GO

-- UC 6.2: danh sách phiếu xuất chờ kiểm tra
CREATE VIEW vw_PhieuXuatChoKiemTra AS
SELECT px.maPhieuXuat, px.ngayXuat AS ngayLap, tk.hoTen AS nguoiLap, px.lyDoXuat, px.trangThai
FROM PhieuXuatKho px
JOIN TaiKhoan tk ON tk.maTaiKhoan = px.maNguoiLap
WHERE px.trangThai = 'ChoXacNhan';
GO

-- UC 6.3: theo dõi tồn kho – đánh dấu nguyên liệu dưới mức tối thiểu (BR04)
CREATE VIEW vw_TheoDoiTonKho AS
SELECT nl.maNguyenLieu, nl.tenNguyenLieu, dm.tenDanhMuc, nl.soLuongTon, nl.mucToiThieu,
       CASE WHEN nl.soLuongTon < nl.mucToiThieu THEN 1 ELSE 0 END AS duoiMucToiThieu
FROM NguyenLieu nl
JOIN DanhMuc dm ON dm.maDanhMuc = nl.maDanhMuc
WHERE nl.trangThai = 'DangSuDung';
GO

-- UC 6.1 / 6.2: quản lý xác nhận phiếu, ghi nhật ký (phục vụ UC 9.4)
CREATE PROCEDURE sp_XacNhanPhieuNhap @maPhieuNhap VARCHAR(30), @maQuanLy VARCHAR(20)
AS
BEGIN
    SET NOCOUNT ON;
    UPDATE PhieuNhapKho SET trangThai = 'DaXacNhan', ngayDuyet = GETDATE(), maNguoiDuyet = @maQuanLy
    WHERE maPhieuNhap = @maPhieuNhap AND trangThai IN ('ChoXacNhan','ChoXuLy');
    IF @@ROWCOUNT = 0 BEGIN RAISERROR(N'Có lỗi xảy ra', 16, 1); RETURN; END
    INSERT INTO NhatKyHeThong VALUES ('NK-' + FORMAT(GETDATE(),'yyMMddHHmmssfff'), GETDATE(), 'XacNhan',
        'PhieuNhapKho', @maPhieuNhap, N'Quản lý xác nhận phiếu nhập ' + @maPhieuNhap, @maQuanLy);
END
GO

CREATE PROCEDURE sp_XacNhanPhieuXuat @maPhieuXuat VARCHAR(30), @maQuanLy VARCHAR(20)
AS
BEGIN
    SET NOCOUNT ON;
    UPDATE PhieuXuatKho SET trangThai = 'DaXacNhan', ngayDuyet = GETDATE(), maNguoiDuyet = @maQuanLy
    WHERE maPhieuXuat = @maPhieuXuat AND trangThai = 'ChoXacNhan';
    IF @@ROWCOUNT = 0 BEGIN RAISERROR(N'Có lỗi xảy ra', 16, 1); RETURN; END
    INSERT INTO NhatKyHeThong VALUES ('NK-' + FORMAT(GETDATE(),'yyMMddHHmmssfff'), GETDATE(), 'XacNhan',
        'PhieuXuatKho', @maPhieuXuat, N'Quản lý xác nhận phiếu xuất ' + @maPhieuXuat, @maQuanLy);
END
GO

-- UC 6.4: cảnh báo tự động khi tồn kho xuống dưới mức tối thiểu (BR03, mặc định 3)
CREATE TRIGGER trg_CanhBaoTonKho ON NguyenLieu
AFTER UPDATE
AS
BEGIN
    SET NOCOUNT ON;
    INSERT INTO CanhBaoTonKho (maCanhBao, thoiGianCanhBao, soLuongHienTai, noiDung, trangThai, maNguyenLieu)
    SELECT 'CB-' + i.maNguyenLieu + '-' + FORMAT(GETDATE(),'yyMMddHHmmss'), GETDATE(), i.soLuongTon,
           N'Cảnh báo có nguyên liệu sắp hết: ' + i.tenNguyenLieu, 'ChoQuanLyXem', i.maNguyenLieu
    FROM inserted i
    JOIN deleted d ON d.maNguyenLieu = i.maNguyenLieu
    WHERE i.soLuongTon < i.mucToiThieu AND d.soLuongTon >= d.mucToiThieu;
END
GO

-- UC 9.1: báo cáo nhập kho theo kỳ (Nguyên vật liệu, Số lượng nhập, Ngày nhập)
CREATE PROCEDURE sp_BaoCaoNhapKho @tuNgay DATE, @denNgay DATE
AS
BEGIN
    SET NOCOUNT ON;
    IF @tuNgay > @denNgay BEGIN RAISERROR(N'Khoảng thời gian không hợp lệ!', 16, 1); RETURN; END
    SELECT tenNguyenLieu, soLuong AS soLuongNhap, donViTinh, CAST(ngayNhap AS DATE) AS ngayNhap
    FROM vw_LichSuNhapKho
    WHERE CAST(ngayNhap AS DATE) BETWEEN @tuNgay AND @denNgay
    ORDER BY ngayNhap;
END
GO

-- UC 9.2: báo cáo xuất kho theo kỳ (Nguyên vật liệu, Số lượng xuất, Ngày xuất)
CREATE PROCEDURE sp_BaoCaoXuatKho @tuNgay DATE, @denNgay DATE
AS
BEGIN
    SET NOCOUNT ON;
    IF @tuNgay > @denNgay BEGIN RAISERROR(N'Khoảng thời gian không hợp lệ!', 16, 1); RETURN; END
    SELECT tenNguyenLieu, soLuong AS soLuongXuat, donViTinh, CAST(ngayXuat AS DATE) AS ngayXuat
    FROM vw_LichSuXuatKho
    WHERE CAST(ngayXuat AS DATE) BETWEEN @tuNgay AND @denNgay
    ORDER BY ngayXuat;
END
GO

-- UC 9.3: báo cáo hàng tồn kho (Tồn đầu kỳ, Số lượng nhập, Số lượng xuất, Tồn cuối kỳ)
-- Tồn cuối kỳ = tồn hiện tại − nhập sau kỳ + xuất sau kỳ; tồn đầu kỳ = tồn cuối kỳ − nhập trong kỳ + xuất trong kỳ
CREATE PROCEDURE sp_BaoCaoTonKho @tuNgay DATE, @denNgay DATE
AS
BEGIN
    SET NOCOUNT ON;
    IF @tuNgay > @denNgay BEGIN RAISERROR(N'Khoảng thời gian không hợp lệ!', 16, 1); RETURN; END
    ;WITH N AS (
        SELECT ct.maNguyenLieu,
               SUM(CASE WHEN CAST(pn.ngayNhap AS DATE) BETWEEN @tuNgay AND @denNgay THEN ct.soLuongThucNhan ELSE 0 END) AS nhapTrongKy,
               SUM(CASE WHEN CAST(pn.ngayNhap AS DATE) > @denNgay THEN ct.soLuongThucNhan ELSE 0 END) AS nhapSauKy
        FROM ChiTietPhieuNhap ct JOIN PhieuNhapKho pn ON pn.maPhieuNhap = ct.maPhieuNhap
        WHERE pn.trangThai = 'DaXacNhan' GROUP BY ct.maNguyenLieu),
    X AS (
        SELECT ct.maNguyenLieu,
               SUM(CASE WHEN CAST(px.ngayXuat AS DATE) BETWEEN @tuNgay AND @denNgay THEN ct.soLuongThucXuat ELSE 0 END) AS xuatTrongKy,
               SUM(CASE WHEN CAST(px.ngayXuat AS DATE) > @denNgay THEN ct.soLuongThucXuat ELSE 0 END) AS xuatSauKy
        FROM ChiTietPhieuXuat ct JOIN PhieuXuatKho px ON px.maPhieuXuat = ct.maPhieuXuat
        WHERE px.trangThai = 'DaXacNhan' GROUP BY ct.maNguyenLieu)
    SELECT nl.tenNguyenLieu,
           nl.soLuongTon - ISNULL(N.nhapSauKy,0) + ISNULL(X.xuatSauKy,0)
             - ISNULL(N.nhapTrongKy,0) + ISNULL(X.xuatTrongKy,0)              AS tonDauKy,
           ISNULL(N.nhapTrongKy,0)                                            AS soLuongNhap,
           ISNULL(X.xuatTrongKy,0)                                            AS soLuongXuat,
           nl.soLuongTon - ISNULL(N.nhapSauKy,0) + ISNULL(X.xuatSauKy,0)      AS tonCuoiKy,
           nl.donViTinh
    FROM NguyenLieu nl
    LEFT JOIN N ON N.maNguyenLieu = nl.maNguyenLieu
    LEFT JOIN X ON X.maNguyenLieu = nl.maNguyenLieu
    WHERE nl.trangThai = 'DangSuDung'
    ORDER BY nl.tenNguyenLieu;
END
GO

-- UC 9.4: lịch sử chỉnh sửa (Người thực hiện, Thời gian, Nội dung chỉnh sửa)
-- Không chọn thời gian (để NULL) thì hiển thị toàn bộ lịch sử gần đây nhất (4a)
CREATE PROCEDURE sp_LichSuChinhSua @tuNgay DATE = NULL, @denNgay DATE = NULL
AS
BEGIN
    SET NOCOUNT ON;
    IF @tuNgay IS NOT NULL AND @denNgay IS NOT NULL AND @tuNgay > @denNgay
    BEGIN RAISERROR(N'Khoảng thời gian không hợp lệ!', 16, 1); RETURN; END
    SELECT tk.hoTen AS nguoiThucHien, nk.thoiGian, nk.noiDungChiTiet AS noiDungChinhSua,
           nk.hanhDong, nk.bangDuLieu, nk.banGhiId
    FROM NhatKyHeThong nk
    JOIN TaiKhoan tk ON tk.maTaiKhoan = nk.maTaiKhoan
    WHERE (@tuNgay IS NULL OR CAST(nk.thoiGian AS DATE) >= @tuNgay)
      AND (@denNgay IS NULL OR CAST(nk.thoiGian AS DATE) <= @denNgay)
    ORDER BY nk.thoiGian DESC;
END
GO

/* Ví dụ chạy thử:
   SELECT * FROM vw_PhieuNhapChoKiemTra;
   EXEC sp_XacNhanPhieuNhap 'PN-0031', 'TK001';
   EXEC sp_BaoCaoTonKho '2026-10-01', '2026-10-31';
   EXEC sp_LichSuChinhSua;
*/
