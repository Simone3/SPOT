// eslint-disable-next-line import/no-unassigned-import
import '@testing-library/jest-dom';

let randomUUIDCounter = 0;

const makeRandomUUID = (): `${string}-${string}-${string}-${string}-${string}` => {
	randomUUIDCounter += 1;
	return `00000000-0000-4000-8000-${String(randomUUIDCounter).padStart(12, '0')}`;
};

const cryptoWithRandomUUID = Object.create(globalThis.crypto ?? null) as Crypto;
Object.defineProperty(cryptoWithRandomUUID, 'randomUUID', {
	configurable: true,
	writable: true,
	value: makeRandomUUID
});
Object.defineProperty(globalThis, 'crypto', {
	configurable: true,
	value: cryptoWithRandomUUID
});
