(function () {
  if (window.__RESUMOD_UNIVERSAL_EXTRACTOR__) return;
  window.__RESUMOD_UNIVERSAL_EXTRACTOR__ = true;

  var E = window.ResumodExtract;

  function extractFromSchema() {
    var scripts = document.querySelectorAll('script[type="application/ld+json"]');
    for (var s = 0; s < scripts.length; s++) {
      try {
        var data = JSON.parse(scripts[s].textContent);
        var items = Array.isArray(data) ? data : [data];
        var graphItems = [];
        items.forEach(function (item) {
          if (item["@graph"]) {
            graphItems.push.apply(graphItems, item["@graph"]);
          } else {
            graphItems.push(item);
          }
        });
        for (var i = 0; i < graphItems.length; i++) {
          var item = graphItems[i];
          if (!item) continue;
          var types = Array.isArray(item["@type"]) ? item["@type"] : [item["@type"]];
          if (types.indexOf("JobPosting") !== -1) {
            var loc = item.jobLocation;
            var locStr = "";
            if (loc) {
              if (typeof loc === "string") {
                locStr = loc;
              } else {
                var addr = loc.address || loc;
                if (typeof addr === "string") {
                  locStr = addr;
                } else {
                  locStr = [addr.addressLocality, addr.addressRegion, addr.addressCountry]
                    .filter(Boolean).join(", ");
                }
              }
            }
            var salStr = "";
            if (item.baseSalary) {
              if (typeof item.baseSalary === "string") {
                salStr = item.baseSalary;
              } else {
                var val = item.baseSalary.value || {};
                if (val.minValue && val.maxValue) {
                  salStr = (val.currency || "") + " " + val.minValue + " - " + val.maxValue;
                } else if (val.value) {
                  salStr = (val.currency || "") + " " + val.value;
                }
              }
            }
            var skills = [];
            if (item.skills) {
              if (typeof item.skills === "string") {
                skills = item.skills.split(",").map(function (x) { return x.trim(); }).filter(Boolean);
              } else if (Array.isArray(item.skills)) {
                skills = item.skills;
              }
            }
            return {
              jobTitle: item.title || "",
              company: (item.hiringOrganization && item.hiringOrganization.name) || "",
              location: locStr,
              description: item.description || "",
              salary: salStr,
              employmentType: item.employmentType || "",
              skills: skills,
              postedDate: item.datePosted || "",
              applyUrl: item.applicationUrl || "",
              source: location.hostname
            };
          }
        }
      } catch (e) { /* ignore parse errors */ }
    }
    return null;
  }

  function extractFromMeta() {
    function getMeta(selectors) {
      for (var i = 0; i < selectors.length; i++) {
        var el = document.querySelector(selectors[i]);
        if (el) {
          var content = el.getAttribute("content") || el.textContent || "";
          if (content.trim()) return content.trim();
        }
      }
      return "";
    }
    return {
      title: getMeta([
        'meta[property="og:title"]',
        'meta[name="twitter:title"]',
        'meta[name="title"]'
      ]),
      description: getMeta([
        'meta[property="og:description"]',
        'meta[name="twitter:description"]',
        'meta[name="description"]'
      ])
    };
  }

  function extractFromDOM() {
    var title = "";
    var description = "";
    var company = "";
    var location = "";

    if (E) {
      title = E.text(E.firstMatch([
        "h1",
        'h2[class*="title"]',
        '[class*="job-title"]',
        '[data-testid*="job-title"]',
        '[class*="Title"]'
      ])) || "";

      description = E.text(E.firstMatch([
        '[class*="job-desc"]',
        '[class*="JobDesc"]',
        '[class*="description"]',
        '[id*="job-desc"]',
        '[class*="Description"]',
        "article",
        '[class*="details"]',
        "main section"
      ])) || "";

      company = E.text(E.firstMatch([
        '[class*="company"]',
        '[class*="Company"]',
        '[class*="organization"]',
        '[class*="employer"]'
      ])) || "";

      location = E.text(E.firstMatch([
        '[class*="location"]',
        '[class*="Location"]',
        '[class*="city"]',
        '[class*="address"]'
      ])) || "";
    }

    return { title: title, description: description, company: company, location: location };
  }

  function extractUniversal() {
    var schemaData = extractFromSchema();
    if (schemaData && schemaData.description && schemaData.description.length > 40) {
      return schemaData;
    }

    var meta = extractFromMeta();
    var dom = extractFromDOM();

    return {
      jobTitle: (schemaData && schemaData.jobTitle) || meta.title || dom.title || "",
      company: (schemaData && schemaData.company) || dom.company || "",
      location: (schemaData && schemaData.location) || dom.location || "",
      description: (schemaData && schemaData.description) || meta.description || dom.description || "",
      salary: (schemaData && schemaData.salary) || "",
      employmentType: (schemaData && schemaData.employmentType) || "",
      skills: (schemaData && schemaData.skills) || [],
      postedDate: (schemaData && schemaData.postedDate) || "",
      applyUrl: (schemaData && schemaData.applyUrl) || location.href,
      source: location.hostname
    };
  }

  window.ResumodUniversalExtractor = {
    extractUniversal: extractUniversal,
    extractFromSchema: extractFromSchema,
    extractFromMeta: extractFromMeta,
    extractFromDOM: extractFromDOM
  };
})();
