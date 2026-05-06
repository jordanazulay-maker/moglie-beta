// 1. Import your base64 images from your other files
import { normal_monkey } from './normal-monkey.js';
import { winter_monkey } from './winter-monkey.js';
import { rainy_monkey } from './rainy-monkey.js';
import { sunny_monkey } from './sunny-monkey.js';
import { sleepy_monkey } from './sleepy-monkey.js';

class MoglieCard extends HTMLElement {
  
  // This provides the default YAML when adding the card from the UI picker
  static getStubConfig() {
    return {
      wan_entity: "binary_sensor.wan_status",
      alarm_entity: "alarm_control_panel.home_alarm",
      weather_entity: "weather.home"
    };
  }

  // This runs when the card is added to the dashboard
  setConfig(config) {
    this.config = config;

    // Create the basic HTML structure if it doesn't exist
    if (!this.content) {
      this.innerHTML = `
        <ha-card>
          <div id="moglie-container" style="padding: 16px; border-radius: 10px; text-align: center; transition: all 0.3s ease;">
            <img id="moglie-image" src="${normal_monkey}" width="150" style="transition: all 0.3s ease;" />
            <div id="moglie-text" class="text-box" style="margin-top: 10px; font-weight: bold; min-height: 2em;"></div>
          </div>
        </ha-card>
      `;
      this.container = this.querySelector('#moglie-container');
      this.image = this.querySelector('#moglie-image');
      this.content = this.querySelector('#moglie-text');
    }

    // Friendly warning instead of throwing an error (which breaks the card picker)
    if (!config.wan_entity || !config.alarm_entity || !config.weather_entity) {
      this.content.innerHTML = "⚠️ Please define wan_entity, alarm_entity, and weather_entity in the YAML config.";
      this.container.style.border = "2px dashed red";
    }
  }

  // This runs EVERY time a state changes in Home Assistant
  set hass(hass) {
    if (!this.config || !this.config.wan_entity || !this.config.alarm_entity || !this.config.weather_entity) {
      return; // Stop execution if config is incomplete
    }

    // Grab the entities based on the user's config
    const wanEntity = hass.states[this.config.wan_entity];
    const alarmEntity = hass.states[this.config.alarm_entity];
    const weatherEntity = hass.states[this.config.weather_entity];

    // Identify States & Attributes Safely
    const wanState = wanEntity ? wanEntity.state : 'unknown';
    const alarmState = alarmEntity ? alarmEntity.state : 'unknown';
    const weatherState = weatherEntity ? weatherEntity.state.toLowerCase() : 'unknown';
    
    // Define the boolean variables used in logic
    const isWanActive = wanState === 'on' || wanState === 'connected'; 
    const isOffState = alarmState === 'disarmed';
    const isHomeState = alarmState === 'armed_home';

    // Night Mode logic (10 PM - 6 AM time-based)
    const currentHour = new Date().getHours();
    const isNightMode = currentHour >= 22 || currentHour <= 6; 

    // Weather Triggers
    const isRaining = ['rainy', 'pouring', 'lightning-rainy'].includes(weatherState);
    const isSnowing = ['snowy', 'snowy-rainy', 'hail'].includes(weatherState);
    
    const temp = weatherEntity && weatherEntity.attributes ? parseFloat(weatherEntity.attributes.temperature) : null;
    const isHot = temp !== null && temp > 90;
    const isCold = temp !== null && temp < 40;
    
    // Winter Priority Logic
    const showWinter = isSnowing || isCold;

    // Status Key (Keep this to prevent flickering)
    const statusKey = `${wanState}-${alarmState}-${isNightMode}-${isRaining}-${isHot}-${showWinter}`;
    if (this._lastStatus === statusKey) return; 
    this._lastStatus = statusKey;

    // Define the Moglie messages matching your README
    const msgWanOffline = "Moglie is stranded. The WAN connection has been lost!";
    const msgCold = "Brrr! It's freezing out there!";
    const msgRain = "Looks like rain, grabbing my coat!";
    const msgHot = "It's boiling! Need a banana smoothie.";
    const msgNight = "Zzz... Moglie is sleeping...";
    const msgDisarmed = "System's off! The rest of the primates ditched their post for a banana run. Typical.";
    const msgArmedHome = "Welcome Home! The WAN is strong. Tell me you brought more bananas!";
    const msgArmedAway = "The rest of the primates are on patrol. I'll watch the trees until they get back!";

    // Reset classes and styles on each update
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

  getCardSize() {
    return 3;
  }
}

customElements.define('moglie-card', MoglieCard);

window.customCards = window.customCards || [];
window.customCards.push({
  type: "moglie-card",
  name: "Moglie HA Beta",
  description: "Moglie monitors your WAN status and security state.",
  preview: true,
  documentationURL: "https://github.com/jordanazulay-maker/moglie-ha"
});
