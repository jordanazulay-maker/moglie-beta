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

  // This runs when the card is added to the dashboard
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

      // Add the click event to open the Home Assistant menu
      this.container.addEventListener('click', () => {
        if (!this.config || !this.config.alarm_entity) return;
        const event = new Event('hass-more-info', { bubbles: true, composed: true });
        event.detail = { entityId: this.config.alarm_entity };
        this.dispatchEvent(event);
      });
    }

    if (!config.wan_entity || !config.alarm_entity || !config.weather_entity) {
      this.content.innerHTML = "⚠️ Please configure Moglie's entities in the Visual Editor.";
      this.container.style.border = "2px dashed var(--error-color, red)";
    }
  }

  // This runs EVERY time a state changes in Home Assistant
  set hass(hass) {
    if (!this.config || !this.config.wan_entity || !this.config.alarm_entity || !this.config.weather_entity) return;

    // Grab entities
    const wanEntity = hass.states[this.config.wan_entity];
    const alarmEntity = hass.states[this.config.alarm_entity];
    const weatherEntity = hass.states[this.config.weather_entity];

    const wanState = wanEntity ? wanEntity.state : 'unknown';
    const alarmState = alarmEntity ? alarmEntity.state : 'unknown';
    const weatherState = weatherEntity ? weatherEntity.state.toLowerCase() : 'unknown';
    
    const isWanActive = wanState === 'on' || wanState === 'connected'; 
    const isOffState = alarmState === 'disarmed';
    const isHomeState = alarmState === 'armed_home';

    // CUSTOM NIGHT MODE LOGIC
    const currentHour = new Date().getHours();
    const nightStart = parseInt(this.config.night_start) || 22;
    const nightEnd = parseInt(this.config.night_end) || 6;
    let isNightMode = false;
    
    // Account for wrapping around midnight (e.g., 22 to 6 vs 1 to 5)
    if (nightStart > nightEnd) {
      isNightMode = currentHour >= nightStart || currentHour < nightEnd;
    } else {
      isNightMode = currentHour >= nightStart && currentHour < nightEnd;
    }

    // Weather Triggers
    const isRaining = ['rainy', 'pouring', 'lightning-rainy'].includes(weatherState);
    const isSnowing = ['snowy', 'snowy-rainy', 'hail'].includes(weatherState);
    const temp = weatherEntity && weatherEntity.attributes ? parseFloat(weatherEntity.attributes.temperature) : null;
    const isHot = temp !== null && temp > 90;
    const isCold = temp !== null && temp < 40;
    const showWinter = isSnowing || isCold;

    const statusKey = `${wanState}-${alarmState}-${isNightMode}-${isRaining}-${isHot}-${showWinter}`;
    if (this._lastStatus === statusKey) return; 
    this._lastStatus = statusKey;

    // CUSTOMIZABLE QUOTES (Falls back to default if user left it blank)
    const msgWanOffline = this.config.quote_offline || "Moglie is stranded. The WAN connection has been lost!";
    const msgCold = this.config.quote_cold || "Brrr! It's freezing out there!";
    const msgRain = this.config.quote_rain || "Looks like rain, grabbing my coat!";
    const msgHot = this.config.quote_hot || "It's boiling! Need a banana smoothie.";
    const msgNight = this.config.quote_night || "Zzz... Moglie is sleeping...";
    const msgDisarmed = this.config.quote_disarmed || "System's off! The rest of the primates ditched their post for a banana run. Typical.";
    const msgArmedHome = this.config.quote_armed_home || "Welcome Home! The WAN is strong. Tell me you brought more bananas!";
    const msgArmedAway = this.config.quote_armed_away || "The rest of the primates are on patrol. I'll watch the trees until they get back!";

    this.content.className = "text-box";
    this.image.className = "";
    this.image.style.filter = "none"; 

    // THE MASTER PRIORITY LIST
    if (!isWanActive) {
      this.image.src = normal_monkey;
      this.content.innerHTML = msgWanOffline;
      this.content.className = "text-box status-warning";
      this.image.style.filter = "grayscale(100%)";
      this.container.style.border = "2px solid var(--disabled-text-color, gray)"; 
    } else if (showWinter) {
      this.image.src = winter_monkey;
      this.content.innerHTML = msgCold; 
      this.container.style.border = "2px solid #00BCD4"; 
    } else if (isRaining) {
      this.image.src = rainy_monkey;
      this.content.innerHTML = msgRain;
      this.container.style.border = "2px solid #2196F3";
    } else if (isHot) {
      this.image.src = sunny_monkey;
      this.content.innerHTML = msgHot;
      this.container.style.border = "2px solid #FF9800";
    } else if (isNightMode) {
      this.image.src = sleepy_monkey;
      this.content.innerHTML = msgNight;
      this.container.style.border = "2px solid #673AB7";
    } else if (isOffState) {
      this.image.src = normal_monkey;
      this.content.innerHTML = msgDisarmed;
      this.container.style.border = "2px solid var(--warning-color, orange)"; 
    } else if (isHomeState) {
      this.image.src = normal_monkey;
      this.content.innerHTML = msgArmedHome;
      this.container.style.border = "2px solid var(--success-color, green)"; 
    } else {
      this.image.src = normal_monkey;
      this.content.innerHTML = msgArmedAway;
      this.container.style.border = "2px solid var(--error-color, red)"; 
    }
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
    // Pass the hass object down to the entity pickers so they can load dropdowns
    this.querySelectorAll('ha-entity-picker').forEach(picker => picker.hass = hass);
  }

  render() {
    this.innerHTML = `
      <div style="display: flex; flex-direction: column; gap: 16px;">
        
        <div>
          <h3>Entities</h3>
          <ha-entity-picker id="wan_entity" label="WAN / Network Entity (Sensor)" allow-custom-entity></ha-entity-picker>
          <ha-entity-picker id="alarm_entity" label="Alarm Control Panel Entity" include-domains="['alarm_control_panel']" allow-custom-entity></ha-entity-picker>
          <ha-entity-picker id="weather_entity" label="Weather Entity" include-domains="['weather']" allow-custom-entity></ha-entity-picker>
        </div>

        <div>
          <h3>Night Mode Schedule (24h format)</h3>
          <div style="display: flex; gap: 10px;">
            <ha-textfield id="night_start" label="Start Hour (e.g. 22 for 10 PM)" type="number" style="flex: 1;"></ha-textfield>
            <ha-textfield id="night_end" label="End Hour (e.g. 6 for 6 AM)" type="number" style="flex: 1;"></ha-textfield>
          </div>
        </div>

        <div>
          <h3>Custom Quotes (Leave blank for default)</h3>
          <ha-textfield id="quote_offline" label="WAN Offline Quote" style="width: 100%; margin-bottom: 8px;"></ha-textfield>
          <ha-textfield id="quote_disarmed" label="Disarmed Quote" style="width: 100%; margin-bottom: 8px;"></ha-textfield>
          <ha-textfield id="quote_armed_home" label="Armed Home Quote" style="width: 100%; margin-bottom: 8px;"></ha-textfield>
          <ha-textfield id="quote_armed_away" label="Armed Away Quote" style="width: 100%; margin-bottom: 8px;"></ha-textfield>
          <ha-textfield id="quote_night" label="Night Mode Quote" style="width: 100%; margin-bottom: 8px;"></ha-textfield>
        </div>

      </div>
    `;

    // Helper function to bind the UI inputs to the YAML config
    const bindInput = (id) => {
      const el = this.querySelector(`#${id}`);
      if (el) {
        el.value = this._config[id] !== undefined ? this._config[id] : '';
        el.addEventListener('value-changed', (e) => this.updateConfig(id, e.detail.value)); // For entity-pickers
        el.addEventListener('input', (e) => this.updateConfig(id, e.target.value));         // For textfields
      }
    };

    ['wan_entity', 'alarm_entity', 'weather_entity', 'night_start', 'night_end', 
     'quote_offline', 'quote_disarmed', 'quote_armed_home', 'quote_armed_away', 'quote_night'
    ].forEach(bindInput);
  }

  // Fires an event telling Home Assistant to save the updated YAML
  updateConfig(key, value) {
    if (!this._config || this._config[key] === value) return;
    const newConfig = { ...this._config, [key]: value };
    const event = new CustomEvent("config-changed", {
      detail: { config: newConfig },
      bubbles: true,
      composed: true,
    });
    this.dispatchEvent(event);
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
