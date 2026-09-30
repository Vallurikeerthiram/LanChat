document.addEventListener('DOMContentLoaded', () => {
    const chatForm = document.getElementById('chat-form');
    const messageInput = document.getElementById('message-input');
    const chatContainer = document.getElementById('chat-container');
    const sendButton = document.getElementById('send-button');

    // Keep track of conversation history for the AI, but UI will only show last 2
    let chatHistory = [];

    // Simple markdown to HTML parser for basic formatting
    function parseMarkdown(text) {
        let html = text.replace(/```([\s\S]*?)```/g, '<pre><code>$1</code></pre>');
        html = html.replace(/`([^`]+)`/g, '<code>$1</code>');
        html = html.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
        html = html.replace(/\*([^*]+)\*/g, '<em>$1</em>');
        html = html.split('\n').map(line => line.trim() === '' ? '' : `<p>${line}</p>`).join('');
        return html;
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

    chatForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const message = messageInput.value.trim();
        if (!message) return;
        
        // Clear UI to only show the new interaction (max 2 messages)
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
            // Send to server
            const response = await fetch('/api/chat', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ 
                    message: message,
                    history: chatHistory
                }),
            });
            
            const data = await response.json();
            
            const aiTime = getTimestamp();
            
            if (response.ok) {
                // Update history internally
                chatHistory.push({ role: 'user', text: message });
                chatHistory.push({ role: 'model', text: data.reply });
                
                // Add model message to UI
                addMessageToUI('model', data.reply, aiTime);
                
                // Update user ticks to blue
                updateTicks('✓✓');
                const ticksEl = document.getElementById('status-ticks');
                if (ticksEl) {
                    ticksEl.className = 'ticks blue';
                }
            } else {
                addMessageToUI('system', 'Sorry, I encountered an error. Please try again.', getTimestamp());
            }
        } catch (error) {
            console.error('Error:', error);
            addMessageToUI('system', 'Network error. Please check your connection.', getTimestamp());
        } finally {
            // Re-enable input
            messageInput.disabled = false;
            sendButton.disabled = false;
            messageInput.focus();
        }
    });
});
