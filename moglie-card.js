// 1. Identify States & Attributes
    const wanState = wanEntity.state;
    const alarmState = alarmEntity.state;
    const weatherState = weatherEntity ? weatherEntity.state.toLowerCase() : 'unknown';
    
    // 2. Weather Triggers (Expanded for 2026 HA states)
    const isRaining = ['rainy', 'pouring', 'lightning-rainy'].includes(weatherState);
    const isSnowing = ['snowy', 'snowy-rainy', 'hail'].includes(weatherState);
    
    const temp = weatherEntity && weatherEntity.attributes ? parseFloat(weatherEntity.attributes.temperature) : null;
    const isHot = temp !== null && temp > 90;
    const isCold = temp !== null && temp < 40;
    
    // Winter Priority Logic
    const showWinter = isSnowing || isCold;

    // 3. Status Key (Keep this to prevent flickering)
    const statusKey = `${wanState}-${alarmState}-${isNightMode}-${isRaining}-${isHot}-${showWinter}`;
    if (this._lastStatus === statusKey) return; 
    this._lastStatus = statusKey;

    // 4. THE MASTER PRIORITY LIST (WAN > WINTER > RAIN > HOT > NIGHT > ALARM)
    // This order ensures he never says the banana line while wearing a parka.
    
    this.content.className = "text-box";
    this.image.className = "";

    if (!isWanActive) {
      this.image.src = normal_monkey;
      this.content.innerHTML = msgWanOffline;
      this.content.className = "text-box status-warning";
      this.image.className = "status-grayscale";
      this.container.style.border = "2px solid var(--disabled-text-color)"; 

    } else if (showWinter) {
      this.image.src = winter_monkey;
      this.content.innerHTML = msgCold; // Forces the Cocoa quote!
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
