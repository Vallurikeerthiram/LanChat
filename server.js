const express = require('express');
const cors = require('cors');
const path = require('path');
const os = require('os');
require('dotenv').config();

const app = express();
const port = 3000;

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

app.post('/api/chat', async (req, res) => {
    try {
        const { message, history } = req.body;
        
        // Convert history to OpenRouter (OpenAI) format
        const messages = history ? history.map(msg => ({
            role: msg.role === 'user' ? 'user' : 'assistant',
            content: msg.text
        })) : [];
        
        messages.push({ role: 'user', content: message });

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
                    model: "gemini-3.5-flash",
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
                return res.json({ reply: text });
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
    console.log(`=================================================\n`);
});
