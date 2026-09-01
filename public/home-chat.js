(function () {
  var userName = window.AI_ASSISTANT_USER || 'Guest';
  var messagesEl = document.getElementById('assistantMessages');
  var statusEl = document.getElementById('assistantStatus');
  var formEl = document.getElementById('assistantForm');
  var inputEl = document.getElementById('assistantInput');
  var submitEl = document.getElementById('assistantSubmit');
  var historyListEl = document.getElementById('historyList');
  var conversationSearchEl = document.getElementById('conversationSearch');
  var newChatBtn = document.querySelector('.new-chat-btn');
  var homeNavLink = document.querySelector('.home-link');
  var allConversationItems = [];

  function refreshConversationSearch() {
    if (!conversationSearchEl || !historyListEl) return;
    var query = normalizeText(conversationSearchEl.value).toLowerCase();
    var items = historyListEl.querySelectorAll('.history-item:not(.empty)');
    items.forEach(function(item) {
      var text = (item.querySelector('.history-text')?.textContent || '').toLowerCase();
      item.style.display = (!query || text.includes(query)) ? '' : 'none';
    });
  }
  var conversation = [];
  var isSubmitting = false;
  var currentConversationId = null;

  function normalizeText(value) {
    return String(value || '').replace(/\s+/g, ' ').trim();
  }

  function isLoanIntent(value) {
    var text = normalizeText(value).toLowerCase();
    if (!text) return false;
    return /(loan|eligibility|eligible|emi|bank recommendation|banking|affordability|mortgage|personal loan|home loan|car loan|education loan|apply for a loan|check.*loan|loan.*check|credit check)/i.test(text);
  }

  function looksLikeCompanyQuery(value) {
    var text = normalizeText(value);
    if (!text) return false;
    var lower = text.toLowerCase();
    if (isLoanIntent(text)) return false;
    if (/(hi|hello|hey|who are you|what can you do|help me|thanks|thank you|update my profile|open emi|calculate emi)/i.test(lower)) return false;
    if (/(company|employer|firm|organization|details about|tell me about|search for|info on)/i.test(lower)) return true;
    var parts = text.split(/\s+/).filter(Boolean);
    return parts.length >= 1 && parts.every(function (part) { return part.length >= 2; }) && !/^(what|when|where|why|how|can|is|are|do|does|should|could|please|tell|show|give)$/i.test(parts[0]);
  }

  function addMessage(role, text) {
    conversation.push({ role: role, text: text });
    renderMessages();
  }

  function showWelcomeMessage() {
    if (!messagesEl) return;
    var welcomeText = 'Hello! I\'m your AI loan assistant. You can ask me about personal loan eligibility, bank policies, or company details. How can I help you today?';
    conversation.push({ role: 'assistant', text: welcomeText });
    renderMessages();
  }

  function formatConversationTitle(text) {
    var value = normalizeText(text || '').replace(/\s+/g, ' ');
    if (!value) return 'New Chat';
    return value.length > 26 ? value.slice(0, 23) + '...' : value;
  }

  function renderRecentConversations(items) {
    if (!historyListEl) return;
    allConversationItems = Array.isArray(items) ? items : [];
    historyListEl.innerHTML = '';
    var list = allConversationItems;
    if (!list.length) {
      var empty = document.createElement('div');
      empty.className = 'history-item empty';
      empty.textContent = 'No recent conversations';
      historyListEl.appendChild(empty);
      refreshConversationSearch();
      return;
    }

    list.forEach(function (item) {
      var row = document.createElement('div');
      row.className = 'history-item';
      row.dataset.conversationId = item.id;
      row.title = 'Open conversation';
      row.addEventListener('click', function () {
        if (item && item.id) {
          loadHistory(item.id);
        }
      });
      var dot = document.createElement('span');
      dot.className = 'dot';
      dot.textContent = '◌';
      var text = document.createElement('span');
      text.className = 'history-text';
      text.textContent = formatConversationTitle(item.title || item.content || 'New Chat');
      var time = document.createElement('span');
      time.className = 'time';
      time.textContent = item.updated_at ? new Date(item.updated_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Now';
      row.appendChild(dot);
      row.appendChild(text);
      row.appendChild(time);
      historyListEl.appendChild(row);
    });

    refreshConversationSearch();
  }

  async function loadRecentConversations() {
    if (!historyListEl) return;
    try {
      var response = await fetch('/api/assistant/conversations', {
        method: 'GET',
        credentials: 'same-origin'
      });
      var data = await response.json();
      renderRecentConversations((data && data.conversations) || []);
    } catch (error) {
      console.error('Unable to load recent conversations:', error);
      renderRecentConversations([]);
    }
  }

  function renderMessages() {
    if (!messagesEl) return;
    messagesEl.innerHTML = '';
    conversation.forEach(function (message) {
      var row = document.createElement('div');
      row.className = 'assistant-message ' + message.role;

      var avatar = document.createElement('div');
      avatar.className = 'assistant-avatar';
      avatar.textContent = message.role === 'user' ? (userName || 'U').charAt(0).toUpperCase() : 'AI';

      var bubble = document.createElement('div');
      bubble.className = 'assistant-bubble';
      bubble.textContent = message.text;

      row.appendChild(avatar);
      row.appendChild(bubble);
      messagesEl.appendChild(row);
    });

    messagesEl.scrollTop = messagesEl.scrollHeight;
  }

  function updateInputHeight() {
    if (!inputEl) return;
    inputEl.style.height = 'auto';
    inputEl.style.height = Math.min(inputEl.scrollHeight, 120) + 'px';
    if (submitEl) submitEl.disabled = !inputEl.value.trim();
  }

  async function saveHistory(role, text) {
    var value = normalizeText(text);
    if (!value || !currentConversationId) return;
    try {
      await fetch('/api/assistant/message', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({ role: role, content: value, conversation_id: currentConversationId })
      });
      loadRecentConversations();
    } catch (error) {
      console.error('Unable to save chat history:', error);
    }
  }

  async function loadHistory(conversationId) {
    try {
      var url = '/api/assistant/history';
      if (conversationId) {
        url += '?conversation_id=' + encodeURIComponent(conversationId);
      }
      var response = await fetch(url, {
        method: 'GET',
        credentials: 'same-origin'
      });
      var data = await response.json();
      if (!data || !data.success) {
        showWelcomeMessage();
        return;
      }

      currentConversationId = data.conversationId || conversationId || currentConversationId;
      conversation = [];
      (data.messages || []).forEach(function (message) {
        if (message && message.content) {
          conversation.push({ role: message.role, text: message.content });
        }
      });
      renderMessages();
      if (statusEl) statusEl.textContent = 'Chat restored';
    } catch (error) {
      console.error('History restore failed:', error);
      showWelcomeMessage();
    }
  }

  async function createNewConversation() {
    try {
      var response = await fetch('/api/assistant/conversations/new', {
        method: 'POST',
        credentials: 'same-origin'
      });
      var data = await response.json();
      if (!data || !data.success || !data.conversationId) {
        throw new Error('Unable to create a new conversation.');
      }

      currentConversationId = data.conversationId;
      conversation = [];
      renderMessages();
      if (statusEl) statusEl.textContent = 'New chat started';
      return true;
    } catch (error) {
      console.error('Unable to create new conversation:', error);
      if (statusEl) statusEl.textContent = 'Could not start a new chat';
      return false;
    }
  }

  var activeCompanySearch = null;

  async function handleAssistantRequest(value) {
    if (activeCompanySearch) {
      console.log('[ASSISTANT] Duplicate request blocked for:', value);
      return;
    }

    activeCompanySearch = (async () => {
      try {
        if (statusEl) statusEl.textContent = 'Processing your request';
        var response = await fetch('/api/assistant/handle', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'same-origin',
          body: JSON.stringify({ message: value, conversation_id: currentConversationId })
        });
        var data = await response.json();
        if (!data || !data.success) {
          throw new Error('Assistant request failed.');
        }

        var userFacingSummary = data.response || data.details || 'I processed your request. How else can I help?';
        addMessage('assistant', userFacingSummary);
        if (statusEl) statusEl.textContent = 'Response ready';
        loadRecentConversations();
      } catch (error) {
        var fallbackMessage = 'I could not process your request right now. Please try again in a moment.';
        addMessage('assistant', fallbackMessage);
        if (statusEl) statusEl.textContent = 'Error';
        console.error(error);
        console.error(error.stack);
      }
    })();

    await activeCompanySearch;
    activeCompanySearch = null;
  }

  formEl.addEventListener('submit', async function (event) {
    event.preventDefault();
    if (isSubmitting) return;

    var value = normalizeText(inputEl.value);
    if (!value) return;

    isSubmitting = true;
    if (submitEl) submitEl.disabled = true;

    try {
      addMessage('user', value);
      inputEl.value = '';
      updateInputHeight();

      await handleAssistantRequest(value);
    } finally {
      isSubmitting = false;
      updateInputHeight();
    }
  });

  if (conversationSearchEl) {
    conversationSearchEl.addEventListener('input', refreshConversationSearch);
  }

  if (inputEl) {
    inputEl.addEventListener('input', updateInputHeight);
    inputEl.addEventListener('keydown', function (event) {
      if (event.key === 'Enter' && !event.shiftKey) {
        event.preventDefault();
        formEl.requestSubmit();
      }
    });
  }

  if (newChatBtn) {
    newChatBtn.addEventListener('click', async function () {
      await createNewConversation();
      if (statusEl) statusEl.textContent = 'Ready';
    });
  }

  if (homeNavLink) {
    homeNavLink.addEventListener('click', function (event) {
      event.preventDefault();
      event.stopPropagation();
      if (statusEl) statusEl.textContent = 'Ready';
      if (currentConversationId) {
        loadHistory(currentConversationId);
      } else {
        loadHistory();
      }
      if (messagesEl) {
        messagesEl.scrollTop = messagesEl.scrollHeight;
      }
    });
  }

  loadHistory();
  loadRecentConversations();
  updateInputHeight();
}());
