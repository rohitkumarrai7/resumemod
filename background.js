var STORAGE = {
  auth: "rf_auth",
  resumes: "rf_resumes",
  settings: "rf_settings",
  lastAnalysis: "rf_last_analysis",
  savedJobs: "rf_saved_jobs",
  syncQueue: "rf_sync_queue",
  drafts: "rf_drafts"
};

var DEFAULT_SETTINGS = {
  apiEndpoint: "https://stoic-caiman-320.convex.site/v1/ats/analyze",
  mockMode: false,
  autoOpenEditor: true
};

// LOCAL DEV: http://localhost:8000
// PRODUCTION: https://stoic-caiman-320.convex.site
var API_BASE = "https://stoic-caiman-320.convex.site";
var WEB_BASE = "http://localhost:3000";

chrome.runtime.onInstalled.addListener(async function () {
  var cur = await chrome.storage.local.get([STORAGE.settings]);
  if (!cur[STORAGE.settings]) {
    await chrome.storage.local.set({ rf_settings: DEFAULT_SETTINGS });
  }
  var migrate = await chrome.storage.local.get(["resumod_auth"]);
  if (migrate.resumod_auth && !cur[STORAGE.auth]) {
    await chrome.storage.local.set({ rf_auth: migrate.resumod_auth });
  }
  var migrateResumes = await chrome.storage.local.get(["resumod_resumes"]);
  if (migrateResumes.resumod_resumes && !cur[STORAGE.resumes]) {
    await chrome.storage.local.set({ rf_resumes: migrateResumes.resumod_resumes });
  }
});

chrome.action.onClicked.addListener(async function (tab) {
  if (!tab || !tab.id) return;

  var isJobPage = false;
  try {
    var resp = await chrome.tabs.sendMessage(tab.id, { type: "DETECT_JOB_PAGE" });
    isJobPage = resp && resp.isJobPage;
  } catch (e) {
    isJobPage = false;
  }

  if (!isJobPage) {
    var source = detectSource(tab.url || "");
    if (source) isJobPage = true;
  }

  if (!isJobPage) {
    chrome.windows.create({
      url: chrome.runtime.getURL("popup/popup.html"),
      type: "popup",
      width: 360,
      height: 480
    });
    return;
  }

  try {
    await chrome.tabs.sendMessage(tab.id, { type: "TOGGLE_SIDEBAR" });
  } catch (err) {
    try {
      await injectContentScripts(tab.id, tab.url);
      setTimeout(function () {
        chrome.tabs.sendMessage(tab.id, { type: "TOGGLE_SIDEBAR" }).catch(function () {});
      }, 80);
    } catch (injectErr) {
      console.error("[ResumeForge] Could not inject content scripts:", injectErr);
    }
  }
});

async function injectContentScripts(tabId, url) {
  var source = detectSource(url || "");
  var scripts = [
    "content/extract-common.js",
    "content/detector.js",
    "content/universal-extractor.js",
    "content/floating-button.js"
  ];
  if (source) {
    scripts.push("content/" + source + ".js");
  }
  if (/linkedin\.com/i.test(url || "")) {
    scripts.push("content/linkedin-profile.js");
  }
  scripts.push("content/sidebar.js");

  await chrome.scripting.executeScript({
    target: { tabId: tabId },
    files: scripts
  });
}

chrome.runtime.onMessage.addListener(function (msg, sender, sendResponse) {
  (async function () {
    try {
      switch (msg && msg.type) {
        case "ANALYZE_JOB": {
          var data = await analyzeJob(msg.payload || {});
          sendResponse({ ok: true, data: data });
          break;
        }
        case "SAVE_JOB": {
          var result = await saveJob(msg.payload || {});
          sendResponse({ ok: true, data: result });
          break;
        }
        case "FETCH_JOBS": {
          var jobs = await fetchSavedJobs();
          sendResponse({ ok: true, data: jobs });
          break;
        }
        case "DELETE_JOB": {
          await deleteJob((msg.payload || {}).jobId);
          sendResponse({ ok: true });
          break;
        }
        case "OPTIMIZE_LINKEDIN": {
          var optData = await optimizeLinkedIn(msg.payload || {});
          sendResponse({ ok: true, data: optData });
          break;
        }
        case "CREATE_DRAFT": {
          var draftResp = await createDraft(msg.payload || {});
          sendResponse(draftResp);
          break;
        }
        case "GET_DRAFT_STATUS": {
          var statusData = await getDraftStatus((msg.payload || {}).draftId);
          sendResponse(statusData);
          break;
        }
        case "FETCH_USER_PROFILE": {
          var profile = await fetchUserProfile();
          sendResponse({ ok: true, data: profile });
          break;
        }
        case "TRACK_ANALYTICS": {
          sendResponse({ ok: true });
          break;
        }
        case "AUTH_STATUS": {
          var auth = await getAuth();
          sendResponse({ ok: true, data: { authenticated: !!(auth && auth.token), user: auth ? auth.user : null } });
          break;
        }
        case "LOGIN": {
          var callbackUrl = chrome.runtime.getURL("callback.html");
          var loginUrl = WEB_BASE + "/extension?redirect=" + encodeURIComponent(callbackUrl);
          chrome.tabs.create({ url: loginUrl });
          sendResponse({ ok: true });
          break;
        }
        case "LOGOUT": {
          await chrome.storage.local.remove(STORAGE.auth);
          sendResponse({ ok: true });
          break;
        }
        case "TOGGLE_SIDEBAR": {
          if (sender.tab && sender.tab.id) {
            try {
              await chrome.tabs.sendMessage(sender.tab.id, { type: "TOGGLE_SIDEBAR" });
              sendResponse({ ok: true });
            } catch (err) {
              try {
                await injectContentScripts(sender.tab.id, sender.tab.url);
                setTimeout(function () {
                  chrome.tabs.sendMessage(sender.tab.id, { type: "TOGGLE_SIDEBAR" }).catch(function () {});
                }, 80);
                sendResponse({ ok: true });
              } catch (injectErr) {
                sendResponse({ ok: false, error: injectErr.message });
              }
            }
          } else {
            sendResponse({ ok: false, error: "No tab context" });
          }
          break;
        }
        case "OPEN_SIDEBAR_TAB": {
          if (sender.tab && sender.tab.id) {
            try {
              await chrome.tabs.sendMessage(sender.tab.id, {
                type: "OPEN_SIDEBAR_TAB",
                payload: msg.payload
              });
              sendResponse({ ok: true });
            } catch (err) {
              sendResponse({ ok: false, error: err.message });
            }
          } else {
            sendResponse({ ok: false, error: "No tab context" });
          }
          break;
        }
        case "DETECT_JOB_PAGE": {
          if (sender.tab && sender.tab.id) {
            try {
              var detectResp = await chrome.tabs.sendMessage(sender.tab.id, { type: "DETECT_JOB_PAGE" });
              sendResponse(detectResp || { isJobPage: false });
            } catch (err) {
              var url = sender.tab.url || "";
              var isJob = /\/jobs?\//i.test(url) || /\/careers?\//i.test(url) || /\/position\//i.test(url);
              sendResponse({ isJobPage: isJob });
            }
          } else {
            sendResponse({ isJobPage: false });
          }
          break;
        }
        case "INJECT_SIDEBAR": {
          if (sender.tab && sender.tab.id) {
            try {
              await injectContentScripts(sender.tab.id, sender.tab.url);
              sendResponse({ ok: true });
            } catch (e) {
              sendResponse({ ok: false, error: e.message });
            }
          } else {
            sendResponse({ ok: false, error: "No tab context" });
          }
          break;
        }
        case "PING_BG": {
          sendResponse({ ok: true, data: { alive: true } });
          break;
        }
        case "PARSE_PDF": {
          var base64 = (msg.payload || {}).base64 || "";
          try {
            var result = await parsePdfBase64(base64);
            sendResponse({ ok: true, data: result });
          } catch (e) {
            sendResponse({ ok: false, error: e.message });
          }
          break;
        }
        case "SEND_TO_WEB": {
          var analysis = msg.payload || {};
          var stored = await chrome.storage.local.get([STORAGE.lastAnalysis, STORAGE.resumes]);
          var last = stored[STORAGE.lastAnalysis] || {};
          var resumes = stored[STORAGE.resumes] || [];
          var resume = resumes.find(function (r) { return r.isDefault; }) || resumes[0];
          var resumeText = resume && resume.textPreview ? resume.textPreview.slice(0, 5000) : "";
          var webUrl = WEB_BASE + "/editor" +
            "?jobTitle=" + encodeURIComponent(analysis.jobTitle || last.jobTitle || "") +
            "&company=" + encodeURIComponent(analysis.company || "") +
            "&score=" + encodeURIComponent(String(analysis.score || last.score || 0)) +
            "&source=" + encodeURIComponent(analysis.source || last.source || "") +
            "&resumeText=" + encodeURIComponent(resumeText);
          chrome.tabs.create({ url: webUrl });
          sendResponse({ ok: true, url: webUrl });
          break;
        }
        default:
          sendResponse({ ok: false, error: "Unknown message type: " + (msg ? msg.type : "null") });
      }
    } catch (err) {
      sendResponse({ ok: false, error: err ? (err.message || String(err)) : "Unknown error" });
    }
  })();
  return true;
});

function detectSource(url) {
  if (!url) return null;
  if (/linkedin\.com/i.test(url)) return "linkedin";
  if (/internshala\.com/i.test(url)) return "internshala";
  if (/naukri\.com/i.test(url)) return "naukri";
  if (/indeed\.com/i.test(url)) return "indeed";
  if (/glassdoor\.com/i.test(url)) return "glassdoor";
  return null;
}

async function getAuth() {
  var stored = await chrome.storage.local.get([STORAGE.auth]);
  var auth = stored[STORAGE.auth];
  if (!auth || !auth.token) return null;
  if (Date.now() > auth.expiresAt - 60000) {
    var refreshed = await refreshToken(auth.refreshToken);
    if (!refreshed) {
      await chrome.storage.local.remove(STORAGE.auth);
      return null;
    }
    await chrome.storage.local.set({ rf_auth: refreshed });
    return refreshed;
  }
  return auth;
}

async function ensureAuth() {
  var auth = await getAuth();
  if (!auth) throw new Error("Please log in to ResumeForge.");
  return auth;
}

async function refreshToken(refreshToken) {
  try {
    var res = await fetch(API_BASE + "/v1/auth/refresh", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refreshToken: refreshToken })
    });
    if (!res.ok) return null;
    var data = await res.json();
    return {
      token: data.access,
      refreshToken: data.refresh || refreshToken,
      user: data.user || {},
      expiresAt: Date.now() + (data.expiresIn || 3600) * 1000
    };
  } catch (e) {
    return null;
  }
}

async function authHeaders() {
  var auth = await ensureAuth();
  return {
    "Authorization": "Bearer " + auth.token,
    "Content-Type": "application/json"
  };
}

async function createDraft(payload) {
  if (!payload.jobDescription) {
    return { ok: false, error: "Missing job description" };
  }

  var headers = { "Content-Type": "application/json" };
  try {
    var auth = await getAuth();
    if (auth && auth.token) {
      headers["Authorization"] = "Bearer " + auth.token;
    }
  } catch (e) { /* no auth, continue without */ }

  if (!payload.resumeBase64 && !payload.resumeText) {
    payload.resumeBase64 = "placeholder";
    payload.resumeText = "No resume uploaded - using job description for optimization";
  }

  var resumeText = payload.resumeText || "";
  if (!resumeText && payload.resumeBase64 && payload.resumeBase64 !== "placeholder") {
    var isPdfBase64 = payload.resumeMimeType === "application/pdf" || /\.pdf$/i.test(payload.resumeFilename || "");
    if (!isPdfBase64) {
      try {
        resumeText = atob(payload.resumeBase64.slice(0, 10000));
      } catch (e) {
        resumeText = "";
      }
    }
  }

  try {
    var res = await fetch(API_BASE + "/v1/drafts/create", {
      method: "POST",
      headers: headers,
      body: JSON.stringify({
        resumeBase64: payload.resumeBase64,
        resumeText: resumeText,
        jobDescription: payload.jobDescription,
        jobTitle: payload.jobTitle,
        company: payload.company,
        location: payload.location,
        jobUrl: payload.jobUrl,
        source: payload.source,
        localScore: payload.localAnalysis ? payload.localAnalysis.score : undefined,
        localMatched: payload.localAnalysis ? payload.localAnalysis.matchedKeywords : undefined,
        localMissing: payload.localAnalysis ? payload.localAnalysis.missingKeywords : undefined,
      })
    });

    if (!res.ok) {
      var errText = await res.text().catch(function () { return ""; });
      throw new Error("API " + res.status + ": " + (errText.slice(0, 200) || res.statusText));
    }

    var data = await res.json();

    await storeDraftLocally(data.draftId, {
      editorUrl: data.editorUrl,
      jobTitle: payload.jobTitle,
      company: payload.company,
      createdAt: Date.now(),
      status: "optimizing"
    });

    return { ok: true, data: data };
  } catch (err) {
    await queueForSync("create_draft", payload);
    return { ok: false, error: err.message, queued: true };
  }
}

async function getDraftStatus(draftId) {
  if (!draftId) return { ok: false, error: "No draft ID" };
  try {
    var headers = await authHeaders();
    var res = await fetch(API_BASE + "/v1/drafts/" + encodeURIComponent(draftId), {
      method: "GET",
      headers: headers
    });
    if (!res.ok) throw new Error("API " + res.status);
    var data = await res.json();
    return { ok: true, data: data };
  } catch (err) {
    return { ok: false, error: err.message };
  }
}

async function fetchUserProfile() {
  try {
    var headers = await authHeaders();
    var res = await fetch(API_BASE + "/v1/resumes/me/profile", {
      method: "GET",
      headers: headers
    });
    if (!res.ok) throw new Error("API " + res.status);
    return await res.json();
  } catch (e) {
    return null;
  }
}

async function storeDraftLocally(draftId, data) {
  var stored = await chrome.storage.local.get([STORAGE.drafts]);
  var drafts = stored[STORAGE.drafts] || {};
  drafts[draftId] = data;
  await chrome.storage.local.set({ rf_drafts: drafts });
}

async function saveJob(jobData) {
  try {
    var headers = await authHeaders();
    var res = await fetch(API_BASE + "/v1/jobs", {
      method: "POST",
      headers: headers,
      body: JSON.stringify({
        title: jobData.title,
        company: jobData.company,
        location: jobData.location,
        description: jobData.description,
        salary: jobData.salary,
        employmentType: jobData.employmentType,
        skills: jobData.skills,
        applyUrl: jobData.applyUrl,
        source: jobData.source,
        pageUrl: jobData.pageUrl
      })
    });
    if (!res.ok) {
      var text = await res.text().catch(function () { return ""; });
      throw new Error("API " + res.status + ": " + (text.slice(0, 200) || res.statusText));
    }
    return await res.json();
  } catch (err) {
    queueForSync("save_job", jobData);
    throw err;
  }
}

async function fetchSavedJobs() {
  try {
    var headers = await authHeaders();
    var res = await fetch(API_BASE + "/v1/jobs", {
      method: "GET",
      headers: headers
    });
    if (!res.ok) throw new Error("API " + res.status);
    var data = await res.json();
    return data.jobs || data;
  } catch (err) {
    var stored = await chrome.storage.local.get([STORAGE.savedJobs]);
    return stored[STORAGE.savedJobs] || [];
  }
}

async function deleteJob(jobId) {
  var stored = await chrome.storage.local.get([STORAGE.savedJobs]);
  var jobs = (stored[STORAGE.savedJobs] || []).filter(function (j) { return j.id !== jobId; });
  await chrome.storage.local.set({ rf_saved_jobs: jobs });

  try {
    if (typeof jobId === "string" && jobId.indexOf("local_") !== 0) {
      var headers = await authHeaders();
      await fetch(API_BASE + "/v1/jobs/" + encodeURIComponent(jobId), {
        method: "DELETE",
        headers: headers
      });
    }
  } catch (e) { /* ignore network errors */ }
}

async function queueForSync(type, payload) {
  var stored = await chrome.storage.local.get([STORAGE.syncQueue]);
  var queue = stored[STORAGE.syncQueue] || [];
  queue.push({
    type: type,
    payload: payload,
    retries: 0,
    createdAt: Date.now()
  });
  await chrome.storage.local.set({ rf_sync_queue: queue });
}

async function optimizeLinkedIn(payload) {
  try {
    var headers = await authHeaders();
    var res = await fetch(API_BASE + "/api/linkedin/optimize", {
      method: "POST",
      headers: headers,
      body: JSON.stringify({
        profileUrl: payload.profileUrl,
        sections: payload.sections
      })
    });
    if (!res.ok) {
      var text = await res.text().catch(function () { return ""; });
      throw new Error("API " + res.status + ": " + (text.slice(0, 200) || res.statusText));
    }
    return await res.json();
  } catch (err) {
    return mockLinkedInOptimize(payload);
  }
}

function mockLinkedInOptimize(payload) {
  var suggestions = [];
  (payload.sections || []).forEach(function (section) {
    var name = section.name;
    var text = section.text || "";
    if (name === "headline") {
      suggestions.push({ section: name, tip: "Add specific keywords to your headline (e.g., your tech stack or industry focus).", priority: "High", originalText: text.slice(0, 100) });
    }
    if (name === "about") {
      suggestions.push({ section: name, tip: "Include quantifiable achievements in your summary (e.g., 'increased revenue by 30%').", priority: "High", originalText: text.slice(0, 100) });
      suggestions.push({ section: name, tip: "Add a clear call-to-action at the end of your About section.", priority: "Medium", originalText: text.slice(0, 100) });
    }
    if (name === "experience") {
      suggestions.push({ section: name, tip: "Use strong action verbs at the start of each bullet point (Led, Built, Designed, Implemented).", priority: "High", originalText: text.slice(0, 100) });
    }
    if (name === "skills") {
      suggestions.push({ section: name, tip: "Ensure your top 3 skills match keywords from your target job descriptions.", priority: "Medium", originalText: text.slice(0, 100) });
    }
  });
  if (suggestions.length === 0) {
    suggestions.push({ section: "general", tip: "Complete all profile sections for maximum visibility.", priority: "Medium", originalText: "" });
  }
  return { suggestions: suggestions, mock: true };
}

async function analyzeJob(ctx) {
  var jobDescription = ctx.jobDescription;
  var jobTitle = ctx.jobTitle;
  var jobUrl = ctx.jobUrl;
  var source = ctx.source;
  var resumeId = ctx.resumeId;

  if (!jobDescription || jobDescription.trim().length < 40) {
    throw new Error("The job description on this page looks too short to score.");
  }

  var stored = await chrome.storage.local.get([STORAGE.resumes, STORAGE.settings]);
  var resumes = stored[STORAGE.resumes] || [];
  var settings = Object.assign({}, DEFAULT_SETTINGS, stored[STORAGE.settings] || {});

  var resume = null;
  if (resumeId) {
    resume = resumes.find(function (r) { return r.id === resumeId; });
  }
  if (!resume && resumes.length > 0) {
    resume = resumes.find(function (r) { return r.isDefault; }) || resumes[0];
  }

  if (!resume || !resume.base64) {
    throw new Error("Upload your resume in the sidebar first.");
  }

  var analysis;
  if (settings.mockMode) {
    analysis = mockAnalyze(resume, jobDescription);
  } else {
    try {
      analysis = await callAnalyzeApi(settings, { resume: resume, jobDescription: jobDescription, jobTitle: jobTitle, jobUrl: jobUrl, source: source });
    } catch (err) {
      analysis = mockAnalyze(resume, jobDescription);
      analysis.mock = true;
      analysis.mockReason = err.message;
    }
  }

  await chrome.storage.local.set({
    rf_last_analysis: {
      score: analysis.score,
      matchedKeywords: analysis.matchedKeywords,
      missingKeywords: analysis.missingKeywords,
      suggestions: analysis.suggestions,
      jobTitle: jobTitle || "",
      jobUrl: jobUrl || "",
      source: source || "",
      timestamp: Date.now(),
      resumeId: resume ? resume.id : ""
    }
  });

  return analysis;
}

async function callAnalyzeApi(settings, payload) {
  var resumeText = payload.resume.textPreview || "";
  var body = {
    resumeText: resumeText,
    jobDescription: payload.jobDescription,
    jobTitle: payload.jobTitle || "",
    mode: "standard"
  };

  var headers = { "Content-Type": "application/json" };
  try {
    var auth = await getAuth();
    if (auth && auth.token) {
      headers["Authorization"] = "Bearer " + auth.token;
    }
  } catch (e) { /* no auth, continue without */ }

  var endpoint = settings.apiEndpoint || (API_BASE + "/v1/ats/analyze");
  var res = await fetch(endpoint, {
    method: "POST",
    headers: headers,
    body: JSON.stringify(body)
  });

  if (!res.ok) {
    var text = await res.text().catch(function () { return ""; });
    throw new Error("API " + res.status + ": " + (text.slice(0, 200) || res.statusText));
  }
  var data = await res.json();
  return {
    score: data.score || 0,
    matchedKeywords: (data.matchedKeywords || []).map(function (k) { return typeof k === "string" ? k : (k.keyword || ""); }),
    missingKeywords: (data.missingKeywords || []).map(function (k) { return typeof k === "string" ? k : (k.keyword || ""); }),
    suggestions: (data.suggestions || []).map(function (s) { return typeof s === "string" ? s : s.message; }),
    breakdown: data.breakdown || null,
    estimatedAtsPassRate: data.estimatedAtsPassRate || "medium"
  };
}

function mockAnalyze(resume, jobDescription) {
  var STOP = ["and","the","for","with","you","are","our","will","have","this","that","from","your",
    "role","team","work","experience","skills","good","strong","ability",
    "responsibilities","requirements","about","into","who","what","when","where","why",
    "they","their","job","candidate","must","should","can","any","all","not","but",
    "also","well","plus","etc","including","using","new","has","had"];

  var jd = jobDescription.toLowerCase();
  var rawTokens = jd.match(/[a-z][a-z+#.\-]{2,}/g) || [];
  var freq = {};
  rawTokens.forEach(function (t) { if (STOP.indexOf(t) === -1) freq[t] = (freq[t] || 0) + 1; });
  var keywords = Object.keys(freq)
    .map(function (k) { return [k, freq[k]]; })
    .sort(function (a, b) { return b[1] - a[1]; })
    .map(function (x) { return x[0]; })
    .slice(0, 25);

  var hint = (resume.textPreview || "").toLowerCase();
  var matched, missing, score;

  if (hint) {
    matched = keywords.filter(function (k) { return hint.indexOf(k) !== -1; });
    missing = keywords.filter(function (k) { return matched.indexOf(k) === -1; });
    score = Math.min(95, Math.round((matched.length / Math.max(keywords.length, 1)) * 100));
  } else {
    var seed = hashCode(resume.filename + "|" + jobDescription.length);
    score = 55 + (seed % 36);
    var split = Math.max(4, Math.round((score / 100) * keywords.length));
    matched = keywords.slice(0, split);
    missing = keywords.slice(split);
  }

  var suggestions = [
    missing.length
      ? "Add these keywords to your resume where truthful: " + missing.slice(0, 6).join(", ") + "."
      : "Great keyword coverage \u2014 focus next on metric-driven achievements.",
    "Quantify impact in bullets (e.g. \"cut build time by 40%\", \"shipped to 12k users\").",
    "Mirror the job description's vocabulary in your most recent role bullets.",
    "Keep formatting ATS-friendly: single column, standard section headings, no tables."
  ];

  return {
    score: score,
    matchedKeywords: matched.slice(0, 18),
    missingKeywords: missing.slice(0, 18),
    suggestions: suggestions,
    mock: true
  };
}

function hashCode(s) {
  var h = 0;
  for (var i = 0; i < s.length; i++) h = ((h << 5) - h + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}

async function parsePdfBase64(base64) {
  var base64Data = base64.replace(/^data:application\/pdf;base64,/, "");
  console.log("Background: parsePdfBase64 called, base64 length:", base64Data.length);

  var url = "https://stoic-caiman-320.convex.site/v1/pdf/parse";
  console.log("Background: Making request to", url);

  var response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ base64: base64Data })
  });

  console.log("Background: Response status:", response.status);

  if (!response.ok) {
    var text = await response.text().catch(function() { return ""; });
    console.error("Background: API error response:", text.slice(0, 300));
    throw new Error("PDF parse API failed: " + response.status);
  }

  var result = await response.json();
  console.log("Background: Parsed result, text length:", result.text ? result.text.length : 0);
  if (result.error) {
    throw new Error(result.error);
  }
  if (!result.text || result.text.length < 30) {
    throw new Error("No text found in PDF. It may be a scanned document.");
  }
  return result;
}

chrome.runtime.onConnect.addListener(function () {});

if (typeof globalThis !== "undefined" && globalThis.addEventListener) {
  globalThis.addEventListener("online", function () {
    processSyncQueue();
  });
}

async function processSyncQueue() {
  var stored = await chrome.storage.local.get([STORAGE.syncQueue]);
  var queue = stored[STORAGE.syncQueue] || [];
  if (queue.length === 0) return;

  var remaining = [];
  for (var i = 0; i < queue.length; i++) {
    var item = queue[i];
    try {
      if (item.type === "save_job") {
        await saveJob(item.payload);
      } else if (item.type === "create_draft") {
        await createDraft(item.payload);
      }
    } catch (e) {
      item.retries = (item.retries || 0) + 1;
      if (item.retries < 5) {
        remaining.push(item);
      }
    }
  }
  await chrome.storage.local.set({ rf_sync_queue: remaining });
}

setTimeout(processSyncQueue, 5000);
