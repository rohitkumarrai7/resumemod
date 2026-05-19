#!/usr/bin/env python3
import sys
import subprocess
import tempfile
import json
import base64
from pathlib import Path


def compile_latex(latex_source: str, timeout: int = 30) -> dict:
    with tempfile.TemporaryDirectory() as tmpdir:
        tex_path = Path(tmpdir) / "resume.tex"
        tex_path.write_text(latex_source, encoding="utf-8")

        result = subprocess.run(
            ["latexmk", "-pdf", "-interaction=nonstopmode", "-halt-on-error",
             f"-output-directory={tmpdir}", str(tex_path)],
            capture_output=True, text=True, timeout=timeout,
        )

        pdf_path = Path(tmpdir) / "resume.pdf"

        if pdf_path.exists() and result.returncode == 0:
            pdf_bytes = pdf_path.read_bytes()
            return {
                "success": True,
                "pdf_base64": base64.b64encode(pdf_bytes).decode(),
                "log": result.stdout[-1000:],
                "pages": pdf_bytes.count(b"/Type /Page"),
            }
        else:
            return {
                "success": False,
                "error": result.stderr[-1000:] if result.stderr else "Compilation failed",
                "log": result.stdout[-1000:] if result.stdout else "",
            }


if __name__ == "__main__":
    input_data = json.loads(sys.stdin.read())
    result = compile_latex(input_data["latexSource"])
    print(json.dumps(result))
