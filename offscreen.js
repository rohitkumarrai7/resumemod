(function () {
  if (typeof pdfjsLib === "undefined") {
    console.error("[Offscreen] pdfjsLib not loaded");
    return;
  }

  pdfjsLib.GlobalWorkerOptions.workerSrc = chrome.runtime.getURL(
    "lib/pdfjs/pdf.worker.min.js"
  );
  console.log(
    "[Offscreen] PDF.js worker set to:",
    pdfjsLib.GlobalWorkerOptions.workerSrc
  );

  chrome.runtime.onConnect.addListener(function (port) {
    port.onMessage.addListener(function (msg) {
      if (msg && msg.type === "extract_pdf") {
        extractPdfText(msg.base64)
          .then(function (result) {
            port.postMessage({ ok: true, text: result.text, pages: result.pages });
          })
          .catch(function (err) {
            port.postMessage({ ok: false, error: err.message || String(err) });
          });
      }
    });
  });

  async function extractPdfText(base64Data) {
    var raw = atob(base64Data);
    var bytes = new Uint8Array(raw.length);
    for (var i = 0; i < raw.length; i++) {
      bytes[i] = raw.charCodeAt(i);
    }

    console.log("[Offscreen] Loading PDF, bytes:", bytes.length);

    var loadingTask = pdfjsLib.getDocument({
      data: bytes,
      useSystemFonts: true,
    });

    var pdf = await loadingTask.promise;
    console.log("[Offscreen] PDF loaded, pages:", pdf.numPages);

    var fullText = "";
    for (var i = 1; i <= pdf.numPages; i++) {
      var page = await pdf.getPage(i);
      var content = await page.getTextContent();
      var pageText = "";

      if (content.items && content.items.length > 0) {
        var lastY = null;
        var lines = [];
        var currentLine = "";

        for (var j = 0; j < content.items.length; j++) {
          var item = content.items[j];
          var str = item.str || "";
          var y = item.transform ? item.transform[5] : null;

          if (lastY !== null && y !== null && Math.abs(y - lastY) > 2) {
            lines.push(currentLine.trim());
            currentLine = str;
          } else {
            currentLine += (currentLine && str && !currentLine.endsWith(" ") ? " " : "") + str;
          }
          lastY = y;
        }
        if (currentLine.trim()) lines.push(currentLine.trim());
        pageText = lines.join("\n");
      }

      console.log(
        "[Offscreen] Page",
        i,
        "text length:",
        pageText.length,
        "items:",
        (content.items || []).length
      );
      fullText += pageText + "\n";
    }

    fullText = fullText.trim();
    console.log("[Offscreen] Total extracted text:", fullText.length, "chars");

    if (fullText.length === 0) {
      console.log("[Offscreen] PDF.js returned empty, trying string extraction from streams");
      fullText = extractFromCompressedStreams(raw);
      console.log("[Offscreen] Stream extraction result:", fullText.length, "chars");
    }

    return { text: fullText, pages: pdf.numPages };
  }

  function extractFromCompressedStreams(raw) {
    var textParts = [];

    var parenRegex = /\(([^)]{2,})\)/g;
    var match;
    while ((match = parenRegex.exec(raw)) !== null) {
      var str = match[1]
        .replace(/\\n/g, "\n")
        .replace(/\\r/g, "\r")
        .replace(/\\t/g, "\t")
        .replace(/\\\(/g, "(")
        .replace(/\\\)/g, ")")
        .replace(/\\\\/g, "\\");
      if (/^[0-9a-fA-F\s]+$/.test(str)) continue;
      if (str.length < 2) continue;
      if (/^(\/\w+|obj|endobj|stream|endstream)$/i.test(str.trim())) continue;
      textParts.push(str);
    }

    var btBlocks = raw.match(/BT[\s\S]*?ET/g) || [];
    btBlocks.forEach(function (block) {
      var tjMatches = block.match(/\[([^\]]+)\]\s*T[Jj]/g) || [];
      tjMatches.forEach(function (m) {
        var inner = m.replace(/\]\s*T[Jj]/, "").replace(/^\[/, "");
        var parts = inner.match(/\(([^)]+)\)/g) || [];
        parts.forEach(function (p) {
          var s = p
            .slice(1, -1)
            .replace(/\\n/g, "\n")
            .replace(/\\r/g, "\r")
            .replace(/\\t/g, "\t")
            .replace(/\\\(/g, "(")
            .replace(/\\\)/g, ")")
            .replace(/\\\\/g, "\\");
          if (s.length >= 1) textParts.push(s);
        });
      });
    });

    var text = textParts.join(" ").replace(/\s+/g, " ").trim();
    var words = text.split(/\s+/).filter(function (w) { return w.length > 1; });
    return words.length > 10 ? text : "";
  }
})();
