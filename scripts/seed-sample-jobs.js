'use strict';

// Adds 30 realistic, published sample jobs through the app API.
// Run with: node scripts/seed-sample-jobs.js
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const dataFile = path.join(process.env.DATA_DIR || path.join(root, 'data'), 'db.json');
const baseUrl = (process.env.APP_URL || 'http://localhost:3000').replace(/\/$/, '');
const demoTag = 'ketnoi-demo-v1';
const password = 'KetnoiDemo2026!';
const criteriaWeights = { skills: 60, education: 15, experience: 15, languages: 5, projects: 5 };
const retiredTitles = [
  [1, 'Graphic Designer Intern'],
  [11, 'Java Developer Intern'],
  [4, 'E-commerce Operations Intern'],
  [13, 'Android Developer Intern']
];

const records = [
  [1, 'Frontend React Intern – Sản phẩm SaaS', 'Công nghệ thông tin', 'TP. Hồ Chí Minh', 'Thực tập', 'Intern', 'Kết hợp', 4000000, 7000000, 'React, TypeScript, HTML, CSS', 'Tham gia xây dựng giao diện sản phẩm SaaS, chuyển thiết kế Figma thành các trang responsive và cải thiện trải nghiệm sử dụng.', 'Biết JavaScript cơ bản, đã làm quen React; có Git và chủ động trao đổi khi gặp vướng mắc.'],
  [1, 'QA Automation Intern', 'Công nghệ thông tin', 'TP. Hồ Chí Minh', 'Thực tập', 'Intern', 'Tại văn phòng', 3500000, 6000000, 'JavaScript, Playwright, API Testing, Git', 'Hỗ trợ viết kịch bản kiểm thử cho các luồng đăng ký, thanh toán và quản lý tài khoản; phối hợp cùng kỹ sư xử lý lỗi.', 'Có tư duy kiểm thử, biết một ngôn ngữ lập trình cơ bản; kinh nghiệm Playwright là lợi thế.'],
  [2, 'Data Analyst Intern – Vận hành và báo cáo', 'Phân tích dữ liệu', 'Hà Nội', 'Thực tập', 'Intern', 'Kết hợp', 3500000, 6000000, 'SQL, Excel, Power BI, Data Cleaning', 'Làm sạch dữ liệu vận hành, xây dựng dashboard theo dõi chỉ số kinh doanh và trình bày phát hiện cho nhóm sản phẩm.', 'Sử dụng được SQL và Excel; cẩn thận với dữ liệu, biết Power BI hoặc Tableau là lợi thế.'],
  [2, 'Business Intelligence Analyst', 'Phân tích dữ liệu', 'Hà Nội', 'Toàn thời gian', 'Fresher', 'Kết hợp', 10000000, 16000000, 'SQL, Power BI, Data Modeling, Python', 'Thiết kế mô hình dữ liệu và báo cáo quản trị, tự động hóa các báo cáo định kỳ cho khối vận hành và kinh doanh.', 'Có từ 6 tháng kinh nghiệm hoặc dự án BI; hiểu SQL, trực quan hóa và cách kiểm tra chất lượng dữ liệu.'],
  [3, 'Backend Engineer Node.js – Nền tảng SaaS', 'Phần mềm', 'Toàn quốc', 'Toàn thời gian', 'Junior', 'Từ xa', 14000000, 22000000, 'Node.js, PostgreSQL, REST API, Docker', 'Phát triển API cho nền tảng SaaS, tối ưu truy vấn PostgreSQL và phối hợp với frontend để giao tính năng ổn định.', 'Có ít nhất 1 năm kinh nghiệm Node.js; hiểu REST, SQL, kiểm thử và quy trình Git.'],
  [3, 'Cloud Support Engineer', 'Điện toán đám mây', 'Toàn quốc', 'Toàn thời gian', 'Fresher', 'Từ xa', 11000000, 17000000, 'Linux, AWS, Docker, Networking', 'Theo dõi sức khỏe dịch vụ cloud, xử lý yêu cầu hỗ trợ kỹ thuật và viết tài liệu hướng dẫn vận hành.', 'Nắm Linux và mạng căn bản; đã học AWS/Azure/GCP hoặc có chứng chỉ nền tảng là lợi thế.'],
  [4, 'UX/UI Product Designer Intern', 'Thiết kế sản phẩm số', 'Đà Nẵng', 'Thực tập', 'Intern', 'Kết hợp', 3000000, 5500000, 'Figma, UX Research, Prototyping, UI Design', 'Hỗ trợ nghiên cứu người dùng, xây dựng user flow và prototype cho ứng dụng tài chính cá nhân.', 'Có portfolio Figma, quan tâm đến khả năng tiếp cận và sẵn sàng tiếp nhận phản hồi thiết kế.'],
  [4, 'Product Designer', 'Thiết kế sản phẩm số', 'Đà Nẵng', 'Toàn thời gian', 'Junior', 'Kết hợp', 14000000, 22000000, 'Figma, Design Systems, UX Research, Prototyping', 'Dẫn dắt thiết kế một nhóm tính năng từ discovery đến bàn giao, phối hợp với product manager và kỹ sư.', 'Có 1–2 năm làm sản phẩm số; trình bày được quyết định thiết kế bằng dữ liệu và nghiên cứu người dùng.'],
  [5, 'AI Engineer Fresher – Xử lý ngôn ngữ', 'Trí tuệ nhân tạo', 'TP. Hồ Chí Minh', 'Toàn thời gian', 'Fresher', 'Tại văn phòng', 11000000, 18000000, 'Python, Machine Learning, Pandas, Scikit-learn', 'Thử nghiệm mô hình phân loại dữ liệu, xây dựng pipeline đánh giá và hỗ trợ tích hợp mô hình vào dịch vụ nội bộ.', 'Có nền tảng Python, xác suất thống kê và ML cơ bản; biết scikit-learn hoặc PyTorch là lợi thế.'],
  [5, 'Data Scientist Intern', 'Trí tuệ nhân tạo', 'TP. Hồ Chí Minh', 'Thực tập', 'Intern', 'Kết hợp', 4000000, 6500000, 'Python, Statistics, SQL, Machine Learning', 'Phân tích dữ liệu người dùng, thử nghiệm mô hình dự báo cơ bản và ghi lại phương pháp đánh giá có thể tái lập.', 'Đang học ngành dữ liệu, toán hoặc CNTT; biết Python, SQL và thống kê nhập môn.'],
  [6, 'Cybersecurity Intern – Kiểm thử ứng dụng', 'An toàn thông tin', 'Hà Nội', 'Thực tập', 'Intern', 'Tại văn phòng', 4000000, 6500000, 'Linux, OWASP, Network Security, Python', 'Hỗ trợ rà soát cấu hình ứng dụng, tổng hợp cảnh báo bảo mật và thực hành kiểm thử trong môi trường lab được cấp phép.', 'Hiểu HTTP, Linux và kiến thức mạng cơ bản; tuân thủ quy trình xử lý dữ liệu và báo cáo lỗ hổng.'],
  [6, 'SOC Analyst Level 1', 'An toàn thông tin', 'Hà Nội', 'Toàn thời gian', 'Junior', 'Tại văn phòng', 12000000, 19000000, 'SIEM, Linux, Incident Response, Networking', 'Giám sát cảnh báo an ninh, phân loại sự kiện và phối hợp xử lý sự cố theo playbook của đội SOC.', 'Có kiến thức mạng, hệ điều hành; sẵn sàng làm theo ca và ghi chép sự cố rõ ràng.'],
  [7, 'Digital Marketing Intern', 'Marketing', 'Hà Nội', 'Thực tập', 'Intern', 'Kết hợp', 3000000, 5500000, 'Google Analytics, SEO, Content Marketing, Canva', 'Hỗ trợ lập lịch nội dung đa kênh, theo dõi hiệu quả chiến dịch và đề xuất thử nghiệm cải thiện chuyển đổi.', 'Viết tiếng Việt tốt, biết đọc số liệu cơ bản; có kinh nghiệm dự án cá nhân là lợi thế.'],
  [7, 'Performance Marketing Specialist', 'Marketing', 'Hà Nội', 'Toàn thời gian', 'Junior', 'Kết hợp', 13000000, 21000000, 'Google Ads, Meta Ads, Analytics, A/B Testing', 'Lập kế hoạch quảng cáo trả phí, theo dõi CAC/ROAS và phối hợp nội dung để tối ưu hiệu quả theo tuần.', 'Có 1 năm kinh nghiệm chạy quảng cáo; biết thiết lập tracking và báo cáo hiệu quả chiến dịch.'],
  [8, 'Embedded Firmware Intern – Thiết bị IoT', 'Điện tử và thiết bị', 'TP. Hồ Chí Minh', 'Thực tập', 'Intern', 'Tại văn phòng', 4500000, 7000000, 'C++, Embedded C, Arduino, Linux', 'Phát triển firmware mẫu cho thiết bị IoT, kiểm thử giao tiếp cảm biến và ghi nhận kết quả trên board thử nghiệm.', 'Biết C/C++, đọc sơ đồ cơ bản; yêu thích phần cứng và làm việc có quy trình an toàn.'],
  [8, 'IoT Firmware Engineer', 'Điện tử và thiết bị', 'TP. Hồ Chí Minh', 'Toàn thời gian', 'Junior', 'Tại văn phòng', 15000000, 24000000, 'Embedded C, C++, MQTT, FreeRTOS', 'Thiết kế firmware cho thiết bị đo môi trường, tối ưu độ ổn định kết nối và phối hợp đội phần cứng để kiểm thử.', 'Có 1–2 năm làm firmware; hiểu UART/I2C/SPI và debug trên thiết bị thực.'],
  [9, 'Business Analyst Intern – Chuyển đổi số', 'Tư vấn kinh doanh', 'Hà Nội', 'Thực tập', 'Intern', 'Kết hợp', 4000000, 6500000, 'Excel, Market Research, PowerPoint, SQL', 'Thu thập yêu cầu, phân tích quy trình khách hàng và chuẩn bị tài liệu nghiệp vụ cho nhóm tư vấn triển khai.', 'Giao tiếp rõ ràng, sử dụng tốt Excel/PowerPoint; tư duy logic và cẩn thận trong tài liệu.'],
  [9, 'Customer Success Executive', 'Tư vấn kinh doanh', 'Hà Nội', 'Toàn thời gian', 'Junior', 'Kết hợp', 11000000, 18000000, 'Customer Success, CRM, Communication, Excel', 'Hướng dẫn khách hàng sử dụng phần mềm, theo dõi mức độ hài lòng và phối hợp các nhóm để xử lý yêu cầu.', 'Có kỹ năng giao tiếp và quản lý công việc; kinh nghiệm CRM hoặc chăm sóc khách hàng là lợi thế.'],
  [11, 'Java Developer Intern – Hệ thống đơn hàng', 'Phần mềm', 'Hà Nội', 'Thực tập', 'Intern', 'Kết hợp', 4500000, 7500000, 'Java, Spring Boot, MySQL, Git', 'Xây dựng API quản lý đơn hàng cùng mentor, viết kiểm thử và tham gia review mã nguồn định kỳ.', 'Nắm Java hướng đối tượng, SQL cơ bản; có dự án Spring Boot hoặc GitHub cá nhân là lợi thế.'],
  [11, 'Full-stack Developer', 'Phần mềm', 'Hà Nội', 'Toàn thời gian', 'Junior', 'Kết hợp', 16000000, 26000000, 'React, Node.js, TypeScript, PostgreSQL', 'Phát triển tính năng end-to-end cho nền tảng quản trị, từ giao diện web đến API và truy vấn dữ liệu.', 'Có 1–2 năm kinh nghiệm web; hiểu React, REST API, SQL và quy trình review code.'],
  [13, 'Android Developer Intern – Ứng dụng học tập', 'Phần mềm di động', 'Đà Nẵng', 'Thực tập', 'Intern', 'Kết hợp', 3500000, 6000000, 'Kotlin, Android, Firebase, REST API', 'Xây dựng một số màn hình ứng dụng Android, tích hợp API và kiểm thử trên nhiều kích thước thiết bị.', 'Biết Kotlin cơ bản, hiểu vòng đời Android; có ứng dụng demo là lợi thế.'],
  [13, 'Mobile App Developer', 'Phần mềm di động', 'Đà Nẵng', 'Toàn thời gian', 'Junior', 'Từ xa', 14000000, 23000000, 'Flutter, Dart, Firebase, REST API', 'Phát triển ứng dụng đa nền tảng cho khách hàng, cải thiện hiệu năng và phối hợp với thiết kế để hoàn thiện trải nghiệm.', 'Có kinh nghiệm Flutter/Dart hoặc Android/iOS; biết quản lý state và xử lý lỗi API.'],
  [14, 'Recruitment Coordinator', 'Nhân sự', 'TP. Hồ Chí Minh', 'Toàn thời gian', 'Fresher', 'Kết hợp', 9000000, 14000000, 'Recruitment, Communication, Excel, Scheduling', 'Điều phối lịch phỏng vấn, cập nhật dữ liệu ứng viên và hỗ trợ truyền thông tuyển dụng cho các nhóm chuyên môn.', 'Tổ chức công việc tốt, giao tiếp lịch sự; thành thạo bảng tính và bảo mật thông tin ứng viên.'],
  [14, 'Talent Acquisition Intern', 'Nhân sự', 'TP. Hồ Chí Minh', 'Thực tập', 'Intern', 'Kết hợp', 3000000, 5000000, 'Sourcing, LinkedIn, Communication, Excel', 'Tìm kiếm ứng viên theo tiêu chí, cập nhật pipeline và hỗ trợ tổ chức ngày hội nghề nghiệp tại trường đại học.', 'Yêu thích công việc nhân sự, chủ động giao tiếp và sử dụng tốt công cụ văn phòng.'],
  [1, 'Graphic Designer Intern – Nhận diện thương hiệu', 'Thiết kế và truyền thông', 'TP. Hồ Chí Minh', 'Thực tập', 'Intern', 'Tại văn phòng', 3000000, 5000000, 'Figma, Illustrator, Photoshop, Brand Design', 'Thiết kế ấn phẩm mạng xã hội, banner chiến dịch và hỗ trợ duy trì bộ nhận diện cho các nhãn hàng.', 'Có portfolio cá nhân, dùng được Figma hoặc Adobe; chú ý chi tiết và tiếp nhận phản hồi tốt.'],
  [2, 'Video Editor', 'Thiết kế và truyền thông', 'TP. Hồ Chí Minh', 'Toàn thời gian', 'Junior', 'Kết hợp', 12000000, 19000000, 'Premiere Pro, After Effects, Storytelling, CapCut', 'Dựng video ngắn cho kênh số, xử lý âm thanh/phụ đề và phối hợp content creator theo lịch phát hành.', 'Có portfolio video; sử dụng thành thạo một công cụ dựng và đảm bảo tiến độ bàn giao.'],
  [3, 'SEO Content Executive', 'Thương mại điện tử', 'Cần Thơ', 'Toàn thời gian', 'Junior', 'Từ xa', 10000000, 16000000, 'SEO, Content Writing, Google Search Console, Analytics', 'Nghiên cứu từ khóa, xây dựng nội dung hữu ích cho trang sản phẩm và theo dõi tăng trưởng organic traffic.', 'Viết nội dung mạch lạc, hiểu SEO on-page; biết Search Console hoặc Analytics là lợi thế.'],
  [4, 'E-commerce Operations Intern – Vận hành gian hàng', 'Thương mại điện tử', 'Cần Thơ', 'Thực tập', 'Intern', 'Kết hợp', 3000000, 5000000, 'E-commerce, Excel, Inventory, Customer Service', 'Cập nhật danh mục sản phẩm, theo dõi tồn kho và hỗ trợ xử lý các yêu cầu vận hành gian hàng trực tuyến.', 'Biết Excel, làm việc cẩn thận và quan tâm đến hoạt động bán lẻ trực tuyến.'],
  [5, 'Financial Planning Analyst', 'Tài chính', 'Hà Nội', 'Toàn thời gian', 'Junior', 'Kết hợp', 14000000, 22000000, 'Financial Modeling, Excel, Power BI, Accounting', 'Tổng hợp ngân sách, phân tích chênh lệch thực tế với kế hoạch và xây dựng báo cáo hỗ trợ quyết định đầu tư.', 'Tốt nghiệp tài chính/kế toán; Excel tốt, hiểu báo cáo tài chính và kiểm soát dữ liệu.'],
  [6, 'Supply Chain Planning Intern', 'Vận hành và chuỗi cung ứng', 'Hà Nội', 'Thực tập', 'Intern', 'Tại văn phòng', 3500000, 6000000, 'Supply Chain, Excel, Forecasting, Data Analysis', 'Hỗ trợ theo dõi kế hoạch cung ứng, phân tích tồn kho và cập nhật báo cáo giao nhận giữa các đơn vị.', 'Sinh viên kinh tế, logistics hoặc công nghiệp; cẩn thận với số liệu và thành thạo Excel cơ bản.']
];

function readDemoAccounts() {
  const db = JSON.parse(fs.readFileSync(dataFile, 'utf8'));
  const activeUserIds = new Set(db.sessions.filter(session => session.expiresAt > Date.now()).map(session => session.userId));
  const employers = db.users
    .filter(user => user.role === 'employer' && user.demoSeed === demoTag && !activeUserIds.has(user.id))
    .sort((a, b) => a.email.localeCompare(b.email, undefined, { numeric: true }));
  const admin = db.users.find(user => user.role === 'admin' && user.demoSeed === demoTag && !activeUserIds.has(user.id));
  if (!employers.length || !admin) throw new Error('Cần có tài khoản demo nhà tuyển dụng và admin chưa đăng nhập; hãy chạy npm run seed:demo trước.');
  return { employers, admin };
}

async function api(pathname, { cookie = '', method = 'GET', body } = {}) {
  const response = await fetch(`${baseUrl}${pathname}`, {
    method,
    headers: { ...(cookie ? { Cookie: cookie } : {}), ...(body ? { 'Content-Type': 'application/json' } : {}) },
    ...(body ? { body: JSON.stringify(body) } : {})
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(`${method} ${pathname} (${response.status}): ${data.error || 'Yêu cầu thất bại.'}`);
  return { data, cookie: response.headers.get('set-cookie')?.split(';', 1)[0] || cookie };
}

async function login(email) {
  const result = await api('/api/login', { method: 'POST', body: { email, password } });
  return { user: result.data.user, cookie: result.cookie };
}

function payload(record, index) {
  const [ownerNo, title, industry, location, type, level, workMode, salaryMin, salaryMax, skillText, description, requirements] = record;
  const skills = skillText.split(', ').map((skill, skillIndex) => ({ skill, importance: skillIndex < 2 ? 'required' : 'preferred', weight: skillIndex < 2 ? 20 : 10 }));
  const expiry = new Date();
  expiry.setDate(expiry.getDate() + 60);
  return {
    title, industry, location, type, level, workMode, salaryMin, salaryMax,
    experience: level === 'Intern' ? 'Không yêu cầu kinh nghiệm' : level === 'Fresher' ? '0–1 năm' : '1–2 năm',
    target: level === 'Intern' ? 'Sinh viên năm cuối hoặc mới tốt nghiệp' : 'Ứng viên có dự án hoặc kinh nghiệm liên quan',
    headcount: index % 4 === 0 ? 2 : 1,
    languages: 'Tiếng Việt; ưu tiên tiếng Anh giao tiếp',
    description: `${description} Bạn sẽ làm việc cùng đội ngũ chuyên môn, có mục tiêu theo giai đoạn và được phản hồi định kỳ.`,
    requirements,
    benefits: 'Được hướng dẫn bởi đội ngũ chuyên môn, tham gia dự án thực tế, có ngân sách học tập và lộ trình phát triển rõ ràng.',
    recruitmentProcess: 'Sàng lọc hồ sơ → Trao đổi với nhà tuyển dụng → Phỏng vấn chuyên môn → Thông báo kết quả.',
    expiresAt: expiry.toISOString().slice(0, 10),
    skillCriteria: skills,
    criteriaWeights
  };
}

async function main() {
  if (!fs.existsSync(dataFile)) throw new Error(`Không tìm thấy dữ liệu ${dataFile}; hãy chạy npm run seed:demo trước.`);
  const { employers, admin } = readDemoAccounts();
  const createdOrPending = [];
  const issuedSessions = new Map();
  let createdCount = 0;
  for (let i = 0; i < records.length; i += 1) {
    const [ownerNo, title] = records[i];
    const owner = employers.find(user => user.email === `employer${String(ownerNo).padStart(2, '0')}@example.test`);
    if (!owner) { console.warn(`Bỏ qua ${title}: tài khoản employer${String(ownerNo).padStart(2, '0')} đang có phiên đăng nhập.`); continue; }
    const { cookie } = await login(owner.email);
    issuedSessions.set(owner.email, cookie);
    const current = await api('/api/employer/jobs', { cookie });
    for (const [, retiredTitle] of retiredTitles.filter(([number]) => number === ownerNo)) {
      const retiredJob = current.data.jobs.find(job => job.title === retiredTitle && job.status === 'published');
      if (retiredJob) await api(`/api/employer/jobs/${encodeURIComponent(retiredJob.id)}/status`, { cookie, method: 'PATCH', body: { status: 'closed' } });
    }
    const existing = current.data.jobs.find(job => job.title === title);
    if (existing) {
      if (existing.status === 'pending_review') createdOrPending.push(existing.id);
      continue;
    }
    const created = await api('/api/employer/jobs', { cookie, method: 'POST', body: payload(records[i], i) });
    createdOrPending.push(created.data.job.id);
    createdCount += 1;
  }

  const { cookie: adminCookie } = await login(admin.email);
  issuedSessions.set(admin.email, adminCookie);
  let publishedCount = 0;
  for (const jobId of createdOrPending) {
    const result = await api(`/api/moderation/jobs/${encodeURIComponent(jobId)}`, { cookie: adminCookie, method: 'POST', body: { action: 'approve' } }).catch(error => {
      if (String(error.message).includes('(404)')) return null;
      throw error;
    });
    if (result?.data?.job?.status === 'published') publishedCount += 1;
  }
  for (const cookie of issuedSessions.values()) await api('/api/logout', { cookie, method: 'POST', body: {} });
  console.log(`Đã tạo ${createdCount} tin mẫu mới; đã duyệt công khai ${publishedCount} tin. Tổng danh sách yêu cầu: ${records.length}.`);
}

main().catch(error => { console.error(error.message); process.exitCode = 1; });
