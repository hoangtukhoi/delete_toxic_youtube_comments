# NỘI DUNG SLIDE THUYẾT TRÌNH DỰ ÁN (20 Trang)
**Chủ đề:** Hệ thống tự động kiểm duyệt bình luận độc hại trên YouTube (AI YouTube Moderator)

---

## Slide 1: Tiêu đề
- **Tên dự án:** AI YouTube Moderator - Hệ thống tự động phát hiện và kiểm duyệt bình luận độc hại
- **Phân môn / Khóa học:** Xử lý ngôn ngữ tự nhiên (NLP)
- **Thành viên thực hiện:** [Tên của bạn]
- **Giảng viên hướng dẫn:** [Tên GV]
- **Tóm tắt ngắn:** Giải pháp Full-stack ứng dụng AI (PhoBERT) kết hợp YouTube Data API.

## Slide 2: Đặt vấn đề (Problem Statement)
- **Bối cảnh:** Mạng xã hội YouTube phát triển mạnh, kéo theo lượng lớn bình luận hàng ngày.
- **Vấn đề:** Sự gia tăng của các bình luận mang tính xúc phạm, thù ghét, độc hại (Cyberbullying).
- **Hạn chế hiện tại:** Việc kiểm duyệt thủ công bởi chủ kênh tốn quá nhiều thời gian, dễ sai sót, ảnh hưởng tâm lý người quản trị.
- **Nhu cầu:** Cần một công cụ phân tích tự động, có khả năng "đọc hiểu" tiếng Việt tốt để hỗ trợ chủ kênh.

## Slide 3: Mục tiêu dự án (Project Objectives)
- **Xây dựng AI Core:** Ứng dụng mô hình NLP chuyên biệt cho tiếng Việt để phân loại cảm xúc/độc hại.
- **Tự động hóa:** Tích hợp với YouTube API để quét và xử lý bình luận tự động.
- **Quản lý tập trung:** Xây dựng Dashboard UI trực quan giúp admin dễ dàng ra quyết định.
- **Báo cáo phân tích:** Cung cấp các biểu đồ thống kê để theo dõi xu hướng cộng đồng.

## Slide 4: Phạm vi và Đối tượng sử dụng
- **Phạm vi kỹ thuật:** Quét bình luận trên từng Video cụ thể hoặc quét hàng loạt Video mới nhất của một Channel YouTube.
- **Ngôn ngữ mục tiêu:** Tiếng Việt (bao gồm cả các biến thể text thông thường).
- **Đối tượng sử dụng:** 
  - Creators (Nhà sáng tạo nội dung YouTube).
  - Quản trị viên cộng đồng (Community Managers).

## Slide 5: Kiến trúc hệ thống tổng quan (Architecture)
*(Slide này nên vẽ/chèn một sơ đồ)*
- **Frontend (Giao diện):** HTML/CSS/Vanilla JS (Hiển thị dữ liệu, biểu đồ Chart.js).
- **Backend API:** FastAPI (Xử lý Request, Background Tasks).
- **AI Engine:** HuggingFace Transformers (PhoBERT) + PyVi (ViTokenizer).
- **Database:** SQLite (Lưu trữ bình luận, lịch sử quét) qua SQLAlchemy.
- **3rd Party Integration:** YouTube Data API v3 (OAuth2 Flow).

## Slide 6: Stack Công nghệ chi tiết
- **Ngôn ngữ:** Python 3, JavaScript, HTML5, CSS3.
- **Framework & Thư viện:**
  - `FastAPI`: Hiệu năng cao, xử lý bất đồng bộ.
  - `Transformers` & `Torch`: Tải và chạy mô hình Deep Learning.
  - `Google-api-python-client`: Tương tác với YouTube.
  - `Chart.js`: Trực quan hóa dữ liệu.

## Slide 7: Lõi Trí Tuệ Nhân Tạo - PhoBERT
- **Mô hình sử dụng:** `vinai/phobert-base-v2` (Pre-trained) fine-tuned cho tác vụ Sentiment Analysis (phân loại Toxic).
- **Tại sao lại là PhoBERT?** 
  - Là mô hình ngôn ngữ SOTA (State-of-the-Art) cho tiếng Việt dựa trên kiến trúc RoBERTa.
  - Hiểu được ngữ cảnh, ngữ pháp thay vì chỉ khớp từ khóa (keyword matching).

## Slide 8: Tiền xử lý dữ liệu (Data Preprocessing)
- **Word Segmentation (Tách từ):** Tiếng Việt có các từ ghép (ví dụ: "học sinh" gồm 2 âm tiết).
- **Công cụ:** Sử dụng thư viện `PyVi` (ViTokenizer).
- **Cách hoạt động:** Chuyển đổi chuỗi đầu vào: `Tôi là sinh viên` $\rightarrow$ `Tôi là sinh_viên`.
- **Mục đích:** Giúp mô hình PhoBERT ánh xạ chính xác các token đã được train trong bộ từ điển tiếng Việt.

## Slide 9: Luồng quét và xử lý bình luận (Workflow)
1. **Input:** Người dùng nhập `Video ID`.
2. **Fetch:** FastAPI gọi YouTube API lấy dữ liệu (dùng `pageToken` chia nhỏ mỗi 100 comments).
3. **Inference:** Chuyển text qua `ViTokenizer` $\rightarrow$ Đưa vào mô hình `PhoBERT` $\rightarrow$ Lấy xác suất độ tin cậy (Confidence) và nhãn (Toxic/Clean).
4. **Save:** Lưu vào SQLite Database. Cập nhật tiến trình qua API cho Frontend.

## Slide 10: Tính năng "Auto-Mod" (Tự động diệt Toxic)
- Hệ thống không chỉ gợi ý mà có khả năng **Hành động ngay lập tức**.
- **Điều kiện kích hoạt:** 
  - Nhãn dự đoán là: `Toxic`
  - Độ tin cậy (Confidence) $> 95\%$.
- **Hành động:** Tự động gửi API `delete()` tới YouTube để xóa vĩnh viễn bình luận đó. Trạng thái trong DB cập nhật thành `deleted`.
- **Lợi ích:** Tiết kiệm thời gian rà soát thủ công, ngăn chặn lây lan tiêu cực.

## Slide 11: Tối ưu hoá Backend (Background Tasks)
- **Vấn đề:** Phân tích hàng ngàn bình luận bằng AI tốn nhiều thời gian, làm treo giao diện.
- **Giải pháp:** Sử dụng `BackgroundTasks` của FastAPI.
- **Cơ chế:** Khi nhấn "Quét", API lập tức trả về `Task ID`. Backend âm thầm chạy tiến trình ngầm. Frontend dùng cơ chế Polling (gọi API sau mỗi 2s) để lấy tiến độ thực và render thanh Progress Bar.

## Slide 12: Tối ưu Quản lý Dữ liệu (Server-Side Pagination)
- **Vấn đề:** Load 10.000 comments lên giao diện sẽ gây giật lag (Out of memory).
- **Giải pháp:** Phân trang tại máy chủ (Server-Side Pagination).
- **Triển khai:**
  - Dùng `.offset()` và `.limit()` trong SQLAlchemy.
  - Chức năng tìm kiếm (`ilike`) và Lọc (Toxic/Clean) cũng được xử lý ở DB giúp tăng tốc độ phản hồi và tiết kiệm RAM máy khách.

## Slide 13: Giao diện Quản trị (Dashboard UI)
*(Slide này nên có hình chụp màn hình trang chủ)*
- **Thiết kế:** Giao diện tối (Dark Mode), kết hợp Glassmorphism mang lại cảm giác hiện đại, chuyên nghiệp.
- **Trải nghiệm UX:** 
  - Thẻ bình luận rõ ràng (đỏ cho Toxic, xanh cho Sạch).
  - Thanh độ tin cậy (Confidence bar) giúp admin có cơ sở ra quyết định.
  - Toast thông báo tức thời.

## Slide 14: Tính năng Kiểm duyệt Thủ công
*(Slide có hình chụp các nút chức năng)*
- Dành cho các bình luận mô hình phân loại với độ tin cậy thấp hoặc chưa bị tự động xóa.
- **Thao tác nhanh:**
  - Click "Giữ lại" (Approve)
  - Click "Xóa vĩnh viễn" (Delete)
- **Hành động hàng loạt (Bulk actions):** "Xóa tất cả Toxic trên trang" - Giúp dọn dẹp hàng chục bình luận bẩn chỉ bằng 1 click.

## Slide 15: Thống kê và Phân tích (Analytics)
*(Slide có hình chụp phần Dashboard Biểu đồ)*
- Cung cấp góc nhìn tổng quan cho chủ kênh:
  - **Pie Chart:** Tỷ lệ bình luận Sạch / Toxic (Đo lường "sức khỏe" video).
  - **Line Chart:** Biểu đồ xu hướng độc hại theo ngày (Phát hiện "bão" dư luận/khủng hoảng).
  - **Bar Chart:** Bảng xếp hạng Top 10 cá nhân spam/toxic nhiều nhất để có thể Block vĩnh viễn trên YouTube.

## Slide 16: Tính năng Báo cáo (Data Export)
- Mọi dữ liệu đã quét và xử lý có thể được tải xuống bằng 1 click dưới định dạng `CSV`.
- **Ý nghĩa:**
  - Dùng để làm báo cáo thống kê tình hình kênh.
  - Là nguồn dữ liệu quý giá (Ground truth) để tiếp tục Fine-tune huấn luyện mô hình AI mạnh hơn trong tương lai.

## Slide 17: Ưu điểm nổi bật của Hệ thống
1. **Chuyên biệt cho tiếng Việt:** Xử lý tốt đặc thù ngôn ngữ nhờ PhoBERT.
2. **Real-world application:** Kết nối thật với YouTube, có thể dùng thực tế ngay lập tức.
3. **Hiệu năng cao:** Kiến trúc xử lý bất đồng bộ, phân trang tối ưu.
4. **Giao diện đẳng cấp:** UI/UX không thua kém các phần mềm thương mại SaaS.

## Slide 18: Khó khăn và Thách thức (Challenges)
- **Dữ liệu Tiếng Việt đa dạng:** Ngôn ngữ mạng (teencode, viết tắt, từ lóng mới, biến âm cố tình lách luật) gây khó cho mô hình nhận diện.
- **Giới hạn API:** YouTube API có Quota Limit mỗi ngày, cần phải cẩn thận khi quét các kênh cực lớn.
- **Tài nguyên AI:** Chạy model HuggingFace trên CPU cục bộ có thể chậm.

## Slide 19: Hướng phát triển tiếp theo (Future Work)
- Tích hợp thêm từ điển/Lexicon teencode để tăng độ nhạy bén của mô hình.
- **Active Learning:** Tự động thu thập lại những comment mà Admin ấn "Giữ lại" (sai lầm của AI) để retrain định kỳ.
- Đóng gói Docker, triển khai lên Cloud (AWS/GCP/Render) với GPU.
- Mở rộng hỗ trợ kiểm duyệt cho Facebook, TikTok...

## Slide 20: Tổng kết và Q&A
- **Tổng kết:** 
  Dự án hoàn thành một vòng đời chuẩn của AI (Tích hợp NLP vào Web Application), mang lại giá trị thực tế cao trong quản trị nội dung số.
- **Lời cảm ơn** đến thầy cô và bộ môn.
- **Hỏi đáp (Q&A)**.

---
*(Ghi chú cho bạn: Khi làm slide PowerPoint/Canva, hãy lấy các gạch đầu dòng này làm nội dung chính (text), kết hợp thêm các screenshot của dự án (trang Dashboard, ảnh biểu đồ, ảnh code backend) để bài thuyết trình sinh động hơn).*
