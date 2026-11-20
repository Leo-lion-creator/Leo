/*
 * Geschenke-Gedächtnis – App-Sperre.
 *
 * Alle Daten werden mit einem zufälligen AES-256-Schlüssel (Datenschlüssel) verschlüsselt.
 * Dieser Schlüssel wird „eingepackt“ mit
 *   - der PIN (PBKDF2, immer vorhanden – Ersatz, falls Face ID nicht klappt) und
 *   - optional Face ID / Touch ID / Fingerabdruck über einen Passkey (WebAuthn).
 *     Unterstützt das Gerät die PRF-Erweiterung, wird der Schlüssel direkt daraus abgeleitet.
 *     Sonst liegt er nicht auslesbar im Gerätespeicher (IndexedDB) und Face ID gibt ihn frei.
 */
(function (root) {
  'use strict';
  const META = 'geschenke-lock-v1';
  const DATA = 'geschenke-enc-v1';
  const ITERATIONS = 310000;
  const te = new TextEncoder(), td = new TextDecoder();
  const AES = { name: 'AES-GCM', length: 256 };

  const rand = n => crypto.getRandomValues(new Uint8Array(n));
  function b64(buf) {
    const a = new Uint8Array(buf); let s = '';
    for (let i = 0; i < a.length; i += 0x8000) s += String.fromCharCode.apply(null, a.subarray(i, i + 0x8000));
    return btoa(s);
  }
  const unb64 = s => Uint8Array.from(atob(s), c => c.charCodeAt(0));

  let dataKey = null;

  const meta = () => { try { return JSON.parse(localStorage.getItem(META)); } catch (e) { return null; } };
  const setMeta = m => (m ? localStorage.setItem(META, JSON.stringify(m)) : localStorage.removeItem(META));

  // ---------- kleine IndexedDB-Hilfe ----------
  function idb(mode, fn) {
    return new Promise((resolve, reject) => {
      const open = indexedDB.open('geschenke-lock', 1);
      open.onupgradeneeded = () => open.result.createObjectStore('keys');
      open.onerror = () => reject(open.error);
      open.onsuccess = () => {
        const tx = open.result.transaction('keys', mode);
        const req = fn(tx.objectStore('keys'));
        tx.oncomplete = () => { open.result.close(); resolve(req && req.result); };
        tx.onerror = () => reject(tx.error);
      };
    });
  }
  const idbPut = (k, v) => idb('readwrite', s => s.put(v, k));
  const idbGet = k => idb('readonly', s => s.get(k));
  const idbClear = () => idb('readwrite', s => s.clear()).catch(() => {});

  // ---------- Schlüssel ----------
  async function pinKek(pin, salt, iterations) {
    const base = await crypto.subtle.importKey('raw', te.encode(pin), 'PBKDF2', false, ['deriveKey']);
    return crypto.subtle.deriveKey({ name: 'PBKDF2', salt, iterations, hash: 'SHA-256' }, base, AES, false, ['wrapKey', 'unwrapKey']);
  }
  async function prfKek(secret) {
    const base = await crypto.subtle.importKey('raw', secret, 'HKDF', false, ['deriveKey']);
    return crypto.subtle.deriveKey({ name: 'HKDF', hash: 'SHA-256', salt: te.encode('geschenke-prf'), info: te.encode('wrap') }, base, AES, false, ['wrapKey', 'unwrapKey']);
  }
  async function wrapWith(kek) {
    const iv = rand(12);
    return { iv: b64(iv), key: b64(await crypto.subtle.wrapKey('raw', dataKey, kek, { name: 'AES-GCM', iv })) };
  }
  const unwrapWith = (kek, w) =>
    crypto.subtle.unwrapKey('raw', unb64(w.key), kek, { name: 'AES-GCM', iv: unb64(w.iv) }, AES, true, ['encrypt', 'decrypt']);

  // ---------- öffentliche Funktionen ----------
  const isEnabled = () => !!meta();
  const isUnlocked = () => !!dataKey;
  const hasBiometrics = () => !!meta()?.bio;

  async function biometricsAvailable() {
    try {
      return !!(root.PublicKeyCredential && root.isSecureContext &&
        await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable());
    } catch (e) { return false; }
  }

  /** Sperre neu einrichten (Daten danach mit save() verschlüsselt speichern) */
  async function setup(pin) {
    dataKey = await crypto.subtle.generateKey(AES, true, ['encrypt', 'decrypt']);
    const salt = rand(16);
    setMeta({ v: 1, iterations: ITERATIONS, pinSalt: b64(salt), pin: await wrapWith(await pinKek(pin, salt, ITERATIONS)) });
  }

  async function unlockWithPin(pin) {
    const m = meta();
    try { dataKey = await unwrapWith(await pinKek(pin, unb64(m.pinSalt), m.iterations), m.pin); return true; }
    catch (e) { return false; }
  }

  async function changePin(pin) {
    const m = meta(); const salt = rand(16);
    Object.assign(m, { pinSalt: b64(salt), iterations: ITERATIONS, pin: await wrapWith(await pinKek(pin, salt, ITERATIONS)) });
    setMeta(m);
  }

  async function assertion(bio) {
    const a = await navigator.credentials.get({
      publicKey: {
        challenge: rand(32),
        allowCredentials: [{ type: 'public-key', id: unb64(bio.credId) }],
        userVerification: 'required',
        timeout: 60000,
        extensions: { prf: { eval: { first: unb64(bio.prfSalt) } } },
      },
    });
    return a.getClientExtensionResults()?.prf?.results?.first || null;
  }

  /** Face ID & Co. zusätzlich aktivieren (App muss entsperrt sein). Liefert 'prf' oder 'device'. */
  async function enableBiometrics() {
    if (!dataKey) throw new Error('Erst entsperren');
    const prfSalt = rand(32);
    const cred = await navigator.credentials.create({
      publicKey: {
        challenge: rand(32),
        rp: { name: 'Geschenke-Gedächtnis' },
        user: { id: rand(16), name: 'Geschenke-Gedächtnis', displayName: 'Geschenke-Gedächtnis' },
        pubKeyCredParams: [{ type: 'public-key', alg: -7 }, { type: 'public-key', alg: -257 }],
        authenticatorSelection: { authenticatorAttachment: 'platform', userVerification: 'required', residentKey: 'preferred' },
        timeout: 60000,
        extensions: { prf: { eval: { first: prfSalt } } },
      },
    });
    const bio = { credId: b64(cred.rawId), prfSalt: b64(prfSalt) };
    const ext = cred.getClientExtensionResults()?.prf || {};
    let secret = ext.results?.first || null;
    if (!secret && ext.enabled) secret = await assertion(bio).catch(() => null);

    if (secret) {
      bio.mode = 'prf';
      bio.wrapped = await wrapWith(await prfKek(secret));
    } else {
      bio.mode = 'device';
      const raw = await crypto.subtle.exportKey('raw', dataKey);
      await idbPut('dataKey', await crypto.subtle.importKey('raw', raw, AES, false, ['encrypt', 'decrypt']));
    }
    const m = meta(); m.bio = bio; setMeta(m);
    return bio.mode;
  }

  async function unlockWithBiometrics() {
    const bio = meta()?.bio;
    if (!bio) return false;
    const secret = await assertion(bio);
    if (bio.mode === 'prf') {
      if (!secret) throw new Error('Face ID hat keinen Schlüssel geliefert – bitte PIN nutzen');
      dataKey = await unwrapWith(await prfKek(secret), bio.wrapped);
    } else {
      dataKey = await idbGet('dataKey');
      if (!dataKey) throw new Error('Schlüssel nicht gefunden – bitte PIN nutzen');
    }
    return true;
  }

  async function disableBiometrics() {
    const m = meta(); delete m.bio; setMeta(m); await idbClear();
  }

  async function encryptState(obj) {
    if (!dataKey) return;
    const iv = rand(12);
    const ct = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, dataKey, te.encode(JSON.stringify(obj)));
    localStorage.setItem(DATA, JSON.stringify({ iv: b64(iv), ct: b64(ct) }));
  }

  async function decryptState() {
    const raw = JSON.parse(localStorage.getItem(DATA) || 'null');
    if (!raw) return null;
    const pt = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: unb64(raw.iv) }, dataKey, unb64(raw.ct));
    return JSON.parse(td.decode(pt));
  }

  /** Sperre komplett entfernen (App muss entsperrt sein) */
  async function disable() {
    setMeta(null); localStorage.removeItem(DATA); dataKey = null; await idbClear();
  }

  const lock = () => { dataKey = null; };
  /** Nur PIN-Änderung/Face-ID-Aktivierung braucht einen exportierbaren Schlüssel */
  const keyIsExtractable = () => !!dataKey?.extractable;

  root.GiftLock = {
    isEnabled, isUnlocked, hasBiometrics, biometricsAvailable, setup, unlockWithPin, changePin,
    enableBiometrics, unlockWithBiometrics, disableBiometrics, encryptState, decryptState,
    disable, lock, keyIsExtractable, mode: () => meta()?.bio?.mode || null,
  };
})(typeof self !== 'undefined' ? self : this);
