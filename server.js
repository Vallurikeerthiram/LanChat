const express = require('express');
const cors = require('cors');
const path = require('path');
const os = require('os');
const fs = require('fs');
require('dotenv').config();

const app = express();
const port = 3000;

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Persistent chat history file on phone / server
const historyFilePath = path.join(__dirname, 'chat_history.json');

function loadHistory() {
    try {
        if (fs.existsSync(historyFilePath)) {
            const raw = fs.readFileSync(historyFilePath, 'utf8');
            const parsed = JSON.parse(raw);
            if (Array.isArray(parsed)) {
                console.log(`Loaded ${parsed.length} persistent chat messages from ${historyFilePath}`);
                return parsed;
            }
        }
    } catch (err) {
        console.error('Error loading chat history:', err.message);
    }
    return [];
}

function saveHistory(history) {
    try {
        // Keep the last 50 messages to maintain ample context without overflowing token limits
        const trimmed = history.slice(-50);
        fs.writeFileSync(historyFilePath, JSON.stringify(trimmed, null, 2), 'utf8');
    } catch (err) {
        console.error('Error saving chat history:', err.message);
    }
}

// In-memory reference synced to disk
let serverChatHistory = loadHistory();

// GET endpoint to inspect history
app.get('/api/history', (req, res) => {
    res.json({
        count: serverChatHistory.length,
        history: serverChatHistory
    });
});

// POST endpoint to clear history
app.post('/api/history/clear', (req, res) => {
    serverChatHistory = [];
    saveHistory(serverChatHistory);
    console.log('Chat history cleared.');
    res.json({ success: true, message: 'History cleared' });
});

app.post('/api/chat', async (req, res) => {
    try {
        const { message, resetHistory } = req.body;
        
        if (!message || typeof message !== 'string' || message.trim() === '') {
            return res.status(400).json({ error: 'Message cannot be empty.' });
        }

        if (resetHistory) {
            serverChatHistory = [];
            saveHistory(serverChatHistory);
        }

        const trimmedMessage = message.trim();

        // Convert stored history to OpenRouter/OpenAI message format
        // Use up to the last 20 messages for context
        const contextWindow = serverChatHistory.slice(-20);
        const messages = contextWindow.map(msg => ({
            role: msg.role === 'user' ? 'user' : 'assistant',
            content: msg.content
        }));
        
        messages.push({ role: 'user', content: trimmedMessage });

        const geminiKeys = [
            process.env.GEMINI_API_KEY_1,
            process.env.GEMINI_API_KEY_2,
            process.env.GEMINI_API_KEY_3,
            process.env.GEMINI_API_KEY_4,
            process.env.GEMINI_API_KEY_5,
            process.env.GEMINI_API_KEY_6,
            process.env.GEMINI_API_KEY_7,
            process.env.GEMINI_API_KEY_8,
            process.env.GEMINI_API_KEY_9,
            process.env.GEMINI_API_KEY_10,
            process.env.GEMINI_API_KEY_11
        ].filter(k => k); // Remove any undefined keys

        // Global index for round-robin rotation of Gemini keys
        if (typeof global.geminiIndex === 'undefined') {
            global.geminiIndex = 0;
        }

        // Build providers array for this specific request
        const providers = [];
        
        // 1. Add all Gemini keys in a rotated order
        if (geminiKeys.length > 0) {
            for (let i = 0; i < geminiKeys.length; i++) {
                const index = (global.geminiIndex + i) % geminiKeys.length;
                providers.push({
                    name: `Google Gemini (Key ${index + 1})`,
                    url: "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions",
                    model: "gemini-2.5-flash",
                    key: geminiKeys[index]
                });
            }
            // Increment the starting index for the next request
            global.geminiIndex = (global.geminiIndex + 1) % geminiKeys.length;
        }

        // 2. Add Groq as secondary fallback
        if (process.env.GROQ_API_KEY) {
            providers.push({
                name: "Groq (Secondary)",
                url: "https://api.groq.com/openai/v1/chat/completions",
                model: "llama-3.1-8b-instant",
                key: process.env.GROQ_API_KEY
            });
        }

        // 3. Add OpenRouter as tertiary fallback
        if (process.env.OPENROUTER_API_KEY) {
            providers.push({
                name: "OpenRouter (Tertiary)",
                url: "https://openrouter.ai/api/v1/chat/completions",
                model: "openai/gpt-oss-20b:free",
                key: process.env.OPENROUTER_API_KEY
            });
        }

        let lastError = null;

        for (const provider of providers) {
            try {
                const response = await fetch(provider.url, {
                    method: "POST",
                    headers: {
                        "Authorization": `Bearer ${provider.key}`,
                        "Content-Type": "application/json"
                    },
                    body: JSON.stringify({
                        model: provider.model,
                        messages: messages
                    })
                });

                if (!response.ok) {
                    const errText = await response.text();
                    throw new Error(`${provider.name} error: ${response.status} ${response.statusText} - ${errText}`);
                }

                const data = await response.json();
                const text = data.choices[0].message.content;

                console.log(`Successfully replied using ${provider.name}`);

                // Persist new interaction into server history
                const now = new Date().toISOString();
                serverChatHistory.push({ role: 'user', content: trimmedMessage, timestamp: now });
                serverChatHistory.push({ role: 'assistant', content: text, timestamp: now });
                saveHistory(serverChatHistory);

                return res.json({ 
                    reply: text,
                    historyCount: serverChatHistory.length
                });
            } catch (error) {
                console.error(`Fallback triggered: ${error.message}`);
                lastError = error;
                // Loop continues to next provider
            }
        }

        // If loop finishes without returning, all providers failed
        console.error('All providers failed. Last error:', lastError);
        res.status(500).json({ error: 'Failed to process the request across all configured APIs.' });
    } catch (error) {
        console.error('Unexpected server error:', error);
        res.status(500).json({ error: 'An unexpected internal error occurred.' });
    }
});

// Function to get local IP address
function getLocalIpAddress() {
    const interfaces = os.networkInterfaces();
    let wifiIp = null;
    let fallbackIp = 'localhost';

    for (const name of Object.keys(interfaces)) {
        for (const iface of interfaces[name]) {
            // Skip over internal and non-ipv4 addresses
            if (iface.family === 'IPv4' && !iface.internal) {
                // Prioritize Wi-Fi adapters (Android uses wlan0, Windows uses Wi-Fi)
                const isWifi = name.toLowerCase().includes('wi-fi') || 
                               name.toLowerCase().includes('wireless') || 
                               name.toLowerCase().includes('wlan');
                
                if (isWifi) {
                    wifiIp = iface.address;
                }
                // Fallback to the first available non-internal IPv4 if no Wi-Fi is found
                if (fallbackIp === 'localhost' && iface.address !== '192.0.0.2') {
                    fallbackIp = iface.address;
                }
            }
        }
    }
    return wifiIp || fallbackIp;
}

// Listen on 0.0.0.0 to allow access from local network (LAN/WiFi)
app.listen(port, '0.0.0.0', () => {
    const ipAddress = getLocalIpAddress();
    console.log(`\n=================================================`);
    console.log(`🚀 Chatbot Server is running!`);
    console.log(`💻 Access it on this machine: http://localhost:${port}`);
    console.log(`📱 Access it on other devices on WiFi: http://${ipAddress}:${port}`);
    console.log(`💾 Storing conversation history on device at: ${historyFilePath}`);
    console.log(`=================================================\n`);
});
