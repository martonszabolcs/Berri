// Lazy store reference to break circular dependency:
// store/index -> appSlice -> api/authApi -> store/index
//
// API files should import getStore() from here instead of
// importing { store } from '../index' directly.

let _store: any = null;

export function setStore(s: any) {
  _store = s;
}

export function getStore() {
  if (!_store) {
    // Lazy require as fallback — only runs once
    _store = require('./index').store;
  }
  return _store;
}
