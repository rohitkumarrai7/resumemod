const { createRequire } = require("module");
const path = require("path");
const { pathToFileURL } = require("url");

const req = createRequire(path.join(process.cwd(), "package.json"));

let workerReady = false;

async function configureWorker() {
  if (workerReady) return;
  const { getPath } = req("pdf-parse/worker");
  const workerMod = await import(pathToFileURL(getPath()).href);
  globalThis.pdfjsWorker = workerMod;
  workerReady = true;
}

async function extractPdfText(buffer) {
  await configureWorker();
  const { PDFParse } = await import("pdf-parse");
  const parser = new PDFParse({ data: Buffer.from(buffer) });
  try {
    const result = await parser.getText();
    return result.text || "";
  } finally {
    await parser.destroy();
  }
}

module.exports = { extractPdfText };
