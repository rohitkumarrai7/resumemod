(function () {
  if (window.__RESUMOD_INDEED__) return;
  window.__RESUMOD_INDEED__ = true;

  const E = window.ResumodExtract;
  if (!E) return;

  const JD_SELECTORS = [
    '[data-testid="jobDescriptionText"]',
    '#jobDescriptionText',
    '.jobsearch-JobComponent-description',
    '#jobDescription',
    '.jobsearch-JobInfoHeader-description',
    '[class*="jobDescription"]',
    '[class*="JobDescription"]',
    '.jobsearch-ViewJobLayout-jobDescription'
  ];

  const TITLE_SELECTORS = [
    'h1[data-testid="jobsearch-JobInfoHeader-title"]',
    'h1.jobsearch-JobInfoHeader-title',
    'h1.jobsearch-JobInfoHeader-title-container',
    '.jobsearch-JobInfoHeader-title h1',
    'h1'
  ];

  const COMPANY_SELECTORS = [
    '[data-testid="company-name"]',
    '[data-testid="jobsearch-CompanyInfoContainer"] .company_name',
    '.jobsearch-CompanyInfoContainer .company_name',
    '[class*="companyName"]',
    '[class*="CompanyName"]',
    '.jobsearch-InlineCompanyRating div:first-child'
  ];

  const LOCATION_SELECTORS = [
    '[data-testid="jobsearch-JobInfoHeader-locationText"]',
    '.jobsearch-JobInfoHeader-subtitle .jobsearch-JobInfoHeader-locationText',
    '[class*="location"]',
    '[class*="Location"]'
  ];

  E.registerSite("indeed", async () => {
    const jdEl = await E.waitFor(JD_SELECTORS, 5000);
    if (!jdEl) {
      return {
        jobDescription: "",
        jobTitle: "",
        company: "",
        error: "Couldn't find a job description on this Indeed page. Open a job detail page and try again."
      };
    }

    const title = E.text(E.firstMatch(TITLE_SELECTORS));
    const company = E.text(E.firstMatch(COMPANY_SELECTORS));
    const location = E.text(E.firstMatch(LOCATION_SELECTORS));

    return {
      jobDescription: E.text(jdEl),
      jobTitle: title.replace(/ - job post$/i, "").replace(/ - \d+ reviews?$/i, "").trim(),
      company: company,
      location: location
    };
  });
})();
