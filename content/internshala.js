(function () {
  if (window.__RESUMOD_INTERNSHALA__) return;
  window.__RESUMOD_INTERNSHALA__ = true;

  const E = window.ResumodExtract;
  if (!E) return;

  const JD_SELECTORS = [
    ".internship_details .text-container",
    ".internship_details",
    "#details_container",
    ".details_container",
    ".about_internship_container",
    "#about_internship",
    ".about_internship",
    ".detail_view",
    'section[class*="job_detail"]',
    '[class*="internship-detail"]'
  ];

  const TITLE_SELECTORS = [
    ".heading_4_5.profile",
    ".heading_4_5",
    "h1.profile",
    ".profile_on_detail_page h3",
    ".detail_view h1",
    "h1"
  ];

  const COMPANY_SELECTORS = [
    ".company_and_premium .link_display_like_text",
    ".company_name",
    "a.link_display_like_text",
    ".company h3",
    ".company"
  ];

  const LOCATION_SELECTORS = [
    "#location_names",
    ".location_link",
    '[class*="location"]'
  ];

  E.registerSite("internshala", async () => {
    const jdEl = await E.waitFor(JD_SELECTORS, 3500);
    if (!jdEl) {
      return {
        jobDescription: "",
        jobTitle: "",
        company: "",
        location: "",
        error:
          "Couldn't find an internship/job description on this Internshala page. Open a detail page (e.g. /internship/detail/...) and try again."
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
