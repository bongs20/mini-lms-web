import { del, get, list, put } from "@vercel/blob";
import type { Assignment, Course } from "./api";

const COURSE_PREFIX = "catalog/courses/";
const ASSIGNMENT_PREFIX = "catalog/assignments/";
const DELETED_COURSE_PREFIX = "catalog/deleted-courses/";
const DELETED_ASSIGNMENT_PREFIX = "catalog/deleted-assignments/";

interface CourseDeletionMarker {
  id: string;
  assignment_ids: string[];
  deleted_at: string;
}

function isCourse(value: unknown): value is Course {
  if (!value || typeof value !== "object") return false;
  const course = value as Partial<Course>;
  return (
    typeof course.id === "string" &&
    typeof course.code === "string" &&
    typeof course.name === "string"
  );
}

function isAssignment(value: unknown): value is Assignment {
  if (!value || typeof value !== "object") return false;
  const assignment = value as Partial<Assignment>;
  return (
    typeof assignment.id === "string" &&
    typeof assignment.course_id === "string" &&
    typeof assignment.title === "string"
  );
}

function mergeById<T extends { id: string }>(
  ...collections: T[][]
): T[] {
  const records = new Map<string, T>();
  for (const record of collections.flat()) {
    records.set(record.id, record);
  }
  return Array.from(records.values());
}

async function listRecords<T>(
  prefix: string,
  isRecord: (value: unknown) => value is T
): Promise<T[]> {
  const blobs: { pathname: string }[] = [];
  let cursor: string | undefined;

  do {
    const page = await list({ prefix, cursor });
    blobs.push(...page.blobs);
    cursor = page.hasMore ? page.cursor : undefined;
  } while (cursor);

  return Promise.all(
    blobs.map(async (blob) => {
      const result = await get(blob.pathname, {
        access: "private",
        useCache: false,
      });
      if (!result || result.statusCode !== 200 || !result.stream) {
        throw new Error(`Rekaman tidak dapat dibaca: ${blob.pathname}`);
      }

      const value: unknown = await new Response(result.stream).json();
      if (!isRecord(value)) {
        throw new Error(`Format rekaman tidak valid: ${blob.pathname}`);
      }
      return value;
    })
  );
}

async function saveRecord<T extends { id: string }>(
  prefix: string,
  record: T
): Promise<void> {
  await put(`${prefix}${record.id}.json`, JSON.stringify(record), {
    access: "private",
    addRandomSuffix: false,
    contentType: "application/json",
  });
}

async function listDeletedIds(prefix: string): Promise<Set<string>> {
  const ids = new Set<string>();
  let cursor: string | undefined;

  do {
    const page = await list({ prefix, cursor });
    for (const blob of page.blobs) {
      const id = blob.pathname.slice(prefix.length).replace(/\.json$/, "");
      if (id) ids.add(id);
    }
    cursor = page.hasMore ? page.cursor : undefined;
  } while (cursor);

  return ids;
}

async function saveDeletionMarker(
  prefix: string,
  id: string,
  value: object
): Promise<void> {
  await put(`${prefix}${id}.json`, JSON.stringify(value), {
    access: "private",
    addRandomSuffix: false,
    allowOverwrite: true,
    contentType: "application/json",
  });
}

export async function listStoredCourses(): Promise<Course[]> {
  return listRecords(COURSE_PREFIX, isCourse);
}

export async function listStoredAssignments(): Promise<Assignment[]> {
  return listRecords(ASSIGNMENT_PREFIX, isAssignment);
}

export async function saveStoredCourse(course: Course): Promise<void> {
  await saveRecord(COURSE_PREFIX, course);
}

export async function saveStoredAssignment(
  assignment: Assignment
): Promise<void> {
  await saveRecord(ASSIGNMENT_PREFIX, assignment);
}

export async function listDeletedCourseIds(): Promise<Set<string>> {
  return listDeletedIds(DELETED_COURSE_PREFIX);
}

export async function listDeletedAssignmentIds(): Promise<Set<string>> {
  return listDeletedIds(DELETED_ASSIGNMENT_PREFIX);
}

export async function isAssignmentDeleted(
  assignmentId: string
): Promise<boolean> {
  const result = await get(
    `${DELETED_ASSIGNMENT_PREFIX}${assignmentId}.json`,
    { access: "private", useCache: false }
  );
  if (!result) return false;
  if (result.statusCode !== 200 || !result.stream) {
    throw new Error("Catatan penghapusan tugas tidak dapat dibaca.");
  }
  return true;
}

export async function getCourseDeletionAssignmentIds(
  courseId: string
): Promise<string[] | null> {
  const result = await get(`${DELETED_COURSE_PREFIX}${courseId}.json`, {
    access: "private",
    useCache: false,
  });
  if (!result) return null;
  if (result.statusCode !== 200 || !result.stream) {
    throw new Error("Catatan penghapusan mata kuliah tidak dapat dibaca.");
  }

  const marker: unknown = await new Response(result.stream).json();
  if (
    !marker ||
    typeof marker !== "object" ||
    (marker as Partial<CourseDeletionMarker>).id !== courseId ||
    !Array.isArray((marker as Partial<CourseDeletionMarker>).assignment_ids) ||
    !(marker as Partial<CourseDeletionMarker>).assignment_ids?.every(
      (id) => typeof id === "string"
    )
  ) {
    throw new Error("Format catatan penghapusan mata kuliah tidak valid.");
  }

  return Array.from(
    new Set((marker as CourseDeletionMarker).assignment_ids)
  );
}

export async function markCourseDeleted(
  courseId: string,
  assignmentIds: string[]
): Promise<void> {
  await saveDeletionMarker(DELETED_COURSE_PREFIX, courseId, {
    id: courseId,
    assignment_ids: Array.from(new Set(assignmentIds)),
    deleted_at: new Date().toISOString(),
  });
}

export async function markAssignmentDeleted(
  assignmentId: string
): Promise<void> {
  await saveDeletionMarker(DELETED_ASSIGNMENT_PREFIX, assignmentId, {
    id: assignmentId,
    deleted_at: new Date().toISOString(),
  });
}

export async function deleteStoredCourseRecord(
  courseId: string
): Promise<void> {
  await del(`${COURSE_PREFIX}${courseId}.json`);
}

export async function deleteStoredAssignmentRecords(
  assignmentIds: string[]
): Promise<void> {
  const paths = assignmentIds.map((id) => `${ASSIGNMENT_PREFIX}${id}.json`);
  for (let index = 0; index < paths.length; index += 500) {
    await del(paths.slice(index, index + 500));
  }
}

export function mergeCatalogRecords<T extends { id: string }>(
  ...collections: T[][]
): T[] {
  return mergeById(...collections);
}
