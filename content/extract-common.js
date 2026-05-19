(function () {
  if (window.__RESUMOD_COMMON__) return;
  window.__RESUMOD_COMMON__ = true;

  var Extract = {
    source: null,
    scrape: null,

    firstMatch: function (selectors) {
      for (var i = 0; i < selectors.length; i++) {
        var el = document.querySelector(selectors[i]);
        if (el && Extract.hasText(el)) return el;
      }
      return null;
    },

    hasText: function (el) {
      if (!el) return false;
      var t = (el.innerText || el.textContent || "").trim();
      return t.length > 0;
    },

    text: function (el) {
      if (!el) return "";
      return (el.innerText || el.textContent || "")
        .replace(/ /g, " ")
        .replace(/\r/g, "")
        .replace(/[ \t]{2,}/g, " ")
        .replace(/\n{3,}/g, "\n\n")
        .trim();
    },

    waitFor: function (selectors, timeoutMs) {
      var arr = Array.isArray(selectors) ? selectors : [selectors];
      timeoutMs = timeoutMs || 4000;
      return new Promise(function (resolve) {
        var find = function () { return Extract.firstMatch(arr); };
        var found = find();
        if (found) return resolve(found);

        var done = false;
        var obs = new MutationObserver(function () {
          if (done) return;
          var el = find();
          if (el) {
            done = true;
            obs.disconnect();
            resolve(el);
          }
        });
        obs.observe(document.documentElement, { childList: true, subtree: true });

        setTimeout(function () {
          if (done) return;
          done = true;
          obs.disconnect();
          resolve(null);
        }, timeoutMs);
      });
    },

    expandCollapsedText: function () {
      var patterns = [
        "button.jobs-description__footer-button",
        'button[aria-label*="show more" i]',
        'button[aria-label*="see more" i]',
        'button[aria-label*="show description" i]',
        'button[aria-label*="see more description" i]',
        ".show-more-less-html__button",
        ".feed-shared-inline-show-more-text__see-more-less-toggle",
        "button.read-more",
        "a.read-more",
        'button[class*="show-more"]',
        'button[class*="ShowMore"]'
      ];
      for (var i = 0; i < patterns.length; i++) {
        document.querySelectorAll(patterns[i]).forEach(function (btn) {
          try {
            if (btn.offsetParent !== null) btn.click();
          } catch (_) { /* ignore */ }
        });
      }
    },

    registerSite: function (source, scrapeFn) {
      Extract.source = source;
      Extract.scrape = function () {
        Extract.expandCollapsedText();
        return new Promise(function (resolve) {
          setTimeout(function () {
            resolve(scrapeFn());
          }, 250);
        });
      };
    },

    detectSchemaOrg: function () {
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
        } catch (e) { /* ignore */ }
      });
      return jobs;
    },

    extractMetaTags: function () {
      function getMeta(selectors) {
        for (var i = 0; i < selectors.length; i++) {
          var el = document.querySelector(selectors[i]);
          if (el) {
            var content = el.getAttribute("content") || "";
            if (content.trim()) return content.trim();
          }
        }
        return "";
      }
      return {
        title: getMeta(['meta[property="og:title"]', 'meta[name="twitter:title"]', 'meta[name="title"]']),
        description: getMeta(['meta[property="og:description"]', 'meta[name="twitter:description"]', 'meta[name="description"]'])
      };
    },

    detectApplyButton: function () {
      var allBtns = document.querySelectorAll('button, [role="button"], a');
      for (var i = 0; i < allBtns.length; i++) {
        var btn = allBtns[i];
        if (btn.offsetParent === null) continue;
        var text = (btn.textContent || "").trim();
        var ariaLabel = (btn.getAttribute("aria-label") || "").trim();
        if (/^apply$/i.test(text) || /apply now/i.test(text) || /apply/i.test(ariaLabel)) return btn;
      }
      return null;
    },

    extractUniversal: function () {
      var schemas = Extract.detectSchemaOrg();
      var schemaData = schemas[0] || null;
      var meta = Extract.extractMetaTags();

      var title = "";
      var company = "";
      var location = "";
      var description = "";

      if (schemaData) {
        title = schemaData.title || "";
        company = (schemaData.hiringOrganization && schemaData.hiringOrganization.name) || "";
        description = schemaData.description || "";
        if (schemaData.jobLocation) {
          var addr = schemaData.jobLocation.address || schemaData.jobLocation;
          if (typeof addr === "string") location = addr;
          else if (addr) location = [addr.addressLocality, addr.addressRegion, addr.addressCountry].filter(Boolean).join(", ");
        }
      }

      if (!title) title = Extract.text(Extract.firstMatch(["h1", 'h2[class*="title"]', '[class*="job-title"]'])) || meta.title || "";
      if (!company) company = Extract.text(Extract.firstMatch(['[class*="company"]', '[class*="Company"]'])) || "";
      if (!location) location = Extract.text(Extract.firstMatch(['[class*="location"]', '[class*="Location"]'])) || "";
      if (!description) description = Extract.text(Extract.firstMatch(['[class*="job-desc"]', '[class*="description"]', "article"])) || meta.description || "";

      return {
        jobTitle: title,
        company: company,
        location: location,
        description: description,
        salary: "",
        employmentType: (schemaData && schemaData.employmentType) || "",
        skills: [],
        postedDate: (schemaData && schemaData.datePosted) || "",
        applyUrl: (schemaData && schemaData.applicationUrl) || location.href,
        source: Extract.source || location.hostname
      };
    }
  };

  window.ResumodExtract = Extract;
})();
