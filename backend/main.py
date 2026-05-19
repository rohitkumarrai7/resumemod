from fastapi import FastAPI, Depends, HTTPException, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from pydantic import BaseModel
from typing import List, Optional, Dict, Any
import uuid
import base64
import io
from datetime import datetime, timedelta
import asyncio

try:
    import pdfplumber
    PDFPLUMBER_AVAILABLE = True
except ImportError:
    PDFPLUMBER_AVAILABLE = False

try:
    import fitz
    PYMUPDF_AVAILABLE = True
except ImportError:
    PYMUPDF_AVAILABLE = False

app = FastAPI(title="ResumeForge API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "https://app.resumeforge.io",
        "chrome-extension://*",
        "http://localhost:3000",
        "http://localhost:8000"
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

security = HTTPBearer(auto_error=False)
drafts_db: Dict[str, Any] = {}
resumes_db: Dict[str, Any] = {}


async def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)):
    if not credentials:
        return {"id": "dev_user", "email": "dev@example.com", "tier": "pro"}
    return {"id": "user_123", "email": "user@example.com", "tier": "pro"}


class LocalAnalysis(BaseModel):
    score: int
    matchedKeywords: List[str]
    missingKeywords: List[str]


class DraftCreateRequest(BaseModel):
    resumeBase64: Optional[str] = None
    resumeFilename: Optional[str] = ""
    resumeMimeType: Optional[str] = ""
    resumeText: Optional[str] = ""
    jobDescription: str
    jobTitle: Optional[str] = ""
    company: Optional[str] = ""
    location: Optional[str] = ""
    jobUrl: Optional[str] = ""
    source: Optional[str] = ""
    localAnalysis: Optional[LocalAnalysis] = None


class DraftCreateResponse(BaseModel):
    draftId: str
    editorUrl: str
    status: str
    expiresAt: datetime
    estimatedSeconds: int


class ExtractTextRequest(BaseModel):
    base64: str


class ExtractTextResponse(BaseModel):
    text: str
    method: str
    confidence: float


def is_human_readable(text: str) -> bool:
    """Validate text is human-readable, not binary garbage"""
    if not text or len(text) < 50:
        return False

    pdf_markers = ['%PDF-', 'obj <<', 'endobj', 'stream', 'endstream',
                   '/Type/', '/Font', '/Image', '/Length', '/Filter',
                   'FlateDecode', 'xref', 'trailer', 'startxref']
    if any(marker in text for marker in pdf_markers):
        return False

    printable = sum(1 for c in text if 32 <= ord(c) <= 126 or c in '\n\r\t')
    if printable / len(text) < 0.85:
        return False

    resume_keywords = ['experience', 'education', 'skills', 'work',
                       'developer', 'engineer', 'project', 'university',
                       'summary', 'objective', 'professional', 'javascript',
                       'python', 'react', 'node', 'full stack']
    lower = text.lower()
    if not any(kw in lower for kw in resume_keywords):
        words = text.split()
        if len(words) < 20:
            return False

    return True


def extract_text_from_pdf_bytes(pdf_bytes: bytes) -> Dict[str, Any]:
    text = ""
    method = "none"
    confidence = 0.0

    if PDFPLUMBER_AVAILABLE:
        try:
            with pdfplumber.open(io.BytesIO(pdf_bytes)) as pdf:
                pages_text = []
                for page in pdf.pages:
                    page_text = page.extract_text()
                    if page_text:
                        pages_text.append(page_text)
                if pages_text:
                    text = "\n".join(pages_text)
                    method = "pdfplumber"
                    confidence = min(1.0, len(text) / 1000)
                    if is_human_readable(text):
                        return {"text": text, "method": method, "confidence": confidence}
                    text = ""
        except Exception as e:
            print(f"pdfplumber failed: {e}")

    if not text and PYMUPDF_AVAILABLE:
        try:
            doc = fitz.open(stream=pdf_bytes, filetype="pdf")
            pages_text = []
            for page in doc:
                pages_text.append(page.get_text())
            text = "\n".join(pages_text)
            if text.strip():
                method = "pymupdf"
                confidence = min(1.0, len(text) / 1000)
                if is_human_readable(text):
                    return {"text": text, "method": method, "confidence": confidence}
                text = ""
        except Exception as e:
            print(f"pymupdf failed: {e}")

    if not text:
        try:
            decoded = pdf_bytes.decode('latin-1', errors='ignore')
            import re
            text_matches = []
            for match in re.finditer(r'[\x20-\x7E]{4,}', decoded):
                text_matches.append(match.group())
            text = " ".join(text_matches)
            if text.strip():
                method = "basic"
                confidence = 0.3
                if is_human_readable(text):
                    return {"text": text, "method": method, "confidence": confidence}
        except Exception as e:
            print(f"basic extraction failed: {e}")

    return {"text": text.strip(), "method": method, "confidence": confidence}


@app.post("/v1/resumes/extract-text", response_model=ExtractTextResponse)
async def extract_text_from_pdf_endpoint(request: ExtractTextRequest):
    try:
        pdf_bytes = base64.b64decode(request.base64)
        result = extract_text_from_pdf_bytes(pdf_bytes)

        if not result["text"] or not is_human_readable(result["text"]):
            raise HTTPException(422, "Could not extract readable text from PDF. "
                                    "The PDF may be image-based or corrupted.")

        return ExtractTextResponse(
            text=result["text"],
            method=result["method"],
            confidence=result["confidence"]
        )
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(500, f"PDF extraction failed: {str(e)}")


@app.post("/v1/drafts/create", response_model=DraftCreateResponse)
async def create_draft(
    request: DraftCreateRequest,
    background_tasks: BackgroundTasks,
    user: dict = Depends(get_current_user)
):
    draft_id = f"draft_{uuid.uuid4()}"
    expires_at = datetime.utcnow() + timedelta(minutes=15)

    resume_id = f"resume_{uuid.uuid4()}"
    resumes_db[resume_id] = {
        "id": resume_id,
        "user_id": user["id"],
        "filename": request.resumeFilename or "unknown",
        "mime_type": request.resumeMimeType or "application/octet-stream",
        "base64": request.resumeBase64 or "",
        "extracted_text": request.resumeText or "",
        "uploaded_at": datetime.utcnow().isoformat()
    }

    draft = {
        "id": draft_id,
        "user_id": user["id"],
        "resume_id": resume_id,
        "status": "optimizing",
        "context": {
            "resume": {
                "filename": request.resumeFilename or "unknown",
                "mimeType": request.resumeMimeType or "application/octet-stream",
                "extractedText": request.resumeText or "",
                "textLength": len(request.resumeText) if request.resumeText else 0
            },
            "job": {
                "title": request.jobTitle or "",
                "company": request.company or "",
                "location": request.location or "",
                "description": request.jobDescription,
                "descriptionLength": len(request.jobDescription),
                "url": request.jobUrl or "",
                "source": request.source or ""
            },
            "localAnalysis": request.localAnalysis.dict() if request.localAnalysis else None
        },
        "latex_source": None,
        "compiled_pdf_url": None,
        "initial_score": request.localAnalysis.score if request.localAnalysis else 0,
        "current_score": None,
        "created_at": datetime.utcnow().isoformat(),
        "expires_at": expires_at.isoformat()
    }

    drafts_db[draft_id] = draft
    background_tasks.add_task(run_optimization, draft_id)

    editor_url = f"https://app.resumeforge.io/editor?draft={draft_id}"

    return DraftCreateResponse(
        draftId=draft_id,
        editorUrl=editor_url,
        status="optimizing",
        expiresAt=expires_at,
        estimatedSeconds=30
    )


@app.get("/v1/drafts/{draft_id}")
async def get_draft(draft_id: str, user: dict = Depends(get_current_user)):
    draft = drafts_db.get(draft_id)
    if not draft:
        raise HTTPException(404, "Draft not found or expired")
    if draft["user_id"] != user["id"]:
        raise HTTPException(403, "Not authorized")

    expires = datetime.fromisoformat(draft["expires_at"])
    if datetime.utcnow() > expires:
        draft["status"] = "expired"

    return {
        "draftId": draft_id,
        "status": draft["status"],
        "context": draft["context"],
        "latexSource": draft.get("latex_source"),
        "compiledPdfUrl": draft.get("compiled_pdf_url"),
        "currentAtsScore": draft.get("current_score"),
        "expiresAt": expires
    }


@app.post("/v1/drafts/{draft_id}/compile")
async def compile_draft(draft_id: str, request: dict, user: dict = Depends(get_current_user)):
    draft = drafts_db.get(draft_id)
    if not draft:
        raise HTTPException(404, "Draft not found")

    latex_source = request.get("latexSource")
    if not latex_source:
        raise HTTPException(400, "Missing latexSource")

    await asyncio.sleep(1)

    return {
        "success": True,
        "pdfUrl": f"https://cdn.resumeforge.io/drafts/{draft_id}/compiled.pdf",
        "atsScore": 85,
        "compileLog": "Output written on resume.pdf (2 pages, 89234 bytes).",
        "missingKeywords": ["terraform"],
        "matchedKeywords": ["react", "typescript", "kubernetes", "ci/cd"]
    }


async def run_optimization(draft_id: str):
    await asyncio.sleep(5)
    draft = drafts_db.get(draft_id)
    if draft:
        draft["status"] = "ready"
        draft["latex_source"] = r"\documentclass{article}\begin{document}Optimized Resume\end{document}"
        draft["current_score"] = 85


@app.get("/health")
async def health():
    return {
        "status": "ok",
        "pdfplumber": PDFPLUMBER_AVAILABLE,
        "pymupdf": PYMUPDF_AVAILABLE,
        "version": "1.0.0"
    }


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)