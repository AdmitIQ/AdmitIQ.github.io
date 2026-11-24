// Approximate geographic centers of US states (used only for rough "distance from home" estimates).
export const STATES: Record<string, { name: string; region: string; lat: number; lon: number }> = {
  AL: { name: 'Alabama', region: 'South', lat: 32.8, lon: -86.8 }, AK: { name: 'Alaska', region: 'West', lat: 64.7, lon: -152.0 },
  AZ: { name: 'Arizona', region: 'Southwest', lat: 34.3, lon: -111.7 }, AR: { name: 'Arkansas', region: 'South', lat: 34.9, lon: -92.4 },
  CA: { name: 'California', region: 'West', lat: 37.2, lon: -119.4 }, CO: { name: 'Colorado', region: 'West', lat: 39.0, lon: -105.5 },
  CT: { name: 'Connecticut', region: 'Northeast', lat: 41.6, lon: -72.7 }, DE: { name: 'Delaware', region: 'Mid-Atlantic', lat: 39.0, lon: -75.5 },
  DC: { name: 'District of Columbia', region: 'Mid-Atlantic', lat: 38.9, lon: -77.0 }, FL: { name: 'Florida', region: 'South', lat: 28.6, lon: -82.4 },
  GA: { name: 'Georgia', region: 'South', lat: 32.7, lon: -83.4 }, HI: { name: 'Hawaii', region: 'West', lat: 20.3, lon: -156.4 },
  ID: { name: 'Idaho', region: 'West', lat: 44.4, lon: -114.6 }, IL: { name: 'Illinois', region: 'Midwest', lat: 40.0, lon: -89.2 },
  IN: { name: 'Indiana', region: 'Midwest', lat: 39.9, lon: -86.3 }, IA: { name: 'Iowa', region: 'Midwest', lat: 42.1, lon: -93.5 },
  KS: { name: 'Kansas', region: 'Midwest', lat: 38.5, lon: -98.4 }, KY: { name: 'Kentucky', region: 'South', lat: 37.5, lon: -85.3 },
  LA: { name: 'Louisiana', region: 'South', lat: 31.1, lon: -92.0 }, ME: { name: 'Maine', region: 'Northeast', lat: 45.4, lon: -69.2 },
  MD: { name: 'Maryland', region: 'Mid-Atlantic', lat: 39.1, lon: -76.8 }, MA: { name: 'Massachusetts', region: 'Northeast', lat: 42.3, lon: -71.8 },
  MI: { name: 'Michigan', region: 'Midwest', lat: 44.3, lon: -85.4 }, MN: { name: 'Minnesota', region: 'Midwest', lat: 46.3, lon: -94.3 },
  MS: { name: 'Mississippi', region: 'South', lat: 32.7, lon: -89.7 }, MO: { name: 'Missouri', region: 'Midwest', lat: 38.4, lon: -92.5 },
  MT: { name: 'Montana', region: 'West', lat: 47.0, lon: -109.6 }, NE: { name: 'Nebraska', region: 'Midwest', lat: 41.5, lon: -99.8 },
  NV: { name: 'Nevada', region: 'West', lat: 39.3, lon: -116.6 }, NH: { name: 'New Hampshire', region: 'Northeast', lat: 43.7, lon: -71.6 },
  NJ: { name: 'New Jersey', region: 'Mid-Atlantic', lat: 40.2, lon: -74.7 }, NM: { name: 'New Mexico', region: 'Southwest', lat: 34.4, lon: -106.1 },
  NY: { name: 'New York', region: 'Mid-Atlantic', lat: 42.9, lon: -75.5 }, NC: { name: 'North Carolina', region: 'South', lat: 35.6, lon: -79.4 },
  ND: { name: 'North Dakota', region: 'Midwest', lat: 47.5, lon: -100.5 }, OH: { name: 'Ohio', region: 'Midwest', lat: 40.3, lon: -82.8 },
  OK: { name: 'Oklahoma', region: 'Southwest', lat: 35.6, lon: -97.5 }, OR: { name: 'Oregon', region: 'West', lat: 43.9, lon: -120.6 },
  PA: { name: 'Pennsylvania', region: 'Mid-Atlantic', lat: 40.9, lon: -77.8 }, RI: { name: 'Rhode Island', region: 'Northeast', lat: 41.7, lon: -71.5 },
  SC: { name: 'South Carolina', region: 'South', lat: 33.9, lon: -80.9 }, SD: { name: 'South Dakota', region: 'Midwest', lat: 44.4, lon: -100.2 },
  TN: { name: 'Tennessee', region: 'South', lat: 35.9, lon: -86.4 }, TX: { name: 'Texas', region: 'Southwest', lat: 31.5, lon: -99.3 },
  UT: { name: 'Utah', region: 'West', lat: 39.3, lon: -111.7 }, VT: { name: 'Vermont', region: 'Northeast', lat: 44.1, lon: -72.7 },
  VA: { name: 'Virginia', region: 'South', lat: 37.5, lon: -78.9 }, WA: { name: 'Washington', region: 'West', lat: 47.4, lon: -120.5 },
  WV: { name: 'West Virginia', region: 'South', lat: 38.6, lon: -80.6 }, WI: { name: 'Wisconsin', region: 'Midwest', lat: 44.6, lon: -89.9 },
  WY: { name: 'Wyoming', region: 'West', lat: 43.0, lon: -107.6 },
};
export const REGIONS = ['Northeast', 'Mid-Atlantic', 'South', 'Midwest', 'Southwest', 'West', 'International'];

export function regionOf(stateOrProvince: string, country: string) {
  if (country !== 'USA') return 'International';
  return STATES[stateOrProvince]?.region || 'Unknown';
}

export function milesBetween(a: { lat: number; lon: number }, b: { lat: number; lon: number }) {
  const R = 3958.8, toR = (d: number) => (d * Math.PI) / 180;
  const dLat = toR(b.lat - a.lat), dLon = toR(b.lon - a.lon);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toR(a.lat)) * Math.cos(toR(b.lat)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

export function distanceFromHome(homeState: string, c: { lat: number; lon: number }): number | null {
  const s = STATES[homeState];
  return s ? Math.round(milesBetween(s, c)) : null;
}
