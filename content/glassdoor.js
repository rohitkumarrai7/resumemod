(function () {
  if (window.__RESUMOD_GLASSDOOR__) return;
  window.__RESUMOD_GLASSDOOR__ = true;

  const E = window.ResumodExtract;
  if (!E) return;

  const JD_SELECTORS = [
    '[data-test="jobDescriptionText"]',
    '.jobDescriptionContent',
    '#JobDescriptionContainer',
    '#HeroHeaderModule .jobDescriptionContent',
    '[class*="jobDescription"]',
    '[class*="JobDescription"]',
    '.desc'
  ];

  const TITLE_SELECTORS = [
    '[data-test="jobTitle"]',
    '.jobTitle h1',
    'h1.jobTitle',
    '.HeroHeaderModule h1',
    'h1'
  ];

  const COMPANY_SELECTORS = [
    '[data-test="employer-name"]',
    '[data-test="jobEmployerName"]',
    '.employerName',
    '[class*="employerName"]',
    '[class*="EmployerName"]',
    '.HeroHeaderModule .employerName'
  ];

  const LOCATION_SELECTORS = [
    '[data-test="job-location"]',
    '.jobLocation',
    '[class*="location"]',
    '[class*="Location"]'
  ];

  E.registerSite("glassdoor", async () => {
    const jdEl = await E.waitFor(JD_SELECTORS, 5000);
    if (!jdEl) {
      return {
        jobDescription: "",
        jobTitle: "",
        company: "",
        error: "Couldn't find a job description on this Glassdoor page. Open a job detail page and try again."
      };
    }

    return {
      jobDescription: E.text(jdEl),
      jobTitle: E.text(E.firstMatch(TITLE_SELECTORS)),
      company: E.text(E.firstMatch(COMPANY_SELECTORS)),
      location: E.text(E.firstMatch(LOCATION_SELECTORS))
    };
  });
})();
