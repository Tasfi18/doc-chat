import { NextResponse } from "next/server";
import { ACCEPTED, MAX_FILE_BYTES, extensionOf, extractPages } from "@/lib/extract";
import { addDoc, listDocs, removeDoc } from "@/lib/store";

export const runtime = "nodejs";

export async function GET() {
  return NextResponse.json({ docs: await listDocs() });
}

export async function POST(req: Request) {
  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ error: "Send the file as multipart form data in a field called \"file\"." }, { status: 400 });
  }

  const file = form.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "No file received." }, { status: 400 });
  }
  if (!(ACCEPTED as readonly string[]).includes(extensionOf(file.name))) {
    return NextResponse.json({ error: "Upload a PDF, TXT or Markdown (.md) file." }, { status: 415 });
  }
  if (file.size > MAX_FILE_BYTES) {
    return NextResponse.json({ error: "Files must be 10 MB or smaller." }, { status: 413 });
  }

  try {
    const pages = await extractPages(file.name, new Uint8Array(await file.arrayBuffer()));
    const doc = await addDoc(file.name, pages);
    return NextResponse.json({ doc }, { status: 201 });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Could not read that file.";
    return NextResponse.json({ error: message }, { status: 422 });
  }
}

export async function DELETE(req: Request) {
  const id = new URL(req.url).searchParams.get("id");
  if (!id) return NextResponse.json({ error: "Missing document id." }, { status: 400 });
  const removed = await removeDoc(id);
  return removed
    ? NextResponse.json({ ok: true })
    : NextResponse.json({ error: "Document not found." }, { status: 404 });
}
