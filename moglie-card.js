// 1. Import your base64 images with Cache Busters (?v=12)
import { normal_monkey } from './normal-monkey.js?v=12';
import { winter_monkey } from './winter-monkey.js?v=12';
import { rainy_monkey } from './rainy-monkey.js?v=12';
import { summer_monkey } from './summer-monkey.js?v=12';
import { sleepy_monkey } from './sleepy-monkey.js?v=12';

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

      this.container.addEventListener('click', () => {
        if (!this.config || !this.config.alarm_entity) return;
        this.dispatchEvent(new CustomEvent('hass-more-info', {
          bubbles: true,
          composed: true,
          detail: { entityId: this.config.alarm_entity }
        }));
      });
    }

    if (this._hass) {
      this._lastStatus = null; 
      this.hass = this._hass;
    }

    if (!config.wan_entity || !config.alarm_entity || !config.weather_entity) {
      this.content.innerHTML = "⚠️ Please configure Moglie's entities in the Visual Editor.";
      this.container.style.border = "2px dashed var(--error-color, red)";
    }
  }

  set hass(hass) {
    this._hass = hass;
    if (!this.config || !this.config.wan_entity || !this.config.alarm_entity || !this.config.weather_entity) return;

    const wanEntity = hass.states[this.config.wan_entity];
    const alarmEntity = hass.states[this.config.alarm_entity];
    const weatherEntity = hass.states[this.config.weather_entity];

    if (!wanEntity || !alarmEntity || !weatherEntity) {
      let missing = [];
      if (!wanEntity) missing.push(this.config.wan_entity);
      if (!alarmEntity) missing.push(this.config.alarm_entity);
      if (!weatherEntity) missing.push(this.config.weather_entity);
      
      this.content.innerHTML = `⚠️ Cannot find entity: <b>${missing.join(', ')}</b>. Check your spelling or YAML.`;
      this.container.style.border = "2px dashed var(--error-color, red)";
      this.image.src = normal_monkey;
      this.image.style.filter = "grayscale(100%)";
      return;
    }

    const wanState = String(wanEntity.state).toLowerCase();
    const alarmState = String(alarmEntity.state).toLowerCase();
    const weatherState = String(weatherEntity.state).toLowerCase();
    
    const isWanActive = wanState === 'on' || wanState === 'connected' || wanState === 'true'; 
    const isOffState = alarmState.includes('disarmed') || alarmState === 'off';
    
    // Added 'stay' and 'partial' to catch more alarm types
    const isHomeState = alarmState.includes('home') || alarmState.includes('night') || alarmState.includes('stay') || alarmState.includes('partial');

    const currentHour = new Date().getHours();
    const nightStart = parseInt(this.config.night_start) || 22;
    const nightEnd = parseInt(this.config.night_end) || 6;
    
    let isNightMode = false;
    if (nightStart > nightEnd) {
      isNightMode = currentHour >= nightStart || currentHour < nightEnd;
    } else {
      isNightMode = currentHour >= nightStart && currentHour < nightEnd;
    }

    const isRaining = weatherState.includes('rain') || 
                      weatherState.includes('pour') || 
                      weatherState.includes('drizzle') || 
                      weatherState.includes('shower') || 
                      weatherState.includes('storm');

    let temp = null;
    if (weatherEntity.attributes && weatherEntity.attributes.temperature !== undefined) {
      temp = parseFloat(weatherEntity.attributes.temperature);
    } else if (!isNaN(parseFloat(weatherState))) {
      temp = parseFloat(weatherState);
    }
      
    let unitStr = 'F';
    if (weatherEntity.attributes) {
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

    const configHash = JSON.stringify(this.config);
    const statusKey = `${wanState}-${alarmState}-${isNightMode}-${isRaining}-${isHot}-${showWinter}-${configHash}`;
    if (this._lastStatus === statusKey) return; 
    this._lastStatus = statusKey;

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
      this.updateUI(summer_monkey, quotes.hot, "2px solid #FF9800"); 
    } else if (isOffState) {
      this.updateUI(normal_monkey, quotes.disarmed, "2px solid var(--warning-color, orange)");
    } else if (isHomeState) {
      this.updateUI(normal_monkey, quotes.armedHome, "2px solid var(--success-color, green)");
    } else {
      // DEBUGGER INJECTED HERE: This will print the actual state on your screen!
      const debugMsg = `${quotes.armedAway} <br><br><span style="font-size: 0.8em; font-weight: normal; color: gray;">(Debug - Received State: '${alarmState}')</span>`;
      this.updateUI(normal_monkey, debugMsg, "2px solid var(--error-color, red)");
    }
  }

  updateUI(imageSrc, text, borderStyle) {
    this.image.src = imageSrc; 
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
    } else {
      this.updateValues();
    }
  }

  set hass(hass) {
    this._hass = hass;
  }

  render() {
    if (!this._config) return;

    const inputStyle = "width: 100%; padding: 8px; margin-top: 4px; border: 1px solid var(--divider-color, #ccc); border-radius: 4px; background: var(--card-background-color, #fff); color: var(--primary-text-color, #000); box-sizing: border-box; font-family: inherit;";
    const labelStyle = "font-size: 14px; font-weight: 500; color: var(--primary-text-color);";

    this.innerHTML = `
      <div style="display: flex; flex-direction: column; gap: 20px; padding: 16px 0;">
        
        <div style="display: flex; flex-direction: column; gap: 12px;">
          <h3 style="margin: 0; color: var(--primary-text-color);">Entity Configuration</h3>
          <div>
            <label style="${labelStyle}">WAN Entity ID (e.g., binary_sensor.wan)</label>
            <input type="text" id="wan_entity" style="${inputStyle}" />
          </div>
          <div>
            <label style="${labelStyle}">Alarm Entity ID (e.g., alarm_control_panel.home)</label>
            <input type="text" id="alarm_entity" style="${inputStyle}" />
          </div>
          <div>
            <label style="${labelStyle}">Weather Entity ID (e.g., weather.home)</label>
            <input type="text" id="weather_entity" style="${inputStyle}" />
          </div>
        </div>

        <div style="display: flex; flex-direction: column; gap: 12px;">
          <h3 style="margin: 0; color: var(--primary-text-color);">Night Mode Schedule</h3>
          <div style="display: flex; gap: 16px;">
            <div style="flex: 1;">
              <label style="${labelStyle}">Start Hour (0-23)</label>
              <input type="number" id="night_start" style="${inputStyle}" />
            </div>
            <div style="flex: 1;">
              <label style="${labelStyle}">End Hour (0-23)</label>
              <input type="number" id="night_end" style="${inputStyle}" />
            </div>
          </div>
        </div>

        <div style="display: flex; flex-direction: column; gap: 12px;">
          <h3 style="margin: 0; color: var(--primary-text-color);">Custom Quotes</h3>
          <div><label style="${labelStyle}">WAN Offline</label><input type="text" id="quote_offline" style="${inputStyle}" /></div>
          <div><label style="${labelStyle}">Disarmed</label><input type="text" id="quote_disarmed" style="${inputStyle}" /></div>
          <div><label style="${labelStyle}">Armed Home</label><input type="text" id="quote_armed_home" style="${inputStyle}" /></div>
          <div><label style="${labelStyle}">Armed Away</label><input type="text" id="quote_armed_away" style="${inputStyle}" /></div>
          <div><label style="${labelStyle}">Night Mode</label><input type="text" id="quote_night" style="${inputStyle}" /></div>
        </div>

      </div>
    `;

    this.updateValues();

    const inputs = [
      'wan_entity', 'alarm_entity', 'weather_entity', 'night_start', 'night_end', 
      'quote_offline', 'quote_disarmed', 'quote_armed_home', 'quote_armed_away', 'quote_night'
    ];

    inputs.forEach((id) => {
      const el = this.querySelector(`#${id}`);
      if (el) {
        el.addEventListener('focusout', (e) => this._valueChanged(id, e.target.value));
        el.addEventListener('change', (e) => this._valueChanged(id, e.target.value));
      }
    });
  }

  updateValues() {
    if (!this._config) return;
    const inputs = [
      'wan_entity', 'alarm_entity', 'weather_entity', 'night_start', 'night_end', 
      'quote_offline', 'quote_disarmed', 'quote_armed_home', 'quote_armed_away', 'quote_night'
    ];
    
    inputs.forEach((id) => {
      const el = this.querySelector(`#${id}`);
      if (el) {
        const expectedVal = this._config[id] !== undefined ? String(this._config[id]) : '';
        if (el.value !== expectedVal) {
          el.value = expectedVal;
        }
      }
    });
  }

  _valueChanged(id, value) {
    if (!this._config) return;
    
    const currentVal = this._config[id] !== undefined ? String(this._config[id]) : '';
    if (currentVal === value) return;

    this._config = { ...this._config, [id]: value };
    
    this.dispatchEvent(new CustomEvent("config-changed", {
      detail: { config: this._config },
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
