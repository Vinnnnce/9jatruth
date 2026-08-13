import { ensureDbInitialized } from "@/lib/db";
import { getClerkUserId, getUserId } from "@/lib/api-helpers";
import { csrfCheck } from "@/lib/security";
import crypto from "node:crypto";
import { promises as fs } from "node:fs";
import path from "node:path";

const UPLOAD_DIR = path.join(process.cwd(), "public", "uploads");
const MAX_IMAGE_SIZE = 10 * 1024 * 1024; // 10MB
const MAX_VIDEO_SIZE = 60 * 1024 * 1024; // 60MB (max 60s video)
const MAX_VIDEO_DURATION_SECONDS = 60;

const ALLOWED_IMAGE_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "image/avif",
];

const ALLOWED_VIDEO_TYPES = [
  "video/mp4",
  "video/webm",
  "video/quicktime",
];

/**
 * POST /api/media/upload — handle image and video upload
 * Max 60s video. Returns the URL.
 *
 * Accepts multipart/form-data with a "file" field.
 */
export async function POST(request: Request) {
  await ensureDbInitialized();

  const csrfError = csrfCheck(request);
  if (csrfError) return csrfError;

  const clerkUserId = await getClerkUserId();
  if (!clerkUserId) {
    const clerkKey = process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY;
    const isClerkConfigured = clerkKey && !clerkKey.includes("placeholder") && clerkKey.length > 20;
    if (isClerkConfigured) {
      return Response.json({ message: "Unauthorized — Please sign in to upload media" }, { status: 401 });
    }
  }

  const userHash = await getUserId(request);

  const contentType = request.headers.get("content-type") || "";
  if (!contentType.includes("multipart/form-data")) {
    return Response.json({ message: "Content-Type must be multipart/form-data" }, { status: 400 });
  }

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return Response.json({ message: "Failed to parse form data" }, { status: 400 });
  }

  const file = formData.get("file");
  if (!file || !(file instanceof File)) {
    return Response.json({ message: "No file provided. Use 'file' field." }, { status: 400 });
  }

  // Validate file type
  const isImage = ALLOWED_IMAGE_TYPES.includes(file.type);
  const isVideo = ALLOWED_VIDEO_TYPES.includes(file.type);

  if (!isImage && !isVideo) {
    return Response.json(
      { message: `File type ${file.type} not supported. Allowed: ${[...ALLOWED_IMAGE_TYPES, ...ALLOWED_VIDEO_TYPES].join(", ")}` },
      { status: 400 }
    );
  }

  // Validate file size
  const maxSize = isVideo ? MAX_VIDEO_SIZE : MAX_IMAGE_SIZE;
  if (file.size > maxSize) {
    const maxMB = maxSize / (1024 * 1024);
    return Response.json(
      { message: `File exceeds maximum size of ${maxMB}MB` },
      { status: 400 }
    );
  }

  // Validate video duration if provided
  const durationStr = formData.get("duration");
  if (isVideo && durationStr) {
    const duration = parseFloat(String(durationStr));
    if (!isNaN(duration) && duration > MAX_VIDEO_DURATION_SECONDS) {
      return Response.json(
        { message: `Video duration exceeds maximum of ${MAX_VIDEO_DURATION_SECONDS} seconds` },
        { status: 400 }
      );
    }
  }

  // Generate unique filename
  const ext = path.extname(file.name) || (isImage ? ".jpg" : ".mp4");
  const hash = crypto.createHash("sha256").update(userHash + Date.now()).digest("hex").slice(0, 16);
  const dateDir = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
  const filename = `${dateDir}/${hash}${ext}`;
  const filePath = path.join(UPLOAD_DIR, dateDir, path.basename(filename));

  // Ensure upload directory exists
  try {
    await fs.mkdir(path.dirname(filePath), { recursive: true });
  } catch (err) {
    console.error("[media/upload] Failed to create directory:", err);
    return Response.json({ message: "Failed to create upload directory" }, { status: 500 });
  }

  // Write file
  try {
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    await fs.writeFile(filePath, buffer);
  } catch (err) {
    console.error("[media/upload] Failed to write file:", err);
    return Response.json({ message: "Failed to save file" }, { status: 500 });
  }

  // Build public URL
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "";
  const urlPath = `/uploads/${dateDir}/${hash}${ext}`;
  const url = baseUrl ? `${baseUrl}${urlPath}` : urlPath;

  return Response.json(
    {
      success: true,
      url,
      fileType: isImage ? "image" : "video",
      mimeType: file.type,
      size: file.size,
      originalName: file.name,
    },
    { status: 201 }
  );
}
