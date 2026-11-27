# Câu lệnh mẫu để giao việc cho Codex

Dán từng câu lệnh vào Codex, mỗi lần một task. Review và merge PR xong mới giao task tiếp theo.

## Giao một task

```
Đọc AGENTS.md, sau đó làm task T00 trong docs/TASKS.md.
Tra cứu docs/PRD-EDU-001_v1.1.md theo các mã được nhắc trong task.
Chỉ làm đúng phạm vi T00. Chạy lint, typecheck, test trước khi kết thúc.
Trong mô tả PR liệt kê: các mã FR/AC đã đáp ứng, giả định đã đặt, cách kiểm tra thủ công.
Cập nhật trạng thái T00 trong docs/TASKS.md thành ☑.
```

Đổi `T00` thành mã task tiếp theo (T01, T02…).

## Khi PR chưa đạt

```
Review PR của task T03: test cách ly tenant chưa bao phủ bảng UserRole và AuditLog.
Bổ sung test và sửa policy RLS nếu cần. Không thay đổi phạm vi khác.
```

## Hỏi trước khi làm task lớn

```
Đọc AGENTS.md và task T03. Chưa viết code.
Trình bày kế hoạch: danh sách file sẽ tạo/sửa, lược đồ bảng, cách đặt tenant cho mỗi request, cách test.
```

## Rà soát định kỳ (sau mỗi 3–4 task)

```
Rà soát toàn bộ repo theo AGENTS.md mục 4 (đa doanh nghiệp, phân quyền, bảo mật).
Liệt kê vi phạm kèm file và dòng, xếp theo mức nghiêm trọng. Chưa sửa.
```
