export interface LocationSuggestion {
  id: string;
  label: string;
  fullName: string;
  latitude: number;
  longitude: number;
}

type FetchLike = typeof fetch;

interface NominatimResult {
  place_id?: number | string;
  display_name?: string;
  lat?: string;
  lon?: string;
  address?: Record<string, string | undefined>;
}

const conciseName = (displayName: string) =>
  displayName.split(',').map(part => part.trim()).filter(Boolean).slice(0, 3).join(', ');

export const searchLocationSuggestions = async (
  query: string,
  signal?: AbortSignal,
  fetcher: FetchLike = fetch,
): Promise<LocationSuggestion[]> => {
  const trimmed = query.trim();
  if (trimmed.length < 2) return [];

  const params = new URLSearchParams({
    q: trimmed,
    format: 'jsonv2',
    addressdetails: '1',
    limit: '6',
  });
  const response = await fetcher(`https://nominatim.openstreetmap.org/search?${params}`, {
    headers: { 'Accept-Language': typeof navigator !== 'undefined' ? navigator.language || 'en' : 'en' },
    signal,
  });
  if (!response.ok) throw new Error(`Location search failed (${response.status})`);

  const rows = await response.json() as NominatimResult[];
  const seen = new Set<string>();
  return rows.flatMap((row, index) => {
    const fullName = row.display_name?.trim();
    const latitude = Number(row.lat);
    const longitude = Number(row.lon);
    if (!fullName || !Number.isFinite(latitude) || !Number.isFinite(longitude) || seen.has(fullName)) return [];
    seen.add(fullName);
    return [{
      id: String(row.place_id ?? `${latitude},${longitude},${index}`),
      label: conciseName(fullName) || fullName,
      fullName,
      latitude,
      longitude,
    }];
  });
};

export const reverseGeocodeLocation = async (
  latitude: number,
  longitude: number,
  signal?: AbortSignal,
  fetcher: FetchLike = fetch,
): Promise<string> => {
  const params = new URLSearchParams({
    lat: String(latitude),
    lon: String(longitude),
    format: 'jsonv2',
    addressdetails: '1',
  });
  const response = await fetcher(`https://nominatim.openstreetmap.org/reverse?${params}`, {
    headers: { 'Accept-Language': typeof navigator !== 'undefined' ? navigator.language || 'en' : 'en' },
    signal,
  });
  if (!response.ok) throw new Error(`Reverse geocoding failed (${response.status})`);

  const row = await response.json() as NominatimResult;
  const address = row.address || {};
  return [
    address.road,
    address.suburb || address.neighbourhood,
    address.city || address.town || address.village,
    address.country,
  ].filter(Boolean).join(', ') || row.display_name || `${latitude.toFixed(5)}, ${longitude.toFixed(5)}`;
};

const positionRequest = (geolocation: Geolocation, options: PositionOptions) =>
  new Promise<GeolocationPosition>((resolve, reject) => {
    geolocation.getCurrentPosition(resolve, reject, options);
  });

export const detectCurrentPosition = async (geolocation: Geolocation): Promise<GeolocationPosition> => {
  try {
    return await positionRequest(geolocation, {
      enableHighAccuracy: false,
      timeout: 12000,
      maximumAge: 120000,
    });
  } catch (error) {
    const geolocationError = error as GeolocationPositionError;
    if (geolocationError.code === 1) throw error;
    return positionRequest(geolocation, {
      enableHighAccuracy: true,
      timeout: 20000,
      maximumAge: 30000,
    });
  }
};

export const locationErrorMessage = (error: Pick<GeolocationPositionError, 'code'>) => {
  if (error.code === 1) return 'Location permission is blocked. Enable location access for Serkle in your browser settings, then try again.';
  if (error.code === 2) return 'Your location is unavailable. Turn on Location Services or GPS, then try again.';
  if (error.code === 3) return 'Location detection timed out. Move somewhere with a clearer signal, then try again.';
  return 'Serkle could not detect your location. Please try again or search for a place.';
};
