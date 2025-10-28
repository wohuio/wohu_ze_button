<template>
  <div class="simple-timer" :style="containerStyles">
    <div class="timer-display">
      <div :class="['timer', { running: isRunning }]">
        {{ formattedTime }}
      </div>
    </div>

    <div class="controls">
      <button
        @click="toggleTimer"
        :class="['btn', isRunning ? 'btn-stop' : 'btn-start']"
      >
        {{ isRunning ? 'Stop' : 'Start' }}
      </button>
    </div>
  </div>
</template>

<script>
export default {
  name: 'SimpleTimer',
  emits: ['trigger-event'],
  props: {
    uid: { type: String, required: true },
    content: {
      type: Object,
      default: () => ({
        use_api: false,
        user_id: 297,
        endpoint_toggle: 'https://xv05-su7k-rvc8.f2.xano.io/api:6iYtDb6K/toggle',
        background_color: '#FFFFFF',
        text_color: '#1F2937',
        timer_color: '#6366f1',
        start_button_color: '#10b981',
        stop_button_color: '#ef4444',
        border_radius: '12px',
        timer_size: '4em'
      })
    }
  },
  setup(props) {
    // Expose WeWeb variables for formulas
    const { value: currentTimeVar, setValue: setCurrentTimeVar } =
      window.wwLib.wwVariable.useComponentVariable({
        uid: props.uid,
        name: 'currentTime',
        type: 'number',
        defaultValue: 0,
      });

    const { value: userIdVar, setValue: setUserIdVar } =
      window.wwLib.wwVariable.useComponentVariable({
        uid: props.uid,
        name: 'userId',
        type: 'number',
        defaultValue: 297,
      });

    const { value: isRunningVar, setValue: setIsRunningVar} =
      window.wwLib.wwVariable.useComponentVariable({
        uid: props.uid,
        name: 'isRunning',
        type: 'boolean',
        defaultValue: false,
      });

    return {
      currentTimeVar,
      setCurrentTimeVar,
      userIdVar,
      setUserIdVar,
      isRunningVar,
      setIsRunningVar,
    };
  },
  data() {
    return {
      timerInterval: null,
      currentSeconds: 0,
      isRunning: false,
      startTime: null,
      timeEntryId: null
    };
  },
  mounted() {
    this.restoreTimerState();
    // Initialize WeWeb variables
    this.setUserIdVar(this.content.user_id || 297);
    this.setCurrentTimeVar(this.currentSeconds);
    this.setIsRunningVar(this.isRunning);
  },
  watch: {
    'content.user_id': {
      handler(newVal, oldVal) {
        this.setUserIdVar(newVal || 297);

        // When user changes, stop current timer and load new user's state
        if (oldVal !== undefined && newVal !== oldVal) {
          console.log(`User changed from ${oldVal} to ${newVal}, reloading timer state...`);

          // Stop current timer without API call
          this.stopInterval();
          this.isRunning = false;
          this.currentSeconds = 0;
          this.startTime = null;
          this.timeEntryId = null;

          // Load new user's timer state
          this.restoreTimerState();
        }
      },
      immediate: true,
    },
    currentSeconds(newVal) {
      this.setCurrentTimeVar(newVal);
    },
    isRunning(newVal) {
      this.setIsRunningVar(newVal);
    },
  },
  computed: {
    // User-specific storage key
    storageKey() {
      const userId = this.content.user_id || 297;
      return `ww_timer_state_user_${userId}`;
    },
    containerStyles() {
      return {
        '--background-color': this.content.background_color || '#FFFFFF',
        '--text-color': this.content.text_color || '#1F2937',
        '--timer-color': this.content.timer_color || '#6366f1',
        '--start-color': this.content.start_button_color || '#10b981',
        '--stop-color': this.content.stop_button_color || '#ef4444',
        '--border-radius': this.content.border_radius || '12px',
        '--timer-size': this.content.timer_size || '4em'
      };
    },
    formattedTime() {
      return this.formatDuration(this.currentSeconds);
    }
  },
  beforeUnmount() {
    this.stopInterval();
  },
  methods: {
    toggleTimer() {
      if (this.isRunning) {
        this.stopTimer();
      } else {
        this.startTimer();
      }
    },

    async startTimer() {
      this.currentSeconds = 0;
      this.isRunning = true;
      this.startTime = Date.now();
      this.startInterval();

      const startTimestamp = new Date().toISOString();

      // Call API if enabled
      if (this.content.use_api && this.content.endpoint_toggle) {
        try {
          console.log('Starting timer with endpoint:', this.content.endpoint_toggle);
          const startPayload = { user_id: this.content.user_id };
          console.log('Sending data:', JSON.stringify(startPayload));

          const response = await this.callAPI(this.content.endpoint_toggle, startPayload, 'POST');

          console.log('API response:', response);

          // Store the ID from response if available
          if (response && response.id) {
            this.timeEntryId = response.id;
            console.log('Time entry ID stored:', this.timeEntryId);
          }

          // Emit refresh event for WeWeb to reload collections
          this.$emit('trigger-event', {
            name: 'refresh_collection',
            event: {
              action: 'timer_started',
              timestamp: startTimestamp
            }
          });
        } catch (error) {
          console.error('Failed to call toggle API (start):', error);
          console.error('Error details:', error.message);
          // Continue with local timer even if API fails
        }
      }

      // Save state to localStorage
      this.saveTimerState();

      this.$emit('trigger-event', {
        name: 'timer_started',
        event: {
          startTime: this.startTime,
          timestamp: startTimestamp,
          timeEntryId: this.timeEntryId
        }
      });
    },

    async stopTimer() {
      const endTime = Date.now();
      const duration = this.currentSeconds;
      const stopTimestamp = new Date().toISOString();

      this.stopInterval();
      this.isRunning = false;

      // Call API if enabled
      if (this.content.use_api && this.content.endpoint_toggle) {
        try {
          console.log('Stopping timer with endpoint:', this.content.endpoint_toggle);

          // Send only user_id - let API determine which timer to stop
          const stopPayload = { user_id: this.content.user_id };
          console.log('Sending data:', JSON.stringify(stopPayload));

          const stopResponse = await this.callAPI(this.content.endpoint_toggle, stopPayload, 'POST');
          console.log('Stop API response:', stopResponse);

          // Emit refresh event for WeWeb to reload collections
          this.$emit('trigger-event', {
            name: 'refresh_collection',
            event: {
              action: 'timer_stopped',
              timestamp: stopTimestamp
            }
          });
        } catch (error) {
          console.error('Failed to call toggle API (stop):', error);
          console.error('Error details:', error.message);
        }
      }

      this.$emit('trigger-event', {
        name: 'timer_stopped',
        event: {
          startTime: this.startTime,
          endTime: endTime,
          duration: duration,
          formattedDuration: this.formattedTime,
          timestamp: stopTimestamp,
          timeEntryId: this.timeEntryId
        }
      });

      // Clear state
      this.currentSeconds = 0;
      this.startTime = null;
      this.timeEntryId = null;

      // Clear localStorage
      this.clearTimerState();
    },

    startInterval() {
      this.timerInterval = setInterval(() => {
        this.currentSeconds++;

        // Save state every tick to keep localStorage in sync
        this.saveTimerState();

        // Emit tick event every second
        this.$emit('trigger-event', {
          name: 'timer_tick',
          event: {
            currentSeconds: this.currentSeconds,
            formattedTime: this.formattedTime
          }
        });
      }, 1000);
    },

    stopInterval() {
      if (this.timerInterval) {
        clearInterval(this.timerInterval);
        this.timerInterval = null;
      }
    },

    formatDuration(seconds) {
      const h = Math.floor(seconds / 3600);
      const m = Math.floor((seconds % 3600) / 60);
      const s = seconds % 60;
      return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
    },

    async callAPI(endpoint, data, method = 'POST') {
      if (!endpoint) return;

      // Determine if endpoint is a full URL or WeWeb endpoint ID
      const url = endpoint.startsWith('http://') || endpoint.startsWith('https://')
        ? endpoint
        : `/_ww/endpoints/${endpoint}`;

      console.log('Making API call to:', url);
      console.log('Method:', method);
      console.log('Body:', JSON.stringify(data));

      const response = await fetch(url, {
        method: method,
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(data)
      });

      console.log('Response status:', response.status, response.statusText);

      if (!response.ok) {
        // Try to get error details from response
        let errorDetails = '';
        try {
          const errorBody = await response.text();
          errorDetails = errorBody;
          console.log('Error response body:', errorBody);
        } catch (e) {
          console.log('Could not parse error response');
        }
        throw new Error(`API call failed: ${response.status} ${response.statusText}. Details: ${errorDetails}`);
      }

      return await response.json();
    },

    saveTimerState() {
      const state = {
        isRunning: this.isRunning,
        startTime: this.startTime,
        timeEntryId: this.timeEntryId
      };
      localStorage.setItem(this.storageKey, JSON.stringify(state));
    },

    clearTimerState() {
      localStorage.removeItem(this.storageKey);
    },

    restoreTimerState() {
      const savedState = localStorage.getItem(this.storageKey);
      if (!savedState) return;

      try {
        const state = JSON.parse(savedState);

        if (state.isRunning && state.startTime) {
          // Restore timer state
          this.isRunning = state.isRunning;
          this.startTime = state.startTime;
          this.timeEntryId = state.timeEntryId;

          // Calculate elapsed time
          const elapsed = Math.floor((Date.now() - this.startTime) / 1000);
          this.currentSeconds = elapsed;

          // Restart interval
          this.startInterval();

          console.log('Timer restored:', { elapsed, timeEntryId: this.timeEntryId });
        }
      } catch (error) {
        console.error('Failed to restore timer state:', error);
        this.clearTimerState();
      }
    }
  }
};
</script>

<style scoped>
.simple-timer {
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
  background: var(--background-color, #FFFFFF);
  color: var(--text-color, #1F2937);
  padding: 40px;
  border-radius: var(--border-radius, 12px);
  text-align: center;
  min-height: 300px;
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  gap: 30px;
}

.timer-display {
  width: 100%;
}

.timer {
  font-size: var(--timer-size, 4em);
  font-weight: 800;
  font-family: 'Courier New', monospace;
  color: var(--text-color, #1F2937);
  letter-spacing: 0.05em;
  transition: all 0.3s;
}

.timer.running {
  color: var(--timer-color, #6366f1);
  animation: pulse 2s infinite;
}

@keyframes pulse {
  0%, 100% {
    opacity: 1;
    transform: scale(1);
  }
  50% {
    opacity: 0.8;
    transform: scale(1.02);
  }
}

.controls {
  display: flex;
  gap: 15px;
  justify-content: center;
}

.btn {
  padding: 16px 48px;
  font-size: 20px;
  font-weight: 700;
  border: none;
  border-radius: var(--border-radius, 12px);
  cursor: pointer;
  transition: all 0.3s;
  color: white;
  text-transform: uppercase;
  letter-spacing: 1px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
}

.btn:hover {
  transform: translateY(-3px);
  box-shadow: 0 8px 20px rgba(0, 0, 0, 0.2);
}

.btn:active {
  transform: translateY(-1px);
}

.btn-start {
  background: var(--start-color, #10b981);
}

.btn-start:hover {
  filter: brightness(1.1);
}

.btn-stop {
  background: var(--stop-color, #ef4444);
}

.btn-stop:hover {
  filter: brightness(1.1);
}

/* Responsive */
@media (max-width: 768px) {
  .simple-timer {
    padding: 30px 20px;
    min-height: 250px;
  }

  .timer {
    font-size: calc(var(--timer-size, 4em) * 0.7);
  }

  .controls {
    flex-direction: column;
    width: 100%;
  }

  .btn {
    width: 100%;
    padding: 14px 32px;
    font-size: 18px;
  }
}

@media (max-width: 480px) {
  .timer {
    font-size: calc(var(--timer-size, 4em) * 0.5);
  }

  .btn {
    font-size: 16px;
  }
}
</style>
