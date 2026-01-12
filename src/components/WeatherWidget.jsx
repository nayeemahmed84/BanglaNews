import React, { useState, useEffect } from 'react';
import { Cloud, Sun, CloudRain, CloudSnow, CloudLightning, Wind } from 'lucide-react';
import './WeatherWidget.css';

const WEATHER_CODES = {
    0: { icon: Sun, label: 'পরিষ্কার' },
    1: { icon: Sun, label: 'আংশিক মেঘলা' },
    2: { icon: Cloud, label: 'মেঘলা' },
    3: { icon: Cloud, label: 'আকাশ ঢাকা' },
    45: { icon: Cloud, label: 'কুয়াশা' },
    48: { icon: Cloud, label: 'কুয়াশা' },
    51: { icon: CloudRain, label: 'হালকা বৃষ্টি' },
    53: { icon: CloudRain, label: 'বৃষ্টি' },
    55: { icon: CloudRain, label: 'ভারী বৃষ্টি' },
    61: { icon: CloudRain, label: 'বৃষ্টি' },
    63: { icon: CloudRain, label: 'বৃষ্টি' },
    65: { icon: CloudRain, label: 'ভারী বৃষ্টি' },
    71: { icon: CloudSnow, label: 'তুষারপাত' },
    73: { icon: CloudSnow, label: 'তুষারপাত' },
    75: { icon: CloudSnow, label: 'ভারী তুষারপাত' },
    95: { icon: CloudLightning, label: 'বজ্রপাত' },
    96: { icon: CloudLightning, label: 'বজ্রসহ বৃষ্টি' },
    99: { icon: CloudLightning, label: 'ভারী বজ্রবৃষ্টি' },
};

const WeatherWidget = () => {
    const [weather, setWeather] = useState(null);
    const [locationName, setLocationName] = useState('ঢাকা');
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        const fetchWeather = async (lat, lon) => {
            try {
                const response = await fetch(
                    `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current_weather=true`
                );

                if (!response.ok) throw new Error('Weather data fetch failed');

                const data = await response.json();
                setWeather(data.current_weather);
                setLoading(false);
            } catch (err) {
                console.error('Weather widget error:', err);
                setError(err.message);
                setLoading(false);
            }
        };

        const initWeather = async () => {
            // Default: Dhaka
            let lat = 23.8103;
            let lon = 90.4125;

            if (navigator.geolocation) {
                try {
                    const position = await new Promise((resolve, reject) => {
                        navigator.geolocation.getCurrentPosition(resolve, reject, {
                            timeout: 10000 // 10s timeout
                        });
                    });
                    lat = position.coords.latitude;
                    lon = position.coords.longitude;
                    setLocationName('আমার অবস্থান'); // "My Location"
                } catch (e) {
                    // Fallback to Dhaka silently
                    console.log('Location access denied or failed, using default (Dhaka)');
                }
            }

            fetchWeather(lat, lon);
        };

        initWeather();

        // Refresh every 30 minutes
        const interval = setInterval(() => {
            initWeather();
        }, 30 * 60 * 1000);

        return () => clearInterval(interval);
    }, []);

    if (error || loading || !weather) return null;

    const WeatherIcon = WEATHER_CODES[weather.weathercode]?.icon || Sun;
    const weatherLabel = WEATHER_CODES[weather.weathercode]?.label || 'স্বাভাবিক';

    return (
        <div className="weather-widget fade-in" title={`${locationName}: ${weatherLabel}`}>
            <WeatherIcon size={18} className="weather-icon" />
            <span className="weather-temp">{Math.round(weather.temperature)}°C</span>
            <span className="weather-location">{locationName}</span>
        </div>
    );
};

export default WeatherWidget;
