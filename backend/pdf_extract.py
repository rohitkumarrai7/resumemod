"""
PDF Text Extraction Endpoint for FastAPI
Add this to your FastAPI backend to handle PDF text extraction server-side.

Usage:
  POST /v1/pdf/extract
  Body: {"base64": "<pdf_base64_data>"}
  Response: {"text": "<extracted_text>", "pages": <num_pages>}
"""

import base64
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

try:
    import pdfplumber
    HAS_PDFPLUMBER = True
except ImportError:
    HAS_PDFPLUMBER = False

try:
    import pymupdf
    HAS_PYMUPDF = True
except ImportError:
    HAS_PYMUPDF = False

router = APIRouter(prefix="/v1/pdf", tags=["pdf"])


class PdfExtractRequest(BaseModel):
    base64: str


@router.post("/extract")
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
        # Remove data URL prefix if present
        base64_data = req.base64
        if "data:application/pdf;base64," in base64_data:
            base64_data = base64_data.replace("data:application/pdf;base64,", "")

        pdf_bytes = base64.b64decode(base64_data)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Failed to decode base64: {str(e)}")

    full_text = ""
    num_pages = 0

    # Try pdfplumber first
    if HAS_PDFPLUMBER:
        try:
            with pdfplumber.open(io.BytesIO(pdf_bytes)) as pdf:
                num_pages = len(pdf.pages)
                for page in pdf.pages:
                    text = page.extract_text()
                    if text:
                        full_text += text + "\n"
        except Exception as e:
            print(f"pdfplumber extraction failed: {e}")
            full_text = ""
            num_pages = 0

    # Fall back to PyMuPDF if pdfplumber failed or returned empty
    if not full_text.strip() and HAS_PYMUPDF:
        try:
            import fitz  # PyMuPDF
            doc = fitz.open(stream=pdf_bytes, filetype="pdf")
            num_pages = len(doc)
            for page in doc:
                text = page.get_text()
                if text:
                    full_text += text + "\n"
        except Exception as e:
            print(f"PyMuPDF extraction failed: {e}")

    if not full_text.strip():
        raise HTTPException(
            status_code=422,
            detail="No readable text found in PDF. It may be a scanned document or image-based PDF."
        )

    return {"text": full_text.strip(), "pages": num_pages}


# Also add this to your main FastAPI app:
# from fastapi import FastAPI
# app = FastAPI()
# app.include_router(router)