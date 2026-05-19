FROM texlive/texlive:latest

RUN useradd -m -s /bin/bash latexuser && \
    mkdir -p /app/compile && \
    chown latexuser:latexuser /app/compile

USER latexuser
WORKDIR /app/compile

COPY compile.py /app/compile.py

ENTRYPOINT ["python3", "/app/compile.py"]
