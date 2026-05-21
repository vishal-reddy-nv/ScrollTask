const ALARM_NAME = 'scrolltask-timer';
const GROQ_URL = 'https://api.groq.com/openai/v1/chat/completions';

// Default blocked sites list - Instagram, Reddit, X (Twitter), Facebook, YouTube
const DEFAULT_BLOCKED_SITES = [
  'instagram.com', 'reddit.com', 'x.com', 'twitter.com', 
  'facebook.com', 'youtube.com'
];

// Sanitizes a JSON string to escape raw control characters inside string literals (e.g. newlines, carriage returns, tabs)
function sanitizeJsonString(rawJson) {
  let result = "";
  let inString = false;
  
  for (let i = 0; i < rawJson.length; i++) {
    const char = rawJson[i];
    
    if (char === '"') {
      inString = !inString;
      result += char;
      continue;
    }
    
    if (inString) {
      if (char === '\\') {
        const nextChar = rawJson[i + 1];
        if (nextChar === '"' || nextChar === '\\' || nextChar === 'n' || nextChar === 'r' || nextChar === 't') {
          result += char;
          if (nextChar === '\\') {
            result += '\\';
            i++;
          } else if (nextChar === '"') {
            result += '"';
            i++;
          }
        } else {
          result += '\\\\';
        }
        continue;
      }
      
      if (char === '\n') {
        result += '\\n';
      } else if (char === '\r') {
        result += '\\r';
      } else if (char === '\t') {
        result += '\\t';
      } else {
        const code = char.charCodeAt(0);
        if (code < 32) {
          result += '\\u' + code.toString(16).padStart(4, '0');
        } else {
          result += char;
        }
      }
    } else {
      result += char;
    }
  }
  return result;
}

// Improved Groq prompt for higher quality sub-tasks
async function callGroq(goal, taskCount, apiKey, personality = 'Gentle Coach', pdfText = '', mode = 'Medium', pdfPrompt = '') {
  let prompt = '';
  
  if (pdfText && pdfText.trim()) {
    const cleanPdfText = pdfText.trim().substring(0, 6000);
    const userContext = goal ? `\n\nUSER CONTEXT (secondary, use only to guide focus): ${goal}` : '';
    const focusPrompt = pdfPrompt && pdfPrompt.trim() ? `\n\nADDITIONAL FOCUS INSTRUCTION: ${pdfPrompt.trim()}` : '';
    
    prompt = `You are an expert academic assistant. A student has uploaded a document. Your ONLY job is to read the ACTUAL CONTENT of this document carefully and generate exactly ${taskCount} highly specific, actionable micro-tasks based on what is LITERALLY written in this document. Do NOT generate generic study tasks. Every single task must reference specific content, concepts, questions, topics, or sections that actually appear in the document text provided below.${userContext}${focusPrompt}

DOCUMENT CONTENT (base ALL tasks on this):
${cleanPdfText}

CRITICAL RULES:
1. Every task MUST directly reference specific content from the document above — mention actual terms, concepts, questions, equations, definitions, or topics found in the text.
2. Do NOT generate generic tasks like "gather notes", "review material", "clear workspace", "set up study area", or anything that does not require the document.
3. Every task must represent real, active work (solving, writing, summarizing, explaining, practicing) that takes ~5 minutes.
4. The complexity/focus mode is "${mode}". Match task depth to this difficulty level.
5. Return ONLY a JSON array of ${taskCount} strings. Each task must be specific to the document content above. No generic tasks. No markdown backticks.
6. CRITICAL JSON formatting rule: Every string inside the JSON array must be valid and safely formatted. If you must refer to a quoted term or use a quote inside a task, use single quotes (e.g., 'term') instead of double quotes, and never include unescaped raw newlines or control characters inside string elements.`;
  } else {
    let toneInstruction = '';
    
    switch(personality) {
      case 'Strict Drill Sergeant':
        toneInstruction = 'Use urgent, no-excuses military drill sergeant style. Call user "recruit". Be intense and direct.';
        break;
      case 'Sarcastic Mentor':
        toneInstruction = 'Use witty, dry humor. Gently mock doom-scrolling habits. Make tasks sound amusingly simple.';
        break;
      case 'Navy SEAL':
        toneInstruction = 'Use tactical mission language. Terms like "objective", "recon", "execute", "debrief".';
        break;
      default:
        toneInstruction = 'Use warm, encouraging, supportive language. Celebrate small wins.';
    }
    
    prompt = `You are a world-class productivity coach. Break down this goal into EXACTLY ${taskCount} micro-tasks.

Goal: "${goal}"

PERSONALITY/TONE: ${personality} - ${toneInstruction}
FOCUS MODE: ${mode}

CRITICAL RULES:
1. Every subtask MUST represent real, active work (doing, writing, practicing, solving, summarizing) where the user is actively producing something or doing a concrete action. Absolutely NO passive reading, passive watching, or vague guidelines.
2. Every subtask must take approximately the same amount of time to complete (~5 minutes of active work per task).
3. The complexity of the active work should match the focus mode difficulty: "${mode}".
4. Start with a highly engaging active task to build immediate momentum.
5. Return ONLY a JSON array of ${taskCount} strings. Format: ["Task 1", "Task 2", ...]
6. CRITICAL JSON formatting rule: Every string inside the JSON array must be valid and safely formatted. If you must use quotes inside a task string, use single quotes (e.g., 'term') instead of double quotes, and never include unescaped raw newlines or control characters inside string elements.
7. No explanations, no numbering in the output, no markdown backticks, just the raw JSON array.`;
  }

  const response = await fetch(GROQ_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model: 'llama-3.3-70b-versatile',
      messages: [{ role: 'user', content: prompt }],
      max_tokens: 1500,
      temperature: 0.7
    })
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err?.error?.message || `API error: ${response.status}`);
  }

  const data = await response.json();
  let text = data?.choices?.[0]?.message?.content || '';
  
  // Clean up response
  text = text.replace(/```json\n?/gi, '').replace(/```\n?/g, '').trim();
  
  // Try to extract array if there's extra text
  const arrayMatch = text.match(/\[[\s\S]*\]/);
  if (arrayMatch) text = arrayMatch[0];
  
  // Sanitize control characters (raw newlines, tabs, etc.) inside JSON string literals
  const sanitizedText = sanitizeJsonString(text);
  
  const parsed = JSON.parse(sanitizedText);
  if (!Array.isArray(parsed) || parsed.length !== taskCount) {
    throw new Error(`Expected ${taskCount} tasks, got ${parsed?.length || 0}`);
  }
  return parsed;
}

// Alarm creation with proper error handling
function createAlarm(minutes) {
  chrome.alarms.clear(ALARM_NAME, () => {
    chrome.alarms.create(ALARM_NAME, {
      delayInMinutes: Math.max(0.5, parseFloat(minutes) || 10)
    });
  });
}

// Restore alarm on startup - FIXED for browser restart
chrome.runtime.onStartup.addListener(() => {
  chrome.storage.local.get(['blockedSites', 'goal', 'timerDuration', 'isComplete', 'currentIndex', 'subtasks', 'blockActive'], (data) => {
    // Initialize blocked sites if not present or empty
    if (!data.blockedSites || (Array.isArray(data.blockedSites) && data.blockedSites.length === 0)) {
      chrome.storage.local.set({ blockedSites: DEFAULT_BLOCKED_SITES });
    }

    if (data.goal && !data.isComplete && data.currentIndex !== undefined && !data.blockActive) {
      const currentIndex = data.currentIndex || 0;
      const subtasks = data.subtasks || [];
      
      // Only restart if goal not complete
      if (currentIndex < subtasks.length) {
        createAlarm(data.timerDuration || 10);
      }
    }
  });
});

chrome.runtime.onInstalled.addListener(() => {
  chrome.storage.local.get(['blockedSites', 'goal', 'timerDuration', 'isComplete', 'currentIndex', 'subtasks', 'blockActive'], (data) => {
    // Initialize blocked sites if not present or empty
    if (!data.blockedSites || (Array.isArray(data.blockedSites) && data.blockedSites.length === 0)) {
      chrome.storage.local.set({ blockedSites: DEFAULT_BLOCKED_SITES });
    }

    if (data.goal && !data.isComplete && !data.blockActive) {
      const currentIndex = data.currentIndex || 0;
      const subtasks = data.subtasks || [];
      if (currentIndex < subtasks.length) {
        createAlarm(data.timerDuration || 10);
      }
    }
  });
});

// Message handling with better error responses
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  
  if (message.action === 'generateTasks') {
    chrome.storage.local.get(['groqApiKey'], (data) => {
      const apiKey = data.groqApiKey;
      if (!apiKey || !apiKey.startsWith('gsk_')) {
        sendResponse({ success: false, error: 'Please add your Groq API key in Settings (get one free at console.groq.com)' });
        return;
      }
      callGroq(message.goal, message.taskCount, apiKey, message.personality, message.pdfText, message.mode, message.pdfPrompt)
        .then((subtasks) => {
          sendResponse({ success: true, subtasks });
        })
        .catch((err) => {
          console.error('Groq error:', err);
          sendResponse({ success: false, error: err.message || 'AI generation failed. Check API key and try again.' });
        });
    });
    return true;
  }

  if (message.action === 'startTimer') {
    chrome.alarms.get(ALARM_NAME, (existingAlarm) => {
      if (!existingAlarm) {
        chrome.storage.local.get(['timerDuration', 'isComplete', 'goal', 'currentIndex', 'subtasks'], (data) => {
          if (data.goal && !data.isComplete) {
            const currentIndex = data.currentIndex || 0;
            const subtasks = data.subtasks || [];
            if (currentIndex < subtasks.length) {
              createAlarm(data.timerDuration || 10);
            }
          }
        });
      }
    });

    sendResponse({ status: 'ok' });
    return true;
  }

  if (message.action === 'resetTimer') {
    chrome.storage.local.get(['timerDuration'], (data) => {
      createAlarm(data.timerDuration || 10);
    });
    sendResponse({ status: 'ok' });
    return true;
  }

  if (message.action === 'stopTimer') {
    chrome.alarms.clear(ALARM_NAME);
    sendResponse({ status: 'ok' });
    return true;
  }
  
  if (message.action === 'getTimerStatus') {
    chrome.alarms.get(ALARM_NAME, (alarm) => {
      sendResponse({ running: !!alarm });
    });
    return true;
  }

  return true;
});

// Default list is now initialized at the top

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name !== ALARM_NAME) return;

  chrome.storage.local.get(['blockedSites', 'subtasks', 'currentIndex', 'isComplete'], (data) => {
    if (data.isComplete) return;
    
    const blockedSites = data.blockedSites || DEFAULT_BLOCKED_SITES;
    
    // Update blocking state in storage to enforce overlay on page reload
    chrome.storage.local.set({ blockActive: true }, () => {
      // Premium feature: Show system notifications when the focus timer ends to remind the user to finish their task
      try {
        chrome.notifications.create({
          type: 'basic',
          iconUrl: 'icon_128.png',
          title: 'ScrollTask — Focus Time Ended!',
          message: 'Your timer has run out! Finish and mark your current micro-task as done to start the next one.',
          priority: 2
        });
      } catch (e) {
        console.error('Failed to show notification:', e);
      }
      
      chrome.tabs.query({}, (tabs) => {
        if (!tabs || tabs.length === 0) return;
        
        tabs.forEach((tab) => {
          if (!tab.url) return;
          try {
            const url = new URL(tab.url);
            const hostname = url.hostname.replace('www.', '').toLowerCase();
            
            const isBlocked = blockedSites.some(site => {
              const cleanSite = site.trim().toLowerCase();
              return hostname === cleanSite || hostname.endsWith('.' + cleanSite);
            });
            
            if (isBlocked) {
              chrome.tabs.sendMessage(tab.id, { action: 'showTask' }).catch(() => {
                // Content script not ready or tab not active - ignore
              });
            }
          } catch (e) {
            // Invalid URL
          }
        });
      });
    });
  });
});
