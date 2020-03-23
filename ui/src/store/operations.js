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
  const getMatchingPurse = (matchIssuer, current) => {
    const matchingPurses = purses.filter(({issuerPetname}) =>
      issuerPetname === state[matchIssuer]);
    const already = matchingPurses.find(({pursePetname}) =>
      pursePetname === current);
    if (current && already) {
      return current;
    }
    if (matchingPurses.length > 0) {
      return matchingPurses[0].pursePetname;
    }
    return null;
  };

  const assetPurse = getMatchingPurse('assetIssuer', state.assetPurse);
  const pricePurse = getMatchingPurse('priceIssuer', state.pricePurse);

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
