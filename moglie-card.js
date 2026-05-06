// 1. Import your base64 images with Cache Busters (?v=1)
// If you ever update the images again, just change this to ?v=2, ?v=3, etc.
import { normal_monkey } from './normal-monkey.js?v=1';
import { winter_monkey } from './winter-monkey.js?v=1';
import { rainy_monkey } from './rainy-monkey.js?v=1';
import { sunny_monkey } from './summer-monkey.js?v=1';
import { sleepy_monkey } from './sleepy-monkey.js?v=1';

/* -------------------------------------------------------------------
   MAIN CARD COMPONENT
------------------------------------------------------------------- */
class MoglieCard extends HTMLElement {
  
  static getConfigElement() {
    return document.createElement("moglie-card-editor");
  }

  static getStubConfig() {
    return {
      wan_entity: "",
      alarm_entity: "",
      weather_entity: "",
      night_start: 22,
      night_end: 6
    };
  }

  setConfig(config) {
    this.config = config;

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

      // Tap action to bring up Home Assistant's more-info dialog
      this.container.addEventListener('click', () => {
        if (!this.config || !this.config.alarm_entity) return;
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

  set hass(hass) {
    if (!this.config || !this.config.wan_entity || !this.config.alarm_entity || !this.config.weather_entity) return;

    const wanEntity = hass.states[this.config.wan_entity];
    const alarmEntity = hass.states[this.config.alarm_entity];
    const weatherEntity = hass.states[this.config.weather_entity];

    // Safely parse states
    const wanState = wanEntity ? wanEntity.state : 'unknown';
    const alarmState = alarmEntity ? alarmEntity.state : 'unknown';
    const weatherState = weatherEntity && weatherEntity.state ? weatherEntity.state.toLowerCase() : 'unknown';
    
    // 1. Identify Logic States
    const isWanActive = wanState === 'on' || wanState === 'connected'; 
    const isOffState = alarmState === 'disarmed';
    const isHomeState = alarmState === 'armed_home';

    // 2. Custom Night Mode Logic (Handles wrapping past midnight)
    const currentHour = new Date().getHours();
    const nightStart = parseInt(this.config.night_start) || 22;
    const nightEnd = parseInt(this.config.night_end) || 6;
    
    let isNightMode = false;
    if (nightStart > nightEnd) {
      isNightMode = currentHour >= nightStart || currentHour < nightEnd;
    } else {
      isNightMode = currentHour >= nightStart && currentHour < nightEnd;
    }

    // 3. Weather Triggers (Wide Net & Super-Safe Temp Checks)
    const isRaining = weatherState.includes('rain') || 
                      weatherState.includes('pour') || 
                      weatherState.includes('drizzle') || 
                      weatherState.includes('shower') || 
                      weatherState.includes('storm');

    // Smart Temperature Finder
    let temp = null;
    if (weatherEntity && weatherEntity.attributes && weatherEntity.attributes.temperature !== undefined) {
      temp = parseFloat(weatherEntity.attributes.temperature);
    } else if (!isNaN(parseFloat(weatherState))) {
      temp = parseFloat(weatherState);
    }
      
    // Safely handle "°F" and "°C" symbols from Home Assistant
    let unitStr = 'F';
    if (weatherEntity && weatherEntity.attributes) {
        if (weatherEntity.attributes.temperature_unit) {
            unitStr = String(weatherEntity.attributes.temperature_unit);
        } else if (weatherEntity.attributes.unit_of_measurement) {
            unitStr = String(weatherEntity.attributes.unit_of_measurement);
        }
    }
    const isF = unitStr.toUpperCase().includes('F');
    const isC = unitStr.toUpperCase().includes('C');
      
    const isSnowing = ['snowy', 'snowy-rainy', 'hail'].includes(weatherState);
    const isSunny = weatherState.includes('sunny') || weatherState.includes('clear');
    
    const isHot = isSunny || (temp !== null && ((isF && temp >= 80) || (isC && temp >= 27)));
    const isCold = temp !== null && ((isF && temp < 50) || (isC && temp < 10));
    const showWinter = isSnowing || isCold;

    const statusKey = `${wanState}-${alarmState}-${isNightMode}-${isRaining}-${isHot}-${showWinter}`;
    if (this._lastStatus === statusKey) return; 
    this._lastStatus = statusKey;

    // 4. Custom Quotes Dictionary
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

    this.content.className = "text-box";
    this.image.style.filter = "none"; 

    // 5. THE MASTER PRIORITY LIST (WAN > NIGHT > RAIN > WINTER > HOT > ALARM)
    if (!isWanActive) {
      this.updateUI(normal_monkey, quotes.offline, "2px solid var(--disabled-text-color, gray)");
      this.content.classList.add("status-warning");
      this.image.style.filter = "grayscale(100%)";
    } else if (isNightMode) {
      this.updateUI(sleepy_monkey, quotes.night, "2px solid #673AB7");
    } else if (isRaining) {
      this.updateUI(rainy_monkey, quotes.rain, "2px solid #2196F3");
    } else if (showWinter) {
      this.updateUI(winter_monkey, quotes.cold, "2px solid #00BCD4");
    } else if (isHot) {
      this.updateUI(sunny_monkey, quotes.hot, "2px solid #FF9800");
    } else if (isOffState) {
      this.updateUI(normal_monkey, quotes.disarmed, "2px solid var(--warning-color, orange)");
    } else if (isHomeState) {
      this.updateUI(normal_monkey, quotes.armedHome, "2px solid var(--success-color, green)");
    } else {
      this.updateUI(normal_monkey, quotes.armedAway, "2px solid var(--error-color, red)");
    }
  }

  // DOM update helper function (Forced Image Re-render)
  updateUI(imageSrc, text, borderStyle) {
    this.image.src = imageSrc; // Removes the safety check to force HA to reload the image
    this.content.innerHTML = text;
    this.container.style.border = borderStyle;
  }

  getCardSize() { return 3; }
}
customElements.define('moglie-card', MoglieCard);


/* -------------------------------------------------------------------
   VISUAL EDITOR COMPONENT (GUI)
------------------------------------------------------------------- */
class MoglieCardEditor extends HTMLElement {
  
  setConfig(config) {
    this._config = config;
    if (!this._rendered) {
      this.render();
      this._rendered = true;
    }
  }

  set hass(hass) {
    this._hass = hass;
  }

  render() {
    this.innerHTML = `
      <div style="display: flex; flex-direction: column; gap: 24px; padding: 8px 0;">
        
        <div style="display: flex; flex-direction: column; gap: 12px;">
          <h3 style="margin: 0; color: var(--primary-text-color);">Entity Configuration</h3>
          <p style="margin: 0; color: var(--secondary-text-color); font-size: 0.9em;">Type the exact entity ID (e.g., weather.home).</p>
          <ha-textfield id="wan_entity" label="WAN Entity ID"></ha-textfield>
          <ha-textfield id="alarm_entity" label="Alarm Entity ID"></ha-textfield>
          <ha-textfield id="weather_entity" label="Weather Entity ID"></ha-textfield>
        </div>

        <div style="display: flex; flex-direction: column; gap: 12px;">
          <h3 style="margin: 0; color: var(--primary-text-color);">Night Mode Schedule</h3>
          <div style="display: flex; gap: 16px;">
            <ha-textfield id="night_start" label="Start Hour (0-23)" type="number" style="flex: 1;"></ha-textfield>
            <ha-textfield id="night_end" label="End Hour (0-23)" type="number" style="flex: 1;"></ha-textfield>
          </div>
        </div>

        <div style="display: flex; flex-direction: column; gap: 12px;">
          <h3 style="margin: 0; color: var(--primary-text-color);">Custom Quotes</h3>
          <p style="margin: 0; color: var(--secondary-text-color); font-size: 0.9em;">Leave blank for default phrases.</p>
          <ha-textfield id="quote_offline" label="WAN Offline"></ha-textfield>
          <ha-textfield id="quote_disarmed" label="Disarmed"></ha-textfield>
          <ha-textfield id="quote_armed_home" label="Armed Home"></ha-textfield>
          <ha-textfield id="quote_armed_away" label="Armed Away"></ha-textfield>
          <ha-textfield id="quote_night" label="Night Mode"></ha-textfield>
        </div>

      </div>
    `;

    const inputs = [
      'wan_entity', 'alarm_entity', 'weather_entity', 'night_start', 'night_end', 
      'quote_offline', 'quote_disarmed', 'quote_armed_home', 'quote_armed_away', 'quote_night'
    ];

    inputs.forEach((id) => {
      const el = this.querySelector(`#${id}`);
      if (el) {
        el.value = this._config[id] !== undefined ? this._config[id] : '';
        el.addEventListener('input', (e) => this.updateConfig(id, e.target.value));
      }
    });
  }

  updateConfig(key, value) {
    if (!this._config || this._config[key] === value) return;
    const newConfig = { ...this._config, [key]: value };
    this.dispatchEvent(new CustomEvent("config-changed", {
      detail: { config: newConfig },
      bubbles: true,
      composed: true,
    }));
  }
}
customElements.define("moglie-card-editor", MoglieCardEditor);

/* -------------------------------------------------------------------
   CARD PICKER REGISTRATION
------------------------------------------------------------------- */
window.customCards = window.customCards || [];
window.customCards.push({
  type: "moglie-card",
  name: "Moglie HA Beta",
  description: "Moglie monitors your WAN status and security state.",
  preview: true,
  documentationURL: "https://github.com/jordanazulay-maker/moglie-ha"
});
