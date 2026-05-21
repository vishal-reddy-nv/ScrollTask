(function() {
  let currentHost = '';
  let activeIntervalId = null;
  
  // Get hostname safely
  try {
    currentHost = window.location.hostname.replace('www.', '').toLowerCase();
  } catch(e) {
    return;
  }
  
  function checkAndBlockSite() {
    chrome.storage.local.get(['blockedSites', 'goal', 'isComplete', 'subtasks', 'currentIndex', 'blockActive'], (data) => {
      const blockedSites = data.blockedSites || [
        'instagram.com', 'reddit.com', 'x.com', 'twitter.com', 
        'facebook.com', 'youtube.com'
      ];
      
      const isBlocked = blockedSites.some(site => {
        const cleanSite = site.trim().toLowerCase();
        return currentHost === cleanSite || currentHost.endsWith('.' + cleanSite);
      });
      
      if (!isBlocked) return;
      
      // Notify background to start/maintain timer if goal is active
      if (data.goal && !data.isComplete) {
        const currentIndex = data.currentIndex || 0;
        const subtasks = data.subtasks || [];
        if (currentIndex < subtasks.length) {
          chrome.runtime.sendMessage({ action: 'startTimer' }).catch(() => {});
          
          // Block the site ONLY if blockActive is true!
          if (data.blockActive) {
            showTaskUI(subtasks, currentIndex);
          } else {
            removeUISynchronous();
          }
        } else {
          if (data.blockActive || data.isComplete) {
            showCongratulations(data.goal);
          } else {
            removeUISynchronous();
          }
        }
      } else {
        removeUISynchronous();
      }
    });
  }
  
  // Initial run
  checkAndBlockSite();
  
  function getRandomQuote() {
    const quotes = [
      "✨ Small steps every day lead to big results.",
      "🎯 You are one task closer to your goal.",
      "⚡ Discipline is choosing between what you want now and what you want most.",
      "📈 Progress, not perfection.",
      "🌟 Every expert was once a beginner.",
      "👊 Your future self is watching. Make them proud.",
      "💪 One task at a time. You've got this.",
      "🔥 Consistency beats motivation every time.",
      "⏰ The scroll can wait. Your goals cannot.",
      "🏆 You showed up. That already makes you better.",
      "🌱 Growth happens outside the comfort zone.",
      "🎯 Do it now. Your future self will thank you.",
      "📊 Small wins compound into massive results.",
      "🚀 You are building the person you want to become."
    ];
    return quotes[Math.floor(Math.random() * quotes.length)];
  }
  
  function removeUI() {
    if (activeIntervalId) {
      clearInterval(activeIntervalId);
      activeIntervalId = null;
    }
    const overlay = document.getElementById('scrolltask-overlay');
    if (overlay) {
      overlay.style.opacity = '0';
      setTimeout(() => {
        if (overlay.parentNode) overlay.parentNode.removeChild(overlay);
        document.body.classList.remove('scrolltask-locked');
        document.documentElement.classList.remove('scrolltask-locked');
      }, 300);
    }
  }
  
  function removeUISynchronous() {
    if (activeIntervalId) {
      clearInterval(activeIntervalId);
      activeIntervalId = null;
    }
    const overlay = document.getElementById('scrolltask-overlay');
    if (overlay) {
      if (overlay.parentNode) overlay.parentNode.removeChild(overlay);
      document.body.classList.remove('scrolltask-locked');
      document.documentElement.classList.remove('scrolltask-locked');
    }
  }
  
  function showCongratulations(goal) {
    if (document.getElementById('scrolltask-overlay')) return;
    
    const overlay = createOverlay();
    const card = createCard();
    
    card.innerHTML = `
      <div style="font-size: 64px; margin-bottom: 20px; filter: drop-shadow(0 0 20px rgba(255,215,0,0.4));">🏆</div>
      <div style="font-size: 32px; font-weight: 800; background: linear-gradient(135deg, #FFD700, #FFA500); -webkit-background-clip: text; -webkit-text-fill-color: transparent; margin-bottom: 12px; font-family: inherit;">Goal Complete!</div>
      <div style="font-size: 15px; color: rgba(255,255,255,0.7); margin-bottom: 16px; line-height: 1.5; font-family: inherit;">"${escapeHtml(goal)}"</div>
      <div style="font-size: 14px; color: rgba(255,255,255,0.5); margin-bottom: 32px; font-family: inherit;">You stayed disciplined and crushed every task. That's how champions are made.</div>
      <button id="scrolltask-celebrate-btn" style="width: 100%; padding: 16px; border: none; border-radius: 14px; background: linear-gradient(135deg, #FFD700, #FFA500); color: #1a1a2e; font-size: 16px; font-weight: 700; cursor: pointer; transition: all 0.2s; font-family: inherit;">🎉 Celebrate & Set New Goal 🎉</button>
    `;
    
    overlay.appendChild(card);
    safeAppendOverlay(overlay);
    
    setTimeout(() => { overlay.style.opacity = '1'; }, 10);
    
    document.getElementById('scrolltask-celebrate-btn').addEventListener('click', () => {
      chrome.storage.local.remove(['goal', 'subtasks', 'currentIndex', 'isComplete', 'blockActive'], () => {
        chrome.runtime.sendMessage({ action: 'stopTimer' }).catch(() => {});
        removeUI();
      });
    });
  }
  
  function showTaskUI(subtasks, currentIndex) {
    if (document.getElementById('scrolltask-overlay')) return;
    
    const total = subtasks.length;
    const task = subtasks[currentIndex];
    const progress = (currentIndex / total) * 100;
    
    const overlay = createOverlay();
    const card = createCard();
    
    card.innerHTML = `
      <div style="margin-bottom: 16px;">
        <div style="font-size: 11px; font-weight: 700; letter-spacing: 2px; color: rgba(255,255,255,0.4); text-transform: uppercase; font-family: inherit;">ScrollTask</div>
      </div>
      <div style="width: 100%; background: rgba(255,255,255,0.08); border-radius: 10px; height: 6px; margin-bottom: 8px; overflow: hidden;">
        <div style="height: 100%; width: ${progress}%; background: linear-gradient(90deg, #6c63ff, #48cfad); border-radius: 10px; transition: width 0.3s;"></div>
      </div>
      <div style="font-size: 11px; color: rgba(255,255,255,0.5); margin-bottom: 24px; text-align: right; font-family: inherit;">${currentIndex + 1} of ${total}</div>
      <div style="display: inline-block; background: linear-gradient(135deg, rgba(108,99,255,0.2), rgba(72,207,173,0.2)); border: 1px solid rgba(108,99,255,0.3); color: #a8a4ff; font-size: 10px; letter-spacing: 1.5px; text-transform: uppercase; padding: 5px 12px; border-radius: 20px; margin-bottom: 20px; font-weight: 700; font-family: inherit;">MICRO-TASK</div>
      <div style="font-size: 22px; font-weight: 700; color: white; line-height: 1.4; margin-bottom: 32px; font-family: inherit;">${escapeHtml(task)}</div>
      
      <button id="scrolltask-done-btn" style="position: relative; overflow: hidden; width: 100%; padding: 16px; border: none; border-radius: 14px; background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1); color: rgba(255,255,255,0.45); font-size: 16px; font-weight: 600; cursor: not-allowed; margin-bottom: 20px; transition: all 0.3s; font-family: inherit; display: flex; align-items: center; justify-content: center; z-index: 1;" disabled>
        <div id="scrolltask-btn-progress" style="position: absolute; top: 0; left: 0; bottom: 0; width: 0%; background: linear-gradient(90deg, #6c63ff, #48cfad); z-index: -1; transition: width 1s linear;"></div>
        <span id="scrolltask-btn-text" style="z-index: 2; transition: all 0.2s;">✓ Mark as Done (20s)</span>
      </button>
      
      <div style="font-size: 12px; color: rgba(255,255,255,0.35); font-style: italic; text-align: center; font-family: inherit;">“${getRandomQuote()}”</div>
    `;
    
    overlay.appendChild(card);
    safeAppendOverlay(overlay);
    
    setTimeout(() => { overlay.style.opacity = '1'; }, 10);
    
    // Countdown Timer logic
    const doneBtn = card.querySelector('#scrolltask-done-btn');
    const progressFill = card.querySelector('#scrolltask-btn-progress');
    const btnText = card.querySelector('#scrolltask-btn-text');
    
    let secondsLeft = 20;
    
    if (activeIntervalId) {
      clearInterval(activeIntervalId);
    }
    
    activeIntervalId = setInterval(() => {
      secondsLeft--;
      if (secondsLeft > 0) {
        btnText.textContent = `✓ Mark as Done (${secondsLeft}s)`;
        if (progressFill) {
          progressFill.style.width = `${((20 - secondsLeft) / 20) * 100}%`;
        }
      } else {
        clearInterval(activeIntervalId);
        activeIntervalId = null;
        doneBtn.disabled = false;
        doneBtn.style.cursor = 'pointer';
        doneBtn.style.color = '#ffffff';
        doneBtn.style.background = 'linear-gradient(135deg, #6c63ff, #48cfad)';
        doneBtn.classList.add('scrolltask-pulse-active');
        btnText.textContent = `✓ Mark as Done`;
        if (progressFill) {
          progressFill.style.width = '100%';
        }
      }
    }, 1000);
    
    doneBtn.addEventListener('click', () => {
      if (doneBtn.disabled) return;
      const nextIndex = currentIndex + 1;
      
      chrome.storage.local.get(['tasksCompletedToday', 'subtasks', 'goal'], (stats) => {
        const completedCount = (stats.tasksCompletedToday || 0) + 1;
        const subtasks = stats.subtasks || [];
        const isComplete = nextIndex >= subtasks.length;
        
        chrome.storage.local.set({ 
          currentIndex: nextIndex,
          tasksCompletedToday: completedCount,
          isComplete: isComplete,
          blockActive: false
        }, () => {
          chrome.runtime.sendMessage({ action: 'resetTimer' }).catch(() => {});
          removeUI();
          
          if (isComplete) {
            setTimeout(() => {
              showCongratulations(stats.goal || "Goal Complete");
            }, 100);
          }
        });
      });
    });
  }
  
  function createOverlay() {
    const overlay = document.createElement('div');
    overlay.id = 'scrolltask-overlay';
    overlay.style.cssText = `
      position: fixed;
      top: 0; left: 0;
      width: 100%; height: 100%;
      z-index: 2147483647;
      display: flex;
      align-items: center;
      justify-content: center;
      opacity: 0;
      transition: opacity 0.3s ease;
      background: radial-gradient(circle at 30% 10%, #0a0a1a, #05050a);
      font-family: -apple-system, BlinkMacSystemFont, "SF Pro Text", "SF Pro Display", "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
    `;
    return overlay;
  }
  
  function createCard() {
    const card = document.createElement('div');
    card.style.cssText = `
      background: rgba(15, 15, 35, 0.85);
      backdrop-filter: blur(20px);
      border: 1px solid rgba(255,255,255,0.1);
      border-radius: 32px;
      padding: 36px 32px;
      max-width: 440px;
      width: 90%;
      text-align: center;
      box-shadow: 0 25px 50px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.05);
      animation: scrolltaskSlideIn 0.4s cubic-bezier(0.2, 0.9, 0.4, 1.1);
    `;
    
    if (!document.querySelector('#scrolltask-animations')) {
      const style = document.createElement('style');
      style.id = 'scrolltask-animations';
      style.textContent = `
        @keyframes scrolltaskSlideIn {
          from { opacity: 0; transform: scale(0.95) translateY(20px); }
          to { opacity: 1; transform: scale(1) translateY(0); }
        }
        @keyframes scrolltaskPulseGlow {
          0% { box-shadow: 0 0 12px rgba(108, 99, 255, 0.4), 0 0 20px rgba(72, 207, 173, 0.2); }
          50% { box-shadow: 0 0 24px rgba(108, 99, 255, 0.7), 0 0 35px rgba(72, 207, 173, 0.4); }
          100% { box-shadow: 0 0 12px rgba(108, 99, 255, 0.4), 0 0 20px rgba(72, 207, 173, 0.2); }
        }
        .scrolltask-pulse-active {
          animation: scrolltaskPulseGlow 2s infinite ease-in-out !important;
        }
        body.scrolltask-locked, html.scrolltask-locked {
          overflow: hidden !important;
          height: 100% !important;
          max-height: 100% !important;
        }
        #scrolltask-overlay * {
          box-sizing: border-box !important;
          margin: 0 !important;
          padding: 0 !important;
          font-family: -apple-system, BlinkMacSystemFont, "SF Pro Text", "SF Pro Display", "Segoe UI", Roboto, Helvetica, Arial, sans-serif !important;
          letter-spacing: normal !important;
          text-transform: none !important;
        }
        #scrolltask-overlay #scrolltask-done-btn {
          position: relative !important;
          overflow: hidden !important;
          width: 100% !important;
          height: auto !important;
          min-height: 52px !important;
          padding: 16px 24px !important;
          border: 1px solid rgba(255,255,255,0.1) !important;
          border-radius: 14px !important;
          background: rgba(255,255,255,0.05) !important;
          color: rgba(255,255,255,0.45) !important;
          font-size: 16px !important;
          font-weight: 600 !important;
          cursor: not-allowed !important;
          margin-bottom: 20px !important;
          transition: all 0.3s ease !important;
          display: flex !important;
          align-items: center !important;
          justify-content: center !important;
          z-index: 1 !important;
          text-align: center !important;
          box-shadow: none !important;
          line-height: 1.2 !important;
        }
        #scrolltask-overlay #scrolltask-done-btn:hover:not(:disabled) {
          transform: translateY(-1px) !important;
          border-color: rgba(255,255,255,0.2) !important;
        }
        #scrolltask-overlay #scrolltask-done-btn:not(:disabled) {
          cursor: pointer !important;
          color: #ffffff !important;
          background: linear-gradient(135deg, #6c63ff, #48cfad) !important;
        }
        #scrolltask-overlay #scrolltask-celebrate-btn {
          width: 100% !important;
          height: auto !important;
          min-height: 52px !important;
          padding: 16px 24px !important;
          border: none !important;
          border-radius: 14px !important;
          background: linear-gradient(135deg, #FFD700, #FFA500) !important;
          color: #1a1a2e !important;
          font-size: 16px !important;
          font-weight: 700 !important;
          cursor: pointer !important;
          transition: all 0.2s ease !important;
          display: flex !important;
          align-items: center !important;
          justify-content: center !important;
          text-align: center !important;
          box-shadow: 0 4px 15px rgba(255, 215, 0, 0.2) !important;
          line-height: 1.2 !important;
        }
        #scrolltask-overlay #scrolltask-celebrate-btn:hover {
          transform: translateY(-1px) !important;
          box-shadow: 0 6px 20px rgba(255, 215, 0, 0.35) !important;
        }
        #scrolltask-overlay #scrolltask-btn-progress {
          position: absolute !important;
          top: 0 !important;
          left: 0 !important;
          bottom: 0 !important;
          width: 0%;
          background: linear-gradient(90deg, #6c63ff, #48cfad) !important;
          z-index: -1 !important;
          transition: width 1s linear !important;
          height: 100% !important;
        }
        #scrolltask-overlay #scrolltask-btn-text {
          z-index: 2 !important;
          transition: all 0.2s !important;
          display: inline-block !important;
          line-height: 1.2 !important;
        }
      `;
      if (document.head) {
        document.head.appendChild(style);
      } else {
        document.documentElement.appendChild(style);
      }
    }
    
    return card;
  }
  
  function escapeHtml(text) {
    if (!text) return "";
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }
  
  // Listen for storage changes to synchronize multiple tabs dynamically
  chrome.storage.onChanged.addListener((changes, areaName) => {
    if (areaName !== 'local') return;
    checkAndBlockSite();
  });

  // MutationObserver to prevent pages from dynamically removing or tampering with our overlay
  const observer = new MutationObserver(() => {
    chrome.storage.local.get(['goal', 'blockActive'], (data) => {
      if (data.goal && data.blockActive) {
        const overlay = document.getElementById('scrolltask-overlay');
        if (!overlay) {
          checkAndBlockSite();
        } else {
          // React/dynamic page updates might clear the scroll lock classes from body/html
          if (document.body && !document.body.classList.contains('scrolltask-locked')) {
            document.body.classList.add('scrolltask-locked');
          }
          if (document.documentElement && !document.documentElement.classList.contains('scrolltask-locked')) {
            document.documentElement.classList.add('scrolltask-locked');
          }
          // Ensure it stays flex, visible and on top
          if (overlay.style.display === 'none') {
            overlay.style.display = 'flex';
          }
          if (overlay.style.opacity !== '1' && !activeIntervalId) {
            overlay.style.opacity = '1';
          }
        }
      }
    });
  });

  if (document.body) {
    observer.observe(document.body, { childList: true });
  } else {
    document.addEventListener('DOMContentLoaded', () => {
      observer.observe(document.body, { childList: true });
    });
  }

  function safeAppendOverlay(overlay) {
    function applyLock() {
      if (document.body) {
        document.body.appendChild(overlay);
        document.body.classList.add('scrolltask-locked');
      }
      if (document.documentElement) {
        document.documentElement.classList.add('scrolltask-locked');
      }
    }

    if (!document.body) {
      document.addEventListener('DOMContentLoaded', applyLock);
    } else {
      applyLock();
    }
  }

  function initializeScrollTask() {
    chrome.runtime.onMessage.removeListener(messageListener);
    chrome.runtime.onMessage.addListener(messageListener);
  }
  
  function messageListener(message, sender, sendResponse) {
    if (message.action === 'showTask') {
      chrome.storage.local.get(['subtasks', 'currentIndex', 'isComplete', 'goal'], (data) => {
        if (!data.goal || !data.subtasks || data.subtasks.length === 0) return;
        if (data.isComplete) return;
        
        const currentIndex = data.currentIndex || 0;
        
        if (currentIndex >= data.subtasks.length) {
          showCongratulations(data.goal);
        } else {
          showTaskUI(data.subtasks, currentIndex);
        }
      });
      sendResponse({ status: 'ok' });
    }
    return true;
  }

  initializeScrollTask();
})();
