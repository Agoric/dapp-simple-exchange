import {
  ACTIVATE_CONNECTION,
  DEACTIVATE_CONNECTION,
  SERVER_CONNECTED,
  SERVER_DISCONNECTED,
  UPDATE_PURSES,
  RESET_STATE,
  UPDATE_PURSE,
  UPDATE_AMOUNT,
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

export const resetState = () => ({
  type: RESET_STATE,
});

export const updatePurse = (purse, isAsset) => ({
  type: UPDATE_PURSE,
  payload: {
    purse,
    isAsset,
  },
});

export const updateAmount = (amount, isAsset) => ({
  type: UPDATE_AMOUNT,
  payload: {
    amount,
    isAsset,
  },
});
