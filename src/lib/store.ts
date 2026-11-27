import crypto from "crypto";
import type {
  Assignment,
  Course,
  NotificationItem,
  Role,
  ServiceHealth,
  Submission,
  User,
} from "./api";

export interface StoredUser extends User {
  passwordHash: string;
}

interface StoreState {
  users: StoredUser[];
  courses: Course[];
  assignments: Assignment[];
  submissions: Submission[];
  notifications: NotificationItem[];
}

const AUTH_SECRET =
  process.env.AUTH_SECRET || "mini-lms-standalone-vercel-secret-key";

function hashPassword(password: string): string {
  return crypto.createHash("sha256").update(password).digest("hex");
}

function createInitialState(): StoreState {
  const users: StoredUser[] = [
    {
      id: "usr-mhs-1",
      name: "Budi Santoso",
      username: "mahasiswa",
      role: "mahasiswa",
      passwordHash: hashPassword("mahasiswa123"),
    },
    {
      id: "usr-dsn-1",
      name: "Dr. Siti Aminah",
      username: "dosen",
      role: "dosen",
      passwordHash: hashPassword("dosen123"),
    },
    {
      id: "usr-adm-1",
      name: "Admin Sistem",
      username: "admin",
      role: "admin",
      passwordHash: hashPassword("admin123"),
    },
  ];

  const courses: Course[] = [
    {
      id: "crs-1",
      code: "IF-301",
      name: "Arsitektur Perangkat Lunak",
      description:
        "Mempelajari desain sistem terdistribusi, microservices, dan pola arsitektur modern.",
    },
    {
      id: "crs-2",
      code: "IF-302",
      name: "Pemrograman Web Lanjut",
      description:
        "Pengembangan aplikasi web fullstack modern menggunakan Next.js, TypeScript, dan API Routes.",
    },
  ];

  const assignments: Assignment[] = [
    {
      id: "asg-1",
      course_id: "crs-1",
      title: "Tugas 1: Desain Arsitektur Fullstack",
      description: "Buat diagram arsitektur dan penjelasan komponen sistem.",
      due_date: new Date(Date.now() + 7 * 86400_000).toISOString(),
    },
    {
      id: "asg-2",
      course_id: "crs-2",
      title: "Tugas 1: Implementasi REST API",
      description: "Bangun endpoint API untuk manajemen mata kuliah dan tugas.",
      due_date: new Date(Date.now() + 5 * 86400_000).toISOString(),
    },
  ];

  const notifications: NotificationItem[] = [
    {
      id: "ntf-1",
      user_id: "usr-mhs-1",
      message: "Selamat datang di Mini LMS! Tugas baru tersedia di IF-301.",
      read: false,
      created_at: new Date().toISOString(),
    },
  ];

  return {
    users,
    courses,
    assignments,
    submissions: [],
    notifications,
  };
}

const globalForStore = globalThis as unknown as {
  __miniLmsStore?: StoreState;
};

export function getStore(): StoreState {
  if (!globalForStore.__miniLmsStore) {
    globalForStore.__miniLmsStore = createInitialState();
  }
  return globalForStore.__miniLmsStore;
}

export function sanitizeUser(user: StoredUser): User {
  return {
    id: user.id,
    name: user.name,
    username: user.username,
    role: user.role,
  };
}

export function verifyPassword(password: string, hash: string): boolean {
  return hashPassword(password) === hash;
}

export function createUserRecord(input: {
  name?: string;
  username: string;
  password: string;
  role: Role;
}): StoredUser {
  return {
    id: `usr-${crypto.randomUUID().slice(0, 8)}`,
    name: input.name || input.username,
    username: input.username,
    role: input.role,
    passwordHash: hashPassword(input.password),
  };
}

export function signToken(user: User): string {
  const payload = Buffer.from(
    JSON.stringify({
      id: user.id,
      username: user.username,
      name: user.name,
      role: user.role,
      exp: Date.now() + 7 * 86400_000,
    })
  ).toString("base64url");

  const sig = crypto
    .createHmac("sha256", AUTH_SECRET)
    .update(payload)
    .digest("base64url");

  return `${payload}.${sig}`;
}

export function verifyToken(token: string): User | null {
  const parts = token.split(".");
  if (parts.length !== 2) return null;
  const [payload, sig] = parts;
  const expectedSig = crypto
    .createHmac("sha256", AUTH_SECRET)
    .update(payload)
    .digest("base64url");

  if (sig !== expectedSig) return null;

  try {
    const decoded = JSON.parse(
      Buffer.from(payload, "base64url").toString("utf8")
    ) as User & { exp?: number };
    if (decoded.exp && decoded.exp < Date.now()) {
      return null;
    }
    return {
      id: decoded.id,
      username: decoded.username,
      name: decoded.name,
      role: decoded.role,
    };
  } catch {
    return null;
  }
}

export function getAuthUser(request: Request): User | null {
  const auth = request.headers.get("authorization") || "";
  if (!auth.startsWith("Bearer ")) return null;
  const token = auth.slice(7).trim();
  if (!token) return null;
  return verifyToken(token);
}

export function getServiceHealthList(): ServiceHealth[] {
  return [
    { name: "auth-service (built-in)", status: "healthy", latency_ms: 2 },
    { name: "course-service (built-in)", status: "healthy", latency_ms: 3 },
    { name: "assignment-service (built-in)", status: "healthy", latency_ms: 2 },
    { name: "notification-service (built-in)", status: "healthy", latency_ms: 1 },
    { name: "upload-storage (/tmp)", status: "healthy", latency_ms: 4 },
  ];
}
