# LanChat 📱💬

A lightweight, high-availability local network (LAN) AI chatbot server designed to run directly on an Android device via **Termux** (or any Node.js host). 

When you launch Termux on your phone, LanChat automatically boots up an Express server bound to your local Wi-Fi IP. Any device on your local Wi-Fi network (laptop, tablet, desktop, or other phones) can open that IP in a browser, chat with the AI, and receive real-time streamed responses powered by Google Gemini and fallback providers.

---

## 🌟 Key Features

- **📱 Termux Native / Android Server**: Run the entire chat gateway directly on your phone with `termux-wake-lock`.
- **🌐 Local Area Network (LAN) Access**: Binds to `0.0.0.0` and automatically detects and displays your Wi-Fi interface IP (e.g. `http://192.168.x.x:3000`).
- **⚡ Round-Robin Gemini Key Rotation**: Distributes requests across multiple Gemini API keys in a circular rotation to stay well within free-tier rate limits.
- **🛡️ 3-Tier Multi-Provider Fallback**:
  1. **Google Gemini** (Multiple API keys rotated sequentially)
  2. **Groq** (`llama-3.1-8b-instant` for ultra-low latency fallback)
  3. **OpenRouter** (`openai/gpt-oss-20b:free` tertiary fallback)
- **💬 Clean Web Interface**:
  - Real-time millisecond timestamps
  - Delivery ticks (✓ Sent, ✓✓ Processing, ✓✓ Completed)
  - Markdown code block & syntax formatting
  - Mobile & desktop responsive layout

---

## 📂 Project Structure

```
LanChat/
├── public/
│   ├── index.html       # Chat web UI structure
│   ├── script.js        # Client-side messaging & tick status logic
│   └── style.css        # Minimalist responsive dark/light styling
├── .env.example         # Template for environment variables and API keys
├── .gitignore           # Ignores .env and node_modules
├── package.json         # Node.js dependencies and run scripts
├── package-lock.json
├── server.js            # Express server, IP detection, round-robin fallback logic
└── README.md
```

---

## 🚀 Getting Started

### 1. Prerequisites
- Node.js (v18+)
- Termux (if running on Android) or any terminal / PC

### 2. Installation

Clone the repository and install dependencies:
```bash
git clone https://github.com/Vallurikeerthiram/LanChat.git
cd LanChat
npm install
```

### 3. Configure API Keys

Copy `.env.example` to `.env`:
```bash
cp .env.example .env
```
Fill in your API keys in `.env`:
```env
GEMINI_API_KEY_1=your_gemini_api_key_1
GEMINI_API_KEY_2=your_gemini_api_key_2
...
GROQ_API_KEY=your_groq_api_key
OPENROUTER_API_KEY=your_openrouter_api_key
```

### 4. Running the Server

Start the server:
```bash
npm start
```
You will see output similar to:
```
=================================================
🚀 Chatbot Server is running!
💻 Access it on this machine: http://localhost:3000
📱 Access it on other devices on WiFi: http://192.168.1.100:3000
=================================================
```

Open `http://<your-ip>:3000` in any browser on the same Wi-Fi network to start chatting!

---

## 📲 Running Automatically on Android via Termux

To make LanChat launch automatically whenever you open the Termux app:

1. Install Node.js and Termux API in Termux:
   ```bash
   pkg update && pkg install nodejs termux-api -y
   ```
2. Place the project in `/sdcard/LanChat` (or your Termux home directory).
3. Add the following to your `~/.bashrc`:
   ```bash
   termux-wake-lock
   cd /sdcard/LanChat
   node server.js
   ```
4. Now, simply tapping Termux will acquire a wake lock and start LanChat on your LAN!

---

## 📜 License

ISC License. Built by [Valluri Keerthi Ram](https://github.com/Vallurikeerthiram).
