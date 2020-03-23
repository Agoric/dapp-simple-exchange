import {
  ACTIVATE_CONNECTION,
  DEACTIVATE_CONNECTION,
  SERVER_CONNECTED,
  SERVER_DISCONNECTED,
  UPDATE_PURSES,
  UPDATE_PURSE,
  UPDATE_AMOUNT,
  RESET_STATE,
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
} from './operations';

import dappConstants from '../utils/constants';

function randomBoolean() {
  return Math.random < 0.5;
}

function randomInteger(max) {
  return Math.floor(Math.random() * max);
}

function createFakeSide(side) {
  const brandRegKey = side ? dappConstants.ASSET_BRAND_REGKEY : dappConstants.PRICE_BRAND_REGKEY;
  const result = {
    brandRegKey,
    extent: randomInteger(1000),
  };
  return result;
}

function createFakeOrder() {
  const order = randomBoolean();
  const result = { key: Math.random(), want: createFakeSide(order), offer: createFakeSide(order) };
  return result;
}

function createFakeOrderHistory(buys, sells) {
  const result = { buys: [], sells: [] };
  for (let i = 0; i < buys; i += 1) {
    result.buys.push(createFakeOrder());
  }
  for (let i = 0; i < sells; i += 1) {
    result.sells.push(createFakeOrder());
  }
  return result;
}

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
    orderbook: createFakeOrderHistory(50, 50),
    orderhistory: createFakeOrderHistory(50, 50),
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

    case RESET_STATE:
      return resetState(state);

    default:
      throw new TypeError(`Action not supported ${type}`);
  }
};
