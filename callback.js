(function () {
  var params = new URLSearchParams(window.location.search);
  var token = params.get("token");
  var refresh = params.get("refresh");
  var statusEl = document.getElementById("status");
  var spinnerEl = document.getElementById("spinner");
  var detailEl = document.getElementById("detail");

  if (!token || !refresh) {
    statusEl.textContent = "Missing authentication tokens.";
    statusEl.className = "error";
    detailEl.textContent = "Please try logging in again from the extension.";
    spinnerEl.style.display = "none";
    return;
  }

  var STORAGE_KEY = "rf_auth";
  var API_BASE = "https://stoic-caiman-320.convex.site";

  statusEl.textContent = "Verifying your account...";

  // Try to fetch the user profile with the token
  fetch(API_BASE + "/v1/auth/profile", {
    headers: {
      "Authorization": "Bearer " + token,
      "Content-Type": "application/json"
    }
  })
  .then(function (res) {
    if (!res.ok) throw new Error("Profile fetch failed: " + res.status);
    return res.json();
  })
  .then(function (profile) {
    // Successfully fetched profile — save full auth data
    var authData = {
      token: token,
      refreshToken: refresh,
      user: {
        id: profile.id || "",
        email: profile.email || "",
        name: profile.name || "",
        tier: profile.tier || "free"
      },
      expiresAt: Date.now() + 3600 * 1000
    };

    chrome.storage.local.set({ rf_auth: authData }, function () {
      onSuccess(authData.user.email);
    });
  })
  .catch(function (err) {
    console.warn("[ResumeForge] Could not fetch profile, saving token anyway:", err);
    // Even if profile fetch fails, save the token so the extension is "connected"
    var authData = {
      token: token,
      refreshToken: refresh,
      user: { email: "", name: "", tier: "free" },
      expiresAt: Date.now() + 3600 * 1000
    };

    chrome.storage.local.set({ rf_auth: authData }, function () {
      onSuccess("");
    });
  });

  function onSuccess(email) {
    spinnerEl.style.display = "none";
    statusEl.textContent = "Extension connected!";
    statusEl.className = "success";
    detailEl.textContent = email ? "Logged in as " + email : "You can close this tab.";

    // Clean up the URL so tokens aren't visible
    if (window.history && window.history.replaceState) {
      window.history.replaceState({}, "", window.location.pathname);
    }

    // Auto-close after 2 seconds
    setTimeout(function () {
      window.close();
    }, 2000);
  }
})();
