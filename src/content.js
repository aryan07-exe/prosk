// src/content.js
(() => {
  const LOG = (...a) => console.debug("[Prosk-Autofill]", ...a);
  const WARN = (...a) => console.warn("[Prosk-Autofill]", ...a);

  const norm = (s) => (s ?? "").toString().toLowerCase().trim();
  const squash = (s) => norm(s).replace(/[\s_\-]+/g, "");
  const looksLikeUrl = (s) => /^(https?:\/\/|www\.)/i.test(String(s || "").trim());
  const fire = (el, type) => { try { el.dispatchEvent(new Event(type, { bubbles: true })); } catch {} };
  const fireAll = (el) => ["input","change","blur"].forEach(t => fire(el, t));
  const sleep = (ms=0) => new Promise(r => setTimeout(r, ms));
  const toDateInput = (d) => { if (!d) return ""; const dt = new Date(d); return isNaN(dt) ? "" : dt.toISOString().slice(0,10); };

  // ----------------- Mapping -----------------
  function normalizeCTC(input) {
    const s = String(input || "").replace(/[,₹$\s]/g, "").toLowerCase();
    if (!s) return null;
    let num = parseFloat(s);
    if (Number.isNaN(num)) return null;
    if (/lpa|lac|lakh/.test(s)) num *= 100000; else if (/\bk\b/.test(s)) num *= 1000;
    return Math.round(num);
  }

  function computeTotalExperienceDays(exps = []) {
    let total = 0;
    for (const e of exps) {
      const start = e?.startDate ? new Date(e.startDate) : null;
      const end = e?.isCurrent ? new Date() : (e?.endDate ? new Date(e.endDate) : null);
      if (start && end && !isNaN(start) && !isNaN(end)) {
        total += Math.max(0, Math.round((end - start) / 86400000));
      }
    }
    return total;
  }

  // Accepts nested .details or flat object
  function buildMapped(profile) {
    if (!profile || typeof profile !== "object") return null;

    // Handle both old and new profile structures
    const isNewStructure = !profile.details;
    
    if (isNewStructure) {
      // New structure (from API)
      const workExp = profile.experience?.[0] || {};
      const education = profile.education?.[0] || {};
      const phone = profile.phoneCountryCode && profile.phone 
        ? `${profile.phoneCountryCode}${profile.phone}` 
        : profile.phone || '';
      
      return {
        // Personal Info
        fullName: [profile.firstName, profile.lastName].filter(Boolean).join(' '),
        firstName: profile.firstName,
        lastName: profile.lastName,
        email: profile.email,
        phone: phone,
        pronouns: profile.pronouns,
        gender: profile.gender,
        ethnicity: profile.ethnicity,
        race: profile.race,
        disabilityStatus: profile.disabilityStatus,
        veteranStatus: profile.veteranStatus,
        
        // Contact Info
        street: profile.street,
        city: profile.city,
        state: profile.state,
        country: profile.country,
        zipCode: profile.zipCode,
        portfolio: profile.portfolio,
        linkedin: profile.linkedin,
        github: profile.github,
        twitter: profile.twitter,
        otherSocialLink: profile.otherSocialLink,
        
        // Work Authorization
        usAuthorized: profile.usAuthorized,
        sponsorshipRequired: profile.sponsorshipRequired,
        citizenshipStatus: profile.citizenshipStatus,
        nationality: profile.nationality,
        
        // Job Preferences
        jobType: profile.jobType,
        preferredLocations: Array.isArray(profile.preferredLocations) 
          ? profile.preferredLocations.join(', ')
          : profile.preferredLocations,
        currentCTC: profile.currentCTC,
        expectedCTC: profile.expectedCTC,
        willingToRelocate: profile.willingToRelocate,
        noticePeriodAvailable: profile.noticePeriodAvailable,
        noticePeriodDurationInDays: profile.noticePeriodDurationInDays,
        totalExperienceInYears: profile.totalExperienceInYears,
        
        // Skills
        skills: Array.isArray(profile.skills) ? profile.skills.join(', ') : profile.skills,
        
        // Experience (most recent)
        company: workExp.company,
        jobTitle: workExp.role,
        jobDescription: workExp.description,
        startDate: workExp.startDate,
        isCurrent: workExp.isCurrent,
        
        // Education (most recent)
        school: education.school,
        degree: education.degree,
        fieldOfStudy: education.fieldOfStudy,
        educationEndDate: education.endDate,
        gpa: education.grade,
        
        // Additional fields
        achievements: Array.isArray(profile.achievements) 
          ? profile.achievements.join('\n• ')
          : profile.achievements,
        certifications: Array.isArray(profile.certifications) 
          ? profile.certifications.map(c => `${c.name} - ${c.issuer} (${new Date(c.issueDate).getFullYear()})`).join('\n• ')
          : profile.certifications,
        languages: Array.isArray(profile.languages)
          ? profile.languages.map(l => `${l.language} (${l.proficiency})`).join(', ')
          : profile.languages,
        publications: Array.isArray(profile.publications)
          ? profile.publications.map(p => `${p.title}: ${p.link}`).join('\n• ')
          : profile.publications,
        projects: Array.isArray(profile.projects)
          ? profile.projects.map(p => `${p.title}: ${p.description} (${p.technologies?.join(', ')}) - ${p.githubLink || ''}`).join('\n• ')
          : profile.projects
      };
    } else {
      // Old structure (keep for backward compatibility)
      const d = profile.details;
      const personal = d.personalInfo ?? {};
      const demographics = personal.demographics ?? {};
      const contact = d.contactInfo ?? {};
      const addr = contact.presentAddress ?? {};
      const socials = contact.socials ?? {};
      const workAuth = d.workAuthorization ?? {};
      const career = d.careerSummary ?? {};
      const jobPref = d.jobPreferences ?? {};
      const notice = jobPref.noticePeriod ?? {};

      const firstName = personal.firstName ?? "";
      const lastName  = personal.lastName ?? "";
      const fullName = `${firstName} ${lastName}`.trim();
      const addressLine = addr.street ? [addr.street, addr.city, addr.state, addr.country].filter(Boolean).join(", ") : "";

      return {
        fullName, firstname: firstName, lastname: lastName, pronouns: personal.pronouns ?? "",
        gender: demographics.gender ?? "", ethnicity: demographics.ethnicity ?? "", race: demographics.race ?? "",
        disabilityStatus: demographics.disabilityStatus ?? "", veteranStatus: demographics.veteranStatus ?? "",
        email: contact.email ?? "", phoneCountryCode: contact.phoneCountryCode ?? "+91", phone: contact.phone ?? "",
        street: addr.street ?? "", address: addressLine, city: addr.city ?? "", state: addr.state ?? "", country: addr.country ?? "", zipCode: addr.zipCode ?? "",
        linkedin: socials.linkedin ?? "", github: socials.github ?? "", portfolio: socials.portfolio ?? "", twitter: socials.twitter ?? "", otherLink: socials.other ?? "",
        totalExperienceInYears: d.careerSummary?.totalExperienceInYears ?? career.totalExperienceInYears ?? null,
        skillsCsv: Array.isArray(career.skills) ? career.skills.join(", ") : (career.skills || ""),
        jobType: jobPref.jobType ?? "",
        preferredLocationsCsv: Array.isArray(jobPref.preferredLocations) ? jobPref.preferredLocations.join(", ") : "",
        currentCTC: jobPref.currentCTC ?? "", expectedCTC: jobPref.expectedCTC ?? "",
        willingToRelocate: !!jobPref.willingToRelocate,
        noticePeriodAvailable: !!notice.available,
        noticePeriodDays: typeof notice.durationInDays === "number" ? notice.durationInDays : null,
        currentCTCNormalized: normalizeCTC(jobPref.currentCTC ?? ""),
        expectedCTCNormalized: normalizeCTC(jobPref.expectedCTC ?? ""),
        totalExperienceDays: computeTotalExperienceDays(career.experience ?? []),
        nationality: workAuth.nationality ?? "", usAuthorized: workAuth.usAuthorized ?? null,
        sponsorshipRequired: workAuth.sponsorshipRequired ?? null, citizenshipStatus: workAuth.citizenshipStatus ?? "",
        resumeUrl: profile.resumeUrl || ""
      };
    }

    // Else assume flat (like your example array payload)
    const p = profile;
    const fullName = `${p.firstName || ""} ${p.lastName || ""}`.trim();
    const addressLine = [p.street, p.city, p.state, p.country].filter(Boolean).join(", ");
    return {
      fullName, firstname: p.firstName || "", lastname: p.lastName || "", pronouns: p.pronouns || "",
      gender: p.gender || "", ethnicity: p.ethnicity || "", race: p.race || "", disabilityStatus: p.disabilityStatus || "", veteranStatus: p.veteranStatus || "",
      email: p.email || "", phoneCountryCode: p.phoneCountryCode || "+91", phone: p.phone || "",
      street: p.street || "", address: addressLine, city: p.city || "", state: p.state || "", country: p.country || "", zipCode: p.zipCode || "",
      linkedin: p.linkedin || "", github: p.github || "", portfolio: p.portfolio || "", twitter: p.twitter || "", otherLink: p.otherSocialLink || p.other || "",
      totalExperienceInYears: p.totalExperienceInYears ?? null,
      skillsCsv: Array.isArray(p.skills) ? p.skills.join(", ") : (p.skills || ""),
      jobType: p.jobType || "", preferredLocationsCsv: Array.isArray(p.preferredLocations) ? p.preferredLocations.join(", ") : (p.preferredLocations || ""),
      currentCTC: p.currentCTC || "", expectedCTC: p.expectedCTC || "",
      willingToRelocate: !!p.willingToRelocate, noticePeriodAvailable: !!p.noticePeriodAvailable,
      noticePeriodDays: typeof p.noticePeriodDurationInDays === "number" ? p.noticePeriodDurationInDays : null,
      currentCTCNormalized: normalizeCTC(p.currentCTC), expectedCTCNormalized: normalizeCTC(p.expectedCTC),
      nationality: p.nationality || "", usAuthorized: typeof p.usAuthorized === "boolean" ? p.usAuthorized : null,
      sponsorshipRequired: typeof p.sponsorshipRequired === "boolean" ? p.sponsorshipRequired : null,
      citizenshipStatus: p.citizenshipStatus || "",
      resumeUrl: p.resumeUrl || ""
    };
  }

  // ----------------- Field finding -----------------
const fieldMapping = {
    // Personal Info
    fullName: ["name","fullname","full_name","candidate_name","applicant_name","your_name"],
    firstName: ["firstname","first_name","fname","givenname","given_name","first"],
    lastName: ["lastname","last_name","lname","surname","familyname","family_name", "last"],
    email: ["email","emailaddress","email_address","user_email","contact_email","mail","primary_email","e-mail","e_mail"],
    phone: ["phone","phone_number","mobile","mobile_number","contact_number","telephone"],
    pronouns: ["pronouns","preferred_pronouns","gender_pronouns"],
    gender: ["gender","sex","gender_identity"],
    ethnicity: ["ethnicity","ethnic_origin","ethnic_identity"],
    race: ["race","racial_identity"],
    disabilityStatus: ["disability","disability_status","have_disability"],
    veteranStatus: ["veteran","veteran_status","military_status"],
    
    // Contact Info
    street: ["street","street_address","address_line_1"],
    city: ["city"],
    state: ["state","province","region"],
    country: ["country","country_of_residence"],
    zipCode: ["zip","zipcode","postal_code","postcode"],
    portfolio: ["portfolio","portfolio_url","website","personal_website"],
    linkedin: ["linkedin","linkedin_url","linkedin_profile"],
    github: ["github","github_url","github_username"],
    twitter: ["twitter","twitter_handle","twitter_url"],
    otherSocialLink: ["other_social","other_profile","additional_link"],
    
    // Work Authorization
    usAuthorized: ["us_authorized","us_work_permit","authorized_to_work_us","work_authorization_us"],
    sponsorshipRequired: ["sponsorship_required","need_visa_sponsorship","require_work_visa"],
    citizenshipStatus: ["citizenship_status","work_status","immigration_status"],
    nationality: ["nationality","citizenship","country_of_citizenship"],
    
    // Job Preferences
    jobType: ["job_type","employment_type","work_type"],
    preferredLocations: ["preferred_locations","job_locations","desired_locations","location_preferences"],
    currentCTC: ["current_ctc","current_salary","current_compensation","current_pay"],
    expectedCTC: ["expected_ctc","expected_salary","salary_expectations","desired_salary"],
    willingToRelocate: ["willing_to_relocate","open_to_relocation","relocation"],
    noticePeriodAvailable: ["notice_period","serving_notice_period","notice_period_required"],
    noticePeriodDurationInDays: ["notice_period_days","notice_period_length","days_notice_required"],
    totalExperienceInYears: ["total_experience","years_of_experience","work_experience_years"],
    
    // Skills & Experience
    skills: ["skills","technical_skills","key_skills","skillset"],
    company: ["company","current_company","employer","current_employer"],
    jobTitle: ["job_title","current_title","position","current_position"],
    jobDescription: ["job_description","role_description","responsibilities"],
    startDate: ["start_date","employment_start_date","joining_date"],
    isCurrent: ["current_job","currently_employed_here","is_current_position"],
    
    // Education
    school: ["school","university","college","institution"],
    degree: ["degree","qualification","education_level"],
    fieldOfStudy: ["field_of_study","major","specialization","discipline"],
    educationEndDate: ["graduation_date","education_end_date","date_completed"],
    gpa: ["gpa","grade","score","cgpa"],
    
    // Additional Fields
    achievements: ["achievements","awards","accomplishments","honors"],
    certifications: ["certifications","licenses","certificates"],
    languages: ["languages","language_proficiency","spoken_languages"],
    publications: ["publications","papers","research_papers"],
    projects: ["projects","project_experience","project_work"],
    phoneCountryCode: ["country_code","phonecountrycode","phone_country_code","isd_code","dial_code"],
    phone: ["phone","mobile","mobile_number","contact_number","telephone","phone_number","whatsapp"],
    address: ["address","home_address","present_address","permanent_address","addressline","streetaddress"],
    street: ["street","street_address","address1","address_line1","line1"],
    city: ["city","town","location","current_city","municipality"],
    state: ["state","province","region","state_region"],
    country: ["country","nation","country_name"],
    zipCode: ["zip","zipcode","zip_code","postal","postal_code","pin","pincode","pin_code"],
    linkedin: ["linkedin","linkedin_url","linkedin_profile","linkedin_link","linkedinprofile"],
    github: ["github","github_url","github_profile","githublink","git_hub","huggingface"],
    portfolio: ["portfolio","portfolio_url","portfolio_link","website","personal_website"],
    twitter: ["twitter","x","twitter_url","twitter_handle"],
    otherLink: ["other","other_link","profile_link","additional_link","social","medium","blog"],
    resumeUrl: ["resume","cv","resume_url","cv_url","resume_link","upload_resume","upload_cv"],
    skillsCsv: ["skills","technical_skills","key_skills","expertise","competencies","skillset"],
    totalExperienceInYears: ["total_experience_years","years_experience","yoe","years_of_experience"],
    jobType: ["jobtype","job_type","work_mode","workmode","remote_onsite_hybrid"],
    preferredLocationsCsv: ["preferred_locations","preferred_location","location_preference","locations"],
    willingToRelocate: ["willing_to_relocate","relocate","relocation"],
    currentCTC: ["current_ctc","current_salary","ctc","current_compensation","present_ctc","salary_now"],
    expectedCTC: ["expected_ctc","expected_salary","expected_compensation","salary_expectation"],
    noticePeriodAvailable: ["immediate_joiner","immediate","available_now","notice_available"],
    noticePeriodDays: ["notice_period_days","notice_days","noticeperiod","notice_in_days"],
    gender: ["gender","sex"],
    ethnicity: ["ethnicity"],
    race: ["race"],
    nationality: ["nationality","citizenship_country"],
    citizenshipStatus: ["citizenship_status","visa_status","work_authorization_status"],
    usAuthorized: ["us_authorized","authorized_to_work_us","work_auth_us"],
    sponsorshipRequired: ["sponsorship_required","requires_sponsorship","need_sponsorship"]
  };

  function labelText(el) {
    const byFor = (() => {
      const id = el.id;
      if (!id) return "";
      const lab = document.querySelector(`label[for="${CSS.escape(id)}"]`);
      return lab ? lab.textContent : "";
    })();
    return (el.closest?.("label")?.textContent || byFor || "").trim();
  }
  function collectAttrs(el) {
    return [
      el.name, el.id, el.placeholder, el.title, el.className,
      el.getAttribute?.("aria-label"), labelText(el)
    ].filter(Boolean).join(" ");
  }
  const getSynonyms = (t) => (fieldMapping[t] || []).map(squash);
  function findFields(fieldType, root = document) {
    const keys = getSynonyms(fieldType);
    const nodes = Array.from(
      root.querySelectorAll(
        [
          "input",
          "textarea",
          "select",
          "[role='combobox']",
          // NEW: common custom/select triggers
          "button",
          "[role='button']",
          "[aria-haspopup='listbox']",
          "[aria-expanded]",
          ".select2-selection",
          ".choices__inner",
          ".vs__selected-options",
          "[data-testid*='select']",
          "[class*='select']",
          "[class*='dropdown']"
        ].join(", ")
      )
    );
    return nodes.filter((el) => {
      const attr = squash(collectAttrs(el));
      return keys.some((k) => attr.includes(k));
    });
  }
  
  // ----------------- Fill primitives -----------------
  function highlight(el) {
    try { el.style.outline = "2px solid #4f46e5"; el.style.outlineOffset = "2px"; } catch {}
  }
  function setNativeSelect(select, value) {
    if (!value && value !== 0 && value !== false) return false;
    
    const normalizeForMatching = (str) => {
      if (str === null || str === undefined) return '';
      return String(str).toLowerCase()
        .replace(/[^\w\s]/g, '')  // Remove special chars
        .replace(/\s+/g, ' ')      // Normalize whitespace
        .trim();
    };
    
    const targetValue = normalizeForMatching(value);
    if (!targetValue) return false;
    
    const opts = Array.from(select.options || []);
    
    // Try exact match first
    let opt = opts.find(o => {
      const text = o.text || o.label || '';
      return normalizeForMatching(text) === targetValue || 
             normalizeForMatching(o.value) === targetValue;
    });
    
    // Try partial matches if exact not found
    if (!opt) {
      opt = opts.find(o => {
        const text = o.text || o.label || '';
        const normalizedText = normalizeForMatching(text);
        const normalizedValue = normalizeForMatching(o.value);
        
        return normalizedText.includes(targetValue) ||
               targetValue.includes(normalizedText) ||
               normalizedValue.includes(targetValue) ||
               targetValue.includes(normalizedValue);
      });
    }
    
    if (!opt) return false;
    
    // Set the value and trigger events
    const oldValue = select.value;
    select.value = opt.value;
    
    // Only fire events if value actually changed
    if (select.value !== oldValue) {
      highlight(select);
      fireAll(select);
    }
    
    return true;
  }
  function setValue(el, value) {
    if (!el || el.disabled || el.readOnly) return false;
    const tag = el.tagName;
    const type = (el.getAttribute("type") || "").toLowerCase();
    let v = value == null ? "" : String(value);

    if (tag === "SELECT") return setNativeSelect(el, v);

    if (el.getAttribute("role") === "combobox" || el.getAttribute("aria-haspopup") === "listbox") {
      el.click();
      return clickFromMenu(document, v);
    }

    if (tag === "INPUT" || tag === "TEXTAREA") {
      if (type === "email" && !/@/.test(v)) return false;
      if (type === "url" && !looksLikeUrl(v)) return false;
      if (type === "date") v = toDateInput(v);
      if (type === "number") {
        const n = Number(v);
        if (Number.isNaN(n)) return false;
        el.value = n;
      } else {
        el.value = v;
      }
      el.setAttribute("value", el.value);
      highlight(el);
      fireAll(el);
      return true;
    }
    return false;
  }

  // ----------------- Custom dropdowns -----------------
  function getDropdownScopes(doc = document) {
    const sel = [
      ".ant-select-dropdown",
      ".rc-virtual-list",
      ".react-select__menu",
      ".Select-menu-outer, .Select-menu",
      ".MuiAutocomplete-popper",
      ".MuiPopover-paper, .MuiMenu-paper",
      ".vs__dropdown-menu",
      "[role='listbox']",
      "[data-radix-popper-content]",
      ".dropdown-menu",
      ".select2-dropdown",
      ".select2-results",
      ".choices__list--dropdown",
      ".select2-results__options",
      "[role='combobox'] + *[role='listbox']",
      "[data-testid*='menu']",
      "[class*='menu']:not(html, body, :empty)",
      "[class*='dropdown']:not(html, body, :empty)",
      "[class*='select']:not(html, body, :empty, select, option)"
    ].join(", ");
    
    // Get all potential dropdowns and filter visible ones
    const allDropdowns = Array.from(doc.querySelectorAll(sel));
    return allDropdowns.filter(dropdown => {
      // Check if dropdown is visible and likely a dropdown menu
      const style = window.getComputedStyle(dropdown);
      return style.display !== 'none' && 
             style.visibility !== 'hidden' && 
             style.opacity !== '0' &&
             dropdown.offsetWidth > 0 && 
             dropdown.offsetHeight > 0;
    });
  }
  function listOptionNodes(scope) {
    // First try specific selectors
    const specificSelectors = [
      "[role='option']",
      ".ant-select-item",
      ".react-select__option",
      ".Select-option",
      ".dropdown-item",
      ".vs__dropdown-option",
      ".MuiAutocomplete-option",
      "[data-option-index]",
      ".select2-results__option",
      ".select2-option",
      ".choices__item--choice",
      "[role='menuitem']",
      "[data-value]",
      "[data-testid*='option']",
      "[class*='option']:not(html, body, :empty)",
      "[class*='item']:not(html, body, :empty, li, ul, ol, div, span, a, button, input, select, option)"
    ].join(',');
    
    let options = Array.from(scope.querySelectorAll(specificSelectors));
    
    // If no options found with specific selectors, try more generic approach
    if (options.length === 0) {
      // Look for any clickable elements inside the dropdown that might be options
      const potentialOptions = Array.from(scope.querySelectorAll(
        'li, div, span, a, button, [role="menuitem"], [tabindex]'
      )).filter(el => {
        // Filter out elements that are likely not options
        const tag = el.tagName.toLowerCase();
        const isHidden = !el.offsetParent || el.hidden || el.style.display === 'none';
        const isClickable = el.onclick || el.getAttribute('role') === 'menuitem' || 
                          el.getAttribute('tabindex') !== null;
        
        return !isHidden && (isClickable || tag === 'li' || tag === 'div');
      });
      
      options = [...new Set([...options, ...potentialOptions])];
    }
    
    return options;
  }
  function scoreOption(opt, target) {
    const txt = norm((opt.textContent || opt.getAttribute("aria-label") || opt.getAttribute("title") || "").replace(/\s+/g," "));
    const val = norm(opt.getAttribute?.("data-value") || opt.getAttribute?.("value") || "");
    const t = norm(target);
    if (!t) return -1;
    if (txt === t || val === t) return 100;
    if (txt.startsWith(t) || val.startsWith(t)) return 80;
    if (txt.includes(t) || val.includes(t)) return 60;
    const tokens = t.split(/\s+/).filter(Boolean);
    const hits = tokens.filter(tok => txt.includes(tok)).length;
    return hits ? 50 + hits : -1;
  }
  function pickBestOption(scope, value) {
    const scored = listOptionNodes(scope)
      .map(node => ({ node, score: scoreOption(node, value) }))
      .filter(x => x.score >= 0)
      .sort((a,b) => b.score - a.score);
    return scored[0]?.node || null;
  }
  function clickNode(node) { node.scrollIntoView({ block: "nearest", inline: "nearest" }); node.click(); }

  async function waitFor(predicate, { timeout = 2000, interval = 50 } = {}) {
    const start = performance.now();
    return new Promise((resolve) => {
      const tick = () => {
        let v = null; try { v = predicate(); } catch {}
        if (v) return resolve(v);
        if (performance.now() - start > timeout) return resolve(null);
        setTimeout(tick, interval);
      };
      tick();
    });
  }

  async function openCombobox(el) {
    el.scrollIntoView({ block: "center", inline: "center" });
    el.click();
    let menu = await waitFor(() => getDropdownScopes()[0], { timeout: 600 });
    if (!menu) {
      el.focus();
      el.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowDown", bubbles: true }));
      el.dispatchEvent(new KeyboardEvent("keydown", { key: " ", bubbles: true }));
      menu = await waitFor(() => getDropdownScopes()[0], { timeout: 600 });
    }
    return menu;
  }
  function getSearchInputInMenu(scope) {
    const q = "input[type='search'], input[type='text'], .react-select__input input, .MuiAutocomplete-input";
    return scope.querySelector(q) || scope.querySelector("input");
  }
  async function typeSearch(scope, value) {
    const input = getSearchInputInMenu(scope);
    if (!input) return false;
    input.focus();
    input.value = value;
    fire(input, "input");
    await sleep(120);
    return true;
  }
  async function clickFromMenu(doc, value) {
    const scopes = getDropdownScopes(doc);
    for (const scope of scopes) {
      await typeSearch(scope, value);
      let opt = pickBestOption(scope, value);
      if (!opt) { await sleep(120); opt = pickBestOption(scope, value); }
      if (opt) { clickNode(opt); return true; }
    }
    return false;
  }
  async function fillDropdownElement(el, value) {
    if (!value && value !== 0 && value !== false) return false;
    
    // First try native select
    if (el.tagName === 'SELECT') {
      return setNativeSelect(el, value);
    }
    
    // Check if this is a custom dropdown trigger
    let control = el;
    const isCombobox = control.getAttribute('role') === 'combobox' || 
                      control.getAttribute('aria-haspopup') === 'listbox' ||
                      control.getAttribute('aria-expanded') === 'true' ||
                      control.classList.toString().toLowerCase().includes('select') ||
                      control.classList.toString().toLowerCase().includes('dropdown');
    
    // If not an obvious dropdown control, try to find one within the element
    if (!isCombobox) {
      const potentialControls = [
        el.querySelector('select'),
        el.querySelector('[role="combobox"]'),
        el.querySelector('[aria-haspopup="listbox"]'),
        el.querySelector('[aria-expanded]'),
        el.querySelector('input[readonly]'),
        el.querySelector('.select2-selection'),
        el.querySelector('.choices__inner'),
        el.querySelector('.vs__selected-options'),
        el
      ].filter(Boolean);
      
      control = potentialControls[0];
    }
    
    // Try different methods to interact with the dropdown
    const methods = [
      // Method 1: Direct value setting for hidden inputs
      async () => {
        if (control.tagName === 'INPUT' && control.type === 'hidden') {
          control.value = value;
          fireAll(control);
          return true;
        }
        return false;
      },
      
      // Method 2: Try to find and click the dropdown toggle
      async () => {
        const toggle = control;
        if (!toggle) return false;
        
        // Click to open dropdown
        toggle.click();
        await sleep(200);
        
        // Look for the dropdown menu
        const menu = await waitFor(() => {
          const scopes = getDropdownScopes();
          return scopes[0] || document.querySelector('.show, .open, [data-show]');
        }, { timeout: 1000 });
        
        if (!menu) return false;
        
        // Try to find and click the option
        const options = listOptionNodes(menu);
        const targetValue = String(value).toLowerCase().trim();
        
        for (const option of options) {
          const optionText = (option.textContent || '').toLowerCase().trim();
          const optionValue = option.getAttribute('data-value') || option.value || '';
          
          if (optionText.includes(targetValue) || 
              optionValue.toLowerCase().includes(targetValue) ||
              option.getAttribute('aria-label')?.toLowerCase().includes(targetValue)) {
            clickNode(option);
            fireAll(control);
            return true;
          }
        }
        
        return false;
      },
      
      // Method 3: Try typing into searchable dropdowns
      async () => {
        if (!control) return false;
        
        // Try to find an input to type into
        let input = control;
        if (control.tagName !== 'INPUT') {
          input = control.querySelector('input') || control;
        }
        
        // Focus and type the value
        input.focus();
        input.value = value;
        fire(input, 'input');
        fire(input, 'change');
        
        // Wait for any async filtering
        await sleep(300);
        
        // Try to find and click the first visible option
        const menu = await waitFor(() => getDropdownScopes()[0], { timeout: 500 });
        if (menu) {
          const options = listOptionNodes(menu);
          if (options.length > 0) {
            clickNode(options[0]);
            fireAll(control);
            return true;
          }
        }
        
        // If no menu but we have an input, try to blur it to accept the value
        input.blur();
        fire(input, 'blur');
        
        return false;
      }
    ];
    
    // Try each method until one succeeds
    for (const method of methods) {
      try {
        const result = await method();
        if (result) return true;
      } catch (error) {
        console.warn('Error in dropdown fill method:', error);
      }
    }
    
    // As a last resort, try to set the value directly if the element has a value property
    if (control && 'value' in control) {
      control.value = value;
      fireAll(control);
      return true;
    }
    
    return false;
  }

  // ----------------- Radios / Checkboxes -----------------
  function setRadioGroupByValue(fieldType, value, root = document) {
    if (value === undefined || value === null) return false;
    
    const normalizeForMatching = (str) => {
      if (str === null || str === undefined) return '';
      return String(str).toLowerCase()
        .replace(/[^\w\s]/g, '')  // Remove special chars
        .replace(/\s+/g, ' ')      // Normalize whitespace
        .trim();
    };
    
    const targetValue = normalizeForMatching(value);
    if (!targetValue && value !== false && value !== 0) return false;
    
    // Handle boolean values
    const isBoolean = typeof value === 'boolean' || 
                     (typeof value === 'string' && 
                      ['true', 'false', 'yes', 'no', 'y', 'n'].includes(value.toLowerCase()));
    
    const isTruthy = isBoolean ? 
      (value === true || String(value).toLowerCase() === 'true' || 
       String(value).toLowerCase() === 'yes' || String(value).toLowerCase() === 'y') : null;
    
    const keys = (fieldMapping[fieldType] || []).map(squash);
    const allRadios = Array.from(root.querySelectorAll("input[type='radio']"));
    
    // If we have field mapping, filter radios by matching attributes
    const radios = keys.length > 0 
      ? allRadios.filter(r => keys.some(k => squash(collectAttrs(r)).includes(k)))
      : allRadios;
    
    // Try to find matching radio by various attributes
    for (const radio of radios) {
      // Check value attribute
      const radioValue = radio.getAttribute('value');
      if (radioValue !== null && normalizeForMatching(radioValue) === targetValue) {
        if (!radio.checked) {
          radio.click(); 
          highlight(radio); 
          fireAll(radio);
        }
        return true;
      }
      
      // Check aria-label
      const ariaLabel = radio.getAttribute('aria-label');
      if (ariaLabel && normalizeForMatching(ariaLabel) === targetValue) {
        if (!radio.checked) {
          radio.click();
          highlight(radio);
          fireAll(radio);
        }
        return true;
      }
      
      // Check associated label text
      const label = radio.closest('label') || 
                   document.querySelector(`label[for="${radio.id}"]`);
      
      if (label) {
        const labelText = normalizeForMatching(label.textContent);
        if (labelText && (labelText === targetValue || labelText.includes(targetValue))) {
          if (!radio.checked) {
            radio.click();
            highlight(radio);
            fireAll(radio);
          }
          return true;
        }
      }
      
      // Handle boolean values
      if (isBoolean) {
        const radioText = [
          radio.getAttribute('value'),
          radio.getAttribute('aria-label'),
          label?.textContent
        ].filter(Boolean).join(' ').toLowerCase();
        
        const isPositiveMatch = isTruthy && 
          (radioText.includes('yes') || 
           radioText.includes('true') || 
           radioText === 'y' || 
           radioText === 't');
           
        const isNegativeMatch = !isTruthy && 
          (radioText.includes('no') || 
           radioText.includes('false') || 
           radioText === 'n' || 
           radioText === 'f');
        
        if (isPositiveMatch || isNegativeMatch) {
          if (!radio.checked) {
            radio.click();
            highlight(radio);
            fireAll(radio);
          }
          return true;
        }
      }
    }
    
    // If we have a direct value match with any radio, use it as last resort
    if (targetValue) {
      const directMatch = allRadios.find(r => {
        const val = r.value || '';
        return normalizeForMatching(val) === targetValue;
      });
      
      if (directMatch && !directMatch.checked) {
        directMatch.click();
        highlight(directMatch);
        fireAll(directMatch);
        return true;
      }
    }
    
    return false;
  }
  function setCheckboxByTruth(fieldType, value, root = document) {
    const want = !!value;
    const keys = (fieldMapping[fieldType] || []).map(squash);
    const cbs = Array.from(root.querySelectorAll("input[type='checkbox']"));
    let changed = false;
    for (const cb of cbs) {
      const attr = squash(collectAttrs(cb));
      if (!keys.some(k => attr.includes(k))) continue;
      if (cb.checked !== want) {
        cb.click(); highlight(cb); fireAll(cb); changed = true;
      }
    }
    return changed;
  }

  // Helper function to fill a single field
  async function fillField(fieldType, value, isCheckbox = false, isRadio = false) {
    if (value == null || value === "") return false;
    
    if (isCheckbox) {
      return setCheckboxByTruth(fieldType, value);
    }
    
    if (isRadio) {
      return setRadioGroupByValue(fieldType, value);
    }
    
    const nodes = findFields(fieldType);
    let filled = false;
    
    for (const el of nodes) {
      // 1) Native <select>
      if (el.tagName === "SELECT") {
        if (setNativeSelect(el, value)) { filled = true; continue; }
      }
    
      // 2) Custom dropdowns/combobox-like
      const looksLikeCombo =
        el.getAttribute("role") === "combobox" ||
        el.getAttribute("aria-haspopup") === "listbox" ||
        el.getAttribute("aria-expanded") != null ||
        (el.className || "").toLowerCase().includes("select") ||
        (el.className || "").toLowerCase().includes("dropdown");
    
      if (looksLikeCombo) {
        if (await fillDropdownElement(el, value)) { filled = true; continue; }
      }
    
      // 3) Plain input/textarea typing
      if (setValue(el, value)) { filled = true; continue; }
    
      // 4) Fallback: try dropdown from a parent wrapper (many libraries nest triggers)
      const parentCombo = el.closest(
        "[role='combobox'], [aria-haspopup='listbox'], [aria-expanded], .select2-selection, .choices__inner, .vs__selected-options, [class*='select'], [class*='dropdown']"
      );
      if (parentCombo) {
        if (await fillDropdownElement(parentCombo, value)) { filled = true; continue; }
      }
    }
    
    
    return filled;
  }

  // Fill education section with multiple entries
  async function fillEducation(education = []) {
    if (!education || !education.length) return;
    
    // Try to find and click "Add Education" button if exists
    const addButtons = [
      ...document.querySelectorAll('button, [role="button"], [onclick*="education" i], [onclick*="add" i]')
    ].filter(btn => 
      btn.textContent && /(add|new)\s*(education|degree|school)/i.test(btn.textContent)
    );
    
    for (let i = 0; i < education.length; i++) {
      const edu = education[i];
      
      // Click add button for subsequent entries
      if (i > 0 && addButtons.length) {
        addButtons[0].click();
        await sleep(500); // Wait for the form to update
      }
      
      // Find the education section (try to find the most recently added one)
      const sections = Array.from(document.querySelectorAll('[id*="education" i], [class*="education" i], [data-testid*="education" i]'));
      const section = sections[sections.length - 1] || document;
      
      // Fill education fields
      await fillField('school', edu.school, false, false, section);
      await fillField('degree', edu.degree, false, false, section);
      await fillField('fieldOfStudy', edu.fieldOfStudy, false, false, section);
      await fillField('gpa', edu.grade, false, false, section);
      
      // Handle dates if available
      if (edu.startDate) {
        await fillField('startDate', toDateInput(edu.startDate), false, false, section);
      }
      if (edu.endDate) {
        await fillField('endDate', toDateInput(edu.endDate), false, false, section);
      } else if (edu.isCurrent) {
        // Mark as current education if applicable
        await fillField('isCurrent', 'true', true, false, section);
      }
      
      await sleep(200); // Small delay between fields
    }
  }

  // Fill experience section with multiple entries
  async function fillExperience(experience = []) {
    if (!experience || !experience.length) return;
    
    // Try to find and click "Add Experience" button if exists
    const addButtons = [
      ...document.querySelectorAll('button, [role="button"], [onclick*="experience" i], [onclick*="add" i]')
    ].filter(btn => 
      btn.textContent && /(add|new)\s*(experience|work|job|employment)/i.test(btn.textContent)
    );
    
    for (let i = 0; i < experience.length; i++) {
      const exp = experience[i];
      
      // Click add button for subsequent entries
      if (i > 0 && addButtons.length) {
        addButtons[0].click();
        await sleep(500); // Wait for the form to update
      }
      
      // Find the experience section (try to find the most recently added one)
      const sections = Array.from(document.querySelectorAll('[id*="experience" i], [class*="experience" i], [data-testid*="experience" i]'));
      const section = sections[sections.length - 1] || document;
      
      // Fill experience fields
      await fillField('company', exp.company, false, false, section);
      await fillField('jobTitle', exp.role || exp.title, false, false, section);
      await fillField('jobDescription', exp.description, false, false, section);
      
      // Handle dates if available
      if (exp.startDate) {
        await fillField('startDate', toDateInput(exp.startDate), false, false, section);
      }
      
      if (exp.endDate) {
        await fillField('endDate', toDateInput(exp.endDate), false, false, section);
      } else if (exp.isCurrent) {
        // Mark as current job if applicable
        await fillField('isCurrent', 'true', true, false, section);
      }
      
      await sleep(200); // Small delay between fields
    }
  }

  // ----------------- Pipeline -----------------
  async function fillAll(mapped) {
    if (!mapped) {
      LOG("No data provided to fill form");
      return;
    }
    
    LOG("Starting form fill with data:", mapped);
    
    try {
      // Basic Information
      await fillField('firstName', mapped.firstName);
      await fillField('lastName', mapped.lastName);
      await fillField('fullName', mapped.fullName || `${mapped.firstName} ${mapped.lastName}`.trim());
      await fillField('email', mapped.email);
      await fillField('phone', mapped.phone ? `${mapped.phoneCountryCode || ''}${mapped.phone}`.trim() : '');
      await fillField('pronouns', mapped.pronouns);
      
      // Personal Details
// Personal Details — try dropdown/select first, then radio fallback if needed
if (!(await fillField('gender', mapped.gender))) {
  await fillField('gender', mapped.gender, false, true); // radio fallback
}
if (!(await fillField('ethnicity', mapped.ethnicity))) {
  await fillField('ethnicity', mapped.ethnicity, false, true); // some forms use radios
}
if (!(await fillField('race', mapped.race))) {
  await fillField('race', mapped.race, false, true);
}
if (!(await fillField('disabilityStatus', mapped.disabilityStatus))) {
  await fillField('disabilityStatus', mapped.disabilityStatus, false, true);
}
if (!(await fillField('veteranStatus', mapped.veteranStatus))) {
  await fillField('veteranStatus', mapped.veteranStatus, false, true);
}

      
      // Contact Information
      await fillField('street', mapped.street);
      await fillField('city', mapped.city);
      await fillField('state', mapped.state);
      await fillField('country', mapped.country);
      await fillField('zipCode', mapped.zipCode);
      
      // Social & Online Presence
      await fillField('portfolio', mapped.portfolio);
      await fillField('linkedin', mapped.linkedin);
      await fillField('github', mapped.github);
      await fillField('twitter', mapped.twitter);
      await fillField('otherSocialLink', mapped.otherSocialLink);
      
      // Work Authorization
      await fillField('nationality', mapped.nationality);
      await fillField('usAuthorized', mapped.usAuthorized, false, true);
      await fillField('sponsorshipRequired', mapped.sponsorshipRequired, false, true);
      await fillField('citizenshipStatus', mapped.citizenshipStatus);
      
      // Job Preferences
      await fillField('jobType', mapped.jobType);
      await fillField('preferredLocations', 
        Array.isArray(mapped.preferredLocations) 
          ? mapped.preferredLocations.join(', ')
          : mapped.preferredLocations
      );
      await fillField('currentCTC', mapped.currentCTC);
      await fillField('expectedCTC', mapped.expectedCTC);
      await fillField('willingToRelocate', mapped.willingToRelocate, true);
      await fillField('noticePeriodAvailable', mapped.noticePeriodAvailable, true);
      await fillField('noticePeriodDurationInDays', mapped.noticePeriodDurationInDays);
      
      // Skills
      await fillField('skills', 
        Array.isArray(mapped.skills) 
          ? mapped.skills.join(', ')
          : mapped.skills
      );
      
      // Education (handles multiple entries)
      if (mapped.education && mapped.education.length > 0) {
        await fillEducation(mapped.education);
      }
      
      // Experience (handles multiple entries)
      if (mapped.experience && mapped.experience.length > 0) {
        await fillExperience(mapped.experience);
      }
      
      // Projects
      if (mapped.projects && mapped.projects.length > 0) {
        const projectsText = mapped.projects.map(p => 
          `${p.title || 'Project'}: ${p.description || ''}${p.technologies ? ` (${p.technologies.join(', ')})` : ''}${p.githubLink ? ` - ${p.githubLink}` : ''}`
        ).join('\n\n');
        await fillField('projects', projectsText);
      }
      
      // Certifications
      if (mapped.certifications && mapped.certifications.length > 0) {
        const certsText = mapped.certifications.map(c => 
          `${c.name || ''} - ${c.issuer || ''}${c.issueDate ? ` (${new Date(c.issueDate).getFullYear()})` : ''}`
        ).join('\n');
        await fillField('certifications', certsText);
      }
      
      // Languages
      if (mapped.languages && mapped.languages.length > 0) {
        const langsText = mapped.languages.map(l => 
          `${l.language || ''}${l.proficiency ? ` (${l.proficiency})` : ''}`
        ).join(', ');
        await fillField('languages', langsText);
      }
      
      // Publications
      if (mapped.publications && mapped.publications.length > 0) {
        const pubsText = mapped.publications.map(p => 
          `${p.title || ''}${p.link ? `: ${p.link}` : ''}${p.description ? ` - ${p.description}` : ''}`
        ).join('\n');
        await fillField('publications', pubsText);
      }
      
      // Achievements
      if (mapped.achievements && mapped.achievements.length > 0) {
        const achievementsText = Array.isArray(mapped.achievements) 
          ? mapped.achievements.join('\n• ')
          : mapped.achievements;
        await fillField('achievements', achievementsText);
      }
      
      LOG("Form fill completed successfully");
      return true;
      
    } catch (error) {
      console.error("Error during form fill:", error);
      return false;
    }
  }

  // Message from background to fill using selectedProfile from storage
  chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
    console.log('[Content] Received message:', msg);
    
    (async () => {
      try {
        if (msg?.action === "fill_form") {
          console.log('[Content] Starting form fill process');
          
          // Get the selected profile from storage
          console.log('[Content] Fetching selected profile from storage');
          const result = await chrome.storage.local.get(["selectedProfile"]);
          const selectedProfile = result.selectedProfile;
          
          if (!selectedProfile) {
            const errorMsg = 'No profile selected. Please select a profile first.';
            console.error('[Content]', errorMsg);
            return { ok: false, error: errorMsg };
          }
          
          console.log('[Content] Profile found:', {
            name: selectedProfile.profileName || 'Unnamed Profile',
            email: selectedProfile.details?.contactInfo?.email || 'No email',
            id: selectedProfile.id || 'No ID'
          });
          
          // Build the mapped data
          console.log('[Content] Building mapped profile data');
          const mapped = buildMapped(selectedProfile);
          console.log('[Content] Mapped data:', JSON.stringify(mapped, null, 2));
          
          // Fill the form
          console.log('[Content] Starting form fill...');
          await fillAll(mapped);
          console.log('[Content] Form fill completed successfully');
          
          return { 
            ok: true, 
            message: 'Form filled successfully',
            profileName: selectedProfile.profileName || 'Unnamed Profile'
          };
        }
        
        return { 
          ok: false, 
          error: 'Unknown action',
          receivedAction: msg?.action
        };
        
      } catch (error) {
        const errorMsg = `Form fill failed: ${error.message || 'Unknown error'}`;
        console.error('[Content]', errorMsg, error);
        return { 
          ok: false, 
          error: errorMsg,
          stack: error.stack
        };
      }
    })()
    .then(sendResponse)
    .catch(error => {
      console.error('[Content] Unhandled error in message listener:', error);
      sendResponse({ 
        ok: false, 
        error: 'Internal error in content script',
        details: error.message
      });
    });
    
    // Return true to keep the message channel open for async response
    return true;
  });

  // Optional: log when forms appear
  try {
    const mo = new MutationObserver((muts) => {
      for (const m of muts) {
        if ([...m.addedNodes].some(n => n.nodeType === 1 && (n.matches?.("form") || n.querySelector?.("input,select,textarea")))) {
          LOG("Form detected. Ready to fill.");
          break;
        }
      }
    });
    mo.observe(document.documentElement, { childList: true, subtree: true });
  } catch {}
})();

 