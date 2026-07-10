import { describe, it, expect } from "vitest";
import { validateArchive } from "./validateArchive";
import type { ExtractedArchive } from "../parser/zip";

describe("validateArchive", () => {
  it("é válido quando followed_tv_show.csv existe", () => {
    const archive: ExtractedArchive = {
      files: { "followed_tv_show.csv": "tv_show_name\nTest\n" },
      allFileNames: ["followed_tv_show.csv"],
    };
    expect(validateArchive(archive).valid).toBe(true);
  });

  it("é inválido sem followed_tv_show.csv, mesmo com outros arquivos presentes", () => {
    const archive: ExtractedArchive = {
      files: { "user_tv_show_data.csv": "tv_show_name\nTest\n" },
      allFileNames: ["user_tv_show_data.csv"],
    };
    const result = validateArchive(archive);
    expect(result.valid).toBe(false);
    expect(result.missingFiles).toContain("followed_tv_show.csv");
  });

  it("detecta possível mudança de formato quando não há nenhum CSV conhecido", () => {
    const archive: ExtractedArchive = { files: {}, allFileNames: ["some_export.json"] };
    expect(validateArchive(archive).possibleFormatChange).toBe(true);
  });
});
