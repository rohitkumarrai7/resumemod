(function () {
  if (window.__RESUMOD_JD_HIGHLIGHTER__) return;
  window.__RESUMOD_JD_HIGHLIGHTER__ = true;

  var HIGHLIGHT_STYLE = {
    matched: "background: rgba(16, 185, 129, 0.15); border-bottom: 2px solid #10B981; padding: 0 2px; border-radius: 2px;",
    missing: "background: rgba(239, 68, 68, 0.12); border-bottom: 2px solid #EF4444; padding: 0 2px; border-radius: 2px;",
  };

  function highlightKeywordsInJD(matchedKeywords, missingKeywords) {
    var jdContainer = findJDContainer();
    if (!jdContainer) return;

    removeExistingHighlights(jdContainer);

    var allKeywords = [];
    matchedKeywords.forEach(function (kw) {
      allKeywords.push({ keyword: kw, type: "matched" });
    });
    missingKeywords.forEach(function (kw) {
      allKeywords.push({ keyword: kw, type: "missing" });
    });

    allKeywords.sort(function (a, b) { return b.keyword.length - a.keyword.length; });

    var walker = document.createTreeWalker(jdContainer, NodeFilter.SHOW_TEXT, null, false);
    var textNodes = [];
    var node;
    while ((node = walker.nextNode())) {
      if (node.textContent && node.textContent.trim().length > 0) {
        textNodes.push(node);
      }
    }

    textNodes.forEach(function (textNode) {
      var parent = textNode.parentNode;
      if (!parent || parent.closest("[data-resumod-highlight]")) return;
      if (parent.tagName === "SCRIPT" || parent.tagName === "STYLE") return;

      var text = textNode.textContent;
      var fragments = [];
      var lastIndex = 0;
      var matches = [];

      allKeywords.forEach(function (kwObj) {
        var regex = new RegExp("\\b" + escapeRegex(kwObj.keyword) + "\\b", "gi");
        var m;
        while ((m = regex.exec(text)) !== null) {
          matches.push({ start: m.index, end: m.index + m[0].length, type: kwObj.type, text: m[0] });
        }
      });

      matches.sort(function (a, b) { return a.start - b.start; });

      var filtered = [];
      var lastEnd = 0;
      matches.forEach(function (m) {
        if (m.start >= lastEnd) {
          filtered.push(m);
          lastEnd = m.end;
        }
      });

      if (filtered.length === 0) return;

      var frag = document.createDocumentFragment();
      filtered.forEach(function (m) {
        if (m.start > lastIndex) {
          frag.appendChild(document.createTextNode(text.slice(lastIndex, m.start)));
        }
        var span = document.createElement("span");
        span.setAttribute("data-resumod-highlight", m.type);
        span.setAttribute("style", HIGHLIGHT_STYLE[m.type]);
        span.setAttribute("title", m.type === "matched" ? "Matched in your resume" : "Missing from your resume");
        span.textContent = m.text;
        frag.appendChild(span);
        lastIndex = m.end;
      });

      if (lastIndex < text.length) {
        frag.appendChild(document.createTextNode(text.slice(lastIndex)));
      }

      parent.replaceChild(frag, textNode);
    });
  }

  function removeExistingHighlights(container) {
    var highlights = container.querySelectorAll("[data-resumod-highlight]");
    highlights.forEach(function (el) {
      var parent = el.parentNode;
      parent.replaceChild(document.createTextNode(el.textContent), el);
      parent.normalize();
    });
  }

  function findJDContainer() {
    var selectors = [
      ".jobs-description__content",
      ".jobs-description-content__text",
      ".job-description",
      ".jd-content",
      "#job-details",
      "#jobDescriptionText",
      ".jobsearch-jobDescriptionText",
      ".job_description",
      '[class*="description"]',
      '[class*="job-detail"]',
    ];

    for (var i = 0; i < selectors.length; i++) {
      var el = document.querySelector(selectors[i]);
      if (el && el.textContent && el.textContent.trim().length > 100) return el;
    }
    return null;
  }

  function escapeRegex(str) {
    return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  }

  window.ResumodJDHighlighter = {
    highlight: highlightKeywordsInJD,
    clear: function () {
      var container = findJDContainer();
      if (container) removeExistingHighlights(container);
    },
  };

  chrome.runtime.onMessage.addListener(function (msg) {
    if (msg && msg.type === "HIGHLIGHT_JD") {
      highlightKeywordsInJD(msg.payload.matchedKeywords || [], msg.payload.missingKeywords || []);
    }
    if (msg && msg.type === "CLEAR_JD_HIGHLIGHTS") {
      window.ResumodJDHighlighter.clear();
    }
  });
})();
