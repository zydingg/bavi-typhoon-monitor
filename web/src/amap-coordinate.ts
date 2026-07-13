const earthRadius = 6378245.0;
const eccentricitySquared = 0.00669342162296594323;
const pi = Math.PI;

function transformLatitude(longitude: number, latitude: number): number {
  let result = -100 + 2 * longitude + 3 * latitude + 0.2 * latitude * latitude + 0.1 * longitude * latitude + 0.2 * Math.sqrt(Math.abs(longitude));
  result += ((20 * Math.sin(6 * longitude * pi) + 20 * Math.sin(2 * longitude * pi)) * 2) / 3;
  result += ((20 * Math.sin(latitude * pi) + 40 * Math.sin((latitude / 3) * pi)) * 2) / 3;
  result += ((160 * Math.sin((latitude / 12) * pi) + 320 * Math.sin((latitude * pi) / 30)) * 2) / 3;
  return result;
}

function transformLongitude(longitude: number, latitude: number): number {
  let result = 300 + longitude + 2 * latitude + 0.1 * longitude * longitude + 0.1 * longitude * latitude + 0.1 * Math.sqrt(Math.abs(longitude));
  result += ((20 * Math.sin(6 * longitude * pi) + 20 * Math.sin(2 * longitude * pi)) * 2) / 3;
  result += ((20 * Math.sin(longitude * pi) + 40 * Math.sin((longitude / 3) * pi)) * 2) / 3;
  result += ((150 * Math.sin((longitude / 12) * pi) + 300 * Math.sin((longitude / 30) * pi)) * 2) / 3;
  return result;
}

export function toAmapCoordinate(longitude: number, latitude: number): [number, number] {
  if (longitude < 72.004 || longitude > 137.8347 || latitude < 0.8293 || latitude > 55.8271) {
    return [longitude, latitude];
  }

  let latitudeOffset = transformLatitude(longitude - 105, latitude - 35);
  let longitudeOffset = transformLongitude(longitude - 105, latitude - 35);
  const latitudeRadians = (latitude / 180) * pi;
  const sineLatitude = Math.sin(latitudeRadians);
  const magic = 1 - eccentricitySquared * sineLatitude * sineLatitude;
  const squareRootMagic = Math.sqrt(magic);

  latitudeOffset = (latitudeOffset * 180) / (((earthRadius * (1 - eccentricitySquared)) / (magic * squareRootMagic)) * pi);
  longitudeOffset = (longitudeOffset * 180) / ((earthRadius / squareRootMagic) * Math.cos(latitudeRadians) * pi);

  return [longitude + longitudeOffset, latitude + latitudeOffset];
}
