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

const separateOrders = (offers, orders) => {
  // TODO: May want to mark my orders specially.
  const myOffers = new Map();
  offers.forEach(({ publicID, status }) => myOffers.set(publicID, status));

  const orderhistory = { buy: orders.buyHistory, sell: orders.sellHistory };
  const orderbook = { buy: orders.buy, sell: orders.sell };

  return { orderhistory, orderbook };
};

export function updateOffers(state, offers) {
  const { orderhistory, orderbook } = separateOrders(offers, state.recentOrders);
  return { ...state, orderhistory, orderbook, offers };
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
    orderbook: { buy: [], sell: [] },
    orderhistory: { buy: [], sell: [] },
    offers: [],
    assetPurse: null,
    pricePurse: null,
    assetAmount: '',
    priceAmount: '',
  };
}

export function recentOrders(state, orders) {
  const { orderbook, orderhistory } = separateOrders(state.offers, orders);
  return { ...state, recentOrders: orders, orderbook, orderhistory };
}

export function setTab(state, tab) {
  return { ...state, tab };
}
