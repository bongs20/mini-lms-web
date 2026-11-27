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
        ├── /api/courses         ──▶ Manajemen & penghapusan kelas di Vercel Blob
        ├── /api/assignments     ──▶ Manajemen & penghapusan tugas di Vercel Blob
        ├── /api/course-summary  ──▶ Ringkasan Kelas & Tugas
        ├── /api/submissions     ──▶ Simpan berkas privat + metadata ke Vercel Blob
        ├── /api/submissions/[id]/file ──▶ Unduh berkas dengan autentikasi
        ├── /api/notifications   ──▶ Baca & tandai notifikasi
        └── /api/monitoring      ──▶ Status kesehatan layanan bawaan
```

### Komponen Utama
1. **Frontend (`src/app/page.tsx`)**:
   - Dibangun dengan **Next.js (App Router)**, **TypeScript**, dan **Tailwind CSS**.
   - Menyimpan token di `localStorage` (`mini-lms-token`) dan mengirimkannya pada header `Authorization: Bearer <token>` di setiap request (`src/lib/api.ts`).
2. **Store & Auth (`src/lib/store.ts`)**:
   - Akun demo tersedia sebagai seed lokal. Akun hasil registrasi dan hash password disimpan sebagai rekaman privat di Vercel Blob dengan kunci username yang di-hash, sehingga login tetap bekerja lintas cold start dan instance.
   - Kursus dan tugas baru juga disimpan per rekaman di private Vercel Blob. Token login tetap bertanda tangan **HMAC-SHA256** (`AUTH_SECRET`) dan bersifat *stateless*.
3. **Pengumpulan Berkas (`src/app/api/submissions/route.ts`)**:
   - Menerima berkas dan `assignment_id` dalam satu request, lalu menyimpan berkas dan rekaman metadata terpisah di private Vercel Blob. Setiap pengumpulan memiliki rekaman unik sehingga cold start dan instance serverless berbeda tidak menghapus atau menimpa data satu sama lain.
   - Dosen/admin melihat nama pengumpul, nama berkas, waktu, dan dapat mengunduh berkas melalui route yang memeriksa autentikasi.
   - Dosen/admin dapat menghapus pengumpulan atau tugas. Penghapusan tugas menghapus semua pengumpulan dan berkasnya; penghapusan mata kuliah menghapus seluruh tugas dan pengumpulan terkait. Konfirmasi UI menjelaskan cakupan penghapusan dan penanda penghapusan mencegah data seed muncul kembali setelah cold start.

> **Catatan konfigurasi:** Hubungkan private Blob store ke project Vercel untuk setiap environment yang digunakan. Aplikasi memakai OIDC Vercel atau `BLOB_READ_WRITE_TOKEN` lokal. Registrasi, kursus, tugas, dan pengumpulan memerlukan Blob; jika belum tersedia, perubahan ditolak dengan error yang jelas. Upload melalui route server dibatasi 4 MB. Akun yang sebelumnya hanya tersimpan di memori serverless dan berkas lama di `/tmp` tidak dapat dipulihkan otomatis.

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
3. Hubungkan private Vercel Blob store ke project, termasuk environment Development, Preview, dan Production (`BLOB_STORE_ID` dan OIDC dikelola Vercel).
4. *(Opsional)* Tambahkan Environment Variable `AUTH_SECRET` dengan string acak di Vercel Project Settings.
5. Klik **Deploy**. Tidak diperlukan `API_GATEWAY_URL` atau server backend terpisah.
