# Panduan Penggunaan & Dokumentasi Teknis — RuangKelas (Mini LMS)

Dokumentasi ini menjelaskan cara penggunaan, alur kerja (*user flow*), serta arsitektur teknis dari **RuangKelas (Mini LMS)** versi **Fullstack Standalone** berbasis Next.js yang dapat langsung di-deploy ke Vercel tanpa server backend eksternal.

---

## 1. Akun & Role yang Tersedia

Aplikasi menyediakan akun demo bawaan serta fitur registrasi langsung melalui tab **Daftar (Register)** pada halaman utama.

| Role | Akun Demo Bawaan | Hak Akses di UI |
|---|---|---|
| **`mahasiswa`** | `mahasiswa` / `mahasiswa123` | Melihat daftar mata kuliah, melihat tugas, mengunggah & mengumpulkan berkas tugas, melihat status pengumpulan miliknya, dan membaca notifikasi. |
| **`dosen`** | `dosen` / `dosen123` | Semua akses mahasiswa + **Tambah Mata Kuliah**, **Buat Tugas**, dan melihat seluruh daftar pengumpulan mahasiswa pada setiap tugas. |
| **`admin`** | `admin` / `admin123` | Semua akses dosen + melihat tab **Status Layanan (Observability)**. |

---

## 2. Alur Penggunaan (User Flow)

### A. Alur Dosen (Mengelola Kelas & Tugas)
1. **Registrasi & Login**:
   - Buka aplikasi → pilih tab **Daftar** (atau langsung **Masuk** dengan akun demo `dosen` / `dosen123`).
   - Isi **Nama lengkap**, **Nama pengguna**, **Kata sandi**, dan pilih peran **Dosen** → klik **Buat akun**.
2. **Membuat Mata Kuliah**:
   - Di tab **Mata Kuliah**, isi form **Tambah Mata Kuliah** (*Kode*, *Nama kelas*, dan *Deskripsi* opsional).
   - Klik **Tambah kelas**. Mata kuliah baru akan muncul di daftar kelas.
3. **Membuat Tugas**:
   - Buka tab **Tugas & Pengumpulan**.
   - Pada form **Buat Tugas**, pilih mata kuliah, isi *Judul tugas*, *Batas pengumpulan*, dan *Deskripsi* → klik **Buat tugas**.
4. **Memantau Pengumpulan Mahasiswa**:
   - Pilih mata kuliah pada dropdown **Pilih Mata Kuliah**.
   - Setiap kartu tugas menampilkan badge jumlah pengumpulan (`N pengumpulan`) beserta daftar berkas yang dikumpulkan mahasiswa.

### B. Alur Mahasiswa (Melihat & Mengumpulkan Tugas)
1. **Registrasi & Login**:
   - Buka aplikasi → pilih tab **Daftar** → buat akun dengan peran **Mahasiswa** (atau masuk dengan `mahasiswa` / `mahasiswa123`).
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
[Vercel: Next.js Fullstack App (web/)]
  ├── UI (App Router, Tailwind CSS, Lucide Icons)
  └── Next.js API Route Handlers (/api/*)
        ├── /api/auth/*          ──▶ Login, Register, Me (HMAC-SHA256 Token)
        ├── /api/courses         ──▶ Manajemen Mata Kuliah
        ├── /api/assignments     ──▶ Manajemen Tugas
        ├── /api/course-summary  ──▶ Ringkasan Kelas & Tugas
        ├── /api/upload          ──▶ Simpan berkas sementara ke /tmp
        ├── /api/submissions     ──▶ Catat pengumpulan & buat notifikasi
        ├── /api/notifications   ──▶ Baca & tandai notifikasi
        └── /api/monitoring      ──▶ Status kesehatan layanan bawaan
```

### Komponen Utama
1. **Frontend (`src/app/page.tsx`)**:
   - Dibangun dengan **Next.js (App Router)**, **TypeScript**, dan **Tailwind CSS**.
   - Menyimpan token di `localStorage` (`mini-lms-token`) dan mengirimkannya pada header `Authorization: Bearer <token>` di setiap request (`src/lib/api.ts`).
2. **In-Memory Store & Auth (`src/lib/store.ts`)**:
   - Menyimpan data runtime pada `globalThis` dengan data awal (*seed*) otomatis saat aplikasi dimulai.
   - Menggunakan token bertanda tangan **HMAC-SHA256** (`AUTH_SECRET`) yang bersifat *stateless*, sehingga sesi login tetap valid di lingkungan serverless Vercel.
3. **Upload Berkas (`src/app/api/upload/route.ts`)**:
   - Menerima `FormData` (`file` dan `assignment_id`), melakukan sanitasi nama berkas, menyimpan berkas sementara di `/tmp/mini-lms-uploads/` (kompatibel dengan Vercel Serverless), lalu mengembalikan `file_name` dan `file_path` untuk dikirim ke `POST /api/submissions`.

> **Catatan Serverless:** Karena penyimpanan data menggunakan in-memory store (`globalThis`) dan berkas disimpan di `/tmp`, data baru yang dibuat saat runtime bersifat sementara dan akan kembali ke data awal (*seed*) jika serverless function mengalami *cold start*.

---

## 4. Menjalankan & Deployment

### Menjalankan Secara Lokal
```bash
npm install
npm run dev
```
Aplikasi berjalan di `http://localhost:3000`.

### Deploy ke Vercel
1. Push repository ini ke GitHub/GitLab/Bitbucket.
2. Import project di Vercel (Root Directory mengarah ke folder project ini).
3. *(Opsional)* Tambahkan Environment Variable `AUTH_SECRET` dengan string acak di Vercel Project Settings.
4. Klik **Deploy**. Tidak diperlukan `API_GATEWAY_URL` atau server backend terpisah.
