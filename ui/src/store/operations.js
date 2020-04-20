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

const separateOrders = (offers, orders) => {
  // TODO: May want to mark my own orders specially.
  const myOffers = new Map();
  offers.forEach(({ publicID, state }) => myOffers.set(publicID, state));

  const orderhistory = { buy: orders.buyHistory || [], sell: orders.sellHistory || [] };
  const orderbook = { buy: orders.buys, sell: orders.sells };

  return { orderhistory, orderbook };
};

export function updateOffers(state, offers) {
  const { orderhistory, orderbook } = separateOrders(offers, state.recentOrders);
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

export function createOffer(state, { isBuy, assetAmount, assetPurse, priceAmount, pricePurse }) {
  const { instanceId } = state;
  const now = Date.now();
  const offer = {
    // JSONable ID for this offer.  This is scoped to the origin.
    id: now,

    // Contract-specific metadata.
    instanceRegKey: instanceId,
    contractIssuerIndexToKeyword: ['Asset', 'Price'],

    // Format is:
    //   hooks[targetName][hookName] = [hookMethod, ...hookArgs].
    // Then is called within the wallet as:
    //   E(target)[hookMethod](...hookArgs)
    hooks: {
      publicAPI: {
        getInvite: ['makeInvite'], // E(publicAPI).makeInvite()
      },
    },

    proposalTemplate: {
      [isBuy ? 'want' : 'give']: {
        Asset: {
          // The pursePetname identifies which purse we want to use
          pursePetname: assetPurse.pursePetname,
          extent: assetAmount,
        },
      },
      [isBuy ? 'give' : 'want']: {
        Price: {
          pursePetname: pricePurse.pursePetname,
          extent: priceAmount,
        },
      },
      exit: { onDemand: null },
    },
  };

  // Actually make the offer.
  doFetch(
    {
      type: 'walletAddOffer',
      data: offer,
    },
  );

  return state;
}
