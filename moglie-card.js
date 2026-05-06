import { normal_monkey } from "./normal-monkey.js";
import { sleepy_monkey } from "./sleepy-monkey.js";
import { rainy_monkey } from "./rainy-monkey.js";
import { sunny_monkey } from "./sunny-monkey.js";
import { winter_monkey } from "./winter-monkey.js";

class MoglieBetaCard extends HTMLElement {
  static getStubConfig() {
    return {
      wan_entity: "",
      alarm_entity: "",
      click_entity: "",
      weather_entity: "",
      night_start: "22:00:00",
      night_end: "06:00:00"
    };
  }

  static getConfigElement() {
    return document.createElement("moglie-beta-card-editor");
  }

  setConfig(config) {
    this.config = config;
  }

  set hass(hass) {
    if (!this.config || !hass) return;
    this._hass = hass; 

    if (!this.content) {
      this.innerHTML = `
        <ha-card>
          <style>
            .moglie-container { padding: 20px; text-align: center; cursor: pointer; transition: all 0.3s ease; border-radius: var(--ha-card-border-radius, 12px); box-sizing: border-box; }
            .moglie-container:hover { background: rgba(var(--rgb-primary-text-color), 0.05); }
            .text-box { line-height: 1.5; margin-bottom: 10px; font-size: 1.1em; min-height: 80px; color: var(--primary-text-color); }
            .img-container img { 
              width: 110px; 
              transition: all 0.5s ease; 
              pointer-events: none; 
              filter: none !important; 
              background: transparent !important; 
              color: unset !important;
            }
            .status-warning { color: var(--error-color); font-weight: bold; }
            .status-config-err { color: var(--warning-color); font-weight: bold; font-size: 0.9em; }
            .status-grayscale { filter: grayscale(100%) opacity(0.6); transform: scale(0.95); }
          </style>
          <div class="moglie-container card-content">
            <div class="text-box"></div>
            <div class="img-container">
              <img alt="Moglie">
            </div>
          </div>
        </ha-card>
      `;
      this.container = this.querySelector(".moglie-container");
      this.content = this.querySelector(".text-box");
      this.image = this.querySelector(".img-container img");

      this.container.addEventListener("click", () => {
        const actionConfig = this.config.tap_action || { action: "more-info" };
        if (actionConfig.action === "none") return;
        const targetEntity = this.config.tap_action?.entity || this.config.click_entity || this.config.wan_entity;
        const event = new CustomEvent("hass-action", {
          detail: { config: { entity: targetEntity, tap_action: actionConfig }, action: "tap" },
          bubbles: true, composed: true,
        });
        this.dispatchEvent(event);
      });
    }

    const wanId = this.config.wan_entity;
    const alarmId = this.config.alarm_entity;
    const weatherId = this.config.weather_entity;

    const showWarning = (message) => {
      this.image.src = normal_monkey; 
      this.image.className = "status-grayscale";
      this.content.innerHTML = message;
      this.content.className = "text-box status-config-err";
      this.container.style.border = "2px dashed var(--warning-color)";
    };

    if (!wanId || !alarmId) {
      showWarning(`Moglie needs more information!<br><span style="font-size:0.8em;">(Configure WAN & Alarm entities)</span>`);
      return;
    }

    const wanEntity = hass.states[wanId];
    const alarmEntity = hass.states[alarmId];
    const weatherEntity = weatherId ? hass.states[weatherId] : null;

    if (!wanEntity || !alarmEntity) {
      showWarning(`Moglie is lost!<br>Check your entity IDs.`);
      return;
    }

    const wanState = wanEntity.state;
    const alarmState = alarmEntity.state;
    const weatherState = weatherEntity ? weatherEntity.state : 'unknown';
    
    const isWanActive = ['on', 'connected', 'home', 'up'].includes(wanState);
    const isHomeState = ['armed_home'].includes(alarmState);
    const isOffState = ['off', 'disarmed'].includes(alarmState);
    
    // Weather Checks
    const isRaining = ['rain', 'pouring', 'lightning-rainy'].includes(weatherState);
    const isSnowing = ['snowy', 'snowy-rainy', 'hail'].includes(weatherState);
    
    const temp = weatherEntity && weatherEntity.attributes ? parseFloat(weatherEntity.attributes.temperature) : null;
    const isHot = temp !== null && temp > 90;
    const isCold = temp !== null && temp < 40;
    const showWinter = isSnowing || isCold;

    let isNightMode = false;
    if (this.config.night_start && this.config.night_end) {
      const now = new Date();
      const timeToMins = (s) => { const p = s.split(':'); return parseInt(p[0]) * 60 + parseInt(p[1]); };
      const curMins = now.getHours() * 60 + now.getMinutes();
      const sMins = timeToMins(this.config.night_start);
      const eMins = timeToMins(this.config.night_end);
      isNightMode = sMins > eMins ? (curMins >= sMins || curMins <= eMins) : (curMins >= sMins && curMins <= eMins);
    }

    const statusKey = `${wanState}-${alarmState}-${isNightMode}-${isRaining}-${isHot}-${showWinter}`;
    if (this._lastStatus === statusKey) return; 
    this._lastStatus = statusKey;

    // Custom Text Pulls
    const msgWanOff = this.config.text_wan_offline || `Moglie is stranded. The WAN connection is lost!`;
    const msgHome = this.config.text_armed_home || `Welcome Home! Tell me you brought more bananas!`;
    const msgOff = this.config.text_disarmed || `System's off! The pack is on a banana run.`;
    const msgAway = this.config.text_armed_away || `I'll watch the trees until they get back!`;
    const msgNight = this.config.text_night || `The pack is sleeping. Why aren't we?`;
    const msgRain = this.config.text_rain || `Glad I have my raincoat for this weather!`;
    const msgHot = this.config.text_hot || `It's sweltering! Pass me an ice cold banana.`;
    const msgCold = this.config.text_cold || `Brrr! I'm wearing my warmest coat. Hot cocoa?`;

    // UNIFIED LOGIC - PRIORITY: WAN > WINTER > RAIN > HOT > NIGHT > ALARM
    this.content.className = "text-box";
    this.image.className = "";

    if (!isWanActive) {
      this.image.src = normal_monkey;
      this.content.innerHTML = msgWanOff;
      this.content.className = "text-box status-warning";
      this.image.className = "status-grayscale";
      this.container.style.border = "2px solid var(--disabled-text-color)"; 
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
      this.content.innerHTML = msgOff;
      this.container.style.border = "2px solid var(--warning-color)"; 
    } else if (isHomeState) {
      this.image.src = normal_monkey;
      this.content.innerHTML = msgHome;
      this.container.style.border = "2px solid var(--success-color)"; 
    } else {
      this.image.src = normal_monkey;
      this.content.innerHTML = msgAway;
      this.container.style.border = "2px solid var(--error-color)"; 
    }
  }
}

customElements.define("moglie-beta-card", MoglieBetaCard);

window.customCards = window.customCards || [];
if (!window.customCards.some(card => card.type === 'moglie-beta-card')) {
  window.customCards.push({
    type: "moglie-beta-card",
    name: "Moglie-Beta",
    description: "Moglie with Rain, Heat, Winter, and Night modes."
  });
}

class MoglieBetaCardEditor extends HTMLElement {
  setConfig(config) { this._config = config; }
  set hass(hass) { this._hass = hass; this.renderForm(); }
  renderForm() {
    if (!this._hass || !this._config) return;
    if (!this.formElement) {
      this.innerHTML = `<ha-form></ha-form>`;
      this.formElement = this.querySelector("ha-form");
      this.formElement.schema = [
        { name: "wan_entity", label: "WAN Status Entity", selector: { entity: {} } },
        { name: "alarm_entity", label: "Alarm Control Panel", selector: { entity: { domain: "alarm_control_panel" } } },
        { name: "weather_entity", label: "Weather Entity", selector: { entity: { domain: "weather" } } },
        { name: "tap_action", label: "Tap Action", selector: { ui_action: {} } },
        { name: "night_start", label: "Night Mode Start", selector: { time: {} } },
        { name: "night_end", label: "Night Mode End", selector: { time: {} } },
        { name: "text_wan_offline", label: "Text: WAN Offline", selector: { text: {} } },
        { name: "text_armed_home", label: "Text: Armed Home", selector: { text: {} } },
        { name: "text_disarmed", label: "Text: Disarmed", selector: { text: {} } },
        { name: "text_armed_away", label: "Text: Armed Away", selector: { text: {} } },
        { name: "text_night", label: "Text: Night Mode", selector: { text: {} } },
        { name: "text_rain", label: "Text: Rain", selector: { text: {} } },
        { name: "text_hot", label: "Text: Heat (>90)", selector: { text: {} } },
        { name: "text_cold", label: "Text: Winter (<40/Snow)", selector: { text: {} } }
      ];
      this.formElement.addEventListener("value-changed", (ev) => {
        const event = new CustomEvent("config-changed", { detail: { config: ev.detail.value }, bubbles: true, composed: true });
        this.dispatchEvent(event);
      });
    }
    this.formElement.hass = this._hass;
    this.formElement.data = this._config;
  }
}
customElements.define("moglie-beta-card-editor", MoglieBetaCardEditor);
