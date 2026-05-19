(function () {
  if (window.__RESUMOD_SIDEBAR__) return;
  window.__RESUMOD_SIDEBAR__ = true;

  var STORAGE = {
    auth: "rf_auth",
    resumes: "rf_resumes",
    settings: "rf_settings",
    lastAnalysis: "rf_last_analysis",
    savedJobs: "rf_saved_jobs",
    syncQueue: "rf_sync_queue",
    drafts: "rf_drafts",
    activeTab: "rf_active_tab"
  };

  var shadowHost = null;
  var shadowRoot = null;
  var sidebarEl = null;
  var isMinimized = false;
  var isVisible = false;
  var currentTab = "save";
  var fileInputCleanup = null;

  chrome.runtime.onMessage.addListener(function (msg, sender, sendResponse) {
    if (msg && msg.type === "TOGGLE_SIDEBAR") {
      toggleSidebar();
      sendResponse({ ok: true, visible: isVisible });
      return false;
    }
    if (msg && msg.type === "OPEN_SIDEBAR_TAB") {
      openToTab((msg.payload && msg.payload.tab) || "save");
      sendResponse({ ok: true });
      return false;
    }
    if (msg && msg.type === "FILL_SAVE_FORM") {
      fillSaveForm(msg.payload || {});
      sendResponse({ ok: true });
      return false;
    }
    return false;
  });

  function openToTab(tab) {
    if (!shadowHost) buildSidebar();
    if (!isVisible) {
      isVisible = true;
      sidebarEl.style.transform = "translateX(0)";
    }
    if (isMinimized) {
      isMinimized = false;
      sidebarEl.classList.remove("minimized");
    }
    switchTab(tab);
  }

  function toggleSidebar() {
    if (!shadowHost) {
      buildSidebar();
      isVisible = true;
      return;
    }
    isVisible = !isVisible;
    sidebarEl.style.transform = isVisible ? "translateX(0)" : "translateX(100%)";
    if (isMinimized && isVisible) {
      isMinimized = false;
      sidebarEl.classList.remove("minimized");
    }
  }

  function buildSidebar() {
    shadowHost = document.createElement("div");
    shadowHost.id = "resumod-sidebar-shadow-host";
    shadowHost.setAttribute("style",
      "position: fixed; top: 0; right: 0; width: 400px; height: 100vh; z-index: 2147483647; pointer-events: none;"
    );
    shadowRoot = shadowHost.attachShadow({ mode: "open" });

    var container = document.createElement("div");
    container.id = "resumod-sidebar";
    container.setAttribute("style",
      "position: fixed; top: 0; right: 0; width: 400px; height: 100vh; background: rgba(244,247,252,0.9); box-shadow: -4px 0 24px rgba(0,0,0,0.18); font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; overflow: hidden; transition: transform 0.3s ease; transform: translateX(0); pointer-events: auto; z-index: 1000000;"
    );
    shadowRoot.appendChild(container);
    sidebarEl = container;
    container.innerHTML = TEMPLATE;

    document.documentElement.appendChild(shadowHost);

    bindEvents();
    refreshAuthStatus();
    refreshResumes();
    refreshLastAnalysis();
    loadSettingsIntoUI();
    updateSourceBadge();
    loadSavedJobs();
    updateLinkedInPanel();
    autoFillJobData();
    autoFillJdTextarea();
    restoreActiveTab();
  }

  function $(sel) { return sidebarEl.querySelector(sel); }
  function $$(sel) { return Array.from(sidebarEl.querySelectorAll(sel)); }

  function bindEvents() {
    $(".minimize-btn").addEventListener("click", function (e) {
      e.stopPropagation();
      isMinimized = !isMinimized;
      sidebarEl.classList.toggle("minimized", isMinimized);
    });

    $(".close-btn").addEventListener("click", function (e) {
      e.stopPropagation();
      isVisible = false;
      sidebarEl.style.transform = "translateX(100%)";
    });

    sidebarEl.addEventListener("click", function (e) {
      if (isMinimized && !e.target.closest(".close-btn")) {
        isMinimized = false;
        sidebarEl.classList.remove("minimized");
      }
    });

    $$(".tab-btn").forEach(function (btn) {
      btn.addEventListener("click", function () {
        switchTab(btn.getAttribute("data-tab"));
      });
    });

    $("#resumeInput").addEventListener("change", onPickResume);
    $("#uploadResumeBtn").addEventListener("click", function () { $("#resumeInput").click(); });
    $("#manageResumesBtn").addEventListener("click", function () {
      var card = $("#manageResumesCard");
      card.hidden = !card.hidden;
      if (!card.hidden) renderResumesList();
    });
    $("#closeManageBtn").addEventListener("click", function () {
      $("#manageResumesCard").hidden = true;
    });

    $("#analyzeBtn").addEventListener("click", onAnalyze);
    $("#saveJobBtn").addEventListener("click", onSaveJob);
    $("#settingsToggle").addEventListener("click", function (e) {
      e.stopPropagation();
      $("#settingsPanel").classList.toggle("open");
    });
    $("#saveSettingsBtn").addEventListener("click", onSaveSettings);

    $("#optimizeResumeBtn").addEventListener("click", onOptimizeResume);

    $("#loginBtn").addEventListener("click", function () {
      chrome.runtime.sendMessage({ type: "LOGIN" });
    });
    $("#logoutBtn").addEventListener("click", function () {
      chrome.runtime.sendMessage({ type: "LOGOUT" }, function () {
        refreshAuthStatus();
      });
    });

    $("#optimizeProfileBtn").addEventListener("click", onOptimizeProfile);

    chrome.storage.onChanged.addListener(function (changes, area) {
      if (area !== "local") return;
      if (changes[STORAGE.resumes]) refreshResumes();
      if (changes[STORAGE.settings]) loadSettingsIntoUI();
      if (changes[STORAGE.lastAnalysis]) refreshLastAnalysis();
      if (changes[STORAGE.savedJobs]) loadSavedJobs();
      if (changes[STORAGE.auth]) refreshAuthStatus();
    });
  }

  function switchTab(tab) {
    currentTab = tab;
    $$(".tab-btn").forEach(function (btn) {
      btn.classList.toggle("active", btn.getAttribute("data-tab") === tab);
    });
    $$(".tab-panel").forEach(function (panel) {
      var panelTab = panel.id.replace("panel-", "");
      panel.classList.toggle("active", panelTab === tab);
    });
    chrome.storage.local.set({ rf_active_tab: tab });
  }

  function restoreActiveTab() {
    chrome.storage.local.get([STORAGE.activeTab], function (result) {
      if (result[STORAGE.activeTab]) {
        switchTab(result[STORAGE.activeTab]);
      }
    });
  }

  function updateSourceBadge() {
    var source = (window.ResumodExtract && window.ResumodExtract.source) || "";
    var badge = $("#sourceBadge");
    if (badge) badge.textContent = source ? source.toUpperCase() : "—";
  }

  function autoFillJobData() {
    var E = window.ResumodExtract;
    if (E && E.scrape) {
      E.scrape().then(function (data) {
        if (data && !data.error) {
          fillSaveForm({
            jobTitle: data.jobTitle || "",
            company: data.company || "",
            description: data.jobDescription || "",
            applyUrl: location.href,
            source: E.source || location.hostname
          });
        }
      }).catch(function () {});
    } else if (window.ResumodUniversalExtractor) {
      var data = window.ResumodUniversalExtractor.extractUniversal();
      if (data) {
        fillSaveForm({
          jobTitle: data.jobTitle || "",
          company: data.company || "",
          location: data.location || "",
          description: data.description || "",
          salary: data.salary || "",
          employmentType: data.employmentType || "",
          skills: (data.skills || []).join(", "),
          applyUrl: data.applyUrl || location.href,
          source: data.source || location.hostname
        });
      }
    }
  }

  function fillSaveForm(data) {
    var title = $("#saveTitle");
    var company = $("#saveCompany");
    var location = $("#saveLocation");
    var desc = $("#saveDescription");
    var salary = $("#saveSalary");
    var type = $("#saveType");
    var skills = $("#saveSkills");
    var applyUrl = $("#saveApplyUrl");
    var source = $("#saveSource");

    if (data.jobTitle && title && !title.value) title.value = data.jobTitle;
    if (data.company && company && !company.value) company.value = data.company;
    if (data.location && location && !location.value) location.value = data.location;
    if (data.description && desc && !desc.value) desc.value = data.description;
    if (data.salary && salary && !salary.value) salary.value = data.salary;
    if (data.employmentType && type && !type.value) type.value = data.employmentType;
    if (data.skills && skills && !skills.value) skills.value = data.skills;
    if (data.applyUrl && applyUrl && !applyUrl.value) applyUrl.value = data.applyUrl;
    if (data.source && source && !source.value) source.value = data.source;
  }

  // -- Save Job flow ---------------------------------------------------

  async function onSaveJob() {
    hideError();
    var btn = $("#saveJobBtn");
    var statusEl = $("#saveStatus");
    btn.disabled = true;
    btn.textContent = "Saving…";
    statusEl.hidden = false;
    statusEl.textContent = "Saving locally…";
    statusEl.className = "save-status saving";

    var jobData = {
      title: $("#saveTitle").value.trim(),
      company: $("#saveCompany").value.trim(),
      location: $("#saveLocation").value.trim(),
      description: $("#saveDescription").value.trim(),
      salary: $("#saveSalary").value.trim(),
      employmentType: $("#saveType").value,
      skills: $("#saveSkills").value.split(",").map(function (s) { return s.trim(); }).filter(Boolean),
      applyUrl: $("#saveApplyUrl").value.trim(),
      source: $("#saveSource").value.trim() || location.hostname,
      pageUrl: location.href
    };

    try {
      var resp = await sendRuntime({ type: "SAVE_JOB", payload: jobData });
      if (resp.ok) {
        statusEl.textContent = "Saved!";
        statusEl.className = "save-status synced";
        flash("Job saved to Resumod.");
        loadSavedJobs();
      } else {
        statusEl.textContent = "Saved locally (sync pending)";
        statusEl.className = "save-status local";
        saveJobLocally(jobData);
      }
    } catch (err) {
      statusEl.textContent = "Saved locally";
      statusEl.className = "save-status local";
      saveJobLocally(jobData);
    } finally {
      btn.disabled = false;
      btn.textContent = "Save to Resumod";
      setTimeout(function () { statusEl.hidden = true; }, 3000);
    }
  }

  function saveJobLocally(jobData) {
    chrome.storage.local.get([STORAGE.savedJobs], function (result) {
      var jobs = result[STORAGE.savedJobs] || [];
      jobs.unshift({
        id: "local_" + Date.now() + "_" + Math.random().toString(36).slice(2, 8),
        title: jobData.title,
        company: jobData.company,
        location: jobData.location,
        savedAt: Date.now(),
        source: jobData.source,
        syncStatus: "local",
        payload: jobData
      });
      if (jobs.length > 50) jobs = jobs.slice(0, 50);
      chrome.storage.local.set({ rf_saved_jobs: jobs });
      loadSavedJobs();
    });
  }

  function loadSavedJobs() {
    chrome.storage.local.get([STORAGE.savedJobs], function (result) {
      var jobs = result[STORAGE.savedJobs] || [];
      var listEl = $("#savedJobsList");
      var countEl = $("#savedCount");
      if (!listEl) return;

      countEl.textContent = "(" + jobs.length + ")";

      if (jobs.length === 0) {
        listEl.innerHTML = '<div class="hint">No saved jobs yet.</div>';
        return;
      }

      listEl.innerHTML = "";
      var recent = jobs.slice(0, 5);
      recent.forEach(function (job) {
        var item = document.createElement("div");
        item.className = "saved-job-item";
        item.innerHTML =
          '<div class="saved-job-info">' +
            '<div class="saved-job-title">' + escHtml(job.title || "Untitled") + '</div>' +
            '<div class="saved-job-meta">' + escHtml(job.company || "") + (job.location ? " · " + escHtml(job.location) : "") + '</div>' +
          '</div>' +
          '<button class="btn-delete" data-job-id="' + escAttr(job.id) + '" title="Delete">✕</button>';

        listEl.appendChild(item);
      });

      listEl.querySelectorAll(".btn-delete").forEach(function (btn) {
        btn.addEventListener("click", function () {
          var jobId = btn.getAttribute("data-job-id");
          deleteJobLocal(jobId);
        });
      });
    });
  }

  function deleteJobLocal(jobId) {
    chrome.storage.local.get([STORAGE.savedJobs], function (result) {
      var jobs = (result[STORAGE.savedJobs] || []).filter(function (j) { return j.id !== jobId; });
      chrome.storage.local.set({ rf_saved_jobs: jobs });
      chrome.runtime.sendMessage({ type: "DELETE_JOB", payload: { jobId: jobId } }).catch(function () {});
      loadSavedJobs();
    });
  }

  // -- Resume handling (multi-resume) ----------------------------------

  async function onPickResume(e) {
    hideError();
    var fileInput = e.target;
    var file = fileInput.files && fileInput.files[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      showError("File too large (max 5 MB).");
      fileInput.value = "";
      return;
    }
    try {
      var base64 = await fileToBase64(file);
      var textPreview = "";

      if ((file.type && file.type.startsWith("text/")) || /\.txt$/i.test(file.name)) {
        try { textPreview = (await file.text()).slice(0, 20000); } catch (e) { }
      } else if ((file.type && file.type === "application/pdf") || /\.pdf$/i.test(file.name)) {
        try {
          var fullExtractedText = await extractTextFromPdfClient(base64);
          if (fullExtractedText && fullExtractedText.length > 30) {
            textPreview = fullExtractedText.slice(0, 20000);
          } else {
            showError("No text found in PDF. It may be a scanned document or image-based PDF. Please upload a text-based PDF.");
            fileInput.value = "";
            return;
          }
        } catch (err) {
          console.error("PDF extraction error:", err);
          showError("Failed to extract text from PDF: " + (err.message || String(err)) + ". Please upload a different PDF file.");
          fileInput.value = "";
          return;
        }
      }

      var stored = await chrome.storage.local.get([STORAGE.resumes]);
      var resumes = stored[STORAGE.resumes] || [];
      var newResume = {
        id: crypto.randomUUID ? crypto.randomUUID() : "r_" + Date.now() + "_" + Math.random().toString(36).slice(2, 10),
        filename: file.name,
        mimeType: file.type || guessMime(file.name),
        size: file.size,
        base64: base64,
        textPreview: textPreview,
        extractedText: fullExtractedText || textPreview,
        uploadedAt: Date.now(),
        label: file.name.replace(/\.[^/.]+$/, ""),
        isDefault: resumes.length === 0
      };
      resumes.push(newResume);
      await chrome.storage.local.set({ rf_resumes: resumes });
      refreshResumes();
      flash("Resume uploaded successfully.");
    } catch (err) {
      showError("Could not read file: " + (err.message || err));
    } finally {
      fileInput.value = "";
    }
  }

  function fileToBase64(file) {
    return new Promise(function (resolve, reject) {
      var r = new FileReader();
      r.onload = function () {
        var raw = String(r.result || "");
        var comma = raw.indexOf(",");
        resolve(comma >= 0 ? raw.slice(comma + 1) : raw);
      };
      r.onerror = function () { reject(r.error || new Error("read failed")); };
      r.readAsDataURL(file);
    });
  }

  async function tryReadText(file, base64) {
if ((file.type && file.type.startsWith("text/")) || /\.txt$/i.test(file.name)) {
        try { return (await file.text()).slice(0, 20000); } catch (e) { console.error("Text file read error:", e); return ""; }
      }
      if ((file.type && file.type === "application/pdf") || /\.pdf$/i.test(file.name)) {
        if (base64) {
          console.log("Attempting PDF extraction for:", file.name, "size:", file.size);
          try {
            var text = await extractTextFromPdfClient(base64);
            console.log("PDF extraction result length:", text ? text.length : 0);
            if (text && text.length > 30) {
              return text.slice(0, 20000);
            } else {
              console.log("PDF extracted text too short or empty");
            }
          } catch (e) {
            console.error("PDF extraction failed:", e);
          }
        }
      }
      return "";
  }

   var pdfJsLoadPromise = null;

   function isHumanReadable(text) {
     if (!text || text.length < 50) return false;

     var resumeKeywords = [
       'experience', 'education', 'skills', 'project', 'work',
       'developer', 'engineer', 'manager', 'senior', 'junior',
       'javascript', 'python', 'react', 'node', 'full stack',
       'university', 'college', 'degree', 'bachelor', 'master',
       'email', 'phone', 'linkedin', 'github', 'portfolio',
       'summary', 'objective', 'professional'
     ];
     var lowerText = text.toLowerCase();
     var hasResumeWords = resumeKeywords.some(function(kw) { return lowerText.includes(kw); });

     var words = text.split(/\s+/).filter(function(w) { return w.length > 2; });
     var avgWordLength = words.length > 0 ? words.reduce(function(sum, w) { return sum + w.length; }, 0) / words.length : 0;
     var hasValidWords = avgWordLength > 3 && avgWordLength < 15;

     var pdfMarkers = ['%PDF-', 'obj <<', 'endobj', 'stream', 'endstream', '/Type/', '/Font', '/Image', '/Length', '/Filter', 'FlateDecode', 'xref', 'trailer', 'startxref'];
     var hasPdfMarkers = pdfMarkers.some(function(marker) { return text.includes(marker); });

     var printableRatio = (text.match(/[\x20-\x7E]/g) || []).length / text.length;
     var isPrintable = printableRatio > 0.85;

     var isValid = (hasResumeWords || words.length > 20) && hasValidWords && !hasPdfMarkers && isPrintable;
     console.log("[ResumeForge] Text validation:", { length: text.length, hasResumeWords: hasResumeWords, avgWordLength: avgWordLength.toFixed(1), hasPdfMarkers: hasPdfMarkers, printableRatio: printableRatio.toFixed(2), isValid: isValid });

     return isValid;
   }

   async function extractTextFromPdfClient(base64) {
       var base64Data = base64.replace(/^data:application\/pdf;base64,/, "");
       console.log("[ResumeForge] Starting PDF extraction, base64 length:", base64Data.length);

       try {
         var pdfLib = await loadPdfJs();
         console.log("[ResumeForge] PDF.js loaded, processing document...");
         var text = await extractWithPdfJs(base64Data, pdfLib);
         if (text && text.length >= 30) {
           console.log("[ResumeForge] PDF.js extraction SUCCESS:", text.length, "chars");
           return text;
         }
         throw new Error("PDF text too short or empty");
       } catch (e) {
         console.error("[ResumeForge] PDF.js extraction failed:", e.message);
       }

       console.log("[ResumeForge] Falling back to server-side extraction...");
       try {
         var resp = await sendRuntime({
           type: "PARSE_PDF",
           payload: { base64: base64Data }
         });
         console.log("[ResumeForge] API response:", resp);
         if (resp && resp.ok && resp.data && resp.data.text && resp.data.text.length >= 30) {
           console.log("[ResumeForge] API extraction SUCCESS:", resp.data.text.length, "chars");
           return resp.data.text;
         }
         if (resp && resp.error) {
           throw new Error(resp.error);
         }
       } catch (e) {
         console.error("[ResumeForge] API PDF parsing failed:", e.message);
       }

        console.log("[ResumeForge] Trying basic text extraction...");
        try {
          var decoded = atob(base64Data);
          var textMatches = decoded.match(/[\x20-\x7E\n\r\t]{4,}/g) || [];
          var basicText = textMatches.join(" ").replace(/\s+/g, " ").trim();
          if (basicText.length > 100 && isHumanReadable(basicText)) {
            console.log("[ResumeForge] Basic extraction SUCCESS:", basicText.length, "chars");
            return basicText;
          }
          console.log("[ResumeForge] Basic extraction failed validation");
        } catch (e) {
          console.error("[ResumeForge] Basic extraction failed:", e.message);
        }

       throw new Error("Failed to extract text from PDF. Please try a different file.");
    }

    async function loadPdfJs() {
       if (pdfJsLoadPromise) {
         return pdfJsLoadPromise;
       }

       pdfJsLoadPromise = new Promise(function(resolve, reject) {
          if (window.pdfjsLib && window.pdfjsLib.GlobalWorkerOptions) {
            console.log("[ResumeForge] pdfjsLib already available");
            window.pdfjsLib.GlobalWorkerOptions.workerSrc = chrome.runtime.getURL("lib/pdfjs/pdf.worker.min.js");
            resolve(window.pdfjsLib);
            return;
          }

          console.log("[ResumeForge] Starting PDF.js injection...");
          var script = document.createElement("script");
          script.src = chrome.runtime.getURL("lib/pdfjs/pdf.min.js");
          script.onload = function() {
            console.log("[ResumeForge] pdf.min.js script loaded");
            console.log("[ResumeForge] window.pdfjsLib:", typeof window.pdfjsLib);
            console.log("[ResumeForge] globalThis.pdfjsLib:", typeof globalThis.pdfjsLib);

            var lib = window.pdfjsLib || window.pdfjsDistBuild || window.PDFJS || window.pdfjs ||
                      window["pdfjs-dist/build/pdf"] || globalThis.pdfjsLib || globalThis["pdfjs-dist/build/pdf"];

            if (lib && lib.getDocument) {
              console.log("[ResumeForge] pdfjsLib found!");
              window.pdfjsLib = lib;
              if (lib.GlobalWorkerOptions) {
                lib.GlobalWorkerOptions.workerSrc = chrome.runtime.getURL("lib/pdfjs/pdf.worker.min.js");
              }
              resolve(lib);
              return;
            }

            console.error("[ResumeForge] pdfjsLib not found after script load");
            console.error("[ResumeForge] globalThis keys:", Object.keys(globalThis).slice(0, 50));
            reject(new Error("pdfjsLib not defined after script load"));
          };
          script.onerror = function(e) {
            console.error("[ResumeForge] Failed to load pdf.min.js:", e);
            pdfJsLoadPromise = null;
            reject(new Error("Failed to load pdf.min.js"));
          };
          (document.head || document.documentElement).appendChild(script);
          console.log("[ResumeForge] PDF.js script appended to document.head");
        });
        return pdfJsLoadPromise;
     }

    async function extractWithPdfJs(base64Data, lib) {
       lib = lib || window.pdfjsLib;
       if (!lib) throw new Error("pdfjsLib not available");

       var data = uint8ArrayFromBase64(base64Data);
       console.log("[ResumeForge] Creating PDF doc with data length:", data.length);

       var loadingTask = lib.getDocument({ data: data });
       var pdf = await loadingTask.promise;
       console.log("[ResumeForge] PDF loaded, pages:", pdf.numPages);

       var fullText = "";
       for (var i = 1; i <= pdf.numPages; i++) {
         console.log("[ResumeForge] Extracting page", i);
         var page = await pdf.getPage(i);
         var content = await page.getTextContent();
         var pageText = content.items.map(function(item) { return item.str || ""; }).join(" ");
         fullText += pageText + "\n";
       }
       console.log("[ResumeForge] Total extracted text length:", fullText.length);
       return fullText;
    }

   function uint8ArrayFromBase64(base64) {
      var binary = atob(base64);
      var bytes = new Uint8Array(binary.length);
      for (var i = 0; i < binary.length; i++) {
        bytes[i] = binary.charCodeAt(i);
      }
      return bytes;
   }

  function guessMime(name) {
    if (/\.pdf$/i.test(name)) return "application/pdf";
    if (/\.docx$/i.test(name)) return "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
    if (/\.doc$/i.test(name)) return "application/msword";
    if (/\.txt$/i.test(name)) return "text/plain";
    return "application/octet-stream";
  }

  function autoFillJdTextarea() {
    var manualJd = $("#manualJd");
    var scrapeStatusEl = $("#scrapeStatus");
    if (!manualJd) return;

    scrapeCurrentJob().then(function (data) {
      if (data.jobDescription && data.jobDescription.trim().length >= 40) {
        manualJd.value = data.jobDescription;
        if (scrapeStatusEl) scrapeStatusEl.textContent = "JD auto-scraped from " + (data.source || "page") + " ✓";
        if (scrapeStatusEl) scrapeStatusEl.style.color = "#047857";
      } else {
        if (scrapeStatusEl) scrapeStatusEl.textContent = "Could not auto-scrape. Paste the JD below:";
        if (scrapeStatusEl) scrapeStatusEl.style.color = "#d97706";
      }
    }).catch(function () {
      if (scrapeStatusEl) scrapeStatusEl.textContent = "Paste the job description below:";
      if (scrapeStatusEl) scrapeStatusEl.style.color = "#d97706";
    });

    manualJd.addEventListener("input", function () {
      var hasJd = manualJd.value.trim().length >= 40;
      var hasResume = $("#resumeSelect").value;
      $("#analyzeBtn").disabled = !(hasJd && hasResume);
    });
  }

  async function refreshResumes() {
    var stored = await chrome.storage.local.get([STORAGE.resumes]);
    var resumes = stored[STORAGE.resumes] || [];
    var select = $("#resumeSelect");
    var infoDiv = $("#resumeInfo");
    var nameEl = $("#resumeName");
    var metaEl = $("#resumeMeta");
    var analyzeBtn = $("#analyzeBtn");

    select.innerHTML = "";
    if (resumes.length === 0) {
      var opt = document.createElement("option");
      opt.value = "";
      opt.textContent = "No resumes uploaded";
      select.appendChild(opt);
      infoDiv.hidden = true;
      analyzeBtn.disabled = true;
      return;
    }

    resumes.forEach(function (r) {
      var opt = document.createElement("option");
      opt.value = r.id;
      opt.textContent = (r.isDefault ? "★ " : "") + r.label + " (" + formatSize(r.size) + ")";
      select.appendChild(opt);
    });

    var sel = resumes.find(function (r) { return r.isDefault; }) || resumes[0];
    select.value = sel.id;
    nameEl.textContent = sel.filename;
    metaEl.textContent = formatSize(sel.size) + " · " + relTime(sel.uploadedAt);
    infoDiv.hidden = false;
    var manualJd = $("#manualJd");
    var hasJd = manualJd && manualJd.value.trim().length >= 40;
    analyzeBtn.disabled = !hasJd;
  }

  function renderResumesList() {
    chrome.storage.local.get([STORAGE.resumes], function (result) {
      var resumes = result[STORAGE.resumes] || [];
      var listEl = $("#resumesList");
      listEl.innerHTML = "";

      if (resumes.length === 0) {
        listEl.innerHTML = '<div class="hint">No resumes.</div>';
        return;
      }

      resumes.forEach(function (r) {
        var item = document.createElement("div");
        item.className = "resume-item";
        item.innerHTML =
          '<div class="resume-item-info">' +
            '<div class="file-name">' + (r.isDefault ? "★ " : "") + escHtml(r.label) + '</div>' +
            '<div class="file-meta">' + escHtml(r.filename) + " · " + formatSize(r.size) + '</div>' +
          '</div>' +
          '<div class="resume-item-actions">' +
            '<button class="btn btn-text btn-sm btn-set-default" data-id="' + escAttr(r.id) + '" title="Set default">' + (r.isDefault ? "Default" : "Set Default") + '</button>' +
            '<button class="btn btn-text btn-sm btn-rename" data-id="' + escAttr(r.id) + '" title="Rename">✎</button>' +
            '<button class="btn-delete btn-sm btn-del-resume" data-id="' + escAttr(r.id) + '" title="Delete">✕</button>' +
          '</div>';
        listEl.appendChild(item);
      });

      listEl.querySelectorAll(".btn-set-default").forEach(function (btn) {
        btn.addEventListener("click", function () {
          setDefaultResume(btn.getAttribute("data-id"));
        });
      });
      listEl.querySelectorAll(".btn-rename").forEach(function (btn) {
        btn.addEventListener("click", function () {
          var newLabel = prompt("Enter new label:", "");
          if (newLabel && newLabel.trim()) renameResume(btn.getAttribute("data-id"), newLabel.trim());
        });
      });
      listEl.querySelectorAll(".btn-del-resume").forEach(function (btn) {
        btn.addEventListener("click", function () {
          deleteResume(btn.getAttribute("data-id"));
        });
      });
    });
  }

  async function setDefaultResume(id) {
    var stored = await chrome.storage.local.get([STORAGE.resumes]);
    var resumes = stored[STORAGE.resumes] || [];
    resumes.forEach(function (r) { r.isDefault = (r.id === id); });
    await chrome.storage.local.set({ rf_resumes: resumes });
    refreshResumes();
    renderResumesList();
  }

  async function renameResume(id, newLabel) {
    var stored = await chrome.storage.local.get([STORAGE.resumes]);
    var resumes = stored[STORAGE.resumes] || [];
    var r = resumes.find(function (x) { return x.id === id; });
    if (r) { r.label = newLabel; await chrome.storage.local.set({ rf_resumes: resumes }); }
    refreshResumes();
    renderResumesList();
  }

  async function deleteResume(id) {
    var stored = await chrome.storage.local.get([STORAGE.resumes]);
    var resumes = (stored[STORAGE.resumes] || []).filter(function (r) { return r.id !== id; });
    if (resumes.length > 0 && !resumes.some(function (r) { return r.isDefault; })) {
      resumes[0].isDefault = true;
    }
    await chrome.storage.local.set({ rf_resumes: resumes });
    refreshResumes();
    renderResumesList();
  }

  // -- Analyze flow ----------------------------------------------------

  async function onAnalyze() {
    hideError();
    var btn = $("#analyzeBtn");
    var original = btn.innerHTML;
    btn.disabled = true;
    btn.classList.add("loading");
    btn.textContent = "Reading job description…";

    try {
      var jobData = await scrapeCurrentJob();

      var manualJd = $("#manualJd");
      if ((!jobData.jobDescription || jobData.jobDescription.trim().length < 40) && manualJd && manualJd.value.trim().length >= 40) {
        jobData.jobDescription = manualJd.value.trim();
      }

      if (!jobData.jobDescription || jobData.jobDescription.trim().length < 40) {
        throw new Error("Could not auto-scrape the JD. Paste it in the text area above and try again.");
      }

      if (manualJd && !manualJd.value.trim()) {
        manualJd.value = jobData.jobDescription;
      }

      var resumeId = $("#resumeSelect").value;
      if (!resumeId) throw new Error("Please select a resume first.");

      btn.textContent = "Scoring against your resume…";

      var resp = await sendRuntime({
        type: "ANALYZE_JOB",
        payload: {
          resumeId: resumeId,
          jobDescription: jobData.jobDescription,
          jobTitle: jobData.jobTitle || "",
          company: jobData.company || "",
          jobUrl: location.href,
          source: jobData.source || ""
        }
      });
      if (!resp.ok) throw new Error(resp.error);

      renderResults(resp.data, {
        jobTitle: jobData.jobTitle,
        company: jobData.company,
        source: jobData.source
      });
    } catch (err) {
      showError(err.message || String(err));
    } finally {
      btn.disabled = false;
      btn.classList.remove("loading");
      btn.innerHTML = original;
    }
  }

  async function scrapeCurrentJob() {
    var E = window.ResumodExtract;
    if (E && E.scrape) {
      var scraped = await E.scrape();
      if (!scraped.error && scraped.jobDescription) {
        return {
          jobDescription: scraped.jobDescription,
          jobTitle: scraped.jobTitle || "",
          company: scraped.company || "",
          source: E.source || ""
        };
      }
    }
    if (window.ResumodUniversalExtractor) {
      var data = window.ResumodUniversalExtractor.extractUniversal();
      if (data && data.description) {
        return {
          jobDescription: data.description,
          jobTitle: data.jobTitle || "",
          company: data.company || "",
          source: data.source || ""
        };
      }
    }
    return { jobDescription: "", jobTitle: "", company: "", source: "" };
  }

  function sendRuntime(msg) {
    return new Promise(function (resolve) {
      chrome.runtime.sendMessage(msg, function (resp) {
        if (chrome.runtime.lastError) {
          resolve({ ok: false, error: chrome.runtime.lastError.message });
        } else {
          resolve(resp || { ok: false, error: "Empty response from background." });
        }
      });
    });
  }

  function renderResults(analysis, ctx) {
    $("#results").hidden = false;

    var score = Math.max(0, Math.min(100, Math.round(Number(analysis.score) || 0)));
    $("#scoreNum").textContent = score;
    var ringColor = score >= 75 ? "#00cc61" : score >= 50 ? "#f59e0b" : "#ef4444";
    $("#scoreRing").style.background = "conic-gradient(" + ringColor + " " + (score * 3.6) + "deg, rgba(0,64,80,0.12) 0)";

    $("#jobTitleOut").textContent = ctx.jobTitle || "(job title unknown)";
    var srcLabel = (ctx.source || "").toUpperCase();
    $("#jobSrcOut").textContent =
      [srcLabel, ctx.company || "", analysis.mock ? "demo score" : ""].filter(Boolean).join(" · ");

    renderPills("#matchedRow", analysis.matchedKeywords, "match");
    $("#matchedCount").textContent = "(" + (analysis.matchedKeywords || []).length + ")";

    renderPills("#missingRow", analysis.missingKeywords, "miss");
    $("#missingCount").textContent = "(" + (analysis.missingKeywords || []).length + ")";

    var sl = $("#suggestionsList");
    sl.textContent = "";
    (analysis.suggestions || []).forEach(function (s) {
      var li = document.createElement("li");
      li.textContent = s;
      sl.appendChild(li);
    });

    var optimizeBtn = $("#optimizeResumeBtn");
    var optimizeHint = $("#optimizeHint");
    if (optimizeBtn) {
      optimizeBtn.style.display = "block";
      optimizeHint.style.display = "block";
    }
  }

  function renderPills(selector, items, variant) {
    var host = $(selector);
    host.textContent = "";
    (items || []).forEach(function (k) {
      var span = document.createElement("span");
      span.className = "pill " + (variant === "miss" ? "pill-miss" : "pill-match");
      span.textContent = k;
      host.appendChild(span);
    });
  }

  async function refreshLastAnalysis() {
    var stored = await chrome.storage.local.get([STORAGE.lastAnalysis]);
    var last = stored[STORAGE.lastAnalysis];
    if (last && typeof last.score === "number") {
      renderResults(last, { jobTitle: last.jobTitle, company: "", source: last.source });
    }
  }

  async function onOptimizeResume() {
    hideError();
    var btn = $("#optimizeResumeBtn");
    btn.disabled = true;
    btn.querySelector(".btn-label").textContent = "Sending to editor...";

    try {
      var stored = await chrome.storage.local.get([STORAGE.resumes, STORAGE.lastAnalysis]);
      var resumes = stored[STORAGE.resumes] || [];
      var analysis = stored[STORAGE.lastAnalysis];
      var resume = resumes.find(function (r) { return r.isDefault; }) || resumes[0];

      if (!resume || !resume.base64) {
        throw new Error("Upload a resume first.");
      }
      if (!analysis) {
        throw new Error("Run an analysis first before optimizing.");
      }

      var manualJd = $("#manualJd");
      var jobDescription = "";
      if (manualJd && manualJd.value.trim().length >= 40) {
        jobDescription = manualJd.value.trim();
      } else {
        var jobData = await scrapeCurrentJob();
        jobDescription = jobData.jobDescription || "";
      }

      if (!jobDescription) {
        throw new Error("Could not read job description. Paste it in the text area and try again.");
      }

      var resumeToSend = resume.extractedText || resume.textPreview || "";
      var isPdf = resume.mimeType === "application/pdf" || /\.pdf$/i.test(resume.filename || "");
      console.log("[ResumeForge] Stored extractedText length:", resume.extractedText ? resume.extractedText.length : 0);
      console.log("[ResumeForge] Stored textPreview length:", resume.textPreview ? resume.textPreview.length : 0);
      console.log("[ResumeForge] resumeToSend length:", resumeToSend.length);

      var isValidText = isHumanReadable(resumeToSend);

      if (!isValidText && isPdf && resume.base64) {
        console.log("[ResumeForge] Stored text invalid (not human-readable), trying re-extraction...");
        try {
          var extractedText = await extractTextFromPdfClient(resume.base64);
          if (extractedText && extractedText.length > 100 && isHumanReadable(extractedText)) {
            resumeToSend = extractedText;
            resume.extractedText = extractedText;
            resume.textPreview = extractedText.slice(0, 20000);
            var storedR = await chrome.storage.local.get([STORAGE.resumes]);
            var resumesR = storedR[STORAGE.resumes] || [];
            var idx = resumesR.findIndex(function(r) { return r.id === resume.id; });
            if (idx >= 0) {
              resumesR[idx] = resume;
              await chrome.storage.local.set({ rf_resumes: resumesR });
            }
            console.log("[ResumeForge] Re-extraction success:", extractedText.length, "chars");
          }
        } catch (e) {
          console.error("[ResumeForge] Re-extraction failed:", e);
        }
      } else if (isValidText) {
        console.log("[ResumeForge] Stored text is valid, using without re-extraction");
      }

      if (!resumeToSend || resumeToSend.length < 50) {
        console.error("[ResumeForge] No valid text available");
        showError("Could not extract text from resume. Please upload a text-based PDF or TXT file.");
        btn.disabled = false;
        btn.querySelector(".btn-label").textContent = "Optimize Resume";
        return;
      }

      console.log("[ResumeForge] Final resumeToSend length:", resumeToSend.length);

      var resp = await sendRuntime({
        type: "CREATE_DRAFT",
        payload: {
          resumeBase64: resume.base64,
          resumeText: resumeToSend,
          resumeFilename: resume.filename,
          resumeMimeType: resume.mimeType,
          jobDescription: jobDescription,
          jobTitle: analysis.jobTitle || "",
          company: "",
          location: "",
          jobUrl: analysis.jobUrl || location.href,
          source: analysis.source || "",
          localAnalysis: {
            score: analysis.score,
            matchedKeywords: analysis.matchedKeywords || [],
            missingKeywords: analysis.missingKeywords || [],
            suggestions: analysis.suggestions || []
          }
        }
      });

      if (resp.ok && resp.data && resp.data.editorUrl) {
        var editorUrlWithResume = resp.data.editorUrl;
        if (resumeToSend && !editorUrlWithResume.includes("resumeText=")) {
          editorUrlWithResume += (editorUrlWithResume.includes("?") ? "&" : "?") + "resumeText=" + encodeURIComponent(resumeToSend.slice(0, 5000));
        }
        window.open(editorUrlWithResume, "_blank");
        flash("Editor opened! Optimizing your resume...");
      } else if (resp.ok && resp.data && resp.data.draftId) {
        var editorUrl = "http://localhost:3000/editor?draft=" + resp.data.draftId;
        if (resumeToSend) {
          editorUrl += "&resumeText=" + encodeURIComponent(resumeToSend.slice(0, 5000));
        }
        window.open(editorUrl, "_blank");
        flash("Editor opened! Optimizing your resume...");
      } else {
        throw new Error((resp.error) || "Failed to create draft. Make sure you are logged in.");
      }
    } catch (err) {
      showError(err.message || String(err));
    } finally {
      btn.disabled = false;
      btn.querySelector(".btn-label").textContent = "Optimize Resume";
    }
  }

  // -- LinkedIn Optimization -------------------------------------------

  function updateLinkedInPanel() {
    var isProfile = window.ResumodLinkedInProfile && window.ResumodLinkedInProfile.isLinkedInProfile();
    var stateEl = $("#linkedinState");
    var contentEl = $("#linkedinContent");

    if (isProfile) {
      stateEl.hidden = true;
      contentEl.hidden = false;
      showProfileSections();
    } else {
      stateEl.hidden = false;
      contentEl.hidden = true;
      var hint = $("#linkedinHint");
      if (/linkedin\.com/i.test(location.href)) {
        hint.textContent = "Navigate to a profile page (linkedin.com/in/...) to use optimization tools.";
      } else {
        hint.textContent = "Open a LinkedIn profile page to use optimization tools.";
      }
    }
  }

  function showProfileSections() {
    if (!window.ResumodLinkedInProfile) return;
    var profile = window.ResumodLinkedInProfile.scrapeProfile();
    var listEl = $("#profileSectionsList");
    listEl.innerHTML = "";

    if (profile.sections.length === 0) {
      listEl.innerHTML = '<div class="hint">No profile sections detected. Make sure the profile is fully loaded.</div>';
      return;
    }

    profile.sections.forEach(function (sec) {
      var div = document.createElement("div");
      div.className = "profile-section-item";
      div.innerHTML =
        '<div class="profile-section-label">' + escHtml(sec.label) + '</div>' +
        '<div class="profile-section-preview">' + escHtml(sec.text.slice(0, 120)) + (sec.text.length > 120 ? "…" : "") + '</div>';
      listEl.appendChild(div);
    });
  }

  async function onOptimizeProfile() {
    hideError();
    if (!window.ResumodLinkedInProfile) return;

    var btn = $("#optimizeProfileBtn");
    btn.disabled = true;
    btn.classList.add("loading");
    btn.textContent = "Analyzing profile…";

    try {
      var profile = window.ResumodLinkedInProfile.scrapeProfile();
      if (profile.sections.length === 0) {
        throw new Error("No profile sections detected. Scroll down to load all sections and try again.");
      }

      var resp = await sendRuntime({
        type: "OPTIMIZE_LINKEDIN",
        payload: {
          profileUrl: profile.url,
          sections: profile.sections.map(function (s) { return { name: s.name, text: s.text }; })
        }
      });
      if (!resp.ok) throw new Error(resp.error);

      renderLinkedInResults(resp.data);
    } catch (err) {
      showError(err.message || String(err));
    } finally {
      btn.disabled = false;
      btn.classList.remove("loading");
      btn.textContent = "Analyze Profile";
    }
  }

  function renderLinkedInResults(data) {
    var resultsEl = $("#linkedinResults");
    var accordionEl = $("#linkedinAccordion");
    resultsEl.hidden = false;
    accordionEl.innerHTML = "";

    var suggestions = data.suggestions || [];
    if (suggestions.length === 0) {
      accordionEl.innerHTML = '<div class="hint">No suggestions available.</div>';
      return;
    }

    var bySection = {};
    suggestions.forEach(function (s) {
      var key = s.section || "general";
      if (!bySection[key]) bySection[key] = [];
      bySection[key].push(s);
    });

    Object.keys(bySection).forEach(function (sectionName) {
      var items = bySection[sectionName];
      var sectionDiv = document.createElement("div");
      sectionDiv.className = "accordion-section";

      var header = document.createElement("div");
      header.className = "accordion-header";
      header.innerHTML =
        '<span>' + escHtml(capitalize(sectionName)) + ' (' + items.length + ' tips)</span>' +
        '<span class="chev">▾</span>';

      var body = document.createElement("div");
      body.className = "accordion-body";

      items.forEach(function (item) {
        var tipDiv = document.createElement("div");
        tipDiv.className = "tip-item";
        var priorityClass = (item.priority || "").toLowerCase() === "high" ? "priority-high" :
                            (item.priority || "").toLowerCase() === "medium" ? "priority-medium" : "priority-low";
        tipDiv.innerHTML =
          '<div class="tip-header">' +
            '<span class="priority-badge ' + priorityClass + '">' + escHtml(item.priority || "Low") + '</span>' +
            '<button class="btn btn-text btn-sm btn-copy-tip" title="Copy">Copy</button>' +
          '</div>' +
          '<div class="tip-text">' + escHtml(item.tip || "") + '</div>' +
          (item.originalText ? '<div class="tip-original">Original: ' + escHtml(item.originalText.slice(0, 150)) + (item.originalText.length > 150 ? "…" : "") + '</div>' : '');
        body.appendChild(tipDiv);

        tipDiv.querySelector(".btn-copy-tip").addEventListener("click", function () {
          navigator.clipboard.writeText(item.tip || "").then(function () {
            flash("Copied to clipboard!");
          }).catch(function () {});
        });
      });

      header.addEventListener("click", function () {
        body.classList.toggle("open");
        header.classList.toggle("open");
      });

      sectionDiv.appendChild(header);
      sectionDiv.appendChild(body);
      accordionEl.appendChild(sectionDiv);
    });
  }

  // -- Auth ------------------------------------------------------------

  async function refreshAuthStatus() {
    var stored = await chrome.storage.local.get([STORAGE.auth]);
    var auth = stored[STORAGE.auth];
    var statusEl = $("#authStatus");
    var loginBtn = $("#loginBtn");
    var logoutBtn = $("#logoutBtn");

    if (auth && auth.token && auth.user) {
      statusEl.textContent = "Logged in as " + (auth.user.email || "");
      loginBtn.hidden = true;
      logoutBtn.hidden = false;
    } else {
      statusEl.textContent = "Not logged in";
      loginBtn.hidden = false;
      logoutBtn.hidden = true;
    }
  }

  // -- Settings --------------------------------------------------------

  async function loadSettingsIntoUI() {
    var stored = await chrome.storage.local.get([STORAGE.settings]);
    var cfg = stored[STORAGE.settings] || {};
    var endpointEl = $("#apiEndpoint");
    var mockEl = $("#mockMode");
    if (endpointEl) endpointEl.value = cfg.apiEndpoint || "";
    if (mockEl) mockEl.checked = cfg.mockMode !== false;
  }

  async function onSaveSettings() {
    var cfg = {
      apiEndpoint: $("#apiEndpoint").value.trim() || "https://stoic-caiman-320.convex.site/v1/ats/analyze",
      mockMode: $("#mockMode").checked
    };
    await chrome.storage.local.set({ rf_settings: cfg });
    $("#settingsPanel").classList.remove("open");
    flash("Settings saved.");
  }

  // -- UI helpers ------------------------------------------------------

  function showError(msg) {
    var b = $("#errorBanner");
    b.textContent = msg;
    b.hidden = false;
    b.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }
  function hideError() { $("#errorBanner").hidden = true; }

  function flash(msg) {
    var t = $("#toast");
    t.textContent = msg;
    t.classList.add("show");
    setTimeout(function () { t.classList.remove("show"); }, 2400);
  }

  function formatSize(n) {
    if (!n && n !== 0) return "";
    if (n < 1024) return n + " B";
    if (n < 1024 * 1024) return (n / 1024).toFixed(1) + " KB";
    return (n / 1024 / 1024).toFixed(2) + " MB";
  }

  function relTime(ts) {
    if (!ts) return "";
    var s = Math.floor((Date.now() - ts) / 1000);
    if (s < 60) return "just now";
    if (s < 3600) return Math.floor(s / 60) + "m ago";
    if (s < 86400) return Math.floor(s / 3600) + "h ago";
    return Math.floor(s / 86400) + "d ago";
  }

  function escHtml(str) {
    var d = document.createElement("div");
    d.textContent = str || "";
    return d.innerHTML;
  }

  function escAttr(str) {
    return (str || "").replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/'/g, "&#39;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  }

  function capitalize(s) { return s.charAt(0).toUpperCase() + s.slice(1); }

  // -- Template --------------------------------------------------------

  var TEMPLATE =
    '<div class="window-frame">' +
      '<div class="glass-accent"></div>' +

      '<div class="header">' +
        '<div class="header-left">' +
          '<div class="app-icon">R</div>' +
          '<div class="header-titles">' +
             '<div class="app-title">ResumeForge</div>' +
            '<div class="app-sub">ATS Optimizer</div>' +
          '</div>' +
          '<span class="src-badge" id="sourceBadge">\u2014</span>' +
        '</div>' +
        '<div class="window-controls">' +
          '<button class="control-btn minimize-btn" title="Minimize"></button>' +
          '<button class="control-btn close-btn" title="Close"></button>' +
        '</div>' +
      '</div>' +

      '<div class="tab-bar">' +
        '<button class="tab-btn active" data-tab="save">Save Job</button>' +
        '<button class="tab-btn" data-tab="ats">Resume Fit</button>' +
        '<button class="tab-btn" data-tab="linkedin">LinkedIn</button>' +
      '</div>' +

      '<div class="container tab-panel active" id="panel-save">' +
        '<div class="card">' +
          '<div class="section-title">Job Details</div>' +
          '<label class="fld"><span>Job Title</span><input type="text" id="saveTitle" placeholder="e.g. Senior Frontend Engineer" /></label>' +
          '<label class="fld"><span>Company</span><input type="text" id="saveCompany" placeholder="e.g. Google" /></label>' +
          '<label class="fld"><span>Location</span><input type="text" id="saveLocation" placeholder="e.g. San Francisco, CA" /></label>' +
          '<label class="fld"><span>Description</span><textarea id="saveDescription" rows="4" placeholder="Job description..."></textarea></label>' +
          '<label class="fld"><span>Salary (optional)</span><input type="text" id="saveSalary" placeholder="e.g. $120k - $180k" /></label>' +
          '<label class="fld"><span>Employment Type</span>' +
            '<select id="saveType">' +
              '<option value="">Select...</option>' +
              '<option value="FULL_TIME">Full-time</option>' +
              '<option value="PART_TIME">Part-time</option>' +
              '<option value="CONTRACT">Contract</option>' +
              '<option value="INTERNSHIP">Internship</option>' +
            '</select>' +
          '</label>' +
          '<label class="fld"><span>Skills (comma-separated)</span><input type="text" id="saveSkills" placeholder="React, Node.js, Python" /></label>' +
          '<label class="fld"><span>Apply URL</span><input type="text" id="saveApplyUrl" placeholder="https://..." /></label>' +
          '<label class="fld"><span>Source</span><input type="text" id="saveSource" readonly /></label>' +
          '<button class="btn btn-primary full-width" id="saveJobBtn">Save to Resumod</button>' +
          '<div id="saveStatus" class="save-status" hidden></div>' +
        '</div>' +
        '<div class="card">' +
          '<div class="section-title">Recently Saved <span class="count" id="savedCount">(0)</span></div>' +
          '<div id="savedJobsList" class="saved-jobs-list">' +
            '<div class="hint">No saved jobs yet.</div>' +
          '</div>' +
        '</div>' +
      '</div>' +

      '<div class="container tab-panel" id="panel-ats">' +
        '<div class="card">' +
          '<div class="section-title">Select Resume</div>' +
          '<div class="resume-selector-row">' +
            '<select id="resumeSelect" class="resume-select"></select>' +
            '<button class="btn btn-outline btn-sm" id="uploadResumeBtn">+ Upload</button>' +
          '</div>' +
          '<input type="file" id="resumeInput" accept=".pdf,.docx,.doc,.txt,.rtf" hidden />' +
          '<div id="resumeInfo" class="resume-info" hidden>' +
            '<div class="file-row">' +
              '<div class="file-info">' +
                '<div class="file-name" id="resumeName"></div>' +
                '<div class="file-meta" id="resumeMeta"></div>' +
              '</div>' +
              '<button class="btn btn-outline btn-sm" id="manageResumesBtn">Manage</button>' +
            '</div>' +
          '</div>' +
        '</div>' +

        '<div class="card" id="manageResumesCard" hidden>' +
          '<div class="section-title">Manage Resumes <button class="btn btn-text btn-sm" id="closeManageBtn">Close</button></div>' +
          '<div id="resumesList" class="resumes-list"></div>' +
        '</div>' +

        '<div class="card">' +
          '<div class="section-title">Job Description</div>' +
          '<div class="hint" id="scrapeStatus" style="margin-top:0;margin-bottom:8px;">Auto-scraping from page...</div>' +
          '<textarea id="manualJd" rows="5" placeholder="Paste the job description here if auto-scrape fails..." style="width:100%;padding:7px 10px;font-size:12px;font-family:inherit;border:1px solid rgba(15,23,42,0.14);border-radius:6px;resize:vertical;min-height:60px;background:#fff;"></textarea>' +
        '</div>' +

        '<div class="card">' +
          '<button class="start-btn" id="analyzeBtn" disabled>' +
            '<span class="btn-label">Analyze this Job</span>' +
          '</button>' +
          '<div class="hint" id="tipLine">Upload a resume and provide a job description to analyze your fit.</div>' +
        '</div>' +

        '<div class="card results" id="results" hidden>' +
          '<div class="score-wrap">' +
            '<div class="score-ring" id="scoreRing">' +
              '<div class="score-inner">' +
                '<div class="score-num" id="scoreNum">\u2014</div>' +
                '<div class="score-lbl">ATS score</div>' +
              '</div>' +
            '</div>' +
            '<div class="job-meta">' +
              '<div class="job-title" id="jobTitleOut"></div>' +
              '<div class="job-src" id="jobSrcOut"></div>' +
            '</div>' +
          '</div>' +
          '<div class="section-title tight">Matched keywords <span class="count" id="matchedCount"></span></div>' +
          '<div class="pill-row" id="matchedRow"></div>' +
          '<div class="section-title tight">Missing keywords <span class="count" id="missingCount"></span></div>' +
          '<div class="pill-row" id="missingRow"></div>' +
          '<div class="section-title tight">Suggestions</div>' +
          '<ul class="sug-list" id="suggestionsList"></ul>' +
          '<button class="start-btn optimize-btn" id="optimizeResumeBtn" style="display:none;margin-top:12px;">' +
            '<span class="btn-label">Optimize Resume</span>' +
          '</button>' +
          '<div class="hint" id="optimizeHint" style="display:none;font-size:11px;color:#64748b;margin-top:8px;text-align:center;">' +
            'Sends resume + JD + analysis to the editor. Login required.' +
          '</div>' +
        '</div>' +

        '<section class="card settings-card">' +
          '<div class="settings-head" id="settingsToggle">' +
            '<span>Settings</span>' +
            '<span class="chev">\u25BE</span>' +
          '</div>' +
          '<div class="settings-body" id="settingsPanel">' +
             '<label class="fld"><span>Endpoint</span><input type="text" id="apiEndpoint" placeholder="https://api.resumeforge.io/v1/ats/analyze" /></label>' +
            '<label class="chk"><input type="checkbox" id="mockMode" /><span>Use local mock scoring (demo mode)</span></label>' +
            '<button class="btn btn-primary save-btn" id="saveSettingsBtn">Save settings</button>' +
          '</div>' +
        '</section>' +
      '</div>' +

      '<div class="container tab-panel" id="panel-linkedin">' +
        '<div id="linkedinState">' +
          '<div class="card">' +
            '<div class="hint" id="linkedinHint">Open a LinkedIn profile page to use optimization tools.</div>' +
          '</div>' +
        '</div>' +
        '<div id="linkedinContent" hidden>' +
          '<div class="card">' +
            '<div class="section-title">Profile Sections Detected</div>' +
            '<div id="profileSectionsList" class="profile-sections-list"></div>' +
            '<button class="start-btn" id="optimizeProfileBtn"><span class="btn-label">Analyze Profile</span></button>' +
          '</div>' +
          '<div class="card" id="linkedinResults" hidden>' +
            '<div class="section-title">Optimization Suggestions</div>' +
            '<div id="linkedinAccordion" class="accordion"></div>' +
          '</div>' +
        '</div>' +
      '</div>' +

      '<div class="error-banner" id="errorBanner" hidden></div>' +

      '<div class="auth-bar" id="authBar">' +
        '<span id="authStatus">Not logged in</span>' +
        '<div class="auth-btns">' +
          '<button class="btn btn-text btn-sm" id="loginBtn">Login</button>' +
          '<button class="btn btn-text btn-sm" id="logoutBtn" hidden>Logout</button>' +
        '</div>' +
      '</div>' +

      '<div class="toast" id="toast"></div>' +
    '</div>' +

    '<style>' +
      ':host, * { margin: 0; padding: 0; box-sizing: border-box; }' +

      '.window-frame {' +
        'height: 100vh;' +
        'background: rgba(244, 247, 252, 0.85);' +
        'backdrop-filter: blur(22px);' +
        '-webkit-backdrop-filter: blur(22px);' +
        'border-left: 1px solid rgba(255, 255, 255, 0.5);' +
        'box-shadow: 0 8px 32px rgba(15, 23, 42, 0.15);' +
        'position: relative;' +
        'display: flex;' +
        'flex-direction: column;' +
      '}' +

      '.glass-accent {' +
        'position: absolute; inset: 0;' +
        'background: linear-gradient(135deg, rgba(37, 99, 235, 0.08) 0%, transparent 50%, rgba(0, 204, 97, 0.05) 100%);' +
        'pointer-events: none;' +
      '}' +

      '.header {' +
        'background: linear-gradient(135deg, #1e3a8a 0%, #1e40af 55%, #2563eb 100%);' +
        'color: #fff;' +
        'padding: 14px 16px;' +
        'display: flex;' +
        'align-items: center;' +
        'justify-content: space-between;' +
        'position: relative;' +
        'flex-shrink: 0;' +
      '}' +
      '.header::after {' +
        'content: ""; position: absolute; left: 0; right: 0; bottom: 0; height: 1px;' +
        'background: linear-gradient(90deg, transparent, rgba(0, 204, 97, 0.55), transparent);' +
      '}' +
      '.header-left { display: flex; align-items: center; gap: 10px; }' +
      '.app-icon {' +
        'width: 30px; height: 30px;' +
        'background: linear-gradient(135deg, #00cc61 0%, #00a651 100%);' +
        'border-radius: 8px;' +
        'display: flex; align-items: center; justify-content: center;' +
        'font-size: 14px; font-weight: 700; color: #fff;' +
        'box-shadow: 0 2px 10px rgba(0, 204, 97, 0.35);' +
      '}' +
      '.header-titles { line-height: 1.1; }' +
      '.app-title { font-size: 14px; font-weight: 600; }' +
      '.app-sub { font-size: 10px; opacity: 0.82; margin-top: 2px; letter-spacing: 0.04em; text-transform: uppercase; }' +
      '.src-badge {' +
        'margin-left: 8px; font-size: 9px; font-weight: 700; letter-spacing: 0.08em;' +
        'padding: 3px 7px; border-radius: 999px;' +
        'background: rgba(0, 204, 97, 0.18); color: #a7f3d0; border: 1px solid rgba(0, 204, 97, 0.35);' +
      '}' +

      '.window-controls { display: flex; align-items: center; gap: 8px; }' +
      '.control-btn {' +
        'width: 14px; height: 14px; border-radius: 50%; border: none; cursor: pointer;' +
        'box-shadow: 0 1px 3px rgba(0,0,0,0.25); transition: transform 0.15s, opacity 0.15s;' +
      '}' +
      '.minimize-btn { background: #fbbf24; }' +
      '.close-btn    { background: #ef4444; }' +
      '.control-btn:hover { transform: scale(1.12); opacity: 0.9; }' +

      '.tab-bar {' +
        'display: flex; background: rgba(255,255,255,0.6); border-bottom: 1px solid rgba(15,23,42,0.08);' +
        'flex-shrink: 0;' +
      '}' +
      '.tab-btn {' +
        'flex: 1; padding: 10px 8px; border: none; background: none;' +
        'font-size: 12px; font-weight: 600; color: #64748b; cursor: pointer;' +
        'font-family: inherit; border-bottom: 2px solid transparent;' +
        'transition: color 0.15s, border-color 0.15s;' +
      '}' +
      '.tab-btn:hover { color: #1e40af; }' +
      '.tab-btn.active { color: #2563eb; border-bottom-color: #2563eb; }' +

      '.container {' +
        'flex: 1; overflow-y: auto; padding: 14px;' +
        'scrollbar-width: thin; background: rgba(244, 247, 252, 0.35);' +
        'display: none;' +
      '}' +
      '.container::-webkit-scrollbar { width: 6px; }' +
      '.container::-webkit-scrollbar-thumb { background: rgba(15, 23, 42, 0.18); border-radius: 3px; }' +
      '.tab-panel.active { display: block; }' +

      '.card {' +
        'background: rgba(255, 255, 255, 0.94);' +
        'backdrop-filter: blur(20px); -webkit-backdrop-filter: blur(20px);' +
        'border: 1px solid rgba(255, 255, 255, 0.6);' +
        'border-radius: 10px; padding: 14px; margin-bottom: 12px;' +
        'box-shadow: 0 4px 18px rgba(15, 23, 42, 0.07); position: relative;' +
      '}' +
      '.card::before {' +
        'content: ""; position: absolute; top: 0; left: 0; right: 0; height: 1px;' +
        'background: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.8), transparent);' +
      '}' +

      '.section-title {' +
        'font-size: 12px; font-weight: 700; color: #0f172a; margin-bottom: 10px;' +
        'letter-spacing: 0.02em; display: flex; align-items: center; gap: 6px;' +
      '}' +
      '.section-title.tight { margin-top: 14px; }' +
      '.count { color: #94a3b8; font-weight: 500; font-size: 11px; }' +

      '.fld { display: block; font-size: 11px; color: #334155; font-weight: 500; margin-top: 10px; }' +
      '.fld input, .fld textarea, .fld select {' +
        'width: 100%; padding: 7px 10px; font-size: 12px; font-family: inherit;' +
        'border: 1px solid rgba(15, 23, 42, 0.14); border-radius: 6px;' +
        'margin-top: 4px; background: #fff;' +
      '}' +
      '.fld textarea { resize: vertical; min-height: 60px; }' +
      '.fld select { cursor: pointer; }' +
      '.fld input:focus, .fld textarea:focus, .fld select:focus {' +
        'outline: none; border-color: #2563eb;' +
        'box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.12);' +
      '}' +
      '.fld input[readonly] { background: #f1f5f9; color: #64748b; }' +

      '.btn {' +
        'display: inline-block; border: none; border-radius: 7px;' +
        'padding: 8px 14px; font-size: 12px; font-weight: 600;' +
        'cursor: pointer; font-family: inherit;' +
        'transition: transform 0.15s, box-shadow 0.15s, background 0.15s;' +
      '}' +
      '.btn-primary {' +
        'background: linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%);' +
        'color: #fff; box-shadow: 0 4px 12px rgba(37, 99, 235, 0.28);' +
      '}' +
      '.btn-primary:hover { transform: translateY(-1px); box-shadow: 0 6px 16px rgba(37, 99, 235, 0.35); }' +
      '.btn-outline { background: #fff; color: #0f172a; border: 1px solid rgba(15, 23, 42, 0.14); }' +
      '.btn-outline:hover { background: #f1f5f9; }' +
      '.btn-text { background: none; color: #2563eb; padding: 4px 8px; }' +
      '.btn-text:hover { text-decoration: underline; }' +
      '.btn-sm { padding: 4px 10px; font-size: 11px; }' +
      '.full-width { width: 100%; margin-top: 14px; }' +

      '.start-btn {' +
        'width: 100%; padding: 13px 16px; border: none; border-radius: 9px;' +
        'font-size: 14px; font-weight: 700; font-family: inherit;' +
        'background: linear-gradient(135deg, #00cc61 0%, #00a651 100%);' +
        'color: #fff; cursor: pointer;' +
        'box-shadow: 0 4px 16px rgba(0, 204, 97, 0.35);' +
        'transition: transform 0.15s, box-shadow 0.15s, background 0.2s;' +
      '}' +
      '.start-btn:hover:not([disabled]) { transform: translateY(-1px); box-shadow: 0 6px 20px rgba(0, 204, 97, 0.45); }' +
      '.start-btn[disabled] { background: #cbd5e1; color: #fff; cursor: not-allowed; box-shadow: none; }' +
      '.start-btn.loading { background: #6b7280; }' +
      '.start-btn.loading::after {' +
        'content: ""; display: inline-block; width: 12px; height: 12px;' +
        'border: 2px solid rgba(255,255,255,0.35); border-top: 2px solid #fff;' +
        'border-radius: 50%; animation: rm-spin 0.8s linear infinite;' +
        'margin-left: 10px; vertical-align: -2px;' +
      '}' +
      '@keyframes rm-spin { from { transform: rotate(0); } to { transform: rotate(360deg); } }' +

      '.optimize-btn {' +
        'background: linear-gradient(135deg, #7c3aed 0%, #6d28d9 100%) !important;' +
        'box-shadow: 0 4px 16px rgba(124, 58, 237, 0.4) !important;' +
      '}' +
      '.optimize-btn:hover:not([disabled]) {' +
        'box-shadow: 0 6px 20px rgba(124, 58, 237, 0.55) !important;' +
      '}' +

      '.hint { margin-top: 10px; font-size: 11px; color: #64748b; text-align: center; line-height: 1.5; }' +

      '.resume-selector-row { display: flex; gap: 8px; align-items: center; }' +
      '.resume-select {' +
        'flex: 1; padding: 7px 10px; font-size: 12px; font-family: inherit;' +
        'border: 1px solid rgba(15, 23, 42, 0.14); border-radius: 6px; background: #fff;' +
      '}' +
      '.resume-info { margin-top: 10px; }' +
      '.file-row { display: flex; gap: 10px; align-items: center; justify-content: space-between; }' +
      '.file-info { min-width: 0; flex: 1; }' +
      '.file-name { font-size: 13px; font-weight: 600; color: #0f172a; word-break: break-all; line-height: 1.3; }' +
      '.file-meta { font-size: 11px; color: #64748b; margin-top: 3px; }' +

      '.resumes-list { max-height: 200px; overflow-y: auto; }' +
      '.resume-item {' +
        'display: flex; justify-content: space-between; align-items: center;' +
        'padding: 8px 0; border-bottom: 1px solid rgba(15,23,42,0.06);' +
      '}' +
      '.resume-item:last-child { border-bottom: none; }' +
      '.resume-item-info { min-width: 0; flex: 1; }' +
      '.resume-item-actions { display: flex; gap: 4px; align-items: center; flex-shrink: 0; }' +

      '.score-wrap { display: flex; align-items: center; gap: 14px; margin-bottom: 4px; }' +
      '.score-ring {' +
        'width: 96px; height: 96px; border-radius: 50%;' +
        'background: conic-gradient(#2563eb 0deg, rgba(0,64,80,0.12) 0);' +
        'display: grid; place-items: center; position: relative; flex-shrink: 0;' +
      '}' +
      '.score-inner {' +
        'position: absolute; inset: 7px; border-radius: 50%; background: #fff;' +
        'display: grid; place-items: center; text-align: center;' +
      '}' +
      '.score-num { font-size: 24px; font-weight: 800; color: #0f172a; line-height: 1; }' +
      '.score-lbl { font-size: 9px; color: #64748b; margin-top: 3px; text-transform: uppercase; letter-spacing: 0.08em; }' +
      '.job-meta { flex: 1; min-width: 0; }' +
      '.job-title {' +
        'font-weight: 600; font-size: 13px; color: #0f172a; line-height: 1.3;' +
        'display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden;' +
      '}' +
      '.job-src { font-size: 11px; color: #64748b; margin-top: 4px; }' +

      '.pill-row { display: flex; flex-wrap: wrap; gap: 6px; min-height: 8px; }' +
      '.pill { padding: 3px 10px; border-radius: 999px; font-size: 11px; font-weight: 500; white-space: nowrap; }' +
      '.pill-match { background: rgba(0, 204, 97, 0.14); color: #047857; }' +
      '.pill-miss  { background: rgba(245, 158, 11, 0.15); color: #b45309; }' +
      '.pill-row:empty::before { content: "\u2014"; color: #cbd5e1; font-size: 12px; }' +

      '.sug-list { list-style: none; padding: 0; margin: 0; }' +
      '.sug-list li { font-size: 12px; line-height: 1.5; color: #334155; padding: 6px 0 6px 20px; position: relative; }' +
      '.sug-list li::before { content: "\u2192"; position: absolute; left: 0; top: 6px; color: #2563eb; font-weight: 700; }' +

      '.save-status {' +
        'margin-top: 8px; padding: 6px 10px; border-radius: 6px;' +
        'font-size: 11px; text-align: center;' +
      '}' +
      '.save-status.saving { background: rgba(37,99,235,0.1); color: #1e40af; }' +
      '.save-status.synced { background: rgba(0,204,97,0.1); color: #047857; }' +
      '.save-status.local { background: rgba(245,158,11,0.1); color: #b45309; }' +

      '.saved-jobs-list { max-height: 200px; overflow-y: auto; }' +
      '.saved-job-item {' +
        'display: flex; justify-content: space-between; align-items: center;' +
        'padding: 8px 0; border-bottom: 1px solid rgba(15,23,42,0.06);' +
      '}' +
      '.saved-job-item:last-child { border-bottom: none; }' +
      '.saved-job-info { min-width: 0; flex: 1; }' +
      '.saved-job-title { font-size: 12px; font-weight: 600; color: #0f172a; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }' +
      '.saved-job-meta { font-size: 10px; color: #64748b; margin-top: 2px; }' +

      '.btn-delete {' +
        'background: none; border: none; color: #94a3b8; font-size: 12px;' +
        'cursor: pointer; padding: 2px 6px; border-radius: 4px;' +
      '}' +
      '.btn-delete:hover { color: #ef4444; background: rgba(239,68,68,0.08); }' +

      '.profile-sections-list { margin-bottom: 12px; }' +
      '.profile-section-item {' +
        'padding: 8px 0; border-bottom: 1px solid rgba(15,23,42,0.06);' +
      '}' +
      '.profile-section-item:last-child { border-bottom: none; }' +
      '.profile-section-label { font-size: 12px; font-weight: 600; color: #0f172a; }' +
      '.profile-section-preview { font-size: 11px; color: #64748b; margin-top: 2px; line-height: 1.4; }' +

      '.accordion { }' +
      '.accordion-section { border-bottom: 1px solid rgba(15,23,42,0.06); }' +
      '.accordion-section:last-child { border-bottom: none; }' +
      '.accordion-header {' +
        'padding: 10px 0; cursor: pointer; display: flex; justify-content: space-between;' +
        'align-items: center; font-size: 13px; font-weight: 600; color: #0f172a;' +
      '}' +
      '.accordion-header:hover { color: #2563eb; }' +
      '.accordion-body { max-height: 0; overflow: hidden; transition: max-height 0.25s ease; }' +
      '.accordion-body.open { max-height: 1000px; }' +
      '.accordion-header .chev { transition: transform 0.2s; font-size: 11px; color: #64748b; }' +
      '.accordion-header.open .chev { transform: rotate(180deg); }' +

      '.tip-item { padding: 8px 0; border-bottom: 1px solid rgba(15,23,42,0.04); }' +
      '.tip-header { display: flex; align-items: center; gap: 8px; margin-bottom: 4px; }' +
      '.priority-badge {' +
        'padding: 2px 8px; border-radius: 999px; font-size: 9px; font-weight: 700;' +
        'text-transform: uppercase; letter-spacing: 0.05em;' +
      '}' +
      '.priority-high { background: rgba(239,68,68,0.12); color: #dc2626; }' +
      '.priority-medium { background: rgba(245,158,11,0.12); color: #d97706; }' +
      '.priority-low { background: rgba(37,99,235,0.1); color: #2563eb; }' +
      '.tip-text { font-size: 12px; color: #334155; line-height: 1.5; }' +
      '.tip-original { font-size: 11px; color: #94a3b8; margin-top: 4px; font-style: italic; }' +

      '.error-banner {' +
        'background: rgba(239, 68, 68, 0.1); color: #991b1b;' +
        'border: 1px solid rgba(239, 68, 68, 0.28);' +
        'padding: 10px 12px; border-radius: 8px; font-size: 12px;' +
        'line-height: 1.45; margin: 0 14px 0; flex-shrink: 0;' +
      '}' +

      '.settings-card { padding: 0; overflow: hidden; }' +
      '.settings-head {' +
        'padding: 12px 14px; cursor: pointer; font-size: 12px; font-weight: 600;' +
        'color: #0f172a; display: flex; justify-content: space-between; align-items: center;' +
        'user-select: none;' +
      '}' +
      '.settings-head:hover { background: rgba(15, 23, 42, 0.03); }' +
      '.chev { font-size: 11px; color: #64748b; transition: transform 0.2s; }' +
      '.settings-body {' +
        'padding: 0 14px; max-height: 0; overflow: hidden;' +
        'transition: max-height 0.25s ease, padding 0.25s ease;' +
      '}' +
      '.settings-body.open { max-height: 400px; padding: 0 14px 14px; border-top: 1px solid rgba(15, 23, 42, 0.06); }' +
      '.chk { display: flex; align-items: center; gap: 8px; font-size: 12px; color: #334155; margin-top: 12px; }' +
      '.save-btn { margin-top: 12px; width: 100%; }' +

      '.auth-bar {' +
        'display: flex; justify-content: space-between; align-items: center;' +
        'padding: 8px 16px; background: rgba(244,247,252,0.9);' +
        'border-top: 1px solid rgba(15,23,42,0.06); flex-shrink: 0;' +
        'font-size: 11px; color: #64748b;' +
      '}' +
      '.auth-btns { display: flex; gap: 4px; }' +

      '.toast {' +
        'position: absolute; bottom: 14px; left: 50%;' +
        'transform: translateX(-50%) translateY(20px);' +
        'background: rgba(15, 23, 42, 0.92); color: #fff;' +
        'padding: 8px 14px; border-radius: 999px;' +
        'font-size: 11px; font-weight: 500;' +
        'opacity: 0; pointer-events: none;' +
        'transition: opacity 0.2s, transform 0.2s;' +
        'white-space: nowrap;' +
      '}' +
      '.toast.show { opacity: 1; transform: translateX(-50%) translateY(0); }' +

      '#resumod-sidebar.minimized {' +
        'width: 48px !important; height: 48px !important;' +
        'top: 80px !important; right: 12px !important;' +
        'border-radius: 50% !important; overflow: hidden !important;' +
        'background: linear-gradient(135deg, #1e3a8a 0%, #2563eb 100%) !important;' +
        'cursor: pointer !important;' +
        'box-shadow: 0 6px 18px rgba(37, 99, 235, 0.45) !important;' +
      '}' +
      '#resumod-sidebar.minimized .window-frame { display: none; }' +
      '#resumod-sidebar.minimized::before {' +
        'content: "R"; position: absolute; inset: 0;' +
        'display: flex; align-items: center; justify-content: center;' +
        'font-size: 20px; font-weight: 800; color: #fff; font-family: inherit;' +
      '}' +
    '</style>';
})();
