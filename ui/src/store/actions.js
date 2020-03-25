import {
  ACTIVATE_CONNECTION,
  DEACTIVATE_CONNECTION,
  SERVER_CONNECTED,
  SERVER_DISCONNECTED,
  UPDATE_PURSES,
  UPDATE_OFFERS,
  RESET_STATE,
  RECENT_ORDERS,
  CREATE_OFFER,
} from './types';

export const activateConnection = () => ({
  type: ACTIVATE_CONNECTION,
});

export const deactivateConnection = () => ({
  type: DEACTIVATE_CONNECTION,
});

export const serverConnected = () => ({
  type: SERVER_CONNECTED,
});

export const serverDisconnected = () => ({
  type: SERVER_DISCONNECTED,
});

export const updatePurses = purses => ({
  type: UPDATE_PURSES,
  payload: purses,
});

export const updateOffers = offers => ({
  type: UPDATE_OFFERS,
  payload: offers,
});

export const resetState = () => ({
  type: RESET_STATE,
});

export const recentOrders = (orders) => ({
  type: RECENT_ORDERS,
  payload: orders,
});

export const createOffer = (isBuy, assetAmount, assetPurse, priceAmount, pricePurse) => ({
  type: CREATE_OFFER,
  payload: { isBuy, assetAmount, assetPurse, priceAmount, pricePurse },
});
