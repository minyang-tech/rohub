async function refreshStatus() {
  const state = document.querySelector("#sync-state");
  const log = document.querySelector("#activity-log");
  if (!window.rohub) {
    state.textContent = "browser-preview";
    log.textContent = "Electron preload 없이 브라우저 미리보기로 실행 중입니다.";
    return;
  }

  const status = await window.rohub.getStatus();
  state.textContent = status.state;
  log.textContent = status.message;
}

document.addEventListener("DOMContentLoaded", () => {
  refreshStatus();
  for (const button of document.querySelectorAll("[data-action]")) {
    button.addEventListener("click", () => {
      document.querySelector("#activity-log").textContent = `${button.dataset.action} 기능은 API 연결 단계에서 구현됩니다.`;
    });
  }
});