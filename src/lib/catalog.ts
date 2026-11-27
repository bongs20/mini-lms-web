import { get, list, put } from "@vercel/blob";
import type { Assignment, Course } from "./api";

const COURSE_PREFIX = "catalog/courses/";
const ASSIGNMENT_PREFIX = "catalog/assignments/";

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

export function mergeCatalogRecords<T extends { id: string }>(
  ...collections: T[][]
): T[] {
  return mergeById(...collections);
}
