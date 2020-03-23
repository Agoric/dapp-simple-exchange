import {
  ACTIVATE_CONNECTION,
  DEACTIVATE_CONNECTION,
  SERVER_CONNECTED,
  SERVER_DISCONNECTED,
  UPDATE_PURSES,
  UPDATE_PURSE,
  UPDATE_OFFERS,
  UPDATE_AMOUNT,
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
  updatePurse,
  updateAmount,
  recentOrders,
  updateOffers,
} from './operations';

import dappConstants from '../utils/constants';

export function createDefaultState() {
  const assetBrandRegKey = dappConstants.ASSET_BRAND_REGKEY;
  const priceBrandRegKey = dappConstants.PRICE_BRAND_REGKEY;
  return {
    active: false,
    connected: false,
    account: null,
    purses: null,
    assetBrandRegKey,
    priceBrandRegKey,
    assetPurse: null,
    pricePurse: null,
    assetAmount: '',
    priceAmount: '',
    recentOrders: { buy: [], sell: [] },
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

    case SERVER_CONNECTED:
      return serverConnected(state);
    case SERVER_DISCONNECTED:
      return serverDisconnected(state);

    case UPDATE_PURSES:
      return updatePurses(state, payload);
    
    case UPDATE_PURSE: {
      const { purse, isAsset } = payload;
      return updatePurse(state, purse, isAsset);
    }

    case UPDATE_AMOUNT: {
      const { amount, isAsset } = payload;
      return updateAmount(state, amount, isAsset);
    }
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
