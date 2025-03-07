// 后台服务仍然保留，但功能大幅简化
// 主要用于在扩展重启后保持状态，以及在需要时处理消息
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    // 我们可以在这里处理其他消息
    // 例如，如果将来需要保存设置或执行其他操作
    sendResponse({ status: "ok" });
});