# FlashBit – AI Assistant Extension

![FlashBit Horizontal Logo](static/component1.png)

A Chrome extension providing an AI-powered assistant in a floating, draggable window. Interact with GPT-4 (or other models) via a sleek chat interface, with optional image drag & drop, text selection features, and user-provided OpenAI API key.

## Features

- **Floating AI Assistant**:  
  - A half-hidden circular button in the bottom-right corner.  
  - Appears on page load or when copying text (configurable in `content.js`).  
  - Mouse-hover reveals the button; click to open the chat window.

- **Chat Window**:  
  - Displays on any webpage, pinned in the lower-right corner.  
  - Draggable title bar; “Thinking...” placeholders; typed-out AI responses.  
  - Supports user-provided **OpenAI Key** for GPT-4 (or other model).

- **Image Drag & Drop**:  
  - Optionally drag an image into the assistant. It will preview inside the chat.  
  - (If you want OCR or vision analysis, integrate a 3rd-party OCR API or wait for GPT-4 Vision access.)

- **Text Selection**:  
  - (Optional) Show a small “AI” icon near selected text to analyze/copy in chat (if you keep that feature from `content.js`).

- **User-Provided Key**:  
  - No API key is hardcoded. Users must input their own OpenAI Key once, stored locally (`chrome.storage.local`) for subsequent usage.
  - This ensures you can safely open-source without exposing private keys.

## Installation

1. **Clone or Download** the repository:
   ```bash
   git clone https://github.com/KUJIcheng/FlashBit.git
   cd FlashBit
   ```
2. **Load extension in Chrome:**
- Open `chrome://extensions/`
- Enable "Developer Mode" (top right)
- Click "Load unpacked"
- Select the cloned project folder

## Usage

1. **OpenAI API Key**:  
   - On first usage, the extension prompts for your OpenAI Key.  
   - You can later update it by having a “Set Key” button or re-trigger the prompt function.  
   - The key is stored locally in `chrome.storage.local`, not synced or uploaded.

2. **Floating Button**:  
   - When visiting any webpage, a half-hidden circular button is in the bottom-right.  
   - Hover to reveal; click to open the “FlashBit” chat window.

3. **Chat**:  
   - Type a query in the text area.  
   - Click "Send" → The extension calls the OpenAI ChatCompletion API with your input and conversation history.  
   - Responses appear typed out, character by character.

4. **Drag & Drop Images**:  
   - Drag an image over the extension’s floating area.  
   - The extension previews the image in the chat window.  
   - (For OCR or image content analysis, you must add a 3rd-party API or GPT-4 Vision, if available.)

5. **Text Selection Icon** (Optional):
   - If enabled, when you select text on a page, a small “AI” icon may appear.  
   - Clicking it automatically opens the chat with that text pre-filled.

6. **Clear History**:
   - Inside the chat window, there’s a “Clear History” button to remove all conversation from local storage.

## Project Structure
   ```bash
   flashbit-chrome-extension
   ├── manifest.json           # Chrome extension config
   ├── background.js           # (Optional) manages background tasks
   ├── content.js              # Main logic: floating button, chat UI, drag & drop
   ├── styles.css              # Additional styling for chat (if used)
   ├── static/
   │    ├── icon.png           # Extension icon
   │    ├── logo.png           # Button icon
   │    └── photo.png          # Additional image for drag overlay
   └── ...
   ```
