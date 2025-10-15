// src/background.js
const BASE_URL = "https://proskai-backend.onrender.com";

// Load auth token from storage on script load
let authToken = null;
chrome.storage.local.get(['prosk_auth_token', 'prosk_user', 'prosk_user_id'], (data) => {
  if (data.prosk_auth_token) {
    authToken = data.prosk_auth_token;
    console.log('[Background] Loaded auth token from storage');
  }
});

// Helpers
async function signin(email, password) {
  const res = await fetch(`${BASE_URL}/api/auth/signin`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password })
  });
  
  if (!res.ok) {
    const txt = await res.text().catch(() => "");
    throw new Error(`Sign-in failed (${res.status}): ${txt}`);
  }
  
  const data = await res.json();
  if (!data?.token || !data?.user) {
    throw new Error("Invalid auth response");
  }
  console.log(data.token)
  
  // Store token and user data in local storage with expiration (30 days)
  const expirationTime = Date.now() + (30 * 24 * 60 * 60 * 1000); // 30 days from now
  await chrome.storage.local.set({ 
    prosk_user: data.user,
    prosk_auth_token: data.token,
    prosk_user_id: data.user.id,
    prosk_token_expiry: expirationTime
  });
  
  authToken = data.token;
  return data;
}

async function fetchProfiles(userId) {
  // Get user ID from storage if not provided
  const { prosk_user_id, prosk_auth_token } = await chrome.storage.local.get([
    'prosk_user_id',
    'prosk_auth_token'
  ]);
  console.log("fetched details :"+ prosk_user_id, prosk_auth_token)
  
  // Use provided userId or fall back to stored user ID
  const targetUserId = userId || prosk_user_id;
  if (!targetUserId) {
    throw new Error("User ID is required to fetch profiles");
  }
  
  // Use stored token or in-memory token
  const token = prosk_auth_token || authToken;
  if (!token) {
    throw new Error("Authentication required");
  }
  
  const res = await fetch(`${BASE_URL}/api/profiles/getdemoprofiles/${targetUserId}`, {
    headers: { "Authorization": `Bearer ${token}` }
  });
  
  if (!res.ok) {
    // If unauthorized, clear the stored token
    if (res.status === 401) {
      await chrome.storage.local.remove(['prosk_auth_token', 'prosk_user', 'prosk_user_id']);
      authToken = null;
    }
    const txt = await res.text().catch(() => "");
    throw new Error(`Failed to fetch profiles (${res.status}): ${txt}`);
  }
  console.log("profiles fetchd is "+res)
  return await res.json();
}

async function setSelectedProfileAndFill(profile) {
  try {
    if (!profile || !profile.id) {
      throw new Error("Invalid profile data");
    }
    
    // Get the active tab
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab?.id) {
      throw new Error("No active tab found");
    }
    
    // Send the profile data to the content script
    await chrome.tabs.sendMessage(tab.id, {
      type: "FILL_PROFILE",
      profile: profile
    });
    
    return { success: true };
  } catch (error) {
    console.error('[Background] Error in setSelectedProfileAndFill:', error);
    return { ok: false, error: error.message };
  }
}

// Check token expiration on startup and periodically
function checkTokenExpiry() {
  chrome.storage.local.get(['prosk_token_expiry'], (data) => {
    if (data.prosk_token_expiry && data.prosk_token_expiry < Date.now()) {
      // Token expired, clear auth data
      chrome.storage.local.remove(['prosk_auth_token', 'prosk_user', 'prosk_user_id', 'prosk_token_expiry']);
      authToken = null;
      console.log('[Background] Auth token expired, cleared credentials');
    }
  });
}

// Check token every hour
checkTokenExpiry();
setInterval(checkTokenExpiry, 60 * 60 * 1000);

// Message router from popup
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log('[Background] Received message:', message);
  
  (async () => {
    try {
      if (message?.type === "SIGNIN") {
        console.log('[Background] Handling SIGNIN request');
        const { email, password } = message.payload || {};
        if (!email || !password) {
          throw new Error('Email and password are required');
        }
        const result = await signin(email, password);
        console.log('[Background] Signin successful for:', email);
        return { ok: true, ...result };
      }
      
      if (message?.type === "FETCH_PROFILES") {
        console.log('[Background] Handling FETCH_PROFILES request');
        const { userId } = message.payload || {};
        const profiles = await fetchProfiles(userId);
        console.log(`[Background] Fetched ${profiles.length} profiles`);
        return { ok: true, profiles };
      }
      
      if (message?.type === "SELECT_PROFILE") {
        console.log('[Background] Handling SELECT_PROFILE request');
        const { profile } = message.payload || {};
        const result = await setSelectedProfileAndFill(profile);
        console.log('[Background] Profile selection and fill completed');
        return { ok: true, ...result };
      }
      
      if (message?.type === "SIGNIN") {
        const { email, password } = message.payload || {};
        if (!email || !password) {
          throw new Error('Email and password are required');
        }
        const result = await signin(email, password);
        return { ok: true, user: result.user };
      }
      
      if (message?.type === "CHECK_AUTH") {
        // Check if we have a valid token
        const { prosk_auth_token, prosk_token_expiry } = await chrome.storage.local.get([
          'prosk_auth_token',
          'prosk_token_expiry'
        ]);
        
        const isAuthenticated = !!(prosk_auth_token && 
          (!prosk_token_expiry || prosk_token_expiry > Date.now()));
        
        if (!isAuthenticated && prosk_auth_token) {
          // Token expired, clean up
          await chrome.storage.local.remove(['prosk_auth_token', 'prosk_user', 'prosk_user_id', 'prosk_token_expiry']);
          authToken = null;
        }
        
        return { 
          ok: true, 
          isAuthenticated,
          user: isAuthenticated ? (await chrome.storage.local.get(['prosk_user'])).prosk_user : null
        };
      }
      
      console.warn('[Background] Unknown message type:', message?.type);
      return { ok: false, error: "Unknown message type" };
    } catch (error) {
      console.error('[Background] Error in message handler:', error);
      return { 
        ok: false, 
        error: error.message || String(error),
        stack: error.stack
      };
    }
  })()
  .then(sendResponse)
  .catch(error => {
    console.error('[Background] Unhandled error in message listener:', error);
    sendResponse({ 
      ok: false, 
      error: 'Internal server error',
      details: error.message
    });
  });
  
  // Return true to indicate we'll respond asynchronously
  return true;
});

// Listen for extension installation or update
chrome.runtime.onInstalled.addListener((details) => {
  if (details.reason === 'install') {
    console.log('Extension installed');
  } else if (details.reason === 'update') {
    console.log('Extension updated');
  }
  
  // Check token validity on install/update
  checkTokenExpiry();
});

// Listen for storage changes (e.g., when another tab logs out)
chrome.storage.onChanged.addListener((changes, area) => {
  if (area === 'local' && changes.prosk_auth_token) {
    authToken = changes.prosk_auth_token.newValue || null;
    console.log('[Background] Auth token updated');
  }
});
