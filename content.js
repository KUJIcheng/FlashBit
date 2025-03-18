// =======================  全局状态 & 初始化  =======================
let messageHistory = []; // 存储聊天消息历史
let selectionIcon = null; // 选中文本后显示的图标
let lastSelectedText = ""; // 最后选择的文本

let controller = null; // 控制请求
let stopGenerating = false; // 停止逐字动画
let stopButton = null; // 停止按钮

console.log("[content.js] Script loaded.");

// 延迟一点点执行，确保页面基本加载完再注入
setTimeout(() => {
    console.log("[setTimeout] Creating AI helper button...");
    showAIHelper("", false);   // 创建右下角悬浮小球
    loadChatHistory();         // 加载保存的对话历史
    injectChatStyles();        // 注入聊天窗口CSS
    setupTextSelectionListener();  // 注册文本选择监听
    initializeSearchFeature(); //历史记录搜索框
}, 100);

// =======================  拖拽图片监听功能 =======================
// 用于标记：是否已经在拖拽流程中（避免重复触发）
let isCurrentlyDragging = false;

// 用于标记：这一轮拖拽是否成功把图片 drop 到聊天容器里
let didDropInContainer = false;

// 全局 dragover / drop 阻止默认行为
document.addEventListener("dragover", (e) => {
    e.preventDefault();
    e.stopPropagation();
});
document.addEventListener("drop", (e) => {
    e.preventDefault();
    e.stopPropagation();
});

document.addEventListener("dragenter", (e) => {
    e.preventDefault();
    e.stopPropagation();
    console.log("Global dragenter fired!");

    if (isCurrentlyDragging) {
        // 已经在拖拽流程中了，不重复弹窗
        return;
    }

    // 检查是否含 image/* or text/uri-list
    if (!e.dataTransfer || !e.dataTransfer.items) return;
    let foundPotentialImage = false;
    for (const item of e.dataTransfer.items) {
        console.log("Item type:", item.type);
        if (item.type && (
            item.type.startsWith("image/") ||
            item.type === "text/uri-list" || 
            item.type === "text/html"
        )) {
            foundPotentialImage = true;
            break;
        }
    }

    if (foundPotentialImage) {
        isCurrentlyDragging = true;  // 标记进入拖拽流程
        didDropInContainer = false;  // 还没放进聊天窗口
        // 若聊天窗口没打开，则自动打开
        if (!isChatOpen) {
            toggleChatWindow(); 
        }
        // 显示 overlay（若窗口已存在）
        let container = document.getElementById("ai-chat-container");
        let overlay = document.getElementById("ai-drop-overlay");
        if (container && overlay) {
            overlay.style.display = "flex";
        }
    }
});

document.addEventListener("dragend", (e) => {
    e.preventDefault();
    e.stopPropagation();
    console.log("Global dragend fired!");
    
    // 结束拖拽流程
    if (isCurrentlyDragging) {
        isCurrentlyDragging = false;
        // 若用户未将文件放到聊天容器
        if (!didDropInContainer) {
            // 关闭窗口（若是自动打开的，不想保留）
            if (isChatOpen) {
                toggleChatWindow(); 
            }
        }
    }
});

// =======================  搜索框功能 =======================
function initializeSearchFeature() {
    console.log("Initializing search feature...");

    let searchInput = document.getElementById("search-history");
    let chatHistory = document.getElementById("ai-chat-history");

    if (!searchInput || !chatHistory) {
        console.warn("⚠️ Search input or chat history not found. Retrying...");
        setTimeout(initializeSearchFeature, 500);
        return;
    }

    // 监听搜索框输入
    searchInput.addEventListener("input", () => {
        const query = searchInput.value.trim().toLowerCase();
        filterChatHistory(query);
    });

    console.log("Search feature initialized!");
}

// 过滤聊天记录
function filterChatHistory(query) {
    let chatHistory = document.getElementById("ai-chat-history");
    if (!chatHistory) return;

    chatHistory.innerHTML = "";

    if (!query) {
        messageHistory.forEach(msg => appendMessage(msg.role, msg.content));
        return;
    }

    const filteredMessages = messageHistory.filter(msg =>
        msg.content.toLowerCase().includes(query)
    );

    filteredMessages.forEach(msg => appendMessage(msg.role, msg.content, query));
}

// 高亮搜索匹配的内容
function highlightText(text, query) {
    if (!query) return text;
    const regex = new RegExp(`(${query})`, "gi");
    return text.replace(regex, "<mark>$1</mark>");
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === "searchHistory") {
        filterChatHistory(message.query);
    }
});

/*** 监听搜索框变化并传递到popup***/
document.addEventListener("input", (event) => {
    if (event.target.id === "search-history") {
        chrome.runtime.sendMessage({
            action: "searchHistory",
            query: event.target.value.trim().toLowerCase()
        });
    }
});

console.log("Search functionality in content.js is now active.");

// 监听用户复制事件 -> 显示悬浮小球
document.addEventListener("copy", async () => {
    try {
        let copiedText = await navigator.clipboard.readText();
        console.log("[copy] Copied text detected:", copiedText);
        showAIHelper(copiedText, true);
    } catch (error) {
        console.error("Failed to read clipboard:", error);
    }
});

// =======================  文本选择后小图标  =======================
function setupTextSelectionListener() {
    document.addEventListener('mouseup', function(e) {
        if (e.target.closest('#ai-selection-toolbar')) return;

        setTimeout(function () {
            const selectedText = window.getSelection().toString().trim();
            if (selectedText) {
                showSelectionIcon();
            } else {
                hideSelectionIcon();
            }
        }, 10);
    });

    document.addEventListener('mousedown', function(e) {
        if (selectionIcon && !e.target.closest('#ai-selection-toolbar')) {
            hideSelectionIcon();
        }
    });
}



function showSelectionIcon() {
    hideSelectionIcon(); 

    const selection = window.getSelection();
    if (!selection.rangeCount) return;
    const range = selection.getRangeAt(0);
    const rect = range.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return;

    lastSelectedText = selection.toString().trim();
    if (!lastSelectedText) return;

    const baseLeft = rect.left + rect.width / 2;

    // === Create toolbar container ===
    const toolbar = document.createElement('div');
    toolbar.id = 'ai-selection-toolbar';
    toolbar.style.cssText = `
        position: fixed;
        top: ${rect.top - 50}px;
        left: ${baseLeft}px;
        transform: translateX(-50%);
        background-color: #ffffffdd;
        border-radius: 12px;
        padding: 6px 10px;
        display: flex;
        gap: 8px;
        z-index: 999999;
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
        align-items: center;
        backdrop-filter: blur(6px);
        border: 1px solid #cdece6;
    `;

    const buttons = [
        {
            id: 'ai-selection-icon-drop',
            label: 'Drop',
            title: 'Insert selected text into chat',
            textToInsert: lastSelectedText,
            autoSend: false
        },
        {
            id: 'ai-selection-icon-translate',
            label: 'Translate',
            title: 'Translate selected text to English',
            textToInsert: `Help me translate the following text to English: "${lastSelectedText}"`,
            autoSend: false
        },
        {
            id: 'ai-selection-icon-analyze',
            label: 'Explain',
            title: 'Analyze or explain this text',
            textToInsert: `Can you help explain or analyze the following text: "${lastSelectedText}"`,
            autoSend: true // 🔥 Send automatically
        }
    ];

    selectionIcon = toolbar;

    buttons.forEach((btn) => {
        const button = document.createElement('div');
        button.id = btn.id;
        button.textContent = btn.label;
        button.title = btn.title;

        button.style.cssText = `
            padding: 6px 12px;
            background-color: #20c997;
            color: white;
            border-radius: 8px;
            font-size: 12px;
            font-weight: bold;
            cursor: pointer;
            user-select: none;
            transition: transform 0.2s ease, background-color 0.2s ease;
            white-space: nowrap;
        `;

        button.onclick = () => {
            openChatWithText(btn.textToInsert);
            hideSelectionIcon();

            if (btn.autoSend) {
                setTimeout(() => {
                    const sendBtn = document.getElementById("ai-chat-send");
                    if (sendBtn) sendBtn.click();
                }, 200);
            }
        };

        button.onmouseenter = () => {
            button.style.transform = 'scale(1.05)';
            button.style.backgroundColor = '#17a2b8';
        };
        button.onmouseleave = () => {
            button.style.transform = 'scale(1)';
            button.style.backgroundColor = '#20c997';
        };

        toolbar.appendChild(button);
    });

    document.body.appendChild(toolbar);
}


function hideSelectionIcon() {
    if (selectionIcon && selectionIcon.parentNode) {
        selectionIcon.parentNode.removeChild(selectionIcon);
    }
    selectionIcon = null;
}


function openChatWithText(text) {
    const container = document.getElementById("ai-chat-container") || createChatContainer();
    isChatOpen = true;
    container.classList.add("open");

    const helper = document.getElementById("ai-helper");
    if (helper) helper.style.bottom = "5px";

    const input = document.getElementById("ai-chat-input");
    if (input) {
        input.value = text;
        input.style.height = "auto";
        input.style.height = Math.min(input.scrollHeight, 100) + "px";
        setTimeout(() => input.focus(), 100);
    }

    loadHistoryToUI();
}


// ======================= 注入聊天窗口样式 =======================
function injectChatStyles() {
    if (document.getElementById('ai-chat-styles')) return;
    
    const styleElement = document.createElement('style');
    styleElement.id = 'ai-chat-styles';
    styleElement.textContent = `
    /* Container for timestamp and stop button */
    .ai-message-info {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-top: 4px;
        font-size: 10px;
        color: #888;
    }
    .stop-button {
        background: transparent;
        border: none;
        cursor: pointer;
        font-size: 14px;
        color: #dc3545;
        padding: 0;
        margin-left: 10px;
        display: flex;
        align-items: center;
        transition: color 0.2s ease;
    }
    .stop-button:hover {
        color: #c82333;
    }
    
    /* 主容器 */
    #ai-chat-container {
        position: fixed;
        right: 30px;
        bottom: 80px;
        width: 350px;
        height: 500px;
        background: white;
        border-radius: 10px;
        box-shadow: 0 0 20px rgba(0, 0, 0, 0.2);
        display: flex;
        flex-direction: column;
        z-index: 999998;
        overflow: hidden;
        transition: transform 0.3s ease, opacity 0.3s ease;
        transform: translateY(20px);
        opacity: 0;
        pointer-events: none;
    }
    #ai-chat-container.open {
        transform: translateY(0);
        opacity: 1;
        pointer-events: all;
    }

    /* 顶部区域（包括标题、按钮），整个区域可拖动 */
    #ai-chat-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 10px 15px;
        background: #f1f1f1;
        border-bottom: 1px solid #ddd;
        cursor: move;
        user-select: none;
    }
    #ai-chat-header:hover {
        background: #e9e9e9;
    }

    /* 标题文字 */
    #ai-chat-title {
        font-weight: bold;
        font-size: 16px;
    }

    /* 清除历史 & 关闭按钮 */
    #ai-chat-clear,
    #ai-chat-close {
        cursor: pointer;
        background: none;
        border: none;
        font-size: 14px;
        color: #555;
        margin-left: 10px;
    }
    #ai-chat-clear {
        padding: 3px 8px;
        background: #dc3545;
        color: white;
        border-radius: 3px;
        font-size: 12px;
    }

    /* 历史记录区域 */
    #ai-chat-history {
        flex-grow: 1;
        padding: 10px;
        overflow-y: auto;
        background: #f9f9f9;
    }

    /* 输入区域 */
    #ai-chat-input-container {
        display: flex;
        padding: 10px;
        background: #f1f1f1;
        border-top: 1px solid #ddd;
    }
    #ai-chat-input {
        flex-grow: 1;
        border: 1px solid #ddd;
        border-radius: 5px;
        padding: 8px;
        font-size: 14px;
        resize: none;
        max-height: 100px;
        min-height: 38px;
    }
    #ai-chat-send {
        margin-left: 10px;
        padding: 8px 15px;
        background: #20c997;
        color: white;
        border: none;
        border-radius: 5px;
        cursor: pointer;
    }
    #ai-chat-send:hover {
        background: #17a2b8;
    }

    /* 用户消息气泡 */
    .ai-user-message {
        background-color: #20c997;
        color: white;
        padding: 8px 12px;
        border-radius: 15px;
        margin: 5px 0;
        max-width: 80%;
        display: inline-block;
        text-align: left;
        white-space: pre-wrap;
        word-wrap: break-word;
        word-break: break-word;
    }
    /* AI回复气泡 */
    .ai-assistant-message {
        background-color: #e9e9e9;
        color: black;
        padding: 8px 12px;
        border-radius: 15px;
        margin: 5px 0;
        max-width: 80%;
        display: inline-block;
        text-align: left;
        white-space: pre-wrap;
        word-wrap: break-word;
        word-break: break-word;
    }

    /* 容器内的每条消息整体排布 */
    .ai-message-container {
        display: flex;
        flex-direction: column;
        margin-bottom: 10px;
        width: 100%;
    }
    .ai-message-container.user {
        align-items: flex-end;
    }
    .ai-message-container.assistant {
        align-items: flex-start;
    }
    .ai-message-time {
        font-size: 10px;
        color: #888;
        margin-top: 2px;
        display: block;
    }

    #ai-chat-history::-webkit-scrollbar {
        width: 8px;
        height: 8px;
    }

    #ai-chat-history::-webkit-scrollbar-track {
        background: #e0f1ee;
        border-radius: 8px;
    }

    #ai-chat-history::-webkit-scrollbar-thumb {
        background-color: #20c997;
        border-radius: 8px;
        border: 2px solid #e0f1ee;
    }

    #ai-chat-history::-webkit-scrollbar-thumb:hover {
        background-color: #17a2b8; 
    }

    #ai-chat-input::-webkit-scrollbar {
        width: 6px;
    }
    #ai-chat-input::-webkit-scrollbar-track {
        background: #e0f1ee;
        border-radius: 6px;
    }
    #ai-chat-input::-webkit-scrollbar-thumb {
        background-color: #20c997;
        border-radius: 6px;
    }
    #ai-chat-input::-webkit-scrollbar-thumb:hover {
        background-color: #17a2b8;
    }
    `;
    document.head.appendChild(styleElement);
}

// ======================= 聊天窗口功能 =======================
function createChatContainer() {
    // 若已存在，则直接返回
    let existing = document.getElementById("ai-chat-container");
    if (existing) return existing;

    // 主容器
    const chatContainer = document.createElement("div");
    chatContainer.id = "ai-chat-container";

    /* ========== 顶部 (标题 & 按钮) ========== */
    const chatHeader = document.createElement("div");
    chatHeader.id = "ai-chat-header";
    
    const chatTitle = document.createElement("div");
    chatTitle.id = "ai-chat-title";
    chatTitle.textContent = "FlashBit";

    const headerButtons = document.createElement("div");
    // Clear History
    const clearButton = document.createElement("button");
    clearButton.id = "ai-chat-clear";
    clearButton.textContent = "Clear History";
    clearButton.onclick = (e) => {
        e.stopPropagation();
        if (confirm("Are you sure you want to clear all chat history?")) {
            messageHistory = [];
            saveChatHistory();
            const histEl = document.getElementById("ai-chat-history");
            if (histEl) histEl.innerHTML = "";
        }
    };
    // Close
    const closeButton = document.createElement("button");
    closeButton.id = "ai-chat-close";
    closeButton.textContent = "✕";
    closeButton.onclick = (e) => {
        e.stopPropagation();
        toggleChatWindow();
    };
    headerButtons.appendChild(clearButton);
    headerButtons.appendChild(closeButton);

    chatHeader.appendChild(chatTitle);
    chatHeader.appendChild(headerButtons);

    /* ========== 搜索框区域 ========== */
    const searchContainer = document.createElement("div");
    searchContainer.id = "search-container";
    Object.assign(searchContainer.style, {
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        padding: "8px",
        borderBottom: "1px solid #ddd",
        backgroundColor: "#f1f1f1"
    });
    const searchInput = document.createElement("input");
    searchInput.id = "search-history";
    searchInput.type = "text";
    searchInput.placeholder = "Search history...";
    Object.assign(searchInput.style, {
        width: "90%",
        padding: "8px",
        border: "1px solid #ddd",
        borderRadius: "5px",
        fontSize: "14px"
    });
    searchContainer.appendChild(searchInput);

    /* ========== 聊天历史区域 ========== */
    const chatHistory = document.createElement("div");
    chatHistory.id = "ai-chat-history";

    /* ========== 拖拽覆盖层 (毛玻璃) ========== */
    const dropOverlay = document.createElement("div");
    dropOverlay.id = "ai-drop-overlay";
    Object.assign(dropOverlay.style, {
        position: "absolute",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: "rgba(255,255,255,0.6)",
        backdropFilter: "blur(8px)",
        display: "none",
        zIndex: "999999",
        justifyContent: "center",
        alignItems: "center",
        flexDirection: "column"
    });
    // 覆盖层图标
    const dropIcon = document.createElement("img");
    dropIcon.src = chrome.runtime.getURL("static/photo.png"); // 检查
    Object.assign(dropIcon.style, {
        width: "80px",
        height: "80px",
        opacity: "0.8"
    });
    dropOverlay.appendChild(dropIcon);
    // 覆盖层文字
    const dropText = document.createElement("div");
    dropText.textContent = "Drop image here to upload";
    Object.assign(dropText.style, {
        fontSize: "16px",
        color: "#333",
        marginTop: "10px"
    });
    dropOverlay.appendChild(dropText);

    // ======= 图片预览容器（在输入框上方）======
    const imagePreview = document.createElement("div");
    imagePreview.id = "image-preview";
    Object.assign(imagePreview.style, {
        display: "none",
        position: "relative", // 用于放"X"按钮
        width: "120px",
        height: "120px",
        margin: "10px auto",    // 让它在聊天窗口里居中或自行调整
        border: "1px solid #ccc",
        borderRadius: "8px",
        overflow: "hidden",
        backgroundColor: "#f9f9f9"
    });

    // 图片本体
    const previewImg = document.createElement("img");
    previewImg.id = "preview-img";
    Object.assign(previewImg.style, {
        width: "100%",
        height: "100%",
        objectFit: "cover"
    });
    imagePreview.appendChild(previewImg);

    // “X”按钮(右上角)
    const closePreviewBtn = document.createElement("button");
    closePreviewBtn.innerText = "✕";
    Object.assign(closePreviewBtn.style, {
        position: "absolute",
        top: "4px",
        right: "4px",
        background: "#fff",
        border: "none",
        borderRadius: "4px",
        cursor: "pointer",
        fontSize: "14px",
        lineHeight: "14px",
        width: "24px",
        height: "24px",
        display: "flex",
        alignItems: "center",
        justifyContent: "center"
    });
    closePreviewBtn.title = "Remove image";
    closePreviewBtn.onclick = () => {
        hideImagePreview();
        window.pendingImage = null;
    };
    imagePreview.appendChild(closePreviewBtn);

    /* ========== 输入区域 ========== */
    const inputContainer = document.createElement("div");
    inputContainer.id = "ai-chat-input-container";

    const chatInput = document.createElement("textarea");
    chatInput.id = "ai-chat-input";
    chatInput.placeholder = "Type your message...";
    chatInput.rows = 1;

    // 自动调整高度
    chatInput.oninput = () => {
        chatInput.style.height = "auto";
        chatInput.style.height = Math.min(chatInput.scrollHeight, 100) + "px";
    };
    // 回车发送
    chatInput.onkeydown = (e) => {
        if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            document.getElementById("ai-chat-send").click();
        }
    };
    // 粘贴事件: 若是图片, 显示预览
    chatInput.addEventListener("paste", async (e) => {
        const items = e.clipboardData?.items;
        if (!items) return;
        for (const item of items) {
            if (item.type.startsWith("image/")) {
                e.preventDefault();
                const file = item.getAsFile();
                if (file) {
                    const imgDataUrl = await readFileAsDataURL(file);
                    onUserImageDropped(imgDataUrl, file.name || "pasted_image.png");
                }
            }
        }
    });

    // Send 按钮
    const sendButton = document.createElement("button");
    sendButton.id = "ai-chat-send";
    sendButton.textContent = "Send";

    sendButton.onclick = async () => {
    let userKey = await getUserOpenAIKey();
    if (!userKey) {
        userKey = await promptUserForAPIKey();
        if (!userKey) return;
    }

    const chatInput = document.getElementById("ai-chat-input");
    const userText = chatInput.value.trim();
    const messages = [];
    
    // If an image is pending
    if (window.pendingImage && window.pendingImage.dataUrl) {
        const contentArray = [];
        
        // Append user text to UI separately (so it's visible in chat history)
        if (userText) {
            appendMessage("user", userText); // ✅ Show text in chat
            contentArray.push({ type: "text", text: userText });

            // Store user text message in history
            messageHistory.push({ role: "user", content: userText });
        }
        
        // Append image preview
        appendMessage("user", window.pendingImage.dataUrl); // ✅ Show image in chat
        contentArray.push({ type: "image_url", image_url: { url: window.pendingImage.dataUrl } });

        // Push message with image to OpenAI API
        messages.push({
            role: "user",
            content: contentArray
        });

        // Save in history (separate image entry)
        messageHistory.push({
            role: "user",
            content: `[Image Uploaded]`,
            type: "image"
        });

        hideImagePreview();
        window.pendingImage = null;
    } else {
        if (!userText) return;
        appendMessage("user", userText); // ✅ Show text in chat
        messages.push({ role: "user", content: userText });

        // Store user text message in history
        messageHistory.push({ role: "user", content: userText });
    }

    saveChatHistory();
    chatInput.value = "";
    chatInput.style.height = "auto";

    const responseDiv = appendMessage("assistant", "Thinking...");

    try {
        const response = await fetch("https://api.openai.com/v1/chat/completions", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${userKey}`
            },
            body: JSON.stringify({
                model: "gpt-4o",
                messages: messages,
                max_tokens: 2000
            })
        });

        const result = await response.json();
        if (result.error) {
            responseDiv.textContent = `Error: ${result.error.message}`;
            return;
        }

        const aiText = result.choices[0].message.content;
        messageHistory.push({ role: "assistant", content: aiText });
        saveChatHistory();
        responseDiv.textContent = "";
        animateText(responseDiv, aiText);

    } catch (err) {
        console.error("API error:", err);
        responseDiv.textContent = "Request failed. Check network or API key.";
        removeStopButton(responseDiv);
    }
};

    // 组装输入区域
    inputContainer.appendChild(chatInput);
    inputContainer.appendChild(sendButton);

    // 组装聊天窗口
    chatContainer.appendChild(chatHeader);
    chatContainer.appendChild(searchContainer);
    chatContainer.appendChild(chatHistory);
    chatContainer.appendChild(imagePreview);
    chatContainer.appendChild(inputContainer);
    chatContainer.appendChild(dropOverlay);

    document.body.appendChild(chatContainer);

    // 标题栏可拖拽
    makeDraggable(chatContainer, chatHeader);

    // 绑定拖拽事件: 只有进入这个容器才触发
    setupDragAndDrop(chatContainer, dropOverlay);

    return chatContainer;
}

function makeDraggable(element, handle) {
    let pos1 = 0, pos2 = 0, pos3 = 0, pos4 = 0;
    
    handle.onmousedown = dragMouseDown;
    
    function dragMouseDown(e) {
        e.preventDefault();
        pos3 = e.clientX;
        pos4 = e.clientY;
        document.onmouseup = closeDragElement;
        document.onmousemove = elementDrag;
    }
    
    function elementDrag(e) {
        e.preventDefault();
        pos1 = pos3 - e.clientX;
        pos2 = pos4 - e.clientY;
        pos3 = e.clientX;
        pos4 = e.clientY;
        
        element.style.top  = (element.offsetTop  - pos2) + "px";
        element.style.left = (element.offsetLeft - pos1) + "px";
        element.style.right = "auto";
    }
    
    function closeDragElement() {
        document.onmouseup = null;
        document.onmousemove = null;
    }
}

/***********************************************
 * setupDragAndDrop: 当鼠标真正拖入聊天容器并 drop
 ***********************************************/
function setupDragAndDrop(container, overlay) {
    container.addEventListener("dragenter", (e) => {
        e.preventDefault();
        e.stopPropagation();
        // 显示覆盖层
        overlay.style.display = "flex";
    });

    container.addEventListener("dragover", (e) => {
        e.preventDefault();
        e.stopPropagation();
    });

    container.addEventListener("dragleave", (e) => {
        // 如果真正离开整个容器，则隐藏 overlay
        if (!container.contains(e.relatedTarget)) {
            overlay.style.display = "none";
        }
    });

    container.addEventListener("drop", async (e) => {
        e.preventDefault();
        e.stopPropagation();
        overlay.style.display = "none";

        // 标记：用户已在容器内drop
        didDropInContainer = true;

        if (e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files.length > 0) {
            const file = e.dataTransfer.files[0];
            if (file.type.startsWith("image/")) {
                const imgDataUrl = await readFileAsDataURL(file);
                onUserImageDropped(imgDataUrl, file.name || "dragged_image.png");
            }
        }
    });
}

/***********************************************
 * readFileAsDataURL(file): 读文件 -> Base64 dataURL
 ***********************************************/
function readFileAsDataURL(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = (err) => reject(err);
        reader.readAsDataURL(file);
    });
}

/***********************************************
 * onUserImageDropped(dataUrl, filename):
 *   用户拖拽/粘贴图片后, 先显示在预览区
 ***********************************************/
function onUserImageDropped(dataUrl, filename) {
    // 显示预览
    showImagePreview(dataUrl);
    // 存到一个全局 pending
    window.pendingImage = { dataUrl, filename };
}

/***********************************************
 * showImagePreview / hideImagePreview
 ***********************************************/
function showImagePreview(dataUrl) {
    const previewEl = document.getElementById("image-preview");
    const imgEl = document.getElementById("preview-img");
    if (previewEl && imgEl) {
        imgEl.src = dataUrl;
        previewEl.style.display = "block";
    }
}

function hideImagePreview() {
    const previewEl = document.getElementById("image-preview");
    const imgEl = document.getElementById("preview-img");
    if (previewEl && imgEl) {
        imgEl.src = "";
        previewEl.style.display = "none";
    }
}

function appendMessage(role, text, highlight = "") {
    const chatHistory = document.getElementById("ai-chat-history");
    if (!chatHistory) {
        console.error("No #ai-chat-history found!");
        return document.createElement("div");
    }

    // 外层容器
    const messageContainer = document.createElement("div");
    messageContainer.classList.add("ai-message-container", role === "user" ? "user" : "assistant");

    // 消息内容的气泡
    const messageDiv = document.createElement("div");
    messageDiv.classList.add(role === "user" ? "ai-user-message" : "ai-assistant-message");
    messageDiv.style.whiteSpace = "pre-wrap";

    // 若是 data:image/... 显示图片，否则文字
    if (/^data:image\//.test(text)) {
        const imgEl = document.createElement("img");
        imgEl.src = text;
        imgEl.style.maxWidth = "200px";
        imgEl.style.borderRadius = "8px";
        messageDiv.appendChild(imgEl);
    } else {
        if (highlight) {
            messageDiv.innerHTML = highlightText(text, highlight);
        } else {
            messageDiv.textContent = text;
        }
    }

    // 底部信息（时间戳 / 停止按钮）
    const infoContainer = document.createElement("div");
    infoContainer.classList.add("ai-message-info");

    // 时间戳
    const timeSpan = document.createElement("span");
    timeSpan.classList.add("ai-message-time");
    const now = new Date();
    timeSpan.textContent = now.getHours().toString().padStart(2, '0') + ":" 
                         + now.getMinutes().toString().padStart(2, '0');
    infoContainer.appendChild(timeSpan);

    // 若是机器人且文本是 "Thinking..." -> 添加【停止生成】按钮
    if (role === "assistant" && text === "Thinking...") {
        let stopBtn = document.createElement("button");
        stopBtn.innerHTML = "⏹";
        stopBtn.classList.add("stop-button");
        stopBtn.onclick = () => {
            stopGenerating = true;
            if (controller) {
                controller.abort();
            }
            messageDiv.textContent = "Stop generating";
            stopBtn.remove();
        };
        infoContainer.appendChild(stopBtn);
    }

    // 组装
    messageContainer.appendChild(messageDiv);
    messageContainer.appendChild(infoContainer);
    chatHistory.appendChild(messageContainer);
    chatHistory.scrollTop = chatHistory.scrollHeight;

    return messageDiv;
}

// 打字动画：逐字输出文本
function animateText(element, text) {
    let index = 0;
    element.textContent = "";
    element.style.whiteSpace = "pre-wrap";

    function typeCharacter() {
        // 如果用户点击了“停止生成”，或者我们到达文本末尾 -> 停止
        if (stopGenerating) {
            stopGenerating = false;
            removeStopButton(element);
            return;
        }
        if (index >= text.length) {
            // 已完全输出 -> 移除暂停按钮
            removeStopButton(element);
            return;
        }

        // 逐字输出
        element.textContent += text[index];
        index++;

        // 滚动到底部
        const chatHistory = document.getElementById("ai-chat-history");
        if (chatHistory) {
            chatHistory.scrollTop = chatHistory.scrollHeight;
        }

        setTimeout(typeCharacter, 30);
    }

    typeCharacter();
}

/**
 * 在输出完成或用户停止生成后，移除 “暂停” 按钮
 * element: 即 messageDiv (文字容器)
 */
function removeStopButton(element) {
    // 找到消息容器
    const messageContainer = element.closest(".ai-message-container");
    if (!messageContainer) return;

    // 在 .ai-message-info 里找可能存在的 .stop-button
    const infoEl = messageContainer.querySelector(".ai-message-info");
    if (!infoEl) return;

    const stopBtn = infoEl.querySelector(".stop-button");
    if (stopBtn) {
        stopBtn.remove();
    }
}


// 控制小窗口开关
function toggleChatWindow(initialText = "") {
    console.log("Toggle chat window, initialText:", initialText);
    
    const chatContainer = document.getElementById("ai-chat-container");
    if (!chatContainer) {
        console.error("No chat container found, creating new one...");
        createChatContainer();
        isChatOpen = false;
    }
    
    isChatOpen = !isChatOpen;
    console.log("Chat window state:", isChatOpen ? "Open" : "Close");
    
    const container = document.getElementById("ai-chat-container");
    // ★ 取到 overlay
    const overlay = document.getElementById("ai-drop-overlay");

    if (isChatOpen) {
        container.classList.add("open");

        // 若之前显示毛玻璃，则此时可先隐藏
        if (overlay) overlay.style.display = "none";

        const helper = document.getElementById("ai-helper");
        if (helper) {
            helper.style.bottom = "5px";
        }
        
        if (initialText) {
            const chatInput = document.getElementById("ai-chat-input");
            if (chatInput) {
                chatInput.value = initialText;
                chatInput.style.height = "auto";
                chatInput.style.height = Math.min(chatInput.scrollHeight, 100) + "px";
                setTimeout(() => chatInput.focus(), 100);
            }
        }
        
        loadHistoryToUI();

    } else {
        container.classList.remove("open");

        // 关闭窗口时，也隐藏毛玻璃
        if (overlay) overlay.style.display = "none";

        if (!isHovering) {
            resetHideTimer();
        }
    }
}

// 存/取历史
function saveChatHistory() {
    chrome.storage.local.set({ "chatHistory": messageHistory });
}
function loadChatHistory() {
    chrome.storage.local.get(["chatHistory"], (result) => {
        if (result.chatHistory && result.chatHistory.length > 0) {
            messageHistory = result.chatHistory;
        }
    });
}
function loadHistoryToUI() {
    const chatHistory = document.getElementById("ai-chat-history");
    if (!chatHistory) {
        console.error("No #ai-chat-history found!");
        return;
    }
    chatHistory.innerHTML = "";
    messageHistory.forEach(msg => {
        if (msg.role === "user" || msg.role === "assistant") {
            appendMessage(msg.role, msg.content);
        }
    });
    chatHistory.scrollTop = chatHistory.scrollHeight;
    console.log("Loaded history into UI.");
}

// 密钥设置function----------------------------------------------------------------------------------

function promptUserForAPIKey() {
    return new Promise((resolve) => {
        const userKey = window.prompt("Please enter your OpenAI API Key:");
        if (userKey) {
            // 保存到chrome.storage.local
            chrome.storage.local.set({ "userOpenAIKey": userKey }, () => {
                console.log("User's OpenAI Key saved.");
                resolve(userKey);
            });
        } else {
            resolve(null);
        }
    });
}

async function getUserOpenAIKey() {
    return new Promise((resolve) => {
        chrome.storage.local.get(["userOpenAIKey"], (result) => {
            if (result.userOpenAIKey) {
                resolve(result.userOpenAIKey);
            } else {
                resolve(null);
            }
        });
    });
}

function removeUserOpenAIKey() {
    return new Promise((resolve) => {
        chrome.storage.local.remove(["userOpenAIKey"], () => {
            console.log("User's OpenAI Key removed from storage.");
            resolve();
        });
    });
}

// 悬浮小球功能开始-----------------------------------------------------------------------------------

let hideTimeout;  // 2s 自动隐藏的定时器
const FLOAT_DISTANCE = 100; // 鼠标靠近范围
let isFloating = false; // 是否当前已浮现
let isHovering = false; // 鼠标是否在 AI 按钮上
let isChatOpen = false; // 聊天窗口是否打开
// ---------------------- showAIHelper：入口 ----------------------
function showAIHelper(text, forceShow = false) {
    let helper = document.getElementById("ai-helper");
    if (!helper) {
        helper = document.createElement("div");
        helper.id = "ai-helper";

        // Logo 图片
        let logo = document.createElement("img");
        logo.src = chrome.runtime.getURL("static/logo.png");
        logo.style.width = "65px";
        logo.style.height = "65px";
        logo.style.transition = "transform 0.3s ease"; 
        helper.appendChild(logo);

        // 小球基本样式
        helper.style.position = "fixed";  
        helper.style.width  = "75px";  
        helper.style.height = "75px";
        helper.style.zIndex = "999999";  
        helper.style.borderRadius = "50%";
        helper.style.overflow = "hidden";
        helper.style.display = "flex";  
        helper.style.alignItems = "center";
        helper.style.justifyContent = "center";
        helper.style.cursor = "pointer";
        helper.style.background = "transparent";
        helper.style.transition = "all 0.3s ease-out";

        // 默认贴在屏幕底边、右侧30px，半隐藏
        helper.style.right = "30px";
        helper.style.bottom = "-35px";
        helper.dataset.edge = "bottom";

        document.body.appendChild(helper);

        // 添加拖拽功能 + 区分点击
        makeLogoDraggable(helper);

        // 鼠标进入
        helper.addEventListener("mouseenter", () => {
            isHovering = true;
            clearTimeout(hideTimeout);
            logo.style.transform = "scale(1.2)";
        });

        // 鼠标离开
        helper.addEventListener("mouseleave", () => {
            isHovering = false;
            if (!isChatOpen) {
                resetHideTimer(helper);
            }
            logo.style.transform = "scale(1.0)";
        });

        // 若鼠标在小球附近则弹出，否则收回
        document.addEventListener("mousemove", (event) => {
            handleMouseMove(event, helper);
        });

        // 创建聊天容器
        createChatContainer();
    }

    if (!forceShow && !isChatOpen) {
        hideWithAnimation(helper);
        isFloating = false;
    }

    if (forceShow) {
        showWithAnimation(helper);
        resetHideTimer(helper);
    }

    if (text && isChatOpen) {
        const chatInput = document.getElementById("ai-chat-input");
        if (chatInput) {
            chatInput.value = text;
            chatInput.style.height = "auto";
            chatInput.style.height = Math.min(chatInput.scrollHeight, 100) + "px";
        }
    }
}

// ---------------------- 拖拽 + 点击区分 ----------------------
function makeLogoDraggable(helper) {
    let isDragging = false;
    let startX = 0, startY = 0;
    let initialLeft = 0, initialTop = 0;
    let dragThreshold = 5;
    let hasMoved = false;

    helper.addEventListener("mousedown", (e) => {
        if (e.button !== 0) return;
        e.preventDefault();

        isDragging = true;
        hasMoved   = false;
        startX = e.clientX;
        startY = e.clientY;
        initialLeft = helper.offsetLeft;
        initialTop  = helper.offsetTop;

        helper.style.transition = "none";

        document.addEventListener("mousemove", onMouseMove);
        document.addEventListener("mouseup", onMouseUp);
    });

    function onMouseMove(e) {
        if (!isDragging) return;

        let deltaX = e.clientX - startX;
        let deltaY = e.clientY - startY;
        if (Math.abs(deltaX) > dragThreshold || Math.abs(deltaY) > dragThreshold) {
            hasMoved = true;
        }

        let newLeft = initialLeft + deltaX;
        let newTop  = initialTop  + deltaY;
        helper.style.left = newLeft + "px";
        helper.style.top  = newTop + "px";
        helper.style.bottom = "auto";
        helper.style.right  = "auto";
    }

    function onMouseUp(e) {
        if (!isDragging) return;
        isDragging = false;

        document.removeEventListener("mousemove", onMouseMove);
        document.removeEventListener("mouseup", onMouseUp);

        helper.style.transition = "all 0.3s ease-out";

        if (!hasMoved) {
            e.stopPropagation();
            toggleChatWindow("");
            return;
        }

        snapToEdge(helper);
    }
}

// --------------------- 自动吸附 + 判断鼠标距离 ---------------------
function snapToEdge(helper) {
    const rect = helper.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top  + rect.height / 2;
    const winW = window.innerWidth;
    const winH = window.innerHeight;

    let distTop    = centerY;
    let distBottom = winH - centerY;
    let distLeft   = centerX;
    let distRight  = winW - centerX;

    let minDist = Math.min(distTop, distBottom, distLeft, distRight);

    helper.style.top    = "auto";
    helper.style.bottom = "auto";
    helper.style.left   = "auto";
    helper.style.right  = "auto";

    let finalEdge, currentPos;
    const ballWidth  = rect.width;
    const ballHeight = rect.height;

    if (minDist === distTop) {
        finalEdge = "top";
        currentPos = rect.top;
    } else if (minDist === distBottom) {
        finalEdge = "bottom";
        currentPos = winH - (rect.top + ballHeight);
    } else if (minDist === distLeft) {
        finalEdge = "left";
        currentPos = rect.left;
    } else {
        finalEdge = "right";
        currentPos = winW - (rect.left + ballWidth);
    }

    helper.dataset.edge = finalEdge;
    helper.style.transition = "none";
    switch (finalEdge) {
        case "top":
            helper.style.top = currentPos + "px";
            helper.style.left = rect.left + "px";
            break;
        case "bottom":
            helper.style.bottom = currentPos + "px";
            helper.style.left   = rect.left + "px";
            break;
        case "left":
            helper.style.left = currentPos + "px";
            helper.style.top  = rect.top + "px";
            break;
        case "right":
            helper.style.right = currentPos + "px";
            helper.style.top   = rect.top + "px";
            break;
    }

    helper.getBoundingClientRect();

    helper.style.transition = "all 0.3s ease-out";
    switch (finalEdge) {
        case "top":
            helper.style.top = "-35px";
            break;
        case "bottom":
            helper.style.bottom = "-35px";
            break;
        case "left":
            helper.style.left = "-35px";
            break;
        case "right":
            helper.style.right = "-35px";
            break;
    }

    isFloating = false;

    const { inRange } = checkMouseRange(helper, FLOAT_DISTANCE);
    if (inRange) {
        showWithAnimation(helper);
    }
}

// --------------------- 根据鼠标距离弹出 / 收回 ---------------------
function handleMouseMove(e, helper) {
    if (isChatOpen) return;

    const { inRange } = checkMouseRange(helper, FLOAT_DISTANCE, e.clientX, e.clientY);
    if (inRange && !isFloating) {
        showWithAnimation(helper);
    } else if (!inRange && !isHovering) {
        resetHideTimer(helper);
    }
}

// --------------------- 计算小球中心与鼠标的距离 ---------------------
function checkMouseRange(helper, threshold, mouseX, mouseY) {
    const rect = helper.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top  + rect.height / 2;

    if (mouseX === undefined || mouseY === undefined) {
        const e = window.event;
        if (e) {
            mouseX = e.clientX;
            mouseY = e.clientY;
        } else {
            return { distance: 9999, inRange: false };
        }
    }
    const dx = mouseX - centerX;
    const dy = mouseY - centerY;
    const distance = Math.sqrt(dx*dx + dy*dy);

    return {
        distance,
        inRange: distance <= threshold
    };
}

// --------------------- 弹出 (从 -35px -> 5px) ---------------------
function showWithAnimation(helper) {
    clearTimeout(hideTimeout);
    isFloating = true;

    const edge = helper.dataset.edge || "bottom";
    switch(edge) {
        case "top":
            helper.style.top = "5px";
            break;
        case "left":
            helper.style.left = "5px";
            break;
        case "right":
            helper.style.right = "5px";
            break;
        case "bottom":
        default:
            helper.style.bottom = "5px";
            break;
    }
}

// --------------------- 收回 (从 5px -> -35px) ---------------------
function hideWithAnimation(helper) {
    isFloating = false;

    const edge = helper.dataset.edge || "bottom";
    switch(edge) {
        case "top":
            helper.style.top = "-35px";
            break;
        case "left":
            helper.style.left = "-35px";
            break;
        case "right":
            helper.style.right = "-35px";
            break;
        case "bottom":
        default:
            helper.style.bottom = "-35px";
            break;
    }
}

// --------------------- 若鼠标离开后，2秒后自动收回 ---------------------
function resetHideTimer(helper) {
    if (isChatOpen) return;
    clearTimeout(hideTimeout);

    hideTimeout = setTimeout(() => {
        if (!isHovering && !isChatOpen) {
            hideWithAnimation(helper);
        }
    }, 2000);
}

// --------------------- 窗口大小变化 ---------------------
window.addEventListener("resize", () => {
    if (!isChatOpen) {
        let helper = document.getElementById("ai-helper");
        if (helper) {
            helper.style.bottom = "-35px";  
            helper.style.right  = "30px";
            helper.dataset.edge = "bottom";
            isFloating = false;
        }
    }
    hideSelectionIcon();
});

// 悬浮小球功能结束-----------------------------------------------------------------------------------
