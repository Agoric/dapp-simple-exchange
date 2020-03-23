// import { doFetch } from '../utils/fetch-websocket';

export function activateConnection(state) {
  return { ...state, active: true };
}
export function deactivateConnection(state) {
  return { ...state, active: false };
}

export function serverConnected(state) {
  return { ...state, connected: true };
}
export function serverDisconnected(state) {
  return { ...state, connected: false };
}

export function updatePurses(state, purses) {
  const getMatchingPurse = (matchBrandRegKey, current) => {
    const matchingPurses = purses.filter(({brandRegKey}) =>
      brandRegKey === state[matchBrandRegKey]);
    const already = current && matchingPurses.find(({pursePetname}) =>
      pursePetname === current.pursePetName);
    if (already) {
      return already;
    }
    if (matchingPurses.length > 0) {
      return matchingPurses[0];
    }
    return null;
  };

  const assetPurse = getMatchingPurse('assetBrandRegKey', state.assetPurse);
  const pricePurse = getMatchingPurse('priceBrandRegKey', state.pricePurse);

  return { ...state, assetPurse, pricePurse, purses };
}

export function updatePurse(state, purse, isAsset) {
  const directedPurse = isAsset ? 'assetPurse' : 'pricePurse';
  return { ...state, [directedPurse]: purse };
}

export function updateAmount(state, amount, isAsset) {
  const directedAmount = isAsset ? 'assetAmount' : 'priceAmount';
  return { ...state, [directedAmount]: amount };
}

export function resetState(state) {
  return {
    ...state,
    purses: null,
    assetPurse: null,
    pricePurse: null,
    assetAmount: '',
    priceAmount: '',
  };
}
