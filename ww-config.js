export default {
    editor: {
        label: {
            en: 'Simple Timer',
            de: 'Einfacher Timer'
        },
        icon: 'clock'
    },
    properties: {
        // API Settings
        use_api: {
            label: { en: 'Use API', de: 'API verwenden' },
            type: 'OnOff',
            defaultValue: false,
            section: 'settings'
        },
        user_id: {
            label: { en: 'User ID', de: 'User ID' },
            type: 'Number',
            defaultValue: 297,
            bindable: true,
            section: 'settings',
            options: {
                placeholder: 'User ID'
            }
        },
        endpoint_toggle: {
            label: { en: 'API Endpoint: Toggle Timer', de: 'API Endpoint: Toggle Timer' },
            type: 'Text',
            defaultValue: 'https://xv05-su7k-rvc8.f2.xano.io/api:if8X12tw/toggle',
            bindable: true,
            section: 'settings',
            options: {
                placeholder: 'Endpoint URL or ID'
            }
        },
        endpoint_active: {
            label: { en: 'API Endpoint: Check Active Timer', de: 'API Endpoint: Aktiven Timer prüfen' },
            type: 'Text',
            defaultValue: 'https://xv05-su7k-rvc8.f2.xano.io/api:if8X12tw/active',
            bindable: true,
            section: 'settings',
            options: {
                placeholder: 'Endpoint URL or ID'
            }
        },

        // Design Settings
        background_color: {
            label: { en: 'Background Color', de: 'Hintergrundfarbe' },
            type: 'Color',
            defaultValue: '#FFFFFF',
            bindable: true,
            section: 'settings'
        },
        text_color: {
            label: { en: 'Text Color', de: 'Textfarbe' },
            type: 'Color',
            defaultValue: '#1F2937',
            bindable: true,
            section: 'settings'
        },
        timer_color: {
            label: { en: 'Timer Color (Running)', de: 'Timer Farbe (läuft)' },
            type: 'Color',
            defaultValue: '#6366f1',
            bindable: true,
            section: 'settings'
        },
        start_button_color: {
            label: { en: 'Start Button Color', de: 'Start Button Farbe' },
            type: 'Color',
            defaultValue: '#10b981',
            bindable: true,
            section: 'settings'
        },
        stop_button_color: {
            label: { en: 'Stop Button Color', de: 'Stop Button Farbe' },
            type: 'Color',
            defaultValue: '#ef4444',
            bindable: true,
            section: 'settings'
        },
        border_radius: {
            label: { en: 'Border Radius', de: 'Border Radius' },
            type: 'Length',
            defaultValue: '12px',
            bindable: true,
            section: 'settings'
        },
        timer_size: {
            label: { en: 'Timer Font Size', de: 'Timer Schriftgröße' },
            type: 'Length',
            defaultValue: '4em',
            bindable: true,
            section: 'settings'
        }
    }
};
