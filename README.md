# RuangKelas — Mini LMS (Fullstack Next.js)

Aplikasi **Mini LMS** berbasis **Next.js (App Router)** yang berjalan secara **fullstack standalone** (Frontend + API Routes dalam satu aplikasi) sehingga dapat langsung di-deploy ke **Vercel** tanpa server backend eksternal.

## Fitur Utama
- **Autentikasi & Role (`mahasiswa`, `dosen`, `admin`)**: Akun registrasi disimpan privat di Vercel Blob, dengan sesi berbasis token HMAC-SHA256 (`/api/auth/*`).
- **Manajemen Mata Kuliah**: Lihat daftar mata kuliah & tambah mata kuliah oleh dosen/admin (`/api/courses`).
- **Tugas & Pengumpulan**: Simpan kelas, tugas, berkas, dan rekaman pengumpulan secara persisten di Vercel Blob (`/api/courses`, `/api/assignments`, `/api/submissions`).
- **Notifikasi & Monitoring**: Notifikasi otomatis saat registrasi/pengumpulan tugas (`/api/notifications`) dan status layanan bawaan (`/api/monitoring/services`).

## Akun Demo Bawaan
- **Mahasiswa**: `mahasiswa` / `mahasiswa123`
- **Dosen**: `dosen` / `dosen123`
- **Admin**: `admin` / `admin123`

## Menjalankan Secara Lokal

```bash
npm install
npm run dev
```

Buka [http://localhost:3000](http://localhost:3000) di browser.

## Deploy ke Vercel
1. Push repository ini ke GitHub/GitLab/Bitbucket.
2. Import project di [Vercel](https://vercel.com/new).
3. Hubungkan **private Vercel Blob store** ke project dan aktifkan environment Development, Preview, dan Production. Pastikan `BLOB_STORE_ID` dan `VERCEL_OIDC_TOKEN` tersedia (atau gunakan `BLOB_READ_WRITE_TOKEN` untuk local development).
4. *(Opsional)* Tambahkan Environment Variable `AUTH_SECRET` berisi string acak.
5. Klik **Deploy**.

Untuk dokumentasi lengkap alur penggunaan dan arsitektur teknis, lihat [PANDUAN.md](./PANDUAN.md).
