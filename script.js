const API_KEY = 'AIzaSyA7ngc3Bk2GQ8G1xizBWaaOI9E0c6A7YuI';
const API_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${API_KEY}`;

let conversationHistory = [];
let isRecording = false;
let recognition = null;

const chatContainer = document.getElementById('chatContainer');
const messageInput = document.getElementById('messageInput');
const sendButton = document.getElementById('sendButton');
const voiceButton = document.getElementById('voiceButton');

// Initialize speech recognition
if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
    recognition = new (window.SpeechRecognition || window.webkitSpeechRecognition)();
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.lang = 'en-US';

    recognition.onresult = function(event) {
        const transcript = event.results[0][0].transcript;
        messageInput.value = transcript;
        messageInput.focus();
    };

    recognition.onend = function() {
        isRecording = false;
        voiceButton.classList.remove('active');
    };
}

// Configure marked for better rendering
marked.setOptions({
    highlight: function(code, lang) {
        if (lang && hljs.getLanguage(lang)) {
            try {
                return hljs.highlight(code, { language: lang }).value;
            } catch (err) {}
        }
        return hljs.highlightAuto(code).value;
    },
    breaks: true,
    gfm: true
});

// Auto-resize textarea
messageInput.addEventListener('input', function() {
    this.style.height = 'auto';
    this.style.height = Math.min(this.scrollHeight, 120) + 'px';
});

// Send message on Enter (but allow Shift+Enter for new line)
messageInput.addEventListener('keydown', function(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        sendMessage();
    }
});

sendButton.addEventListener('click', sendMessage);

function startNewChat() {
    conversationHistory = [];
    chatContainer.innerHTML = '<div class="welcome-message"><p>Welcome! Start a conversation with Nexora AI.</p></div>';
    messageInput.value = '';
    messageInput.style.height = 'auto';
    messageInput.focus();
}

function toggleVoiceRecording() {
    if (!recognition) {
        alert('Speech recognition is not supported in your browser.');
        return;
    }

    if (isRecording) {
        recognition.stop();
    } else {
        recognition.start();
        isRecording = true;
        voiceButton.classList.add('active');
    }
}

async function handleFileUpload(event) {
    const file = event.target.files[0];
    if (!file) return;

    const fileType = file.type;
    let extractedText = '';

    try {
        if (fileType.startsWith('image/')) {
            // For images, we'll just show the filename and let the user describe it
            extractedText = `[Image uploaded: ${file.name}]`;
        } else if (fileType === 'application/pdf') {
            // For PDFs, we'll show the filename
            extractedText = `[PDF uploaded: ${file.name}]`;
        }

        if (extractedText) {
            messageInput.value += extractedText;
            messageInput.focus();
            // Auto-resize textarea
            messageInput.style.height = 'auto';
            messageInput.style.height = Math.min(messageInput.scrollHeight, 120) + 'px';
        }
    } catch (error) {
        console.error('Error processing file:', error);
        alert('Error processing file. Please try again.');
    }

    // Clear the input
    event.target.value = '';
}

async function sendMessage() {
    const message = messageInput.value.trim();
    if (!message) return;

    // Clear welcome message if it exists
    const welcomeMessage = document.querySelector('.welcome-message');
    if (welcomeMessage) {
        welcomeMessage.remove();
    }

    // Add user message to chat
    addMessage(message, 'user');
    
    // Clear input and reset height
    messageInput.value = '';
    messageInput.style.height = 'auto';
    
    // Disable send button
    sendButton.disabled = true;
    
    // Add loading message
    const loadingId = addLoadingMessage();
    
    try {
        // Prepare conversation context
        const contents = conversationHistory.map(item => ({
            parts: [{ text: item.message }],
            role: item.role === 'user' ? 'user' : 'model'
        }));
        
        // Add current message
        contents.push({
            parts: [{ text: message }],
            role: 'user'
        });

        const response = await fetch(API_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                contents: contents
            })
        });

        if (!response.ok) {
            throw new Error(`API Error: ${response.status}`);
        }

        const data = await response.json();
        
        // Remove loading message
        removeLoadingMessage(loadingId);
        
        // Get AI response
        const aiResponse = data.candidates[0].content.parts[0].text;
        
        // Add AI response to chat
        addMessage(aiResponse, 'assistant');
        
        // Update conversation history
        conversationHistory.push(
            { role: 'user', message: message },
            { role: 'assistant', message: aiResponse }
        );

    } catch (error) {
        console.error('Error:', error);
        removeLoadingMessage(loadingId);
        addMessage('Sorry, I encountered an error. Please try again.', 'assistant');
    }
    
    // Re-enable send button
    sendButton.disabled = false;
    
    // Focus back to input
    messageInput.focus();
}

function addMessage(content, sender) {
    const messageDiv = document.createElement('div');
    messageDiv.className = `message ${sender}`;
    
    const label = document.createElement('div');
    label.className = 'message-label';
    label.textContent = sender === 'user' ? 'You' : 'NexoraAI';
    
    const contentDiv = document.createElement('div');
    contentDiv.className = 'message-content';
    
    if (sender === 'assistant') {
        // Parse markdown for AI responses
        const parsedContent = marked.parse(content);
        contentDiv.innerHTML = parsedContent;
        
        // Add copy buttons to code blocks
        addCopyButtonsToCodeBlocks(contentDiv);
    } else {
        // Keep user messages as plain text
        contentDiv.textContent = content;
    }
    
    messageDiv.appendChild(label);
    messageDiv.appendChild(contentDiv);
    chatContainer.appendChild(messageDiv);
    
    // Auto scroll to bottom
    chatContainer.scrollTop = chatContainer.scrollHeight;
}

function addCopyButtonsToCodeBlocks(container) {
    const codeBlocks = container.querySelectorAll('pre');
    codeBlocks.forEach((block, index) => {
        const code = block.querySelector('code');
        if (code) {
            // Create header with copy button
            const header = document.createElement('div');
            header.className = 'code-block-header';
            
            // Detect language
            const langClass = code.className.match(/language-(\w+)/);
            const language = langClass ? langClass[1] : 'text';
            
            header.innerHTML = `
                <span>${language}</span>
                <button class="copy-button" onclick="copyCode(this)">Copy</button>
            `;
            
            // Insert header before code block
            block.parentNode.insertBefore(header, block);
            
            // Store code content in button for copying
            const copyButton = header.querySelector('.copy-button');
            copyButton.setAttribute('data-code', code.textContent);
        }
    });
}

function copyCode(button) {
    const code = button.getAttribute('data-code');
    navigator.clipboard.writeText(code).then(() => {
        const originalText = button.textContent;
        button.textContent = 'Copied!';
        setTimeout(() => {
            button.textContent = originalText;
        }, 2000);
    }).catch(() => {
        // Fallback for older browsers
        const textArea = document.createElement('textarea');
        textArea.value = code;
        document.body.appendChild(textArea);
        textArea.select();
        document.execCommand('copy');
        document.body.removeChild(textArea);
        
        const originalText = button.textContent;
        button.textContent = 'Copied!';
        setTimeout(() => {
            button.textContent = originalText;
        }, 2000);
    });
}

function addLoadingMessage() {
    const messageDiv = document.createElement('div');
    messageDiv.className = 'message assistant';
    messageDiv.id = 'loading-message';
    
    const label = document.createElement('div');
    label.className = 'message-label';
    label.textContent = 'NexoraAI';
    
    const contentDiv = document.createElement('div');
    contentDiv.className = 'message-content loading';
    contentDiv.innerHTML = `
        <span>Thinking</span>
        <div class="typing-indicator">
            <div class="typing-dot"></div>
            <div class="typing-dot"></div>
            <div class="typing-dot"></div>
        </div>
    `;
    
    messageDiv.appendChild(label);
    messageDiv.appendChild(contentDiv);
    chatContainer.appendChild(messageDiv);
    
    // Auto scroll to bottom
    chatContainer.scrollTop = chatContainer.scrollHeight;
    
    return 'loading-message';
}

function removeLoadingMessage(id) {
    const loadingMessage = document.getElementById(id);
    if (loadingMessage) {
        loadingMessage.remove();
    }
}

// Focus on input when page loads
window.addEventListener('load', () => {
    messageInput.focus();
});
// Hide loader after page loads
window.addEventListener('load', () => {
    const loader = document.getElementById('global-loader');
    if (loader) {
        loader.style.opacity = '0';
        setTimeout(() => loader.style.display = 'none', 300);
    }
    messageInput.focus();
});

// Show loader when "New Chat" is clicked
function startNewChat() {
    const loader = document.getElementById('global-loader');
    if (loader) {
        loader.style.display = 'flex';
        loader.style.opacity = '1';
    }
    setTimeout(() => {
        conversationHistory = [];
        chatContainer.innerHTML = '<div class="welcome-message"><p>Welcome! Start a conversation with Nexora AI.</p></div>';
        messageInput.value = '';
        messageInput.style.height = 'auto';
        messageInput.focus();
        if (loader) {
            loader.style.opacity = '0';
            setTimeout(() => loader.style.display = 'none', 300);
        }
    }, 600);
}
