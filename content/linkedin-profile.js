(function () {
  if (window.__RESUMOD_LINKEDIN_PROFILE__) return;
  window.__RESUMOD_LINKEDIN_PROFILE__ = true;

  var E = window.ResumodExtract;

  var SECTIONS = {
    headline: {
      label: "Headline",
      selectors: [
        "h1.text-heading-xlarge",
        ".pv-text-details__left-panel h1",
        ".text-heading-xlarge"
      ]
    },
    about: {
      label: "About",
      selectors: [
        ".pv-about__summary-text",
        "#about + .pvs-header + div .pv-shared-text",
        "#about + .pvs-header + div",
        '[class*="about"]',
        'section[class*="about"] div.mt1'
      ]
    },
    experience: {
      label: "Experience",
      selectors: [
        "#experience + .pvs-header + div",
        ".pv-experience-section",
        'section[class*="experience"] .pvs-list'
      ]
    },
    education: {
      label: "Education",
      selectors: [
        "#education + .pvs-header + div",
        ".pv-education-section",
        'section[class*="education"] .pvs-list'
      ]
    },
    skills: {
      label: "Skills",
      selectors: [
        "#skills + .pvs-header + div",
        ".pv-skill-categories-section",
        'section[class*="skills"] .pvs-list'
      ]
    }
  };

  function expandProfileSections() {
    var patterns = [
      'button[aria-label*="show more" i]',
      'button[aria-label*="see more" i]',
      'button[class*="show-more"]',
      ".pv-profile-section__see-more-inline"
    ];
    for (var i = 0; i < patterns.length; i++) {
      document.querySelectorAll(patterns[i]).forEach(function (btn) {
        try { if (btn.offsetParent !== null) btn.click(); } catch (e) { /* ignore */ }
      });
    }
  }

  function scrapeProfile() {
    expandProfileSections();

    var sections = [];
    var keys = Object.keys(SECTIONS);
    for (var i = 0; i < keys.length; i++) {
      var name = keys[i];
      var config = SECTIONS[name];
      var el = null;
      if (E) {
        el = E.firstMatch(config.selectors);
      } else {
        for (var j = 0; j < config.selectors.length; j++) {
          var candidate = document.querySelector(config.selectors[j]);
          if (candidate && candidate.innerText && candidate.innerText.trim()) {
            el = candidate;
            break;
          }
        }
      }
      if (el) {
        var text = E ? E.text(el) : (el.innerText || "").trim();
        if (text) {
          sections.push({ name: name, label: config.label, text: text });
        }
      }
    }

    return {
      url: location.href,
      sections: sections
    };
  }

  function isLinkedInProfile() {
    return /linkedin\.com\/in\//i.test(location.href);
  }

  window.ResumodLinkedInProfile = {
    scrapeProfile: scrapeProfile,
    isLinkedInProfile: isLinkedInProfile
  };
})();
