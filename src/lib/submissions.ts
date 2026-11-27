import { del, get, list, put } from "@vercel/blob";
import type { Submission } from "./api";

const SUBMISSION_PREFIX = "submissions/records/";
const FILE_PREFIX = "submissions/files/";
export const MAX_SUBMISSION_FILE_SIZE = 4 * 1024 * 1024;

export interface StoredSubmission extends Submission {
  file_blob_path: string;
}

function isStoredSubmission(value: unknown): value is StoredSubmission {
  if (!value || typeof value !== "object") return false;
  const submission = value as Partial<StoredSubmission>;
  return (
    typeof submission.id === "string" &&
    typeof submission.assignment_id === "string" &&
    typeof submission.user_id === "string" &&
    typeof submission.file_name === "string" &&
    typeof submission.file_path === "string" &&
    typeof submission.file_blob_path === "string" &&
    submission.file_blob_path.startsWith(
      `${FILE_PREFIX}${submission.id}/`
    )
  );
}

function toSubmission({
  id,
  assignment_id,
  user_id,
  user_name,
  file_name,
  file_path,
  submitted_at,
}: StoredSubmission): Submission {
  return {
    id,
    assignment_id,
    user_id,
    user_name,
    file_name,
    file_path,
    submitted_at,
  };
}

async function readStoredSubmission(pathname: string): Promise<StoredSubmission> {
  const result = await get(pathname, { access: "private", useCache: false });
  if (!result || result.statusCode !== 200 || !result.stream) {
    throw new Error(`Rekaman pengumpulan tidak dapat dibaca: ${pathname}`);
  }

  const value: unknown = await new Response(result.stream).json();
  if (!isStoredSubmission(value)) {
    throw new Error(`Format rekaman pengumpulan tidak valid: ${pathname}`);
  }
  return value;
}

async function listStoredSubmissionRecords(): Promise<StoredSubmission[]> {
  const blobs: { pathname: string }[] = [];
  let cursor: string | undefined;

  do {
    const page = await list({
      prefix: SUBMISSION_PREFIX,
      cursor,
    });
    blobs.push(...page.blobs);
    cursor = page.hasMore ? page.cursor : undefined;
  } while (cursor);

  return Promise.all(
    blobs.map(async (blob) =>
      readStoredSubmission(blob.pathname)
    )
  );
}

export async function listStoredSubmissions(): Promise<Submission[]> {
  const records = await listStoredSubmissionRecords();
  const submissions = records.map(toSubmission);

  return submissions.sort((a, b) =>
    (b.submitted_at || "").localeCompare(a.submitted_at || "")
  );
}

async function deleteBlobPaths(paths: string[]): Promise<void> {
  for (let index = 0; index < paths.length; index += 500) {
    await del(paths.slice(index, index + 500));
  }
}

export async function getStoredSubmission(
  submissionId: string
): Promise<StoredSubmission | null> {
  const pathname = `${SUBMISSION_PREFIX}${submissionId}.json`;
  const result = await get(pathname, { access: "private", useCache: false });
  if (!result) return null;
  if (result.statusCode !== 200 || !result.stream) {
    throw new Error(`Rekaman pengumpulan tidak dapat dibaca: ${pathname}`);
  }

  const value: unknown = await new Response(result.stream).json();
  if (!isStoredSubmission(value) || value.id !== submissionId) {
    throw new Error(`Format rekaman pengumpulan tidak valid: ${pathname}`);
  }
  return value;
}

export async function deleteStoredSubmission(
  submissionId: string
): Promise<boolean> {
  const submission = await getStoredSubmission(submissionId);
  if (!submission) return false;
  await deleteBlobPaths([
    `${SUBMISSION_PREFIX}${submissionId}.json`,
    submission.file_blob_path,
  ]);
  return true;
}

export async function deleteStoredSubmissionsForAssignments(
  assignmentIds: string[]
): Promise<number> {
  if (assignmentIds.length === 0) return 0;
  const assignmentIdSet = new Set(assignmentIds);
  const submissions = (await listStoredSubmissionRecords()).filter((item) =>
    assignmentIdSet.has(item.assignment_id)
  );
  const paths = submissions.flatMap((submission) => [
    `${SUBMISSION_PREFIX}${submission.id}.json`,
    submission.file_blob_path,
  ]);
  await deleteBlobPaths(paths);
  return submissions.length;
}

export async function createStoredSubmission(input: {
  assignmentId: string;
  file: File;
  fileName: string;
  submissionId: string;
  userId: string;
  userName: string;
}): Promise<Submission> {
  const {
    assignmentId,
    file,
    fileName,
    submissionId,
    userId,
    userName,
  } = input;

  if (file.size === 0) {
    throw new Error("Berkas tidak boleh kosong.");
  }
  if (file.size > MAX_SUBMISSION_FILE_SIZE) {
    throw new Error("Ukuran berkas maksimal 4 MB.");
  }

  const fileBlobPath = `${FILE_PREFIX}${submissionId}/${fileName}`;
  const fileBlob = await put(fileBlobPath, file, {
    access: "private",
    addRandomSuffix: false,
    contentType: file.type || "application/octet-stream",
  });
  const submission: StoredSubmission = {
    id: submissionId,
    assignment_id: assignmentId,
    user_id: userId,
    user_name: userName,
    file_name: fileName,
    file_path: `/api/submissions/${submissionId}/file`,
    file_blob_path: fileBlob.pathname,
    submitted_at: new Date().toISOString(),
  };

  const recordBlobPath = `${SUBMISSION_PREFIX}${submissionId}.json`;
  try {
    await put(
      recordBlobPath,
      JSON.stringify(submission),
      {
        access: "private",
        addRandomSuffix: false,
        contentType: "application/json",
      }
    );
  } catch (error) {
    try {
      await del([recordBlobPath, fileBlob.pathname]);
    } catch (cleanupError) {
      console.error("Gagal membersihkan berkas tanpa rekaman pengumpulan.", {
        submissionId,
        cleanupError,
      });
    }
    throw error;
  }

  return toSubmission(submission);
}
