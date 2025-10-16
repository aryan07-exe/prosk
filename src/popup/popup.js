// src/popup/popup.js
const loginView = document.getElementById("login-view");
const profilesView = document.getElementById("profiles-view");
const loginForm = document.getElementById("login-form");
const loginBtn = document.getElementById("login-btn");
const loginErr = document.getElementById("login-error");
const profilesSelect = document.getElementById("profiles-select");
const fillBtn = document.getElementById("fill-btn");
const useProfileBtn = document.getElementById("use-profile-btn"); // Get the new button
const profilesErr = document.getElementById("profiles-error");
const preview = document.getElementById("profile-preview");
const signoutBtn = document.getElementById("signout-btn");

let profiles = [];
let selectedProfile = null;

// --- UI Functions ---
function showLogin() {
  loginView.classList.remove("hidden");
  profilesView.classList.add("hidden");
}

function showProfiles() {
  loginView.classList.add("hidden");
  profilesView.classList.remove("hidden");
}

// --- Helper for background communication ---
async function bgSend(type, payload) {
  const response = await chrome.runtime.sendMessage({ type, payload });
  if (response.ok) {
    return response;
  } else {
    throw new Error(response.error || "An unknown error occurred in the background script.");
  }
}

// --- Render Functions ---
function renderProfilesDropdown() {
  profilesSelect.innerHTML = "";
  if (profiles.length === 0) {
    profilesErr.textContent = "No profiles found. Please create one in the dashboard.";
    useProfileBtn.disabled = true;
    fillBtn.disabled = true;
    return;
  }
  
  profiles.forEach((p, idx) => {
    const opt = document.createElement("option");
    opt.value = String(idx);
    opt.textContent = p.profileName;
    profilesSelect.appendChild(opt);
  });
  
  updateSelectedProfile();
}

function renderPreview(profile) {
  if (!profile) {
    preview.textContent = "No profile selected.";
    return;
  }
  const previewData = {
    Name: `${profile.firstName} ${profile.lastName}`,
    Email: profile.email,
    Experience: `${profile.totalExperienceInYears || 0} years`,
  };
  preview.textContent = JSON.stringify(previewData, null, 2);
}

function updateSelectedProfile() {
  const idx = Number(profilesSelect.value);
  selectedProfile = profiles[idx] || null;
  useProfileBtn.disabled = !selectedProfile;
  fillBtn.disabled = true; // Keep fill button disabled until a profile is "used"
  renderPreview(selectedProfile);
}

// --- Event Listeners ---
loginForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  loginErr.textContent = "";
  loginBtn.textContent = "Signing in...";
  loginBtn.disabled = true;

  try {
    await bgSend("SIGNIN", { email: document.getElementById("email").value.trim(), password: document.getElementById("password").value });
    const profileResponse = await bgSend("FETCH_PROFILES");
    
    profiles = profileResponse.profiles || [];
    showProfiles();
    renderProfilesDropdown();
  } catch (err) {
    loginErr.textContent = err.message;
  } finally {
    loginBtn.textContent = "Sign in";
    loginBtn.disabled = false;
  }
});

profilesSelect.addEventListener("change", updateSelectedProfile);

// ✨ NEW EVENT LISTENER FOR THE "USE PROFILE" BUTTON ✨
useProfileBtn.addEventListener("click", async () => {
  if (!selectedProfile) return;

  profilesErr.textContent = "";
  useProfileBtn.textContent = "Selecting...";
  useProfileBtn.disabled = true;

  try {
    const response = await bgSend("SELECT_PROFILE", { profile: selectedProfile });
    console.log("Popup received confirmation:", response.message);
    profilesErr.textContent = `Profile "${selectedProfile.profileName}" is now active!`;
    fillBtn.disabled = false; // Enable the "Fill this page" button
  } catch (e) {
    profilesErr.textContent = e.message;
  } finally {
    useProfileBtn.textContent = "Use Profile";
    useProfileBtn.disabled = false;
  }
});

// Event listener for the "Fill this page" button (can be used for form filling later)
fillBtn.addEventListener("click", async () => {
  if (!selectedProfile) {
    profilesErr.textContent = "Please select and 'Use' a profile first.";
    return;
  }
  console.log("LOGIC FOR FILLING THE PAGE GOES HERE. Profile to use:", selectedProfile.profileName);
  window.close();
});


signoutBtn.addEventListener("click", async () => {
  await bgSend("SIGNOUT");
  showLogin();
});

// --- Initial Load ---
(async () => {
  try {
    const { prosk_user } = await chrome.storage.local.get(["prosk_user"]);
    if (prosk_user) {
      const profileResponse = await bgSend("FETCH_PROFILES");
      profiles = profileResponse.profiles || [];
      showProfiles();
      renderProfilesDropdown();
    } else {
      showLogin();
    }
  } catch (error) {
    console.warn("Could not auto-login:", error.message);
    showLogin();
  }
})();