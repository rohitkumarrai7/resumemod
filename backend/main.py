"""
FastAPI backend with PDF text extraction using pdfplumber/PyMuPDF.
Run: uvicorn main:app --reload --port 8000

Install dependencies:
  pip install fastapi uvicorn pdfplumber pymupdf
"""

import io
import base64
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

try:
    import pdfplumber
    HAS_PDFPLUMBER = True
except ImportError:
    HAS_PDFPLUMBER = False

try:
    import fitz  # PyMuPDF
    HAS_PYMUPDF = True
except ImportError:
    HAS_PYMUPDF = False

app = FastAPI(title="ResumeForge API", version="1.0.0")

ALLOWED_ORIGINS = [
    "http://localhost:3000",
    "https://resumod.vercel.app",
    "chrome-extension://*",
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["GET", "POST", "OPTIONS"],
    allow_headers=["Content-Type", "Authorization"],
)


class PdfExtractRequest(BaseModel):
    base64: str


@app.get("/health")
async def health():
    return {
        "status": "ok",
        "pdfplumber": HAS_PDFPLUMBER,
        "pymupdf": HAS_PYMUPDF
    }


@app.post("/v1/pdf/extract")
async def extract_pdf_text(req: PdfExtractRequest):
    """
    Extract text from a PDF file given as base64.
    Uses pdfplumber first, falls back to PyMuPDF.
    """
    if not HAS_PDFPLUMBER and not HAS_PYMUPDF:
        raise HTTPException(
            status_code=500,
            detail="No PDF library available. Install pdfplumber or pymupdf."
        )

    try:
        base64_data = req.base64
        if "data:application/pdf;base64," in base64_data:
            base64_data = base64_data.replace("data:application/pdf;base64,", "")

        pdf_bytes = base64.b64decode(base64_data)
        print(f"[PDF Extract] Decoded {len(pdf_bytes)} bytes")
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Failed to decode base64: {str(e)}")

    full_text = ""
    num_pages = 0

    # Try pdfplumber first
    if HAS_PDFPLUMBER:
        try:
            with pdfplumber.open(io.BytesIO(pdf_bytes)) as pdf:
                num_pages = len(pdf.pages)
                print(f"[PDF Extract] pdfplumber opened, {num_pages} pages")
                for page in pdf.pages:
                    text = page.extract_text()
                    if text:
                        full_text += text + "\n"
                print(f"[PDF Extract] pdfplumber extracted {len(full_text)} chars")
        except Exception as e:
            print(f"[PDF Extract] pdfplumber failed: {e}")
            full_text = ""
            num_pages = 0

    # Fall back to PyMuPDF if pdfplumber failed or returned empty
    if not full_text.strip() and HAS_PYMUPDF:
        try:
            doc = fitz.open(stream=pdf_bytes, filetype="pdf")
            num_pages = len(doc)
            print(f"[PDF Extract] PyMuPDF opened, {num_pages} pages")
            for page in doc:
                text = page.get_text()
                if text:
                    full_text += text + "\n"
            print(f"[PDF Extract] PyMuPDF extracted {len(full_text)} chars")
        except Exception as e:
            print(f"[PDF Extract] PyMuPDF failed: {e}")

    if not full_text.strip():
        raise HTTPException(
            status_code=422,
            detail="No readable text found in PDF. It may be a scanned document or image-based PDF."
        )

    return {"text": full_text.strip(), "pages": num_pages}


# ============================================================
# Your existing ResumeForge endpoints below
# ============================================================

# Example placeholder - replace with your actual endpoints
@app.get("/")
async def root():
    return {"message": "ResumeForge API", "version": "1.0.0"}


# TODO: Add your existing endpoints:
# - POST /v1/auth/refresh
# - POST /v1/drafts/create
# - GET /v1/drafts/{draftId}
# - GET /v1/jobs
# - POST /v1/jobs
# - DELETE /v1/jobs/{jobId}
# - GET /v1/resumes/me/profile
# - POST /v1/ats/analyze
# etc.