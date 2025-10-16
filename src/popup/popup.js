// src/popup/popup.js
const loginView = document.getElementById("login-view");
const profilesView = document.getElementById("profiles-view");
const loginForm = document.getElementById("login-form");
const emailEl = document.getElementById("email");
const passwordEl = document.getElementById("password");
const loginErr = document.getElementById("login-error");

const profilesSelect = document.getElementById("profiles-select");
const fillBtn = document.getElementById("fill-btn");
const profilesErr = document.getElementById("profiles-error");
const preview = document.getElementById("profile-preview");

// State
let currentUser = null;
let profiles = [];
let selectedProfile = null;

function showLogin() {
  loginView.classList.remove("hidden");
  profilesView.classList.add("hidden");
}
function showProfiles() {
  loginView.classList.add("hidden");
  profilesView.classList.remove("hidden");
}

async function bgSend(type, payload) {
  return new Promise((resolve) => {
    chrome.runtime.sendMessage({ type, payload }, resolve);
  });
}

function renderProfilesDropdown() {
  profilesSelect.innerHTML = "";
  profiles.forEach((p, idx) => {
    const opt = document.createElement("option");
    opt.value = String(idx);
    opt.textContent =
      p.profileName || p.details?.profileName || `Profile ${idx + 1}`;
    profilesSelect.appendChild(opt);
  });
  profilesSelect.selectedIndex = 0;
  selectedProfile = profiles[0] || null;
  fillBtn.disabled = !selectedProfile;
  renderPreview(selectedProfile);
}

function renderPreview(p) {
  const shallow = Object.fromEntries(
    Object.entries(p).filter(([k, _]) =>
      [
        "profileName",
        "firstName",
        "lastName",
        "email",
        "phone",
        "jobType",
      ].includes(k)
    )
  );
  // If API returns nested details, try to surface basics
  if (!shallow.firstName && p.details?.personalInfo?.firstName) {
    shallow.firstName = p.details.personalInfo.firstName;
    shallow.lastName = p.details.personalInfo.lastName || "";
  }
  if (!shallow.email && p.details?.contactInfo?.email) {
    shallow.email = p.details.contactInfo.email;
  }
  preview.textContent = JSON.stringify(shallow, null, 2);
}

// Try to restore a logged-in user (from storage)
(async () => {
  const { prosk_user } = await chrome.storage.local.get(["prosk_user"]);
  if (prosk_user) {
    currentUser = prosk_user;
    try {
      const resp = await bgSend("FETCH_PROFILES", {
        userId: currentUser._id || currentUser.id || currentUser.userId,
      });
      if (resp?.ok) {
        profiles = resp.profiles || [];
        showProfiles();
        renderProfilesDropdown();
      } else {
        showLogin();
      }
    } catch {
      showLogin();
    }
  } else {
    showLogin();
  }
})();

// Login submit
loginForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  loginErr.textContent = "";
  try {
    const email = emailEl.value.trim();
    const password = passwordEl.value;

    // Sign in the user
    const resp = await bgSend("SIGNIN", { email, password });
    if (!resp?.ok) throw new Error(resp?.error || "Sign-in failed");

    // Store user data and update UI
    currentUser = resp.user;

    // Fetch profiles - no need to pass userId as it will be retrieved from storage
    const resp2 = await bgSend("FETCH_PROFILES", {});
    if (!resp2?.ok) throw new Error(resp2?.error || "Failed to fetch profiles");

    profiles = resp2.profiles || [];
    showProfiles();
    renderProfilesDropdown();
  } catch (err) {
    console.error("Login error:", err);
    loginErr.textContent = err.message || "An error occurred during sign in";
  }
});

// Change selected profile
profilesSelect.addEventListener("change", (e) => {
  const idx = Number(e.target.value);
  selectedProfile = profiles[idx] || null;
  fillBtn.disabled = !selectedProfile;
  renderPreview(selectedProfile);
});

// Click Fill
fillBtn.addEventListener("click", async () => {
  profilesErr.textContent = "";
  fillBtn.disabled = true;
  fillBtn.textContent = "Filling...";

  if (!selectedProfile) {
    const errorMsg = "Please select a profile first.";
    console.error("[Popup]", errorMsg);
    profilesErr.textContent = errorMsg;
    fillBtn.disabled = false;
    fillBtn.textContent = "Fill";
    return;
  }

  try {
    console.log("[Popup] Sending profile to background:", {
      id: selectedProfile._id, // ✅ Correctly logs the _id
      name: selectedProfile.profileName,
    });

    const resp = await bgSend("SELECT_PROFILE", { profile: selectedProfile });
    console.log("[Popup] Received response from background:", resp);

    if (!resp?.ok) {
      throw new Error(resp?.error || "Failed to fill form. Please try again.");
    }

    console.log("[Popup] Form fill successful, closing popup");
    window.close();
  } catch (e) {
    const errorMsg = e.message || "An error occurred while filling the form";
    console.error("[Popup] Error:", errorMsg, e);
    profilesErr.textContent = errorMsg;
    fillBtn.disabled = false;
    fillBtn.textContent = "Fill";
  }
});
