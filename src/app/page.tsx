"use client";

import React, { useEffect, useState, useCallback } from "react";
import {
  BookOpen,
  CheckCircle2,
  ClipboardList,
  Bell,
  Activity,
  LogOut,
  Plus,
  RefreshCw,
  Send,
  AlertCircle,
  GraduationCap,
} from "lucide-react";
import {
  apiFetch,
  getToken,
  setToken,
  type User,
  type Course,
  type Assignment,
  type Submission,
  type NotificationItem,
  type ServiceHealth,
  type Role,
} from "@/lib/api";

export default function HomePage() {
  const [user, setUser] = useState<User | null>(null);
  const [loadingAuth, setLoadingAuth] = useState(true);
  const [authTab, setAuthTab] = useState<"login" | "register">("login");

  // Notice / Toast
  const [notice, setNotice] = useState<{
    message: string;
    type: "success" | "error";
  } | null>(null);

  // Workspace Data
  const [activeTab, setActiveTab] = useState<
    "courses" | "assignments" | "notifications" | "monitoring"
  >("courses");
  const [courses, setCourses] = useState<Course[]>([]);
  const [selectedCourseId, setSelectedCourseId] = useState<string>("");
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [services, setServices] = useState<ServiceHealth[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  // Forms
  const [loginForm, setLoginForm] = useState({ username: "", password: "" });
  const [registerForm, setRegisterForm] = useState({
    name: "",
    username: "",
    password: "",
    role: "mahasiswa" as Role,
  });
  const [courseForm, setCourseForm] = useState({
    code: "",
    name: "",
    description: "",
  });
  const [assignmentForm, setAssignmentForm] = useState({
    course_id: "",
    title: "",
    due_date: "",
    description: "",
  });
  const [submissionForm, setSubmissionForm] = useState({
    assignment_id: "",
    file_name: "",
    file_path: "",
  });
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const isInstructor = user?.role === "dosen" || user?.role === "admin";
  const isAdmin = user?.role === "admin";

  const showNotice = useCallback(
    (message: string, type: "success" | "error" = "success") => {
      setNotice({ message, type });
      setTimeout(() => setNotice(null), 5000);
    },
    []
  );

  const loadWorkspaceData = useCallback(async (currentUser: User) => {
    setRefreshing(true);
    try {
      const [coursesRes, notifRes, monRes] = await Promise.allSettled([
        apiFetch<{ courses?: Course[] }>("/api/courses"),
        apiFetch<{ notifications?: NotificationItem[] }>(
          `/api/notifications?user_id=${encodeURIComponent(currentUser.id)}`
        ),
        apiFetch<{ services?: ServiceHealth[] }>("/api/monitoring/services"),
      ]);

      if (coursesRes.status === "fulfilled") {
        setCourses(coursesRes.value.courses || []);
      }
      if (notifRes.status === "fulfilled") {
        setNotifications(notifRes.value.notifications || []);
      }
      if (monRes.status === "fulfilled") {
        setServices(monRes.value.services || []);
      }
    } finally {
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    const token = getToken();
    if (!token) {
      Promise.resolve().then(() => setLoadingAuth(false));
      return;
    }
    apiFetch<{ user?: User }>("/api/auth/me")
      .then((data) => {
        if (data.user) {
          setUser(data.user);
          loadWorkspaceData(data.user);
        }
      })
      .catch(() => {
        setToken(null);
      })
      .finally(() => {
        setLoadingAuth(false);
      });
  }, [loadWorkspaceData]);

  const loadCourseDetails = useCallback(
    async (courseId: string) => {
      if (!courseId) {
        setAssignments([]);
        setSubmissions([]);
        return;
      }
      try {
        const [asgRes, sumRes] = await Promise.all([
          apiFetch<{ assignments?: Assignment[] }>(
            `/api/assignments?course_id=${encodeURIComponent(courseId)}`
          ),
          apiFetch<{
            assignments?: Array<Assignment & { submissions?: Submission[] }>;
          }>(`/api/course-summary/${encodeURIComponent(courseId)}`),
        ]);
        setAssignments(asgRes.assignments || []);
        const allSubs: Submission[] = (sumRes.assignments || []).flatMap(
          (asg) =>
            (asg.submissions || []).map((sub) => ({
              ...sub,
              assignment_id: sub.assignment_id || asg.id,
            }))
        );
        setSubmissions(allSubs);
      } catch (err: unknown) {
        showNotice(
          err instanceof Error ? err.message : "Gagal memuat tugas.",
          "error"
        );
      }
    },
    [showNotice]
  );

  useEffect(() => {
    if (!selectedCourseId) return;
    let cancelled = false;
    (async () => {
      if (!cancelled) {
        await loadCourseDetails(selectedCourseId);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [selectedCourseId, loadCourseDetails]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const data = await apiFetch<{ token: string; user: User }>(
        "/api/auth/login",
        { method: "POST", body: loginForm }
      );
      setToken(data.token);
      setUser(data.user);
      showNotice("Berhasil masuk ke RuangKelas.", "success");
      loadWorkspaceData(data.user);
    } catch (err: unknown) {
      showNotice(
        err instanceof Error ? err.message : "Gagal masuk.",
        "error"
      );
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await apiFetch("/api/auth/register", {
        method: "POST",
        body: registerForm,
      });
      showNotice("Akun berhasil dibuat! Silakan masuk.", "success");
      setAuthTab("login");
      setLoginForm({ username: registerForm.username, password: "" });
    } catch (err: unknown) {
      showNotice(
        err instanceof Error ? err.message : "Gagal mendaftar.",
        "error"
      );
    }
  };

  const handleLogout = () => {
    setToken(null);
    setUser(null);
    setCourses([]);
    setAssignments([]);
    setNotifications([]);
    setServices([]);
  };

  const handleCreateCourse = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await apiFetch("/api/courses", { method: "POST", body: courseForm });
      setCourseForm({ code: "", name: "", description: "" });
      showNotice("Mata kuliah berhasil ditambahkan.", "success");
      if (user) loadWorkspaceData(user);
    } catch (err: unknown) {
      showNotice(
        err instanceof Error ? err.message : "Gagal menambah mata kuliah.",
        "error"
      );
    }
  };

  const handleCreateAssignment = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await apiFetch("/api/assignments", {
        method: "POST",
        body: assignmentForm,
      });
      setAssignmentForm({
        course_id: assignmentForm.course_id,
        title: "",
        due_date: "",
        description: "",
      });
      showNotice("Tugas berhasil dibuat.", "success");
      if (selectedCourseId === assignmentForm.course_id) {
        const data = await apiFetch<{ assignments?: Assignment[] }>(
          `/api/assignments?course_id=${encodeURIComponent(selectedCourseId)}`
        );
        setAssignments(data.assignments || []);
      }
    } catch (err: unknown) {
      showNotice(
        err instanceof Error ? err.message : "Gagal membuat tugas.",
        "error"
      );
    }
  };

  const handleSubmitAssignment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedFile) {
      showNotice("Pilih berkas terlebih dahulu.", "error");
      return;
    }
    setIsSubmitting(true);
    try {
      const formData = new FormData();
      formData.append("file", selectedFile);
      formData.append("assignment_id", submissionForm.assignment_id);

      const subRes = await apiFetch<{ submission?: Submission }>(
        "/api/submissions",
        {
          method: "POST",
          body: formData,
        }
      );

      const submission = subRes.submission;
      if (!submission) {
        throw new Error("Server tidak mengembalikan rekaman pengumpulan.");
      }
      setSubmissions((prev) => [...prev, submission]);

      setSubmissionForm({ assignment_id: "", file_name: "", file_path: "" });
      setSelectedFile(null);
      showNotice("Berkas berhasil diunggah dan tugas dikumpulkan.", "success");
    } catch (err: unknown) {
      showNotice(
        err instanceof Error ? err.message : "Gagal mengumpulkan tugas.",
        "error"
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDownloadSubmission = async (
    event: React.MouseEvent<HTMLAnchorElement>,
    submission: Submission
  ) => {
    event.preventDefault();
    const token = getToken();
    if (!token) {
      showNotice("Silakan masuk kembali untuk mengunduh berkas.", "error");
      return;
    }

    try {
      const response = await fetch(submission.file_path, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!response.ok) {
        let message = `Gagal mengunduh berkas (${response.status}).`;
        try {
          const payload = (await response.json()) as {
            error?: { message?: string };
          };
          message = payload.error?.message || message;
        } catch {
          // Use the status-based message when the server response isn't JSON.
        }
        throw new Error(message);
      }

      const objectUrl = URL.createObjectURL(await response.blob());
      const link = document.createElement("a");
      link.href = objectUrl;
      link.download = submission.file_name;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
    } catch (err: unknown) {
      showNotice(
        err instanceof Error ? err.message : "Gagal mengunduh berkas.",
        "error"
      );
    }
  };

  const handleMarkRead = async (id: string) => {
    try {
      await apiFetch(`/api/notifications/${encodeURIComponent(id)}/read`, {
        method: "PATCH",
      });
      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, read: true } : n))
      );
    } catch (err: unknown) {
      showNotice(
        err instanceof Error ? err.message : "Gagal memperbarui notifikasi.",
        "error"
      );
    }
  };

  if (loadingAuth) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 text-slate-600">
        <RefreshCw className="w-6 h-6 animate-spin mr-2 text-indigo-600" />
        Memuat RuangKelas...
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans">
      {/* Topbar */}
      <header className="sticky top-0 z-30 bg-white/80 backdrop-blur-md border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-indigo-600 text-white flex items-center justify-center font-bold text-lg shadow-sm">
              R
            </div>
            <span className="text-xl font-bold tracking-tight text-slate-900">
              ruang<span className="text-indigo-600">kelas</span>
            </span>
          </div>

          {user && (
            <div className="flex items-center gap-2 sm:gap-4">
              <div className="flex items-center gap-1.5 sm:gap-2 px-2.5 sm:px-3 py-1.5 rounded-full bg-slate-100 text-xs sm:text-sm">
                <GraduationCap className="w-4 h-4 text-indigo-600 shrink-0" />
                <span className="font-medium max-w-[100px] sm:max-w-none truncate">
                  {user.name || user.username}
                </span>
                <span className="text-[11px] sm:text-xs px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-700 capitalize font-semibold">
                  {user.role}
                </span>
              </div>
              <button
                onClick={handleLogout}
                className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-600 hover:text-rose-600 transition-colors cursor-pointer"
              >
                <LogOut className="w-4 h-4" />
                <span>Keluar</span>
              </button>
            </div>
          )}
        </div>
      </header>

      {/* Notice Banner */}
      {notice && (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-4">
          <div
            className={`flex items-center gap-2.5 px-4 py-3 rounded-xl text-sm font-medium border ${
              notice.type === "error"
                ? "bg-rose-50 text-rose-800 border-rose-200"
                : "bg-emerald-50 text-emerald-800 border-emerald-200"
            }`}
          >
            {notice.type === "error" ? (
              <AlertCircle className="w-4 h-4 shrink-0" />
            ) : (
              <CheckCircle2 className="w-4 h-4 shrink-0" />
            )}
            <span>{notice.message}</span>
          </div>
        </div>
      )}

      {/* Auth View */}
      {!user ? (
        <main className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-12 lg:py-20 grid lg:grid-cols-2 gap-12 items-center">
          <div className="space-y-6">
            <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-50 text-indigo-700 text-xs font-semibold tracking-wide uppercase">
              Mini Learning Management System
            </span>
            <h1 className="text-4xl sm:text-5xl font-extrabold tracking-tight text-slate-900 leading-tight">
              Belajar dan mengajar,{" "}
              <span className="text-indigo-600">lebih terhubung.</span>
            </h1>
            <p className="text-lg text-slate-600 leading-relaxed">
              Satu ruang terpadu untuk mengelola mata kuliah, tugas,
              pengumpulan, notifikasi, dan pemantauan layanan terdistribusi.
            </p>
            <div className="flex items-center gap-2.5 text-sm text-slate-500 pt-2">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
              Terhubung melalui API Gateway Mini LMS
            </div>
          </div>

          <div className="bg-white rounded-2xl shadow-xl shadow-slate-200/60 border border-slate-200 p-6 sm:p-8">
            <div className="grid grid-cols-2 gap-2 p-1 bg-slate-100 rounded-xl mb-6">
              <button
                type="button"
                onClick={() => setAuthTab("login")}
                className={`py-2 text-sm font-semibold rounded-lg transition-all cursor-pointer ${
                  authTab === "login"
                    ? "bg-white text-slate-900 shadow-sm"
                    : "text-slate-500 hover:text-slate-700"
                }`}
              >
                Masuk
              </button>
              <button
                type="button"
                onClick={() => setAuthTab("register")}
                className={`py-2 text-sm font-semibold rounded-lg transition-all cursor-pointer ${
                  authTab === "register"
                    ? "bg-white text-slate-900 shadow-sm"
                    : "text-slate-500 hover:text-slate-700"
                }`}
              >
                Daftar
              </button>
            </div>

            {authTab === "login" ? (
              <form onSubmit={handleLogin} className="space-y-4">
                <div>
                  <h2 className="text-xl font-bold text-slate-900">
                    Masuk ke akunmu
                  </h2>
                  <p className="text-sm text-slate-500">
                    Gunakan username dan kata sandi yang terdaftar.
                  </p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Nama pengguna
                  </label>
                  <input
                    required
                    value={loginForm.username}
                    onChange={(e) =>
                      setLoginForm({ ...loginForm, username: e.target.value })
                    }
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none text-sm"
                    placeholder="contoh: budi"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Kata sandi
                  </label>
                  <input
                    type="password"
                    required
                    value={loginForm.password}
                    onChange={(e) =>
                      setLoginForm({ ...loginForm, password: e.target.value })
                    }
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none text-sm"
                    placeholder="••••••••"
                  />
                </div>
                <button
                  type="submit"
                  className="w-full py-2.5 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-sm transition-colors shadow-sm cursor-pointer"
                >
                  Masuk
                </button>
              </form>
            ) : (
              <form onSubmit={handleRegister} className="space-y-4">
                <div>
                  <h2 className="text-xl font-bold text-slate-900">
                    Buat akun baru
                  </h2>
                  <p className="text-sm text-slate-500">
                    Pilih peran sesuai kebutuhan belajarmu.
                  </p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Nama lengkap
                  </label>
                  <input
                    required
                    value={registerForm.name}
                    onChange={(e) =>
                      setRegisterForm({ ...registerForm, name: e.target.value })
                    }
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 focus:ring-2 focus:ring-indigo-500 outline-none text-sm"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Nama pengguna
                  </label>
                  <input
                    required
                    value={registerForm.username}
                    onChange={(e) =>
                      setRegisterForm({
                        ...registerForm,
                        username: e.target.value,
                      })
                    }
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 focus:ring-2 focus:ring-indigo-500 outline-none text-sm"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Kata sandi
                  </label>
                  <input
                    type="password"
                    required
                    minLength={6}
                    value={registerForm.password}
                    onChange={(e) =>
                      setRegisterForm({
                        ...registerForm,
                        password: e.target.value,
                      })
                    }
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 focus:ring-2 focus:ring-indigo-500 outline-none text-sm"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Peran
                  </label>
                  <select
                    value={registerForm.role}
                    onChange={(e) =>
                      setRegisterForm({
                        ...registerForm,
                        role: e.target.value as Role,
                      })
                    }
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 focus:ring-2 focus:ring-indigo-500 outline-none text-sm bg-white"
                  >
                    <option value="mahasiswa">Mahasiswa</option>
                    <option value="dosen">Dosen</option>
                  </select>
                </div>
                <button
                  type="submit"
                  className="w-full py-2.5 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-sm transition-colors shadow-sm cursor-pointer"
                >
                  Buat akun
                </button>
              </form>
            )}
          </div>
        </main>
      ) : (
        /* Workspace View */
        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold text-slate-900">
                Halo, {user.name || user.username} 👋
              </h1>
              <p className="text-slate-500 text-sm mt-1">
                Lanjutkan aktivitas belajarmu hari ini.
              </p>
            </div>
            <button
              onClick={async () => {
                await loadWorkspaceData(user);
                if (selectedCourseId) {
                  await loadCourseDetails(selectedCourseId);
                }
              }}
              disabled={refreshing}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-white border border-slate-200 hover:bg-slate-50 text-sm font-medium text-slate-700 shadow-sm transition-colors cursor-pointer self-start"
            >
              <RefreshCw
                className={`w-4 h-4 ${refreshing ? "animate-spin" : ""}`}
              />
              Muat ulang
            </button>
          </div>

          {/* Navigation Tabs */}
          <div className="flex overflow-x-auto gap-2 border-b border-slate-200 pb-3 -mx-4 px-4 sm:mx-0 sm:px-0 sm:flex-wrap">
            {[
              { id: "courses", label: "Mata Kuliah", icon: BookOpen },
              {
                id: "assignments",
                label: "Tugas & Pengumpulan",
                icon: ClipboardList,
              },
              { id: "notifications", label: "Notifikasi", icon: Bell },
              ...(isAdmin
                ? [{ id: "monitoring", label: "Status Layanan", icon: Activity }]
                : []),
            ].map((tab) => {
              const Icon = tab.icon;
              const active = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() =>
                    setActiveTab(
                      tab.id as
                        | "courses"
                        | "assignments"
                        | "notifications"
                        | "monitoring"
                    )
                  }
                  className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all cursor-pointer shrink-0 ${
                    active
                      ? "bg-indigo-600 text-white shadow-sm"
                      : "bg-white text-slate-600 hover:bg-slate-100 border border-slate-200"
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  {tab.label}
                </button>
              );
            })}
          </div>

          {/* Tab: Courses */}
          {activeTab === "courses" && (
            <div className="grid lg:grid-cols-3 gap-6">
              <div className={`${isInstructor ? "lg:col-span-2" : "lg:col-span-3"} space-y-4`}>
                <div className="flex items-center justify-between">
                  <h2 className="text-lg font-bold text-slate-900">
                    Daftar Mata Kuliah
                  </h2>
                  <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-indigo-50 text-indigo-700">
                    {courses.length} kelas
                  </span>
                </div>
                {courses.length === 0 ? (
                  <div className="bg-white rounded-2xl border border-dashed border-slate-300 p-8 text-center text-slate-500 text-sm">
                    Belum ada mata kuliah. Tambahkan kelas pertamamu.
                  </div>
                ) : (
                  <div className="grid sm:grid-cols-2 gap-4">
                    {courses.map((course) => (
                      <div
                        key={course.id}
                        className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm hover:shadow-md transition-shadow flex flex-col justify-between"
                      >
                        <div>
                          <span className="inline-block text-xs font-bold px-2.5 py-1 rounded-md bg-slate-100 text-slate-700 mb-2">
                            {course.code || course.id}
                          </span>
                          <h3 className="font-bold text-slate-900 text-base">
                            {course.name}
                          </h3>
                          <p className="text-sm text-slate-500 mt-1 line-clamp-2">
                            {course.description || "Belum ada deskripsi."}
                          </p>
                        </div>
                        <button
                          onClick={() => {
                            setSelectedCourseId(course.id);
                            setActiveTab("assignments");
                          }}
                          className="mt-4 text-sm font-semibold text-indigo-600 hover:text-indigo-700 text-left cursor-pointer"
                        >
                          Lihat tugas →
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {isInstructor && (
              <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm h-fit">
                <h3 className="font-bold text-slate-900 mb-4 flex items-center gap-2">
                  <Plus className="w-4 h-4 text-indigo-600" />
                  Tambah Mata Kuliah
                </h3>
                <form onSubmit={handleCreateCourse} className="space-y-3">
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">
                      Kode
                    </label>
                    <input
                      required
                      placeholder="SISTER-01"
                      value={courseForm.code}
                      onChange={(e) =>
                        setCourseForm({ ...courseForm, code: e.target.value })
                      }
                      className="w-full px-3 py-2 rounded-xl border border-slate-300 text-sm outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">
                      Nama kelas
                    </label>
                    <input
                      required
                      placeholder="Sistem Terdistribusi"
                      value={courseForm.name}
                      onChange={(e) =>
                        setCourseForm({ ...courseForm, name: e.target.value })
                      }
                      className="w-full px-3 py-2 rounded-xl border border-slate-300 text-sm outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">
                      Deskripsi
                    </label>
                    <input
                      placeholder="Deskripsi singkat (opsional)"
                      value={courseForm.description}
                      onChange={(e) =>
                        setCourseForm({
                          ...courseForm,
                          description: e.target.value,
                        })
                      }
                      className="w-full px-3 py-2 rounded-xl border border-slate-300 text-sm outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
                  <button
                    type="submit"
                    className="w-full py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold transition-colors cursor-pointer"
                  >
                    Tambah kelas
                  </button>
                </form>
              </div>
              )}
            </div>
          )}

          {/* Tab: Assignments */}
          {activeTab === "assignments" && (
            <div className="grid lg:grid-cols-3 gap-6">
              <div className="lg:col-span-2 space-y-4">
                <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
                  <label className="block text-sm font-semibold text-slate-700 mb-2">
                    Pilih Mata Kuliah
                  </label>
                  <select
                    value={selectedCourseId}
                    onChange={(e) => setSelectedCourseId(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm bg-white outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                    <option value="">-- Pilih mata kuliah --</option>
                    {courses.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.code} — {c.name}
                      </option>
                    ))}
                  </select>
                </div>

                {assignments.length === 0 ? (
                  <div className="bg-white rounded-2xl border border-dashed border-slate-300 p-8 text-center text-slate-500 text-sm">
                    {selectedCourseId
                      ? "Belum ada tugas pada mata kuliah ini."
                      : "Pilih mata kuliah untuk melihat daftar tugas."}
                  </div>
                ) : (
                  <div className="space-y-3">
                    {assignments.map((a) => {
                      const asgSubmissions = submissions.filter(
                        (s) => s.assignment_id === a.id
                      );
                      const isSubmitted = asgSubmissions.length > 0;
                      return (
                        <div
                          key={a.id}
                          className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm space-y-3"
                        >
                          <div className="flex items-start justify-between gap-4">
                            <div>
                              <h3 className="font-bold text-slate-900">
                                {a.title}
                              </h3>
                              <p className="text-sm text-slate-500 mt-1">
                                {a.description || "Tidak ada deskripsi."}
                              </p>
                            </div>
                            <div className="flex flex-col items-end gap-1.5 shrink-0">
                              {a.due_date && (
                                <span className="text-xs font-medium px-2.5 py-1 rounded-full bg-amber-50 text-amber-700">
                                  Batas:{" "}
                                  {Number.isNaN(Date.parse(a.due_date))
                                    ? a.due_date
                                    : new Date(a.due_date).toLocaleString("id-ID", {
                                        dateStyle: "medium",
                                        timeStyle: "short",
                                      })}
                                </span>
                              )}
                              {!isInstructor ? (
                                <span
                                  className={`text-xs font-semibold px-2.5 py-1 rounded-full ${
                                    isSubmitted
                                      ? "bg-emerald-50 text-emerald-700"
                                      : "bg-slate-100 text-slate-600"
                                  }`}
                                >
                                  {isSubmitted
                                    ? "✓ Sudah dikumpulkan"
                                    : "Belum dikumpulkan"}
                                </span>
                              ) : (
                                <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-indigo-50 text-indigo-700">
                                  {asgSubmissions.length} pengumpulan
                                </span>
                              )}
                            </div>
                          </div>

                          {isSubmitted && (
                            <div className="pt-2 border-t border-slate-100 space-y-1.5">
                              {asgSubmissions.map((s) => (
                                <div
                                  key={s.id}
                                  className="text-xs text-slate-600 flex items-center justify-between bg-slate-50 px-3 py-2 rounded-lg"
                                >
                                  <span className="font-medium text-slate-800 truncate">
                                    <a
                                      href={s.file_path}
                                      onClick={(event) =>
                                        handleDownloadSubmission(event, s)
                                      }
                                      className="text-indigo-700 hover:underline"
                                    >
                                      📎 {s.file_name}
                                    </a>
                                    {isInstructor &&
                                      ` · ${s.user_name || s.user_id}`}
                                  </span>
                                  {s.submitted_at && (
                                    <span className="text-slate-400 shrink-0 ml-2">
                                      {new Date(s.submitted_at).toLocaleString(
                                        "id-ID"
                                      )}
                                    </span>
                                  )}
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              <div className="space-y-6">
                {isInstructor && (
                <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
                  <h3 className="font-bold text-slate-900 mb-4 flex items-center gap-2">
                    <Plus className="w-4 h-4 text-indigo-600" />
                    Buat Tugas
                  </h3>
                  <form onSubmit={handleCreateAssignment} className="space-y-3">
                    <select
                      required
                      value={assignmentForm.course_id}
                      onChange={(e) =>
                        setAssignmentForm({
                          ...assignmentForm,
                          course_id: e.target.value,
                        })
                      }
                      className="w-full px-3 py-2 rounded-xl border border-slate-300 text-sm bg-white outline-none focus:ring-2 focus:ring-indigo-500"
                    >
                      <option value="">Pilih mata kuliah</option>
                      {courses.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.code} — {c.name}
                        </option>
                      ))}
                    </select>
                    <input
                      required
                      placeholder="Judul tugas"
                      value={assignmentForm.title}
                      onChange={(e) =>
                        setAssignmentForm({
                          ...assignmentForm,
                          title: e.target.value,
                        })
                      }
                      className="w-full px-3 py-2 rounded-xl border border-slate-300 text-sm outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                    <input
                      type="date"
                      value={assignmentForm.due_date}
                      onChange={(e) =>
                        setAssignmentForm({
                          ...assignmentForm,
                          due_date: e.target.value,
                        })
                      }
                      className="w-full px-3 py-2 rounded-xl border border-slate-300 text-sm outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                    <input
                      placeholder="Deskripsi"
                      value={assignmentForm.description}
                      onChange={(e) =>
                        setAssignmentForm({
                          ...assignmentForm,
                          description: e.target.value,
                        })
                      }
                      className="w-full px-3 py-2 rounded-xl border border-slate-300 text-sm outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                    <button
                      type="submit"
                      className="w-full py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold transition-colors cursor-pointer"
                    >
                      Buat tugas
                    </button>
                  </form>
                </div>
                )}

                <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
                  <h3 className="font-bold text-slate-900 mb-1 flex items-center gap-2">
                    <Send className="w-4 h-4 text-indigo-600" />
                    Kumpulkan Tugas
                  </h3>
                  <p className="text-xs text-slate-500 mb-4">
                    Pilih berkas tugas untuk dikumpulkan.
                  </p>
                  <form onSubmit={handleSubmitAssignment} className="space-y-3">
                    <select
                      required
                      value={submissionForm.assignment_id}
                      onChange={(e) =>
                        setSubmissionForm({
                          ...submissionForm,
                          assignment_id: e.target.value,
                        })
                      }
                      className="w-full px-3 py-2 rounded-xl border border-slate-300 text-sm bg-white outline-none focus:ring-2 focus:ring-indigo-500"
                    >
                      <option value="">Pilih tugas</option>
                      {assignments.map((a) => (
                        <option key={a.id} value={a.id}>
                          {a.title}
                        </option>
                      ))}
                    </select>
                    <label className="block border-2 border-dashed border-slate-300 hover:border-indigo-400 rounded-xl p-4 text-center cursor-pointer transition-colors bg-slate-50/50">
                      <input
                        type="file"
                        className="hidden"
                        onChange={(e) => {
                          const file = e.target.files?.[0] || null;
                          setSelectedFile(file);
                          setSubmissionForm((prev) => ({
                            ...prev,
                            file_name: file?.name || "",
                            file_path: "",
                          }));
                        }}
                      />
                      {selectedFile ? (
                        <div className="text-sm">
                          <p className="font-semibold text-indigo-600 truncate">
                            {selectedFile.name}
                          </p>
                          <p className="text-xs text-slate-500 mt-0.5">
                            {(selectedFile.size / 1024).toFixed(1)} KB · Klik untuk ganti berkas
                          </p>
                        </div>
                      ) : (
                        <div className="text-sm text-slate-500">
                          <p className="font-medium text-slate-700">
                            Klik untuk pilih berkas
                          </p>
                          <p className="text-xs mt-0.5">
                            PDF, DOCX, ZIP, atau gambar
                          </p>
                        </div>
                      )}
                    </label>
                    <button
                      type="submit"
                      disabled={!selectedFile || isSubmitting}
                      className="w-full py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 disabled:bg-slate-300 text-white text-sm font-semibold transition-colors cursor-pointer flex items-center justify-center gap-2"
                    >
                      {isSubmitting ? (
                        <>
                          <span className="h-4 w-4 rounded-full border-2 border-white/30 border-t-white animate-spin" />
                          Mengunggah &amp; mengirim...
                        </>
                      ) : (
                        "Kirim pengumpulan"
                      )}
                    </button>
                  </form>
                </div>
              </div>
            </div>
          )}

          {/* Tab: Notifications */}
          {activeTab === "notifications" && (
            <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm space-y-4">
              <h2 className="text-lg font-bold text-slate-900">Notifikasi</h2>
              {notifications.length === 0 ? (
                <p className="text-sm text-slate-500">
                  Belum ada notifikasi terbaru.
                </p>
              ) : (
                <div className="divide-y divide-slate-100">
                  {notifications.map((n) => (
                    <div
                      key={n.id}
                      className="py-3 flex items-center justify-between gap-4"
                    >
                      <p
                        className={`text-sm ${
                          n.read ? "text-slate-400" : "text-slate-800 font-medium"
                        }`}
                      >
                        {n.message}
                      </p>
                      {!n.read && (
                        <button
                          onClick={() => handleMarkRead(n.id)}
                          className="text-xs font-semibold text-indigo-600 hover:text-indigo-700 shrink-0 cursor-pointer"
                        >
                          Tandai dibaca
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Tab: Monitoring */}
          {activeTab === "monitoring" && isAdmin && (
            <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm space-y-4">
              <div>
                <h2 className="text-lg font-bold text-slate-900">
                  Status Layanan (Observability)
                </h2>
                <p className="text-sm text-slate-500">
                  Pemeriksaan health check dari Monitoring Service.
                </p>
              </div>
              {services.length === 0 ? (
                <p className="text-sm text-slate-500">
                  Data layanan belum tersedia. Pastikan backend API Gateway aktif.
                </p>
              ) : (
                <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {services.map((svc, idx) => {
                    const isUp =
                      svc.status?.toLowerCase() === "up" ||
                      svc.status?.toLowerCase() === "healthy" ||
                      svc.status?.toLowerCase() === "ok";
                    return (
                      <div
                        key={svc.name || idx}
                        className="p-4 rounded-xl border border-slate-200 flex items-center justify-between"
                      >
                        <div>
                          <p className="font-semibold text-sm text-slate-900 capitalize">
                            {svc.name || svc.url || `Service ${idx + 1}`}
                          </p>
                          {svc.latency_ms !== undefined && (
                            <p className="text-xs text-slate-500">
                              {svc.latency_ms} ms
                            </p>
                          )}
                        </div>
                        <span
                          className={`text-xs font-bold px-2.5 py-1 rounded-full ${
                            isUp
                              ? "bg-emerald-50 text-emerald-700"
                              : "bg-rose-50 text-rose-700"
                          }`}
                        >
                          {svc.status}
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </main>
      )}
    </div>
  );
}
