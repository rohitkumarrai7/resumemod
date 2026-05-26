(function () {
  var STORAGE = {
    auth: "rf_auth",
    resumes: "rf_resumes",
    savedJobs: "rf_saved_jobs",
    lastAnalysis: "rf_last_analysis"
  };

  function $(sel) { return document.querySelector(sel); }

  function init() {
    loadAuthStatus();
    loadStats();
    bindActions();
  }

  async function loadAuthStatus() {
    var stored = await chrome.storage.local.get([STORAGE.auth]);
    var auth = stored[STORAGE.auth];
    var infoEl = $("#authInfo");
    var btnEl = $("#authBtn");

    if (auth && auth.token && auth.user) {
      infoEl.textContent = "Logged in as " + (auth.user.email || "");
      btnEl.textContent = "Logout";
      btnEl.onclick = function () {
        chrome.storage.local.remove(STORAGE.auth, function () {
          loadAuthStatus();
        });
      };
    } else {
      infoEl.textContent = "Not logged in";
      btnEl.textContent = "Login";
      btnEl.onclick = function () {
        chrome.runtime.sendMessage({ type: "LOGIN" });
      };
    }
  }

  async function loadStats() {
    var stored = await chrome.storage.local.get([
      STORAGE.savedJobs,
      STORAGE.lastAnalysis,
      STORAGE.resumes
    ]);

    var jobs = stored[STORAGE.savedJobs] || [];
    var last = stored[STORAGE.lastAnalysis];
    var resumes = stored[STORAGE.resumes] || [];

    $("#savedCount").textContent = jobs.length;
    $("#resumeCount").textContent = resumes.length;

    if (last && typeof last.score === "number") {
      $("#lastScore").textContent = last.score;
      $("#lastScore").style.color = last.score >= 75 ? "#047857" : last.score >= 50 ? "#d97706" : "#dc2626";
    } else {
      $("#lastScore").textContent = "\u2014";
    }
  }

  function bindActions() {
    $("#openDashboard").addEventListener("click", function () {
      var cfg = (typeof globalThis !== "undefined" && globalThis.__RESUMOD_CONFIG__) || {};
      var webBase = cfg.WEB_BASE || "http://localhost:3000";
      chrome.tabs.create({ url: webBase + "/dashboard" });
    });

    $("#openLinkedInJobs").addEventListener("click", function () {
      chrome.tabs.create({ url: "https://www.linkedin.com/jobs/" });
    });

    $("#openInternshalaJobs").addEventListener("click", function () {
      chrome.tabs.create({ url: "https://internshala.com/jobs/" });
    });

    $("#openNaukriJobs").addEventListener("click", function () {
      chrome.tabs.create({ url: "https://www.naukri.com/jobs" });
    });
  }

  document.addEventListener("DOMContentLoaded", init);
})();
