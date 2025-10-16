// src/background.js
// const BASE_URL = "https://proskai-backend.onrender.com";
const BASE_URL = "http://localhost:5000";

// --- API HELPER FUNCTIONS ---

async function signin(email, password) {
  const res = await fetch(`${BASE_URL}/api/auth/signin`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  if (!res.ok) throw new Error(await res.text());

  const data = await res.json();
  if (!data?.token || !data?.user) throw new Error("Invalid auth response from server.");

  const expirationTime = Date.now() + 30 * 24 * 60 * 60 * 1000; // 30 days
  await chrome.storage.local.set({
    prosk_user: data.user,
    prosk_auth_token: data.token,
    prosk_token_expiry: expirationTime,
  });
  return data;
}

async function fetchProfiles() {
  const { prosk_user, prosk_auth_token } = await chrome.storage.local.get(["prosk_user", "prosk_auth_token"]);
  if (!prosk_user?.id) throw new Error("User ID not found in storage.");
  if (!prosk_auth_token) throw new Error("Auth token not found in storage.");

  const res = await fetch(`${BASE_URL}/api/profiles/getdemoprofiles/${prosk_user.id}`, {
    headers: { "Authorization": `Bearer ${prosk_auth_token}` },
  });

  if (!res.ok) {
    if (res.status === 401) await signout(); // If unauthorized, log out automatically
    throw new Error(`Failed to fetch profiles (${res.status})`);
  }
  return await res.json();
}

async function signout() {
  await chrome.storage.local.remove(["prosk_user", "prosk_auth_token", "prosk_token_expiry"]);
  console.log('[Background] User signed out and credentials cleared.');
}

// --- MESSAGE LISTENER ---

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  (async () => {
    try {
      switch (message.type) {
        case "SIGNIN":
          const { email, password } = message.payload;
          const result = await signin(email, password);
          return { ok: true, ...result };

        case "FETCH_PROFILES":
          const profiles = await fetchProfiles();
          return { ok: true, profiles };

        case "SELECT_PROFILE":
          const { profile } = message.payload;
          if (!profile || !profile._id) throw new Error("Invalid profile data received.");
          
          // ✨ THIS IS THE CORE OF YOUR REQUEST ✨
          // It logs the entire selected profile object to the background script's console.
          console.log("✅ Full Selected Profile Details:", profile);

          // You can later send this to the content script like this:
          // const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
          // await chrome.tabs.sendMessage(tab.id, { type: "FILL_PROFILE", profile });

          return { ok: true, message: "Profile logged successfully in background." };

        case "SIGNOUT":
          await signout();
          return { ok: true };

        default:
          throw new Error(`Unknown message type: ${message.type}`);
      }
    } catch (error) {
      console.error(`[Background] Error handling ${message.type}:`, error);
      return { ok: false, error: error.message };
    }
  })().then(sendResponse);

  return true; // Indicates an async response.
});