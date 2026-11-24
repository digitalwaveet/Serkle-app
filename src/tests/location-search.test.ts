import assert from 'node:assert/strict';
import test from 'node:test';
import {
  detectCurrentPosition,
  locationErrorMessage,
  searchLocationSuggestions,
} from '../lib/locationSearch.ts';

test('location search returns concise, unique suggestions', async () => {
  const fetcher = async () => new Response(JSON.stringify([
    { place_id: 1, display_name: 'Bole, Addis Ababa, Ethiopia, Africa', lat: '9.01', lon: '38.78' },
    { place_id: 2, display_name: 'Bole, Addis Ababa, Ethiopia, Africa', lat: '9.01', lon: '38.78' },
    { place_id: 3, display_name: 'Bole Airport, Addis Ababa, Ethiopia', lat: '8.98', lon: '38.80' },
  ]), { status: 200 });

  const results = await searchLocationSuggestions('Bole', undefined, fetcher as typeof fetch);
  assert.deepEqual(results.map(result => result.label), [
    'Bole, Addis Ababa, Ethiopia',
    'Bole Airport, Addis Ababa, Ethiopia',
  ]);
});

test('current position uses the fast cached request before high accuracy', async () => {
  let options: PositionOptions | undefined;
  const position = { coords: { latitude: 9.01, longitude: 38.78 } } as GeolocationPosition;
  const geolocation = {
    getCurrentPosition(success: PositionCallback, _error?: PositionErrorCallback, nextOptions?: PositionOptions) {
      options = nextOptions;
      success(position);
    },
  } as Geolocation;

  assert.equal(await detectCurrentPosition(geolocation), position);
  assert.equal(options?.enableHighAccuracy, false);
  assert.equal(locationErrorMessage({ code: 1 }), 'Location permission is blocked. Enable location access for Serkle in your browser settings, then try again.');
});
