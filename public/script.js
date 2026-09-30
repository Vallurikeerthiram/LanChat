document.addEventListener('DOMContentLoaded', () => {
    const chatForm = document.getElementById('chat-form');
    const messageInput = document.getElementById('message-input');
    const chatContainer = document.getElementById('chat-container');
    const sendButton = document.getElementById('send-button');

    function escapeHtml(str) {
        if (!str) return '';
        return String(str)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
    }

    // Copy helper supporting both modern Clipboard API and HTTP LAN fallback
    async function copyCodeToClipboard(text) {
        if (navigator.clipboard && window.isSecureContext) {
            return navigator.clipboard.writeText(text);
        }
        // Fallback for non-HTTPS LAN contexts (e.g. http://192.168.x.x:3000)
        return new Promise((resolve, reject) => {
            const textArea = document.createElement('textarea');
            textArea.value = text;
            textArea.style.position = 'fixed';
            textArea.style.left = '-9999px';
            textArea.style.top = '-9999px';
            textArea.setAttribute('readonly', '');
            document.body.appendChild(textArea);
            textArea.focus();
            textArea.select();
            try {
                const successful = document.execCommand('copy');
                document.body.removeChild(textArea);
                if (successful) resolve();
                else reject(new Error('execCommand copy failed'));
            } catch (err) {
                document.body.removeChild(textArea);
                reject(err);
            }
        });
    }

    // Markdown parser with code block wrapper & copy button support
    function parseMarkdown(text) {
        if (!text) return '';

        const codeBlocks = [];

        // 1. Extract fenced code blocks with optional language
        let processed = text.replace(/```([a-zA-Z0-9_\-#+.]+)?\r?\n([\s\S]*?)```/g, (match, lang, code) => {
            const id = codeBlocks.length;
            codeBlocks.push({ lang: (lang || 'code').trim(), code: code.replace(/\r?\n$/, '') });
            return `@@CODE_BLOCK_${id}@@`;
        });

        // 2. Extract inline single backticks
        processed = processed.replace(/`([^`]+)`/g, (match, inline) => {
            return `<code class="inline-code">${escapeHtml(inline)}</code>`;
        });

        // 3. Bold & Italic
        processed = processed.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
        processed = processed.replace(/\*([^*]+)\*/g, '<em>$1</em>');

        // 4. Split paragraphs while preserving code block placeholders
        const lines = processed.split(/\r?\n/);
        const htmlParts = [];
        let currentPara = [];

        for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed) {
                if (currentPara.length > 0) {
                    htmlParts.push(`<p>${currentPara.join('<br>')}</p>`);
                    currentPara = [];
                }
                continue;
            }

            if (/^@@CODE_BLOCK_\d+@@$/.test(trimmed)) {
                if (currentPara.length > 0) {
                    htmlParts.push(`<p>${currentPara.join('<br>')}</p>`);
                    currentPara = [];
                }
                htmlParts.push(trimmed);
            } else {
                currentPara.push(trimmed);
            }
        }
        if (currentPara.length > 0) {
            htmlParts.push(`<p>${currentPara.join('<br>')}</p>`);
        }

        let finalHtml = htmlParts.join('');

        // 5. Replace placeholders with full code container + Copy button
        finalHtml = finalHtml.replace(/@@CODE_BLOCK_(\d+)@@/g, (match, index) => {
            const block = codeBlocks[Number(index)];
            if (!block) return '';
            const lang = block.lang || 'code';
            const escapedCode = escapeHtml(block.code);
            return `
                <div class="code-block-container">
                    <div class="code-block-header">
                        <span class="code-lang-tag">${escapeHtml(lang)}</span>
                        <button type="button" class="copy-code-btn" title="Copy only code">
                            <i class="fa-regular fa-copy"></i>
                            <span class="copy-label">Copy</span>
                        </button>
                    </div>
                    <pre class="code-block-pre"><code class="code-block-text">${escapedCode}</code></pre>
                </div>
            `;
        });

        return finalHtml;
    }
    
    function getTimestamp() {
        const now = new Date();
        const hrs = String(now.getHours()).padStart(2, '0');
        const mins = String(now.getMinutes()).padStart(2, '0');
        const secs = String(now.getSeconds()).padStart(2, '0');
        const ms = String(now.getMilliseconds()).padStart(3, '0');
        return `${hrs}:${mins}:${secs}.${ms}`;
    }

    function addMessageToUI(role, text, time, ticksHtml = '') {
        const messageDiv = document.createElement('div');
        messageDiv.className = `message ${role}`;
        
        const headerDiv = document.createElement('div');
        headerDiv.className = `message-header ${role === 'user' ? 'user-header' : ''}`;
        
        let headerContent = `<span>${time}</span>`;
        if (role === 'user') {
            headerContent = `<span>${time}<span class="ticks grey" id="status-ticks">${ticksHtml}</span></span>`;
        }
        
        headerDiv.innerHTML = headerContent;
        
        const bubbleDiv = document.createElement('div');
        bubbleDiv.className = 'message-body';
        bubbleDiv.innerHTML = parseMarkdown(text);
        
        messageDiv.appendChild(headerDiv);
        messageDiv.appendChild(bubbleDiv);
        
        chatContainer.appendChild(messageDiv);
        scrollToBottom();
    }

    function updateTicks(html) {
        const ticksEl = document.getElementById('status-ticks');
        if (ticksEl) {
            ticksEl.innerHTML = html;
        }
    }

    function scrollToBottom() {
        chatContainer.scrollTop = chatContainer.scrollHeight;
    }

    // Click handler for Copy Code button (delegated to chat container)
    chatContainer.addEventListener('click', async (e) => {
        const copyBtn = e.target.closest('.copy-code-btn');
        if (!copyBtn) return;
        
        const container = copyBtn.closest('.code-block-container');
        if (!container) return;
        
        const codeElement = container.querySelector('.code-block-text');
        if (!codeElement) return;

        // Extracts purely the raw text content of the code element
        const rawCode = codeElement.textContent;

        try {
            await copyCodeToClipboard(rawCode);
            copyBtn.classList.add('copied');
            const label = copyBtn.querySelector('.copy-label');
            const icon = copyBtn.querySelector('i');
            if (label) label.textContent = 'Copied!';
            if (icon) icon.className = 'fa-solid fa-check';

            setTimeout(() => {
                copyBtn.classList.remove('copied');
                if (label) label.textContent = 'Copy';
                if (icon) icon.className = 'fa-regular fa-copy';
            }, 2000);
        } catch (err) {
            console.error('Failed to copy code to clipboard:', err);
        }
    });

    chatForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const message = messageInput.value.trim();
        if (!message) return;
        
        // Clear UI to only show the new interaction (max 2 messages on desktop)
        chatContainer.innerHTML = '';
        
        // Disable input while sending
        messageInput.value = '';
        messageInput.disabled = true;
        sendButton.disabled = true;
        
        const userTime = getTimestamp();
        
        // Add user message to UI (1 tick)
        addMessageToUI('user', message, userTime, '✓');
        
        // Change to 2 grey ticks to indicate processing
        setTimeout(() => {
            updateTicks('✓✓');
        }, 100);
        
        try {
            // Send to server (server maintains full persistent history on the phone)
            const response = await fetch('/api/chat', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ message }),
            });
            
            const data = await response.json();
            const aiTime = getTimestamp();
            
            if (response.ok) {
                // Add model message to UI with rendered code and copy button
                addMessageToUI('model', data.reply, aiTime);
                
                // Update user ticks to blue
                updateTicks('✓✓');
                const ticksEl = document.getElementById('status-ticks');
                if (ticksEl) {
                    ticksEl.className = 'ticks blue';
                }
            } else {
                addMessageToUI('system', data.error || 'Sorry, I encountered an error. Please try again.', getTimestamp());
            }
        } catch (error) {
            console.error('Error:', error);
            addMessageToUI('system', 'Network error. Please check your connection.', getTimestamp());
        } finally {
            messageInput.disabled = false;
            sendButton.disabled = false;
            messageInput.focus();
        }
    });
});
