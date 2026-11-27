# Panduan Penggunaan & Dokumentasi Teknis — RuangKelas (Mini LMS)

Dokumentasi ini menjelaskan cara penggunaan, alur kerja (*user flow*), serta arsitektur teknis dari **RuangKelas (Mini LMS)** yang di-host di Vercel dan terhubung ke backend microservices `mini-lms-platform`.

---

## 1. Akun & Role yang Tersedia

Backend `mini-lms-platform` menggunakan penyimpanan JSON lokal pada Docker volumes. Akun baru dapat dibuat langsung melalui tab **Daftar (Register)** pada halaman utama.

| Role | Cara Mendapatkan Akun | Hak Akses di UI |
|---|---|---|
| **`mahasiswa`** | Pilih **Mahasiswa** pada form **Daftar** | Melihat daftar mata kuliah, melihat tugas, mengunggah & mengumpulkan berkas tugas, melihat status pengumpulan miliknya, dan membaca notifikasi. |
| **`dosen`** | Pilih **Dosen** pada form **Daftar** | Semua akses mahasiswa + **Tambah Mata Kuliah**, **Buat Tugas**, dan melihat seluruh daftar pengumpulan mahasiswa pada setiap tugas. |
| **`admin`** | Didaftarkan/diubah manual pada data `auth` service (`role: "admin"`) | Semua akses dosen + melihat tab **Status Layanan (Observability)** dari Monitoring Service. |

---

## 2. Alur Penggunaan (User Flow)

### A. Alur Dosen (Mengelola Kelas & Tugas)
1. **Registrasi & Login**:
   - Buka aplikasi → pilih tab **Daftar**.
   - Isi **Nama lengkap**, **Nama pengguna**, **Kata sandi** (minimal 6 karakter), dan pilih peran **Dosen** → klik **Buat akun**.
   - Pindah ke tab **Masuk** dan login dengan akun tersebut.
2. **Membuat Mata Kuliah**:
   - Di tab **Mata Kuliah**, isi form **Tambah Mata Kuliah** (*Kode*, *Nama kelas*, dan *Deskripsi* opsional).
   - Klik **Tambah kelas**. Mata kuliah baru akan muncul di daftar kelas.
3. **Membuat Tugas**:
   - Buka tab **Tugas & Pengumpulan**.
   - Pada form **Buat Tugas**, pilih mata kuliah, isi *Judul tugas*, *Batas pengumpulan*, dan *Deskripsi* → klik **Buat tugas**.
4. **Memantau Pengumpulan Mahasiswa**:
   - Pilih mata kuliah pada dropdown **Pilih Mata Kuliah**.
   - Setiap kartu tugas menampilkan badge jumlah pengumpulan (`N pengumpulan`) beserta daftar berkas yang dikumpulkan mahasiswa (`file_name`, `user_id`, dan waktu pengumpulan).

### B. Alur Mahasiswa (Melihat & Mengumpulkan Tugas)
1. **Registrasi & Login**:
   - Buka aplikasi → pilih tab **Daftar** → buat akun dengan peran **Mahasiswa** → lalu **Masuk**.
2. **Melihat Tugas**:
   - Di tab **Mata Kuliah**, klik **Lihat tugas →** pada kelas yang ingin dibuka (atau buka tab **Tugas & Pengumpulan** dan pilih mata kuliah).
3. **Mengumpulkan Tugas**:
   - Pada form **Kumpulkan Tugas**, pilih tugas dari dropdown.
   - Klik area upload untuk memilih berkas (PDF, DOCX, ZIP, gambar, dll.).
   - Klik **Kirim pengumpulan**.
   - Status pada kartu tugas otomatis berubah dari **`Belum dikumpulkan`** menjadi **`✓ Sudah dikumpulkan`** beserta nama berkas dan waktu pengumpulan.
4. **Membaca Notifikasi**:
   - Buka tab **Notifikasi** untuk melihat kabar terbaru dan klik **Tandai dibaca** untuk menandai notifikasi.

---

## 3. Arsitektur & Penjelasan Teknis

```text
[Browser / Mobile]
        │
        ▼
[Vercel: Next.js App (web/)]
  ├── UI (App Router, Tailwind CSS, Lucide Icons)
  ├── /api/upload  ──▶ Menyimpan berkas fisik sementara ke /tmp
  └── /api/:path*  ──▶ Next.js Rewrites (Proxy bebas CORS)
                            │
                            ▼ (API_GATEWAY_URL)
                  [Codespaces / Server: Port 8101]
                            │
                     [API Gateway]
          ┌─────────┬───────┴───────┬──────────────┐
          ▼         ▼               ▼              ▼
     [Auth:8102] [Course:8103] [Assignment:8104] [Submission:8105]
     [Notif:8106] [Monitoring:8107] [Platform API / Summary:8110]
```

### Komponen Utama
1. **Frontend (`web/src/app/page.tsx`)**:
   - Dibangun dengan **Next.js (App Router)**, **TypeScript**, dan **Tailwind CSS** (mendukung tampilan desktop dan *mobile-friendly*).
   - Menyimpan JWT token di `localStorage` (`mini-lms-token`) dan mengirimkannya pada header `Authorization: Bearer <token>` serta `X-Request-ID` di setiap request (`web/src/lib/api.ts`).
2. **API Proxy (`web/next.config.ts`)**:
   - Menggunakan fitur `rewrites()` Next.js untuk meneruskan `/api/:path*` ke `process.env.API_GATEWAY_URL` (default `http://localhost:8101`).
   - Menghindari masalah **CORS** di browser dan memudahkan pergantian alamat backend melalui Environment Variables di Vercel.
3. **Upload Berkas (`web/src/app/api/upload/route.ts`)**:
   - Menerima `FormData` (`file` dan `assignment_id`), melakukan sanitasi nama berkas agar sesuai aturan validasi backend, menyimpan berkas sementara di `/tmp/mini-lms-uploads/` (kompatibel dengan Vercel Serverless), lalu mengembalikan `file_name` dan `file_path` untuk dikirim ke `POST /api/submissions`.
4. **Agregasi Ringkasan (`GET /api/course-summary/{course_id}`)**:
   - Mengambil daftar tugas beserta array `submissions` di dalam masing-masing tugas (`assignments[].submissions`) dari Platform API (`8110`), yang otomatis memfilter data sesuai role pengguna.

---

## 4. Penjelasan Teknis Backend (`mini-lms-platform`)

Backend `mini-lms-platform` dibangun dengan arsitektur **microservices terdistribusi** yang dijalankan menggunakan **Docker Compose** (8 container). Seluruh service saling berkomunikasi melalui jaringan internal Docker menggunakan registry pada `config/services.json`.

### Daftar Service & Port

| Service | Port | Repo Sumber | Fungsi Utama |
|---|---|---|---|
| **API Gateway** | `8101` | `API-GATEWAY-KLP5` | Pintu masuk tunggal (*single entry point*) yang meneruskan semua request `/api/*` ke service terkait. |
| **Authentication** | `8102` | `mini-lms-auth-service` | Mengelola registrasi, login, validasi JWT token, dan data peran (`mahasiswa`, `dosen`, `admin`). |
| **Course** | `8103` | `mini-lms-course-service-kelompok-3` | Mengelola daftar dan pembuatan mata kuliah (`/api/courses`). |
| **Assignment** | `8104` | `mini-lms-assignment-service` | Mengelola daftar dan pembuatan tugas per mata kuliah (`/api/assignments`). |
| **Submission** | `8105` | `Submission-File-Kelompok-4` | Mencatat pengumpulan tugas (metadata `file_name` & `file_url`) dan memicu notifikasi (`/api/submissions`). |
| **Notification** | `8106` | `kelompok-2-notification` | Menyimpan dan mengelola status baca notifikasi pengguna (`/api/notifications`). |
| **Monitoring** | `8107` | `monitoring/` (lokal) | Memeriksa kesehatan (*health check*) seluruh service (`/api/monitoring/services`). |
| **Platform API** | `8110` | `platform-api/` (lokal) | Menggabungkan data Course, Assignment, Submission, dan Notification pada `/api/course-summary/{course_id}`. |

### Penyimpanan & Keamanan
- **Penyimpanan Data**: Menggunakan file **JSON** yang disimpan pada **Docker named volumes** (bukan database relasional eksternal), sehingga data tetap bertahan saat container di-restart (`docker compose down`), namun ditujukan untuk skala demonstrasi/lokal.
- **Autentikasi**: Menggunakan **JWT (`JWT_SECRET` di `.env`)** yang diverifikasi oleh Auth Service dan diteruskan melalui header `Authorization: Bearer <token>`.

---

## 5. Menjalankan & Deployment

### Menjalankan Secara Lokal
1. Jalankan backend `mini-lms-platform`:
   ```bash
   cd mini-lms-platform
   cp .env.example .env
   # Pastikan JWT_SECRET di .env sudah diisi
   docker compose up --build -d
   ```
2. Jalankan frontend `web/`:
   ```bash
   cd web
   npm install
   npm run dev
   ```
   Buka `http://localhost:3000`.

### Deployment ke Vercel (dengan Backend di Codespaces / VPS)
1. Pastikan backend berjalan (`docker compose up -d`) dan port **`8101`** (API Gateway) berstatus **Public**.
2. Di **Vercel → Project Settings → Environment Variables**, tambahkan:
   - **Name**: `API_GATEWAY_URL`
   - **Value**: URL publik port `8101` (contoh: `https://xxxx-8101.app.github.dev`, tanpa `/` di akhir).
3. Klik **Deploy** / **Redeploy**.
