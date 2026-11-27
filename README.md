# RuangKelas — Mini LMS (Fullstack Next.js)

Aplikasi **Mini LMS** berbasis **Next.js (App Router)** yang berjalan secara **fullstack standalone** (Frontend + API Routes dalam satu aplikasi) sehingga dapat langsung di-deploy ke **Vercel** tanpa server backend eksternal.

## Fitur Utama
- **Autentikasi & Role (`mahasiswa`, `dosen`, `admin`)**: Registrasi, login, dan sesi berbasis token HMAC-SHA256 stateless (`/api/auth/*`).
- **Manajemen Mata Kuliah**: Lihat daftar mata kuliah & tambah mata kuliah oleh dosen/admin (`/api/courses`).
- **Tugas & Pengumpulan**: Buat tugas, lihat ringkasan mata kuliah, unggah berkas ke `/tmp`, dan catat pengumpulan tugas (`/api/assignments`, `/api/upload`, `/api/submissions`).
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
3. *(Opsional)* Tambahkan Environment Variable `AUTH_SECRET` berisi string acak.
4. Klik **Deploy**.

Untuk dokumentasi lengkap alur penggunaan dan arsitektur teknis, lihat [PANDUAN.md](./PANDUAN.md).
