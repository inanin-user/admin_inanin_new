import { NextResponse } from "next/server";
import { open, readFile, rename, unlink } from "node:fs/promises";
import { resolve } from "node:path";

const CSV_PATH = resolve(
  process.cwd(),
  "../private_contact_data/contact_submissions.csv"
);

interface ContactRecord {
  id: string;
  timestamp: string;
  modifiedDate: string;
  name: string;
  phone: string;
  email: string;
  system: string;
  message: string;
  comment: string;
}

// CSV parser supporting quoted values, escaped quotes and newlines.
function parseCSV(content: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;

  for (let i = 0; i < content.length; i++) {
    const char = content[i];

    if (inQuotes) {
      if (char === '"') {
        if (content[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += char;
      }
    } else {
      if (char === '"') {
        inQuotes = true;
      } else if (char === ",") {
        row.push(field);
        field = "";
      } else if (char === "\n") {
        row.push(field);
        rows.push(row);
        row = [];
        field = "";
      } else if (char !== "\r") {
        field += char;
      }
    }
  }

  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }

  return rows.filter((r) =>
    r.some((value) => value.trim() !== "")
  );
}

function normalizeHeader(value: string) {
  return value
    .replace(/^\uFEFF/, "")
    .trim()
    .toLowerCase()
    .replace(/[\s_-]+/g, "");
}

export async function GET() {
  try {
    const content = await readFile(CSV_PATH, "utf8");
    const rows = parseCSV(content);

    if (rows.length === 0) {
      return NextResponse.json(
        { success: true, records: [] },
        { headers: { "Cache-Control": "no-store" } }
      );
    }

    const firstRow = rows[0].map(normalizeHeader);

    const hasHeader =
      firstRow.includes("name") &&
      firstRow.includes("phone");

    const headers = hasHeader
      ? firstRow
      : [
          "submissiondate",
          "name",
          "phone",
          "email",
          "system",
          "message",
        ];

    const dataRows = hasHeader ? rows.slice(1) : rows;

    function getValue(row: string[], ...keys: string[]) {
      const index = headers.findIndex((header) =>
        keys.includes(header)
      );

      return index >= 0 ? (row[index] ?? "") : "";
    }

    const records: ContactRecord[] = dataRows.map(
      (row, index) => {
        const timestamp = getValue(
          row,
          "submissiondate"
        );

        return {
          id: `${timestamp || "record"}-${index}`,
          timestamp,
          modifiedDate: getValue(row, "modifieddate"), // NEW
          name: getValue(row, "name"),
          phone: getValue(row, "phone"),
          email: getValue(row, "email"),
          system: getValue(row, "system"),
          message: getValue(row, "message"),
          comment: getValue(row, "comment"),
        };
      }
    );

    // Newest submissions first.
    records.reverse();

    return NextResponse.json(
      {
        success: true,
        total: records.length,
        records,
      },
      {
        headers: {
          "Cache-Control": "no-store, no-cache, must-revalidate",
        },
      }
    );
  } catch (error) {
    console.error("Contact CSV read error:", error);

    return NextResponse.json(
      {
        success: false,
        message: "Unable to read contact submissions.",
      },
      { status: 500 }
    );
  }
}
// Keep your existing CSV_PATH, parseCSV() and normalizeHeader().
// Do not redeclare existing imports or constants.

function escapeCSV(value: string): string {
  const safeValue = String(value ?? "");
  return `"${safeValue.replace(/"/g, '""')}"`;
}

function serializeCSV(rows: string[][]): string {
  return rows
    .map((row) => row.map(escapeCSV).join(","))
    .join("\r\n") + "\r\n";
}

function normalizeValue(value: unknown, maxLength: number): string {
  if (typeof value !== "string") return "";

  return value.trim().slice(0, maxLength);
}

export async function PUT(request: Request) {
  const lockPath = `${CSV_PATH}.lock`;
  const tempPath = `${CSV_PATH}.${Date.now()}.tmp`;

  let lockHandle: Awaited<ReturnType<typeof open>> | null = null;

  try {
    const body = await request.json();

    const id = normalizeValue(body.id, 300);
    const record = body.record;

    if (!id || !record || typeof record !== "object") {
      return NextResponse.json(
        { success: false, message: "Invalid request." },
        { status: 400 }
      );
    }

    const updated = {
      name: normalizeValue(record.name, 150),
      phone: normalizeValue(record.phone, 50),
      email: normalizeValue(record.email, 254),
      system: normalizeValue(record.system, 150),
      message: normalizeValue(record.message, 5000),
      comment: normalizeValue(record.comment, 5000),
    };

    if (!updated.name || !updated.phone) {
      return NextResponse.json(
        {
          success: false,
          message: "Name and phone are required.",
        },
        { status: 400 }
      );
    }

    // Acquire an exclusive lock to prevent simultaneous CSV writes.
    for (let attempt = 0; attempt < 30; attempt++) {
      try {
        lockHandle = await open(lockPath, "wx");
        break;
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== "EEXIST") {
          throw error;
        }

        await new Promise((resolve) => setTimeout(resolve, 100));
      }
    }

    if (!lockHandle) {
      return NextResponse.json(
        {
          success: false,
          message: "Another update is in progress. Please try again.",
        },
        { status: 409 }
      );
    }

    const content = await readFile(CSV_PATH, "utf8");
    const rows = parseCSV(content);

    if (rows.length === 0) {
      return NextResponse.json(
        { success: false, message: "CSV file is empty." },
        { status: 404 }
      );
    }

    // Preserve the original CSV header names.
    const originalHeaders = rows[0];
    const headers = originalHeaders.map(normalizeHeader);

    const hasHeader =
      headers.includes("name") &&
      headers.includes("phone");

    if (!hasHeader) {
      return NextResponse.json(
        {
          success: false,
          message: "CSV header is invalid.",
        },
        { status: 500 }
      );
    }

    const timestampIndex = headers.findIndex((h) =>
      ["submissiondate"].includes(h)
    );

    const nameIndex = headers.findIndex((h) =>
      ["name"].includes(h)
    );

    const phoneIndex = headers.findIndex((h) =>
      ["phone"].includes(h)
    );

    const emailIndex = headers.indexOf("email");
    const systemIndex = headers.indexOf("system");
    const messageIndex = headers.findIndex((h) =>
      ["message"].includes(h)
    );

    // Add a comment column if it does not already exist.
    let commentIndex = headers.findIndex((h) =>
      ["comment"].includes(h)
    );

    if (commentIndex === -1) {
      originalHeaders.push("comment");
      rows.forEach((row, index) => {
        if (index > 0) row.push("");
      });
      headers.push("comment");
      commentIndex = headers.length - 1;
    }
    let modifiedIndex = headers.indexOf("modifieddate");

    if (modifiedIndex === -1) {
      originalHeaders.push("ModifiedDate");
      rows.forEach((row, index) => {
        if (index > 0) row.push("");
      });
      headers.push("modifieddate");
      modifiedIndex = headers.length - 1;
    }

    // IDs are generated by GET as timestamp-rowIndex.
    // rowIndex is the data-row position before reverse().
    const separator = id.lastIndexOf("-");
    const rowIndex = Number(id.slice(separator + 1));
    const idTimestamp = id.slice(0, separator);

    if (
      separator < 0 ||
      !Number.isInteger(rowIndex) ||
      rowIndex < 0
    ) {
      return NextResponse.json(
        { success: false, message: "Invalid record ID." },
        { status: 400 }
      );
    }

    const targetIndex = rowIndex + 1;
    const target = rows[targetIndex];

    if (!target) {
      return NextResponse.json(
        { success: false, message: "Record not found." },
        { status: 404 }
      );
    }

    const currentTimestamp =
      timestampIndex >= 0
        ? target[timestampIndex] || "record"
        : "record";

    if (currentTimestamp !== idTimestamp) {
      return NextResponse.json(
        {
          success: false,
          message: "Record identity changed. Please refresh the list.",
        },
        { status: 409 }
      );
    }

    while (target.length < headers.length) target.push("");

    function setColumn(index: number, value: string) {
      if (index >= 0) target[index] = value;
    }

    setColumn(nameIndex, updated.name);
    setColumn(phoneIndex, updated.phone);
    setColumn(emailIndex, updated.email);
    setColumn(systemIndex, updated.system);
    setColumn(messageIndex, updated.message);
    setColumn(commentIndex, updated.comment);
    setColumn(modifiedIndex, new Date().toISOString());

    // Write a temporary file, then atomically replace the CSV.
    const tempHandle = await open(tempPath, "w", 0o600);

    try {
      await tempHandle.writeFile(serializeCSV(rows), "utf8");
    } finally {
      await tempHandle.close();
    }

    await rename(tempPath, CSV_PATH);

    return NextResponse.json({
      success: true,
      message: "Record updated successfully.",
      modifiedDate: target[modifiedIndex],
    });
  } catch (error) {
    console.error("Contact CSV update error:", error);

    return NextResponse.json(
      {
        success: false,
        message: "Unable to update contact record.",
      },
      { status: 500 }
    );
  } finally {
    if (lockHandle) {
      await lockHandle.close().catch(() => {});
      await unlink(lockPath).catch(() => {});
    }

    await unlink(tempPath).catch(() => {});
  }
}
