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
      showWarning(`Moglie needs more information to do his job!<br>The primates get antsy when I have nothing to say.<br><span style="font-size:0.8em; color:var(--secondary-text-color);">(Configure WAN & Alarm entities)</span>`);
      return;
    }

    const wanEntity = hass.states[wanId];
    const alarmEntity = hass.states[alarmId];
    const weatherEntity = weatherId ? hass.states[weatherId] : null;

    if (!wanEntity) {
      showWarning(`Moglie needs more information!<br>I can't find the WAN entity:<br><span style="font-family:monospace;">${wanId}</span>`);
      return;
    }
    if (!alarmEntity) {
      showWarning(`Moglie needs more information!<br>I can't find the Alarm entity:<br><span style="font-family:monospace;">${alarmId}</span>`);
      return;
    }

    const wanState = wanEntity.state;
    const alarmState = alarmEntity.state;
    const weatherState = weatherEntity ? weatherEntity.state : 'unknown';
    
    const isWanActive = ['on', 'connected', 'home', 'up'].includes(wanState);
    const isHomeState = ['armed_home'].includes(alarmState);
    const isOffState = ['off', 'disarmed'].includes(alarmState);
    
    const isRaining = ['rain', 'pouring', 'lightning-rainy', 'snowy-rainy'].includes(weatherState);
    const isSnowing = ['snowy', 'snowy-heavy'].includes(weatherState);
    
    const temperature = weatherEntity && weatherEntity.attributes ? weatherEntity.attributes.temperature : null;
    const isHot = temperature !== null && parseFloat(temperature) > 90;
    const isCold = temperature !== null && parseFloat(temperature) < 40; 
    
    const showWinter = isSnowing || isCold;

    let isNightMode = false;
    
    if (this.config.night_start && this.config.night_end) {
      const startStr = this.config.night_start;
      const endStr = this.config.night_end;
      const now = new Date();
      
      const timeToMinutes = (timeString) => {
        const parts = timeString.split(':');
        return parseInt(parts[0] || 0, 10) * 60 + parseInt(parts[1] || 0, 10);
      };

      const currentMins = now.getHours() * 60 + now.getMinutes();
      const startMins = timeToMinutes(startStr);
      const endMins = timeToMinutes(endStr);

      if (startMins > endMins) {
        isNightMode = currentMins >= startMins || currentMins <= endMins;
      } else {
        isNightMode = currentMins >= startMins && currentMins <= endMins;
      }
    }

    const statusKey = `${wanState}-${alarmState}-${isNightMode}-${isRaining}-${isHot}-${showWinter}`;
    if (this._lastStatus === statusKey) return; 
    this._lastStatus = statusKey;

    const msgWanOffline = this.config.text_wan_offline || `Moglie is stranded.<br>The WAN connection<br>has been lost!`;
    const msgArmedHome = this.config.text_armed_home || `Welcome Home!<br>The WAN is strong.<br>Tell me you brought<br>more bananas!`;
    const msgDisarmed = this.config.text_disarmed || `System's off! The rest of the<br>primates ditched their post<br>for a banana run. Typical.`;
    const msgArmedAway = this.config.text_armed_away || `The rest of the primates are<br>on patrol. I'll watch the trees<br>until they get back!`;
    const msgNight = this.config.text_night || `The rest of the pack is sleeping.<br>Why aren't we?`;
    const msgRain = this.config.text_rain || `The rest of the primates are<br>on patrol in the rain. Glad<br>I have my raincoat!`;
    const msgHot = this.config.text_hot || `It's sweltering out there!<br>I'm melting.<br>Pass me an ice cold banana.`;
    const msgCold = this.config.text_cold || `Brrr... it's freezing out here!<br>I'm wearing my warmest coat.<br>Bring me some hot cocoa!`;

    // --- UNIFIED VISUAL & TEXT LOGIC ---
    // Everything is handled together to prevent desyncing
    this.content.className = "text-box";
    this.image.className = "";

    if (!isWanActive) {
      this.image.src = normal_monkey;
      this.content.innerHTML = msgWanOffline;
      this.content.className = "text-box status-warning";
      this.image.className = "status-grayscale";
      this.container.style.border = "2px solid var(--disabled-text-color)"; 

    } else if (isRaining) {
      this.image.src = rainy_monkey;
      this.content.innerHTML = msgRain;
      this.container.style.border = "2px solid var(--info-color, #2196F3)"; // Blue border for weather

    } else if (showWinter) {
      this.image.src = winter_monkey;
      this.content.innerHTML = msgCold;
      this.container.style.border = "2px solid var(--info-color, #00BCD4)"; // Cyan border for winter

    } else if (isHot) {
      this.image.src = sunny_monkey;
      this.content.innerHTML = msgHot;
      this.container.style.border = "2px solid var(--warning-color, #FF9800)"; // Orange border for heat

    } else if (isNightMode) {
      this.image.src = sleepy_monkey;
      this.content.innerHTML = msgNight;
      this.container.style.border = "2px solid #673AB7"; // Purple border for night

    } else if (isOffState) {
      this.image.src = normal_monkey;
      this.content.innerHTML = msgDisarmed;
      this.container.style.border = "2px solid var(--warning-color)"; 

    } else if (isHomeState) {
      this.image.src = normal_monkey;
      this.content.innerHTML = msgArmedHome;
      this.container.style.border = "2px solid var(--success-color)"; 

    } else {
      this.image.src = normal_monkey;
      this.content.innerHTML = msgArmedAway;
      this.container.style.border = "2px solid var(--error-color)"; 
    }
  }
}
