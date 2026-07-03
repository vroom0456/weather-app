// ---------- CONFIG ----------
const STORAGE_KEY = "skyline_owm_api_key";
const HISTORY_KEY = "skyline_search_history";
let unit = "metric"; // metric = °C, imperial = °F

// ---------- ELEMENTS ----------
const searchForm = document.getElementById("searchForm");
const cityInput = document.getElementById("cityInput");
const locBtn = document.getElementById("locBtn");
const unitToggle = document.getElementById("unitToggle");
const messagePanel = document.getElementById("messagePanel");
const weatherCard = document.getElementById("weatherCard");
const forecastRow = document.getElementById("forecastRow");
const forecastTrack = document.getElementById("forecastTrack");
const historyChips = document.getElementById("historyChips");
const keyBanner = document.getElementById("keyBanner");
const apiKeyInput = document.getElementById("apiKeyInput");
const saveKeyBtn = document.getElementById("saveKeyBtn");

// ---------- API KEY HANDLING ----------
function getApiKey() { return localStorage.getItem(STORAGE_KEY) || ""; }

function refreshKeyBanner() {
  if (getApiKey()) {
    keyBanner.classList.add("saved");
  } else {
    keyBanner.classList.remove("saved");
  }
}
refreshKeyBanner();

saveKeyBtn.addEventListener("click", () => {
  const key = apiKeyInput.value.trim();
  if (!key) return;
  localStorage.setItem(STORAGE_KEY, key);
  apiKeyInput.value = "";
  refreshKeyBanner();
  showMessage("API key saved. Try searching a city now.");
});

// ---------- HISTORY ----------
function getHistory() {
  try { return JSON.parse(localStorage.getItem(HISTORY_KEY)) || []; }
  catch { return []; }
}
function addToHistory(city) {
  let hist = getHistory().filter(c => c.toLowerCase() !== city.toLowerCase());
  hist.unshift(city);
  hist = hist.slice(0, 6);
  localStorage.setItem(HISTORY_KEY, JSON.stringify(hist));
  renderHistory();
}
function renderHistory() {
  const hist = getHistory();
  historyChips.innerHTML = hist.length
    ? hist.map(c => `<button class="history-chip" data-city="${c}">${c}</button>`).join("")
    : `<span style="color:var(--text-dim);font-size:.85rem;">No searches yet</span>`;
  historyChips.querySelectorAll(".history-chip").forEach(chip => {
    chip.addEventListener("click", () => fetchByCity(chip.dataset.city));
  });
}
renderHistory();

// ---------- ICON MAPPING ----------
function iconFor(main, id) {
  const map = {
    Clear: "☀️", Clouds: "☁️", Rain: "🌧️", Drizzle: "🌦️",
    Thunderstorm: "⛈️", Snow: "❄️", Mist: "🌫️", Smoke: "🌫️",
    Haze: "🌫️", Dust: "🌫️", Fog: "🌫️", Sand: "🌫️",
    Ash: "🌫️", Squall: "💨", Tornado: "🌪️"
  };
  return map[main] || "🌤️";
}

// ---------- MESSAGE ----------
function showMessage(text, isError = false) {
  messagePanel.textContent = text;
  messagePanel.classList.toggle("error", isError);
}
function clearMessage() { messagePanel.textContent = ""; messagePanel.classList.remove("error"); }

// ---------- FETCH CURRENT + FORECAST ----------
async function fetchByCity(city) {
  const key = getApiKey();
  if (!key) { showMessage("Add your OpenWeatherMap API key below first.", true); return; }
  showMessage("Loading…");
  try {
    const res = await fetch(`https://api.openweathermap.org/data/2.5/weather?q=${encodeURIComponent(city)}&units=${unit}&appid=${key}`);
    if (!res.ok) {
      if (res.status === 401) throw new Error("Invalid API key. Double-check the key you saved.");
      if (res.status === 404) throw new Error(`Couldn't find "${city}". Check the spelling and try again.`);
      throw new Error("Something went wrong fetching weather data.");
    }
    const data = await res.json();
    renderWeather(data);
    fetchForecast(data.coord.lat, data.coord.lon);
    addToHistory(data.name);
    clearMessage();
  } catch (err) {
    showMessage(err.message, true);
  }
}

async function fetchByCoords(lat, lon) {
  const key = getApiKey();
  if (!key) { showMessage("Add your OpenWeatherMap API key below first.", true); return; }
  showMessage("Locating you…");
  try {
    const res = await fetch(`https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lon}&units=${unit}&appid=${key}`);
    if (!res.ok) throw new Error("Couldn't fetch weather for your location.");
    const data = await res.json();
    renderWeather(data);
    fetchForecast(lat, lon);
    addToHistory(data.name);
    clearMessage();
  } catch (err) {
    showMessage(err.message, true);
  }
}

async function fetchForecast(lat, lon) {
  const key = getApiKey();
  try {
    const res = await fetch(`https://api.openweathermap.org/data/2.5/forecast?lat=${lat}&lon=${lon}&units=${unit}&appid=${key}`);
    if (!res.ok) return;
    const data = await res.json();
    renderForecast(data.list);
  } catch { /* forecast is a bonus; fail silently */ }
}

// ---------- RENDER ----------
function renderWeather(data) {
  weatherCard.classList.remove("hidden");
  document.getElementById("cityName").textContent = `${data.name}, ${data.sys.country}`;
  document.getElementById("dateLine").textContent = new Date().toLocaleDateString(undefined, { weekday: "long", month: "short", day: "numeric" });
  document.getElementById("weatherIcon").textContent = iconFor(data.weather[0].main);
  document.getElementById("temp").textContent = `${Math.round(data.main.temp)}°`;
  document.getElementById("condition").textContent = data.weather[0].description;
  document.getElementById("feelsLike").textContent = `${Math.round(data.main.feels_like)}°${unit === "metric" ? "C" : "F"}`;
  document.getElementById("humidity").textContent = `${data.main.humidity}%`;
  document.getElementById("wind").textContent = `${Math.round(data.wind.speed)} ${unit === "metric" ? "m/s" : "mph"}`;
  document.getElementById("pressure").textContent = `${data.main.pressure} hPa`;
  document.getElementById("visibility").textContent = `${(data.visibility / 1000).toFixed(1)} km`;
  document.getElementById("sunrise").textContent = new Date(data.sys.sunrise * 1000).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
  document.getElementById("sunset").textContent = new Date(data.sys.sunset * 1000).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
}

function renderForecast(list) {
  // API returns 3-hour steps; take the entry closest to midday for each of the next 5 days
  const daily = {};
  list.forEach(item => {
    const date = item.dt_txt.split(" ")[0];
    const hour = item.dt_txt.split(" ")[1];
    if (!daily[date] || hour === "12:00:00") daily[date] = item;
  });
  const days = Object.values(daily).slice(0, 5);
  forecastRow.classList.remove("hidden");
  forecastTrack.innerHTML = days.map(item => {
    const dayName = new Date(item.dt_txt).toLocaleDateString(undefined, { weekday: "short" });
    return `
      <div class="forecast-day">
        <div class="fd-name">${dayName}</div>
        <div class="fd-icon">${iconFor(item.weather[0].main)}</div>
        <div class="fd-temp">${Math.round(item.main.temp)}°</div>
      </div>
    `;
  }).join("");
}

// ---------- EVENTS ----------
searchForm.addEventListener("submit", e => {
  e.preventDefault();
  const city = cityInput.value.trim();
  if (city) fetchByCity(city);
});

locBtn.addEventListener("click", () => {
  if (!navigator.geolocation) { showMessage("Geolocation isn't supported in this browser.", true); return; }
  navigator.geolocation.getCurrentPosition(
    pos => fetchByCoords(pos.coords.latitude, pos.coords.longitude),
    () => showMessage("Couldn't get your location. Check browser permissions.", true)
  );
});

unitToggle.addEventListener("click", () => {
  unit = unit === "metric" ? "imperial" : "metric";
  unitToggle.textContent = unit === "metric" ? "°C" : "°F";
  const current = document.getElementById("cityName").textContent;
  if (current && current !== "—") {
    fetchByCity(current.split(",")[0]);
  }
});

// ---------- INIT ----------
if (!getApiKey()) {
  showMessage("Welcome! Add a free API key below to start checking the weather.");
}

