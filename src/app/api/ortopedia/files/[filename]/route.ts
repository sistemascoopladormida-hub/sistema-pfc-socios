import { readFile } from "fs/promises";
import path from "path";
import { NextResponse } from "next/server";

import { certificadoMimeFromPath, resolveUploadAbsolutePath } from "@/lib/ortopedia-certificado";

type Params = {
  params: {
    filename: string;
  };
};

export async function GET(_: Request, { params }: Params) {
  try {
    const fileName = path.basename(decodeURIComponent(params.filename));
    if (!fileName || fileName.includes("..")) {
      return NextResponse.json({ success: false, error: "Archivo invalido" }, { status: 400 });
    }

    const storedPath = path.join("uploads", "ortopedia", fileName).replace(/\\/g, "/");
    const absFile = resolveUploadAbsolutePath(storedPath);
    const fileBuffer = await readFile(absFile);
    const mime = certificadoMimeFromPath(fileName);

    return new NextResponse(fileBuffer, {
      headers: {
        "Content-Type": mime,
        "Content-Disposition": `inline; filename="${fileName}"`,
        "Cache-Control": "private, max-age=0, must-revalidate",
      },
    });
  } catch (error) {
    return NextResponse.json({ success: false, error: String(error) }, { status: 404 });
  }
}
