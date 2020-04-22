import React, { createContext, useCallback, useContext, useEffect, useReducer } from 'react';

import {
  activateWebSocket,
  deactivateWebSocket,
  doFetch,
} from '../utils/fetch-websocket';
import {
  updatePurses,
  updateOffers,
  serverConnected,
  serverDisconnected,
  deactivateConnection,
  resetState,
  recentOrders,
} from '../store/actions';
import { reducer, createDefaultState } from '../store/reducer';

import dappConstants from '../utils/constants';

const { INSTANCE_REG_KEY } = dappConstants;

export const ApplicationContext = createContext();

export function useApplicationContext() {
  return useContext(ApplicationContext);
}

// eslint-disable-next-line react/prop-types
export default function Provider({ children }) {
  const [state, dispatch] = useReducer(reducer, createDefaultState());

  const { active } = state;

  useEffect(() => {
    function messageHandler(message) {
      if (!message) return;
      const { type, data } = message;
      if (type === 'walletUpdatePurses') {
        dispatch(updatePurses(JSON.parse(data)));
      } else if (type === 'walletOfferDescriptions') {
        dispatch(updateOffers(data));
      }
    }

    function walletGetPurses() {
      return doFetch({ type: 'walletGetPurses' }).then(messageHandler);
    }

    function walletGetOffers() {
      return doFetch({ type: 'walletSubscribeOffers', status: null });
    }

    if (active) {
      activateWebSocket({
        onConnect() {
          dispatch(serverConnected());
          walletGetPurses();
          walletGetOffers();
        },
        onDisconnect() {
          dispatch(serverDisconnected());
          dispatch(deactivateConnection());
          dispatch(resetState());
        },
        onMessage(message) {
          messageHandler(JSON.parse(message));
        },
      });
      return deactivateWebSocket;
    } else {
      deactivateWebSocket();
    }
  }, [active]);

  const apiMessageHandler = useCallback((message) => {
    if (!message) return;
    const { type, data } = message;
    if (type === 'simpleExchange/getRecentOrdersResponse') {
      dispatch(recentOrders(data));
    }
  }, [dispatch]);

  useEffect(() => {
    if (active) {
      activateWebSocket({
        onConnect() {
          console.log('connected to API');
          doFetch({
            type: 'simpleExchange/subscribeRecentOrders',
            data: {
              instanceId: INSTANCE_REG_KEY,
            },
          },
          '/api').then(({ data }) => console.log('subscribed response', data));
        },
        onDisconnect() {
          console.log('disconnected from API');
        },
        onMessage(message) {
          apiMessageHandler(JSON.parse(message));
        },
      }, '/api');
    } else {
      deactivateWebSocket('/api');
    }
  }, [active, apiMessageHandler]);

  return (
    <ApplicationContext.Provider value={{ state, dispatch }}>
      {children}
    </ApplicationContext.Provider>
  );
}
