// The only third-party code: Preact + hooks + htm in one small module (no build step needed).
// Pinned version; the service worker caches it so the hub keeps working offline.
export {
  html, render, Component, createContext,
  useState, useEffect, useLayoutEffect, useRef, useMemo, useCallback, useContext, useReducer
} from 'https://cdn.jsdelivr.net/npm/htm@3.1.1/preact/standalone.module.js';
