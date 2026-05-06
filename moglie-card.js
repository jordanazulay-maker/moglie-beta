// 1. Import your base64 images from your other files
import { normal_monkey } from './normal-monkey.js';
import { winter_monkey } from './winter-monkey.js';
import { rainy_monkey } from './rainy-monkey.js';
import { sunny_monkey } from './sunny-monkey.js';
import { sleepy_monkey } from './sleepy-monkey.js';

class MoglieCard extends HTMLElement {
  // This runs when the card is added to the dashboard
  setConfig(config) {
    if (!config.wan_entity || !config.alarm_entity || !config.weather_entity) {
      throw new Error("You need to define wan_entity, alarm_entity, and weather_entity in your config");
    }
    this.config = config;

    // Create the basic HTML structure if it doesn't exist
    if (!this.content) {
      this.innerHTML = `
        <ha-card>
          <div id="moglie-container" style="padding: 16px; border-radius: 10px; text-align: center;">
            <img id="moglie-image" src="${normal_monkey}" width="150" />
            <div id="moglie-text" style="margin-top: 10px; font-weight: bold;"></div>
          </div>
        </ha-card>
      `;
      this.container = this.querySelector('#moglie-container');
      this.image = this.querySelector('#moglie-image');
      this.content = this.querySelector('#moglie-text');
    }
  }

  // This runs EVERY time a state changes in Home Assistant
  set hass(hass) {
    if (!this.config) return;

    // Grab the entities based on the user's config
    const wanEntity = hass.states[this.config.wan_entity];
    const alarmEntity = hass.states[this.config.alarm_entity];
    const weatherEntity = hass.states[this.config.weather_entity];

    // Identify States & Attributes Safely
    const wanState = wanEntity ? wanEntity.state : 'unknown';
    const alarmState = alarmEntity ? alarmEntity.state : 'unknown';
    const weatherState = weatherEntity ? weatherEntity.state.toLowerCase() : 'unknown';
    
    const isWanActive = wanState === 'on' || wanState === 'connected'; 
    const isOffState = alarmState === 'disarmed';
    const isHomeState = alarmState === 'armed_home';

    // Define Night Mode logic (e.g., checking current hour)
    const currentHour = new Date().getHours();
    const isNightMode = currentHour >= 22 || currentHour <= 6; // 10 PM to 6 AM

    // Weather Triggers
    const isRaining = ['rainy', 'pouring', 'lightning-rainy'].includes(weatherState);
    const isSnowing = ['snowy', 'snowy-rainy', 'hail'].includes(weatherState);
    
    const temp = weatherEntity && weatherEntity.attributes ? parseFloat(weatherEntity.attributes.temperature) : null;
    const isHot = temp !== null && temp > 90;
    const isCold = temp !== null && temp < 40;
    
    const showWinter = isSnowing || isCold;

    // Status Key (Keep this to prevent flickering)
    const statusKey = `${wanState}-${alarmState}-${isNightMode}-${isRaining}-${isHot}-${showWinter}`;
    if (this._lastStatus === statusKey) return; 
    this._lastStatus = statusKey;

    // Define your messages! (These were missing in your snippet)
    const msgWanOffline = "Moglie is stranded. The WAN connection has been lost!";
    const msgCold = "Brrr! It's freezing out there!";
    const msgRain = "Looks like rain, grabbing my coat!";
    const msgHot = "It's boiling! Need a banana smoothie.";
    const msgNight = "Zzz... Moglie is sleeping...";
    const msgDisarmed = "System's off! The rest of the primates ditched their post.";
    const msgArmedHome = "Welcome Home! The WAN is strong.";
    const msgArmedAway = "The rest of the primates are on patrol.";

    // Apply classes and styles
    this.content.className = "text-box";
    this.image.className = "";

    // THE MASTER PRIORITY LIST
    if (!isWanActive) {
      this.image.src = normal_monkey;
      this.content.innerHTML = msgWanOffline;
      this.image.style.filter = "grayscale(100%)"; // Grayscale CSS
      this.container.style.border = "2px solid gray"; 
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
      this.container.style.border = "2px solid orange"; 
    } else if (isHomeState) {
      this.image.src = normal_monkey;
      this.content.innerHTML = msgArmedHome;
      this.container.style.border = "2px solid green"; 
    } else {
      this.image.src = normal_monkey;
      this.content.innerHTML = msgArmedAway;
      this.container.style.border = "2px solid red"; 
    }
  }

  // Card size hint for lovelace
  getCardSize() {
    return 3;
  }
}

// Register the custom element with Home Assistant
customElements.define('moglie-card', MoglieCard);
