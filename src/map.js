import React, { useEffect, useRef, useState } from 'react';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import MapboxDirections from '@mapbox/mapbox-gl-directions/dist/mapbox-gl-directions';
import axios from 'axios'; // For Nominatim API requests

mapboxgl.accessToken = 'pk.eyJ1IjoiZGl2eWFzbSIsImEiOiJjbTAwenprMGwxa3hoMmtyMnh6ZncxZGRzIn0.b4rIdvAo-J3t3kEKV0dxWA';

const blockCoordinates = {
  'admin block': [80.00431533190311, 13.009665058794084],
  'workshop block': [80.00322498162672, 13.009260121787491],
  // Add more blocks and their coordinates here
};

const SimpleMap = () => {
  const mapContainer = useRef(null);
  const map = useRef(null);
  const userMarker = useRef(null);
  const directionsRef = useRef(null); // Ref for directions control
  const [pitch, setPitch] = useState(45);
  const [bearing, setBearing] = useState(-17.6);
  const [currentLocation, setCurrentLocation] = useState(null);
  const [destination, setDestination] = useState('');

  useEffect(() => {
    if (map.current) return;

    map.current = new mapboxgl.Map({
      container: mapContainer.current,
      style: 'mapbox://styles/divyasm/cm0e1cd45002o01pk6ekye42z',
      center: [80.013, 13.012],
      zoom: 14,
      pitch: pitch,
      bearing: bearing,
      antialias: true,
    });

    map.current.addControl(new mapboxgl.NavigationControl());

    const geolocateControl = new mapboxgl.GeolocateControl({
      positionOptions: { enableHighAccuracy: true },
      trackUserLocation: true,
      showUserHeading: true,
    });

    map.current.addControl(geolocateControl);

    map.current.on('style.load', () => {
      map.current.addSource('mapbox-dem', {
        type: 'raster-dem',
        url: 'mapbox://mapbox.mapbox-terrain-dem-v1',
        tileSize: 512,
        maxzoom: 14,
      });
      map.current.setTerrain({ source: 'mapbox-dem', exaggeration: 1.5 });

      map.current.addLayer({
        id: '3d-buildings',
        source: 'composite',
        'source-layer': 'building',
        filter: ['==', 'extrude', 'true'],
        type: 'fill-extrusion',
        minzoom: 15,
        paint: {
          'fill-extrusion-color': '#aaa',
          'fill-extrusion-height': ['get', 'height'],
          'fill-extrusion-base': ['get', 'min_height'],
          'fill-extrusion-opacity': 0.6,
        },
      });
    });

    map.current.on('load', () => {
      geolocateControl.trigger();

      const directions = new MapboxDirections({
        accessToken: mapboxgl.accessToken,
        unit: 'metric',
        profile: 'mapbox/driving',
      });

      map.current.addControl(directions, 'top-left');
      directionsRef.current = directions; // Store reference for later use

      directions.on('route', (e) => {
        const route = e.route[0];
        const steps = route.legs[0].steps.map(step => step.maneuver.instruction);
        readAloud(steps);
      });
    });

    geolocateControl.on('geolocate', (position) => {
      const { longitude, latitude } = position.coords;
      console.log('Geolocated position:', longitude, latitude); // Debugging info
      setCurrentLocation([longitude, latitude]);

      if (userMarker.current) {
        userMarker.current.setLngLat([longitude, latitude]);
      } else {
        userMarker.current = new mapboxgl.Marker({ color: 'red' })
          .setLngLat([longitude, latitude])
          .addTo(map.current);
      }
      map.current.setCenter([longitude, latitude]);
    });

    // Handle errors if geolocation is not available or fails
    map.current.on('error', (error) => {
      console.error('Map error:', error);
    });
  }, []);

  useEffect(() => {
    if (map.current) {
      map.current.setPitch(pitch);
      map.current.setBearing(bearing);
    }
  }, [pitch, bearing]);

  useEffect(() => {
    if (currentLocation && directionsRef.current) {
      const directions = directionsRef.current;

      directions.setOrigin(currentLocation);

      if (blockCoordinates[destination]) {
        directions.setDestination(blockCoordinates[destination]);
      }
    }
  }, [currentLocation, destination]);

  const readAloud = (instructions) => {
    const utterance = new SpeechSynthesisUtterance(instructions.join('. '));
    window.speechSynthesis.speak(utterance);
  };

  const increasePitch = () => setPitch(prev => Math.min(prev + 5, 60));
  const decreasePitch = () => setPitch(prev => Math.max(prev - 5, 0));

  const increaseBearing = () => setBearing(prev => prev + 10);
  const decreaseBearing = () => setBearing(prev => prev - 10);

  const handleSearch = async () => {
    try {
      const response = await axios.get('https://nominatim.openstreetmap.org/search?format=json&q=${destination}');
      if (response.data.length > 0) {
        const { lon, lat } = response.data[0];
        const coordinates = [parseFloat(lon), parseFloat(lat)];
        map.current.setCenter(coordinates);
        if (directionsRef.current) {
          directionsRef.current.setDestination(coordinates);
        }
      }
    } catch (error) {
      console.error('Error fetching destination coordinates:', error);
    }
  };

  return (
    <div style={styles.container}>
      <div ref={mapContainer} style={styles.mapContainer} />
      <div style={styles.controls}>
        <div style={styles.controlGroup}>
          <label style={styles.label}>Pitch: {pitch}°</label>
          <div style={styles.buttonGroup}>
            <button style={styles.button} onClick={decreasePitch}>-</button>
            <button style={styles.button} onClick={increasePitch}>+</button>
          </div>
        </div>
        <div style={styles.controlGroup}>
          <label style={styles.label}>Bearing: {bearing}°</label>
          <div style={styles.buttonGroup}>
            <button style={styles.button} onClick={decreaseBearing}>-</button>
            <button style={styles.button} onClick={increaseBearing}>+</button>
          </div>
        </div>
        <div style={styles.controlGroup}>
          <input
            type="text"
            placeholder="Search for a block"
            value={destination}
            onChange={(e) => setDestination(e.target.value)}
            style={styles.searchInput}
          />
          <button onClick={handleSearch} style={styles.searchButton}>Search</button>
        </div>
      </div>
    </div>
  );
};

const styles = {
  container: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    backgroundColor: '#f0f0f0',
    fontFamily: 'Arial, sans-serif',
    height: '100vh',
  },
  mapContainer: {
    width: '100%',
    height: '80vh',
    boxShadow: '0 4px 8px rgba(0, 0, 0, 0.1)',
    borderRadius: '8px',
    overflow: 'hidden',
    margin: '20px 0',
  },
  controls: {
    width: '80%',
    maxWidth: '600px',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    padding: '10px',
    backgroundColor: '#fff',
    borderRadius: '8px',
    boxShadow: '0 2px 4px rgba(0, 0, 0, 0.1)',
  },
  controlGroup: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    marginBottom: '10px',
  },
  label: {
    fontSize: '16px',
    marginBottom: '8px',
    color: '#333',
  },
  buttonGroup: {
    display: 'flex',
    gap: '10px',
  },
  button: {
    padding: '10px 15px',
    fontSize: '16px',
    fontWeight: 'bold',
    color: '#fff',
    backgroundColor: '#007bff',
    border: 'none',
    borderRadius: '4px',
    cursor: 'pointer',
    transition: 'background-color 0.3s ease',
  },
  buttonHover: {
    backgroundColor: '#0056b3',
  },
  searchInput: {
    padding: '10px',
    fontSize: '16px',
    border: '1px solid #ccc',
    borderRadius: '4px',
    width: '200px',
    marginRight: '10px',
  },
  searchButton: {
    padding: '10px 15px',
    fontSize: '16px',
    fontWeight: 'bold',
    color: '#fff',
    backgroundColor: '#28a745',
    border: 'none',
    borderRadius: '4px',
    cursor: 'pointer',
    transition: 'background-color 0.3s ease',
  },
};

export default SimpleMap;