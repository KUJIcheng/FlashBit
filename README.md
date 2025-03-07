# Chrome One Step - AI Assistant Extension

A Chrome extension that provides an AI-powered assistant accessible via a floating button. The assistant opens in a chat window and interacts dynamically with users.

## Features
- Floating AI assistant button that appears in the bottom-right corner.
- Automatically appears when copying text or hovering nearby.
- Click the button to open a popup chat with GPT-4.
- Chat window appears on the right side and supports interactive messaging.
- AI responses are displayed dynamically, letter-by-letter.

## Installation
1. **Clone the repository:**
   ```sh
   git clone https://github.com/KUJIcheng/chrome-one-step.git
   cd chrome-one-step
   ```

2. **Load the extension in Chrome:**
- Open `chrome://extensions/`
- Enable "Developer Mode" (top right)
- Click "Load unpacked"
- Select the cloned project folder

## Structure
```sh
/chrome-one-step
│── manifest.json       # Chrome extension configuration
│── background.js       # Handles popup window creation
│── content.js          # Manages the floating button
│── styles.css      # Chat window styling
│── popup/
│   ├── popup.html      # Chat window UI
│   ├── popup.js        # Handles chat interactions
│── assets/
│   ├── logo.png        # Assistant button icon
│   ├── icon.png        # Extension icon
```