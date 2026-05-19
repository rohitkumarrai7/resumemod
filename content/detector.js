(function () {
  if (window.__RESUMOD_DETECTOR__) return;
  window.__RESUMOD_DETECTOR__ = true;

  var JOB_URL_PATTERNS = [
    /\/jobs?\//i, /\/careers?\//i, /\/position\//i,
    /\/opening\//i, /\/vacancy\//i, /\/job-listing/i,
    /\/job\b/i, /\/apply\//i, /\/recruitment/i
  ];

  var JOB_KEYWORDS = [
    "job description", "responsibilities", "qualifications",
    "apply now", "experience required", "requirements",
    "what you'll do", "about the role", "job requirements",
    "desired skills", "minimum qualifications", "preferred qualifications",
    "who we are looking for", "what you need", "key responsibilities"
  ];

  function detectJobPage() {
    var score = 0;
    var reasons = [];

    var schemas = detectSchemaOrgJobPosting();
    if (schemas.length > 0) {
      score += 60;
      reasons.push("schema.org JobPosting");
    }

    var url = location.href;
    if (JOB_URL_PATTERNS.some(function (p) { return p.test(url); })) {
      score += 20;
      reasons.push("URL pattern match");
    }

    if (detectApplyButton()) {
      score += 20;
      reasons.push("Apply button found");
    }

    var keywordMatches = detectKeywords();
    score += keywordMatches.length * 5;
    if (keywordMatches.length > 0) {
      reasons.push(keywordMatches.length + " keywords found");
    }

    return {
      isJobPage: score >= 50,
      score: score,
      reasons: reasons,
      schemaData: schemas[0] || null,
      confidence: score >= 80 ? "high" : score >= 50 ? "medium" : "low"
    };
  }

  function detectSchemaOrgJobPosting() {
    var scripts = document.querySelectorAll('script[type="application/ld+json"]');
    var jobs = [];
    scripts.forEach(function (script) {
      try {
        var data = JSON.parse(script.textContent);
        var items = Array.isArray(data) ? data : [data];
        var graphItems = [];
        items.forEach(function (item) {
          if (item["@graph"]) {
            graphItems.push.apply(graphItems, item["@graph"]);
          } else {
            graphItems.push(item);
          }
        });
        graphItems.forEach(function (item) {
          if (!item) return;
          var types = Array.isArray(item["@type"]) ? item["@type"] : [item["@type"]];
          if (types.indexOf("JobPosting") !== -1) {
            jobs.push(item);
          }
        });
      } catch (e) { /* ignore parse errors */ }
    });
    return jobs;
  }

  function detectApplyButton() {
    var allBtns = document.querySelectorAll('button, [role="button"], a');
    for (var i = 0; i < allBtns.length; i++) {
      var btn = allBtns[i];
      if (btn.offsetParent === null) continue;
      var text = (btn.textContent || "").trim();
      var ariaLabel = (btn.getAttribute("aria-label") || "").trim();
      var dataAttrs = [
        btn.getAttribute("data-test-id") || "",
        btn.className || "",
        btn.id || ""
      ].join(" ").toLowerCase();
      if (/^apply$/i.test(text) || /apply now/i.test(text) || /apply/i.test(ariaLabel)) return btn;
      if (/apply/i.test(dataAttrs) && /btn|button/i.test(btn.tagName || "")) return btn;
    }
    return null;
  }

  function detectKeywords() {
    var text = (document.body ? document.body.innerText || "" : "").toLowerCase().slice(0, 50000);
    return JOB_KEYWORDS.filter(function (kw) {
      return text.indexOf(kw.toLowerCase()) !== -1;
    });
  }

  var lastUrl = location.href;
  function watchNavigation(callback) {
    var observer = new MutationObserver(function () {
      if (location.href !== lastUrl) {
        lastUrl = location.href;
        setTimeout(function () {
          callback(detectJobPage());
        }, 1500);
      }
    });
    observer.observe(document.documentElement, { childList: true, subtree: true });
  }

  window.ResumodDetect = {
    detectJobPage: detectJobPage,
    detectSchemaOrgJobPosting: detectSchemaOrgJobPosting,
    detectApplyButton: detectApplyButton,
    detectKeywords: detectKeywords,
    watchNavigation: watchNavigation
  };
})();
