(function () {
  if (window.__RESUMOD_LINKEDIN__) return;
  window.__RESUMOD_LINKEDIN__ = true;

  const E = window.ResumodExtract;
  if (!E) return;

  const JD_SELECTORS = [
    // Modern LinkedIn (2024-2026) — used on /jobs/view, /jobs/collections,
    // /jobs/search, and the recommended-jobs split view. `#job-details` is the
    // most stable anchor we have; the rest are progressively broader fallbacks.
    "#job-details .jobs-description-content__text",
    "#job-details .jobs-box__html-content",
    "#job-details article",
    "#job-details .mt4",
    "#job-details",
    ".jobs-search__job-details--container .jobs-description-content__text",
    ".jobs-search__job-details--container",
    ".jobs-details__main-content",
    // Legacy `jobs-description` family — still present on some layouts.
    ".jobs-description__content .jobs-description-content__text",
    ".jobs-description-content__text",
    ".jobs-description__content",
    ".jobs-box__html-content",
    "article.jobs-description__container",
    "div.jobs-description",
    "div.show-more-less-html__markup",
    ".description__text",
    '[data-test-id="job-details-description"]',
    // Attribute-contains last-resort fallbacks.
    '[class*="jobs-description"]',
    '[class*="jobs-details"]',
    '[class*="JobDetails"]'
  ];

  const TITLE_SELECTORS = [
    ".job-details-jobs-unified-top-card__job-title h1",
    ".job-details-jobs-unified-top-card__job-title",
    ".jobs-unified-top-card__job-title",
    "h1.top-card-layout__title",
    'h1[class*="job-title"]',
    "h1.t-24",
    ".jobs-search__job-details--container h1",
    "main h1"
  ];

  const COMPANY_SELECTORS = [
    ".job-details-jobs-unified-top-card__company-name a",
    ".job-details-jobs-unified-top-card__company-name",
    ".jobs-unified-top-card__company-name a",
    ".jobs-unified-top-card__company-name",
    "a.topcard__org-name-link",
    ".topcard__flavor",
    ".jobs-search__job-details--container .artdeco-entity-lockup__title a",
    '[class*="company-name"] a',
    '[class*="company-name"]'
  ];

  E.registerSite("linkedin", async () => {
    const jdEl = await E.waitFor(JD_SELECTORS, 6000);
    if (!jdEl) {
      return {
        jobDescription: "",
        jobTitle: "",
        company: "",
        error:
          "Couldn't find a job description on this LinkedIn page. Open a job (e.g. from the recommended list or a /jobs/view/... URL), wait a moment for it to load, then try again."
      };
    }
    return {
      jobDescription: E.text(jdEl),
      jobTitle: E.text(E.firstMatch(TITLE_SELECTORS)),
      company: E.text(E.firstMatch(COMPANY_SELECTORS))
    };
  });
})();
