'use strict';

// Additive, repeatable demo data. Existing users and records are preserved.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { scryptSync } = require('node:crypto');

const root = path.resolve(__dirname, '..');
const dataDir = path.resolve(process.env.DATA_DIR || path.join(root, 'data'));
const dbFile = path.join(dataDir, 'db.json');
const cvDir = path.join(dataDir, 'cv-files');
const seedTag = 'ketnoi-demo-v1';
const password = 'KetnoiDemo2026!';
const now = new Date();
const iso = days => new Date(now.getTime() + days * 86400000).toISOString();

const students = [
  { name: 'Nguyễn Minh Anh', email: 'student01@example.test', school: 'Đại học Bách khoa Hà Nội', major: 'Công nghệ thông tin', year: '2026', location: 'Hà Nội', skills: ['JavaScript', 'React', 'TypeScript', 'HTML', 'CSS'], role: 'Frontend Developer', project: 'Xây dựng trang thương mại điện tử bằng React, có tìm kiếm sản phẩm và giỏ hàng.' },
  { name: 'Trần Gia Bảo', email: 'student02@example.test', school: 'Đại học Kinh tế Quốc dân', major: 'Phân tích dữ liệu', year: '2026', location: 'Hà Nội', skills: ['SQL', 'Python', 'Excel', 'Power BI', 'Statistics'], role: 'Data Analyst', project: 'Phân tích dữ liệu bán hàng và thiết kế dashboard theo dõi doanh thu.' },
  { name: 'Lê Thảo Nhi', email: 'student03@example.test', school: 'Đại học Đà Nẵng', major: 'Thiết kế đồ họa', year: '2027', location: 'Đà Nẵng', skills: ['Figma', 'UX Research', 'Prototyping', 'Illustrator'], role: 'Product Designer', project: 'Thiết kế prototype ứng dụng đặt lịch, kiểm thử luồng với người dùng.' },
  { name: 'Phạm Quốc Huy', email: 'student04@example.test', school: 'Đại học Công nghệ TP.HCM', major: 'Kỹ thuật phần mềm', year: '2026', location: 'TP. Hồ Chí Minh', skills: ['Node.js', 'Express', 'PostgreSQL', 'REST API', 'Git'], role: 'Backend Developer', project: 'Phát triển REST API quản lý thư viện với Node.js và PostgreSQL.' },
  { name: 'Võ Khánh Linh', email: 'student05@example.test', school: 'Đại học Quốc gia TP.HCM', major: 'Trí tuệ nhân tạo', year: '2027', location: 'TP. Hồ Chí Minh', skills: ['Python', 'Machine Learning', 'Pandas', 'Scikit-learn'], role: 'AI Engineer', project: 'Huấn luyện mô hình phân loại văn bản và đánh giá bằng cross-validation.' },
  { name: 'Đặng Hoàng Nam', email: 'student06@example.test', school: 'Đại học FPT', major: 'An toàn thông tin', year: '2026', location: 'Hà Nội', skills: ['Linux', 'Python', 'Network Security', 'OWASP'], role: 'Security Analyst Intern', project: 'Thực hành rà soát bảo mật ứng dụng web trong môi trường lab.' },
  { name: 'Bùi Ngọc Mai', email: 'student07@example.test', school: 'Đại học Thương mại', major: 'Marketing', year: '2027', location: 'Hà Nội', skills: ['Content Marketing', 'SEO', 'Google Analytics', 'Canva'], role: 'Marketing Intern', project: 'Lập kế hoạch nội dung mạng xã hội và theo dõi chỉ số tương tác.' },
  { name: 'Ngô Đức Long', email: 'student08@example.test', school: 'Đại học Bách khoa TP.HCM', major: 'Kỹ thuật máy tính', year: '2026', location: 'TP. Hồ Chí Minh', skills: ['C++', 'Embedded C', 'Arduino', 'Linux'], role: 'Embedded Software Intern', project: 'Lập trình bộ đo nhiệt độ dùng vi điều khiển và hiển thị dữ liệu.' },
  { name: 'Phan Hà My', email: 'student09@example.test', school: 'Đại học Ngoại thương', major: 'Kinh doanh quốc tế', year: '2027', location: 'Hà Nội', skills: ['Excel', 'PowerPoint', 'Market Research', 'English'], role: 'Business Analyst Intern', project: 'Nghiên cứu thị trường và trình bày đề xuất mở rộng kênh bán hàng.' },
  { name: 'Đỗ Tuấn Kiệt', email: 'student10@example.test', school: 'Đại học Công nghệ - ĐHQGHN', major: 'Khoa học máy tính', year: '2026', location: 'Hà Nội', skills: ['Java', 'Spring Boot', 'MySQL', 'Git'], role: 'Java Developer Intern', project: 'Xây dựng dịch vụ quản lý đơn hàng bằng Spring Boot và MySQL.' },
  { name: 'Vũ Yến Nhi', email: 'student11@example.test', school: 'Đại học Kiến trúc TP.HCM', major: 'Thiết kế đồ họa', year: '2027', location: 'TP. Hồ Chí Minh', skills: ['Photoshop', 'Illustrator', 'Figma', 'Brand Design'], role: 'Graphic Designer Intern', project: 'Thiết kế bộ nhận diện thương hiệu và bộ ấn phẩm truyền thông.' },
  { name: 'Đinh Minh Khang', email: 'student12@example.test', school: 'Đại học Cần Thơ', major: 'Hệ thống thông tin', year: '2026', location: 'Cần Thơ', skills: ['SQL', 'Python', 'Tableau', 'Data Cleaning'], role: 'Business Intelligence Intern', project: 'Chuẩn hóa dữ liệu và tạo báo cáo trực quan cho cửa hàng bán lẻ.' },
  { name: 'Lý Thanh Trúc', email: 'student13@example.test', school: 'Đại học Sư phạm Kỹ thuật TP.HCM', major: 'Thương mại điện tử', year: '2027', location: 'TP. Hồ Chí Minh', skills: ['E-commerce', 'SEO', 'Excel', 'Customer Service'], role: 'E-commerce Intern', project: 'Tối ưu nội dung sản phẩm và theo dõi hiệu quả gian hàng trực tuyến.' },
  { name: 'Nguyễn Nhật Quang', email: 'student14@example.test', school: 'Đại học Bách khoa Đà Nẵng', major: 'Kỹ thuật phần mềm', year: '2026', location: 'Đà Nẵng', skills: ['Kotlin', 'Android', 'Firebase', 'REST API'], role: 'Android Developer Intern', project: 'Phát triển ứng dụng Android ghi chú có đồng bộ dữ liệu Firebase.' },
  { name: 'Trương Bảo Châu', email: 'student15@example.test', school: 'Đại học Khoa học Tự nhiên TP.HCM', major: 'Toán tin', year: '2027', location: 'TP. Hồ Chí Minh', skills: ['Python', 'Statistics', 'R', 'Machine Learning'], role: 'Data Science Intern', project: 'Phân tích dữ liệu khảo sát và thử nghiệm mô hình dự báo cơ bản.' },
];

const employers = [
  { name: 'Công ty TNHH Aurora Tech', slug: 'aurora-tech-demo', industry: 'Công nghệ thông tin', location: 'TP. Hồ Chí Minh', size: '11-50', title: 'Frontend Developer Intern', type: 'Thực tập', level: 'Intern', workMode: 'hybrid', skills: ['JavaScript', 'React', 'HTML', 'CSS'], salaryMin: 4000000, salaryMax: 7000000, description: 'Tham gia xây dựng giao diện sản phẩm web cùng đội ngũ kỹ sư và thiết kế.', requirements: 'Biết JavaScript cơ bản, đã làm quen React và Git; chủ động học hỏi.', benefits: 'Mentor hướng dẫn, hỗ trợ phụ cấp và cơ hội trở thành nhân viên chính thức.', experience: 'Không yêu cầu kinh nghiệm', target: 'Sinh viên năm 3, năm 4', headcount: 2 },
  { name: 'Công ty TNHH GreenMetrics', slug: 'greenmetrics-demo', industry: 'Phân tích dữ liệu', location: 'Hà Nội', size: '11-50', title: 'Data Analyst Intern', type: 'Thực tập', level: 'Intern', workMode: 'onsite', skills: ['SQL', 'Python', 'Excel', 'Power BI'], salaryMin: 3500000, salaryMax: 6000000, description: 'Hỗ trợ phân tích dữ liệu vận hành, làm sạch dữ liệu và xây dựng báo cáo.', requirements: 'Có kiến thức SQL, Excel; tư duy logic và cẩn thận với số liệu.', benefits: 'Được hướng dẫn nghiệp vụ, phụ cấp thực tập và xác nhận thực tập.', experience: 'Không yêu cầu kinh nghiệm', target: 'Sinh viên khối kinh tế, dữ liệu hoặc CNTT', headcount: 1 },
  { name: 'Công ty Cổ phần Northstar Labs', slug: 'northstar-labs-demo', industry: 'Phần mềm', location: 'Toàn quốc', size: '51-200', title: 'Backend Node.js Developer', type: 'Toàn thời gian', level: 'Fresher', workMode: 'remote', skills: ['Node.js', 'Express', 'PostgreSQL', 'REST API'], salaryMin: 12000000, salaryMax: 18000000, description: 'Phát triển và duy trì dịch vụ backend cho nền tảng SaaS phục vụ khách hàng trong nước.', requirements: 'Nắm vững JavaScript, REST API và SQL; biết viết mã rõ ràng, có trách nhiệm.', benefits: 'Làm việc từ xa, ngân sách học tập và bảo hiểm theo chính sách công ty.', experience: '0-1 năm', target: 'Ứng viên mới tốt nghiệp', headcount: 2 },
  { name: 'Công ty TNHH Lumina Studio', slug: 'lumina-studio-demo', industry: 'Thiết kế sản phẩm số', location: 'Đà Nẵng', size: '11-50', title: 'UX/UI Product Design Intern', type: 'Thực tập', level: 'Intern', workMode: 'hybrid', skills: ['Figma', 'UX Research', 'Prototyping', 'UI Design'], salaryMin: 3000000, salaryMax: 5000000, description: 'Cùng nhóm sản phẩm nghiên cứu trải nghiệm và thiết kế giao diện ứng dụng.', requirements: 'Có portfolio cá nhân, sử dụng Figma và sẵn sàng tiếp nhận phản hồi.', benefits: 'Mentor thiết kế đồng hành, lịch làm việc linh hoạt và phụ cấp thực tập.', experience: 'Không yêu cầu kinh nghiệm', target: 'Sinh viên thiết kế hoặc ngành liên quan', headcount: 1 },
  { name: 'Công ty TNHH Mekong AI', slug: 'mekong-ai-demo', industry: 'Trí tuệ nhân tạo', location: 'TP. Hồ Chí Minh', size: '11-50', title: 'AI/ML Engineer Fresher', type: 'Toàn thời gian', level: 'Fresher', workMode: 'onsite', skills: ['Python', 'Machine Learning', 'Pandas', 'Scikit-learn'], salaryMin: 10000000, salaryMax: 16000000, description: 'Tham gia thử nghiệm và triển khai các mô hình học máy cho sản phẩm dữ liệu.', requirements: 'Có nền tảng Python, kiến thức ML cơ bản và hiểu cách đánh giá mô hình.', benefits: 'Được làm việc với dữ liệu thực tế, đào tạo chuyên môn và lộ trình phát triển.', experience: '0-1 năm', target: 'Sinh viên mới tốt nghiệp ngành AI, CNTT, Toán tin', headcount: 2 },
  { name: 'Công ty TNHH BlueOak Security', slug: 'blueoak-security-demo', industry: 'An toàn thông tin', location: 'Hà Nội', size: '11-50', title: 'Security Analyst Intern', type: 'Thực tập', level: 'Intern', workMode: 'onsite', skills: ['Linux', 'Python', 'Network Security', 'OWASP'], salaryMin: 4000000, salaryMax: 6500000, description: 'Hỗ trợ đội bảo mật kiểm tra cấu hình và rà soát lỗ hổng trong môi trường thử nghiệm.', requirements: 'Có kiến thức mạng máy tính, Linux và tinh thần học hỏi về bảo mật ứng dụng.', benefits: 'Được mentoring, tham gia workshop bảo mật và nhận phụ cấp thực tập.', experience: 'Không yêu cầu kinh nghiệm', target: 'Sinh viên an toàn thông tin hoặc CNTT', headcount: 1 },
  { name: 'Công ty Cổ phần Chạm Media', slug: 'cham-media-demo', industry: 'Truyền thông', location: 'Hà Nội', size: '11-50', title: 'Marketing Content Intern', type: 'Thực tập', level: 'Intern', workMode: 'hybrid', skills: ['Content Marketing', 'SEO', 'Google Analytics', 'Canva'], salaryMin: 3000000, salaryMax: 5500000, description: 'Sáng tạo nội dung đa kênh và hỗ trợ theo dõi hiệu quả chiến dịch marketing.', requirements: 'Viết rõ ràng, biết tìm hiểu từ khóa và có khả năng làm việc theo kế hoạch.', benefits: 'Được hướng dẫn bởi đội ngũ marketing và tham gia dự án thực tế.', experience: 'Không yêu cầu kinh nghiệm', target: 'Sinh viên marketing, truyền thông', headcount: 2 },
  { name: 'Công ty TNHH Vina Embedded', slug: 'vina-embedded-demo', industry: 'Điện tử và thiết bị', location: 'TP. Hồ Chí Minh', size: '51-200', title: 'Embedded Software Intern', type: 'Thực tập', level: 'Intern', workMode: 'onsite', skills: ['C++', 'Embedded C', 'Arduino', 'Linux'], salaryMin: 4500000, salaryMax: 7000000, description: 'Tham gia phát triển firmware và kiểm thử các thiết bị IoT của công ty.', requirements: 'Biết C/C++, có kiến thức điện tử cơ bản và yêu thích hệ thống nhúng.', benefits: 'Có thiết bị thực hành, kỹ sư hướng dẫn và phụ cấp theo năng lực.', experience: 'Không yêu cầu kinh nghiệm', target: 'Sinh viên điện tử, máy tính hoặc tự động hóa', headcount: 2 },
  { name: 'Công ty TNHH Horizon Consulting', slug: 'horizon-consulting-demo', industry: 'Tư vấn kinh doanh', location: 'Hà Nội', size: '11-50', title: 'Business Analyst Intern', type: 'Thực tập', level: 'Intern', workMode: 'hybrid', skills: ['Excel', 'PowerPoint', 'Market Research', 'English'], salaryMin: 4000000, salaryMax: 6500000, description: 'Hỗ trợ phân tích yêu cầu khách hàng, nghiên cứu thị trường và chuẩn bị báo cáo.', requirements: 'Thành thạo Excel cơ bản, giao tiếp tốt và có tư duy phân tích.', benefits: 'Đào tạo kỹ năng tư vấn, phụ cấp thực tập và cơ hội làm dự án đa ngành.', experience: 'Không yêu cầu kinh nghiệm', target: 'Sinh viên kinh tế, kinh doanh quốc tế', headcount: 1 },
  { name: 'Công ty Cổ phần JavaWorks', slug: 'javaworks-demo', industry: 'Phần mềm', location: 'Hà Nội', size: '51-200', title: 'Java Developer Intern', type: 'Thực tập', level: 'Intern', workMode: 'hybrid', skills: ['Java', 'Spring Boot', 'MySQL', 'Git'], salaryMin: 5000000, salaryMax: 8000000, description: 'Phát triển API và chức năng backend cho nền tảng quản trị doanh nghiệp.', requirements: 'Nắm kiến thức Java cơ bản, SQL và cấu trúc dữ liệu.', benefits: 'Code review định kỳ, mentor kỹ thuật và lộ trình lên Fresher.', experience: 'Không yêu cầu kinh nghiệm', target: 'Sinh viên năm cuối ngành CNTT', headcount: 3 },
  { name: 'Công ty TNHH Mây Creative', slug: 'may-creative-demo', industry: 'Thiết kế và truyền thông', location: 'TP. Hồ Chí Minh', size: '11-50', title: 'Graphic Designer Intern', type: 'Thực tập', level: 'Intern', workMode: 'onsite', skills: ['Photoshop', 'Illustrator', 'Figma', 'Brand Design'], salaryMin: 3000000, salaryMax: 5000000, description: 'Thiết kế ấn phẩm số, hỗ trợ phát triển nhận diện thương hiệu cho khách hàng.', requirements: 'Có portfolio, sử dụng thành thạo công cụ thiết kế và tiếp nhận góp ý tốt.', benefits: 'Môi trường sáng tạo, được hướng dẫn quy trình thiết kế chuyên nghiệp.', experience: 'Không yêu cầu kinh nghiệm', target: 'Sinh viên thiết kế đồ họa', headcount: 1 },
  { name: 'Công ty TNHH Delta Insight', slug: 'delta-insight-demo', industry: 'Phân tích dữ liệu', location: 'Cần Thơ', size: '11-50', title: 'Business Intelligence Intern', type: 'Thực tập', level: 'Intern', workMode: 'hybrid', skills: ['SQL', 'Python', 'Tableau', 'Data Cleaning'], salaryMin: 3500000, salaryMax: 6000000, description: 'Chuẩn hóa nguồn dữ liệu và xây dựng báo cáo hỗ trợ quyết định kinh doanh.', requirements: 'Biết SQL cơ bản, cẩn thận và quan tâm đến trực quan hóa dữ liệu.', benefits: 'Làm việc với dữ liệu thực, có mentor và lịch làm linh hoạt.', experience: 'Không yêu cầu kinh nghiệm', target: 'Sinh viên hệ thống thông tin, phân tích dữ liệu', headcount: 1 },
  { name: 'Công ty Cổ phần Sông Việt Commerce', slug: 'song-viet-commerce-demo', industry: 'Thương mại điện tử', location: 'TP. Hồ Chí Minh', size: '51-200', title: 'E-commerce Operations Intern', type: 'Thực tập', level: 'Intern', workMode: 'onsite', skills: ['E-commerce', 'SEO', 'Excel', 'Customer Service'], salaryMin: 3500000, salaryMax: 5500000, description: 'Hỗ trợ vận hành gian hàng trực tuyến, cập nhật sản phẩm và theo dõi đơn hàng.', requirements: 'Sử dụng Excel tốt, giao tiếp cẩn thận và yêu thích thương mại điện tử.', benefits: 'Được tìm hiểu quy trình vận hành sàn và nhận phụ cấp thực tập.', experience: 'Không yêu cầu kinh nghiệm', target: 'Sinh viên thương mại điện tử, kinh doanh', headcount: 2 },
  { name: 'Công ty TNHH Sunbeam Mobile', slug: 'sunbeam-mobile-demo', industry: 'Phần mềm di động', location: 'Đà Nẵng', size: '11-50', title: 'Android Developer Intern', type: 'Thực tập', level: 'Intern', workMode: 'hybrid', skills: ['Kotlin', 'Android', 'Firebase', 'REST API'], salaryMin: 4000000, salaryMax: 6500000, description: 'Tham gia phát triển ứng dụng Android và tích hợp dịch vụ backend.', requirements: 'Biết Kotlin hoặc Java, có ứng dụng cá nhân là lợi thế.', benefits: 'Mentor Android đồng hành, phụ cấp và thiết bị làm việc.', experience: 'Không yêu cầu kinh nghiệm', target: 'Sinh viên kỹ thuật phần mềm', headcount: 2 },
  { name: 'Công ty TNHH Lotus Data Lab', slug: 'lotus-data-lab-demo', industry: 'Khoa học dữ liệu', location: 'TP. Hồ Chí Minh', size: '11-50', title: 'Data Science Intern', type: 'Thực tập', level: 'Intern', workMode: 'hybrid', skills: ['Python', 'Statistics', 'R', 'Machine Learning'], salaryMin: 4500000, salaryMax: 7000000, description: 'Hỗ trợ phân tích dữ liệu, xây dựng thử nghiệm và trình bày kết quả mô hình.', requirements: 'Có nền tảng xác suất thống kê và sử dụng Python hoặc R.', benefits: 'Được hướng dẫn nghiên cứu ứng dụng và tham gia seminar nội bộ.', experience: 'Không yêu cầu kinh nghiệm', target: 'Sinh viên toán tin, thống kê, khoa học dữ liệu', headcount: 2 },
];

function makePdf(lines) {
  const esc = s => String(s).replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)');
  const text = ['BT', '/F1 11 Tf', '50 790 Td', ...lines.flatMap((line, i) => [i ? '0 -18 Td' : '', `(${esc(line)}) Tj`].filter(Boolean)), 'ET'].join('\n');
  const objects = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 842] /Resources << /Font << /F1 5 0 R >> >> /Contents 4 0 R >>',
    `<< /Length ${Buffer.byteLength(text, 'ascii')} >>\nstream\n${text}\nendstream`,
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
  ];
  let out = '%PDF-1.4\n'; const offsets = [0];
  objects.forEach((obj, i) => { offsets.push(Buffer.byteLength(out, 'ascii')); out += `${i + 1} 0 obj\n${obj}\nendobj\n`; });
  const xref = Buffer.byteLength(out, 'ascii');
  out += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n${offsets.slice(1).map(n => `${String(n).padStart(10, '0')} 00000 n \n`).join('')}trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return Buffer.from(out, 'ascii');
}

function hashPassword(value) {
  const salt = crypto.randomBytes(16).toString('hex');
  return `${salt}:${scryptSync(value, salt, 64).toString('hex')}`;
}

function main() {
  if (!fs.existsSync(dbFile)) throw new Error(`Không tìm thấy database: ${dbFile}`);
  const db = JSON.parse(fs.readFileSync(dbFile, 'utf8'));
  for (const key of ['users', 'companies', 'jobs', 'resumes', 'consents']) if (!Array.isArray(db[key])) db[key] = [];
  fs.mkdirSync(cvDir, { recursive: true });
  let addedUsers = 0, addedCompanies = 0, addedJobs = 0, addedCvs = 0;
  const studentUsers = [];
  for (const [i, sample] of students.entries()) {
    let user = db.users.find(u => u.email === sample.email);
    if (!user) {
      user = { id: crypto.randomUUID(), email: sample.email, name: sample.name, role: 'student', passwordHash: hashPassword(password), verified: true, demoSeed: seedTag,
        profile: { fullName: sample.name, phone: `09000000${String(i + 1).padStart(2, '0')}`, school: sample.school, major: sample.major, gradYear: sample.year, location: sample.location, bio: `Sinh viên định hướng ${sample.role}, đang tìm cơ hội phát triển qua dự án thực tế.`, desiredRoles: [sample.role], jobTypes: ['Thực tập', 'Toàn thời gian'], skills: sample.skills, experiences: [], projects: [{ name: `Dự án ${sample.role}`, description: sample.project, technologies: sample.skills }], languages: [{ name: 'Tiếng Việt', level: 'Bản ngữ' }, { name: 'Tiếng Anh', level: 'Trung cấp' }], visibility: 'public', education: [{ school: sample.school, major: sample.major, gradYear: sample.year }], certifications: [], activities: [], externalLinks: [], onboardingCompleted: true, updatedAt: iso(0) }, createdAt: iso(-2), demoSeed: seedTag };
      db.users.push(user); db.consents.push({ id: crypto.randomUUID(), userId: user.id, purpose: 'account_profile', granted: true, version: '1.0', at: iso(0), demoSeed: seedTag }); addedUsers++;
    }
    studentUsers.push({ user, sample, i });
  }
  for (const [i, sample] of employers.entries()) {
    const employerEmail = `employer${String(i + 1).padStart(2, '0')}@example.test`;
    let user = db.users.find(u => u.email === employerEmail || u.email === `employer0${i + 1}@example.test`);
    if (user && user.email !== employerEmail) user.email = employerEmail;
    if (!user) {
      user = { id: crypto.randomUUID(), email: employerEmail, name: sample.name, role: 'employer', passwordHash: hashPassword(password), verified: true, demoSeed: seedTag, profile: { fullName: sample.name, phone: `09100000${String(i + 1).padStart(2, '0')}`, location: sample.location, bio: `Đại diện tuyển dụng tại ${sample.name}.` }, createdAt: iso(-2), demoSeed: seedTag };
      db.users.push(user); addedUsers++;
    }
    let company = db.companies.find(c => c.slug === sample.slug || c.ownerId === user.id);
    if (!company) {
      company = { id: crypto.randomUUID(), ownerId: user.id, name: sample.name, slug: sample.slug, website: 'https://example.test', description: `${sample.name} là doanh nghiệp mẫu trong lĩnh vực ${sample.industry}, tạo dữ liệu demo cho sinh viên tìm hiểu cơ hội nghề nghiệp.`, industry: sample.industry, location: sample.location, size: sample.size, branches: [sample.location], culture: 'Cởi mở, học hỏi và hợp tác.', benefits: ['Đào tạo chuyên môn', 'Môi trường thân thiện'], socials: [], mediaUrls: [], verificationStatus: 'verified', updatedAt: iso(0), createdAt: iso(-2), demoSeed: seedTag };
      db.companies.push(company); addedCompanies++;
    }
    if (!db.jobs.some(j => j.demoSeed === seedTag && j.companyId === company.id)) {
      const publishedAt = iso(-i);
      db.jobs.push({ id: crypto.randomUUID(), ownerId: user.id, companyId: company.id, title: sample.title, description: sample.description, requirements: sample.requirements, benefits: sample.benefits, recruitmentProcess: 'Nộp hồ sơ → Phỏng vấn chuyên môn → Trao đổi kết quả.', industry: sample.industry, location: sample.location, type: sample.type, level: sample.level, experience: sample.experience, target: sample.target, headcount: sample.headcount, workMode: sample.workMode, salaryMin: sample.salaryMin, salaryMax: sample.salaryMax, skillCriteria: sample.skills, skills: sample.skills, criteriaWeights: { skills: 60, education: 15, experience: 15, languages: 5, projects: 5 }, languages: ['Tiếng Việt'], status: 'published', publishedAt, expiresAt: iso(60), createdAt: publishedAt, updatedAt: iso(0), demoSeed: seedTag });
      addedJobs++;
    }
  }
  let admin = db.users.find(user => user.email === 'admin01@example.test');
  if (!admin) {
    admin = { id: crypto.randomUUID(), email: 'admin01@example.test', name: 'Quản trị viên Ketnoi', role: 'admin', passwordHash: hashPassword(password), verified: true, demoSeed: seedTag, profile: { fullName: 'Quản trị viên Ketnoi', onboardingCompleted: true }, createdAt: iso(-1) };
    db.users.push(admin); db.consents.push({ id: crypto.randomUUID(), userId: admin.id, purpose: 'account_profile', granted: true, version: '1.0', at: iso(0), demoSeed: seedTag }); addedUsers++;
  }
  for (const { user, sample, i } of studentUsers) {
    if (db.resumes.some(cv => cv.userId === user.id && cv.demoSeed === seedTag)) continue;
    const lines = [`RESUME - ${sample.name}`, sample.email, `Location: ${sample.location}`, `Education: ${sample.school} - ${sample.major} (${sample.year})`, `Target role: ${sample.role}`, `Skills: ${sample.skills.join(', ')}`, `Project: ${sample.project}`, 'Experience: Student project and coursework', 'Language: Vietnamese (native), English (intermediate)'];
    const bytes = makePdf(lines); const storageName = `${crypto.randomUUID()}.pdf`;
    fs.writeFileSync(path.join(cvDir, storageName), bytes, { flag: 'wx', mode: 0o600 });
    const fields = {};
    for (const [key, value] of Object.entries({ fullName: sample.name, email: sample.email, phone: user.profile.phone, skills: sample.skills, education: [{ school: sample.school, major: sample.major, gradYear: sample.year }], experiences: [{ title: sample.role, description: sample.project }] })) fields[key] = { value, confidence: 1, source: 'CV mẫu' };
    db.resumes.push({ id: crypto.randomUUID(), userId: user.id, originalName: `CV_${String(i + 1).padStart(2, '0')}_${sample.name.replace(/\s+/g, '_')}.pdf`, mimeType: 'application/pdf', bytes: bytes.length, storageName, sha256: crypto.createHash('sha256').update(bytes).digest('hex'), scanStatus: 'clean', status: 'confirmed', attempts: 1, isDefault: !db.resumes.some(cv => cv.userId === user.id && cv.isDefault), createdAt: iso(0), updatedAt: iso(0), parseResult: { fields, confidence: 1 }, extractedText: lines.join('\n'), demoSeed: seedTag });
    addedCvs++;
  }
  const temp = `${dbFile}.${process.pid}.tmp`;
  fs.writeFileSync(temp, `${JSON.stringify(db, null, 2)}\n`, { mode: 0o600 });
  fs.renameSync(temp, dbFile);
  console.log(`Đã thêm ${addedUsers} tài khoản, ${addedCompanies} doanh nghiệp, ${addedJobs} tin tuyển dụng và ${addedCvs} CV mẫu.`);
  console.log(`Tài khoản demo đều dùng mật khẩu: ${password}`);
  console.log('Sinh viên: student01@example.test đến student15@example.test; nhà tuyển dụng: employer01@example.test đến employer15@example.test.');
}

main();
