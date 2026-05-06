// 1. Import your base64 images
import { normal_monkey } from './normal-monkey.js';
import { winter_monkey } from './winter-monkey.js';
import { rainy_monkey } from './rainy-monkey.js';
import { sunny_monkey } from './sunny-monkey.js';
import { sleepy_monkey } from './sleepy-monkey.js';

/* -------------------------------------------------------------------
   MAIN CARD COMPONENT
------------------------------------------------------------------- */
class MoglieCard extends HTMLElement {
  
  // Connects the visual editor to the card
  static getConfigElement() {
    return document.createElement("moglie-card-editor");
  }

  // Provides the default YAML when adding the card from the UI picker
  static getStubConfig() {
    return {
      wan_entity: "",
      alarm_entity: "",
      weather_entity: "",
      night_start: 22,
      night_end: 6
    };
  }

  // Runs once when the card is added to the dashboard
  setConfig(config) {
    this.config = config;

    // Build the DOM structure only if it doesn't already exist
    if (!this.content) {
      this.innerHTML = `
        <ha-card>
          <div id="moglie-container" style="padding: 16px; border-radius: 10px; text-align: center; transition: all 0.3s ease; cursor: pointer;">
            <img id="moglie-image" src="${normal_monkey}" width="150" style="transition: all 0.3s ease;" />
            <div id="moglie-text" class="text-box" style="margin-top: 10px; font-weight: bold; min-height: 2em;"></div>
          </div>
        </ha-card>
      `;
      this.container = this.querySelector('#moglie-container');
      this.image = this.querySelector('#moglie-image');
      this.content = this.querySelector('#moglie-text');

      // Click event for native More Info dialog
      this.container.addEventListener('click', () => {
        if (!this.config?.alarm_entity) return;
        this.dispatchEvent(new CustomEvent('hass-more-info', {
          bubbles: true,
          composed: true,
          detail: { entityId: this.config.alarm_entity }
        }));
      });
    }

    if (!config.wan_entity || !config.alarm_entity || !config.weather_entity) {
      this.content.innerHTML = "⚠️ Please configure Moglie's entities in the Visual Editor.";
      this.container.style.border = "2px dashed var(--error-color, red)";
    }
  }

  // Runs every time a state changes in Home Assistant
  set hass(hass) {
    if (!this.config?.wan_entity || !this.config?.alarm_entity || !this.config?.weather_entity) return;

    // Grab entities cleanly
    const wanEntity = hass.states[this.config.wan_entity];
    const alarmEntity = hass.states[this.config.alarm_entity];
    const weatherEntity = hass.states[this.config.weather_entity];

    const wanState = wanEntity?.state || 'unknown';
    const alarmState = alarmEntity?.state || 'unknown';
    const weatherState = weatherEntity?.state?.toLowerCase() || 'unknown';
    
    // 1. Identify Logic States
    const isWanActive = wanState === 'on' || wanState === 'connected'; 
    const isOffState = alarmState === 'disarmed';
    const isHomeState = alarmState === 'armed_home';

    // 2. Custom Night Mode Logic
    const currentHour = new Date().getHours();
    const nightStart = parseInt(this.config.night_start) || 22;
    const nightEnd = parseInt(this.config.night_end) || 6;
    
    const isNightMode = nightStart > nightEnd 
      ? (currentHour >= nightStart || currentHour < nightEnd) 
      : (currentHour >= nightStart && currentHour < nightEnd);

    // 3. Weather Triggers (The "Wide Net" Fix)
    // Checks if the state contains any of these words, regardless of the exact string
    const isRaining = weatherState.includes('rain') || 
                      weatherState.includes('pour') || 
                      weatherState.includes('drizzle') || 
                      weatherState.includes('shower') || 
                      weatherState.includes('storm');

    const temp = weatherEntity?.attributes?.temperature ? parseFloat(weatherEntity.attributes.temperature) : null;
    const isSnowing = ['snowy', 'snowy-rainy', 'hail'].includes(weatherState);
    const isHot = temp !== null && temp > 90;
    const isCold = temp !== null && temp < 40;
    const showWinter = isSnowing || isCold;

    // Efficiency: Status Key (Prevents expensive DOM updates if the visual state hasn't changed)
    const statusKey = `${wanState}-${alarmState}-${isNightMode}-${isRaining}-${isHot}-${showWinter}`;
    if (this._lastStatus === statusKey) return; 
    this._lastStatus = statusKey;

    // 4. Custom Quotes Dictionary (Falls back to defaults)
    const quotes = {
      offline: this.config.quote_offline || "Moglie is stranded. The WAN connection has been lost!",
      cold: this.config.quote_cold || "Brrr! It's freezing out there!",
      rain: this.config.quote_rain || "Looks like rain, grabbing my coat!",
      hot: this.config.quote_hot || "It's boiling! Need a banana smoothie.",
      night: this.config.quote_night || "Zzz... Moglie is sleeping...",
      disarmed: this.config.quote_disarmed || "System's off! The rest of the primates ditched their post for a banana run. Typical.",
      armedHome: this.config.quote_armed_home || "Welcome Home! The WAN is strong. Tell me you brought more bananas!",
      armedAway: this.config.quote_armed_away || "The rest of the primates are on patrol. I'll watch the trees until they get back!"
    };

    // Reset baseline classes and styles on update
    this.content.className = "text-box";
    this.image.style.filter = "none"; 

    // 5. THE MASTER PRIORITY LIST (Rain beats Winter now)
    if (!isWanActive) {
      this.updateUI(normal_monkey, quotes.offline, "2px solid var(--disabled-text-color, gray)");
      this.content.classList.add("status-warning");
      this.image.style.filter = "grayscale(100%)";
    } else if (isRaining) {
      this.updateUI(rainy_monkey, quotes.rain, "2px solid #2196F3");
    } else if (showWinter) {
      this.updateUI(winter_monkey, quotes.cold, "2px solid #00BCD4");
    } else if (isHot) {
      this.updateUI(sunny_monkey, quotes.hot, "2px solid #FF9800");
    } else if (isNightMode) {
      this.updateUI(sleepy_monkey, quotes.night, "2px solid #673AB7");
    } else if (isOffState) {
      this.updateUI(normal_monkey, quotes.disarmed, "2px solid var(--warning-color, orange)");
    } else if (isHomeState) {
      this.updateUI(normal_monkey, quotes.armedHome, "2px solid var(--success-color, green)");
    } else {
      this.updateUI(normal_monkey, quotes.armedAway, "2px solid var(--error-color, red)");
    }
  }

  // DOM update helper function to keep things clean
  updateUI(imageSrc, text, borderStyle) {
