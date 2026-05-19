(function () {
  if (window.__RESUMOD_NAUKRI__) return;
  window.__RESUMOD_NAUKRI__ = true;

  const E = window.ResumodExtract;
  if (!E) return;

  const JD_SELECTORS = [
    'section[class*="styles_job-desc-container"]',
    'div[class*="styles_JDC__dang-inner-html"]',
    'div[class*="JobDescription"]',
    "section.job-desc",
    "div.dang-inner-html",
    ".job-desc",
    ".styles_job-desc-container__txpYf",
    ".styles_JDC__dang-inner-html__RgBpc",
    '[class*="job-description"]',
    '[class*="JobDesc"]'
  ];

  const TITLE_SELECTORS = [
    'h1[class*="jd-header-title"]',
    ".jd-header-title",
    ".styles_jd-header-title__rZwM1",
    "header h1",
    "h1"
  ];

  const COMPANY_SELECTORS = [
    'div[class*="jd-header-comp-name"] a',
    'div[class*="jd-header-comp-name"]',
    ".jd-header-comp-name",
    ".styles_jd-header-comp-name__MvqAI",
    'a[class*="comp-name"]'
  ];

  const LOCATION_SELECTORS = [
    '[class*="location"]',
    '[class*="place"]',
    ".nI-gNb-salaryInfo"
  ];

  E.registerSite("naukri", async () => {
    const jdEl = await E.waitFor(JD_SELECTORS, 3500);
    if (!jdEl) {
      return {
        jobDescription: "",
        jobTitle: "",
        company: "",
        location: "",
        error:
          "Couldn't find a job description on this Naukri page. Open a job detail page and try again."
      };
    }
    return {
      jobDescription: E.text(jdEl),
      jobTitle: E.text(E.firstMatch(TITLE_SELECTORS)),
      company: E.text(E.firstMatch(COMPANY_SELECTORS)),
      location: E.text(E.firstMatch(LOCATION_SELECTORS)) || ""
    };
  });
})();
