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
  UPDATE_INVITATION_DEPOSIT_ID,
} from './types';

import {
  activateConnection,
  deactivateConnection,
  serverConnected,
  serverDisconnected,
  updatePurses,
  updateInvitationDepositId,
  resetState,
  recentOrders,
  updateOffers,
  createOffer,
} from './operations';

import dappConstants from '../utils/constants';

export function createDefaultState() {
  const instanceHandleBoardId = dappConstants.INSTANCE_BOARD_ID;
  const installationHandleBoardId = dappConstants.INSTALLATION_BOARD_ID;
  const assetBrandBoardId = dappConstants.ASSET_BRAND_BOARD_ID;
  const priceBrandBoardId = dappConstants.PRICE_BRAND_BOARD_ID;
  return {
    active: false,
    connected: false,
    account: null,
    purses: [],
    instanceHandleBoardId,
    installationHandleBoardId,
    assetBrandBoardId,
    priceBrandBoardId,
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

    case UPDATE_INVITATION_DEPOSIT_ID:
      return updateInvitationDepositId(state, payload);

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
