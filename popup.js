const minutes = ms => Math.round(ms / 60000);
let selectedPeriod = "today", currentSite;
const startToday = () => { const date = new Date(); date.setHours(0, 0, 0, 0); return date.getTime(); };
const make = (tag, className, value) => { const node = document.createElement(tag); if (className) node.className = className; if (value !== undefined) node.textContent = value; return node; };
function periodItems(log, sessionStartedAt) { return log.filter(item => item.endedAt >= (selectedPeriod === "today" ? startToday() : sessionStartedAt)); }
function renderSummary(items) {
  const totals = items.reduce((acc, item) => ({ ...acc, [item.category]: (acc[item.category] || 0) + item.durationMs }), {}), summary = document.querySelector("#summary");
  const stat = (className, amount, label) => { const box = make("div", `mini-stat ${className}`); box.append(make("strong", "", `${minutes(amount)}m`), make("span", "", label)); return box; };
  summary.replaceChildren(stat("good", totals.productive || 0, "productive"), stat("bad", totals.distracting || 0, "distraction"), stat("neutral", totals.neutral || 0, "neutral"));
}
function renderTopSites(items) {
  const totals = {}; items.forEach(item => totals[item.domain] = (totals[item.domain] || 0) + item.durationMs); const sites = Object.entries(totals).sort((a,b) => b[1] - a[1]).slice(0, 3), list = document.querySelector("#top-sites");
  list.replaceChildren(...(sites.length ? sites.map(([domain, time], index) => { const row = make("li"); row.append(make("span", "rank", index + 1), make("strong", "", domain), make("span", "", `${minutes(time)}m`)); return row; }) : [make("li", "empty", "No usage recorded yet.")]));
}
function renderCurrentSite() {
  document.querySelector("#current-domain").textContent = currentSite?.domain || "No trackable page active";
  document.querySelector("#current-category").textContent = currentSite ? currentSite.category : "";
  document.querySelector("#timer-status").textContent = currentSite?.limitMinutes ? `${minutes(currentSite.spentMs)} of ${currentSite.limitMinutes} min used today` : "No daily timer set";
  document.querySelector("#timer-minutes").value = currentSite?.limitMinutes || "";
  document.querySelector("#add-time").disabled = !currentSite?.limitMinutes;
  document.querySelector("#remove-timer").disabled = !currentSite?.limitMinutes;
  document.querySelectorAll("[data-category]").forEach(button => {
    const selected = button.dataset.category === currentSite?.category;
    button.classList.toggle("selected", selected);
    button.setAttribute("aria-pressed", String(selected));
  });
}
async function render() {
  const data = await browser.runtime.sendMessage({ type: "getLog" }); currentSite = await browser.runtime.sendMessage({ type: "getCurrentSite" });
  const items = periodItems(data.log, data.sessionStartedAt); document.querySelector("#period-title").textContent = selectedPeriod === "today" ? "Today, so far" : "This session, so far";
  document.querySelectorAll("[data-popup-period]").forEach(button => button.classList.toggle("active", button.dataset.popupPeriod === selectedPeriod)); renderSummary(items); renderTopSites(items); renderCurrentSite();
}
async function setTimer(minutesToSet) { const result = await browser.runtime.sendMessage({ type: "setCurrentSiteLimit", minutes: minutesToSet }); if (!result.error) await render(); }
document.querySelectorAll("[data-popup-period]").forEach(button => button.onclick = () => { selectedPeriod = button.dataset.popupPeriod; render(); });
document.querySelector("#open").onclick = () => browser.runtime.openOptionsPage();
document.querySelectorAll("[data-category]").forEach(button => button.onclick = async () => {
  if (!currentSite) return;
  currentSite = { ...currentSite, category: button.dataset.category };
  renderCurrentSite();
  const result = await browser.runtime.sendMessage({ type: "setCurrentCategory", category: button.dataset.category });
  if (!result.error) await render();
});
document.querySelector("#save-timer").onclick = () => setTimer(Number(document.querySelector("#timer-minutes").value));
document.querySelector("#add-time").onclick = () => setTimer((currentSite?.limitMinutes || 0) + 15);
document.querySelector("#remove-timer").onclick = () => setTimer(0);
render();
