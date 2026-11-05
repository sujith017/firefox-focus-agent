const mins = ms => `${Math.round(ms / 60000)} min`;
let state, selectedPeriod = "today";
const el = (tag, className, value) => { const node = document.createElement(tag); if (className) node.className = className; if (value !== undefined) node.textContent = value; return node; };
const byCategory = items => items.reduce((a, i) => ({ ...a, [i.category]: (a[i.category] || 0) + i.durationMs }), {});
const startOfDay = (daysAgo = 0) => { const date = new Date(); date.setHours(0, 0, 0, 0); return date.getTime() - daysAgo * 86400000; };
const dateInput = timestamp => new Date(timestamp).toISOString().slice(0, 10);
function periodDetails() {
  const rangeStart = document.querySelector("#range-start").value, rangeEnd = document.querySelector("#range-end").value;
  const starts = { session: state.sessionStartedAt, today: startOfDay(), week: startOfDay(6), custom: rangeStart ? new Date(`${rangeStart}T00:00:00`).getTime() : startOfDay() };
  const ends = { custom: rangeEnd ? new Date(`${rangeEnd}T23:59:59.999`).getTime() : Date.now() };
  return { start: starts[selectedPeriod], end: ends[selectedPeriod] || Date.now(), label: { session: "THIS SESSION", today: "TODAY", week: "THIS WEEK", custom: "CUSTOM RANGE" }[selectedPeriod] };
}
function itemsForPeriod() { const period = periodDetails(); return state.log.filter(item => item.endedAt >= period.start && item.endedAt <= period.end); }
function summary(items) { const t = byCategory(items); return items.length ? `${mins(t.productive || 0)} productive, ${mins(t.distracting || 0)} distracting, and ${mins(t.neutral || 0)} neutral.` : "No active browser time recorded in this period."; }
function progressBar(percent) { const track = el("i"), fill = el("b"); fill.style.width = `${percent}%`; track.append(fill); return track; }
function card(category, value, total) { const percent = total ? Math.round(value / total * 100) : 0, labels = { productive: "Productive", distracting: "Distraction", neutral: "Neutral" }; const node = el("article", `stat-card ${category}`); node.append(el("span", "", labels[category]), el("strong", "", mins(value)), el("small", "", `${percent}% of tracked time`), progressBar(percent)); return node; }
function renderChart(totals, total) {
  const keys = ["productive", "distracting", "neutral"], values = keys.map(key => total ? Math.round((totals[key] || 0) / total * 100) : 0), [productive, distracting] = values;
  const donut = document.querySelector("#donut"); donut.style.background = total ? `conic-gradient(var(--green) 0 ${productive}%, var(--red) ${productive}% ${productive + distracting}%, var(--gold) ${productive + distracting}% 100%)` : "var(--line)"; document.querySelector("#chart-total").textContent = total ? mins(total) : "No data";
  const legend = document.querySelector("#chart-legend"); legend.replaceChildren(...keys.map((key, index) => { const item = el("li", key); item.append(el("i"), el("span", "", key[0].toUpperCase() + key.slice(1)), el("strong", "", `${values[index]}%`)); return item; }));
}
function renderLimits() {
  const entries = Object.entries(state.settings.limits || {}).sort((a,b) => a[0].localeCompare(b[0])), list = document.querySelector("#limits");
  if (!entries.length) { list.replaceChildren(el("li", "empty", "No daily limits set.")); return; }
  list.replaceChildren(...entries.map(([domain, minutes]) => { const item = el("li"), remove = el("button", "", "Remove"); remove.onclick = async () => { delete state.settings.limits[domain]; await saveSettings(); }; item.append(el("strong", "", domain), el("span", "", `${minutes} min/day`), remove); return item; }));
}
function renderDomains(items) {
  const totals = {}; items.forEach(item => totals[item.domain] = (totals[item.domain] || 0) + item.durationMs); const entries = Object.entries(totals).sort((a,b) => b[1] - a[1]).slice(0, 10), list = document.querySelector("#domains"), max = Math.max(...Object.values(totals), 1);
  if (!entries.length) { list.replaceChildren(el("li", "empty", "No active browser time recorded yet.")); return; }
  list.replaceChildren(...entries.map(([domain, duration], index) => { const item = el("li"), data = el("div", "domain"), top = el("div"); top.append(el("strong", "", domain), el("span", "", mins(duration))); data.append(top, progressBar(Math.round(duration / max * 100))); item.append(el("span", "rank", index + 1), data); return item; }));
}
function render() {
  const items = itemsForPeriod(), totals = byCategory(items), total = Object.values(totals).reduce((sum, value) => sum + value, 0), detail = periodDetails();
  document.documentElement.dataset.theme = state.settings.theme || "system"; document.querySelector("#theme").value = state.settings.theme || "system"; document.querySelector("#period-label").textContent = detail.label; document.querySelector("#period-headline").textContent = summary(items); document.querySelector("#today").textContent = total ? `${mins(total)} tracked` : "Nothing tracked yet"; document.querySelector("#custom-range").hidden = selectedPeriod !== "custom";
  document.querySelector("#category-cards").replaceChildren(...["productive", "distracting", "neutral"].map(c => card(c, totals[c] || 0, total))); renderChart(totals, total); renderDomains(items);
  ["productive", "distracting", "neutral"].forEach(category => document.querySelector(`#${category}`).value = (state.settings.rules[category] || []).join("\n")); document.querySelectorAll("[data-period]").forEach(button => button.classList.toggle("active", button.dataset.period === selectedPeriod)); renderLimits();
}
async function saveSettings() { await browser.runtime.sendMessage({ type: "saveSettings", settings: state.settings }); state = await browser.runtime.sendMessage({ type: "getLog" }); render(); }
async function init() { state = await browser.runtime.sendMessage({ type: "getLog" }); const minDate = dateInput(startOfDay(13)), maxDate = dateInput(Date.now()); ["#range-start", "#range-end"].forEach(id => { const input = document.querySelector(id); input.min = minDate; input.max = maxDate; }); document.querySelector("#range-start").value = dateInput(startOfDay(6)); document.querySelector("#range-end").value = maxDate; render(); }
document.querySelectorAll("[data-period]").forEach(button => button.onclick = () => { selectedPeriod = button.dataset.period; render(); });
document.querySelector("#apply-range").onclick = () => { const start = document.querySelector("#range-start"), end = document.querySelector("#range-end"); if (start.value && end.value && start.value <= end.value) render(); else alert("Choose a valid start and end date."); };
document.querySelector("#theme").onchange = event => { state.settings.theme = event.target.value; saveSettings(); };
document.querySelector("#save").onclick = async () => { ["productive", "distracting", "neutral"].forEach(c => state.settings.rules[c] = document.querySelector(`#${c}`).value.split("\n").map(x => x.trim()).filter(Boolean)); await saveSettings(); };
document.querySelector("#limit-form").onsubmit = async event => { event.preventDefault(); const domain = document.querySelector("#limit-domain").value.trim().replace(/^https?:\/\//, "").replace(/^www\./, "").replace(/\/.*$/, ""); state.settings.limits[domain] = Number(document.querySelector("#limit-minutes").value); event.target.reset(); await saveSettings(); };
document.querySelector("#clear").onclick = async () => { if (confirm("Delete all locally stored Focus Ledger history?")) { await browser.runtime.sendMessage({ type: "clearLog" }); await init(); } };
init();
