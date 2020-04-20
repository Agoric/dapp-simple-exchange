import {
  ACTIVATE_CONNECTION,
  DEACTIVATE_CONNECTION,
  CREATE_OFFER,
  SERVER_CONNECTED,
  SERVER_DISCONNECTED,
  UPDATE_PURSES,
  UPDATE_OFFERS,
  RESET_STATE,
  RECENT_ORDERS,
} from './types';

import {
  activateConnection,
  deactivateConnection,
  serverConnected,
  serverDisconnected,
  updatePurses,
  resetState,
  recentOrders,
  updateOffers,
  createOffer,
} from './operations';

import dappConstants from '../utils/constants';

export function createDefaultState() {
  const instanceId = dappConstants.INSTANCE_REG_KEY;
  const assetBrandRegKey = dappConstants.ASSET_BRAND_REG_KEY;
  const priceBrandRegKey = dappConstants.PRICE_BRAND_REG_KEY;
  return {
    active: false,
    connected: false,
    account: null,
    purses: [],
    instanceId,
    assetBrandRegKey,
    priceBrandRegKey,
    offers: [],
    recentOrders: { buy: [], sell: [], buyHistory: [], sellHistory: [] },
    orderbook: { buy: [], sell: [] },
    orderhistory: { buy: [], sell: [] },
  };
}

export const reducer = (state, { type, payload }) => {
  switch (type) {
    case ACTIVATE_CONNECTION:
      return activateConnection(state);
    case DEACTIVATE_CONNECTION:
      return deactivateConnection(state);

    case CREATE_OFFER:
      return createOffer(state, payload);

    case SERVER_CONNECTED:
      return serverConnected(state);
    case SERVER_DISCONNECTED:
      return serverDisconnected(state);

    case UPDATE_PURSES:
      return updatePurses(state, payload);
    
    case UPDATE_OFFERS:
      return updateOffers(state, payload);

    case RESET_STATE:
      return resetState(state);

    case RECENT_ORDERS:
      return recentOrders(state, payload);

    default:
      throw new TypeError(`Action not supported ${type}`);
  }
};