<template>
  <div class="simple-timer" :style="containerStyles" v-bind="$attrs">
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
  inheritAttrs: false,
  emits: ['trigger-event'],
  props: {
    uid: { type: String, required: true },
    content: {
      type: Object,
      default: () => ({
        use_api: false,
        user_id: 297,
        endpoint_toggle: 'https://xv05-su7k-rvc8.f2.xano.io/api:if8X12tw/toggle',
        endpoint_active: 'https://xv05-su7k-rvc8.f2.xano.io/api:if8X12tw/active',
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
      pollingInterval: null,
      currentSeconds: 0,
      isRunning: false,
      startTime: null,
      timeEntryId: null
    };
  },
  mounted() {
    console.log('=== COMPONENT MOUNTED ===');
    console.log('use_api:', this.content.use_api);
    console.log('user_id:', this.content.user_id);
    console.log('endpoint_active:', this.content.endpoint_active);
    console.log('endpoint_toggle:', this.content.endpoint_toggle);

    // Initialize WeWeb variables first
    this.setUserIdVar(this.content.user_id || 297);

    // Use nextTick to ensure component is fully initialized
    this.$nextTick(async () => {
      console.log('=== CHECKING FOR ACTIVE TIMER ===');

      // ALWAYS check API first if enabled
      if (this.content.use_api && this.content.endpoint_active) {
        console.log('API is enabled, checking for active timer...');
        const hasActiveTimer = await this.checkActiveTimer();
        console.log('Has active timer:', hasActiveTimer);

        if (!hasActiveTimer) {
          console.log('No active timer from API, checking localStorage as fallback...');
          this.restoreTimerState();
        }
      } else {
        console.log('API not enabled, using localStorage only');
        this.restoreTimerState();
      }

      // Update WeWeb variables after restore
      this.setCurrentTimeVar(this.currentSeconds);
      this.setIsRunningVar(this.isRunning);

      console.log('=== MOUNT COMPLETE ===');
      console.log('isRunning:', this.isRunning);
      console.log('currentSeconds:', this.currentSeconds);
      console.log('timeEntryId:', this.timeEntryId);
    });

    // Add visibility change listener for auto-sync when tab becomes visible
    this.setupVisibilityListener();

    // Add window focus listener for auto-sync when window gains focus
    this.setupFocusListener();

    // Start polling if API is enabled (check every 30 seconds)
    if (this.content.use_api && this.content.endpoint_active) {
      this.startPolling();
    }
  },
  watch: {
    'content.user_id': {
      async handler(newVal, oldVal) {
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

          // Load new user's timer state (check API first if enabled)
          if (this.content.use_api) {
            await this.checkActiveTimer();
          } else {
            this.restoreTimerState();
          }
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

    // Clean up polling interval
    if (this.pollingInterval) {
      clearInterval(this.pollingInterval);
      this.pollingInterval = null;
    }

    // Clean up event listeners
    document.removeEventListener('visibilitychange', this.handleVisibilityChange);
    window.removeEventListener('focus', this.handleWindowFocus);
  },
  methods: {
    async toggleTimer() {
      if (this.isRunning) {
        this.stopTimer();
      } else {
        // Check for active timer before starting
        if (this.content.use_api && this.content.endpoint_active) {
          console.log('Checking for active timer before start...');
          const hasActiveTimer = await this.checkActiveTimer();
          if (hasActiveTimer) {
            console.log('Active timer found and restored, not starting new timer');
            // Update WeWeb variables after restore
            this.setCurrentTimeVar(this.currentSeconds);
            this.setIsRunningVar(this.isRunning);
            return; // Don't start a new timer, just continue the existing one
          }
        }
        console.log('No active timer found, starting new timer');
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
          const startPayload = {
            user_id: Number(this.content.user_id) || 297,
            clock_in: startTimestamp
          };
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

          // Send user_id and clock_out timestamp
          const stopPayload = {
            user_id: Number(this.content.user_id) || 297,
            clock_out: stopTimestamp
          };
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
      const userId = this.content.user_id || 297;
      console.log('Restoring timer state for user:', userId);

      const savedState = localStorage.getItem(this.storageKey);
      if (!savedState) {
        console.log('No saved timer state found for key:', this.storageKey);
        return;
      }

      try {
        const state = JSON.parse(savedState);
        console.log('Loaded timer state:', state);

        if (state.isRunning && state.startTime) {
          // Restore timer state
          this.isRunning = state.isRunning;
          this.startTime = state.startTime;
          this.timeEntryId = state.timeEntryId;

          // Calculate elapsed time
          const elapsed = Math.floor((Date.now() - this.startTime) / 1000);
          this.currentSeconds = elapsed;

          console.log('Timer restored - elapsed seconds:', elapsed, 'isRunning:', this.isRunning);

          // Restart interval
          this.startInterval();

          console.log('Timer interval started successfully');
        } else {
          console.log('Timer was not running, state:', state);
        }
      } catch (error) {
        console.error('Failed to restore timer state:', error);
        this.clearTimerState();
      }
    },

    async checkActiveTimer() {
      if (!this.content.use_api || !this.content.endpoint_active) {
        console.log('API not enabled or endpoint_active not configured');
        return false;
      }

      try {
        // Ensure user_id is a number
        const userId = Number(this.content.user_id) || 297;
        console.log('Checking for active timer via API for user:', userId);

        // Try with query parameter instead of POST body
        const url = `${this.content.endpoint_active}?user_id=${userId}`;
        console.log('Calling active timer API with GET:', url);

        const response = await fetch(url, {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json'
          }
        });

        console.log('Response status:', response.status, response.statusText);

        if (!response.ok) {
          console.error('Active timer API returned error:', response.status);
          return false;
        }

        const data = await response.json();
        console.log('Active timer API response:', data);

        // Check if there's an active timer using new timer_status API
        // API returns: { timer_active: bool, id: number|null, start_time: timestamp|null, status: string }
        if (data && data.timer_active === true && data.id && data.start_time) {
          console.log('Active timer found:', data);

          // Sync local state with API response
          this.isRunning = true;
          this.startTime = data.start_time; // Already a timestamp in milliseconds
          this.timeEntryId = data.id;

          // Calculate elapsed time
          const elapsed = Math.floor((Date.now() - this.startTime) / 1000);
          this.currentSeconds = elapsed;

          console.log('Synced with active timer - ID:', this.timeEntryId, 'elapsed:', elapsed);

          // Start the interval to keep timer ticking
          this.startInterval();

          // Save state to localStorage
          this.saveTimerState();

          return true;
        }

        console.log('No active timer found - status:', data?.status || 'unknown');

        // Clear local state if no active timer exists
        this.isRunning = false;
        this.currentSeconds = 0;
        this.startTime = null;
        this.timeEntryId = null;
        this.clearTimerState();

        return false;
      } catch (error) {
        console.error('Failed to check active timer:', error);
        console.error('Error details:', error.message);
        // Don't fall back to localStorage - if API fails, show clean state
        return false;
      }
    },

    // Auto-sync methods for cross-device synchronization
    setupVisibilityListener() {
      this.handleVisibilityChange = async () => {
        if (!document.hidden && this.content.use_api && this.content.endpoint_active) {
          console.log('Tab became visible, checking for timer updates...');
          await this.checkActiveTimer();
          this.setCurrentTimeVar(this.currentSeconds);
          this.setIsRunningVar(this.isRunning);
        }
      };

      document.addEventListener('visibilitychange', this.handleVisibilityChange);
    },

    setupFocusListener() {
      this.handleWindowFocus = async () => {
        if (this.content.use_api && this.content.endpoint_active) {
          console.log('Window gained focus, checking for timer updates...');
          await this.checkActiveTimer();
          this.setCurrentTimeVar(this.currentSeconds);
          this.setIsRunningVar(this.isRunning);
        }
      };

      window.addEventListener('focus', this.handleWindowFocus);
    },

    startPolling() {
      // Poll every 30 seconds to check for timer updates
      this.pollingInterval = setInterval(async () => {
        if (this.content.use_api && this.content.endpoint_active) {
          console.log('Polling: checking for timer updates...');
          await this.checkActiveTimer();
          this.setCurrentTimeVar(this.currentSeconds);
          this.setIsRunningVar(this.isRunning);
        }
      }, 30000); // 30 seconds

      console.log('Polling started - will check for timer updates every 30 seconds');
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
