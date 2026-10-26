// En un celular, localhost apunta al celular, no a tu computadora.
export const API_URL = process.env.EXPO_PUBLIC_API_URL?.replace(/\/+$/, '');
