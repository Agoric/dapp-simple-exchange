import { doFetch } from '../utils/fetch-websocket';

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
  return { ...state, purses };
}

export function updateInvitationDepositId(state, invitationDepositId) {
  return { ...state, invitationDepositId };
}

const separateOrders = (offers, orders) => {
  // TODO: May want to mark my own orders specially.
  const myOffers = new Map();
  offers.forEach(({ publicID, state }) => myOffers.set(publicID, state));

  const orderhistory = {
    buy: orders.buyHistory || [],
    sell: orders.sellHistory || [],
  };
  const orderbook = { buy: orders.buys, sell: orders.sells };

  return { orderhistory, orderbook };
};

export function updateOffers(state, offers) {
  const { orderhistory, orderbook } = separateOrders(
    offers,
    state.recentOrders,
  );
  return { ...state, orderhistory, orderbook, offers };
}

export function resetState(state) {
  return {
    ...state,
    purses: [],
    orderbook: { buy: [], sell: [] },
    orderhistory: { buy: [], sell: [] },
    offers: [],
  };
}

export function recentOrders(state, orders) {
  const { orderbook, orderhistory } = separateOrders(state.offers, orders);
  return { ...state, recentOrders: orders, orderbook, orderhistory };
}

export function createOffer(
  state,
  { isBuy, assetAmount, assetPurse, priceAmount, pricePurse },
) {
  const {
    instanceHandleBoardId,
    installationHandleBoardId,
    invitationDepositId,
  } = state;
  const now = Date.now();
  const offer = {
    // JSONable ID for this offer.  This is scoped to the origin.
    id: now,

    // TODO: get this from the invitation instead in the wallet. We
    // don't want to trust the dapp on this.
    instanceHandleBoardId,
    installationHandleBoardId,

    proposalTemplate: {
      [isBuy ? 'want' : 'give']: {
        Asset: {
          // The pursePetname identifies which purse we want to use
          pursePetname: assetPurse.pursePetname,
          value: assetAmount,
        },
      },
      [isBuy ? 'give' : 'want']: {
        Price: {
          pursePetname: pricePurse.pursePetname,
          value: priceAmount,
        },
      },
      exit: { onDemand: null },
    },
  };

  // Create an invitation for the offer and on response, send the proposed
  // offer to the wallet.
  doFetch(
    {
      type: 'simpleExchange/sendInvitation',
      data: {
        depositFacetId: invitationDepositId,
        offer,
      },
    },
    '/api',
  );

  return state;
}
