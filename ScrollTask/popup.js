// Configure PDF.js Worker for Chrome Extension (MV3)
if (typeof pdfjsLib !== 'undefined') {
  pdfjsLib.GlobalWorkerOptions.workerSrc = chrome.runtime.getURL('pdf.worker.min.js');
}

// DOM references (populated on DOMContentLoaded)
let contentContainer, tabButtons, screens;
let goalSetupView, goalActiveView, goalSuccessView;
let aiCustomInputs, aiLockedOverlay, btnUnlockAi;
let presetGoalSelect, customGoalInput, customTasksSelect, goalTimerSelect, btnGoalLaunch, goalErrorBox;
let activeGoalDisplay, activeProgressLbl, activeProgressPct, activeProgressFill, activeChecklistList, btnGoalReset;
let activeAddTaskInput, btnActiveAddTask;
let pdfUploadBox, pdfFileInput, pdfFilePill, pdfFileName, btnRemovePdf, pdfPromptContainer, pdfPromptInput;
let btnExportActivePdf, btnExportSuccessPdf, btnSuccessReset;
let defaultSiteToggles, customSiteInput, btnAddCustomSite, customSitesContainer;
let settingsApiKey, btnToggleApiVisibility, settingsPersonalitySelect, statCompletedTasks, statReclaimedMin, btnProUpgrade;

// PDF Upload & Configuration States
let uploadedPdfFile = null;
let extractedPdfText = "";
let selectedMode = 'Medium'; // Default focus mode

// PRESET GOAL MAPPING
const PRESET_GOAL_MAP = {
  french: "Learn French vocabulary and grammar basics",
  fitness: "Perform a savage home workout and full-body stretch",
  declutter: "Declutter my room, desk, and take out the trash",
  reading: "Read a book focusedly with zero digital distractions",
  coding: "Write and optimize basic programming algorithms"
};

// --- INITIALIZATION ---
document.addEventListener('DOMContentLoaded', () => {
  // Populate all DOM references now that the DOM is guaranteed ready
  contentContainer = document.querySelector('.content-container');
  tabButtons = document.querySelectorAll('.tab-btn');
  screens = document.querySelectorAll('.screen');

  goalSetupView = document.getElementById('goal-setup-view');
  goalActiveView = document.getElementById('goal-active-view');
  goalSuccessView = document.getElementById('goal-success-view');

  aiCustomInputs = document.getElementById('ai-custom-inputs');
  aiLockedOverlay = document.getElementById('ai-locked-overlay');
  btnUnlockAi = document.getElementById('btn-unlock-ai');

  presetGoalSelect = document.getElementById('preset-goal-select');
  customGoalInput = document.getElementById('custom-goal-input');
  customTasksSelect = document.getElementById('custom-tasks-select');
  goalTimerSelect = document.getElementById('goal-timer-select');
  btnGoalLaunch = document.getElementById('btn-goal-launch');
  goalErrorBox = document.getElementById('goal-error-box');

  activeGoalDisplay = document.getElementById('active-goal-display');
  activeProgressLbl = document.getElementById('active-progress-lbl');
  activeProgressPct = document.getElementById('active-progress-pct');
  activeProgressFill = document.getElementById('active-progress-fill');
  activeChecklistList = document.getElementById('active-checklist-list');
  btnGoalReset = document.getElementById('btn-goal-reset');

  activeAddTaskInput = document.getElementById('active-add-task-input');
  btnActiveAddTask = document.getElementById('btn-active-add-task');

  pdfUploadBox = document.getElementById('pdf-upload-box');
  pdfFileInput = document.getElementById('pdf-file-input');
  pdfFilePill = document.getElementById('pdf-file-pill');
  pdfFileName = document.getElementById('pdf-file-name');
  btnRemovePdf = document.getElementById('btn-remove-pdf');
  pdfPromptContainer = document.getElementById('pdf-prompt-container');
  pdfPromptInput = document.getElementById('pdf-prompt-input');

  btnExportActivePdf = document.getElementById('btn-export-active-pdf');
  btnExportSuccessPdf = document.getElementById('btn-export-success-pdf');
  btnSuccessReset = document.getElementById('btn-success-reset');

  defaultSiteToggles = document.querySelectorAll('.default-site-toggle');
  customSiteInput = document.getElementById('custom-site-input');
  btnAddCustomSite = document.getElementById('btn-add-custom-site');
  customSitesContainer = document.getElementById('custom-sites-container');

  settingsApiKey = document.getElementById('settings-api-key');
  btnToggleApiVisibility = document.getElementById('btn-toggle-api-visibility');
  settingsPersonalitySelect = document.getElementById('settings-personality-select');
  statCompletedTasks = document.getElementById('stat-completed-tasks');
  statReclaimedMin = document.getElementById('stat-reclaimed-min');
  btnProUpgrade = document.getElementById('btn-pro-upgrade');

  initTabs();
  initGoalSetupToggles();
  loadData();
  bindEvents();

  // Reactive UI: Reload stats, goal checklist, and configuration automatically when storage updates
  chrome.storage.onChanged.addListener((changes, areaName) => {
    if (areaName === 'local') {
      loadData();
    }
  });
});

// --- TABS CONTROLLER ---
function initTabs() {
  tabButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      const tabName = btn.getAttribute('data-tab');
      switchTab(tabName);
    });
  });
}

function switchTab(tabName) {
  tabButtons.forEach(b => b.classList.remove('active'));
  screens.forEach(s => s.classList.remove('active'));

  const activeBtn = document.querySelector(`.tab-btn[data-tab="${tabName}"]`);
  const activeScreen = document.getElementById(`screen-${tabName}`);
  
  if (activeBtn) activeBtn.classList.add('active');
  if (activeScreen) activeScreen.classList.add('active');

  // Scroll to top of tab container smoothly on switch
  contentContainer.scrollTop = 0;
}

// --- GOAL TOGGLES (Input Pane vs Mode Pane) ---
function initGoalSetupToggles() {
  btnUnlockAi.addEventListener('click', (e) => {
    e.preventDefault();
    switchTab('settings');
    setTimeout(() => settingsApiKey.focus(), 250);
  });
}

function checkApiKeyAvailability() {
  chrome.storage.local.get(['groqApiKey'], (data) => {
    if (data.groqApiKey && data.groqApiKey.trim()) {
      aiCustomInputs.style.display = 'block';
      aiLockedOverlay.style.display = 'none';
    } else {
      aiCustomInputs.style.display = 'none';
      aiLockedOverlay.style.display = 'block';
    }
  });
}

// --- LOAD AND UPDATE INTERFACE ---
function loadData() {
  chrome.storage.local.get([
    'goal', 'subtasks', 'currentIndex', 'timerDuration', 
    'isComplete', 'groqApiKey', 'personality', 'blockedSites', 
    'customBlockedSites', 'tasksCompletedToday'
  ], (data) => {
    
    // 1. Goal State (Active vs Setup)
    if (data.goal && data.subtasks && data.subtasks.length > 0) {
      if (data.isComplete) {
        renderSuccessGoal(data.goal, data.subtasks);
      } else {
        renderActiveGoal(data.goal, data.subtasks, data.currentIndex || 0);
      }
    } else {
      renderSetupGoal();
    }

    // 2. Settings Load
    if (data.groqApiKey) {
      settingsApiKey.value = data.groqApiKey;
    }
    if (data.personality) {
      settingsPersonalitySelect.value = data.personality;
    }

    // 3. Stats Dashboard
    const completedTasks = data.tasksCompletedToday || 0;
    const interval = data.timerDuration || 10;
    const reclaimedMin = completedTasks * interval;
    statCompletedTasks.textContent = completedTasks;
    statReclaimedMin.textContent = reclaimedMin + 'm';

    // 4. Blocked Sites Toggles & Customs
    if (!data.blockedSites || (Array.isArray(data.blockedSites) && data.blockedSites.length === 0)) {
      const defaultSites = ['instagram.com', 'reddit.com', 'x.com', 'twitter.com', 'facebook.com', 'youtube.com'];
      chrome.storage.local.set({ blockedSites: defaultSites }, () => {
        loadSitesTab(defaultSites, data.customBlockedSites);
      });
    } else {
      loadSitesTab(data.blockedSites, data.customBlockedSites);
    }
  });
}

function renderSetupGoal() {
  goalSetupView.style.display = 'block';
  goalActiveView.style.display = 'none';
  goalSuccessView.style.display = 'none';
  hideGoalError();
  checkApiKeyAvailability();
  
  // Reset setup inputs
  customGoalInput.value = '';
  presetGoalSelect.value = '';
  customTasksSelect.value = '10';
  goalTimerSelect.value = '10';
  selectedMode = 'Medium';
  
  // Reset PDF upload state
  resetPdfUpload();
}

function renderSuccessGoal(goal, subtasks) {
  goalSetupView.style.display = 'none';
  goalActiveView.style.display = 'none';
  goalSuccessView.style.display = 'block';
  
  const successGoalDisplay = document.getElementById('success-goal-display');
  if (successGoalDisplay) {
    successGoalDisplay.textContent = goal;
  }
}

function renderActiveGoal(goal, subtasks, currentIndex) {
  goalSetupView.style.display = 'none';
  goalActiveView.style.display = 'block';
  goalSuccessView.style.display = 'none';

  activeGoalDisplay.textContent = goal;
  
  const total = subtasks.length;
  const progress = Math.min(Math.round((currentIndex / total) * 100), 100);
  activeProgressLbl.textContent = `${currentIndex} of ${total} completed`;
  activeProgressPct.textContent = `${progress}%`;
  activeProgressFill.style.width = `${progress}%`;

  activeChecklistList.innerHTML = '';
  subtasks.forEach((task, i) => {
    const item = document.createElement('div');
    item.className = 'checklist-item' + (i < currentIndex ? ' done' : '');
    const iconSpan = document.createElement('span');
    iconSpan.className = 'checklist-icon';
    iconSpan.textContent = i < currentIndex ? '✅' : '⬜';
    const textSpan = document.createElement('span');
    textSpan.textContent = task;
    item.appendChild(iconSpan);
    item.appendChild(textSpan);
    activeChecklistList.appendChild(item);
  });
}

// --- BLOCK LIST SITES SECTION ---
function loadSitesTab(blockedSites, customBlockedSites) {
  // If undefined, set standard defaults
  const defaults = blockedSites || ['instagram.com', 'reddit.com', 'x.com', 'twitter.com', 'facebook.com', 'youtube.com'];
  const customs = customBlockedSites || [];

  // Sync checkboxes
  defaultSiteToggles.forEach(toggle => {
    const domain = toggle.getAttribute('data-domain');
    toggle.checked = defaults.includes(domain);
  });

  // Render Custom Site pills
  renderCustomSites(customs);
}

function renderCustomSites(customs) {
  customSitesContainer.innerHTML = '';
  if (customs.length === 0) {
    customSitesContainer.innerHTML = '<div class="no-custom-sites">No custom websites added yet</div>';
    return;
  }

  customs.forEach((site) => {
    const pill = document.createElement('div');
    pill.className = 'custom-site-pill';
    const nameSpan = document.createElement('span');
    nameSpan.textContent = site;
    const removeSpan = document.createElement('span');
    removeSpan.className = 'btn-remove-site';
    removeSpan.textContent = 'Remove';
    removeSpan.addEventListener('click', () => {
      removeCustomSite(site);
    });
    pill.appendChild(nameSpan);
    pill.appendChild(removeSpan);
    customSitesContainer.appendChild(pill);
  });
}

function removeCustomSite(site) {
  chrome.storage.local.get(['customBlockedSites', 'blockedSites'], (data) => {
    const customs = data.customBlockedSites || [];
    const defaults = data.blockedSites || ['instagram.com', 'reddit.com', 'x.com', 'facebook.com', 'youtube.com'];

    const newCustoms = customs.filter(s => s !== site);
    const newDefaults = defaults.filter(s => s !== site);

    // Dynamic unregistration of blocking script
    if (typeof chrome.scripting !== 'undefined') {
      chrome.scripting.unregisterContentScripts({
        ids: [`block-${site.replace(/[^a-z0-9]/g, '-')}`]
      }).catch(() => {});
    }

    chrome.storage.local.set({ 
      customBlockedSites: newCustoms,
      blockedSites: [...newDefaults, ...newCustoms] 
    }, () => {
      loadData();
    });
  });
}

// --- BIND EVENT HANDLERS ---
function bindEvents() {
  
  // Launch Button handler
  btnGoalLaunch.addEventListener('click', handleGoalLaunch);

  // Goal Reset Button handler
  btnGoalReset.addEventListener('click', handleGoalReset);

  // Preset Select Autofill Handler
  presetGoalSelect.addEventListener('change', () => {
    const val = presetGoalSelect.value;
    if (val && PRESET_GOAL_MAP[val]) {
      customGoalInput.value = PRESET_GOAL_MAP[val];
    }
  });



  // API Key Visibility Toggle
  btnToggleApiVisibility.addEventListener('click', () => {
    if (settingsApiKey.type === 'password') {
      settingsApiKey.type = 'text';
      btnToggleApiVisibility.textContent = 'Hide';
    } else {
      settingsApiKey.type = 'password';
      btnToggleApiVisibility.textContent = 'Show';
    }
  });

  // API Key Auto-Save
  settingsApiKey.addEventListener('input', () => {
    const val = settingsApiKey.value.trim();
    chrome.storage.local.set({ groqApiKey: val }, () => {
      checkApiKeyAvailability();
    });
  });

  // Personality Select Auto-Save
  settingsPersonalitySelect.addEventListener('change', () => {
    const val = settingsPersonalitySelect.value;
    chrome.storage.local.set({ personality: val });
  });

  // Default Site Checkbox Auto-Save
  defaultSiteToggles.forEach(toggle => {
    toggle.addEventListener('change', () => {
      saveActiveSitesList();
    });
  });

  // Add Custom Site
  btnAddCustomSite.addEventListener('click', handleAddCustomSite);
  customSiteInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') handleAddCustomSite();
  });

  // Add Custom Task to Active Goal
  btnActiveAddTask.addEventListener('click', handleActiveAddTask);
  activeAddTaskInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') handleActiveAddTask();
  });

  // PDF Upload Box Click & Drag Events
  pdfUploadBox.addEventListener('click', () => {
    pdfFileInput.click();
  });

  pdfFileInput.addEventListener('change', handlePdfFileSelect);

  pdfUploadBox.addEventListener('dragover', (e) => {
    e.preventDefault();
    pdfUploadBox.style.borderColor = 'rgba(108, 99, 255, 0.85)';
    pdfUploadBox.style.background = 'rgba(108, 99, 255, 0.08)';
  });

  pdfUploadBox.addEventListener('dragleave', () => {
    pdfUploadBox.style.borderColor = 'rgba(108, 99, 255, 0.4)';
    pdfUploadBox.style.background = 'rgba(108, 99, 255, 0.05)';
  });

  pdfUploadBox.addEventListener('drop', (e) => {
    e.preventDefault();
    pdfUploadBox.style.borderColor = 'rgba(108, 99, 255, 0.4)';
    pdfUploadBox.style.background = 'rgba(108, 99, 255, 0.05)';
    
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const file = e.dataTransfer.files[0];
      if (file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')) {
        const dt = new DataTransfer();
        dt.items.add(file);
        pdfFileInput.files = dt.files;
        handlePdfFileSelect();
      } else {
        showGoalError("Please upload a valid PDF file.");
      }
    }
  });

  // PDF Remove Button
  btnRemovePdf.addEventListener('click', (e) => {
    e.stopPropagation();
    resetPdfUpload();
  });

  // Export PDF Buttons
  if (btnExportActivePdf) {
    btnExportActivePdf.addEventListener('click', exportProgressPDF);
  }
  if (btnExportSuccessPdf) {
    btnExportSuccessPdf.addEventListener('click', exportProgressPDF);
  }

  // Success screen reset button
  if (btnSuccessReset) {
    btnSuccessReset.addEventListener('click', handleSuccessReset);
  }

  // Monetization CTA
  btnProUpgrade.addEventListener('click', () => {
    alert("🚀 Thank you for your interest!\n\nScrollTask Premium is launching soon. Get ready to supercharge your dynamic focus with Strict Mode, Weekly analytics, and premium AI voices!");
  });
}

// --- LAUNCH ACTIVE CYCLE ---
function handleGoalLaunch() {
  hideGoalError();
  const goal = customGoalInput.value.trim();
  const timerDuration = parseInt(goalTimerSelect.value) || 10;
  const taskCount = parseInt(customTasksSelect.value) || 10;

  // Goal is only required when no PDF is uploaded
  if (!goal && !extractedPdfText) {
    showGoalError("Please write your objective or upload a PDF first.");
    return;
  }

  // Safeguard: if user uploaded a PDF but extraction yielded nothing, warn explicitly
  if (uploadedPdfFile && !extractedPdfText) {
    showGoalError("PDF text extraction failed — the PDF may be image-based or empty. Please try a different PDF or enter a goal manually.");
    return;
  }

  // Call background service worker to fetch Groq micro-tasks
  setGoalLaunchLoading(true);
  
  chrome.storage.local.get(['personality'], (data) => {
    const personality = data.personality || 'Gentle Coach';
    const pdfPrompt = pdfPromptInput.value.trim();
    
    chrome.runtime.sendMessage(
      { 
        action: 'generateTasks', 
        goal, 
        taskCount, 
        personality,
        pdfText: extractedPdfText,
        pdfPrompt: pdfPrompt,
        mode: selectedMode
      },
      (response) => {
        setGoalLaunchLoading(false);
        
        if (chrome.runtime.lastError) {
          showGoalError("Extension connection error: " + chrome.runtime.lastError.message);
          return;
        }

        if (!response || !response.success) {
          showGoalError(response?.error || "Failed to generate tasks. Double-check your API key in Settings.");
          return;
        }

        // Format active goal title based on inputs
        let displayGoal = "";
        if (extractedPdfText) {
          if (goal) {
            displayGoal = `PDF Study: ${goal}`;
          } else {
            displayGoal = `PDF Study: ${uploadedPdfFile ? uploadedPdfFile.name : 'Document'}`;
          }
        } else {
          displayGoal = goal;
        }

        launchActiveGoal(displayGoal, response.subtasks, timerDuration, taskCount);
      }
    );
  });
}

function launchActiveGoal(goal, subtasks, timerDuration, taskCount) {
  chrome.storage.local.set({
    goal,
    subtasks,
    currentIndex: 0,
    timerDuration,
    taskCount,
    isComplete: false,
    blockActive: false
  }, () => {
    chrome.runtime.sendMessage({ action: 'startTimer' }, () => {
      if (chrome.runtime.lastError) {}
    });
    loadData();
  });
}

function handleGoalReset() {
  if (confirm("Reset your current goal and progress? This cannot be undone.")) {
    chrome.storage.local.remove(['goal', 'subtasks', 'currentIndex', 'isComplete', 'blockActive'], () => {
      chrome.runtime.sendMessage({ action: 'stopTimer' }, () => {
        if (chrome.runtime.lastError) {}
      });
      renderSetupGoal();
    });
  }
}

// --- ADD CUSTOM SITE ACTION ---
function handleAddCustomSite() {
  let site = customSiteInput.value.trim().toLowerCase();
  if (!site) return;

  // Clean common inputs
  site = site.replace(/^(https?:\/\/)?(www\.)?/, '');
  site = site.split('/')[0]; // only get domain

  if (!site || site.length < 4 || !site.includes('.')) {
    alert('Please enter a valid domain name (e.g. website.com)');
    return;
  }

  chrome.storage.local.get(['customBlockedSites'], (data) => {
    const customs = data.customBlockedSites || [];
    if (customs.includes(site)) {
      customSiteInput.value = '';
      return;
    }

    // Programmatically request optional host permission for the custom site
    chrome.permissions.request({
      origins: [`*://*.${site}/*`, `*://${site}/*`]
    }, (granted) => {
      if (!granted) {
        alert('Permission is required to intercept and display tasks on this website.');
        return;
      }

      // Dynamically register the content script for this domain
      if (typeof chrome.scripting !== 'undefined') {
        chrome.scripting.registerContentScripts([{
          id: `block-${site.replace(/[^a-z0-9]/g, '-')}`,
          js: ['content.js'],
          matches: [`*://*.${site}/*`, `*://${site}/*`],
          runAt: 'document_end'
        }]).then(() => {
          const newCustoms = [...customs, site];
          chrome.storage.local.set({ customBlockedSites: newCustoms }, () => {
            customSiteInput.value = '';
            saveActiveSitesList();
          });
        }).catch((err) => {
          // If script is somehow already registered or fails registration, still save the domain block
          const newCustoms = [...customs, site];
          chrome.storage.local.set({ customBlockedSites: newCustoms }, () => {
            customSiteInput.value = '';
            saveActiveSitesList();
          });
        });
      } else {
        const newCustoms = [...customs, site];
        chrome.storage.local.set({ customBlockedSites: newCustoms }, () => {
          customSiteInput.value = '';
          saveActiveSitesList();
        });
      }
    });
  });
}

function saveActiveSitesList() {
  const activeDefaults = [];
  defaultSiteToggles.forEach(toggle => {
    if (toggle.checked) {
      const domain = toggle.getAttribute('data-domain');
      activeDefaults.push(domain);
      // Sync x.com and twitter.com in tandem
      if (domain === 'x.com') {
        activeDefaults.push('twitter.com');
      }
    }
  });

  chrome.storage.local.get(['customBlockedSites'], (data) => {
    const customs = data.customBlockedSites || [];
    
    // Combine active defaults and customs into blockedSites list
    chrome.storage.local.set({ 
      blockedSites: [...activeDefaults, ...customs] 
    }, () => {
      loadData();
    });
  });
}

// --- AUXILIARY UI UPDATER ---
function setGoalLaunchLoading(loading) {
  if (loading) {
    btnGoalLaunch.disabled = true;
    btnGoalLaunch.innerHTML = '<span class="spinner"></span><span>Formulating micro-tasks...</span>';
  } else {
    btnGoalLaunch.disabled = false;
    btnGoalLaunch.innerHTML = '<span>Activate ScrollTask 🚀</span>';
  }
}

// Show error state
function showGoalError(msg) {
  goalErrorBox.textContent = msg;
  goalErrorBox.style.display = 'block';
}

function hideGoalError() {
  goalErrorBox.style.display = 'none';
  goalErrorBox.textContent = '';
}

function handleActiveAddTask() {
  const taskText = activeAddTaskInput.value.trim();
  if (!taskText) return;

  chrome.storage.local.get(['subtasks', 'currentIndex', 'isComplete'], (data) => {
    const subtasks = data.subtasks || [];
    
    if (subtasks.includes(taskText)) {
      activeAddTaskInput.value = '';
      return;
    }

    subtasks.push(taskText);
    activeAddTaskInput.value = '';

    chrome.storage.local.set({
      subtasks: subtasks,
      isComplete: false
    }, () => {
      chrome.runtime.sendMessage({ action: 'startTimer' }, () => {
        if (chrome.runtime.lastError) {}
      });
      loadData();
    });
  });
}

// --- PDF UPLOAD AND PARSING ---
function handlePdfFileSelect() {
  const file = pdfFileInput.files[0];
  if (!file) return;

  hideGoalError();
  setPdfLoading(true);

  const reader = new FileReader();
  reader.onload = async function (e) {
    try {
      const typedarray = new Uint8Array(e.target.result);

      // Check if PDF.js is available
      if (typeof pdfjsLib === 'undefined') {
        throw new Error('PDF.js library failed to load. Check that pdf.min.js is in the extension folder.');
      }

      // Load using PDF.js
      const pdf = await pdfjsLib.getDocument({ data: typedarray }).promise;
      let extractedText = '';

      // Iterate and extract text (up to 8000 chars to capture enough content)
      for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
        const page = await pdf.getPage(pageNum);
        const textContent = await page.getTextContent();
        const pageText = textContent.items.map(item => item.str).join(' ');
        extractedText += pageText + '\n';
        if (extractedText.length >= 8000) {
          break;
        }
      }

      extractedPdfText = extractedText.trim();
      
      if (!extractedPdfText || extractedPdfText.length < 10) {
        throw new Error('No readable text could be extracted from this PDF. It may be a scanned/image-based document.');
      }

      // Success setup
      uploadedPdfFile = file;
      pdfFileName.textContent = file.name + ' (' + extractedPdfText.length + ' chars extracted)';
      pdfFilePill.style.display = 'inline-flex';
      pdfUploadBox.style.display = 'none';
      pdfPromptContainer.style.display = 'block'; // Show PDF focus prompt input dynamically
      hideGoalError();
      
      // Make goal input optional when PDF is uploaded
      customGoalInput.placeholder = 'Optional: add extra context about what you want to focus on';
      customGoalInput.removeAttribute('required');
    } catch (error) {
      showGoalError('PDF Error: ' + error.message);
      resetPdfUpload();
    } finally {
      setPdfLoading(false);
    }
  };

  reader.onerror = function () {
    showGoalError("Failed to read the PDF file. Falling back to manual goal.");
    resetPdfUpload();
    setPdfLoading(false);
  };

  reader.readAsArrayBuffer(file);
}

function setPdfLoading(isLoading) {
  if (isLoading) {
    pdfUploadBox.style.pointerEvents = 'none';
    pdfUploadBox.querySelector('p').innerHTML = '⏳ <span style="font-weight:600; color:#48cfad;">Extracting PDF text...</span>';
  } else {
    pdfUploadBox.style.pointerEvents = 'auto';
    pdfUploadBox.querySelector('p').innerHTML = '📄 Or upload a PDF to generate tasks from it';
  }
}

function resetPdfUpload() {
  uploadedPdfFile = null;
  extractedPdfText = "";
  if (pdfFileInput) pdfFileInput.value = "";
  if (pdfFilePill) pdfFilePill.style.display = 'none';
  if (pdfUploadBox) pdfUploadBox.style.display = 'block';
  if (pdfPromptContainer) pdfPromptContainer.style.display = 'none';
  if (pdfPromptInput) pdfPromptInput.value = "";
  if (pdfUploadBox) {
    pdfUploadBox.querySelector('p').innerHTML = '📄 Or upload a PDF to generate tasks from it';
  }
  
  // Restore goal input to required state when PDF is removed
  if (customGoalInput) {
    customGoalInput.placeholder = 'e.g. Learn Spanish basics';
  }
}

// --- FEATURE 2: PROGRESS EXPORT AS PDF ---
function exportProgressPDF() {
  chrome.storage.local.get([
    'goal', 'subtasks', 'currentIndex', 'timerDuration', 'isComplete'
  ], (data) => {
    const goal = data.goal || "My Objective";
    const subtasks = data.subtasks || [];
    const currentIndex = data.currentIndex || 0;
    const timerDuration = data.timerDuration || 10;
    const totalTasks = subtasks.length;
    
    // Create jsPDF instance
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();
    
    const fontPrimary = "helvetica";
    
    // 1. Header Section
    doc.setFont(fontPrimary, "bold");
    doc.setFontSize(22);
    doc.setTextColor(15, 23, 42); // slate-900
    doc.text("ScrollTask — Progress Report", 20, 25);
    
    // Header Divider Line
    doc.setDrawColor(226, 232, 240); // slate-200
    doc.setLineWidth(0.5);
    doc.line(20, 32, 190, 32);
    
    // 2. Goal Section
    doc.setFont(fontPrimary, "bold");
    doc.setFontSize(11);
    doc.setTextColor(100, 116, 139); // slate-500
    doc.text("OBJECTIVE", 20, 42);
    
    doc.setFont(fontPrimary, "bold");
    doc.setFontSize(14);
    doc.setTextColor(30, 41, 59); // slate-800
    const goalLines = doc.splitTextToSize(goal, 160);
    doc.text(goalLines, 20, 49);
    
    let currentY = 49 + (goalLines.length * 7);
    
    // 3. Settings Section
    doc.setFont(fontPrimary, "bold");
    doc.setFontSize(11);
    doc.setTextColor(100, 116, 139);
    doc.text("SETTINGS", 20, currentY);
    
    currentY += 6;
    doc.setFont(fontPrimary, "normal");
    doc.setFontSize(10.5);
    doc.setTextColor(71, 85, 105); // slate-600
    doc.text(`Timer Interval: ${timerDuration} minutes`, 20, currentY);
    doc.text(`Total Tasks: ${totalTasks}`, 100, currentY);
    
    currentY += 7;
    // Date Section
    const now = new Date();
    const formattedDate = now.toLocaleDateString() + " " + now.toLocaleTimeString();
    doc.text(`Date Exported: ${formattedDate}`, 20, currentY);
    
    currentY += 12;
    // 4. Progress Summary Section
    doc.setFont(fontPrimary, "bold");
    doc.setFontSize(11);
    doc.setTextColor(100, 116, 139);
    doc.text("PROGRESS SUMMARY", 20, currentY);
    
    currentY += 6;
    const progressPct = totalTasks > 0 ? Math.min(Math.round((currentIndex / totalTasks) * 100), 100) : 0;
    doc.setFont(fontPrimary, "bold");
    doc.setFontSize(12.5);
    doc.setTextColor(108, 99, 255); // ScrollTask Purple Accent
    doc.text(`${currentIndex} of ${totalTasks} tasks completed (${progressPct}%)`, 20, currentY);
    
    currentY += 14;
    // 5. Full Task List Section
    doc.setFont(fontPrimary, "bold");
    doc.setFontSize(11);
    doc.setTextColor(100, 116, 139);
    doc.text("TASK CHECKLIST", 20, currentY);
    
    currentY += 8;
    
    // Print each task with correct box/check and styles
    subtasks.forEach((task, index) => {
      const isCompleted = index < currentIndex;
      
      // Page break check (standard letter size is 297mm height)
      if (currentY > 265) {
        doc.addPage();
        currentY = 25; // Reset Y coordinate for new page
      }
      
      if (isCompleted) {
        doc.setFont(fontPrimary, "bold");
        doc.setTextColor(72, 207, 173); // success green check
        doc.text(" [ x ] ", 20, currentY); 
        
        doc.setFont(fontPrimary, "normal");
        doc.setTextColor(148, 163, 184); // slate-400 (greyed out)
        
        const taskLines = doc.splitTextToSize(`${index + 1}. ${task}`, 150);
        doc.text(taskLines, 32, currentY);
        
        // Draw a neat subtle strikethrough line over the text
        const textWidth = doc.getTextWidth(`${index + 1}. ${task}`);
        doc.setDrawColor(203, 213, 225); // slate-300
        doc.setLineWidth(0.3);
        const drawWidth = Math.min(textWidth, 150);
        doc.line(32, currentY - 1.5, 32 + drawWidth, currentY - 1.5);
        
        currentY += (taskLines.length * 6) + 3;
      } else {
        doc.setFont(fontPrimary, "bold");
        doc.setTextColor(100, 116, 139); // slate-500
        doc.text(" [   ] ", 20, currentY);
        
        doc.setFont(fontPrimary, "normal");
        doc.setTextColor(51, 65, 85); // slate-700
        const taskLines = doc.splitTextToSize(`${index + 1}. ${task}`, 150);
        doc.text(taskLines, 32, currentY);
        
        currentY += (taskLines.length * 6) + 3;
      }
    });
    
    // Add page number & footer
    const pageCount = doc.internal.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i);
      
      // Footer divider line
      doc.setDrawColor(241, 245, 249); // slate-100
      doc.setLineWidth(0.5);
      doc.line(20, 280, 190, 280);
      
      doc.setFont(fontPrimary, "normal");
      doc.setFontSize(9);
      doc.setTextColor(148, 163, 184); // slate-400
      doc.text("Generated by ScrollTask", 20, 286);
      doc.text(`Page ${i} of ${pageCount}`, 170, 286);
    }
    
    // Save the PDF
    const safeDate = now.toISOString().split('T')[0];
    doc.save(`ScrollTask-Progress-${safeDate}.pdf`);
  });
}

function handleSuccessReset() {
  chrome.storage.local.remove(['goal', 'subtasks', 'currentIndex', 'isComplete', 'blockActive'], () => {
    chrome.runtime.sendMessage({ action: 'stopTimer' }, () => {
      if (chrome.runtime.lastError) {}
    });
    renderSetupGoal();
  });
}

