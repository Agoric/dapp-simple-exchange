import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useReducer,
} from 'react';

import {
  activateWebSocket,
  deactivateWebSocket,
  doFetch,
} from '../utils/fetch-websocket';
import {
  updatePurses,
  updateInviteDepositId,
  updateOffers,
  serverConnected,
  serverDisconnected,
  deactivateConnection,
  resetState,
  recentOrders,
} from '../store/actions';
import { reducer, createDefaultState } from '../store/reducer';

import dappConstants from '../utils/constants';

const { INSTANCE_HANDLE_BOARD_ID, INVITE_BRAND_BOARD_ID } = dappConstants;

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
      } else if (type === 'walletDepositFacetIdResponse') {
        dispatch(updateInviteDepositId(data));
      }
    }

    function walletGetPurses() {
      return doFetch({ type: 'walletGetPurses' }).then(messageHandler);
    }

    function walletGetOffers() {
      return doFetch({ type: 'walletSubscribeOffers', status: null });
    }

    function walletGetInviteDepositId() {
      return doFetch({
        type: 'walletGetDepositFacetId',
        brandBoardId: INVITE_BRAND_BOARD_ID,
      });
    }

    if (active) {
      activateWebSocket({
        onConnect() {
          dispatch(serverConnected());
          walletGetPurses();
          walletGetOffers();
          walletGetInviteDepositId();
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
    }
    deactivateWebSocket();
  }, [active]);

  const apiMessageHandler = useCallback(
    message => {
      if (!message) return;
      const { type, data } = message;
      if (type === 'simpleExchange/getRecentOrdersResponse') {
        dispatch(recentOrders(data));
      } else if (type === 'simpleExchange/sendInviteResponse') {
        // Once the invite has been sent to the user, we update the
        // offer to include the inviteHandleBoardId. Then we make a
        // request to the user's wallet to send the proposed offer for
        // acceptance/rejection.
        const { offer } = data;
        doFetch({
          type: 'walletAddOffer',
          data: offer,
        });
      }
    },
    [dispatch],
  );

  useEffect(() => {
    if (active) {
      activateWebSocket(
        {
          onConnect() {
            console.log('connected to API');
            doFetch(
              {
                type: 'simpleExchange/subscribeRecentOrders',
                data: {
                  instanceHandleBoardId: INSTANCE_HANDLE_BOARD_ID,
                },
              },
              '/api',
            ).then(({ data }) => console.log('subscribed response', data));
          },
          onDisconnect() {
            console.log('disconnected from API');
          },
          onMessage(message) {
            apiMessageHandler(JSON.parse(message));
          },
        },
        '/api',
      );
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
